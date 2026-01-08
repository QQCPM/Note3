/**
 * Course Generator Service (Main Thread)
 * 
 * Thin wrapper that communicates with the Web Worker.
 * Provides the same API as the original courseGraph.ts exports.
 */

import CourseGeneratorWorkerConstructor from './courseGenerator.worker?worker';
import { invoke } from '@tauri-apps/api/core';
import type {
    MainToWorkerMessage,
    WorkerToMainMessage,
    CourseGeneratorResponse,
    CourseOutline,
    CourseDifficulty,
    ResearchSource,
} from './workerMessages';
import type { CourseSettings, GenerationStageType } from '@/types/course';

/**
 * Research progress update
 */
export interface ResearchProgressUpdate {
    status: 'starting' | 'researching' | 'writing' | 'complete' | 'failed';
    progress: number;
    thinking: string;
    sources: ResearchSource[];
    notes: Record<string, string>;
    partialReport: string | null;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class CourseGeneratorService {
    private worker: Worker | null = null;
    private requestId = 0;
    private geminiApiKey: string = '';  // Store for research requests

    // Callbacks for progress updates (threadId -> callback)
    private progressCallbacks = new Map<string, (progress: {
        stage: GenerationStageType;
        stageProgress: number;
        thinkingOutput: string;
    }) => void>();

    // Callbacks for outline ready (threadId -> callback)
    private outlineReadyCallbacks = new Map<string, (outline: CourseOutline, thinking: string) => void>();

    // Callbacks for research progress (threadId -> callback)
    private researchProgressCallbacks = new Map<string, (progress: ResearchProgressUpdate) => void>();

    // Pending requests waiting for response (requestId -> { resolve, reject })
    private pendingRequests = new Map<string, {
        resolve: (data: any) => void;
        reject: (error: Error) => void;
    }>();

    // Thread to request ID mapping (for matching complete/error responses)
    private threadToRequestId = new Map<string, string>();

    // ========================================================================
    // WORKER MANAGEMENT
    // ========================================================================

    private ensureWorker(): Worker {
        if (this.worker) return this.worker;

        console.log('[CourseService] Starting worker...');
        this.worker = new CourseGeneratorWorkerConstructor();

        this.worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
            this.handleWorkerMessage(event.data);
        };

        this.worker.onerror = (error) => {
            console.error('[CourseService] Worker error:', error);
            // Reject all pending requests
            for (const [, pending] of this.pendingRequests) {
                pending.reject(new Error('Worker error'));
            }
            this.pendingRequests.clear();
        };

        return this.worker;
    }

    private handleWorkerMessage(msg: WorkerToMainMessage) {
        console.log(`[CourseService] Received: ${msg.type}`);

        switch (msg.type) {
            case 'PROGRESS': {
                const callback = this.progressCallbacks.get(msg.threadId);
                if (callback) {
                    callback({
                        stage: msg.payload.stage,
                        stageProgress: msg.payload.stageProgress,
                        thinkingOutput: msg.payload.thinkingOutput,
                    });
                }
                break;
            }

            case 'RESEARCH_PROGRESS': {
                const callback = this.researchProgressCallbacks.get(msg.threadId);
                if (callback) {
                    callback({
                        status: msg.payload.status,
                        progress: msg.payload.progress,
                        thinking: msg.payload.thinking,
                        sources: msg.payload.sources,
                        notes: msg.payload.notes,
                        partialReport: msg.payload.partialReport,
                    });
                }
                break;
            }

            case 'OUTLINE_READY': {
                const callback = this.outlineReadyCallbacks.get(msg.threadId);
                if (callback) {
                    callback(msg.payload.outline, msg.payload.thinkingOutput);
                }
                // Also resolve the pending request with awaiting_approval status
                const requestId = this.threadToRequestId.get(msg.threadId);
                if (requestId) {
                    const pending = this.pendingRequests.get(requestId);
                    if (pending) {
                        pending.resolve({
                            status: 'awaiting_approval',
                            outline: msg.payload.outline,
                            course: null,
                            stage: 'planning',
                            progress: 25,
                            thinkingOutput: msg.payload.thinkingOutput,
                        } as CourseGeneratorResponse);
                    }
                }
                break;
            }

            case 'COMPLETE': {
                const pending = this.pendingRequests.get(msg.id);
                if (pending) {
                    this.pendingRequests.delete(msg.id);
                    pending.resolve({
                        status: 'complete',
                        outline: null,
                        course: msg.payload.course,
                        stage: 'review',
                        progress: 100,
                        thinkingOutput: msg.payload.thinkingOutput,
                    } as CourseGeneratorResponse);
                }
                break;
            }

            case 'ERROR': {
                const pending = this.pendingRequests.get(msg.id);
                if (pending) {
                    this.pendingRequests.delete(msg.id);
                    pending.resolve({
                        status: 'error',
                        outline: null,
                        course: null,
                        stage: msg.payload.stage,
                        progress: 0,
                        thinkingOutput: '',
                        error: msg.payload.error,
                    } as CourseGeneratorResponse);
                }
                break;
            }

            case 'CANCELLED': {
                const pending = this.pendingRequests.get(msg.id);
                if (pending) {
                    this.pendingRequests.delete(msg.id);
                    pending.resolve({
                        status: 'cancelled',
                        outline: null,
                        course: null,
                        stage: 'analysis',
                        progress: 0,
                        thinkingOutput: '',
                    } as CourseGeneratorResponse);
                }
                break;
            }

            case 'STATUS': {
                const pending = this.pendingRequests.get(msg.id);
                if (pending) {
                    this.pendingRequests.delete(msg.id);
                    pending.resolve(msg.payload);
                }
                break;
            }

            case 'REQUEST_DEEP_RESEARCH': {
                // Worker is requesting deep research via Tauri
                this.handleDeepResearchRequest(msg.threadId, msg.payload);
                break;
            }
        }
    }

