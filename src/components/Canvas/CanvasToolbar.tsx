import React from 'react';
import { useCanvasStore, CanvasTool } from '@/store/canvasStore';

const CanvasToolbar: React.FC = () => {
  const { selectedTool, setSelectedTool } = useCanvasStore();

  const tools: { id: CanvasTool; icon: JSX.Element; title: string }[] = [
    {
      id: 'hand',
      title: 'Hand - Move & Pan',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11V6a2 2 0 0 1 4 0v5M9 11a2 2 0 1 1-4 0V9M9 11h4m0 0a2 2 0 1 0 4 0V6M13 16v-5m0 5a2 2 0 0 0 4 0v-4m-4 4H9m8-9V5a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v6"></path>
        </svg>
      ),
    },
    {
      id: 'cursor',
      title: 'Cursor - Select & Edit',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
        </svg>
      ),
    },
    {
      id: 'arrow',
      title: 'Arrow - Connect Boxes',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="15 8 19 12 15 16"></polyline>
        </svg>
      ),
    },
    {
      id: 'note',
      title: 'Note Block',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      ),
    },
    {
      id: 'drawing',
      title: 'Drawing',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
          <path d="M2 2l7.586 7.586"></path>
          <circle cx="11" cy="11" r="2"></circle>
        </svg>
      ),
    },
    {
      id: 'text',
      title: 'Text',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="4 7 4 4 20 4 20 7"></polyline>
          <line x1="9" y1="20" x2="15" y2="20"></line>
          <line x1="12" y1="4" x2="12" y2="20"></line>
        </svg>
      ),
    },
    {
      id: 'mindmap',
      title: 'Mind Map',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      ),
    },
    {
      id: 'website',
      title: 'Website',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      ),
    },
  ];

  return (
    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-20">
      <div
        className="flex gap-1 p-2 rounded-xl shadow-lg"
        style={{
          background: 'rgba(22, 27, 34, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #30363d',
        }}
      >
        {tools.slice(0, 3).map((tool) => (
          <button
            key={tool.id}
            onClick={() => setSelectedTool(tool.id)}
            title={tool.title}
            className={`p-2 rounded-lg transition-all ${selectedTool === tool.id
                ? 'bg-blue-500 text-white'
                : 'bg-transparent text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
          >
            {tool.icon}
          </button>
        ))}

        {/* Divider */}
        <div className="w-px bg-gray-700 my-1"></div>

        {tools.slice(3).map((tool) => (
          <button
            key={tool.id}
            onClick={() => setSelectedTool(tool.id)}
            title={tool.title}
            className={`p-2 rounded-lg transition-all ${selectedTool === tool.id
                ? 'bg-blue-500 text-white'
                : 'bg-transparent text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
          >
            {tool.icon}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CanvasToolbar;
