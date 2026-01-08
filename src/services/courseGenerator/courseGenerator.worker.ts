/**
 * Course Generator Worker
 * 
 * Web Worker that runs all course generation logic in complete isolation.
 * Contains LangGraph, LlamaIndex, Gemini, and all service integrations.
 * 
 * This provides complete ESM isolation - no "star export" conflicts possible.
 */

import { GoogleGenAI } from '@google/genai';
import type {
    MainToWorkerMessage,
    WorkerToMainMessage,
    CourseOutline,
    LessonVideoMatch,
    YouTubeVideo,
} from './workerMessages';
import type {
    Course,
    CourseModule,
    Lesson,
    LessonContent,
    CourseSettings,
    GenerationStageType,
} from '@/types/course';

// ============================================================================
// STATE AND CONFIGURATION
// ============================================================================

let geminiClient: GoogleGenAI | null = null;
let geminiApiKey: string | null = null;
let youtubeApiKey: string | null = null;

// LlamaIndex modules (loaded lazily)
let llamaIndexModules: {
    Document: any;
    VectorStoreIndex: any;
    Settings: any;
    MetadataMode: any;
    SentenceSplitter: any;
    GeminiEmbedding: any;
    GEMINI_EMBEDDING_MODEL: any;
} | null = null;

// Vector indexes for RAG
const ragIndexes = new Map<string, any>();

// Pending approval promises (for human-in-the-loop)
interface PendingApproval {
    resolve: (result: { approved: boolean; outline?: CourseOutline; feedback?: string }) => void;
}
const pendingApprovals = new Map<string, PendingApproval>();

// Pending deep research promises (for main thread routing)
interface PendingResearch {
    resolve: (result: { success: boolean; summary?: string; sources?: Array<{ url: string; title: string }>; error?: string }) => void;
}
const pendingResearch = new Map<string, PendingResearch>();

// Active generation sessions (tracks state and approval request ID)
interface ActiveGeneration {
    cancelled: boolean;
    approvalRequestId?: string;  // ID from APPROVE_OUTLINE message for COMPLETE response
    currentStage: GenerationStageType;
    stageProgress: number;
}
const activeGenerations = new Map<string, ActiveGeneration>();

// ============================================================================
// LAZY LOADERS
// ============================================================================

async function loadLlamaIndex() {
    if (llamaIndexModules) return llamaIndexModules;

    console.log('[CourseWorker] Loading LlamaIndex...');
    const [llamaindex, google] = await Promise.all([
        import('llamaindex'),
        import('@llamaindex/google'),
    ]);

    llamaIndexModules = {
        Document: llamaindex.Document,
        VectorStoreIndex: llamaindex.VectorStoreIndex,
        Settings: llamaindex.Settings,
        MetadataMode: llamaindex.MetadataMode,
        SentenceSplitter: llamaindex.SentenceSplitter,
        GeminiEmbedding: google.GeminiEmbedding,
        GEMINI_EMBEDDING_MODEL: google.GEMINI_EMBEDDING_MODEL,
    };

    console.log('[CourseWorker] LlamaIndex loaded');
    return llamaIndexModules;
}

async function ensureLlamaIndexSetup(): Promise<void> {
    if (!geminiApiKey) throw new Error('Gemini API key not set');

    const { Settings, SentenceSplitter, GeminiEmbedding, GEMINI_EMBEDDING_MODEL } = await loadLlamaIndex();

    if (!Settings.embedModel) {
        Settings.embedModel = new GeminiEmbedding({
            apiKey: geminiApiKey,
            model: GEMINI_EMBEDDING_MODEL.EMBEDDING_001,
        });
        Settings.nodeParser = new SentenceSplitter({
            chunkSize: 512,
            chunkOverlap: 50,
        });
        console.log('[CourseWorker] LlamaIndex configured with Gemini embeddings');
    }
}

// ============================================================================
// GEMINI SERVICE (Inline)
// ============================================================================

function getGeminiClient(): GoogleGenAI {
    if (!geminiClient) {
        throw new Error('Gemini client not initialized');
    }
    return geminiClient;
}

/**
 * Helper for exponential backoff retry on rate limits (429)
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 2000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const isRateLimit = error?.status === 429 ||
                error?.message?.includes('429') ||
                error?.message?.includes('Resource exhausted');

            if (isRateLimit && attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * baseDelay; // 2s, 4s, 8s
                console.warn(`[CourseWorker] Rate limited (429), retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }

    throw lastError || new Error('Failed after retries');
}

async function chatWithGemini(prompt: string, systemContext?: string): Promise<string> {
    const client = getGeminiClient();
    const fullPrompt = systemContext ? `${systemContext}\n\n${prompt}` : prompt;

    return withRetry(async () => {
        const response = await client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: fullPrompt,
        });
        return response.text || '';
    });
}

// ============================================================================
// REAL DEEP RESEARCH SERVICE (using interactions API)
// ============================================================================

interface ResearchProgress {
    status: 'starting' | 'researching' | 'writing' | 'complete' | 'failed';
    progress: number;
    thinking: string;
    sources: { url: string; title: string; status: 'queued' | 'reading' | 'done' | 'failed' }[];
    notes: Record<string, string>;
    report: string | null;
}

/**
 * Start deep research by routing through main thread → Tauri → Gemini API
 * 
 * This bypasses browser CORS restrictions by having the Tauri backend
 * make the actual API call to the Deep Research service.
 * 
 * Flow: Worker → Main Thread → Tauri → Gemini → Tauri → Main Thread → Worker
 */
