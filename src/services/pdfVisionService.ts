/**
 * PDF Vision Service
 * 
 * Uses Gemini 3 Pro to analyze captured PDF regions and provide explanations.
 */

import { geminiService } from './geminiService';
import type { CapturedContext } from '@/store/pdfCaptureStore';

// ============================================================================
// TYPES
// ============================================================================

export interface VisionExplanation {
    explanation: string;
    keyPoints?: string[];
    relatedConcepts?: string[];
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Explain a captured PDF region using Gemini 3 Pro vision
 */
export async function explainCapturedRegion(
    context: CapturedContext,
    userQuestion: string
): Promise<string> {
    if (!geminiService.isInitialized) {
        throw new Error('Gemini service not initialized. Please configure your Gemini API key in settings.');
    }

    // Build context-aware prompt
    const prompt = buildExplanationPrompt(context, userQuestion);

    // Extract base64 data from data URL
    const base64Data = context.imageDataUrl.split(',')[1];
    if (!base64Data) {
        throw new Error('Invalid image data');
    }

    try {
        // Use Gemini for vision understanding
        console.log('[PDFVisionService] Calling Gemini vision...');
        const response = await geminiService.chatWithImage(prompt, base64Data, 'image/png');
        console.log('[PDFVisionService] Got response');
        return response;
    } catch (error) {
        console.error('[PDFVisionService] Failed to explain region:', error);
        throw error;
    }
}

/**
 * Build a context-aware prompt for explanation
 */
function buildExplanationPrompt(context: CapturedContext, userQuestion: string): string {
    const hasText = context.extractedText && context.extractedText.trim().length > 0;

    let prompt = `You are an expert tutor helping a student understand content from a PDF document.

CONTEXT:
- Document: "${context.pdfName}"
- Page: ${context.pageNumber}
`;

    if (hasText) {
        prompt += `- Text in selected region: "${context.extractedText}"
`;
    } else {
        prompt += `- No text could be extracted (this is likely a figure, diagram, or formula)
`;
    }

    prompt += `
USER'S QUESTION: ${userQuestion}

INSTRUCTIONS:
1. Carefully analyze the captured image
2. If it's a diagram/figure, describe what you see and explain the concepts
3. If it's text/formula, explain the meaning and any underlying principles
4. If it's a chart/graph, interpret the data and trends
5. Keep your explanation clear, educational, and at an appropriate level
6. Use bullet points for complex explanations
7. If relevant, mention related concepts the student should understand

Provide a helpful, detailed explanation:`;

    return prompt;
}

/**
 * Quick explain - for simple "Explain this" requests
 */
export async function quickExplain(context: CapturedContext): Promise<string> {
    return explainCapturedRegion(context, 'Please explain what this shows and help me understand it.');
}

/**
 * Check if vision service is available
 */
export function isVisionAvailable(): boolean {
    return geminiService.isInitialized;
}
