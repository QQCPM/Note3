import React, { useRef, useState, useEffect } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { useNotesStore } from '@/store/notesStore';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import CanvasToolbar from './CanvasToolbar';
import CanvasElement from './CanvasElement';
import CanvasConnections from './CanvasConnections';
import type { CanvasPosition } from '@/types/canvas';

const InfinityCanvas: React.FC = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<CanvasPosition>({ x: 0, y: 0 });

  const {
    elements,
    connections,
    activeTool,
    viewport,
    setViewport,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setIsPanning,
    isPanning,
    addElement,
    selectedElementIds,
  } = useCanvasStore();

  const { activeNoteId } = useNotesStore();

  const [dragStart, setDragStart] = useState<CanvasPosition | null>(null);
  const [scrollStart, setScrollStart] = useState<{ left: number; top: number } | null>(null);

  // Convert elements Map to Array for rendering
  const elementsArray = Array.from(elements.values()).filter(
    (el) => el.noteId === activeNoteId
  );

  const connectionsArray = Array.from(connections.values()).filter(
    (conn) => conn.noteId === activeNoteId
  );

  // Handle wheel zoom with cursor focus (exactly like prototype)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    const oldZoom = viewport.zoom;

    // Determine zoom direction (additive, not multiplicative)
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.5, Math.min(2.0, oldZoom + delta));

    if (newZoom === oldZoom) return; // No change

    const rect = viewportEl.getBoundingClientRect();

    // Mouse position relative to viewport
    const mouseRelX = e.clientX - rect.left;
    const mouseRelY = e.clientY - rect.top;

    // Calculate the canvas point under mouse BEFORE zoom (using old zoom)
    const canvasPointX = (viewportEl.scrollLeft + mouseRelX) / oldZoom;
    const canvasPointY = (viewportEl.scrollTop + mouseRelY) / oldZoom;

    // Update zoom
    setZoom(newZoom);

    // Calculate where that point should be AFTER zoom to stay under cursor
    requestAnimationFrame(() => {
      if (viewportEl) {
        const newScrollLeft = canvasPointX * newZoom - mouseRelX;
        const newScrollTop = canvasPointY * newZoom - mouseRelY;

        viewportEl.scrollLeft = newScrollLeft;
        viewportEl.scrollTop = newScrollTop;
      }
    });
  };

  // Handle zoom button clicks (centered zoom, matching prototype)
  const handleZoomIn = () => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    const oldZoom = viewport.zoom;
    const newZoom = Math.min(2.0, oldZoom + 0.1);

    if (newZoom === oldZoom) return;

    const rect = viewportEl.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const canvasPointX = (viewportEl.scrollLeft + centerX) / oldZoom;
    const canvasPointY = (viewportEl.scrollTop + centerY) / oldZoom;

    setZoom(newZoom);

    requestAnimationFrame(() => {
      if (viewportEl) {
        viewportEl.scrollLeft = canvasPointX * newZoom - centerX;
        viewportEl.scrollTop = canvasPointY * newZoom - centerY;
      }
    });
  };

  const handleZoomOut = () => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    const oldZoom = viewport.zoom;
    const newZoom = Math.max(0.5, oldZoom - 0.1);

    if (newZoom === oldZoom) return;

    const rect = viewportEl.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const canvasPointX = (viewportEl.scrollLeft + centerX) / oldZoom;
    const canvasPointY = (viewportEl.scrollTop + centerY) / oldZoom;

    setZoom(newZoom);

    requestAnimationFrame(() => {
      if (viewportEl) {
        viewportEl.scrollLeft = canvasPointX * newZoom - centerX;
        viewportEl.scrollTop = canvasPointY * newZoom - centerY;
      }
    });
  };

  const handleResetZoom = () => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    const oldZoom = viewport.zoom;

    resetZoom();

    const rect = viewportEl.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const canvasPointX = (viewportEl.scrollLeft + centerX) / oldZoom;
    const canvasPointY = (viewportEl.scrollTop + centerY) / oldZoom;

    requestAnimationFrame(() => {
      if (viewportEl) {
        viewportEl.scrollLeft = canvasPointX * 1.0 - centerX;
        viewportEl.scrollTop = canvasPointY * 1.0 - centerY;
      }
    });
  };

  // Mouse down - start panning or drawing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return; // Only on canvas background

    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    if (activeTool === 'hand' || e.button === 1) { // Middle click also pans
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setScrollStart({
        left: viewportEl.scrollLeft,
        top: viewportEl.scrollTop,
      });
      e.preventDefault();
    } else if (activeTool === 'note' || activeTool === 'text' || activeTool === 'mindmap' || activeTool === 'website') {
      // Create new element
      const rect = viewportEl.getBoundingClientRect();
      const x = (viewportEl.scrollLeft + e.clientX - rect.left) / viewport.zoom;
      const y = (viewportEl.scrollTop + e.clientY - rect.top) / viewport.zoom;

      if (!activeNoteId) return;

      let elementData: any;
      let size = { width: 300, height: 200 };

      switch (activeTool) {
        case 'note':
          elementData = { type: 'note', title: 'New Note', content: '', color: '#fef3c7' };
          break;
        case 'text':
          elementData = { type: 'text', content: 'New Text', fontSize: 16, color: '#ffffff' };
          size = { width: 200, height: 100 };
          break;
        case 'mindmap':
          elementData = {
            type: 'mindmap',
            title: 'New Mindmap',
            nodes: [{ id: '1', text: 'Center', position: { x: 150, y: 100 } }],
          };
          size = { width: 400, height: 300 };
          break;
        case 'website':
          const url = prompt('Enter website URL:');
          if (!url) return;
          elementData = { type: 'website', url, title: url };
          size = { width: 600, height: 400 };
          break;
      }

      addElement({
        type: activeTool,
        position: { x, y },
        size,
        noteId: activeNoteId,
        data: elementData,
      });
    }
  };

  // Mouse move - pan canvas
  const handleMouseMove = (e: React.MouseEvent) => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    // Update mouse position for UI
    const rect = viewportEl.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    if (isPanning && dragStart && scrollStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      viewportEl.scrollLeft = scrollStart.left - dx;
      viewportEl.scrollTop = scrollStart.top - dy;
    }
  };

  // Mouse up - stop panning
  const handleMouseUp = () => {
    setIsPanning(false);
    setDragStart(null);
    setScrollStart(null);
  };

  // Update cursor based on active tool
  const getCursorClass = () => {
    if (isPanning) return 'grabbing';
    if (activeTool === 'hand') return 'grab';
    if (activeTool === 'cursor') return 'default';
    if (activeTool === 'arrow') return 'crosshair';
    return 'crosshair';
  };

  return (
    <div className="infinity-canvas-container">
      <CanvasToolbar />

      {/* Zoom Controls */}
      <div className="canvas-zoom-controls">
        <button
          className="zoom-btn"
          onClick={handleZoomOut}
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <div className="zoom-level">{Math.round(viewport.zoom * 100)}%</div>
        <button
          className="zoom-btn"
          onClick={handleZoomIn}
          title="Zoom In"
          aria-label="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="zoom-btn"
          onClick={handleResetZoom}
          title="Reset Zoom"
          aria-label="Reset zoom"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={viewportRef}
        className={`canvas-viewport cursor-${getCursorClass()}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={canvasRef}
          className="canvas-surface"
          style={{
            transform: `scale(${viewport.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Grid Background */}
          <div className="canvas-grid" />

          {/* SVG Layer for Connections */}
          <CanvasConnections
            connections={connectionsArray}
            elements={elementsArray}
            zoom={viewport.zoom}
          />

          {/* Canvas Elements */}
          {elementsArray
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((element) => (
              <CanvasElement
                key={element.id}
                element={element}
                isSelected={selectedElementIds.has(element.id)}
              />
            ))}
        </div>
      </div>
    </div>
  );
};

export default InfinityCanvas;
