import React, { useCallback, useEffect, useRef } from 'react';
import { useUIStore } from '@/store';
import AgentTab from './AgentTab';
import RecommendTab from './RecommendTab';
import SettingsTab from './SettingsTab';
import AIInput from './AIInput';
import { ChevronRight, ChevronLeft } from 'lucide-react';

const AISidebar: React.FC = () => {
  const {
    aiSidebarTab,
    setAISidebarTab,
    aiSidebarWidth,
    setAISidebarWidth,
    toggleAISidebar,
    aiSidebarCollapsed,
  } = useUIStore();

  const sidebarRef = useRef<HTMLElement>(null);
  const isResizing = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing.current && sidebarRef.current) {
      const newWidth = sidebarRef.current.parentElement!.getBoundingClientRect().right - e.clientX;
      if (newWidth > 300 && newWidth < 800) { // Min and max width
        setAISidebarWidth(newWidth);
      }
    }
  }, [setAISidebarWidth]);

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
      className="flex-shrink-0 flex flex-col rounded-lg relative"
      style={{
        width: `${aiSidebarWidth}px`,
        background: 'radial-gradient(circle at top left, rgba(13, 71, 161, 0.2) 0%, rgba(30, 136, 229, 0.1) 40%, #010409 80%)',
      }}
    >
      {/* Resize Handle */}
      <div
        className="absolute top-0 left-0 w-2 h-full cursor-col-resize z-10"
        onMouseDown={handleMouseDown}
      />

      {/* Collapse/Expand Button */}
      <button
        onClick={toggleAISidebar}
        className="absolute top-1/2 -left-4 transform -translate-y-1/2 bg-gray-800 hover:bg-gray-700 text-white p-1 rounded-full z-20"
        title={aiSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {aiSidebarCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

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
