/**
 * Course Generator Types
 * 
 * Pure type definitions for the course generator.
 * These types are separate from the LangGraph state annotations
 * to prevent LangGraph from loading when only types are needed.
 */

import type {
    Course,
    CourseModule,
    CourseDifficulty,
    GenerationStageType,
    CourseSettings,
} from "@/types/course";

// NOTE: We use unknown[] for messages to avoid importing @langchain/core/messages
// which would trigger LangChain to load at app startup

// ============================================================================
// COURSE OUTLINE TYPES (Before full generation)
// ============================================================================

/**
 * Outline for a single lesson (lightweight, before content generation)
 */
export interface LessonOutline {
    id: string;
    title: string;
    type: 'lecture' | 'video' | 'slides' | 'practice' | 'quiz';
    estimatedMinutes: number;
    keyTopics: string[];
    learningObjectives: string[];
    order: number;
}

/**
 * Outline for a module (lightweight, before content generation)
 */
export interface ModuleOutline {
    id: string;
    title: string;
    description: string;
    order: number;
    lessons: LessonOutline[];
}

/**
 * Complete course outline (what user approves before content generation)
 */
export interface CourseOutline {
    title: string;
    topic: string;
    description: string;
    difficulty: CourseDifficulty;
    estimatedHours: number;
    prerequisites: string[];
    learningObjectives: string[];
    learningOutcomes: string[];
    modules: ModuleOutline[];
}

// ============================================================================
// YOUTUBE VIDEO TYPES
// ============================================================================

export interface YouTubeVideo {
    videoId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    channelTitle: string;
    duration: string;
    viewCount: number;
    relevanceScore: number;  // 0-100, AI-computed match score
}

export interface LessonVideoMatch {
    lessonId: string;
    videos: YouTubeVideo[];
    selectedVideoId: string | null;  // User can select which video to use
}

// ============================================================================
// INPUT/OUTPUT TYPES
// ============================================================================

export interface CourseGeneratorInput {
    topic: string;
    difficulty?: CourseDifficulty;
    settings?: Partial<CourseSettings>;
    focusAreas?: string[];
}

export interface CourseGeneratorOutput {
    course: Course;
    outline: CourseOutline;
    generationTimeMs: number;
}

export interface CourseGeneratorResponse {
    status: 'awaiting_approval' | 'complete' | 'error' | 'generating';
    outline?: CourseOutline;
    course?: Course;
    error?: string;
    thinkingOutput?: string;
}

// ============================================================================
// STATE TYPE (for type annotations only - not the runtime Annotation)
// ============================================================================

export interface CourseGeneratorStateType {
    messages: unknown[];  // BaseMessage[] at runtime, but we use unknown to avoid LangChain import
    topic: string;
    difficulty: CourseDifficulty;
    settings: CourseSettings;
    focusAreas: string[];
    pendingOutline: CourseOutline | null;
    approvedOutline: CourseOutline | null;
    awaitingApproval: boolean;
    outlineFeedback: string | null;
    researchReport: string | null;
    generatedCourseId: string;
    generatedModules: CourseModule[];
    currentStage: GenerationStageType;
    stageProgress: number;
    processingLogs: string[];
    thinkingOutput: string;
    retryCount: number;
    modulesNeedingRevision: string[];
    revisionFeedback: Map<string, string>;
    lessonVideos: LessonVideoMatch[];
    lessonSlides: Map<string, string>;
    finalCourse: Course | null;
    error: string | null;
}
