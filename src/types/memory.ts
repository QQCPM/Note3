// Secretary Memory System Types
// These types represent the structured data parsed from AI.md, Project.md, and Daily.md

// ============================================
// AI.md - Global AI Configuration & Preferences
// ============================================

export interface UserPreferences {
  bestFocusTime?: string;          // e.g., "9am-12pm"
  breakFrequency?: string;         // e.g., "Every 45 minutes"
  learningStyle?: string;          // e.g., "Visual + hands-on"
  weekdayHours?: number;           // e.g., 2
  weekendHours?: number;           // e.g., 4
}

export interface AvailabilitySlot {
  days: string[];                  // e.g., ["Mon", "Tue", "Wed", "Thu", "Fri"]
  timeRange: string;               // e.g., "9am-12pm"
}

export interface AIMemory {
  preferences: UserPreferences;
  availability: AvailabilitySlot[];
  blockedDates: string[];          // e.g., ["Feb 10-17"]
  customInstructions?: string;     // Free-form AI instructions
}

// ============================================
// Project.md - Per-Project Context & Roadmap
// ============================================

export interface ProjectGoal {
  description: string;
  deadline?: string;
}

export interface RoadmapPhase {
  id: string;
  name: string;
  weeks: string;                   // e.g., "1-4"
  status: 'completed' | 'in_progress' | 'pending';
  topics: string[];
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
  lastUpdated: {
    ai?: string;
    project?: string;
    daily?: string;
  };
}
