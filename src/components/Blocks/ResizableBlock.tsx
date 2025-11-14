import React, { useState, useEffect, useRef } from 'react';
import { updateBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import type { Block } from '@/types';

interface ResizableBlockProps {
  block: Block;
  children: React.ReactNode;
  minWidth?: number;
  minHeight?: number;
}

const ResizableBlock: React.FC<ResizableBlockProps> = ({ 
  block, 
  children,
  minWidth = 300,
  minHeight = 300 // Increased from 200 to 300 for better usability
}) => {
  const { updateBlock: updateBlockInStore } = useBlocksStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCorner, setResizeCorner] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startDimensions, setStartDimensions] = useState({ width: 0, height: 0 });

  // Get current height from block data or use default
  const getCurrentHeight = (): number => {
    const data = block.data as any;
    return data.customHeight || 500; // Increased default from 400 to 500
  };

  const [widthPx, setWidthPx] = useState<number | null>(null);
  const [heightPx, setHeightPx] = useState(getCurrentHeight());

  useEffect(() => {
    setHeightPx(getCurrentHeight());
  }, [(block.data as any).customHeight]);

  const handleCornerMouseDown = (corner: 'tl' | 'tr' | 'bl' | 'br') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    
    setIsResizing(true);
    setResizeCorner(corner);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartDimensions({ width: rect.width, height: heightPx });
  };

  useEffect(() => {
    if (!isResizing || !resizeCorner) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;

      let newWidth = startDimensions.width;
      let newHeight = startDimensions.height;

      // Calculate new dimensions based on corner
      switch(resizeCorner) {
        case 'br': // Bottom-right: increase both
          newWidth = startDimensions.width + deltaX;
          newHeight = startDimensions.height + deltaY;
          break;
        case 'bl': // Bottom-left: decrease width, increase height
          newWidth = startDimensions.width - deltaX;
          newHeight = startDimensions.height + deltaY;
          break;
        case 'tr': // Top-right: increase width, decrease height
          newWidth = startDimensions.width + deltaX;
          newHeight = startDimensions.height - deltaY;
          break;
        case 'tl': // Top-left: decrease both
          newWidth = startDimensions.width - deltaX;
          newHeight = startDimensions.height - deltaY;
          break;
      }

      // Apply constraints
      const maxWidth = Math.min(1400, window.innerWidth - 200); // Max 1400px or window width - 200px
      const maxHeight = 1200; // Max 1200px
      newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
      newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

      setWidthPx(newWidth);
      setHeightPx(newHeight);
    };

    const handleMouseUp = async () => {
      setIsResizing(false);
      setResizeCorner(null);

      // Save to database
      if (widthPx !== null) {
        try {
          const newData: any = { 
            ...block.data, 
            customWidth: Math.round(widthPx),
            customHeight: Math.round(heightPx)
          };
          const updated = await updateBlock(block.id, newData);
          updateBlockInStore(block.id, updated);
        } catch (error) {
          console.error('Failed to update block dimensions:', error);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeCorner, startPos, startDimensions, widthPx, heightPx, block.id, block.data, updateBlockInStore, minWidth, minHeight]);

  const finalWidth = widthPx || ((block.data as any).customWidth);

  return (
    <div
      ref={containerRef}
      className={`relative group/block transition-all ${
        isResizing ? 'shadow-[0_0_0_2px_rgba(139,148,158,0.4)] transition-none' : ''
      }`}
      style={{ 
        width: finalWidth ? `${finalWidth}px` : '100%',
        height: `${heightPx}px`,
        maxWidth: '100%',
        marginLeft: block.data.alignment === 'center' ? 'auto' : '0',
        marginRight: block.data.alignment === 'center' ? 'auto' : 
                     block.data.alignment === 'right' ? '0' : 'auto',
      }}
    >
      {/* Top-Left Corner */}
      <div
        onMouseDown={handleCornerMouseDown('tl')}
        className={`corner-resize-handle corner-tl ${
          isResizing && resizeCorner === 'tl' ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100'
        }`}
        style={{
          position: 'absolute',
          top: '-2px',
          left: '-2px',
          width: '24px',
          height: '24px',
          cursor: 'nw-resize',
          zIndex: 30,
          pointerEvents: 'all',
          transition: 'opacity 0.2s ease',
        }}
      >
        <div className="hover:brightness-150 hover:drop-shadow-[0_0_4px_rgba(139,148,158,0.6)] transition-all" style={{
          width: '100%',
          height: '100%',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 18 Q4 4 18 4' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' fill='none'/%3E%3Ccircle cx='4' cy='4' r='2.5' fill='%238b949e'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }} />
      </div>

      {/* Top-Right Corner */}
      <div
        onMouseDown={handleCornerMouseDown('tr')}
        className={`corner-resize-handle corner-tr ${
          isResizing && resizeCorner === 'tr' ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100'
        }`}
        style={{
          position: 'absolute',
          top: '-2px',
          right: '-2px',
          width: '24px',
          height: '24px',
          cursor: 'ne-resize',
          zIndex: 30,
          pointerEvents: 'all',
          transition: 'opacity 0.2s ease',
        }}
      >
        <div className="hover:brightness-150 hover:drop-shadow-[0_0_4px_rgba(139,148,158,0.6)] transition-all" style={{
          width: '100%',
          height: '100%',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 4 Q20 4 20 18' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' fill='none'/%3E%3Ccircle cx='20' cy='4' r='2.5' fill='%238b949e'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }} />
      </div>

      {/* Bottom-Left Corner */}
      <div
        onMouseDown={handleCornerMouseDown('bl')}
        className={`corner-resize-handle corner-bl ${
          isResizing && resizeCorner === 'bl' ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100'
        }`}
        style={{
          position: 'absolute',
          bottom: '-2px',
          left: '-2px',
          width: '24px',
          height: '24px',
          cursor: 'sw-resize',
          zIndex: 30,
          pointerEvents: 'all',
          transition: 'opacity 0.2s ease',
        }}
      >
        <div className="hover:brightness-150 hover:drop-shadow-[0_0_4px_rgba(139,148,158,0.6)] transition-all" style={{
          width: '100%',
          height: '100%',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 6 Q4 20 18 20' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' fill='none'/%3E%3Ccircle cx='4' cy='20' r='2.5' fill='%238b949e'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }} />
      </div>

      {/* Bottom-Right Corner */}
      <div
        onMouseDown={handleCornerMouseDown('br')}
        className={`corner-resize-handle corner-br ${
          isResizing && resizeCorner === 'br' ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100'
        }`}
        style={{
          position: 'absolute',
          bottom: '-2px',
          right: '-2px',
          width: '24px',
          height: '24px',
          cursor: 'se-resize',
          zIndex: 30,
          pointerEvents: 'all',
          transition: 'opacity 0.2s ease',
        }}
      >
        <div className="hover:brightness-150 hover:drop-shadow-[0_0_4px_rgba(139,148,158,0.6)] transition-all" style={{
          width: '100%',
          height: '100%',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 20 Q20 20 20 6' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' fill='none'/%3E%3Ccircle cx='20' cy='20' r='2.5' fill='%238b949e'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }} />
      </div>

      {/* Content */}
      <div 
        className={`h-full w-full overflow-hidden ${
          isResizing ? 'pointer-events-none select-none transition-none' : 'transition-all'
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export default ResizableBlock;
