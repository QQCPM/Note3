/**
 * LangGraph Secretary Graph
 * 
 * The main StateGraph for the AI Secretary.
 * Compiles the graph with checkpointing for conversation persistence.
 */

import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph/web";
import { SecretaryState, type SecretaryStateType } from "./secretaryState";
import {
    loadMemory,
    classifyIntent,
    callModel,
    executeTools,
    shouldContinue,
} from "./secretaryNodes";
import { HumanMessage, type BaseMessage } from "@langchain/core/messages";
import type { RoadmapData, CalendarEvent } from "@/types/secretary";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get last element from array (ES2022 Array.at polyfill)
 */
function getLastMessage(messages: BaseMessage[]): BaseMessage | undefined {
    return messages[messages.length - 1];
}

// ============================================================================
// GRAPH CONSTRUCTION
// ============================================================================

/**
 * Build the Secretary StateGraph
 * 
 * Flow:
 * START → loadMemory → classifyIntent → callModel → [executeTools → callModel]* → END
 */
function buildSecretaryGraph() {
    const workflow = new StateGraph(SecretaryState)
        // Add nodes
        .addNode("loadMemory", loadMemory)
        .addNode("classifyIntent", classifyIntent)
        .addNode("callModel", callModel)
        .addNode("executeTools", executeTools)

        // Define edges
        .addEdge(START, "loadMemory")
        .addEdge("loadMemory", "classifyIntent")
        .addEdge("classifyIntent", "callModel")
        .addConditionalEdges("callModel", shouldContinue, {
            executeTools: "executeTools",
            __end__: END,
        })
        .addEdge("executeTools", "callModel");

    return workflow;
}

// ============================================================================
// COMPILED GRAPH
// ============================================================================

// Create memory saver for conversation persistence
const checkpointer = new MemorySaver();

// Build and compile the graph
const workflow = buildSecretaryGraph();

/**
 * The compiled Secretary graph with checkpointing
 */
export const secretaryGraph = workflow.compile({
    checkpointer,
});

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Response from invoking the secretary
 */
export interface SecretaryResponse {
    /** The assistant's message content */
    message: string;
    /** Pending roadmap if one was created but not saved */
    pendingRoadmap: RoadmapData | null;
    /** Whether the secretary is waiting for user confirmation */
    awaitingConfirmation: boolean;
    /** Any calendar events added during this interaction */
    calendarEvents: CalendarEvent[];
    /** Error message if something went wrong */
    error: string | null;
}

/**
 * Invoke the secretary with a user message
 * 
 * @param message - The user's message
 * @param threadId - Unique ID for conversation continuity (use noteId or sessionId)
 * @returns The secretary's response with state updates
 */
export async function invokeSecretary(
    message: string,
    threadId: string
): Promise<SecretaryResponse> {
    console.log(`[LangGraph] Invoking secretary for thread: ${threadId}`);
    console.log(`[LangGraph] User message: ${message}`);

    try {
        const result = await secretaryGraph.invoke(
            {
                messages: [new HumanMessage(message)],
            },
            {
                configurable: { thread_id: threadId },
            }
        );

        // Extract the last assistant message
        const lastMessage = getLastMessage(result.messages);
        const messageContent = lastMessage?.content ?? "";
        const content = typeof messageContent === "string"
            ? messageContent
            : JSON.stringify(messageContent);

        console.log(`[LangGraph] Response:`, {
            messageLength: content.length,
            hasPendingRoadmap: !!result.pendingRoadmap,
            awaitingConfirmation: result.awaitingConfirmation,
        });

        return {
            message: content,
            pendingRoadmap: result.pendingRoadmap ?? null,
            awaitingConfirmation: result.awaitingConfirmation ?? false,
            calendarEvents: result.calendarEvents ?? [],
            error: result.error ?? null,
        };
    } catch (error) {
        console.error("[LangGraph] Secretary error:", error);
        return {
            message: "",
            pendingRoadmap: null,
            awaitingConfirmation: false,
            calendarEvents: [],
            error: error instanceof Error ? error.message : "Secretary invocation failed",
        };
    }
}

/**
 * Stream the secretary response
 * 
 * @param message - The user's message
 * @param threadId - Unique ID for conversation continuity
 * @param onChunk - Callback for each streamed chunk
 */
export async function streamSecretary(
    message: string,
    threadId: string,
    onChunk: (chunk: string) => void
): Promise<SecretaryResponse> {
    console.log(`[LangGraph] Streaming secretary for thread: ${threadId}`);

    try {
        const stream = await secretaryGraph.stream(
            {
                messages: [new HumanMessage(message)],
            },
            {
                configurable: { thread_id: threadId },
                streamMode: "values",
            }
        );

        let finalState: SecretaryStateType | null = null;

        for await (const state of stream) {
            finalState = state as SecretaryStateType;

            // Extract content from the last message if it's from assistant
            const lastMessage = getLastMessage(state.messages || []);
            if (lastMessage?.getType() === "ai") {
                const content = typeof lastMessage.content === "string"
                    ? lastMessage.content
                    : JSON.stringify(lastMessage.content);
                if (content) {
                    onChunk(content);
                }
            }
        }

        if (!finalState) {
            throw new Error("No state received from stream");
        }

        const lastMessage = getLastMessage(finalState.messages);
        const content = lastMessage?.content ?? "";
        const messageStr = typeof content === "string"
            ? content
            : JSON.stringify(content);

        return {
            message: messageStr,
            pendingRoadmap: finalState.pendingRoadmap ?? null,
            awaitingConfirmation: finalState.awaitingConfirmation ?? false,
            calendarEvents: finalState.calendarEvents ?? [],
            error: finalState.error ?? null,
        };
    } catch (error) {
        console.error("[LangGraph] Stream error:", error);
        return {
            message: "",
            pendingRoadmap: null,
            awaitingConfirmation: false,
            calendarEvents: [],
            error: error instanceof Error ? error.message : "Stream failed",
        };
    }
}

/**
 * Get the current state for a thread (for debugging/inspection)
 */
export async function getThreadState(threadId: string) {
    const state = await secretaryGraph.getState({
        configurable: { thread_id: threadId },
    });
    return state;
}

/**
 * Clear the state for a thread (reset conversation)
 * This properly resets all state including pending roadmaps
 */
export async function clearThread(threadId: string): Promise<void> {
    try {
        // Update the thread with fresh initial state
        await secretaryGraph.updateState(
            { configurable: { thread_id: threadId } },
            {
                messages: [],
                pendingRoadmap: null,
                awaitingConfirmation: false,
                calendarEvents: [],
                error: null,
                currentIntent: null,
                memoryContext: null,
                userApproved: null,
            }
        );
        console.log(`[LangGraph] Thread ${threadId} cleared successfully`);
    } catch (error) {
        console.warn(`[LangGraph] Failed to clear thread ${threadId}:`, error);
        // Even if update fails, the thread is effectively cleared on next invoke
    }
}

/**
 * Check if a thread has a pending roadmap waiting for save confirmation
 * This is the source of truth for pending state (not module-level vars)
 */
export async function hasPendingRoadmap(threadId: string): Promise<boolean> {
    try {
        const state = await getThreadState(threadId);
        return state?.values?.pendingRoadmap !== null && state?.values?.pendingRoadmap !== undefined;
    } catch {
        return false;
    }
}

/**
 * Get the pending roadmap from a thread
 */
export async function getPendingRoadmap(threadId: string): Promise<RoadmapData | null> {
    try {
        const state = await getThreadState(threadId);
        return state?.values?.pendingRoadmap ?? null;
    } catch {
        return null;
    }
}

