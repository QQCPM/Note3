import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Course,
  CourseModule,
  Lesson,
  CourseNote,
  CourseViewMode,
  GenerationStage,
  CourseGenerationInput,
} from '@/types/course';
import type { CourseOutline } from '@/services/courseGenerator/courseTypes';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface CourseStore {
  // Current state
  viewMode: CourseViewMode;
  courses: Course[];
  activeCourseId: string | null;
  activeModuleId: string | null;
  activeLessonId: string | null;

  // Generation state
  isGenerating: boolean;
  generationTopic: string;
  generationStages: GenerationStage[];
  currentStageIndex: number;

  // Notes state
  courseNotes: CourseNote[];
  userNotesInput: string;

  // UI state
  showNotesSidebar: boolean;
  showAITutor: boolean;
  aiTutorPosition: { x: number; y: number };
  expandedModules: string[];

  // Outline approval state (for drag-drop editor)
  pendingOutline: CourseOutline | null;
  generationSessionId: string | null;
  outlineThinkingOutput: string;

  // View actions
  setViewMode: (mode: CourseViewMode) => void;

  // Course actions
  addCourse: (course: Course) => void;
  updateCourse: (courseId: string, updates: Partial<Course>) => void;
  deleteCourse: (courseId: string) => void;
  setActiveCourse: (courseId: string | null) => void;

  // Navigation actions
  setActiveModule: (moduleId: string | null) => void;
  setActiveLesson: (lessonId: string | null) => void;
  navigateToLesson: (moduleId: string, lessonId: string) => void;

  // Generation actions
  startGeneration: (input: CourseGenerationInput) => void;
  updateGenerationStage: (stageIndex: number, updates: Partial<GenerationStage>) => void;
  advanceGenerationStage: () => void;
  completeGeneration: (course: Course) => void;
  cancelGeneration: () => void;

  // Notes actions
  addNote: (note: Omit<CourseNote, 'id' | 'timestamp'>) => void;
  updateNote: (noteId: string, content: string) => void;
  deleteNote: (noteId: string) => void;
  setUserNotesInput: (content: string) => void;
  saveCurrentNote: () => void;

  // UI actions
  toggleNotesSidebar: () => void;
  toggleAITutor: () => void;
  setAITutorPosition: (position: { x: number; y: number }) => void;
  toggleModuleExpanded: (moduleId: string) => void;

  // Lesson progress
  markLessonComplete: (lessonId: string) => void;
  markLessonInProgress: (lessonId: string) => void;

  // Getters
  getActiveCourse: () => Course | null;
  getActiveModule: () => CourseModule | null;
  getActiveLesson: () => Lesson | null;
  getCourseNotes: (courseId: string) => CourseNote[];

  // Outline approval actions
  setPendingOutline: (outline: CourseOutline | null, sessionId?: string, thinkingOutput?: string) => void;
  updatePendingOutline: (outline: CourseOutline) => void;
  setOutlineThinkingOutput: (output: string) => void;
  clearOutlineApproval: () => void;
}

// ============================================================================
// DEFAULT STAGES
// ============================================================================