    /**
     * Handle deep research request from worker
     * Routes through Tauri to bypass CORS restrictions
     */
    private async handleDeepResearchRequest(
        threadId: string,
        payload: { topic: string; focusAreas: string[] }
    ): Promise<void> {
        console.log(`[CourseService] Deep research request for: "${payload.topic}"`);

        try {
            // Call Tauri backend which can make the API call without CORS issues
            interface CourseResearchResult {
                topic: string;
                summary: string;
                sources: Array<{ url: string; title: string }>;
                grounding_metadata: any;
            }

            const result = await invoke<CourseResearchResult>('course_deep_research', {
                topic: payload.topic,
                focusAreas: payload.focusAreas,
                geminiApiKey: this.geminiApiKey,
            });

            console.log(`[CourseService] Deep research complete: ${result.summary.length} chars, ${result.sources.length} sources`);

            // Send result back to worker
            const resultMsg: MainToWorkerMessage = {
                type: 'DEEP_RESEARCH_RESULT',
                threadId,
                payload: {
                    success: true,
                    summary: result.summary,
                    sources: result.sources,
                },
            };
            this.worker?.postMessage(resultMsg);

        } catch (error) {
            console.error('[CourseService] Deep research via Tauri failed:', error);

            // Send error back to worker
            const errorMsg: MainToWorkerMessage = {
                type: 'DEEP_RESEARCH_RESULT',
                threadId,
                payload: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            };
            this.worker?.postMessage(errorMsg);
        }
    }

