import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  DailyPlan,
  DailyReflection,
  ScheduledTask,
  AIInsight,
  DashboardRecommendation,
  getCurrentDate,
  getTomorrowDate,
} from '@/types/dashboard';

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface DashboardStore {
  // State
  todayPlan: DailyPlan | null;
  tomorrowPlan: DailyPlan | null;
  todayReflection: DailyReflection | null;
  currentInsight: AIInsight | null;
  recommendations: DashboardRecommendation[];

  // Statistics
  streak: number;
  totalHoursLearned: number;
  totalDaysActive: number;
  weeklyProgress: number; // 0-100

  // UI State
  showTomorrowPlan: boolean;
  showReflection: boolean;
  isGeneratingPlan: boolean;
  isProcessingReflection: boolean;
  isEditingTomorrow: boolean;

  // Roadmap context
  activeRoadmapId: string | null;
  roadmapDay: number;
  roadmapTotalDays: number;
  roadmapProgress: number; // 0-100

  // Actions - Plans
  setTodayPlan: (plan: DailyPlan | null) => void;
  setTomorrowPlan: (plan: DailyPlan | null) => void;
  updateTaskStatus: (taskId: string, status: ScheduledTask['status'], isToday?: boolean) => void;
  approveTomorrowPlan: () => void;
  editTomorrowTask: (taskId: string, updates: Partial<ScheduledTask>) => void;

  // Actions - Reflection
  setTodayReflection: (reflection: DailyReflection | null) => void;
  submitReflection: (content: string, mood?: DailyReflection['mood']) => void;

  // Actions - AI
  setCurrentInsight: (insight: AIInsight | null) => void;
  dismissInsight: () => void;

  // Actions - Recommendations
  setRecommendations: (recommendations: DashboardRecommendation[]) => void;

  // Actions - UI
  setShowTomorrowPlan: (show: boolean) => void;
  setShowReflection: (show: boolean) => void;
  setIsGeneratingPlan: (loading: boolean) => void;
  setIsProcessingReflection: (loading: boolean) => void;
  setIsEditingTomorrow: (editing: boolean) => void;

  // Actions - Tomorrow Edit
  addTomorrowTask: (task: Omit<ScheduledTask, 'id'>) => void;
  removeTomorrowTask: (taskId: string) => void;
  reorderTomorrowTasks: (taskIds: string[]) => void;

  // Actions - Roadmap
  setActiveRoadmap: (roadmapId: string | null, day?: number) => void;

  // Helpers
  getCurrentTaskIndex: () => number;
  getCompletedTasksCount: () => number;
  getTotalMinutesRemaining: () => number;

  // Time-aware updates
  checkTimeBasedVisibility: () => void;
  transitionToNewDay: () => void;

  // Initialize with sample data (for demo)
  initializeSampleData: () => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      // Initial State
      todayPlan: null,
      tomorrowPlan: null,
      todayReflection: null,
      currentInsight: null,
      recommendations: [],

      // Statistics
      streak: 0,
      totalHoursLearned: 0,
      totalDaysActive: 0,
      weeklyProgress: 0,

      // UI State
      showTomorrowPlan: false,
      showReflection: false,
      isGeneratingPlan: false,
      isProcessingReflection: false,
      isEditingTomorrow: false,

      // Roadmap
      activeRoadmapId: null,
      roadmapDay: 1,
      roadmapTotalDays: 120,
      roadmapProgress: 0,

      // ========================================================================
      // PLAN ACTIONS
      // ========================================================================

      setTodayPlan: (plan) => set({ todayPlan: plan }),

      setTomorrowPlan: (plan) => set({ tomorrowPlan: plan }),

      updateTaskStatus: (taskId, status, isToday = true) => {
        set((state) => {
          const planKey = isToday ? 'todayPlan' : 'tomorrowPlan';
          const plan = state[planKey];
          if (!plan) return state;

          const updatedTasks = plan.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status,
                  completedAt: status === 'completed' ? new Date().toISOString() : undefined,
                }
              : task
          );

          const completedMinutes = updatedTasks
            .filter((t) => t.status === 'completed')
            .reduce((sum, t) => sum + t.durationMinutes, 0);

          return {
            [planKey]: {
              ...plan,
              tasks: updatedTasks,
              completedMinutes,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      approveTomorrowPlan: () => {
        set((state) => {
          if (!state.tomorrowPlan) return state;
          return {
            tomorrowPlan: {
              ...state.tomorrowPlan,
              isApproved: true,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      editTomorrowTask: (taskId, updates) => {
        set((state) => {
          if (!state.tomorrowPlan) return state;

          const updatedTasks = state.tomorrowPlan.tasks.map((task) =>
            task.id === taskId ? { ...task, ...updates } : task
          );

          return {
            tomorrowPlan: {
              ...state.tomorrowPlan,
              tasks: updatedTasks,
              userModified: true,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      // ========================================================================
      // REFLECTION ACTIONS
      // ========================================================================

      setTodayReflection: (reflection) => set({ todayReflection: reflection }),

      submitReflection: (content, mood) => {
        const reflection: DailyReflection = {
          id: `reflection-${Date.now()}`,
          date: getCurrentDate(),
          content,
          mood,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          aiProcessed: false,
        };

        set({ todayReflection: reflection, isProcessingReflection: true });

        // Simulate AI processing (in real app, this would call AI service)
        setTimeout(() => {
          set((state) => ({
            todayReflection: state.todayReflection
              ? {
                  ...state.todayReflection,
                  aiProcessed: true,
                  aiInsights: 'Based on your reflection, I\'ll adjust tomorrow\'s pace.',
                }
              : null,
            isProcessingReflection: false,
          }));
        }, 1500);
      },

      // ========================================================================
      // AI ACTIONS
      // ========================================================================

      setCurrentInsight: (insight) => set({ currentInsight: insight }),

      dismissInsight: () => {
        set((state) => ({
          currentInsight: state.currentInsight
            ? { ...state.currentInsight, dismissed: true }
            : null,
        }));
      },

      // ========================================================================
      // RECOMMENDATION ACTIONS
      // ========================================================================

      setRecommendations: (recommendations) => set({ recommendations }),

      // ========================================================================
      // UI ACTIONS
      // ========================================================================

      setShowTomorrowPlan: (show) => set({ showTomorrowPlan: show }),

      setShowReflection: (show) => set({ showReflection: show }),

      setIsGeneratingPlan: (loading) => set({ isGeneratingPlan: loading }),

      setIsProcessingReflection: (loading) => set({ isProcessingReflection: loading }),

      setIsEditingTomorrow: (editing) => set({ isEditingTomorrow: editing }),

      // ========================================================================
      // TOMORROW EDIT ACTIONS
      // ========================================================================

      addTomorrowTask: (taskData) => {
        set((state) => {
          if (!state.tomorrowPlan) return state;

          const newTask: ScheduledTask = {
            ...taskData,
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          };

          const updatedTasks = [...state.tomorrowPlan.tasks, newTask];
          const totalMinutes = updatedTasks.reduce((sum, t) => sum + t.durationMinutes, 0);

          return {
            tomorrowPlan: {
              ...state.tomorrowPlan,
              tasks: updatedTasks,
              totalMinutes,
              userModified: true,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      removeTomorrowTask: (taskId) => {
        set((state) => {
          if (!state.tomorrowPlan) return state;

          const updatedTasks = state.tomorrowPlan.tasks.filter((t) => t.id !== taskId);
          const totalMinutes = updatedTasks.reduce((sum, t) => sum + t.durationMinutes, 0);

          return {
            tomorrowPlan: {
              ...state.tomorrowPlan,
              tasks: updatedTasks,
              totalMinutes,
              userModified: true,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      reorderTomorrowTasks: (taskIds) => {
        set((state) => {
          if (!state.tomorrowPlan) return state;

          const taskMap = new Map(state.tomorrowPlan.tasks.map((t) => [t.id, t]));
          const reorderedTasks = taskIds
            .map((id) => taskMap.get(id))
            .filter((t): t is ScheduledTask => t !== undefined);

          return {
            tomorrowPlan: {
              ...state.tomorrowPlan,
              tasks: reorderedTasks,
              userModified: true,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      // ========================================================================
      // ROADMAP ACTIONS
      // ========================================================================

      setActiveRoadmap: (roadmapId, day = 1) => {
        set({ activeRoadmapId: roadmapId, roadmapDay: day });
      },

      // ========================================================================
      // HELPERS
      // ========================================================================

      getCurrentTaskIndex: () => {
        const { todayPlan } = get();
        if (!todayPlan) return -1;

        // Find first non-completed task
        const index = todayPlan.tasks.findIndex(
          (t) => t.status === 'pending' || t.status === 'in_progress'
        );
        return index;
      },

      getCompletedTasksCount: () => {
        const { todayPlan } = get();
        if (!todayPlan) return 0;
        return todayPlan.tasks.filter((t) => t.status === 'completed').length;
      },

      getTotalMinutesRemaining: () => {
        const { todayPlan } = get();
        if (!todayPlan) return 0;
        return todayPlan.tasks
          .filter((t) => t.status !== 'completed' && t.status !== 'skipped')
          .reduce((sum, t) => sum + t.durationMinutes, 0);
      },

      // ========================================================================
      // TIME-AWARE VISIBILITY & DAY TRANSITION
      // ========================================================================

      checkTimeBasedVisibility: () => {
        // TEMPORARILY DISABLED FOR TESTING - always show both sections
        // Uncomment below for production time-based logic
        /*
        const hour = new Date().getHours();
        
        // Tomorrow plan: visible from 9pm to midnight (21:00 - 23:59)
        // After midnight, tomorrow becomes today
        const showTomorrowPlan = hour >= 21 && hour <= 23;
        
        // Reflection: visible from 8pm until 4am next day
        // Hide between 4am and 8pm
        const showReflection = hour >= 20 || hour < 4;
        
        set({
          showTomorrowPlan,
          showReflection,
        });
        */
        
        // For testing: always show
        set({
          showTomorrowPlan: true,
          showReflection: true,
        });
      },

      // Transition tomorrow's plan to today at midnight
      transitionToNewDay: () => {
        const state = get();
        const currentDate = getCurrentDate();
        
        // Check if today's plan is for yesterday (needs transition)
        if (state.todayPlan && state.todayPlan.date !== currentDate) {
          // Tomorrow becomes today
          if (state.tomorrowPlan) {
            const newTodayPlan: DailyPlan = {
              ...state.tomorrowPlan,
              date: currentDate,
              id: `plan-${currentDate}`,
            };
            
            set({
              todayPlan: newTodayPlan,
              tomorrowPlan: null, // Clear tomorrow plan (AI will generate new one)
              todayReflection: null, // Clear yesterday's reflection
              roadmapDay: state.roadmapDay + 1,
            });
          }
        }
      },

      // ========================================================================
      // SAMPLE DATA (for demo/development)
      // ========================================================================

      initializeSampleData: () => {
        const today = getCurrentDate();
        const tomorrow = getTomorrowDate();

        const sampleTodayPlan: DailyPlan = {
          id: `plan-${today}`,
          date: today,
          tasks: [
            {
              id: 'task-1',
              title: 'Read Chapter 3: Self-Attention',
              description: 'Deep dive into attention mechanisms',
              type: 'learn',
              status: 'completed',
              scheduledTime: '09:00',
              durationMinutes: 45,
              projectId: 'deep-learning-project',
              sourceType: 'book',
              aiGenerated: true,
              aiReason: 'Foundation for transformers',
              completedAt: new Date().toISOString(),
            },
            {
              id: 'task-2',
              title: 'Practice: Attention Calculations',
              description: 'Work through attention weight examples',
              type: 'practice',
              status: 'completed',
              scheduledTime: '10:00',
              durationMinutes: 30,
              projectId: 'deep-learning-project',
              aiGenerated: true,
              aiReason: 'Reinforce chapter concepts',
              completedAt: new Date().toISOString(),
            },
            {
              id: 'task-3',
              title: 'Review Flashcards',
              description: 'Spaced repetition for neural network basics',
              type: 'review',
              status: 'in_progress',
              scheduledTime: '14:00',
              durationMinutes: 15,
              projectId: 'deep-learning-project',
              aiGenerated: true,
              aiReason: 'Due for review today',
            },
            {
              id: 'task-4',
              title: 'Mini-project: Implement Attention',
              description: 'Code a basic attention layer from scratch',
              type: 'project',
              status: 'pending',
              scheduledTime: '16:00',
              durationMinutes: 60,
              projectId: 'deep-learning-project',
              aiGenerated: true,
              aiReason: 'Apply today\'s learning',
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isApproved: true,
          userModified: false,
          totalMinutes: 150,
          completedMinutes: 75,
        };

        const sampleTomorrowPlan: DailyPlan = {
          id: `plan-${tomorrow}`,
          date: tomorrow,
          tasks: [
            {
              id: 'task-5',
              title: 'Read Chapter 4: Transformers',
              description: 'The transformer architecture in detail',
              type: 'learn',
              status: 'pending',
              scheduledTime: '09:00',
              durationMinutes: 60,
              projectId: 'deep-learning-project',
              sourceType: 'book',
              aiGenerated: true,
              aiReason: 'Next in curriculum',
            },
            {
              id: 'task-6',
              title: 'Watch: Karpathy Transformer Tutorial',
              description: 'Visual walkthrough of implementation',
              type: 'learn',
              status: 'pending',
              scheduledTime: '10:30',
              durationMinutes: 45,
              projectId: 'deep-learning-project',
              sourceType: 'video',
              aiGenerated: true,
              aiReason: 'You learn well from videos',
            },
            {
              id: 'task-7',
              title: 'Practice: Positional Encoding',
              description: 'Implement sinusoidal positional encoding',
              type: 'practice',
              status: 'pending',
              scheduledTime: '14:00',
              durationMinutes: 30,
              projectId: 'deep-learning-project',
              aiGenerated: true,
              aiReason: 'Critical transformer component',
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isApproved: false,
          userModified: false,
          totalMinutes: 135,
          completedMinutes: 0,
          aiGeneratedAt: new Date().toISOString(),
        };

        const sampleInsight: AIInsight = {
          id: 'insight-1',
          content: 'You retain concepts better in the morning. I\'ve scheduled theory before 11am.',
          type: 'observation',
          priority: 'medium',
          dismissed: false,
          createdAt: new Date().toISOString(),
        };

        const sampleRecommendations: DashboardRecommendation[] = [
          {
            id: 'rec-1',
            type: 'flashcards',
            title: 'Flashcards',
            subtitle: 'Attention mechanisms',
            count: 12,
            isReady: true,
            isLoading: false,
          },
          {
            id: 'rec-2',
            type: 'mindmap',
            title: 'Mind Map',
            subtitle: 'Transformer architecture',
            isReady: true,
            isLoading: false,
          },
          {
            id: 'rec-3',
            type: 'exercises',
            title: 'Practice',
            subtitle: 'Self-attention problems',
            count: 5,
            isReady: true,
            isLoading: false,
          },
          {
            id: 'rec-4',
            type: 'concepts',
            title: 'Concepts',
            subtitle: 'Key ideas to master',
            count: 8,
            isReady: true,
            isLoading: false,
          },
          {
            id: 'rec-5',
            type: 'resources',
            title: 'Resources',
            subtitle: 'Papers & tutorials',
            count: 3,
            isReady: true,
            isLoading: false,
          },
        ];

        set({
          todayPlan: sampleTodayPlan,
          tomorrowPlan: sampleTomorrowPlan,
          currentInsight: sampleInsight,
          recommendations: sampleRecommendations,
          // Statistics
          streak: 12,
          totalHoursLearned: 47.5,
          totalDaysActive: 47,
          weeklyProgress: 80,
          // Roadmap
          activeRoadmapId: 'deep-learning-project',
          roadmapDay: 47,
          roadmapTotalDays: 120,
          roadmapProgress: 39, // 47/120 ≈ 39%
          // UI - FORCE SHOW FOR TESTING
          showTomorrowPlan: true,  // Force show for testing edit mode
          showReflection: true,    // Force show for testing
          isEditingTomorrow: false,
          // Clear reflection so it's fresh
          todayReflection: null,
        });
      },
    }),
    {
      name: 'note3-dashboard-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        todayPlan: state.todayPlan,
        tomorrowPlan: state.tomorrowPlan,
        todayReflection: state.todayReflection,
        activeRoadmapId: state.activeRoadmapId,
        roadmapDay: state.roadmapDay,
      }),
    }
  )
);

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

/**
 * Get current task (first non-completed)
 */
export const useCurrentTask = () => {
  const todayPlan = useDashboardStore((s) => s.todayPlan);
  const getCurrentTaskIndex = useDashboardStore((s) => s.getCurrentTaskIndex);

  if (!todayPlan) return null;
  const index = getCurrentTaskIndex();
  return index >= 0 ? todayPlan.tasks[index] : null;
};

/**
 * Get today's progress percentage
 */
export const useTodayProgress = () => {
  const todayPlan = useDashboardStore((s) => s.todayPlan);
  if (!todayPlan || todayPlan.tasks.length === 0) return 0;

  const completed = todayPlan.tasks.filter((t) => t.status === 'completed').length;
  return Math.round((completed / todayPlan.tasks.length) * 100);
};
