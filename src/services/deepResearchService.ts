/**
 * Deep Research Service
 * 
 * Uses Gemini Deep Research API to conduct comprehensive topic research.
 * Streams progress updates including thinking, sources discovered, and notes.
 * 
 * The research report is then indexed by LlamaIndex for RAG queries.
 */

import { GoogleGenAI } from '@google/genai';

// Note: The interactions API is in beta and types may be incomplete
// Using 'any' for stream chunks until types stabilize
/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// TYPES
// ============================================================================

export interface ResearchSource {
    url: string;
    title: string;
    status: 'queued' | 'reading' | 'done' | 'failed';
}

export interface ResearchProgress {
    status: 'starting' | 'researching' | 'writing' | 'complete' | 'failed';
    progress: number;  // 0-100
    thinking: string;
    sources: ResearchSource[];
    notes: Record<string, string>;
    report: string | null;
    error: string | null;
    interactionId: string | null;
}

export interface DeepResearchConfig {
    topic: string;
    focusAreas?: string[];
    maxResearchTime?: number;  // minutes, default 20
}

// ============================================================================
// SERVICE
// ============================================================================

let client: GoogleGenAI | null = null;

/**
 * Initialize the Deep Research service
 */
export function initializeDeepResearch(apiKey: string): void {
    client = new GoogleGenAI({ apiKey });
    console.log('[DeepResearch] Service initialized');
}

/**
 * Check if Deep Research is available
 */
export function isDeepResearchAvailable(): boolean {
    return client !== null;
}

/**
 * Start a deep research task with streaming progress
 * 
 * @param config - Research configuration
 * @param onProgress - Callback for progress updates
 * @returns Final research report
 */
export async function startDeepResearch(
    config: DeepResearchConfig,
    onProgress: (progress: ResearchProgress) => void
): Promise<string> {
    if (!client) {
        throw new Error('Deep Research service not initialized');
    }

    const { topic, focusAreas = [], maxResearchTime = 20 } = config;

    // Build research prompt
    const researchPrompt = buildResearchPrompt(topic, focusAreas);

    // Initial progress state
    const progress: ResearchProgress = {
        status: 'starting',
        progress: 0,
        thinking: 'Initializing research...',
        sources: [],
        notes: {},
        report: null,
        error: null,
        interactionId: null,
    };

    onProgress(progress);

    try {
        // Start the research interaction with streaming
        const stream = await client.interactions.create({
            input: researchPrompt,
            agent: 'deep-research-pro-preview-12-2025',
            background: true,
            stream: true,
            agent_config: {
                type: 'deep-research',
                thinking_summaries: 'auto',
            },
        });

        const startTime = Date.now();

        // Process stream events
        for await (const chunk of stream) {
            // Check timeout
            const elapsedMinutes = (Date.now() - startTime) / 60000;
            if (elapsedMinutes > maxResearchTime) {
                console.warn('[DeepResearch] Research timed out');
                break;
            }

            // Note: chunk.event_id can be used for stream resume (not implemented yet)

            // Capture interaction ID
            if (chunk.event_type === 'interaction.start') {
                progress.interactionId = chunk.interaction?.id || null;
                progress.status = 'researching';
                progress.progress = 10;
                onProgress({ ...progress });
            }

            // Handle content deltas
            if (chunk.event_type === 'content.delta') {
                if ((chunk.delta as any)?.type === 'thought_summary') {
                    // Update thinking text
                    progress.thinking = (chunk.delta as any).content?.text || progress.thinking;
                    progress.status = 'researching';

                    // Parse thinking for sources
                    const sources = parseSourcesFromThinking(progress.thinking);
                    if (sources.length > 0) {
                        progress.sources = sources;
                    }

                    // Estimate progress based on sources found
                    progress.progress = Math.min(80, 10 + progress.sources.length * 5);
                    onProgress({ ...progress });
                } else if ((chunk.delta as any)?.type === 'text') {
                    // Final report text being written
                    progress.status = 'writing';
                    progress.progress = 85;
                    progress.report = (progress.report || '') + ((chunk.delta as any).text || '');
                    onProgress({ ...progress });
                }
            }

            // Handle completion
            if (chunk.event_type === 'interaction.complete') {
                progress.status = 'complete';
                progress.progress = 100;

                // Get final report from outputs
                if ((chunk as any).interaction?.outputs) {
                    const outputs = (chunk as any).interaction.outputs;
                    const lastOutput = outputs[outputs.length - 1];
                    if (lastOutput?.text) {
                        progress.report = lastOutput.text;
                    }
                }

                onProgress({ ...progress });
                break;
            }

            // Handle failure (check as string since types may not include this)
            if ((chunk.event_type as string) === 'interaction.failed') {
                progress.status = 'failed';
                progress.error = (chunk as any).error?.message || 'Research failed';
                onProgress({ ...progress });
                throw new Error(progress.error || 'Research failed');
            }
        }

        // Return the final report
        if (!progress.report) {
            throw new Error('No research report generated');
        }

        console.log(`[DeepResearch] Research complete. Report length: ${progress.report.length} chars`);
        return progress.report;

    } catch (error) {
        progress.status = 'failed';
        progress.error = error instanceof Error ? error.message : 'Unknown error';
        onProgress({ ...progress });
        throw error;
    }
}

