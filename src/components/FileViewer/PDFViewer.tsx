import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import PDFCaptureToolbar from './PDFCaptureToolbar';
import PDFCaptureOverlay from './PDFCaptureOverlay';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  file: string | File | ArrayBuffer;
  pdfId?: string;
  pdfName?: string;
  onPageChange?: (page: number, totalPages: number) => void;
}

// Page wrapper component to handle refs and overlay
const PageWithOverlay: React.FC<{
  pageNumber: number;
  width?: number;
  pdfId: string;
  pdfName: string;
}> = ({ pageNumber, width, pdfId, pdfName }) => {
  const pageRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={pageRef} className="relative">
      <Page
        pageNumber={pageNumber}
        width={width}
        className="shadow-lg"
        renderTextLayer={true}
        renderAnnotationLayer={true}
        loading={
          <div className="flex items-center justify-center h-[400px] bg-gray-800/50 rounded">
            <span className="text-gray-500 text-sm">Loading page {pageNumber}...</span>
          </div>
        }
      />
      <PDFCaptureOverlay
        pageNumber={pageNumber}
        pageRef={pageRef}
        pdfId={pdfId}
        pdfName={pdfName}
      />
    </div>
  );
};

const PDFViewer: React.FC<PDFViewerProps> = ({
  file,
  pdfId = 'unknown',
  pdfName = 'Document',
  onPageChange
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(0.7); // Default to 70%
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container width for responsive scaling
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 48); // Subtract padding
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Handle pinch-to-zoom gesture (trackpad pinch appears as wheel + ctrlKey)
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      // deltaY is positive when zooming out (pinch in), negative when zooming in (pinch out)
      const zoomSensitivity = 0.005;
      const delta = -e.deltaY * zoomSensitivity;
      setScale(prev => {
        const newScale = prev + delta;
        // Clamp between 0.25 (25%) and 3.0 (300%)
        return Math.min(Math.max(newScale, 0.25), 3.0);
      });
    }
  }, []);

  // Attach wheel event listener for pinch-to-zoom
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      // passive: false is required to call preventDefault()
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setLoading(false);
      setError(null);
      onPageChange?.(1, numPages);
    },
    [onPageChange]
  );

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message);
    setLoading(false);
  }, []);

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.1, 3.0));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.1, 0.25));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1.0);
  }, []);

  // Calculate page width to fit container
  const pageWidth = containerWidth > 0 ? containerWidth * scale : undefined;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] relative">
      {/* Minimal Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-gray-800">
        <span className="text-sm text-gray-400">
          {loading ? 'Loading...' : `${numPages} pages`}
        </span>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.25}
            className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-400 hover:text-white transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-gray-500 min-w-[40px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-400 hover:text-white transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={resetZoom}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Fit to width"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* PDF Content - Continuous Scroll */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-[#1a1a1a] relative"
      >
        {error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-400 mb-2">Failed to load PDF</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          </div>
        ) : (
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-64">
                <div className="animate-pulse text-gray-400">Loading PDF...</div>
              </div>
            }
            className="flex flex-col items-center py-4 gap-4"
          >
            {/* Render all pages with capture overlay */}
            {Array.from(new Array(numPages), (_, index) => (
              <PageWithOverlay
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                width={pageWidth}
                pdfId={pdfId}
                pdfName={pdfName}
              />
            ))}
          </Document>
        )}
      </div>

      {/* Floating Capture Toolbar */}
      {!loading && !error && (
        <PDFCaptureToolbar pdfId={pdfId} pdfName={pdfName} />
      )}
    </div>
  );
};

export default PDFViewer;
