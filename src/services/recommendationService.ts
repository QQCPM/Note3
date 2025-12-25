import { tauriAI } from './tauriAI';
import { geminiService } from './geminiService';
import type {
  RecommendationData,
  MindmapData,
  FlashcardData,
  ConceptData,
  ExerciseData,
  ResourceData,
  SlideData,
  RecommendationCache,
  RecommendationType,
} from '@/types/recommendation';

// Cache for recommendations (5 minute TTL)
const CACHE_TTL = 5 * 60 * 1000;
const recommendationCache = new Map<string, RecommendationCache>();

/**
 * Get cached recommendation or null if expired/missing
 */
function getCachedRecommendation(noteId: string): RecommendationData | null {
  const cached = recommendationCache.get(noteId);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL) {
    recommendationCache.delete(noteId);
    return null;
  }

  return cached.data;
}

/**
 * Cache a recommendation
 */
function cacheRecommendation(noteId: string, data: RecommendationData): void {
  recommendationCache.set(noteId, {
    noteId,
    data,
    timestamp: Date.now(),
  });
}

/**
 * Convert block math ($$...$$) to inline math ($...$) for consistency
 * The canvas only supports inline math, so we normalize all math to inline format
 * This ensures compatibility even if AI generates block math
 */
function normalizeLatexToInline(content: string): string {
  if (!content || typeof content !== 'string') return content;

  // Convert block math $$...$$ to inline math $...$
  // Handle both single-line and multi-line block math
  // Use non-greedy matching to handle multiple block math expressions
  let normalized = content;

  // Match block math expressions (non-greedy to handle multiple)
  normalized = normalized.replace(/\$\$([\s\S]*?)\$\$/g, (_match, formula) => {
    // Remove leading/trailing whitespace and normalize newlines to spaces
    const cleaned = formula.trim().replace(/\s+/g, ' ');
    // Convert to inline math
    return `$${cleaned}$`;
  });

  return normalized;
}

/**
 * Parse JSON response from AI, with fallback to text parsing
 * Handles LaTeX content that may be included in the JSON strings
 * Normalizes block math to inline math for consistency
 */
function parseAIResponse<T>(response: string, fallback: T): T {
  try {
    // Try to extract JSON from markdown code blocks
    let jsonString = response;
    const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1];
    }

    // Parse JSON - JSON.parse will correctly handle escaped backslashes
    // LaTeX commands like \\theta in JSON become \theta in the parsed string
    const parsed = JSON.parse(jsonString) as T;

    // Post-process to normalize LaTeX: convert block math to inline math
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => {
        if (typeof item === 'object' && item !== null) {
          const normalized: any = { ...item };
          for (const key in normalized) {
            if (typeof normalized[key] === 'string') {
              normalized[key] = normalizeLatexToInline(normalized[key]);
            }
          }
          return normalized;
        }
        return item;
      }) as T;
    } else if (typeof parsed === 'object' && parsed !== null) {
      const normalized: any = { ...parsed };
      for (const key in normalized) {
        if (typeof normalized[key] === 'string') {
          normalized[key] = normalizeLatexToInline(normalized[key]);
        }
      }
      return normalized as T;
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to parse AI response as JSON, using fallback:', error);
    console.warn('Response was:', response.substring(0, 500));
    return fallback;
  }
}

/**
 * Generate mindmap structure from note content
 */
