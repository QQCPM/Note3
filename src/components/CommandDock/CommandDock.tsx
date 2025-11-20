import React from 'react';
import { useUIStore } from '@/store';

const CommandDock: React.FC = () => {
    const {
        sidebarCollapsed,
        toggleSidebar,
        aiSidebarCollapsed,
        toggleAISidebar,
        canvasMode,
        setCanvasMode
    } = useUIStore();

    return (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <div className="flex items-center p-1.5 rounded-full backdrop-blur-xl bg-[#161b22]/80 border border-white/10 shadow-2xl ring-1 ring-black/50">

                {/* Left: Sidebar Toggle */}
                <button
                    onClick={toggleSidebar}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 ${!sidebarCollapsed
                            ? 'bg-white/10 text-white shadow-inner'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    title={sidebarCollapsed ? "Open Sidebar" : "Close Sidebar"}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                </button>

                {/* Divider */}
                <div className="w-px h-5 bg-white/10 mx-2"></div>

                {/* Center: Mode Switcher */}
                <div className="flex items-center bg-black/20 rounded-full p-1">
                    <button
                        onClick={() => setCanvasMode('note')}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${canvasMode === 'note'
                                ? 'bg-[#238636] text-white shadow-lg shadow-green-900/20'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Note
                    </button>
                    <button
                        onClick={() => setCanvasMode('canvas')}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${canvasMode === 'canvas'
                                ? 'bg-[#1f6feb] text-white shadow-lg shadow-blue-900/20'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        Canvas
                    </button>
                </div>

                {/* Divider */}
                <div className="w-px h-5 bg-white/10 mx-2"></div>

                {/* Right: AI Sidebar Toggle */}
                <button
                    onClick={toggleAISidebar}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 ${!aiSidebarCollapsed
                            ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)] border border-purple-500/30'
                            : 'text-gray-400 hover:text-purple-400 hover:bg-purple-500/10'
                        }`}
                    title={aiSidebarCollapsed ? "Open AI Assistant" : "Close AI Assistant"}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                        <path d="M12 12 2.1 12a10 10 0 0 1 17.8-6" />
                        <path d="M12 12 21.9 12a10 10 0 0 1-17.8 6" />
                    </svg>
                </button>

            </div>
        </div>
    );
};

export default CommandDock;
