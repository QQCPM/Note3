import React from 'react';
import { useUIStore } from '@/store';

const HeaderDock: React.FC = () => {
    const {
        sidebarCollapsed,
        toggleSidebar,
        aiSidebarCollapsed,
        toggleAISidebar,
        canvasMode,
        setCanvasMode
    } = useUIStore();

    return (
        <div className="fixed top-0 left-0 z-50 p-2 w-[240px] flex justify-center pointer-events-none">
            {/* Glassmorphic Dock */}
            <div className="pointer-events-auto flex items-center gap-2 px-2 py-1.5 rounded-lg backdrop-blur-xl bg-[#161b22]/90 border border-white/10 shadow-lg ring-1 ring-black/50 transition-all duration-300">

                {/* Left: Sidebar Toggle */}
                <button
                    onClick={toggleSidebar}
                    className={`p-1.5 rounded-md transition-all duration-200 ${!sidebarCollapsed
                        ? 'text-white bg-white/10'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    title={sidebarCollapsed ? "Open Sidebar" : "Close Sidebar"}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                </button>

                {/* Divider */}
                <div className="w-px h-4 bg-white/10"></div>

                {/* Center: Mode Switcher */}
                <div className="flex items-center bg-black/20 rounded-md p-0.5">
                    <button
                        onClick={() => setCanvasMode('note')}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${canvasMode === 'note'
                            ? 'bg-[#238636] text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        Note
                    </button>
                    <button
                        onClick={() => setCanvasMode('canvas')}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${canvasMode === 'canvas'
                            ? 'bg-[#1f6feb] text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        Canvas
                    </button>
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-white/10"></div>

                {/* Right: AI Sidebar Toggle */}
                <button
                    onClick={toggleAISidebar}
                    className={`p-1.5 rounded-md transition-all duration-200 ${!aiSidebarCollapsed
                        ? 'text-purple-400 bg-purple-500/20'
                        : 'text-gray-400 hover:text-purple-400 hover:bg-purple-500/10'
                        }`}
                    title={aiSidebarCollapsed ? "Open AI Assistant" : "Close AI Assistant"}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                        <path d="M12 12 2.1 12a10 10 0 0 1 17.8-6" />
                        <path d="M12 12 21.9 12a10 10 0 0 1-17.8 6" />
                    </svg>
                </button>

            </div>
        </div>
    );
};

export default HeaderDock;
