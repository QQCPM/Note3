import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store';
import CanvasElement from './CanvasElement';
import ConnectionLayer from './ConnectionLayer';
import CanvasToolbar from './CanvasToolbar';
import ZoomControls from './ZoomControls';
import CanvasModal from './CanvasModal';

const InfiniteCanvas: React.FC = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const { canvasMode } = useUIStore();
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
  const hasInitializedRef = useRef(false);

  // Handle mouse wheel zoom - Zoom toward cursor position
  // CRITICAL: Always prevent default scrolling - wheel events should ONLY zoom, never scroll
  // Defined early so it can be used in useEffect below
  const handleWheel = useCallback((e: WheelEvent | React.WheelEvent) => {
    // ALWAYS prevent default scrolling behavior first
    e.preventDefault();
    e.stopPropagation();

    const viewport = viewportRef.current;
    if (!viewport) return;

    // Store old zoom BEFORE calculating new zoom
    const currentZoom = useCanvasStore.getState().zoom;
    const oldZoom = currentZoom;

    // Calculate new zoom (scroll up = zoom in, scroll down = zoom out)
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.5, Math.min(2.0, currentZoom + delta));

    // Only update if zoom actually changed
    if (newZoom === oldZoom) {
      // At zoom limits (50% or 200%), do nothing
      return;
    }

    // Get mouse position relative to viewport
    const rect = viewport.getBoundingClientRect();
    const mouseRelX = e.clientX - rect.left;
    const mouseRelY = e.clientY - rect.top;

    // Calculate the canvas point under mouse BEFORE zoom (using oldZoom)
    // Element coordinate = (scroll + mouse) / zoom
    const elementX = (viewport.scrollLeft + mouseRelX) / oldZoom;
    const elementY = (viewport.scrollTop + mouseRelY) / oldZoom;

    // Calculate new scroll position to keep the same element point under the cursor
    // After zoom: newScroll + mouse = element * newZoom
    // Therefore: newScroll = element * newZoom - mouse
    const newScrollLeft = elementX * newZoom - mouseRelX;
    const newScrollTop = elementY * newZoom - mouseRelY;

    // CRITICAL: Set scroll position FIRST, synchronously
    // This prevents visual jumping by updating scroll BEFORE the zoom transform changes
    viewport.scrollLeft = newScrollLeft;
    viewport.scrollTop = newScrollTop;

    // THEN update zoom state (this triggers React re-render)
    useCanvasStore.getState().setZoom(newZoom);
  }, []); // Empty deps - we use getState() inside to get current values

  // Initialize canvas with default elements
  useEffect(() => {
    if (elements.length === 0) {
      useCanvasStore.getState().initializeDefaultElements();
    }
  }, [elements.length]);

  // Add wheel event listener with passive: false to ensure preventDefault always works
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Add native event listener with passive: false to ensure preventDefault works
    // This prevents ALL scrolling - wheel events will ONLY zoom
    viewport.addEventListener('wheel', handleWheel as any, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', handleWheel as any);
    };
  }, [handleWheel]); // Re-add when handleWheel changes

  // Center viewport ONLY when first entering canvas mode (not on zoom changes!)
  // This prevents interference with zoom-to-cursor functionality
  useEffect(() => {
    if (viewportRef.current && canvasMode === 'canvas' && !hasInitializedRef.current) {
      // Canvas size is now dynamic: 5000 * zoom
      // Center of canvas at current zoom: (2500 * zoom, 2500 * zoom)
      // To center viewport: scrollLeft = canvasCenter - viewportWidth / 2
      const viewport = viewportRef.current;
      const currentZoom = useCanvasStore.getState().zoom;
      const canvasCenter = 2500 * currentZoom;
      const centerX = canvasCenter - viewport.clientWidth / 2;
      const centerY = canvasCenter - viewport.clientHeight / 2;

      viewport.scrollLeft = Math.max(0, centerX);
      viewport.scrollTop = Math.max(0, centerY);
      hasInitializedRef.current = true;
    }

    // Reset when leaving canvas mode
    if (canvasMode !== 'canvas') {
      hasInitializedRef.current = false;
    }
  }, [canvasMode]); // ONLY depend on canvasMode, NOT zoom!

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
    // The 5000x5000 canvas is unscaled, but the elements container inside is scaled by zoom
    // scrollLeft/scrollTop are in the unscaled canvas coordinate system
    // clickX/clickY are in viewport pixels
    // Since the elements container is scaled, we need to divide clickX/clickY by zoom
    // to get the position in the unscaled canvas coordinate system
    const canvasX = viewport.scrollLeft + clickX / zoom;
    const canvasY = viewport.scrollTop + clickY / zoom;

    // Create element based on selected tool
    const colors = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f472b6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Calculate element dimensions
    const elementWidth = selectedTool === 'note' ? 150 : 200;
    const elementHeight = selectedTool === 'note' ? 150 : 200;

    const newElement = {
      type: selectedTool as any,
      x: canvasX - elementWidth / 2, // Center on click precisely
      y: canvasY - elementHeight / 2,
      width: elementWidth,
      height: elementHeight,
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

      {/* Viewport - scrolling disabled, only zoom allowed (panning still works programmatically) */}
      <div
        ref={viewportRef}
        className="w-full h-full canvas-viewport"
        style={{
          overflow: 'auto', // Needed for programmatic scrolling (panning)
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      >
        {/* Infinite Canvas Container - Size scales with zoom for proper scrolling */}
        <div
          id="infinityCanvas"
          className="relative"
          style={{
            width: `${5000 * zoom}px`,
            height: `${5000 * zoom}px`,
            backgroundImage:
              'radial-gradient(circle, #21262d 1px, transparent 1px)',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
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