/**
 * Build the research prompt for course generation
 */
function buildResearchPrompt(topic: string, focusAreas: string[]): string {
    const focusSection = focusAreas.length > 0
        ? `\nFOCUS AREAS: ${focusAreas.join(', ')}`
        : '';

    return `Research comprehensive educational content for creating a course on: "${topic}"
${focusSection}

Please research and gather information on:

1. PREREQUISITES
   - What foundational knowledge is required?
   - What skills should learners have before starting?

2. CORE CONCEPTS
   - What are the essential concepts that must be covered?
   - How do these concepts relate to each other?
   - What is the logical learning sequence?

3. COMMON MISCONCEPTIONS
   - What do learners typically misunderstand?
   - What concepts are often confused?

4. PRACTICAL APPLICATIONS
   - Real-world use cases and examples
   - Industry applications
   - Hands-on project ideas

5. RECOMMENDED RESOURCES
   - Key textbooks and papers
   - Video tutorials and courses
   - Interactive tools and simulations

6. DIFFICULTY PROGRESSION
   - How should complexity increase?
   - What makes each stage challenging?

Please provide detailed, well-sourced information that can be used to create educational content.
Include specific examples, formulas (if applicable), and clear explanations.`;
}

/**
 * Parse sources from thinking text (heuristic)
 */
function parseSourcesFromThinking(thinking: string): ResearchSource[] {
    const sources: ResearchSource[] = [];

    // Look for URL patterns
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = thinking.match(urlPattern) || [];

    for (const url of urls) {
        // Clean URL
        const cleanUrl = url.replace(/[.,;:!?)>]+$/, '');

        // Skip if already added
        if (sources.some(s => s.url === cleanUrl)) continue;

        // Extract domain as title
        try {
            const domain = new URL(cleanUrl).hostname.replace('www.', '');
            sources.push({
                url: cleanUrl,
                title: domain,
                status: 'done',
            });
        } catch {
            // Invalid URL, skip
        }
    }

    return sources;
}

/**
 * Poll for research results (fallback for non-streaming)
 */
export async function pollResearchResults(
    interactionId: string,
    onProgress: (progress: ResearchProgress) => void,
    timeoutMs: number = 20 * 60 * 1000  // 20 minutes
): Promise<string> {
    if (!client) {
        throw new Error('Deep Research service not initialized');
    }

    const startTime = Date.now();
    const pollInterval = 10000;  // 10 seconds

    while (Date.now() - startTime < timeoutMs) {
        const interaction = await client.interactions.get(interactionId);

        if (interaction.status === 'completed') {
            const outputs = (interaction as any).outputs;
            const lastOutput = outputs?.[outputs.length - 1];
            return (lastOutput as any)?.text || '';
        }

        if (interaction.status === 'failed') {
            throw new Error((interaction as any).error?.message || 'Research failed');
        }

        // Update progress
        onProgress({
            status: 'researching',
            progress: 50,
            thinking: 'Research in progress...',
            sources: [],
            notes: {},
            report: null,
            error: null,
            interactionId,
        });

        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Research timed out');
}
