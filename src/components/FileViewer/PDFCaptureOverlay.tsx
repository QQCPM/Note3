import React, { useRef, useState, useEffect, useCallback } from 'react';
import { usePDFCaptureStore, type CapturedContext } from '@/store/pdfCaptureStore';
import { useUIStore } from '@/store/uiStore';
import './PDFCaptureOverlay.css';

interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface PDFCaptureOverlayProps {
    pageNumber: number;
    pageRef: React.RefObject<HTMLDivElement>;
    pdfId: string;
    pdfName: string;
}

const PDFCaptureOverlay: React.FC<PDFCaptureOverlayProps> = ({
    pageNumber,
    pageRef,
    pdfId,
    pdfName,
}) => {
    const {
        captureMode,
        drawingStart,
        setDrawingStart,
        completeCapture,
        cancelCapture,
    } = usePDFCaptureStore();

    const { setAISidebarCollapsed, setAISidebarTab } = useUIStore();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [currentBounds, setCurrentBounds] = useState<Bounds | null>(null);

    // Resize canvas to match page
    useEffect(() => {
        if (!pageRef.current || !canvasRef.current) return;

        // Set initial size immediately
        canvasRef.current.width = pageRef.current.offsetWidth;
        canvasRef.current.height = pageRef.current.offsetHeight;

        const resizeObserver = new ResizeObserver(() => {
            if (pageRef.current && canvasRef.current) {
                canvasRef.current.width = pageRef.current.offsetWidth;
                canvasRef.current.height = pageRef.current.offsetHeight;
            }
        });

        resizeObserver.observe(pageRef.current);
        return () => resizeObserver.disconnect();
    }, [pageRef]);

    // Draw selection rectangle
    useEffect(() => {
        if (!canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (currentBounds && captureMode === 'drawing') {
            // Draw semi-transparent overlay
            ctx.fillStyle = 'rgba(88, 166, 255, 0.1)';
            ctx.fillRect(currentBounds.x, currentBounds.y, currentBounds.width, currentBounds.height);

            // Draw dashed border
            ctx.strokeStyle = '#58a6ff';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(currentBounds.x, currentBounds.y, currentBounds.width, currentBounds.height);

            // Draw corner handles
            const handleSize = 8;
            ctx.fillStyle = '#58a6ff';
            ctx.setLineDash([]);

            // Top-left
            ctx.fillRect(
                currentBounds.x - handleSize / 2,
                currentBounds.y - handleSize / 2,
                handleSize,
                handleSize
            );
            // Top-right
            ctx.fillRect(
                currentBounds.x + currentBounds.width - handleSize / 2,
                currentBounds.y - handleSize / 2,
                handleSize,
                handleSize
            );
            // Bottom-left
            ctx.fillRect(
                currentBounds.x - handleSize / 2,
                currentBounds.y + currentBounds.height - handleSize / 2,
                handleSize,
                handleSize
            );
            // Bottom-right
            ctx.fillRect(
                currentBounds.x + currentBounds.width - handleSize / 2,
                currentBounds.y + currentBounds.height - handleSize / 2,
                handleSize,
                handleSize
            );
        }
    }, [currentBounds, captureMode]);

    // Capture region as image
    const captureRegion = useCallback(async (bounds: Bounds): Promise<string> => {
        if (!pageRef.current) return '';

        // Find the rendered PDF canvas within the page
        const pdfCanvas = pageRef.current.querySelector('canvas') as HTMLCanvasElement;
        if (!pdfCanvas) return '';

        // Get scaling factor between displayed size and actual canvas size
        const scaleX = pdfCanvas.width / pageRef.current.offsetWidth;
        const scaleY = pdfCanvas.height / pageRef.current.offsetHeight;

        // Create cropped canvas
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = bounds.width * scaleX;
        cropCanvas.height = bounds.height * scaleY;

        const ctx = cropCanvas.getContext('2d');
        if (!ctx) return '';

        ctx.drawImage(
            pdfCanvas,
            bounds.x * scaleX,
            bounds.y * scaleY,
            bounds.width * scaleX,
            bounds.height * scaleY,
            0,
            0,
            cropCanvas.width,
            cropCanvas.height
        );

        return cropCanvas.toDataURL('image/png');
    }, [pageRef]);

    // Extract text from region using text layer
    const extractTextFromRegion = useCallback((bounds: Bounds): string => {
        if (!pageRef.current) return '';

        const textLayer = pageRef.current.querySelector('.react-pdf__Page__textContent');
        if (!textLayer) return '';

        const textElements = textLayer.querySelectorAll('span');
        const texts: string[] = [];

        textElements.forEach((span) => {
            const rect = span.getBoundingClientRect();
            const pageRect = pageRef.current!.getBoundingClientRect();

            // Calculate span position relative to page
            const spanBounds = {
                x: rect.left - pageRect.left,
                y: rect.top - pageRect.top,
                width: rect.width,
                height: rect.height,
            };

            // Check if span intersects with selection bounds
            if (
                spanBounds.x < bounds.x + bounds.width &&
                spanBounds.x + spanBounds.width > bounds.x &&
                spanBounds.y < bounds.y + bounds.height &&
                spanBounds.y + spanBounds.height > bounds.y
            ) {
                const text = span.textContent?.trim();
                if (text) texts.push(text);
            }
        });

        return texts.join(' ');
    }, [pageRef]);

    // Mouse event handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (captureMode !== 'ready') return;

        const rect = canvasRef.current!.getBoundingClientRect();
        const point = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };

        setDrawingStart(point);
        setCurrentBounds({ ...point, width: 0, height: 0 });
    }, [captureMode, setDrawingStart]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!drawingStart || captureMode !== 'drawing') return;

        const rect = canvasRef.current!.getBoundingClientRect();
        const current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };

        setCurrentBounds({
            x: Math.min(drawingStart.x, current.x),
            y: Math.min(drawingStart.y, current.y),
            width: Math.abs(current.x - drawingStart.x),
            height: Math.abs(current.y - drawingStart.y),
        });
    }, [drawingStart, captureMode]);

    const handleMouseUp = useCallback(async () => {
        if (!currentBounds || captureMode !== 'drawing') return;

        // Minimum selection size
        if (currentBounds.width < 30 || currentBounds.height < 30) {
            setDrawingStart(null);
            setCurrentBounds(null);
            cancelCapture();
            return;
        }

        // Capture the region
        const imageDataUrl = await captureRegion(currentBounds);
        const extractedText = extractTextFromRegion(currentBounds);

        const context: CapturedContext = {
            id: '', // Will be set by store
            pdfId,
            pdfName,
            pageNumber,
            bounds: currentBounds,
            imageDataUrl,
            extractedText: extractedText || undefined,
            capturedAt: new Date(),
        };

        // Complete capture
        completeCapture(context);

        // Auto-open AI sidebar
        setAISidebarCollapsed(false);
        setAISidebarTab('agent');

        // Clear drawing state
        setDrawingStart(null);
        setCurrentBounds(null);
    }, [
        currentBounds,
        captureMode,
        captureRegion,
        extractTextFromRegion,
        pdfId,
        pdfName,
        pageNumber,
        completeCapture,
        setDrawingStart,
        cancelCapture,
        setAISidebarCollapsed,
        setAISidebarTab,
    ]);

    // Only show overlay when in capture mode
    if (captureMode === 'idle') return null;

    return (
        <canvas
            ref={canvasRef}
            className={`pdf-capture-overlay ${captureMode}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        />
    );
};

export default PDFCaptureOverlay;
