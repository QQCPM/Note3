import { tauriAI } from './tauriAI';
import type {
  RecommendationData,
  MindmapData,
  FlashcardData,
  ConceptData,
  ExerciseData,
  ResourceData,
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
  normalized = normalized.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
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
export async function generateMindmap(noteId: string): Promise<MindmapData> {
  const cached = getCachedRecommendation(noteId);
  if (cached?.mindmap) {
    return cached.mindmap;
  }

  const prompt = `Analyze the note content and generate a hierarchical mindmap structure. 
The mindmap should show the main topic as the center node, with major branches for key themes, 
and sub-branches for important concepts.

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
    const response = await tauriAI.chatWithNoteContext(noteId, prompt);
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
    console.error('Failed to generate mindmap:', error);
    throw error;
  }
}

/**
 * Generate flashcards from note content
 */
export async function generateFlashcards(noteId: string): Promise<FlashcardData[]> {
  const cached = getCachedRecommendation(noteId);
  if (cached?.flashcards) {
    return cached.flashcards;
  }

  const prompt = `Analyze the note content and create 8-12 flashcards with questions and answers.
Focus on key concepts, definitions, important facts, and relationships.

IMPORTANT: If the note contains mathematical formulas or equations, use LaTeX syntax:
- ONLY use inline math format: $formula$ (e.g., $x_i$ or $\\theta$ or $\\hat\\theta = \\arg\\max_\\theta p(D|\\theta)$)
- DO NOT use block math format ($$...$$) - always use inline math ($...$)
- For longer equations, break them into multiple inline math expressions or use text descriptions
- Use proper LaTeX escaping: \\ for backslashes, \\{ for braces, etc.

Return ONLY a JSON array with this structure:
[
  {
    "question": "Clear, specific question",
    "answer": "Comprehensive answer explaining the concept (may include LaTeX for math)"
  }
]

Make questions test understanding of important concepts from the note.`;

  try {
    const response = await tauriAI.chatWithNoteContext(noteId, prompt);
    const flashcards = parseAIResponse<FlashcardData[]>(response, []);

    // Update cache
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
export async function generateConcepts(noteId: string): Promise<ConceptData[]> {
  const cached = getCachedRecommendation(noteId);
  if (cached?.concepts) {
    return cached.concepts;
  }

  const prompt = `Analyze the note content and identify 5-8 advanced concepts or related topics 
that build upon or extend the current material. These should be topics the user might want to explore next.

IMPORTANT: If the note contains mathematical formulas or equations, use LaTeX syntax:
- ONLY use inline math format: $formula$ (e.g., $x_i$ or $\\theta$ or $\\hat\\theta = \\arg\\max_\\theta p(D|\\theta)$)
- DO NOT use block math format ($$...$$) - always use inline math ($...$)
- For longer equations, break them into multiple inline math expressions or use text descriptions
- Use proper LaTeX escaping: \\ for backslashes, \\{ for braces, etc.

Return ONLY a JSON array with this structure:
[
  {
    "title": "Concept name",
    "description": "2-3 sentence explanation of the concept and why it's relevant (may include LaTeX for math)"
  }
]

Focus on concepts that are naturally connected to the note content.`;

  try {
    const response = await tauriAI.chatWithNoteContext(noteId, prompt);
    const concepts = parseAIResponse<ConceptData[]>(response, []);

    // Update cache
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
export async function generateExercises(noteId: string): Promise<ExerciseData[]> {
  const cached = getCachedRecommendation(noteId);
  if (cached?.exercises) {
    return cached.exercises;
  }

  const prompt = `Analyze the note content and create 5-8 practice exercises or problems 
that help reinforce the key concepts. These should be hands-on, practical exercises.

IMPORTANT: If the note contains mathematical formulas or equations, use LaTeX syntax:
- ONLY use inline math format: $formula$ (e.g., $x_i$ or $\\theta$ or $\\hat\\theta = \\arg\\max_\\theta p(D|\\theta)$)
- DO NOT use block math format ($$...$$) - always use inline math ($...$)
- For longer equations, break them into multiple inline math expressions or use text descriptions
- Use proper LaTeX escaping: \\ for backslashes, \\{ for braces, etc.

Return ONLY a JSON array with this structure:
[
  {
    "title": "Exercise name",
    "description": "Clear description of what to do and what concepts it covers (may include LaTeX for math)",
    "difficulty": "beginner" | "intermediate" | "advanced"
  }
]

Make exercises relevant to the actual content of the note.`;

  try {
    const response = await tauriAI.chatWithNoteContext(noteId, prompt);
    const exercises = parseAIResponse<ExerciseData[]>(response, []);

    // Update cache
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
export async function generateResources(noteId: string): Promise<ResourceData[]> {
  const cached = getCachedRecommendation(noteId);
  if (cached?.resources) {
    return cached.resources;
  }

  const prompt = `Analyze the note content and suggest 6-10 high-quality learning resources 
(books, courses, videos, papers, tutorials, etc.) that would help deepen understanding of the topic.

Return ONLY a JSON array with this structure:
[
  {
    "type": "Book" | "Course" | "Video" | "Paper" | "Tutorial" | "Interactive" | "Article" | "Website",
    "title": "Resource title",
    "description": "Why this resource is valuable and what it covers",
    "link": "URL if available (optional)"
  }
]

Suggest real, well-known resources when possible.`;

  try {
    const response = await tauriAI.chatWithNoteContext(noteId, prompt);
    const resources = parseAIResponse<ResourceData[]>(response, []);

    // Update cache
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
 * Analyze note and generate all recommendations
 * This is the main entry point for recommendation generation
 */
export async function analyzeNoteForRecommendations(
  noteId: string
): Promise<RecommendationData> {
  // Check cache first
  const cached = getCachedRecommendation(noteId);
  if (cached) {
    return cached;
  }

  // Generate all recommendations in parallel for better performance
  const [mindmap, flashcards, concepts, exercises, resources] = await Promise.allSettled([
    generateMindmap(noteId),
    generateFlashcards(noteId),
    generateConcepts(noteId),
    generateExercises(noteId),
    generateResources(noteId),
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

