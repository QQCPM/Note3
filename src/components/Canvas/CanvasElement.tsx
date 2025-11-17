import React, { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import type { CanvasElement as CanvasElementType, CanvasPosition } from '@/types/canvas';
import { Trash2, Edit3, Maximize2 } from 'lucide-react';

interface CanvasElementProps {
  element: CanvasElementType;
  isSelected: boolean;
  onClick?: () => void;
}

const CanvasElement: React.FC<CanvasElementProps> = ({ element, isSelected, onClick }) => {
  const {
    activeTool,
    updateElement,
    deleteElement,
    selectElement,
    deselectAll,
    moveElement,
    resizeElement,
  } = useCanvasStore();

  const elementRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<CanvasPosition | null>(null);
  const [positionStart, setPositionStart] = useState<CanvasPosition | null>(null);
  const [sizeStart, setSizeStart] = useState<{ width: number; height: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool !== 'cursor') return;

    e.stopPropagation();

    // Select element
    if (!isSelected) {
      selectElement(element.id, e.shiftKey);
    }

    // Start dragging
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPositionStart({ ...element.position });
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger modal on click if not dragging
    if (!isDragging && !isResizing && onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (activeTool !== 'cursor') return;

    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setSizeStart({ ...element.size });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStart && positionStart) {
        const dx = (e.clientX - dragStart.x) / useCanvasStore.getState().viewport.zoom;
        const dy = (e.clientY - dragStart.y) / useCanvasStore.getState().viewport.zoom;

        moveElement(element.id, {
          x: positionStart.x + dx,
          y: positionStart.y + dy,
        });
      } else if (isResizing && dragStart && sizeStart) {
        const dx = (e.clientX - dragStart.x) / useCanvasStore.getState().viewport.zoom;
        const dy = (e.clientY - dragStart.y) / useCanvasStore.getState().viewport.zoom;

        resizeElement(element.id, {
          width: Math.max(100, sizeStart.width + dx),
          height: Math.max(80, sizeStart.height + dy),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setDragStart(null);
      setPositionStart(null);
      setSizeStart(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, positionStart, sizeStart, element.id]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElement(element.id);
  };

  const renderContent = () => {
    const { data } = element;

    switch (data.type) {
      case 'note':
        return (
          <div className="canvas-element-note">
            <div className="canvas-element-header">
              <div className="canvas-element-title">{data.title}</div>
            </div>
            <div className="canvas-element-content">
              {data.content || 'Empty note'}
            </div>
          </div>
        );

      case 'text':
        return (
          <div
            className="canvas-element-text"
            style={{
              fontSize: data.fontSize || 16,
              fontWeight: data.fontWeight || 'normal',
              color: data.color || '#ffffff',
            }}
          >
            {data.content}
          </div>
        );

      case 'mindmap':
        return (
          <div className="canvas-element-mindmap">
            <div className="canvas-element-header">
              <div className="canvas-element-title">{data.title}</div>
            </div>
            <div className="canvas-element-mindmap-content">
              {data.nodes.map((node) => (
                <div
                  key={node.id}
                  className="mindmap-node"
                  style={{
                    position: 'absolute',
                    left: node.position.x,
                    top: node.position.y,
                  }}
                >
                  {node.text}
                </div>
              ))}
            </div>
          </div>
        );

      case 'website':
        return (
          <div className="canvas-element-website">
            <div className="canvas-element-header">
              <div className="canvas-element-title">{data.title || data.url}</div>
            </div>
            <iframe
              src={data.url}
              className="canvas-element-iframe"
              title={data.title || data.url}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        );

      case 'drawing':
        return (
          <div className="canvas-element-drawing">
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${element.size.width} ${element.size.height}`}
            >
              {data.paths.map((path) => (
                <polyline
                  key={path.id}
                  points={path.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  stroke={path.color}
                  strokeWidth={path.width}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          </div>
        );

      default:
        return <div>Unknown element type</div>;
    }
  };

  // Handle label input change
  const [label, setLabel] = React.useState(element.data.type === 'note' ? element.data.title : 'Untitled');
  const [labelWidth, setLabelWidth] = React.useState(200);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLabel = e.target.value;
    setLabel(newLabel);

    // Auto-resize input to fit text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      context.font = '600 28px Inter';
      const width = context.measureText(newLabel || 'Untitled').width;
      setLabelWidth(Math.max(200, width + 48));
    }

    // Update element data
    if (element.data.type === 'note') {
      updateElement(element.id, {
        data: { ...element.data, title: newLabel }
      });
    }
  };

  return (
    <div
      ref={elementRef}
      className={`canvas-element ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'absolute',
        left: element.position.x,
        top: element.position.y,
        width: element.size.width,
        height: element.size.height,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        zIndex: element.zIndex,
        backgroundColor: element.data.type === 'note' ? element.data.color : undefined,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {/* Glassmorphic Label Bar */}
      <div
        className="canvas-element-label-bar"
        style={{ width: labelWidth }}
      >
        <input
          type="text"
          value={label}
          onChange={handleLabelChange}
          onClick={(e) => e.stopPropagation()}
          placeholder="Untitled"
          className="canvas-element-label-input"
        />
      </div>

      {renderContent()}

      {/* Selection Border */}
      {isSelected && (
        <>
          <div className="canvas-element-selection-border" />

          {/* Resize Handle */}
          {activeTool === 'cursor' && (
            <div
              className="canvas-element-resize-handle"
              onMouseDown={handleResizeMouseDown}
            >
              <Maximize2 size={12} />
            </div>
          )}

          {/* Action Buttons */}
          <div className="canvas-element-actions">
            <button
              className="canvas-element-action-btn"
              onClick={handleDelete}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CanvasElement;
