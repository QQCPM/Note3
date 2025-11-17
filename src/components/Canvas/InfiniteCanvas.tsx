import React, { useRef, useEffect, useState } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import CanvasElement from './CanvasElement';
import ConnectionLayer from './ConnectionLayer';
import CanvasToolbar from './CanvasToolbar';
import ZoomControls from './ZoomControls';
import CanvasModal from './CanvasModal';

const InfiniteCanvas: React.FC = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const {
    zoom,
    setZoom,
    selectedTool,
    elements,
    addElement,
  } = useCanvasStore();

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Initialize canvas with default elements
  useEffect(() => {
    if (elements.length === 0) {
      useCanvasStore.getState().initializeDefaultElements();
    }
  }, [elements.length]);

  // Center viewport on mount
  useEffect(() => {
    if (viewportRef.current && elements.length > 0) {
      viewportRef.current.scrollLeft = 2000;
      viewportRef.current.scrollTop = 2000;
    }
  }, [elements.length]);

  // Handle mouse wheel zoom - ONLY ZOOM, no scrolling
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const viewport = viewportRef.current;
    if (!viewport) return;

    // Store old zoom for calculation
    const oldZoom = zoom;

    // Calculate new zoom (scroll up = zoom in, scroll down = zoom out)
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.5, Math.min(2.0, zoom + delta));

    // Only update if zoom actually changed
    if (newZoom === zoom) {
      // At zoom limits (50% or 200%), do nothing - don't scroll canvas
      return;
    }

    setZoom(newZoom);

    // Zoom towards mouse cursor position
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate canvas point under mouse BEFORE zoom
    const canvasPointX = (viewport.scrollLeft + mouseX) / oldZoom;
    const canvasPointY = (viewport.scrollTop + mouseY) / oldZoom;

    // Calculate where that point should be AFTER zoom to stay under cursor
    const newScrollLeft = canvasPointX * newZoom - mouseX;
    const newScrollTop = canvasPointY * newZoom - mouseY;

    // Apply new scroll position
    viewport.scrollLeft = newScrollLeft;
    viewport.scrollTop = newScrollTop;
  };

  // Handle pan start
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Only pan if:
    // 1. Hand tool is selected AND
    // 2. Clicking on canvas background (not on elements)
    const isCanvasBackground =
      target.id === 'infinityCanvas' ||
      target.id === 'canvasElements' ||
      target.id === 'connectionSvg';

    if (selectedTool === 'hand' && isCanvasBackground) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      if (viewportRef.current) {
        setScrollStart({
          left: viewportRef.current.scrollLeft,
          top: viewportRef.current.scrollTop,
        });
      }
      e.preventDefault();
    }
  };

  // Handle pan move
  const handleMouseMove = (e: React.MouseEvent) => {
    // Update last mouse position for zoom
    setLastMousePos({ x: e.clientX, y: e.clientY });

    if (isPanning && viewportRef.current) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;

      viewportRef.current.scrollLeft = scrollStart.left - dx;
      viewportRef.current.scrollTop = scrollStart.top - dy;
    }
  };

  // Handle pan end
  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Handle canvas click to create new elements
  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Only create elements when clicking on canvas background
    const isCanvasBackground =
      target.id === 'infinityCanvas' ||
      target.id === 'canvasElements' ||
      target.id === 'connectionSvg';

    if (!isCanvasBackground) return;

    // Don't create if using hand, cursor, or arrow tool
    if (['hand', 'cursor', 'arrow'].includes(selectedTool)) return;

    // Calculate click position on canvas (accounting for zoom and scroll)
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert to canvas coordinates
    const canvasX = (viewport.scrollLeft + clickX) / zoom;
    const canvasY = (viewport.scrollTop + clickY) / zoom;

    // Create element based on selected tool
    const colors = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f472b6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newElement = {
      type: selectedTool as any,
      x: canvasX - 100, // Center on click
      y: canvasY - 100,
      width: selectedTool === 'note' ? 150 : 200,
      height: selectedTool === 'note' ? 150 : 200,
      content:
        selectedTool === 'note'
          ? 'New note...'
          : selectedTool === 'text'
          ? 'Type here...'
          : selectedTool === 'website'
          ? 'https://example.com'
          : selectedTool === 'mindmap'
          ? 'Central Idea'
          : '',
      color: selectedTool === 'note' ? randomColor : '#ffffff',
      label: selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1),
    };

    addElement(newElement);

    // Switch back to hand tool after creating
    useCanvasStore.getState().setSelectedTool('hand');
  };

  return (
    <div className="flex-1 relative overflow-hidden bg-[#0d1117]">
      {/* Canvas Toolbar */}
      <CanvasToolbar />

      {/* Zoom Controls */}
      <ZoomControls />

      {/* Viewport with scrolling */}
      <div
        ref={viewportRef}
        className="w-full h-full overflow-auto"
        style={{
          cursor: isPanning
            ? 'grabbing'
            : selectedTool === 'hand'
            ? 'grab'
            : 'default',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      >
        {/* Infinite Canvas Container */}
        <div
          id="infinityCanvas"
          className="relative"
          style={{
            width: '5000px',
            height: '5000px',
            backgroundImage:
              'radial-gradient(circle, #21262d 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          {/* SVG Connection Layer */}
          <ConnectionLayer />

          {/* Canvas Elements Container */}
          <div
            id="canvasElements"
            style={{
              position: 'absolute',
              inset: 0,
              transformOrigin: '0 0',
              transform: `scale(${zoom})`,
            }}
          >
            {elements.map((element) => (
              <CanvasElement key={element.id} element={element} />
            ))}
          </div>
        </div>
      </div>

      {/* Full-Screen Modal */}
      <CanvasModal />
    </div>
  );
};

export default InfiniteCanvas;