async function startDeepResearch(
    topic: string,
    focusAreas: string[],
    threadId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _maxTimeMinutes: number = 10
): Promise<string | null> {
    const progress: ResearchProgress = {
        status: 'starting',
        progress: 0,
        thinking: 'Initializing deep research via Tauri backend...',
        sources: [],
        notes: {},
        report: null,
    };

    // Send initial progress
    sendResearchProgress(threadId, progress);
    console.log('[CourseWorker] Starting Deep Research via Tauri for:', topic);

    // Update progress
    progress.status = 'researching';
    progress.thinking = 'Sending request to Tauri backend (no CORS restrictions)...';
    progress.progress = 10;
    sendResearchProgress(threadId, progress);

    // Send request to main thread, which will call Tauri invoke
    const requestMsg: WorkerToMainMessage = {
        type: 'REQUEST_DEEP_RESEARCH',
        threadId,
        payload: {
            topic,
            focusAreas,
        },
    };
    self.postMessage(requestMsg);

    // Update progress
    progress.thinking = 'Waiting for Gemini Deep Research response...';
    progress.progress = 30;
    sendResearchProgress(threadId, progress);

    // Wait for response from main thread
    const result = await new Promise<{
        success: boolean;
        summary?: string;
        sources?: Array<{ url: string; title: string }>;
        error?: string;
    }>((resolve) => {
        pendingResearch.set(threadId, { resolve });
    });

    if (result.success && result.summary) {
        // Update progress with sources
        if (result.sources) {
            progress.sources = result.sources.map(s => ({
                url: s.url,
                title: s.title,
                status: 'done' as const,
            }));
        }

        progress.status = 'complete';
        progress.progress = 100;
        progress.report = result.summary;
        progress.thinking = `Deep Research complete via Tauri! Found ${progress.sources.length} sources.`;
        sendResearchProgress(threadId, progress);

        console.log(`[CourseWorker] Deep Research complete: ${result.summary.length} chars, ${progress.sources.length} sources`);
        return result.summary;
    } else {
        // Research failed
        console.warn('[CourseWorker] Deep Research via Tauri failed:', result.error);

        progress.status = 'failed';
        progress.thinking = `Research failed: ${result.error || 'Unknown error'}`;
        progress.progress = 0;
        sendResearchProgress(threadId, progress);

        return null;
    }
}

/**
 * Send research progress to main thread
 */
function sendResearchProgress(threadId: string, progress: ResearchProgress) {
    const msg: WorkerToMainMessage = {
        type: 'RESEARCH_PROGRESS',
        threadId,
        payload: {
            status: progress.status,
            progress: progress.progress,
            thinking: progress.thinking,
            sources: progress.sources,
            notes: progress.notes,
            partialReport: progress.report,
        },
    };
    self.postMessage(msg);
}

// ============================================================================
// RAG (LLAMAINDEX) FUNCTIONS
// ============================================================================

async function indexResearchReport(courseId: string, topic: string, report: string): Promise<number> {
    await ensureLlamaIndexSetup();
    const { Document, VectorStoreIndex } = await loadLlamaIndex();

    console.log(`[CourseWorker] Indexing research for course: ${courseId}`);

    const document = new Document({
        text: report,
        metadata: { courseId, topic, createdAt: new Date().toISOString() },
    });

    const index = await VectorStoreIndex.fromDocuments([document]);
    ragIndexes.set(courseId, index);

    const estimatedChunks = Math.ceil(report.length / 512);
    console.log(`[CourseWorker] Created ~${estimatedChunks} chunks`);
    return estimatedChunks;
}

async function queryRAG(courseId: string, lessonTitle: string, topics: string[]): Promise<string> {
    const index = ragIndexes.get(courseId);
    if (!index) return '';

    await ensureLlamaIndexSetup();
    const { MetadataMode } = await loadLlamaIndex();

    const query = `${lessonTitle}: ${topics.join(', ')}`;
    const retriever = index.asRetriever({ similarityTopK: 3 });
    const nodes = await retriever.retrieve(query);

    if (!nodes || nodes.length === 0) return '';

    return nodes.map((n: any) => n.node.getContent(MetadataMode.NONE)).join('\n\n---\n\n');
}

// ============================================================================
// YOUTUBE SEARCH (Inline)
// ============================================================================

async function searchYouTubeVideos(
    query: string,
    maxResults: number = 3
): Promise<YouTubeVideo[]> {
    if (!youtubeApiKey) return [];

    try {
        const params = new URLSearchParams({
            part: 'snippet',
            type: 'video',
            q: query,
            maxResults: String(maxResults),
            videoEmbeddable: 'true',
            key: youtubeApiKey,
        });

        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
        if (!response.ok) return [];

        const data = await response.json();

        return (data.items || []).map((item: any) => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnailUrl: item.snippet.thumbnails?.high?.url || '',
            description: item.snippet.description,
        }));
    } catch (error) {
        console.warn('[CourseWorker] YouTube search failed:', error);
        return [];
    }
}

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

const ANALYSIS_PROMPT = `You are an expert curriculum designer. Analyze this topic and provide insights:

TOPIC: {TOPIC}
DIFFICULTY: {DIFFICULTY}
FOCUS AREAS: {FOCUS_AREAS}

Analyze:
1. What prerequisite knowledge is needed?
2. What are the core concepts to cover?
3. What's the optimal learning sequence?
4. What types of content work best (lectures, videos, practice)?
5. Estimated total learning time

Return your analysis as a JSON object:
{
  "prerequisites": ["prereq1", "prereq2"],
  "coreConceptsByArea": {
    "area1": ["concept1", "concept2"]
  },
  "suggestedSequence": ["topic1", "topic2"],
  "estimatedHours": 20
}`;

