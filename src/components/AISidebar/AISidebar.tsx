import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store';
import AgentTab from './AgentTab';
import RecommendTab from './RecommendTab';
import SettingsTab from './SettingsTab';
import AIInput from './AIInput';
import { Maximize2, Minimize2, GripVertical } from 'lucide-react';

interface AISidebarProps {
  windowId?: string;
  isDetached?: boolean;
}

const AISidebar: React.FC<AISidebarProps> = ({ windowId, isDetached = false }) => {
  const {
    aiSidebarTab,
    setAISidebarTab,
    aiSidebarWidth,
    setAISidebarWidth,
    aiSidebarCollapsed,
    aiSidebarMode,
    setAISidebarMode,
    aiFloatingPosition,
    setAIFloatingPosition,
    aiFloatingSize,
    setAIFloatingSize,
    bringWindowToFront,
    getWindowById,
  } = useUIStore();

  const sidebarRef = useRef<HTMLElement>(null);
  const isResizing = useRef(false);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [isResizingState, setIsResizingState] = useState(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Toggle between docked and floating modes (for primary window only)
  const handleModeToggle = () => {
    if (isDetached) return; // Detached windows can't toggle

    setIsTransitioning(true);

    if (aiSidebarMode === 'docked') {
      const viewportWidth = globalThis.innerWidth;
      const viewportHeight = globalThis.innerHeight;
      const floatWidth = aiFloatingSize.width;
      const floatHeight = aiFloatingSize.height;

      setAIFloatingPosition({
        x: (viewportWidth - floatWidth) / 2,
        y: (viewportHeight - floatHeight) / 2,
      });
      setAISidebarMode('floating');
    } else {
      setAISidebarMode('docked');
    }

    setTimeout(() => setIsTransitioning(false), 300);
  };

  // --- Docked mode resize (horizontal only) ---
  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (aiSidebarMode !== 'docked' || isDetached) return;
    e.preventDefault();
    isResizing.current = true;
    setIsResizingState(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleResizeMouseUp = useCallback(() => {
    if (isResizing.current && sidebarRef.current) {
      const finalWidth = parseInt(sidebarRef.current.style.width);
      if (!isNaN(finalWidth)) {
        setAISidebarWidth(finalWidth);
      }
    }
    isResizing.current = false;
    setIsResizingState(false);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = '';
  }, [setAISidebarWidth]);

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing.current && sidebarRef.current && aiSidebarMode === 'docked' && !isDetached) {
      const parentRect = sidebarRef.current.parentElement!.getBoundingClientRect();
      const newWidth = parentRect.right - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        sidebarRef.current.style.width = `${newWidth}px`;
        sidebarRef.current.style.minWidth = `${newWidth}px`;
      }
    }
  }, [aiSidebarMode, isDetached]);

  // --- Floating mode drag (for primary floating mode only) ---
  const handleDragMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (aiSidebarMode !== 'floating' || isDetached) return;
    e.preventDefault();
    isDragging.current = true;
    setIsDraggingState(true);

    const rect = sidebarRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  };

  const handleDragMouseUp = useCallback(() => {
    isDragging.current = false;
    setIsDraggingState(false);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = '';
  }, []);

  const handleDragMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging.current && aiSidebarMode === 'floating' && !isDetached) {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;

      const maxX = globalThis.innerWidth - aiFloatingSize.width;
      const maxY = globalThis.innerHeight - aiFloatingSize.height;

      setAIFloatingPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    }
  }, [aiSidebarMode, aiFloatingSize, setAIFloatingPosition, isDetached]);

  // --- Floating mode resize (corner) ---
  const handleFloatResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (aiSidebarMode !== 'floating' || isDetached) return;
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    setIsResizingState(true);
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
  };

  const handleFloatResizeMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing.current && aiSidebarMode === 'floating' && !isDetached) {
      const newWidth = e.clientX - aiFloatingPosition.x;
      const newHeight = e.clientY - aiFloatingPosition.y;

      setAIFloatingSize({
        width: Math.max(320, Math.min(newWidth, globalThis.innerWidth * 0.8)),
        height: Math.max(400, Math.min(newHeight, globalThis.innerHeight * 0.9)),
      });
    }
  }, [aiSidebarMode, aiFloatingPosition, setAIFloatingSize, isDetached]);

  // Event listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleResizeMouseMove(e);
      handleDragMouseMove(e);
      handleFloatResizeMouseMove(e);
    };

    const handleMouseUp = () => {
      handleResizeMouseUp();
      handleDragMouseUp();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleResizeMouseMove, handleResizeMouseUp, handleDragMouseMove, handleDragMouseUp, handleFloatResizeMouseMove]);

  // For detached windows, render minimal container (parent handles positioning)
  if (isDetached) {
    return (
      <div className="flex flex-col h-full">
        {/* Tab Navigation */}
        <header className="flex-shrink-0 border-b border-[#30363d] flex items-center justify-center bg-transparent">
          <nav className="flex items-center">
            <button
              className={`tab-button ${aiSidebarTab === 'agent' ? 'active' : ''}`}
              onClick={() => setAISidebarTab('agent')}
            >
              Agent
            </button>
            <button
              className={`tab-button ${aiSidebarTab === 'recommend' ? 'active' : ''}`}
              onClick={() => setAISidebarTab('recommend')}
            >
              Recommend
            </button>
            <button
              className={`tab-button ${aiSidebarTab === 'settings' ? 'active' : ''}`}
              onClick={() => setAISidebarTab('settings')}
            >
              Settings
            </button>
          </nav>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col overflow-y-auto">
          {aiSidebarTab === 'agent' && <AgentTab windowId={windowId} />}
          {aiSidebarTab === 'recommend' && <RecommendTab />}
          {aiSidebarTab === 'settings' && <SettingsTab />}
        </div>

        {/* AI Input */}
        <AIInput windowId={windowId} />
      </div>
    );
  }

  // Determine styles based on mode
  const isFloating = aiSidebarMode === 'floating';

  // Get window data for dynamic z-index
  const windowData = windowId ? getWindowById(windowId) : null;

  const containerStyle: React.CSSProperties = isFloating ? {
    position: 'fixed',
    left: aiFloatingPosition.x,
    top: aiFloatingPosition.y,
    width: aiFloatingSize.width,
    height: aiFloatingSize.height,
    minWidth: 320,
    zIndex: windowData?.zIndex || 1000,  // Dynamic z-index!
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(88, 166, 255, 0.3)',
    background: '#0d1117',
    transition: isTransitioning ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : (isDraggingState || isResizingState ? 'none' : 'box-shadow 0.2s'),
    overflow: 'hidden',
  } : {
    width: aiSidebarCollapsed ? '0' : `${aiSidebarWidth}px`,
    minWidth: aiSidebarCollapsed ? '0' : `${aiSidebarWidth}px`,
    overflowX: aiSidebarCollapsed ? 'hidden' : 'visible',
    overflowY: 'auto',
    visibility: aiSidebarCollapsed ? 'hidden' : 'visible',
    background: 'radial-gradient(circle at top left, rgba(13, 71, 161, 0.2) 0%, rgba(30, 136, 229, 0.1) 40%, #010409 80%)',
    transition: isResizingState ? 'none' : 'width 0.3s ease, min-width 0.3s ease',
    position: 'relative',
    zIndex: 1,
    marginRight: aiSidebarCollapsed ? '0' : '0.5rem',
  };

  // Don't render if collapsed and docked
  if (aiSidebarCollapsed && !isFloating) {
    return null;
  }

  // Handler to bring window to front when clicked (for floating mode with windowId)
  const handleFocus = () => {
    if (windowId && isFloating) {
      bringWindowToFront(windowId);
    }
  };

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar ${isFloating ? 'floating-sidebar' : 'right-sidebar'} flex-shrink-0 flex flex-col ${aiSidebarCollapsed && !isFloating ? 'collapsed' : ''}`}
      style={containerStyle}
      onMouseDown={isFloating ? handleFocus : undefined}
    >
      {/* Resize Handle - Only for docked mode */}
      {!isFloating && !aiSidebarCollapsed && (
        <div
          className="absolute top-0 left-0 w-2 h-full cursor-col-resize z-10"
          onMouseDown={handleResizeMouseDown}
        />
      )}

      {/* Header with drag handle (floating) and mode toggle */}
      <header className="flex-shrink-0 border-b border-[#30363d] flex items-center justify-between bg-transparent px-2">
        {/* Drag Handle - Only for floating mode */}
        {isFloating && (
          <div
            className="cursor-grab active:cursor-grabbing p-1.5 rounded hover:bg-[#21262d] transition-colors"
            onMouseDown={handleDragMouseDown}
            title="Drag to move"
          >
            <GripVertical size={14} className="text-[#6e7681]" />
          </div>
        )}

        {/* Tab Navigation */}
        <nav className={`flex items-center ${isFloating ? '' : 'flex-1 justify-center'}`}>
          <button
            className={`tab-button ${aiSidebarTab === 'agent' ? 'active' : ''}`}
            onClick={() => setAISidebarTab('agent')}
          >
            Agent
          </button>
          <button
            className={`tab-button ${aiSidebarTab === 'recommend' ? 'active' : ''}`}
            onClick={() => setAISidebarTab('recommend')}
          >
            Recommend
          </button>
          <button
            className={`tab-button ${aiSidebarTab === 'settings' ? 'active' : ''}`}
            onClick={() => setAISidebarTab('settings')}
          >
            Settings
          </button>
        </nav>

        {/* Mode Toggle Button */}
        <button
          onClick={handleModeToggle}
          className="p-1.5 rounded hover:bg-[#21262d] transition-colors group"
          title={isFloating ? 'Dock to sidebar' : 'Pop out to window'}
        >
          {isFloating ? (
            <Minimize2 size={14} className="text-[#6e7681] group-hover:text-[#58a6ff]" />
          ) : (
            <Maximize2 size={14} className="text-[#6e7681] group-hover:text-[#58a6ff]" />
          )}
        </button>
      </header>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col overflow-y-auto">
        {aiSidebarTab === 'agent' && <AgentTab windowId={windowId} />}
        {aiSidebarTab === 'recommend' && <RecommendTab />}
        {aiSidebarTab === 'settings' && <SettingsTab />}
      </div>

      {/* AI Input */}
      <AIInput windowId={windowId} />

      {/* Floating Resize Handle (bottom-right corner) */}
      {isFloating && (
        <div
          className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-20 group"
          onMouseDown={handleFloatResizeMouseDown}
        >
          <svg
            className="w-full h-full text-[#30363d] group-hover:text-[#58a6ff] transition-colors"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M14.5 18.5L18.5 14.5M10.5 18.5L18.5 10.5M6.5 18.5L18.5 6.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      )}
    </aside>
  );
};

export default AISidebar;
