/**
 * Worker Message Types
 * 
 * Type definitions for communication between main thread and course generator worker.
 */

import type { Course, CourseSettings, GenerationStageType } from '@/types/course';

// ============================================================================
// SHARED TYPES
// ============================================================================

/**
 * Course difficulty levels
 */
export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * YouTube video match for a lesson
 */
export interface YouTubeVideo {
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
    description: string;
    duration: string;
    viewCount: number;
    relevanceScore: number;
}

export interface LessonVideoMatch {
    lessonId: string;
    videos: YouTubeVideo[];
    selectedVideoId: string | null;
}

/**
 * Lesson outline (before content generation)
 */
export interface LessonOutline {
    id: string;
    title: string;
    type: 'lecture' | 'video' | 'practice' | 'quiz' | 'slides';
    estimatedMinutes: number;
    keyTopics: string[];
    learningObjectives: string[];
    order: number;
}

/**
 * Module outline
 */
export interface ModuleOutline {
    id: string;
    title: string;
    description: string;
    lessons: LessonOutline[];
    order: number;
}

/**
 * Course outline (human-in-the-loop approval point)
 */
export interface CourseOutline {
    title: string;
    topic: string;
    description: string;
    difficulty: CourseDifficulty;
    estimatedHours: number;
    modules: ModuleOutline[];
    learningObjectives: string[];
    learningOutcomes: string[];
    prerequisites: string[];
}

/**
 * Generation status
 */
export type GenerationStatus =
    | 'idle'
    | 'running'
    | 'awaiting_approval'
    | 'complete'
    | 'error'
    | 'cancelled';

// ============================================================================
// MAIN THREAD → WORKER MESSAGES
// ============================================================================

/**
 * Start course generation
 */
export interface StartGenerationMessage {
    type: 'START_GENERATION';
    id: string;
    payload: {
        topic: string;
        threadId: string;
        difficulty: CourseDifficulty;
        settings: Partial<CourseSettings>;
        focusAreas: string[];
        geminiApiKey: string;
        youtubeApiKey?: string;
    };
}

/**
 * Approve outline and continue generation
 */
export interface ApproveOutlineMessage {
    type: 'APPROVE_OUTLINE';
    id: string;
    payload: {
        threadId: string;
        modifiedOutline: CourseOutline;
    };
}

/**
 * Reject outline with feedback
 */
export interface RejectOutlineMessage {
    type: 'REJECT_OUTLINE';
    id: string;
    payload: {
        threadId: string;
        feedback: string;
    };
}

/**
 * Cancel generation
 */
export interface CancelMessage {
    type: 'CANCEL';
    id: string;
    payload: {
        threadId: string;
    };
}

/**
 * Get generation status
 */
export interface GetStatusMessage {
    type: 'GET_STATUS';
    id: string;
    payload: {
        threadId: string;
    };
}

/**
 * Deep research result from Tauri (Main → Worker)
 */
export interface DeepResearchResultMessage {
    type: 'DEEP_RESEARCH_RESULT';
    threadId: string;
    payload: {
        success: boolean;
        summary?: string;
        sources?: Array<{ url: string; title: string }>;
        error?: string;
    };
}

/**
 * All messages from main thread to worker
 */
export type MainToWorkerMessage =
    | StartGenerationMessage
    | ApproveOutlineMessage
    | RejectOutlineMessage
    | CancelMessage
    | GetStatusMessage
    | DeepResearchResultMessage;

// ============================================================================
// WORKER → MAIN THREAD MESSAGES
// ============================================================================

/**
 * Progress update (streaming, no response ID)
 */
export interface ProgressMessage {
    type: 'PROGRESS';
    threadId: string;
    payload: {
        stage: GenerationStageType;
        stageProgress: number;
        thinkingOutput: string;
        currentNode: string;
    };
}

/**
 * Research source discovered during deep research
 */
export interface ResearchSource {
    url: string;
    title: string;
    status: 'queued' | 'reading' | 'done' | 'failed';
}

/**
 * Deep research progress update (detailed streaming)
 */
export interface ResearchProgressMessage {
    type: 'RESEARCH_PROGRESS';
    threadId: string;
    payload: {
        status: 'starting' | 'researching' | 'writing' | 'complete' | 'failed';
        progress: number;  // 0-100
        thinking: string;  // Current thinking/reasoning
        sources: ResearchSource[];  // URLs being researched
        notes: Record<string, string>;  // Key findings
        partialReport: string | null;  // Report as it's being written
    };
}

/**
 * Outline ready for human approval
 */
export interface OutlineReadyMessage {
    type: 'OUTLINE_READY';
    threadId: string;
    payload: {
        outline: CourseOutline;
        thinkingOutput: string;
    };
}

/**
 * Generation complete
 */
export interface CompleteMessage {
    type: 'COMPLETE';
    id: string;
    threadId: string;
    payload: {
        course: Course;
        thinkingOutput: string;
    };
}

/**
 * Error occurred
 */
export interface ErrorMessage {
    type: 'ERROR';
    id: string;
    threadId: string;
    payload: {
        error: string;
        stage: GenerationStageType;
    };
}

/**
 * Status response
 */
export interface StatusMessage {
    type: 'STATUS';
    id: string;
    threadId: string;
    payload: {
        status: GenerationStatus;
        stage: GenerationStageType;
        progress: number;
    };
}

/**
 * Cancelled confirmation
 */
export interface CancelledMessage {
    type: 'CANCELLED';
    id: string;
    threadId: string;
}

/**
 * Request deep research via Tauri (Worker → Main)
 */
export interface RequestDeepResearchMessage {
    type: 'REQUEST_DEEP_RESEARCH';
    threadId: string;
    payload: {
        topic: string;
        focusAreas: string[];
    };
}

/**
 * All messages from worker to main thread
 */
export type WorkerToMainMessage =
    | ProgressMessage
    | ResearchProgressMessage
    | OutlineReadyMessage
    | CompleteMessage
    | ErrorMessage
    | StatusMessage
    | CancelledMessage
    | RequestDeepResearchMessage;

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Response for course generation API
 */
export interface CourseGeneratorResponse {
    status: GenerationStatus;
    outline: CourseOutline | null;
    course: Course | null;
    stage: GenerationStageType;
    progress: number;
    thinkingOutput: string;
    error?: string;
}