const OUTLINE_PROMPT = `You are an expert curriculum designer creating a comprehensive course outline.

TOPIC: {TOPIC}
DIFFICULTY: {DIFFICULTY}
ESTIMATED HOURS: {ESTIMATED_HOURS}
PREREQUISITES: {PREREQUISITES}
CORE CONCEPTS: {CORE_CONCEPTS}
FOCUS AREAS: {FOCUS_AREAS}
{FEEDBACK_SECTION}

Create a detailed course outline with modules and lessons. Each module should have 3-5 lessons.
Lessons should mix types: lectures for theory, videos for demonstrations, practice for hands-on, quiz for assessment.

Return ONLY a JSON object with this structure:
{
  "title": "Course Title",
  "topic": "topic",
  "description": "Course description",
  "difficulty": "intermediate",
  "estimatedHours": 20,
  "prerequisites": ["prereq1"],
  "learningObjectives": ["objective1"],
  "modules": [
    {
      "id": "module-1",
      "title": "Module Title",
      "description": "Module description",
      "order": 1,
      "lessons": [
        {
          "id": "lesson-1-1",
          "title": "Lesson Title",
          "type": "lecture",
          "estimatedMinutes": 30,
          "keyTopics": ["topic1"],
          "learningObjectives": ["objective1"],
          "order": 1
        }
      ]
    }
  ]
}`;

// ============================================================================
// TYPE-SPECIFIC LESSON PROMPTS
// ============================================================================

const LATEX_FORMATTING_RULES = `
CRITICAL FORMATTING RULES FOR MATHEMATICS:
- Use LaTeX for ALL mathematical expressions
- Inline math: $x^2 + y^2$ (single dollar signs)
- Block math (centered, own line): $$\\int_0^1 f(x) dx$$ (double dollar signs)
- DO NOT use HTML tags like <sup>, <sub>, <br>, etc.
- Common symbols: $\\sin$, $\\cos$, $\\tan$, $\\log$, $\\ln$, $\\sum$, $\\prod$, $\\int$
- Fractions: $\\frac{a}{b}$
- Powers: $x^{2}$ or $x^n$
- Subscripts: $x_{i}$ or $a_{n}$
- Greek letters: $\\alpha$, $\\beta$, $\\gamma$, $\\theta$, $\\pi$
- Roots: $\\sqrt{x}$, $\\sqrt[3]{x}$
- Limits: $\\lim_{x \\to 0}$

DIAGRAM FORMATTING (use mermaid):
- Use \`\`\`mermaid code blocks for flowcharts and diagrams
- Example: graph LR; A-->B for simple flows
`;

const LECTURE_PROMPT = `Create detailed LECTURE content for this lesson:

LESSON: {LESSON_TITLE}
KEY TOPICS: {KEY_TOPICS}
OBJECTIVES: {LEARNING_OBJECTIVES}
MODULE: {MODULE_CONTEXT}
COURSE: {COURSE_CONTEXT}
{RESEARCH_CONTEXT}
${LATEX_FORMATTING_RULES}

Create comprehensive markdown content including:
1. Introduction explaining what will be learned
2. Clear explanations of each concept with examples
3. Step-by-step breakdowns for complex procedures
4. Key definitions and formulas (use LaTeX!)
5. Real-world applications and examples
6. Summary of key takeaways
7. Include 2-3 practice problems at the end

Return ONLY a JSON object (no markdown code fence):
{
  "markdown": "# Lesson Title\\n\\nIntroduction...\\n\\n## Section 1\\n\\nContent with $LaTeX$ math...\\n\\n### Example\\n\\nStep-by-step solution with $$block equations$$...",
  "practiceProblems": [
    {
      "question": "Question using $LaTeX$ notation",
      "options": ["$option A$", "$option B$", "$option C$", "$option D$"],
      "correctAnswer": 0,
      "explanation": "Explanation with $math$ if needed"
    }
  ]
}`;

const VIDEO_PROMPT = `Create VIDEO lesson overview for this lesson:

LESSON: {LESSON_TITLE}
KEY TOPICS: {KEY_TOPICS}
OBJECTIVES: {LEARNING_OBJECTIVES}
MODULE: {MODULE_CONTEXT}
COURSE: {COURSE_CONTEXT}
{RESEARCH_CONTEXT}
${LATEX_FORMATTING_RULES}

Videos will be sourced from YouTube automatically. Create:
1. Brief introduction explaining what the video will cover
2. Key concepts to watch for (bullet points)
3. Pre-viewing questions to consider
4. Notes section for students to fill in
5. Post-viewing summary and reflection questions

Return ONLY a JSON object:
{
  "markdown": "# {LESSON_TITLE}\\n\\n## About This Video Lesson\\n\\nIn this lesson, you'll learn about...\\n\\n## Key Concepts to Watch For\\n\\n- Concept 1: Explanation\\n- Concept 2: Explanation\\n\\n## Before You Watch\\n\\nConsider these questions...\\n\\n## Notes\\n\\n_Take notes here as you watch..._\\n\\n## After Watching\\n\\nReflection questions...",
  "practiceProblems": []
}`;

