import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { useDragStore } from '@/store/dragStore';
import { getBlocksByNote } from '@/utils/tauri';
import type { TextBlockData, HeadingBlockData } from '@/types';
import CanvasElement from './CanvasElement';
import ConnectionLayer from './ConnectionLayer';
import CanvasToolbar from './CanvasToolbar';
import ZoomControls from './ZoomControls';
import CanvasModal from './CanvasModal';

const InfiniteCanvas: React.FC = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const { isDragging, draggedNote, mousePosition } = useDragStore();
  const {
    zoom,
    panX,
    panY,
    selectedTool,
    elements,
    addElement,
    setPan,
    setZoom,
    setSelectedTool
  } = useCanvasStore();

  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Helper: Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return { x: 0, y: 0 };

    const rect = viewport.getBoundingClientRect();
    const viewportCenterX = rect.width / 2;
    const viewportCenterY = rect.height / 2;

    // Mouse position relative to viewport top-left
    const viewportMouseX = screenX - rect.left;
    const viewportMouseY = screenY - rect.top;

    // Mouse position relative to viewport center
    const centerRelX = viewportMouseX - viewportCenterX;
    const centerRelY = viewportMouseY - viewportCenterY;

    // Convert to canvas coordinates
    // CanvasX = CameraCenter + (Distance from Center) / Zoom
    const canvasX = panX + centerRelX / zoom;
    const canvasY = panY + centerRelY / zoom;

    return { x: canvasX, y: canvasY };
  }, [panX, panY, zoom]);

  // Handle mouse wheel zoom - Zoom toward cursor position
  const handleWheel = useCallback((e: WheelEvent | React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const viewport = viewportRef.current;
    if (!viewport) return;

    // Calculate new zoom
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.1, Math.min(5.0, zoom + delta));

    if (newZoom === zoom) return;

    // Get mouse position relative to viewport center
    const rect = viewport.getBoundingClientRect();
    const viewportCenterX = rect.width / 2;
    const viewportCenterY = rect.height / 2;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const centerRelX = mouseX - viewportCenterX;
    const centerRelY = mouseY - viewportCenterY;

    // Calculate the canvas point currently under the mouse
    // Point = Pan + Offset / OldZoom
    const canvasPointX = panX + centerRelX / zoom;
    const canvasPointY = panY + centerRelY / zoom;

    // Calculate new Pan position so that the same canvas point remains under the mouse
    // CanvasPoint = NewPan + Offset / NewZoom
    // NewPan = CanvasPoint - Offset / NewZoom
    const newPanX = canvasPointX - centerRelX / newZoom;
    const newPanY = canvasPointY - centerRelY / newZoom;

    setPan(newPanX, newPanY);
    setZoom(newZoom);
  }, [zoom, panX, panY, setPan, setZoom]);

  // Add wheel event listener
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.addEventListener('wheel', handleWheel as any, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheel as any);
    };
  }, [handleWheel]);

  // Initialize canvas with default elements
  useEffect(() => {
    if (elements.length === 0) {
      useCanvasStore.getState().initializeDefaultElements();
    }
  }, [elements.length]);

  // Handle pan start
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isCanvasBackground =
      target.id === 'infinityCanvas' ||
      target.id === 'canvasElements' ||
      target.id === 'connectionSvg' ||
      target.classList.contains('canvas-viewport');

    // Middle mouse button or Space+Click or Hand tool
    if (e.button === 1 || (selectedTool === 'hand' && isCanvasBackground)) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  // Handle pan move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;

      // Update pan position
      // Moving mouse right (positive dx) should move camera left (decrease panX)
      // Adjusted by zoom level
      setPan(panX - dx / zoom, panY - dy / zoom);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  // Handle pan end and drop handling
  const handleMouseUp = async () => {
    setIsPanning(false);

    // Handle drop if there's an active drag
    if (isDragging && draggedNote && mousePosition) {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const isOverCanvas =
        mousePosition.x >= rect.left &&
        mousePosition.x <= rect.right &&
        mousePosition.y >= rect.top &&
        mousePosition.y <= rect.bottom;

      if (isOverCanvas) {
        const { x: canvasX, y: canvasY } = screenToCanvas(mousePosition.x, mousePosition.y);

        // Fetch note blocks
        let noteContent = draggedNote.title;
        try {
          const blocks = await getBlocksByNote(draggedNote.noteId);
          const contentParts = blocks
            .filter(block => block.type === 'text' || block.type === 'heading1' || block.type === 'heading2')
            .map(block => {
              const blockData = block.data as TextBlockData | HeadingBlockData;
              return blockData.content;
            });

          if (contentParts.length > 0) {
            noteContent = contentParts.join('\n\n');
          }
        } catch (error) {
          console.error('Failed to fetch note blocks:', error);
        }

        const colors = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f472b6'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const newElement = {
          type: 'note' as const,
          x: canvasX - 100,
          y: canvasY - 75,
          width: 200,
          height: 150,
          content: noteContent,
          color: randomColor,
          label: draggedNote.title,
          noteId: draggedNote.noteId,
        };

        addElement(newElement);
      }
    }
  };

  // Handle canvas click to create new elements
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isPanning) return; // Don't create if we were just panning

    const target = e.target as HTMLElement;
    const isCanvasBackground =
      target.id === 'infinityCanvas' ||
      target.id === 'canvasElements' ||
      target.id === 'connectionSvg' ||
      target.classList.contains('canvas-viewport');

    if (!isCanvasBackground) return;
    if (['hand', 'cursor', 'arrow'].includes(selectedTool)) return;

    const { x: canvasX, y: canvasY } = screenToCanvas(e.clientX, e.clientY);

    const colors = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f472b6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const elementWidth = selectedTool === 'note' ? 150 : 200;
    const elementHeight = selectedTool === 'note' ? 150 : 200;

    const newElement = {
      type: selectedTool as any,
      x: canvasX - elementWidth / 2,
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
    setSelectedTool('hand');
  };

  return (
    <div className="flex-1 relative overflow-hidden bg-[#0d1117]">
      <CanvasToolbar />
      <ZoomControls />

      {/* Viewport - Flex container to center the world */}
      <div
        ref={viewportRef}
        className="w-full h-full canvas-viewport flex items-center justify-center overflow-hidden cursor-default"
        style={{
          cursor: selectedTool === 'hand' ? (isPanning ? 'grabbing' : 'grab') : 'default',
          // Show drop zone indicator
          outline: isDragging ? '2px dashed #58a6ff' : 'none',
          outlineOffset: isDragging ? '-4px' : '0',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      >
        {/* World Container - Transformed to show correct view */}
        <div
          id="infinityCanvas"
          className="relative"
          style={{
            width: 0,
            height: 0,
            overflow: 'visible',
            transform: `scale(${zoom}) translate(${-panX}px, ${-panY}px)`,
            transformOrigin: 'center center', // Important: Scale around the center (which is the viewport center)
            willChange: 'transform',
          }}
        >
          {/* Grid Background - Needs to be large enough or repeated */}
          {/* Since width/height is 0, we need a large background div positioned relative to the world origin */}
          <div
            style={{
              position: 'absolute',
              left: -50000,
              top: -50000,
              width: 100000,
              height: 100000,
              backgroundImage: 'radial-gradient(circle, #21262d 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              pointerEvents: 'none', // Don't block clicks
              opacity: 0.5
            }}
          />

          <ConnectionLayer />

          {/* Canvas Elements */}
          <div id="canvasElements" className="absolute inset-0 overflow-visible">
            {elements.map((element) => (
              <CanvasElement key={element.id} element={element} />
            ))}
          </div>
        </div>
      </div>

      <CanvasModal />
    </div>
  );
};

export default InfiniteCanvas;


