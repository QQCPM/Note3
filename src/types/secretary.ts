/**
 * Secretary Types - Conversational AI Planning
 */

// ============================================================================
// CALENDAR & SCHEDULING
// ============================================================================

export interface CalendarEvent {
    id: string;
    title: string;
    date: string;        // YYYY-MM-DD
    time: string;        // HH:MM
    durationMinutes: number;
    type: 'meeting' | 'appointment' | 'blocked' | 'other';
    recurring?: {
        pattern: 'daily' | 'weekly' | 'monthly';
        endDate?: string;
    };
}

export interface BlockedDate {
    date: string;        // YYYY-MM-DD
    reason?: string;
    isRecurring?: boolean;
}

export interface TimeSlot {
    start: string;       // HH:MM
    end: string;         // HH:MM
    available: boolean;
    event?: CalendarEvent;
}

// ============================================================================
// ROADMAP DATA
// ============================================================================

export interface RoadmapPhaseData {
    name: string;
    weeks: string;       // e.g., "1-4"
    topics: string[];
    daysCount: number;
}

export interface RoadmapData {
    name: string;
    topic: string;
    totalDays: number;
    startDate?: string;  // YYYY-MM-DD (null = not started yet)
    studyDays: string[]; // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    dailyHours: number;
    phases: RoadmapPhaseData[];
    dailyTopics: {
        day: number;
        topic: string;
        type: 'learn' | 'practice' | 'project' | 'review';
        duration: string;
    }[];
}

// ============================================================================
// SECRETARY RESPONSES
// ============================================================================

export interface SecretaryAction {
    type:
    | 'roadmap_created'
    | 'roadmap_saved'
    | 'plan_generated'
    | 'day_marked_off'
    | 'event_added'
    | 'preferences_updated'
    | 'schedule_adjusted';
    details: Record<string, any>;
    timestamp: string;
}

export interface SecretaryResponse {
    message: string;              // AI's response to user
    actions: SecretaryAction[];   // What was done
    pendingApproval?: boolean;    // Does user need to confirm?
    proposedRoadmap?: RoadmapData; // If roadmap was created (not yet saved)
    showPreview?: boolean;        // Should UI show a preview?
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export interface SecretaryTool {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, {
            type: string;
            description: string;
            enum?: string[];
            items?: { type: string };
        }>;
        required: string[];
    };
}

export interface ToolCallResult {
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

export interface StudyPreferences {
    studyDays: string[];           // ['Mon', 'Tue', ...]
    dailyHours: number;
    preferredTimeSlot: 'morning' | 'afternoon' | 'evening';
    focusTime: string;             // e.g., "9am-12pm"
    breakFrequency: number;        // minutes
}