export async function generateMindmap(noteId: string, noteContent?: string): Promise<MindmapData> {
  const cached = getCachedRecommendation(noteId);
  if (cached?.mindmap) {
    return cached.mindmap;
  }

  // Check if AI is initialized
  if (!tauriAI.isInitialized()) {
    throw new Error('AI system not initialized. Please wait for initialization to complete or check your API keys.');
  }

  // Get content - use provided or fetch from backend
  let content = noteContent;
  if (!content) {
    try {
      content = await tauriAI.getNoteContext(noteId);
    } catch {
      throw new Error('Note content not available. Please provide content directly.');
    }
  }

  if (!content || content.trim().length < 10) {
    throw new Error('Note content is too short to generate a mindmap.');
  }

  const prompt = `Analyze this note content and generate a hierarchical mindmap structure:

NOTE CONTENT:
${content}

Return ONLY a JSON object with this structure:
{
  "center": "Main topic name",
  "nodes": [
    {
      "id": "unique-id-1",
      "label": "Branch name",
      "children": [
        {
          "id": "unique-id-2",
          "label": "Sub-concept",
          "children": []
        }
      ]
    }
  ]
}

Make sure the structure reflects the actual content and relationships in the note.`;

  try {
    const response = await tauriAI.chat([{ role: 'user', content: prompt }]);
    const mindmap = parseAIResponse<MindmapData>(response, {
      center: 'Main Topic',
      nodes: [],
    });

    // Update cache
    const currentData = getCachedRecommendation(noteId) || {};
    currentData.mindmap = mindmap;
    cacheRecommendation(noteId, currentData);

    return mindmap;
  } catch (error) {
    console.error('❌ [RecommendationService] Failed to generate mindmap:', error);
    if (error instanceof Error) {
      throw new Error(`Mindmap generation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Generate flashcards from note content
 */
export async function generateFlashcards(noteId: string, noteContent?: string): Promise<FlashcardData[]> {
  const cached = getCachedRecommendation(noteId);
  if (cached?.flashcards) {
    return cached.flashcards;
  }

  if (!tauriAI.isInitialized()) {
    throw new Error('AI system not initialized.');
  }

  let content = noteContent;
  if (!content) {
    try {
      content = await tauriAI.getNoteContext(noteId);
    } catch {
      throw new Error('Note content not available.');
    }
  }

  const prompt = `Analyze this note and create 8-12 flashcards:

NOTE CONTENT:
${content}

IMPORTANT: Use inline LaTeX math only: $formula$ (not $$...$$)

Return ONLY a JSON array:
[
  {
    "question": "Clear question",
    "answer": "Comprehensive answer"
  }
]`;

  try {
    const response = await tauriAI.chat([{ role: 'user', content: prompt }]);
    const flashcards = parseAIResponse<FlashcardData[]>(response, []);

    const currentData = getCachedRecommendation(noteId) || {};
    currentData.flashcards = flashcards;
    cacheRecommendation(noteId, currentData);

    return flashcards;
  } catch (error) {
    console.error('Failed to generate flashcards:', error);
    throw error;
  }
}

/**
 * Generate advanced concepts from note content
 */
export async function generateConcepts(noteId: string, noteContent?: string): Promise<ConceptData[]> {
  const cached = getCachedRecommendation(noteId);
  if (cached?.concepts) {
    return cached.concepts;
  }

  if (!tauriAI.isInitialized()) {
    throw new Error('AI system not initialized.');
  }

  let content = noteContent;
  if (!content) {
    try {
      content = await tauriAI.getNoteContext(noteId);
    } catch {
      throw new Error('Note content not available.');
    }
  }

  const prompt = `Analyze this note and identify 5-8 advanced related concepts:

NOTE CONTENT:
${content}

Use inline LaTeX math only: $formula$

Return ONLY a JSON array:
[
  {
    "title": "Concept name",
    "description": "2-3 sentence explanation"
  }
]`;

  try {
    const response = await tauriAI.chat([{ role: 'user', content: prompt }]);
    const concepts = parseAIResponse<ConceptData[]>(response, []);

    const currentData = getCachedRecommendation(noteId) || {};
    currentData.concepts = concepts;
    cacheRecommendation(noteId, currentData);

    return concepts;
  } catch (error) {
    console.error('Failed to generate concepts:', error);
    throw error;
  }
}

/**
 * Generate practice exercises from note content
 */
export async function generateExercises(noteId: string, noteContent?: string): Promise<ExerciseData[]> {
  const cached = getCachedRecommendation(noteId);
  if (cached?.exercises) {
    return cached.exercises;
  }

  if (!tauriAI.isInitialized()) {
    throw new Error('AI system not initialized.');
  }

  let content = noteContent;
  if (!content) {
    try {
      content = await tauriAI.getNoteContext(noteId);
    } catch {
      throw new Error('Note content not available.');
    }
  }

  const prompt = `Analyze this note and create 5-8 practice exercises:

NOTE CONTENT:
${content}

Use inline LaTeX math only: $formula$

Return ONLY a JSON array:
[
  {
    "title": "Exercise name",
    "description": "Clear description",
    "difficulty": "beginner" | "intermediate" | "advanced"
  }
]`;

  try {
    const response = await tauriAI.chat([{ role: 'user', content: prompt }]);
    const exercises = parseAIResponse<ExerciseData[]>(response, []);

    const currentData = getCachedRecommendation(noteId) || {};
    currentData.exercises = exercises;
    cacheRecommendation(noteId, currentData);

    return exercises;
  } catch (error) {
    console.error('Failed to generate exercises:', error);
    throw error;
  }
}

/**
 * Generate learning resources from note content
 */
export async function generateResources(noteId: string, noteContent?: string): Promise<ResourceData[]> {
  const cached = getCachedRecommendation(noteId);
  if (cached?.resources) {
    return cached.resources;
  }

  if (!tauriAI.isInitialized()) {
    throw new Error('AI system not initialized.');
  }

  let content = noteContent;
  if (!content) {
    try {
      content = await tauriAI.getNoteContext(noteId);
    } catch {
      throw new Error('Note content not available.');
    }
  }

  const prompt = `Analyze this note and suggest 6-10 high-quality learning resources:

NOTE CONTENT:
${content}

Return ONLY a JSON array:
[
  {
    "type": "Book" | "Course" | "Video" | "Paper" | "Tutorial" | "Article",
    "title": "Resource title",
    "description": "Why this resource is valuable",
    "link": "URL if available (optional)"
  }
]`;

  try {
    const response = await tauriAI.chat([{ role: 'user', content: prompt }]);
    const resources = parseAIResponse<ResourceData[]>(response, []);

    const currentData = getCachedRecommendation(noteId) || {};
    currentData.resources = resources;
    cacheRecommendation(noteId, currentData);

    return resources;
  } catch (error) {
    console.error('Failed to generate resources:', error);
    throw error;
  }
}

/**
 * Generate educational slides from note content using Gemini 3 Pro
 * Creates up to 14 detailed visual slides explaining key concepts
 */
export async function generateSlides(
  noteId: string,
  numSlides: number = 8,
  onProgress?: (progress: { current: number; total: number; message: string }) => void,
  noteContent?: string  // Optional: pass content directly to avoid DB query
): Promise<SlideData[]> {
  const cached = getCachedRecommendation(noteId);
  if (cached?.slides && cached.slides.length > 0) {
    return cached.slides;
  }

  // Check if Gemini service is initialized
  if (!geminiService.isInitialized) {
    throw new Error('Gemini service not initialized. Please configure your Google AI API key.');
  }

  try {
    // Get note content - use provided content or fetch from backend
    let content = noteContent;
    
    if (!content) {
      try {
        content = await tauriAI.getNoteContext(noteId);
      } catch (dbError) {
        console.warn('⚠️ Failed to get note from DB, will need content passed directly:', dbError);
        throw new Error('Note content not available. Please ensure the note is saved to the database.');
      }
    }
    
    if (!content || content.length === 0) {
      throw new Error('No note content found');
    }

    // Generate slides using Gemini service
    const generatedSlides = await geminiService.generateAllSlides(
      content,  // Use the validated content variable
      Math.min(numSlides, 14), // Max 14 slides
      (progress) => {
        onProgress?.({
          current: progress.currentSlide,
          total: progress.totalSlides,
          message: progress.message,
        });
      }
    );

    // Convert to SlideData format
    const slides: SlideData[] = generatedSlides.map((slide) => ({
      slideNumber: slide.slideNumber,
      title: slide.title,
      type: slide.type as SlideData['type'],
      imageData: slide.imageData,
      caption: slide.caption,
    }));

    // Update cache
    const currentData = getCachedRecommendation(noteId) || {};
    currentData.slides = slides;
    cacheRecommendation(noteId, currentData);

    return slides;
  } catch (error) {
    console.error('Failed to generate slides:', error);
    throw error;
  }
}

/**
 * Initialize Gemini service with API key
 * Should be called during app initialization if Google AI API key is available
 */
export function initializeGeminiService(apiKey: string): void {
  geminiService.initialize(apiKey);
}

/**
 * Check if Gemini service is ready for slide generation
 */
export function isGeminiServiceReady(): boolean {
  return geminiService.isInitialized;
}

/**
 * Analyze note and generate all recommendations
 * This is the main entry point for recommendation generation
 */
export async function analyzeNoteForRecommendations(
  noteId: string,
  noteContent?: string
): Promise<RecommendationData> {
  // Check cache first
  const cached = getCachedRecommendation(noteId);
  if (cached) {
    return cached;
  }

  // Generate all recommendations in parallel for better performance
  const [mindmap, flashcards, concepts, exercises, resources] = await Promise.allSettled([
    generateMindmap(noteId, noteContent),
    generateFlashcards(noteId, noteContent),
    generateConcepts(noteId, noteContent),
    generateExercises(noteId, noteContent),
    generateResources(noteId, noteContent),
  ]);

  const data: RecommendationData = {};

  if (mindmap.status === 'fulfilled') {
    data.mindmap = mindmap.value;
  }
  if (flashcards.status === 'fulfilled') {
    data.flashcards = flashcards.value;
  }
  if (concepts.status === 'fulfilled') {
    data.concepts = concepts.value;
  }
  if (exercises.status === 'fulfilled') {
    data.exercises = exercises.value;
  }
  if (resources.status === 'fulfilled') {
    data.resources = resources.value;
  }

  // Cache the complete result
  cacheRecommendation(noteId, data);

  return data;
}

/**
 * Generate a specific recommendation type on demand
 */
export async function generateRecommendation(
  noteId: string,
  type: RecommendationType
): Promise<RecommendationData> {
  switch (type) {
    case 'mindmap':
      await generateMindmap(noteId);
      break;
    case 'flashcards':
      await generateFlashcards(noteId);
      break;
    case 'concepts':
      await generateConcepts(noteId);
      break;
    case 'exercises':
      await generateExercises(noteId);
      break;
    case 'resources':
      await generateResources(noteId);
      break;
    case 'slides':
      await generateSlides(noteId);
      break;
  }

  return getCachedRecommendation(noteId) || {};
}

/**
 * Clear cache for a specific note
 */
export function clearRecommendationCache(noteId: string): void {
  recommendationCache.delete(noteId);
}

/**
 * Clear all recommendation cache
 */
export function clearAllRecommendationCache(): void {
  recommendationCache.clear();
}