    private sendMessage<T>(msg: Exclude<MainToWorkerMessage, { type: 'DEEP_RESEARCH_RESULT' }>, timeoutMs = 600000): Promise<T> {
        const worker = this.ensureWorker();

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(msg.id, { resolve, reject });
            worker.postMessage(msg);

            // Set timeout (generation can take a while)
            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(msg.id)) {
                    this.pendingRequests.delete(msg.id);
                    reject(new Error(`Request timeout after ${timeoutMs}ms: ${msg.type}`));
                }
            }, timeoutMs);

            // Wrap resolve/reject to clear timeout
            const original = this.pendingRequests.get(msg.id)!;
            this.pendingRequests.set(msg.id, {
                resolve: (data) => {
                    clearTimeout(timeout);
                    original.resolve(data);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    original.reject(error);
                },
            });
        });
    }

    // ========================================================================
    // PUBLIC API (Same as original courseGraph.ts exports)
    // ========================================================================

    /**
     * Start course generation
     */
    async startCourseGeneration(
        topic: string,
        threadId: string,
        options?: {
            difficulty?: CourseDifficulty;
            settings?: Partial<CourseSettings>;
            focusAreas?: string[];
        }
    ): Promise<CourseGeneratorResponse> {
        console.log(`[CourseService] Starting generation for: "${topic}"`);

        // Get API keys from environment/config
        const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const youtubeApiKey = import.meta.env.VITE_YOUTUBE_API_KEY;

        if (!geminiApiKey) {
            return {
                status: 'error',
                outline: null,
                course: null,
                stage: 'analysis',
                progress: 0,
                thinkingOutput: '',
                error: 'Gemini API key not configured',
            };
        }

        // Store API key for research requests
        this.geminiApiKey = geminiApiKey;

        const id = `req-${++this.requestId}-${Date.now()}`;
        this.threadToRequestId.set(threadId, id);

        const msg: MainToWorkerMessage = {
            type: 'START_GENERATION',
            id,
            payload: {
                topic,
                threadId,
                difficulty: options?.difficulty || 'intermediate',
                settings: options?.settings || {
                    includeVideos: true,
                    includeSlides: true,
                    includePractice: true,
                    includeQuizzes: true,
                    estimatedWeeks: 4,
                    hoursPerWeek: 5,
                },
                focusAreas: options?.focusAreas || [],
                geminiApiKey,
                youtubeApiKey,
            },
        };

        return this.sendMessage<CourseGeneratorResponse>(msg);
    }

    /**
     * Approve outline and continue generation
     */
    async approveOutlineAndContinue(
        threadId: string,
        modifiedOutline: CourseOutline
    ): Promise<CourseGeneratorResponse> {
        console.log(`[CourseService] Approving outline for thread: ${threadId}`);

        const id = `req-${++this.requestId}-${Date.now()}`;
        this.threadToRequestId.set(threadId, id);

        const msg: MainToWorkerMessage = {
            type: 'APPROVE_OUTLINE',
            id,
            payload: { threadId, modifiedOutline },
        };

        // Register pending request - will be resolved when COMPLETE is received
        // The worker will use this ID for the COMPLETE message
        return this.sendMessage<CourseGeneratorResponse>(msg, 600000); // 10 min timeout for generation
    }

    /**
     * Reject outline and regenerate
     */
    async rejectOutlineAndRegenerate(
        threadId: string,
        feedback: string
    ): Promise<CourseGeneratorResponse> {
        console.log(`[CourseService] Rejecting outline for thread: ${threadId}`);

        const id = `req-${++this.requestId}-${Date.now()}`;

        const msg: MainToWorkerMessage = {
            type: 'REJECT_OUTLINE',
            id,
            payload: { threadId, feedback },
        };

        this.ensureWorker().postMessage(msg);

        // The worker will regenerate and send OUTLINE_READY again
        return {
            status: 'running',
            outline: null,
            course: null,
            stage: 'planning',
            progress: 10,
            thinkingOutput: `Regenerating outline with feedback: ${feedback}\n`,
        };
    }

    /**
     * Get generation status
     */
    async getGenerationStatus(threadId: string): Promise<{
        status: string;
        stage: GenerationStageType;
        progress: number;
    }> {
        const id = `status-${++this.requestId}-${Date.now()}`;

        const msg: MainToWorkerMessage = {
            type: 'GET_STATUS',
            id,
            payload: { threadId },
        };

        return this.sendMessage(msg);
    }

    /**
     * Cancel generation
     */
    async cancelGeneration(threadId: string): Promise<void> {
        const id = `cancel-${++this.requestId}-${Date.now()}`;

        const msg: MainToWorkerMessage = {
            type: 'CANCEL',
            id,
            payload: { threadId },
        };

        await this.sendMessage(msg);
    }

    /**
     * Subscribe to progress updates
     */
    onProgress(threadId: string, callback: (progress: {
        stage: GenerationStageType;
        stageProgress: number;
        thinkingOutput: string;
    }) => void): () => void {
        this.progressCallbacks.set(threadId, callback);
        return () => {
            this.progressCallbacks.delete(threadId);
        };
    }

    /**
     * Subscribe to outline ready events
     */
    onOutlineReady(threadId: string, callback: (outline: CourseOutline, thinking: string) => void): () => void {
        this.outlineReadyCallbacks.set(threadId, callback);
        return () => {
            this.outlineReadyCallbacks.delete(threadId);
        };
    }

    /**
     * Subscribe to research progress updates (deep research streaming)
     */
    onResearchProgress(threadId: string, callback: (progress: ResearchProgressUpdate) => void): () => void {
        this.researchProgressCallbacks.set(threadId, callback);
        return () => {
            this.researchProgressCallbacks.delete(threadId);
        };
    }

    /**
     * Terminate the worker
     */
    terminate(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.pendingRequests.clear();
            this.progressCallbacks.clear();
            this.outlineReadyCallbacks.clear();
            this.researchProgressCallbacks.clear();
            console.log('[CourseService] Worker terminated');
        }
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const courseGeneratorService = new CourseGeneratorService();

// ============================================================================
// BACKWARDS-COMPATIBLE FUNCTION EXPORTS
// ============================================================================

/**
 * Start course generation
 */
export async function startCourseGeneration(
    topic: string,
    threadId: string,
    options?: {
        difficulty?: CourseDifficulty;
        settings?: Partial<CourseSettings>;
        focusAreas?: string[];
    }
): Promise<CourseGeneratorResponse> {
    return courseGeneratorService.startCourseGeneration(topic, threadId, options);
}

/**
 * Approve outline and continue generation
 */
export async function approveOutlineAndContinue(
    threadId: string,
    modifiedOutline: CourseOutline
): Promise<CourseGeneratorResponse> {
    return courseGeneratorService.approveOutlineAndContinue(threadId, modifiedOutline);
}

/**
 * Reject outline and regenerate
 */
export async function rejectOutlineAndRegenerate(
    threadId: string,
    feedback: string
): Promise<CourseGeneratorResponse> {
    return courseGeneratorService.rejectOutlineAndRegenerate(threadId, feedback);
}

/**
 * Get generation status
 */
export async function getGenerationStatus(threadId: string) {
    return courseGeneratorService.getGenerationStatus(threadId);
}

/**
 * Cancel generation
 */
export async function cancelGeneration(threadId: string): Promise<void> {
    return courseGeneratorService.cancelGeneration(threadId);
}

// Re-export types for convenience
export type { CourseGeneratorResponse, CourseOutline, CourseDifficulty };
