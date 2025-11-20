import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store';
import AgentTab from './AgentTab';
import RecommendTab from './RecommendTab';
import SettingsTab from './SettingsTab';
import AIInput from './AIInput';

const AISidebar: React.FC = () => {
  const {
    aiSidebarTab,
    setAISidebarTab,
    aiSidebarWidth,
    setAISidebarWidth,
    aiSidebarCollapsed,
  } = useUIStore();

  const sidebarRef = useRef<HTMLElement>(null);
  const isResizing = useRef(false);
  const [isResizingState, setIsResizingState] = useState(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isResizing.current = true;
    setIsResizingState(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection during resize
  };

  const handleMouseUp = useCallback(() => {
    if (isResizing.current && sidebarRef.current) {
      // Sync the final width back to state after resize is complete
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

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing.current && sidebarRef.current) {
      const parentRect = sidebarRef.current.parentElement!.getBoundingClientRect();
      const newWidth = parentRect.right - e.clientX;

      if (newWidth >= 300 && newWidth <= 800) { // Min and max width
        // Direct DOM manipulation for instant visual feedback
        sidebarRef.current.style.width = `${newWidth}px`;
        sidebarRef.current.style.minWidth = `${newWidth}px`;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar right-sidebar flex-shrink-0 flex flex-col rounded-lg ${aiSidebarCollapsed ? 'collapsed' : ''}`}
      style={{
        width: aiSidebarCollapsed ? '0' : `${aiSidebarWidth}px`,
        minWidth: aiSidebarCollapsed ? '0' : `${aiSidebarWidth}px`,
        overflowX: aiSidebarCollapsed ? 'hidden' : 'visible',
        overflowY: 'auto',
        visibility: aiSidebarCollapsed ? 'hidden' : 'visible',
        background: 'radial-gradient(circle at top left, rgba(13, 71, 161, 0.2) 0%, rgba(30, 136, 229, 0.1) 40%, #010409 80%)',
        transition: isResizingState ? 'none' : 'width 0.3s ease, min-width 0.3s ease',
        position: 'relative',
        zIndex: 1,
        marginRight: aiSidebarCollapsed ? '0' : '0.5rem', // Prevent gap issue
      }}
    >
      {/* Resize Handle - Only show when not collapsed */}
      {!aiSidebarCollapsed && (
        <div
          className="absolute top-0 left-0 w-2 h-full cursor-col-resize z-10"
          onMouseDown={handleMouseDown}
        />
      )}



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
        {aiSidebarTab === 'agent' && <AgentTab />}
        {aiSidebarTab === 'recommend' && <RecommendTab />}
        {aiSidebarTab === 'settings' && <SettingsTab />}
      </div>

      {/* AI Input */}
      <AIInput />
    </aside>
  );
};

export default AISidebar;
