/**
 * Course Generator Service
 * 
 * Public API for AI-powered course generation using Web Worker isolation.
 * 
 * NOTE: All LangGraph, LlamaIndex, and heavy AI dependencies run in a
 * Web Worker for complete ESM isolation and non-blocking execution.
 * 
 * Usage:
 * ```typescript
 * import { startCourseGeneration, approveOutlineAndContinue } from '@/services/courseGenerator';
 * 
 * // 1. Start generation
 * const result = await startCourseGeneration('Machine Learning', 'session-123', {
 *     difficulty: 'intermediate',
 *     settings: { includeVideos: true, includeSlides: true }
 * });
 * 
 * // 2. result.status === 'awaiting_approval'
 * //    Show result.outline to user for drag-drop editing
 * 
 * // 3. After user approves
 * const finalResult = await approveOutlineAndContinue('session-123', modifiedOutline);
 * 
 * // 4. finalResult.course contains the complete Course object
 * ```
 */

// Main API exports from worker service
export {
    startCourseGeneration,
    approveOutlineAndContinue,
    rejectOutlineAndRegenerate,
    getGenerationStatus,
    cancelGeneration,
    courseGeneratorService,
} from './courseService';

// Type exports
export type {
    CourseGeneratorResponse,
    CourseOutline,
    ModuleOutline,
    LessonOutline,
    CourseDifficulty,
    YouTubeVideo,
    LessonVideoMatch,
} from './workerMessages';

// YouTube search service (direct, not via worker)
export {
    initializeYouTubeSearch,
    isYouTubeSearchAvailable,
    searchVideosForLesson,
    scoreVideoRelevance,
    getEmbedUrl,
    getThumbnailUrl,
} from './youtubeSearch';