const PRACTICE_PROMPT = `Create PRACTICE PROBLEMS for this lesson:

LESSON: {LESSON_TITLE}
KEY TOPICS: {KEY_TOPICS}
OBJECTIVES: {LEARNING_OBJECTIVES}
MODULE: {MODULE_CONTEXT}
COURSE: {COURSE_CONTEXT}
{RESEARCH_CONTEXT}
${LATEX_FORMATTING_RULES}

Create a comprehensive practice session with:
1. Brief recap of key concepts (2-3 paragraphs)
2. Worked example with step-by-step solution
3. 5-8 practice problems ranging from easy to challenging
4. Each problem should have multiple choice answers

Return ONLY a JSON object:
{
  "markdown": "# Practice: {LESSON_TITLE}\\n\\n## Concept Recap\\n\\nBrief review...\\n\\n## Worked Example\\n\\n**Problem:** Description with $math$\\n\\n**Solution:**\\n\\nStep 1: ...\\n\\nStep 2: ...\\n\\n$$final answer$$",
  "practiceProblems": [
    {
      "question": "Problem 1: Calculate $\\\\frac{d}{dx}(x^2 + 3x)$",
      "options": ["$2x + 3$", "$x^2$", "$2x$", "$3x$"],
      "correctAnswer": 0,
      "explanation": "Using the power rule: $\\\\frac{d}{dx}(x^n) = nx^{n-1}$, we get $2x + 3$"
    },
    {
      "question": "Problem 2: ...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 1,
      "explanation": "Explanation..."
    }
  ]
}`;

const QUIZ_PROMPT = `Create a QUIZ for this lesson:

LESSON: {LESSON_TITLE}
KEY TOPICS: {KEY_TOPICS}
OBJECTIVES: {LEARNING_OBJECTIVES}
MODULE: {MODULE_CONTEXT}
COURSE: {COURSE_CONTEXT}
{RESEARCH_CONTEXT}
${LATEX_FORMATTING_RULES}

Create a comprehensive quiz with:
1. Brief instructions
2. 8-10 multiple choice questions covering all key topics
3. Mix of difficulty levels (easy, medium, hard)
4. Clear, unambiguous questions

Return ONLY a JSON object:
{
  "markdown": "# Quiz: {LESSON_TITLE}\\n\\n## Instructions\\n\\nAnswer all questions. Each question has one correct answer.\\n\\n**Topics Covered:** Key topic list\\n\\n**Time Limit:** Suggested 15-20 minutes",
  "practiceProblems": [
    {
      "question": "What is the derivative of $\\\\sin(x)$?",
      "options": ["$\\\\cos(x)$", "$-\\\\cos(x)$", "$\\\\sin(x)$", "$-\\\\sin(x)$"],
      "correctAnswer": 0,
      "explanation": "The derivative of $\\\\sin(x)$ is $\\\\cos(x)$"
    },
    {
      "question": "Question 2...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 2,
      "explanation": "Explanation..."
    }
  ]
}`;

const SLIDES_PROMPT = `Create SLIDE-BASED content for this lesson:

LESSON: {LESSON_TITLE}
KEY TOPICS: {KEY_TOPICS}
OBJECTIVES: {LEARNING_OBJECTIVES}
MODULE: {MODULE_CONTEXT}
COURSE: {COURSE_CONTEXT}
{RESEARCH_CONTEXT}
${LATEX_FORMATTING_RULES}

Create content organized as presentation slides:
1. Title slide with lesson title
2. Objectives slide
3. 6-10 content slides with key concepts
4. Each slide should have a clear heading and bullet points
5. Include visual descriptions for diagrams
6. Summary slide
7. Questions slide

Use --- to separate slides.

Return ONLY a JSON object:
{
  "markdown": "# {LESSON_TITLE}\\n\\n---\\n\\n## Learning Objectives\\n\\n- Objective 1\\n- Objective 2\\n\\n---\\n\\n## Slide 1: Key Concept\\n\\n- Bullet point with $math$\\n- Another point\\n\\n> Key insight or quote\\n\\n---\\n\\n## Slide 2: Next Topic\\n\\n\`\`\`mermaid\\ngraph LR\\n  A[Input] --> B[Process] --> C[Output]\\n\`\`\`\\n\\n---\\n\\n## Summary\\n\\n- Key takeaway 1\\n- Key takeaway 2",
  "practiceProblems": []
}`;

/**
 * Get the appropriate prompt for a lesson type
 */
function getLessonPrompt(lessonType: string): string {
    switch (lessonType) {
        case 'lecture':
            return LECTURE_PROMPT;
        case 'video':
            return VIDEO_PROMPT;
        case 'practice':
            return PRACTICE_PROMPT;
        case 'quiz':
            return QUIZ_PROMPT;
        case 'slides':
            return SLIDES_PROMPT;
        default:
            return LECTURE_PROMPT;
    }
}

// ============================================================================
// STATE TYPE (Worker-local)
// ============================================================================

interface CourseGeneratorState {
    threadId: string;
    topic: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    settings: Partial<CourseSettings>;
    focusAreas: string[];
    researchReport: string | null;
    pendingOutline: CourseOutline | null;
    approvedOutline: CourseOutline | null;
    generatedModules: CourseModule[];
    lessonVideos: LessonVideoMatch[];
    finalCourse: Course | null;
    currentStage: GenerationStageType;
    stageProgress: number;
    thinkingOutput: string;
    error: string | null;
    // Content coherence: track what each lesson covers
    lessonSummaries: Map<string, {
        title: string;
        conceptsIntroduced: string[];
        summary: string;
    }>;
}

// ============================================================================
// NODE IMPLEMENTATIONS
// ============================================================================

async function runDeepResearch(state: CourseGeneratorState): Promise<Partial<CourseGeneratorState>> {
    console.log('[CourseWorker] Phase 0: Deep Research');

    // Use real deep research with streaming progress
    const report = await startDeepResearch(
        state.topic,
        state.focusAreas,
        state.threadId  // Progress is now streamed via RESEARCH_PROGRESS messages
    );

    if (report) {
        return {
            researchReport: report,
            stageProgress: 5,
            thinkingOutput: state.thinkingOutput + `🔬 Deep Research Complete\n\nReport: ${report.length} chars\n\n`,
        };
    }

    return {
        thinkingOutput: state.thinkingOutput + `⚠️ Deep Research skipped\n\n`,
    };
}

