// Secretary Memory System Types
// These types represent the structured data parsed from AI.md, Project.md, and Daily.md

// ============================================
// AI.md - Global AI Configuration & Preferences
// ============================================

export interface UserPreferences {
  bestFocusTime?: string;          // e.g., "9am-12pm"
  breakFrequency?: string;         // e.g., "Every 45 minutes"
  breakFrequencyMinutes?: number;  // e.g., 45
  learningStyle?: string;          // e.g., "Visual + hands-on"
  weekdayHours?: number;           // e.g., 2
  weekendHours?: number;           // e.g., 4
  dailyStudyMinutes?: number;      // e.g., 120
  preferredTimeSlot?: 'morning' | 'afternoon' | 'evening' | 'night';
  notifications?: boolean;
}

export interface LearningStyle {
  primary: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
  preferences: string[];           // e.g., ["Step-by-step explanations", "Examples before theory"]
  pace: 'slow' | 'moderate' | 'fast';
}

export interface AvailabilitySlot {
  days: string[];                  // e.g., ["Mon", "Tue", "Wed", "Thu", "Fri"]
  timeRange: string;               // e.g., "9am-12pm"
}

export interface AIMemory {
  preferences: UserPreferences;
  learningStyle?: LearningStyle;   // Detailed learning style
  availability: AvailabilitySlot[];
  blockedDates: string[];          // e.g., ["Feb 10-17"]
  customInstructions?: string;     // Free-form AI instructions
  currentFocus?: string;           // What the user is currently learning
  goals?: string[];                // Learning goals
}

// ============================================
// Plan.md - Multi-Level Learning Plans (NEW - for future use)
// ============================================

export interface YearPlan {
  year: number;
  quarters: {
    quarter: 1 | 2 | 3 | 4;
    goal: string;
    focus: string[];
  }[];
}

export interface Roadmap {
  id: string;
  name: string;
  topic: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'paused' | 'completed';
  studyDays: string[];
  dailyHours: number;
  phases: RoadmapPhase[];
  dailyTopics?: DailyTopic[];
  rawContent?: string;  // Full AI-generated roadmap content (rich markdown)
}

export interface DailyTopic {
  day: number;
  week: number;
  month: number;
  topic: string;
  concepts?: string;
  reading?: string;
  tasks?: string;
}

export interface RoadmapPhase {
  id: string;
  name: string;
  weeks: string;                   // e.g., "1-4"
  status: 'completed' | 'in_progress' | 'pending';
  topics: string[];
}

// ============================================
// CONDENSED PLAN SYSTEM (Token-Efficient)
// ============================================

/**
 * Weekly theme - condensed representation of a week's content
 */
export interface WeeklyTheme {
  week: number;
  theme: string;                 // e.g., "Angular Momentum"
  status: 'completed' | 'current' | 'upcoming';
}

/**
 * Daily task entry in This Week section
 */
export interface DailyTaskEntry {
  day: string;                   // e.g., "Mon", "Tue", "Wed"
  planId: string;                // e.g., "QM"
  topic: string;                 // e.g., "Angular momentum operators"
  subtasks?: string[];           // Optional detailed tasks
  dayNumber?: number;            // Day number in the plan (e.g., 1, 2, 3) for linking
  totalSessions?: number;        // Total sessions in the plan (e.g., 11 for "Day 2 of 11")
  archivePath?: string;          // Path to detailed plan file (e.g., "Plans/qm-2026-01.md")
}


/**
 * This Week section - pre-computed daily assignments
 */
export interface ThisWeekPlan {
  weekStart: string;             // YYYY-MM-DD of week start
  weekRange: string;             // e.g., "Jan 27 - Feb 2"
  dailyTasks: DailyTaskEntry[];
}

/**
 * AI-computed flexible study schedule
 * Allows natural language scheduling with pre-computed dates
 */
export interface StudySchedule {
  // Natural language description (human-readable)
  // Examples:
  // - "Mon/Tue/Fri 3x per week"
  // - "Mon/Tue/Fri, off Jan 13-19, Sat only Jan 20-26"
  // - "Rotating: Thu → Wed → Thu (3-week cycle)"
  description: string;

  // Pre-computed study dates (machine-executable)
  // AI computes these from the description
  dates: string[];  // ["2026-01-06", "2026-01-07", ...]

