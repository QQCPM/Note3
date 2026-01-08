/**
 * LangGraph Secretary State
 * 
 * Defines the state annotation for the AI Secretary StateGraph.
 * This state flows through all nodes and persists via MemorySaver.
 */

import { Annotation, MessagesAnnotation } from "@langchain/langgraph/web";
import type { RoadmapData, CalendarEvent } from "@/types/secretary";
import type { BaseMessage } from "@langchain/core/messages";

// ============================================================================
// STATE ANNOTATION
// ============================================================================

/**
 * Secretary State - extends base messages with planning-specific fields
 * 
 * Key fields:
 * - messages: Conversation history (from MessagesAnnotation)
 * - currentIntent: Classified user intent for routing
 * - pendingRoadmap: Roadmap created but not yet saved
 * - awaitingConfirmation: Whether we need user approval
 * - memoryContext: Loaded memory files content
 * - calendarEvents: Events added during session
 */
export const SecretaryState = Annotation.Root({
    // Inherit messages array from LangGraph's MessagesAnnotation
    ...MessagesAnnotation.spec,

    // Classified intent for routing decisions
    currentIntent: Annotation<SecretaryIntent | null>({
        reducer: (_, y) => y,
        default: () => null,
    }),

    // Roadmap that's been created but not yet saved
    pendingRoadmap: Annotation<RoadmapData | null>({
        reducer: (_, y) => y,
        default: () => null,
    }),

    // Whether we're waiting for user to confirm an action
    awaitingConfirmation: Annotation<boolean>({
        reducer: (_, y) => y,
        default: () => false,
    }),

    // User's approval response (set after interrupt resumes)
    userApproved: Annotation<boolean | null>({
        reducer: (_, y) => y,
        default: () => null,
    }),

    // Context loaded from memory files (AI.md, Plan.md, etc.)
    memoryContext: Annotation<string | null>({
        reducer: (_, y) => y,
        default: () => null,
    }),

    // Calendar events added during this session (accumulates)
    calendarEvents: Annotation<CalendarEvent[]>({
        reducer: (x, y) => [...x, ...y],
        default: () => [],
    }),

    // Error message if something went wrong
    error: Annotation<string | null>({
        reducer: (_, y) => y,
        default: () => null,
    }),
});

// ============================================================================
// TYPES
// ============================================================================

/**
 * Possible user intents for routing
 */
export type SecretaryIntent =
    | 'create_roadmap'   // User wants to create a learning plan
    | 'save_roadmap'     // User wants to save pending roadmap
    | 'modify_roadmap'   // User wants to change existing roadmap
    | 'calendar'         // User wants to add events or mark days off
    | 'daily_plan'       // User wants to generate daily schedule
    | 'preferences'      // User wants to update study preferences
    | 'query'            // User is asking questions about their plans
    | 'general';         // General conversation

/**
 * Extract the state type for use in node function signatures
 */
export type SecretaryStateType = typeof SecretaryState.State;

/**
 * Input type for invoking the secretary graph
 */
export interface SecretaryInput {
    messages: BaseMessage[];
    memoryContext?: string;
}

/**
 * Output type from the secretary graph
 */
export interface SecretaryOutput {
    messages: BaseMessage[];
    pendingRoadmap: RoadmapData | null;
    awaitingConfirmation: boolean;
    calendarEvents: CalendarEvent[];
    error: string | null;
}
