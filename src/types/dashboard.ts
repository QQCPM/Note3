/**
 * Dashboard Types
 *
 * Types for the AI Secretary Dashboard - daily planning,
 * reflections, and learning recommendations.
 */

// ============================================================================
// SCHEDULED TASK TYPES
// ============================================================================

export type ScheduledTaskType = 'learn' | 'practice' | 'review' | 'project' | 'break';
export type ScheduledTaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface ScheduledTask {
  id: string;
  title: string;
  description?: string;
  type: ScheduledTaskType;
  status: ScheduledTaskStatus;

  // Scheduling
  scheduledTime: string;      // HH:MM format (e.g., "09:00")
  durationMinutes: number;

  // References
  projectId?: string;
  treeItemId?: string;        // Related note/folder
  noteId?: string;

  // Source info
  sourceType?: 'book' | 'video' | 'audio' | 'generated';
  sourceReference?: string;

  // Completion
  completedAt?: string;

  // AI metadata
  aiGenerated: boolean;
  aiReason?: string;          // Why AI scheduled this
}

// ============================================================================
// DAILY PLAN TYPES
// ============================================================================

export interface DailyPlan {
  id: string;
  date: string;               // YYYY-MM-DD format
  tasks: ScheduledTask[];

  // Plan metadata
  createdAt: string;
  updatedAt: string;
  isApproved: boolean;

  // AI generation info
  aiGeneratedAt?: string;
  userModified: boolean;

  // Summary stats
  totalMinutes: number;
  completedMinutes: number;
}

// ============================================================================
// REFLECTION TYPES
// ============================================================================

export type ReflectionMood = 'great' | 'good' | 'okay' | 'struggling' | 'overwhelmed';

export interface DailyReflection {
  id: string;
  date: string;               // YYYY-MM-DD format

  // User input
  content: string;            // Free-form reflection text
  mood?: ReflectionMood;
  rating?: number;            // 1-5 overall day rating

  // Structured feedback
  whatWentWell?: string;
  whatWasHard?: string;
  tomorrowFocus?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // AI processing
  aiProcessed: boolean;
  aiInsights?: string;        // AI's takeaways from reflection
}

// ============================================================================
// AI INSIGHT TYPES
// ============================================================================

export interface AIInsight {
  id: string;
  content: string;
  type: 'tip' | 'observation' | 'suggestion' | 'warning';
  priority: 'high' | 'medium' | 'low';

  // Context
  relatedTaskId?: string;
  relatedProjectId?: string;

  // Display
  dismissed: boolean;
  createdAt: string;
}

// ============================================================================
// DASHBOARD STATE
// ============================================================================

export interface DashboardState {
  // Current day
  currentDate: string;

  // Plans
  todayPlan: DailyPlan | null;
  tomorrowPlan: DailyPlan | null;

  // Reflections
  todayReflection: DailyReflection | null;

  // AI
  currentInsight: AIInsight | null;

  // UI state
  showTomorrowPlan: boolean;  // Time-aware: true after 9pm
  showReflection: boolean;    // Time-aware: true after 10pm

  // Loading states
  isGeneratingPlan: boolean;
  isProcessingReflection: boolean;
}

// ============================================================================
// RECOMMENDATION CARD TYPES (Dashboard specific)
// ============================================================================

export interface DashboardRecommendation {
  id: string;
  type: 'flashcards' | 'mindmap' | 'exercises' | 'concepts' | 'resources';
  title: string;
  subtitle: string;
  count?: number;             // e.g., "12 cards"

  // Reference
  topicId?: string;
  projectId?: string;
  noteId?: string;

  // State
  isReady: boolean;
  isLoading: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get current time in HH:MM format
 */
export function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Get current date in YYYY-MM-DD format (LOCAL timezone)
 */
export function getCurrentDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Get tomorrow's date in YYYY-MM-DD format (LOCAL timezone)
 */
export function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Check if current time is after a specific hour
 */
export function isAfterHour(hour: number): boolean {
  return new Date().getHours() >= hour;
}

/**
 * Format duration in minutes to human readable
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Calculate progress percentage for a daily plan
 */
export function calculatePlanProgress(plan: DailyPlan): number {
  if (!plan.tasks.length) return 0;
  const completed = plan.tasks.filter(t => t.status === 'completed').length;
  return Math.round((completed / plan.tasks.length) * 100);
}

/**
 * Get task type icon
 */
export function getTaskTypeIcon(type: ScheduledTaskType): string {
  switch (type) {
    case 'learn': return '📖';
    case 'practice': return '✏️';
    case 'review': return '🔄';
    case 'project': return '🎯';
    case 'break': return '☕';
    default: return '📋';
  }
}

/**
 * Get mood emoji
 */
export function getMoodEmoji(mood: ReflectionMood): string {
  switch (mood) {
    case 'great': return '🔥';
    case 'good': return '😊';
    case 'okay': return '😐';
    case 'struggling': return '😓';
    case 'overwhelmed': return '😵';
    default: return '📝';
  }
}