  // Metadata
  computedAt: string;       // ISO timestamp when computed
  computedFrom?: string;    // Original description (for tracking changes)
}

/**
 * Condensed plan entry for Plan.md index
 * Full roadmap stored separately in Plans/ folder
 */
export interface CondensedPlan {
  id: string;                    // Short ID, e.g., "QM"
  name: string;                  // e.g., "Quantum Mechanics"
  topic: string;                 // Original topic query
  startDate: string;             // YYYY-MM-DD
  endDate: string;               // YYYY-MM-DD
  studyDays: string[];           // e.g., ["Mon", "Wed", "Fri"] - LEGACY, use schedule
  dailyHours: number;
  currentWeek: number;
  totalWeeks: number;
  status: 'active' | 'paused' | 'completed';
  weeklyThemes: WeeklyTheme[];   // Condensed themes only
  archivePath: string;           // Path to Plans/full-roadmap.md
  schedule?: StudySchedule;      // NEW: AI-computed flexible schedule
  totalLessons?: number;         // Cached lesson count from archive file
}


/**
 * Plan.md structure - condensed index
 */
export interface PlanMemory {
  activePlans: CondensedPlan[];
  archivedPlans: CondensedPlan[];
  thisWeek: ThisWeekPlan | null;
}

// Legacy interfaces kept for backward compatibility
export interface LegacyPlanMemory {
  yearPlan?: YearPlan;
  activeRoadmaps: Roadmap[];
  archivedRoadmaps: Roadmap[];
}

// ============================================
// Project.md - Per-Project Context & Roadmap (LEGACY - keep for backward compatibility)
// ============================================

export interface ProjectGoal {
  description: string;
  deadline?: string;
}

export interface WeeklyPlan {
  [day: string]: string;           // e.g., { "Mon": "Theory reading", "Tue": "Practice" }
}

export interface LearningPattern {
  bestFocusTime?: string;
  energyDips?: string[];
  averageSessionLength?: string;
  strengths?: string[];
  struggles?: string[];
}

export interface ProjectMemory {
  name: string;
  goal: ProjectGoal;
  timeline: {
    startDate: string;
    endDate: string;
    currentDay: number;
    totalDays: number;
  };
  currentPhase?: string;
  phases: RoadmapPhase[];
  weeklyPlan?: WeeklyPlan;
  learningPatterns?: LearningPattern;
  blockers?: string[];
}

// ============================================
// Daily.md - Daily Plan & Reflections
// ============================================

export interface DailyTask {
  id: string;
  time: string;                    // e.g., "09:00"
  task: string;
  type: 'learn' | 'practice' | 'review' | 'project' | 'break' | 'other';
  duration: string;                // e.g., "45min"
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  reason?: string;                 // AI's reason for scheduling this
}

export interface DailyReflectionData {
  mood?: 'great' | 'good' | 'okay' | 'tired' | 'frustrated';
  completedCount?: number;
  totalCount?: number;
  struggles?: string;
  wins?: string;
  notes?: string;
}

export interface DailyMemory {
  date: string;                    // YYYY-MM-DD
  context: {
    week: number;
    phase: string;
    focus: string;
    carryOver?: string;
  };
  tasks: DailyTask[];
  totalStudyTime: string;
  aiNotes?: string;                // AI's notes to the user
  reflection?: DailyReflectionData;
  tomorrowPreview?: string[];
  events?: Array<{                 // Calendar events for this day
    id: string;
    title: string;
    time: string;
    durationMinutes: number;
    type: string;
  }>;
}

// ============================================
// Memory File Paths
// ============================================

export interface MemoryFilePaths {
  aiMemory: string;                // Path to AI.md
  projectMemory: string;           // Path to Project.md in project root
  dailyMemory: string;             // Path to Daily.md
}

// ============================================
// Parsed Memory State
// ============================================

export interface SecretaryMemoryState {
  ai?: AIMemory;
  project?: ProjectMemory;
  daily?: DailyMemory;
  tomorrow?: DailyMemory;  // Next day's plan (Tomorrow.md)
  lastUpdated: {
    ai?: string;
    project?: string;
    daily?: string;
    tomorrow?: string;
  };
}
