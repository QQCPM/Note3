/**
 * Course Types - AI Learning App
 * 
 * Types for AI-generated courses with modules, lessons, and learning content.
 */

// ============================================================================
// GENERATION STAGES
// ============================================================================

export type GenerationStageType = 'analysis' | 'planning' | 'content' | 'multimedia' | 'review';
export type GenerationStageStatus = 'pending' | 'active' | 'complete' | 'error';

export interface GenerationStage {
  id: GenerationStageType;
  title: string;
  description: string;
  status: GenerationStageStatus;
  progress: number; // 0-100
  thinkingOutput?: string; // AI reasoning output
}

// ============================================================================
// LESSON TYPES
// ============================================================================

export type LessonType = 'lecture' | 'video' | 'slides' | 'practice' | 'quiz';
export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface LessonContent {
  markdown?: string;           // For lecture type
  videoUrl?: string;           // For video type
  slides?: SlideItem[];        // For slides type
  practiceProblems?: PracticeProblem[];  // For practice/quiz type
}

export interface SlideItem {
  id: string;
  title: string;
  content: string;
  imageData?: string;
}

export interface PracticeProblem {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  type: LessonType;
  duration?: string;          // "15 min" or similar
  questionCount?: number;     // For practice/quiz
  order: number;
  status: LessonStatus;
  content: LessonContent;
  completedAt?: string;
}

// ============================================================================
// MODULE TYPES
// ============================================================================

export type ModuleStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  status: ModuleStatus;
  lessons: Lesson[];
  progress: number; // 0-100
}

// ============================================================================
// COURSE TYPES
// ============================================================================

export type CourseStatus = 'draft' | 'generating' | 'ready' | 'in_progress' | 'completed';
export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface CourseSettings {
  includeVideos: boolean;
  includeSlides: boolean;
  includePractice: boolean;
  includeQuizzes: boolean;
  estimatedWeeks: number;
  hoursPerWeek: number;
}

export interface Course {
  id: string;
  title: string;
  topic: string;
  description: string;
  difficulty: CourseDifficulty;
  estimatedHours: number;
  thumbnailUrl?: string;

  // Structure
  modules: CourseModule[];
  prerequisites: string[];
  learningObjectives: string[];

  // Generation metadata
  generatedAt?: string;
  generationStages?: GenerationStage[];
  thinkingTrace?: string;

  // Progress
  status: CourseStatus;
  progress: number;          // 0-100
  currentModuleId?: string;
  currentLessonId?: string;

  // Settings
  settings: CourseSettings;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ============================================================================
// COURSE NOTES
// ============================================================================

export interface CourseNote {
  id: string;
  courseId: string;
  lessonId?: string;
  content: string;
  type: 'user' | 'saved_lesson' | 'highlight';
  timestamp: string;
}

// ============================================================================
// COURSE GENERATION INPUT
// ============================================================================

export interface CourseGenerationInput {
  topic: string;
  difficulty?: CourseDifficulty;
  estimatedWeeks?: number;
  focusAreas?: string[];
  includeVideos?: boolean;
  includeSlides?: boolean;
  includePractice?: boolean;
}

// ============================================================================
// VIEW STATE
// ============================================================================

export type CourseViewMode = 'library' | 'home' | 'generating' | 'outline_approval' | 'learning';

// ============================================================================
// DEFAULT GENERATION STAGES
// ============================================================================

export const DEFAULT_GENERATION_STAGES: GenerationStage[] = [
  {
    id: 'analysis',
    title: 'Deep Analysis',
    description: 'Understanding topic structure, prerequisites, learning objectives...',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'planning',
    title: 'Curriculum Planning',
    description: 'Designing optimal learning path, sequencing concepts...',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'content',
    title: 'Content Generation',
    description: 'Creating lectures, examples, practice problems...',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'multimedia',
    title: 'Multimedia Creation',
    description: 'Generating slides, video scripts, interactive elements...',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'review',
    title: 'Quality Review',
    description: 'Verifying accuracy, coherence, pedagogical effectiveness...',
    status: 'pending',
    progress: 0,
  },
];