const createDefaultStages = (): GenerationStage[] => [
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

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useCourseStore = create<CourseStore>()(
  persist(
    (set, get) => ({
      // Initial state
      viewMode: 'library',
      courses: [],
      activeCourseId: null,
      activeModuleId: null,
      activeLessonId: null,

      isGenerating: false,
      generationTopic: '',
      generationStages: createDefaultStages(),
      currentStageIndex: -1,

      courseNotes: [],
      userNotesInput: '',

      showNotesSidebar: true,
      showAITutor: false,
      aiTutorPosition: { x: typeof window !== 'undefined' ? window.innerWidth - 420 : 800, y: 100 },
      expandedModules: [],

      // Outline approval state
      pendingOutline: null,
      generationSessionId: null,
      outlineThinkingOutput: '',

      // ========================================================================
      // VIEW ACTIONS
      // ========================================================================

      setViewMode: (mode) => set({ viewMode: mode }),

      // ========================================================================
      // COURSE ACTIONS
      // ========================================================================

      addCourse: (course) => set((state) => ({
        courses: [...state.courses, course],
      })),

      updateCourse: (courseId, updates) => set((state) => ({
        courses: state.courses.map((c) =>
          c.id === courseId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        ),
      })),

      deleteCourse: (courseId) => set((state) => ({
        courses: state.courses.filter((c) => c.id !== courseId),
        activeCourseId: state.activeCourseId === courseId ? null : state.activeCourseId,
      })),

      setActiveCourse: (courseId) => set((state) => {
        const course = state.courses.find((c) => c.id === courseId);
        return {
          activeCourseId: courseId,
          activeModuleId: course?.modules[0]?.id || null,
          activeLessonId: course?.modules[0]?.lessons[0]?.id || null,
          expandedModules: course?.modules[0]?.id ? [course.modules[0].id] : [],
        };
      }),

      // ========================================================================
      // NAVIGATION ACTIONS
      // ========================================================================

      setActiveModule: (moduleId) => set({ activeModuleId: moduleId }),

      setActiveLesson: (lessonId) => set({ activeLessonId: lessonId }),

      navigateToLesson: (moduleId, lessonId) => set((state) => ({
        activeModuleId: moduleId,
        activeLessonId: lessonId,
        expandedModules: state.expandedModules.includes(moduleId)
          ? state.expandedModules
          : [...state.expandedModules, moduleId],
      })),

      // ========================================================================
      // GENERATION ACTIONS
      // ========================================================================

      startGeneration: (input) => set({
        isGenerating: true,
        generationTopic: input.topic,
        generationStages: createDefaultStages(),
        currentStageIndex: 0,
        viewMode: 'generating',
      }),

      updateGenerationStage: (stageIndex, updates) => set((state) => ({
        generationStages: state.generationStages.map((stage, idx) =>
          idx === stageIndex ? { ...stage, ...updates } : stage
        ),
      })),

      advanceGenerationStage: () => set((state) => {
        const nextIndex = state.currentStageIndex + 1;
        const stages = state.generationStages.map((stage, idx) => {
          if (idx < nextIndex) return { ...stage, status: 'complete' as const, progress: 100 };
          if (idx === nextIndex) return { ...stage, status: 'active' as const, progress: 0 };
          return stage;
        });

        return {
          currentStageIndex: nextIndex,
          generationStages: stages,
        };
      }),

      completeGeneration: (course) => set((state) => ({
        isGenerating: false,
        courses: [...state.courses, course],
        activeCourseId: course.id,
        activeModuleId: course.modules[0]?.id || null,
        activeLessonId: course.modules[0]?.lessons[0]?.id || null,
        expandedModules: course.modules[0]?.id ? [course.modules[0].id] : [],
        viewMode: 'learning',
        generationStages: state.generationStages.map((s) => ({ ...s, status: 'complete' as const, progress: 100 })),
      })),

      cancelGeneration: () => set({
        isGenerating: false,
        generationTopic: '',
        generationStages: createDefaultStages(),
        currentStageIndex: -1,
        viewMode: 'home',
      }),

      // ========================================================================
      // NOTES ACTIONS
      // ========================================================================

      addNote: (note) => set((state) => ({
        courseNotes: [
          ...state.courseNotes,
          {
            ...note,
            id: generateId(),
            timestamp: new Date().toISOString(),
          },
        ],
      })),

      updateNote: (noteId, content) => set((state) => ({
        courseNotes: state.courseNotes.map((n) =>
          n.id === noteId ? { ...n, content } : n
        ),
      })),

      deleteNote: (noteId) => set((state) => ({
        courseNotes: state.courseNotes.filter((n) => n.id !== noteId),
      })),

      setUserNotesInput: (content) => set({ userNotesInput: content }),

      saveCurrentNote: () => {
        const state = get();
        if (!state.userNotesInput.trim() || !state.activeCourseId) return;

        set((state) => ({
          courseNotes: [
            ...state.courseNotes,
            {
              id: generateId(),
              courseId: state.activeCourseId!,
              lessonId: state.activeLessonId || undefined,
              content: state.userNotesInput,
              type: 'user',
              timestamp: new Date().toISOString(),
            },
          ],
          userNotesInput: '',
        }));
      },

      // ========================================================================
      // UI ACTIONS
      // ========================================================================

      toggleNotesSidebar: () => set((state) => ({ showNotesSidebar: !state.showNotesSidebar })),

      toggleAITutor: () => set((state) => ({ showAITutor: !state.showAITutor })),

      setAITutorPosition: (position) => set({ aiTutorPosition: position }),

      toggleModuleExpanded: (moduleId) => set((state) => ({
        expandedModules: state.expandedModules.includes(moduleId)
          ? state.expandedModules.filter((id) => id !== moduleId)
          : [...state.expandedModules, moduleId],
      })),

      // ========================================================================
      // LESSON PROGRESS
      // ========================================================================

      markLessonComplete: (lessonId) => set((state) => {
        const course = state.courses.find((c) => c.id === state.activeCourseId);
        if (!course) return state;

        const updatedModules = course.modules.map((module) => ({
          ...module,
          lessons: module.lessons.map((lesson) =>
            lesson.id === lessonId
              ? { ...lesson, status: 'completed' as const, completedAt: new Date().toISOString() }
              : lesson
          ),
        }));

        // Calculate new progress
        const totalLessons = updatedModules.reduce((acc, m) => acc + m.lessons.length, 0);
        const completedLessons = updatedModules.reduce(
          (acc, m) => acc + m.lessons.filter((l) => l.status === 'completed').length,
          0
        );
        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        return {
          courses: state.courses.map((c) =>
            c.id === state.activeCourseId
              ? { ...c, modules: updatedModules, progress, updatedAt: new Date().toISOString() }
              : c
          ),
        };
      }),

      markLessonInProgress: (lessonId) => set((state) => {
        const course = state.courses.find((c) => c.id === state.activeCourseId);
        if (!course) return state;

        const updatedModules = course.modules.map((module) => ({
          ...module,
          lessons: module.lessons.map((lesson) =>
            lesson.id === lessonId
              ? { ...lesson, status: 'in_progress' as const }
              : lesson
          ),
        }));

        return {
          courses: state.courses.map((c) =>
            c.id === state.activeCourseId
              ? { ...c, modules: updatedModules, updatedAt: new Date().toISOString() }
              : c
          ),
        };
      }),

      // ========================================================================
      // GETTERS
      // ========================================================================

      getActiveCourse: () => {
        const state = get();
        return state.courses.find((c) => c.id === state.activeCourseId) || null;
      },

      getActiveModule: () => {
        const state = get();
        const course = state.courses.find((c) => c.id === state.activeCourseId);
        return course?.modules.find((m) => m.id === state.activeModuleId) || null;
      },

      getActiveLesson: () => {
        const state = get();
        const course = state.courses.find((c) => c.id === state.activeCourseId);
        if (!course) return null;

        for (const module of course.modules) {
          const lesson = module.lessons.find((l) => l.id === state.activeLessonId);
          if (lesson) return lesson;
        }
        return null;
      },

      getCourseNotes: (courseId) => {
        const state = get();
        return state.courseNotes.filter((n) => n.courseId === courseId);
      },

      // ========================================================================
      // OUTLINE APPROVAL ACTIONS
      // ========================================================================

      setPendingOutline: (outline, sessionId, thinkingOutput) => set({
        pendingOutline: outline,
        generationSessionId: sessionId ?? null,
        outlineThinkingOutput: thinkingOutput ?? '',
      }),

      updatePendingOutline: (outline) => set({ pendingOutline: outline }),

      setOutlineThinkingOutput: (output) => set({ outlineThinkingOutput: output }),

      clearOutlineApproval: () => set({
        pendingOutline: null,
        generationSessionId: null,
        outlineThinkingOutput: '',
      }),
    }),
    {
      name: 'note3-course-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        courses: state.courses,
        courseNotes: state.courseNotes,
        activeCourseId: state.activeCourseId,
        showNotesSidebar: state.showNotesSidebar,
      }),
    }
  )
);

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

export const useActiveCourse = () => useCourseStore((state) => state.getActiveCourse());
export const useActiveLesson = () => useCourseStore((state) => state.getActiveLesson());
export const useCourseViewMode = () => useCourseStore((state) => state.viewMode);
export const useIsGenerating = () => useCourseStore((state) => state.isGenerating);
