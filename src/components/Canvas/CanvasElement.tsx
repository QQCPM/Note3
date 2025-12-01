import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useCanvasStore, CanvasElement as CanvasElementType } from '@/store/canvasStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface CanvasElementProps {
  element: CanvasElementType;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

const CanvasElement: React.FC<CanvasElementProps> = React.memo(({ element, isSelected: _isSelected, onClick }) => {
  const {
    selectedTool,
    updateElement,
    setEditingElement,
    connectingFrom,
    setConnectingFrom,
    addConnection,
  } = useCanvasStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const elementRef = useRef<HTMLDivElement>(null);

  // Handle element click - memoized to prevent recreation
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    // If an external onClick handler is provided, use it (e.g. for InfinityCanvas)
    if (onClick) {
      onClick(e);
      return;
    }

    if (selectedTool === 'cursor') {
      // Cursor tool: Single-click to open full-screen modal
      setEditingElement(element);
    } else if (selectedTool === 'arrow') {
      // Arrow tool: Create connection
      if (connectingFrom) {
        // Second click - create connection
        if (connectingFrom !== element.id) {
          addConnection(connectingFrom, element.id);
        }
        setConnectingFrom(null);
        // Remove outline
        if (elementRef.current) {
          elementRef.current.style.outline = '';
        }
      } else {
        // First click - select starting element
        setConnectingFrom(element.id);
        // Add outline to show selected
        if (elementRef.current) {
          elementRef.current.style.outline = '2px solid #58a6ff';
        }
      }
    }
  }, [selectedTool, connectingFrom, element.id, setEditingElement, setConnectingFrom, addConnection, onClick, element]);

  // Handle double-click to open modal (for hand tool and others)
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Open modal on double-click with hand tool or other tools (except cursor which uses single-click)
    if (selectedTool !== 'cursor') {
      setEditingElement(element);
    }
  }, [selectedTool, element, setEditingElement]);

  // Handle drag start (hand tool only)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (selectedTool !== 'hand') return;
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;

    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: element.x, y: element.y, width: element.width, height: element.height });
    e.stopPropagation();
  };

  // Handle resize start
  const handleResizeStart = (handle: 'nw' | 'ne' | 'sw' | 'se') => (e: React.MouseEvent) => {
    if (selectedTool !== 'hand') return;

    e.stopPropagation();
    e.preventDefault();

    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: element.x, y: element.y, width: element.width, height: element.height });
  };

  // Handle mouse move (drag or resize)
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;

        const zoom = useCanvasStore.getState().zoom;
        updateElement(element.id, {
          x: elementStart.x + dx / zoom,
          y: elementStart.y + dy / zoom,
        });
      } else if (isResizing && resizeHandle) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        const zoom = useCanvasStore.getState().zoom;

        let newX = elementStart.x;
        let newY = elementStart.y;
        let newWidth = elementStart.width;
        let newHeight = elementStart.height;

        // Calculate new dimensions based on handle
        switch (resizeHandle) {
          case 'se': // Bottom-right
            newWidth = Math.max(100, elementStart.width + dx / zoom);
            newHeight = Math.max(100, elementStart.height + dy / zoom);
            break;
          case 'sw': // Bottom-left
            newWidth = Math.max(100, elementStart.width - dx / zoom);
            newHeight = Math.max(100, elementStart.height + dy / zoom);
            if (newWidth >= 100) {
              newX = elementStart.x + dx / zoom;
            }
            break;
          case 'ne': // Top-right
            newWidth = Math.max(100, elementStart.width + dx / zoom);
            newHeight = Math.max(100, elementStart.height - dy / zoom);
            if (newHeight >= 100) {
              newY = elementStart.y + dy / zoom;
            }
            break;
          case 'nw': // Top-left
            newWidth = Math.max(100, elementStart.width - dx / zoom);
            newHeight = Math.max(100, elementStart.height - dy / zoom);
            if (newWidth >= 100) {
              newX = elementStart.x + dx / zoom;
            }
            if (newHeight >= 100) {
              newY = elementStart.y + dy / zoom;
            }
            break;
        }

        updateElement(element.id, {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, elementStart, element.id, resizeHandle]);

  // Update label - memoized
  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateElement(element.id, { label: e.target.value });
  }, [element.id, updateElement]);

  // Memoize markdown plugins array to prevent recreation
  const markdownPlugins = useMemo(() => ({
    remark: [remarkGfm, remarkMath],
    rehype: [rehypeKatex]
  }), []);

  // Render element content based on type - memoized for performance
  const renderContent = useMemo(() => {
    switch (element.type) {
      case 'note':
        return (
          <div className="flex flex-col gap-2 p-4 h-full overflow-auto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7, flexShrink: 0 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <div className="flex-1 text-[#0d1117] text-sm overflow-auto prose prose-sm max-w-none prose-headings:text-[#0d1117] prose-p:text-[#0d1117] prose-strong:text-[#0d1117] prose-code:text-[#0d1117] prose-pre:bg-gray-100 prose-pre:text-[#0d1117]">
              <ReactMarkdown
                remarkPlugins={markdownPlugins.remark}
                rehypePlugins={markdownPlugins.rehype}
              >
                {element.content}
              </ReactMarkdown>
            </div>
          </div>
        );

      case 'drawing':
        if (element.drawing) {
          return <img src={element.drawing} className="w-full h-full object-contain" alt="Drawing" />;
        }
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
            </svg>
          </div>
        );

      case 'text':
        return (
          <div className="p-4 h-full overflow-hidden text-gray-800 text-sm">
            {element.content}
          </div>
        );

      case 'website':
        return (
          <div className="p-3 h-full flex flex-col gap-2 bg-blue-50">
            <div className="text-blue-600 text-xs break-all">{element.content}</div>
            <div className="text-gray-500 text-[10px]">Website Block</div>
          </div>
        );

      case 'mindmap':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" className="mx-auto mb-1">
                <circle cx="12" cy="12" r="3"></circle>
                <circle cx="19" cy="6" r="2"></circle>
                <circle cx="19" cy="18" r="2"></circle>
                <circle cx="5" cy="6" r="2"></circle>
                <circle cx="5" cy="18" r="2"></circle>
                <line x1="14" y1="11" x2="17.5" y2="7.5"></line>
                <line x1="14" y1="13" x2="17.5" y2="16.5"></line>
                <line x1="10" y1="11" x2="6.5" y2="7.5"></line>
                <line x1="10" y1="13" x2="6.5" y2="16.5"></line>
              </svg>
              <div className="text-purple-700 font-semibold text-xs">{element.content}</div>
            </div>
          </div>
        );

      default:
        return null;
    }
  }, [element.type, element.content, element.drawing, element.color]);

  // Get background style based on type
  const getBackgroundStyle = () => {
    switch (element.type) {
      case 'note':
        return { backgroundColor: element.color };
      case 'drawing':
        return { backgroundColor: '#ffffff', border: '2px solid #30363d' };
      case 'text':
        return { backgroundColor: '#ffffff', border: '2px solid #e5e7eb' };
      case 'website':
        return { backgroundColor: '#eff6ff', border: '2px solid #93c5fd' };
      case 'mindmap':
        return {
          background: 'linear-gradient(135deg, #fae8ff 0%, #fbcfe8 100%)',
          border: '2px solid #d8b4fe',
          borderRadius: '50%',
        };
      default:
        return {};
    }
  };

  return (
    <>
      {/* Glassmorphic Label Bar */}
      <div
        className="absolute z-10"
        style={{
          left: `${element.x + element.width / 2}px`,
          top: `${element.y - 40}px`,
          transform: 'translateX(-50%)',
        }}
      >
        <div
          style={{
            background: 'rgba(22, 27, 34, 0.75)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(88, 166, 255, 0.3)',
            borderRadius: '32px',
            padding: '8px 24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            minWidth: '160px',
          }}
        >
          <input
            type="text"
            value={element.label}
            onChange={handleLabelChange}
            onClick={(e) => e.stopPropagation()}
            placeholder="Label..."
            className="bg-transparent border-none outline-none text-white text-center font-semibold w-full"
            style={{
              fontSize: '14px', // Smaller, more readable size
              minWidth: '100px',
            }}
          />
        </div>
      </div>

      {/* Canvas Element */}
      <div
        ref={elementRef}
        className="absolute rounded-xl shadow-lg transition-shadow hover:shadow-xl select-none"
        style={{
          left: `${element.x}px`,
          top: `${element.y}px`,
          width: `${element.width}px`,
          height: `${element.height}px`,
          cursor: selectedTool === 'hand' ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
          zIndex: isDragging || isResizing ? 1000 : 'auto',
          pointerEvents: 'auto', // Re-enable pointer events for elements (parent has none)
          ...getBackgroundStyle(),
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {renderContent}

        {/* Resize Handles (only visible with hand tool and on hover) */}
        {selectedTool === 'hand' && (
          <>
            <div
              className="resize-handle absolute w-2.5 h-2.5 bg-blue-500 border-2 border-white rounded-full opacity-0 hover:opacity-100 transition-opacity"
              style={{ top: '-5px', left: '-5px', cursor: 'nw-resize', zIndex: 10 }}
              onMouseDown={handleResizeStart('nw')}
            />
            <div
              className="resize-handle absolute w-2.5 h-2.5 bg-blue-500 border-2 border-white rounded-full opacity-0 hover:opacity-100 transition-opacity"
              style={{ top: '-5px', right: '-5px', cursor: 'ne-resize', zIndex: 10 }}
              onMouseDown={handleResizeStart('ne')}
            />
            <div
              className="resize-handle absolute w-2.5 h-2.5 bg-blue-500 border-2 border-white rounded-full opacity-0 hover:opacity-100 transition-opacity"
              style={{ bottom: '-5px', left: '-5px', cursor: 'sw-resize', zIndex: 10 }}
              onMouseDown={handleResizeStart('sw')}
            />
            <div
              className="resize-handle absolute w-2.5 h-2.5 bg-blue-500 border-2 border-white rounded-full opacity-0 hover:opacity-100 transition-opacity"
              style={{ bottom: '-5px', right: '-5px', cursor: 'se-resize', zIndex: 10 }}
              onMouseDown={handleResizeStart('se')}
            />
          </>
        )}
      </div>
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if element actually changed
  return (
    prevProps.element.id === nextProps.element.id &&
    prevProps.element.x === nextProps.element.x &&
    prevProps.element.y === nextProps.element.y &&
    prevProps.element.width === nextProps.element.width &&
    prevProps.element.height === nextProps.element.height &&
    prevProps.element.content === nextProps.element.content &&
    prevProps.element.color === nextProps.element.color &&
    prevProps.element.label === nextProps.element.label &&
    prevProps.element.drawing === nextProps.element.drawing
  );
});

export default CanvasElement;
