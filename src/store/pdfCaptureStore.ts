import { create } from 'zustand';

// ============================================================================
// TYPES
// ============================================================================

export interface CapturedContext {
    id: string;
    pdfId: string;
    pdfName: string;
    pageNumber: number;
    bounds: { x: number; y: number; width: number; height: number };
    imageDataUrl: string;      // Base64 PNG
    extractedText?: string;    // Text from region if available
    capturedAt: Date;
}

export type CaptureMode = 'idle' | 'ready' | 'drawing';

interface PDFCaptureStore {
    // State
    captureMode: CaptureMode;
    currentCapture: CapturedContext | null;
    drawingStart: { x: number; y: number } | null;
    currentPdfId: string | null;
    currentPdfName: string | null;

    // Actions
    setPdfContext: (pdfId: string, pdfName: string) => void;
    startCapture: () => void;
    cancelCapture: () => void;
    setDrawingStart: (point: { x: number; y: number } | null) => void;
    completeCapture: (context: CapturedContext) => void;
    clearCapture: () => void;
}

// ============================================================================
// HELPER
// ============================================================================

function generateId(): string {
    return `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// STORE
// ============================================================================

export const usePDFCaptureStore = create<PDFCaptureStore>((set) => ({
    // Initial state
    captureMode: 'idle',
    currentCapture: null,
    drawingStart: null,
    currentPdfId: null,
    currentPdfName: null,

    // Set current PDF context
    setPdfContext: (pdfId, pdfName) => set({
        currentPdfId: pdfId,
        currentPdfName: pdfName,
    }),

    // Start capture mode
    startCapture: () => set({
        captureMode: 'ready',
        drawingStart: null,
    }),

    // Cancel capture
    cancelCapture: () => set({
        captureMode: 'idle',
        drawingStart: null,
    }),

    // Set drawing start point
    setDrawingStart: (point) => set({
        drawingStart: point,
        captureMode: point ? 'drawing' : 'ready',
    }),

    // Complete capture with context
    completeCapture: (context) => set({
        captureMode: 'idle',
        drawingStart: null,
        currentCapture: {
            ...context,
            id: generateId(),
            capturedAt: new Date(),
        },
    }),

    // Clear captured context
    clearCapture: () => set({
        currentCapture: null,
    }),
}));

// ============================================================================
// SELECTORS
// ============================================================================

export const selectHasCapturedContext = (state: PDFCaptureStore) =>
    state.currentCapture !== null;

export const selectIsCapturing = (state: PDFCaptureStore) =>
    state.captureMode !== 'idle';