async function runIndexKnowledge(state: CourseGeneratorState): Promise<Partial<CourseGeneratorState>> {
    if (!state.researchReport) return {};

    console.log('[CourseWorker] Phase 0.5: Indexing Knowledge');

    try {
        const courseId = `course-${Date.now()}`;
        const chunks = await indexResearchReport(courseId, state.topic, state.researchReport);

        return {
            thinkingOutput: state.thinkingOutput + `📚 Knowledge Indexed: ~${chunks} chunks\n\n`,
        };
    } catch (error) {
        console.warn('[CourseWorker] Indexing failed:', error);
        return {};
    }
}

async function runAnalyzeTopic(state: CourseGeneratorState): Promise<Partial<CourseGeneratorState>> {
    console.log('[CourseWorker] Phase 1: Analyze Topic');

    const prompt = ANALYSIS_PROMPT
        .replace('{TOPIC}', state.topic)
        .replace('{DIFFICULTY}', state.difficulty)
        .replace('{FOCUS_AREAS}', state.focusAreas.join(', ') || 'None');

    const response = await chatWithGemini(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    let analysis = { prerequisites: [], coreConceptsByArea: {}, estimatedHours: 20 };
    if (jsonMatch) {
        try { analysis = JSON.parse(jsonMatch[0]); } catch { }
    }

    return {
        currentStage: 'planning',
        stageProgress: 10,
        thinkingOutput: state.thinkingOutput + `📊 Topic Analysis Complete\n\nEstimated Hours: ${analysis.estimatedHours}\n\n`,
    };
}

async function runGenerateOutline(
    state: CourseGeneratorState,
    analysis: any,
    feedback?: string
): Promise<Partial<CourseGeneratorState>> {
    console.log('[CourseWorker] Phase 2: Generate Outline' + (feedback ? ' (with feedback)' : ''));

    // Build feedback section if user rejected previous outline
    const feedbackSection = feedback
        ? `\nIMPORTANT: The previous outline was rejected. Please address this feedback:\n${feedback}\n`
        : '';

    const prompt = OUTLINE_PROMPT
        .replace('{TOPIC}', state.topic)
        .replace('{DIFFICULTY}', state.difficulty)
        .replace('{ESTIMATED_HOURS}', String(analysis?.estimatedHours || 20))
        .replace('{PREREQUISITES}', JSON.stringify(analysis?.prerequisites || []))
        .replace('{CORE_CONCEPTS}', JSON.stringify(analysis?.coreConceptsByArea || {}))
        .replace('{FOCUS_AREAS}', state.focusAreas.join(', ') || 'None')
        .replace('{FEEDBACK_SECTION}', feedbackSection);

    const response = await chatWithGemini(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
        throw new Error('Failed to parse outline response');
    }

    const outline: CourseOutline = JSON.parse(jsonMatch[0]);

    return {
        pendingOutline: outline,
        currentStage: 'planning',
        stageProgress: 25,
        thinkingOutput: state.thinkingOutput +
            `📝 Outline Generated\n\nTitle: ${outline.title}\nModules: ${outline.modules.length}\n\n⏸️ Waiting for approval...\n\n`,
    };
}

async function runGenerateContent(state: CourseGeneratorState): Promise<Partial<CourseGeneratorState>> {
    console.log('[CourseWorker] Phase 3: Generate Content');

    const outline = state.approvedOutline;
    if (!outline) return { error: 'No approved outline' };

    const generatedModules: CourseModule[] = [];
    const totalModules = outline.modules.length;
    const courseId = `course-${Date.now()}`;

    // Track lesson summaries for content coherence
    const lessonSummaries = new Map(state.lessonSummaries);
    let completedLessons: { title: string; topics: string[]; moduleTitle: string }[] = [];

    for (let i = 0; i < totalModules; i++) {
        const moduleOutline = outline.modules[i];
        console.log(`[CourseWorker] Module ${i + 1}/${totalModules}: ${moduleOutline.title}`);

        const lessons: Lesson[] = [];

        for (const lessonOutline of moduleOutline.lessons) {
            console.log(`[CourseWorker]   └─ Lesson: ${lessonOutline.title}`);

            // Get RAG context
            let researchContext = '';
            try {
                const context = await queryRAG(courseId, lessonOutline.title, lessonOutline.keyTopics);
                if (context) {
                    researchContext = `\nRESEARCH CONTEXT:\n${context}\n---\n`;
                }
            } catch { }

            // Build previous lessons context for coherence
            let previousLessonsContext = '';
            if (completedLessons.length > 0) {
                const recentLessons = completedLessons.slice(-5); // Last 5 lessons
                previousLessonsContext = `
PREVIOUS LESSONS IN THIS COURSE (build on these, do not repeat):
${recentLessons.map((l, idx) =>
                    `${idx + 1}. "${l.title}" (${l.moduleTitle}) - covered: ${l.topics.join(', ')}`
                ).join('\n')}

IMPORTANT: 
- Reference concepts from previous lessons when relevant (e.g., "As we learned in ${recentLessons[0]?.title}...")
- Do NOT repeat explanations of concepts already covered
- Build progressively on established knowledge
`;
            }

            // Get the type-specific prompt for this lesson
            const prompt = getLessonPrompt(lessonOutline.type)
                .replace('{LESSON_TITLE}', lessonOutline.title)
                .replace('{KEY_TOPICS}', lessonOutline.keyTopics.join(', '))
                .replace('{LEARNING_OBJECTIVES}', lessonOutline.learningObjectives.join(', '))
                .replace('{MODULE_CONTEXT}', `${moduleOutline.title}: ${moduleOutline.description}`)
                .replace('{COURSE_CONTEXT}', `${outline.title} - ${outline.description}`)
                .replace('{RESEARCH_CONTEXT}', researchContext + previousLessonsContext);

            const response = await chatWithGemini(prompt);

            // Parse the response - extract markdown and practice problems
            let content: LessonContent = { markdown: '' };

            // Try to parse as JSON first
            const trimmedResponse = response.trim();

            // Check if response looks like JSON (starts with { and ends with })
            if (trimmedResponse.startsWith('{') && trimmedResponse.endsWith('}')) {
                try {
                    const parsed = JSON.parse(trimmedResponse);
                    if (parsed.markdown) {
                        const practiceProblems = (parsed.practiceProblems || []).map((p: any, idx: number) => ({
                            id: `${lessonOutline.id}-problem-${idx}`,
                            question: p.question,
                            options: p.options,
                            correctIndex: p.correctIndex ?? p.correctAnswer ?? 0,
                            explanation: p.explanation || '',
                        }));
                        content = {
                            markdown: parsed.markdown,
                            practiceProblems,
                        };
                        console.log(`[CourseWorker] ✓ Parsed JSON for "${lessonOutline.title}"`);
                    } else {
                        // JSON but no markdown field - use response as markdown
                        console.warn(`[CourseWorker] JSON has no 'markdown' field for "${lessonOutline.title}"`);
                        content = { markdown: trimmedResponse };
                    }
                } catch (parseError) {
                    console.warn(`[CourseWorker] JSON parse failed for "${lessonOutline.title}":`, parseError);
                    // Fall through to regex extraction
                }
            }

            // If we don't have content yet, try regex extraction for embedded JSON
            if (!content.markdown) {
                // Look for JSON block in markdown code fence
                const jsonCodeBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonCodeBlockMatch) {
                    try {
                        const parsed = JSON.parse(jsonCodeBlockMatch[1]);
                        if (parsed.markdown) {
                            const practiceProblems = (parsed.practiceProblems || []).map((p: any, idx: number) => ({
                                id: `${lessonOutline.id}-problem-${idx}`,
                                question: p.question,
                                options: p.options,
                                correctIndex: p.correctIndex ?? p.correctAnswer ?? 0,
                                explanation: p.explanation || '',
                            }));
                            content = {
                                markdown: parsed.markdown,
                                practiceProblems,
                            };
                            console.log(`[CourseWorker] ✓ Extracted JSON from code block for "${lessonOutline.title}"`);
                        }
                    } catch {
                        // Continue to next fallback
                    }
                }
            }

            // If still no content, try to find any JSON object with markdown field
            if (!content.markdown) {
                // Non-greedy match for JSON object
                const jsonMatch = response.match(/\{[^{}]*"markdown"\s*:\s*"[\s\S]*?(?:"\s*,|\s*\})/);
                if (jsonMatch) {
                    try {
                        // Try to extract just the markdown value
                        const markdownMatch = response.match(/"markdown"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                        if (markdownMatch) {
                            // Unescape the JSON string
                            const markdown = markdownMatch[1]
                                .replace(/\\n/g, '\n')
                                .replace(/\\t/g, '\t')
                                .replace(/\\"/g, '"')
                                .replace(/\\\\/g, '\\');
                            content = { markdown };
                            console.log(`[CourseWorker] ✓ Extracted markdown field for "${lessonOutline.title}"`);
                        }
                    } catch {
                        // Continue to final fallback
                    }
                }
            }

            // Final fallback: use entire response as markdown (but clean it up)
            if (!content.markdown) {
                let markdown = response;

                // Remove JSON wrapper if present but malformed
                if (markdown.includes('"markdown"') && markdown.includes('"practiceProblems"')) {
                    console.warn(`[CourseWorker] Response looks like malformed JSON, cleaning up for "${lessonOutline.title}"`);
                    // Try to extract just the content between first quotes after "markdown":
                    const manualMatch = markdown.match(/"markdown"\s*:\s*"([^]*?)"\s*,\s*"practiceProblems"/);
                    if (manualMatch) {
                        markdown = manualMatch[1]
                            .replace(/\\n/g, '\n')
                            .replace(/\\t/g, '\t')
                            .replace(/\\"/g, '"')
                            .replace(/\\\\/g, '\\');
                    }
                }

                content = { markdown };
                console.log(`[CourseWorker] Using fallback markdown for "${lessonOutline.title}" (${markdown.length} chars)`);
            }

            // Track this lesson for content coherence
            lessonSummaries.set(lessonOutline.id, {
                title: lessonOutline.title,
                conceptsIntroduced: lessonOutline.keyTopics,
                summary: `Covered: ${lessonOutline.keyTopics.join(', ')}`,
            });

            // Add to completed lessons for context
            completedLessons.push({
                title: lessonOutline.title,
                topics: lessonOutline.keyTopics,
                moduleTitle: moduleOutline.title,
            });

            lessons.push({
                id: lessonOutline.id,
                moduleId: moduleOutline.id,
                title: lessonOutline.title,
                type: lessonOutline.type,
                duration: `${lessonOutline.estimatedMinutes} min`,
                order: lessonOutline.order,
                status: 'available',
                content,
            });
        }

        generatedModules.push({
            id: moduleOutline.id,
            courseId: '',
            title: moduleOutline.title,
            description: moduleOutline.description,
            order: moduleOutline.order,
            status: 'available',
            lessons,
            progress: 0,
        });

        // Send progress update
        const progress = 25 + Math.round(((i + 1) / totalModules) * 35);
        sendProgress(state.threadId, 'content', progress,
            state.thinkingOutput + `✍️ Module ${i + 1}/${totalModules} complete\n`);
    }

    return {
        generatedModules,
        lessonSummaries,
        currentStage: 'content',
        stageProgress: 60,
        thinkingOutput: state.thinkingOutput + `✍️ Content Generated\n\nModules: ${generatedModules.length}\nLessons: ${generatedModules.reduce((s, m) => s + m.lessons.length, 0)}\n\n`,
    };
}

async function runVideoMatching(state: CourseGeneratorState): Promise<Partial<CourseGeneratorState>> {
    console.log('[CourseWorker] Phase 4: Video Matching');

    if (!state.settings.includeVideos || !youtubeApiKey) {
        return { currentStage: 'multimedia', stageProgress: 80 };
    }

    const lessonVideos: LessonVideoMatch[] = [];

    for (const module of state.generatedModules) {
        for (const lesson of module.lessons) {
            if (lesson.type === 'video' || lesson.type === 'lecture') {
                const videos = await searchYouTubeVideos(`${lesson.title} tutorial`, 3);
                lessonVideos.push({
                    lessonId: lesson.id,
                    videos,
                    selectedVideoId: videos[0]?.videoId || null,
                });
            }
        }
    }

    return {
        lessonVideos,
        currentStage: 'multimedia',
        stageProgress: 80,
        thinkingOutput: state.thinkingOutput + `🎬 Video Matching Complete\n\n`,
    };
}

async function runFinalize(state: CourseGeneratorState): Promise<Partial<CourseGeneratorState>> {
    console.log('[CourseWorker] Phase 5: Finalize');

    const outline = state.approvedOutline;
    if (!outline) return { error: 'No approved outline' };

    const courseId = `course-${Date.now()}`;

    const videoMap = new Map<string, string>();
    for (const lv of state.lessonVideos) {
        if (lv.selectedVideoId) videoMap.set(lv.lessonId, lv.selectedVideoId);
    }

    const modules = state.generatedModules.map(m => ({
        ...m,
        courseId,
        lessons: m.lessons.map(lesson => {
            const videoId = videoMap.get(lesson.id);
            if (videoId) {
                return {
                    ...lesson,
                    content: {
                        ...lesson.content,
                        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
                        videoId,
                    },
                };
            }
            return lesson;
        }),
    }));

    const course: Course = {
        id: courseId,
        title: outline.title,
        topic: outline.topic,
        description: outline.description,
        difficulty: outline.difficulty,
        estimatedHours: outline.estimatedHours,
        modules,
        prerequisites: outline.prerequisites,
        learningObjectives: outline.learningOutcomes || [],
        generatedAt: new Date().toISOString(),
        thinkingTrace: state.thinkingOutput,
        status: 'ready',
        progress: 0,
        settings: state.settings as CourseSettings,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    return {
        finalCourse: course,
        currentStage: 'review',
        stageProgress: 100,
        thinkingOutput: state.thinkingOutput +
            `🎉 Course Complete!\n\nTitle: ${course.title}\nModules: ${modules.length}\n`,
    };
}

// ============================================================================
// MAIN GENERATION FLOW
// ============================================================================

async function runCourseGeneration(
    threadId: string,
    topic: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced',
    settings: Partial<CourseSettings>,
    focusAreas: string[],
    requestId: string
): Promise<void> {
    console.log(`[CourseWorker] Starting generation: "${topic}"`);

    const session: ActiveGeneration = {
        cancelled: false,
        currentStage: 'analysis',
        stageProgress: 0
    };
    activeGenerations.set(threadId, session);

    let state: CourseGeneratorState = {
        threadId,
        topic,
        difficulty,
        settings,
        focusAreas,
        researchReport: null,
        pendingOutline: null,
        approvedOutline: null,
        generatedModules: [],
        lessonVideos: [],
        finalCourse: null,
        currentStage: 'analysis',
        stageProgress: 0,
        thinkingOutput: '',
        error: null,
        lessonSummaries: new Map(),
    };

    try {
        // Phase 0: Deep Research
        if (!session.cancelled) {
            state = { ...state, ...await runDeepResearch(state) };
            sendProgress(threadId, state.currentStage, state.stageProgress, state.thinkingOutput);
        }

        // Phase 0.5: Index Knowledge
        if (!session.cancelled) {
            state = { ...state, ...await runIndexKnowledge(state) };
        }

        // Phase 1: Analyze
        if (!session.cancelled) {
            const analysisResult = await runAnalyzeTopic(state);
            state = { ...state, ...analysisResult };
            sendProgress(threadId, state.currentStage, state.stageProgress, state.thinkingOutput);
        }

        // Phase 2: Generate Outline (with rejection/regeneration loop)
        let outlineApproved = false;
        let outlineFeedback: string | undefined;

        while (!session.cancelled && !outlineApproved) {
            // Generate outline (with feedback if this is a regeneration)
            state = { ...state, ...await runGenerateOutline(state, null, outlineFeedback) };

            if (!state.pendingOutline) {
                throw new Error('Failed to generate outline');
            }

            // Send outline for approval and wait
            sendOutlineReady(threadId, state.pendingOutline, state.thinkingOutput);
            const approval = await waitForApproval(threadId);

            if (approval.approved) {
                outlineApproved = true;
                state.approvedOutline = approval.outline || state.pendingOutline;
                state.thinkingOutput += `✅ Outline approved!\n\n`;
                console.log('[CourseWorker] Outline approved');
            } else {
                // Rejected - prepare for regeneration
                outlineFeedback = approval.feedback;
                state.pendingOutline = null;
                state.thinkingOutput += `🔄 Regenerating outline with feedback: ${outlineFeedback}\n\n`;
                console.log('[CourseWorker] Outline rejected, regenerating with feedback:', outlineFeedback);
            }
        }

        // Phase 3: Generate Content
        if (!session.cancelled && state.approvedOutline) {
            state = { ...state, ...await runGenerateContent(state) };
            sendProgress(threadId, state.currentStage, state.stageProgress, state.thinkingOutput);
        }

        // Phase 4: Video Matching
        if (!session.cancelled) {
            state = { ...state, ...await runVideoMatching(state) };
            sendProgress(threadId, state.currentStage, state.stageProgress, state.thinkingOutput);
        }

        // Phase 5: Finalize
        if (!session.cancelled) {
            state = { ...state, ...await runFinalize(state) };
        }

        // Send completion - use approval request ID if available (for proper response matching)
        if (!session.cancelled && state.finalCourse) {
            const completeId = session.approvalRequestId || requestId;
            sendComplete(completeId, threadId, state.finalCourse, state.thinkingOutput);
        }

    } catch (error) {
        console.error('[CourseWorker] Generation error:', error);
        const errorId = session.approvalRequestId || requestId;
        sendError(errorId, threadId,
            error instanceof Error ? error.message : 'Generation failed',
            state.currentStage);
    } finally {
        activeGenerations.delete(threadId);
    }
}

// ============================================================================
// APPROVAL WAITING
// ============================================================================

function waitForApproval(threadId: string): Promise<{
    approved: boolean;
    outline?: CourseOutline;
    feedback?: string;
}> {
    return new Promise(resolve => {
        pendingApprovals.set(threadId, { resolve });
    });
}

// ============================================================================
// MESSAGE SENDERS
// ============================================================================

function sendProgress(threadId: string, stage: GenerationStageType, progress: number, thinking: string) {
    // Update session state for GET_STATUS
    const session = activeGenerations.get(threadId);
    if (session) {
        session.currentStage = stage;
        session.stageProgress = progress;
    }

    const msg: WorkerToMainMessage = {
        type: 'PROGRESS',
        threadId,
        payload: { stage, stageProgress: progress, thinkingOutput: thinking, currentNode: stage },
    };
    self.postMessage(msg);
}

function sendOutlineReady(threadId: string, outline: CourseOutline, thinking: string) {
    const msg: WorkerToMainMessage = {
        type: 'OUTLINE_READY',
        threadId,
        payload: { outline, thinkingOutput: thinking },
    };
    self.postMessage(msg);
}

function sendComplete(id: string, threadId: string, course: Course, thinking: string) {
    const msg: WorkerToMainMessage = {
        type: 'COMPLETE',
        id,
        threadId,
        payload: { course, thinkingOutput: thinking },
    };
    self.postMessage(msg);
}

function sendError(id: string, threadId: string, error: string, stage: GenerationStageType) {
    const msg: WorkerToMainMessage = {
        type: 'ERROR',
        id,
        threadId,
        payload: { error, stage },
    };
    self.postMessage(msg);
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

self.onmessage = async (event: MessageEvent<MainToWorkerMessage>) => {
    const msg = event.data;
    console.log(`[CourseWorker] Received: ${msg.type}`);

    switch (msg.type) {
        case 'START_GENERATION': {
            // Initialize clients
            geminiApiKey = msg.payload.geminiApiKey;
            geminiClient = new GoogleGenAI({ apiKey: geminiApiKey });
            youtubeApiKey = msg.payload.youtubeApiKey || null;

            // Start generation (async - don't await)
            runCourseGeneration(
                msg.payload.threadId,
                msg.payload.topic,
                msg.payload.difficulty,
                msg.payload.settings,
                msg.payload.focusAreas,
                msg.id
            );
            break;
        }

        case 'APPROVE_OUTLINE': {
            // Store the approval request ID for use in COMPLETE message
            const session = activeGenerations.get(msg.payload.threadId);
            if (session) {
                session.approvalRequestId = msg.id;
            }

            const pending = pendingApprovals.get(msg.payload.threadId);
            if (pending) {
                pendingApprovals.delete(msg.payload.threadId);
                pending.resolve({
                    approved: true,
                    outline: msg.payload.modifiedOutline,
                });
            }
            break;
        }

        case 'REJECT_OUTLINE': {
            const pending = pendingApprovals.get(msg.payload.threadId);
            if (pending) {
                pendingApprovals.delete(msg.payload.threadId);
                pending.resolve({
                    approved: false,
                    feedback: msg.payload.feedback,
                });
            }
            break;
        }

        case 'CANCEL': {
            const session = activeGenerations.get(msg.payload.threadId);
            if (session) {
                session.cancelled = true;
            }
            const cancelledMsg: WorkerToMainMessage = {
                type: 'CANCELLED',
                id: msg.id,
                threadId: msg.payload.threadId,
            };
            self.postMessage(cancelledMsg);
            break;
        }

        case 'GET_STATUS': {
            const session = activeGenerations.get(msg.payload.threadId);
            const statusMsg: WorkerToMainMessage = {
                type: 'STATUS',
                id: msg.id,
                threadId: msg.payload.threadId,
                payload: {
                    status: session ? 'running' : 'idle',
                    stage: session?.currentStage || 'analysis',
                    progress: session?.stageProgress || 0,
                },
            };
            self.postMessage(statusMsg);
            break;
        }

        case 'DEEP_RESEARCH_RESULT': {
            // Resolve pending deep research promise
            const pending = pendingResearch.get(msg.threadId);
            if (pending) {
                pendingResearch.delete(msg.threadId);
                pending.resolve({
                    success: msg.payload.success,
                    summary: msg.payload.summary,
                    sources: msg.payload.sources,
                    error: msg.payload.error,
                });
            }
            break;
        }
    }
};

console.log('[CourseWorker] Worker thread started');
