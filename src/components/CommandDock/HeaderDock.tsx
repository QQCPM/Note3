import React from 'react';
import { useUIStore, useNotesStore } from '@/store';
import { Home, FileText, LayoutGrid, CalendarDays } from 'lucide-react';

const HeaderDock: React.FC = () => {
    const {
        sidebarCollapsed,
        toggleSidebar,
        aiSidebarCollapsed,
        toggleAISidebar,
        canvasMode,
        setCanvasMode
    } = useUIStore();
    const { activeNoteId, setActiveNote } = useNotesStore();

    // Custom Icon Components (Filled Rectangles)
    const IconSidebarLeft = ({ active }: { active: boolean }) => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
            <path d="M2 7C2 5.34315 3.34315 4 5 4H9V20H5C3.34315 20 2 18.6569 2 17V7Z" fill={active ? "currentColor" : "none"} />
            <line x1="9" y1="4" x2="9" y2="20" stroke="currentColor" strokeWidth="2" />
        </svg>
    );

    const IconSidebarRight = ({ active }: { active: boolean }) => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
            <path d="M15 4H19C20.6569 4 22 5.34315 22 7V17C22 18.6569 20.6569 20 19 20H15V4Z" fill={active ? "currentColor" : "none"} />
            <line x1="15" y1="4" x2="15" y2="20" stroke="currentColor" strokeWidth="2" />
        </svg>
    );

    // Fixed dock position - stays consistent regardless of sidebar state
    // Position at 40px to avoid AI status dot when collapsed, and looks good when open
    const dockLeft = 40;

    return (
        // Fixed position dock
        <div
            className="fixed top-3 z-50 flex flex-col gap-2 pointer-events-none"
            style={{ left: dockLeft }}
        >
            {/* Compact Dock */}
            <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-lg backdrop-blur-xl bg-[#0d1117]/90 border border-white/10 shadow-xl ring-1 ring-black/50">

                {/* 1. Left Sidebar Toggle */}
                <button
                    onClick={toggleSidebar}
                    className={`p-1.5 rounded-md transition-all duration-200 ${!sidebarCollapsed
                        ? 'text-white bg-white/10 shadow-sm'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        }`}
                    title="Toggle Sidebar"
                >
                    <IconSidebarLeft active={!sidebarCollapsed} />
                </button>

                {/* 2. Note Mode - only show when sidebar is open */}
                {!sidebarCollapsed && (
                    <button
                        onClick={() => setCanvasMode('note')}
                        className={`p-1.5 rounded-md transition-all duration-200 ${canvasMode === 'note'
                            ? 'text-green-400 bg-green-500/10 shadow-sm'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`}
                        title="Note Mode"
                    >
                        <FileText size={16} />
                    </button>
                )}

                {/* 3. Canvas Mode */}
                <button
                    onClick={() => setCanvasMode('canvas')}
                    className={`p-1.5 rounded-md transition-all duration-200 ${canvasMode === 'canvas'
                        ? 'text-blue-400 bg-blue-500/10 shadow-sm'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        }`}
                    title="Canvas Mode"
                >
                    <LayoutGrid size={16} />
                </button>

                {/* 4. Dashboard Mode */}
                <button
                    onClick={() => setCanvasMode('dashboard')}
                    className={`p-1.5 rounded-md transition-all duration-200 ${canvasMode === 'dashboard'
                        ? 'text-purple-400 bg-purple-500/10 shadow-sm'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        }`}
                    title="Dashboard"
                >
                    <CalendarDays size={16} />
                </button>

                {/* 5. Right Sidebar Toggle */}
                <button
                    onClick={toggleAISidebar}
                    className={`p-1.5 rounded-md transition-all duration-200 ${!aiSidebarCollapsed
                        ? 'text-white bg-white/10 shadow-sm'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        }`}
                    title="Toggle AI Sidebar"
                >
                    <IconSidebarRight active={!aiSidebarCollapsed} />
                </button>

                {/* Divider */}
                <div className="w-px h-4 bg-white/10 mx-0.5"></div>

                {/* 7. Home */}
                <button
                    onClick={() => {
                        setActiveNote(null);
                        setCanvasMode('note');
                    }}
                    className={`p-1.5 rounded-md transition-all duration-200 ${!activeNoteId && canvasMode === 'note'
                        ? 'text-white bg-white/10'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        }`}
                    title="Home"
                >
                    <Home size={16} />
                </button>

            </div>
        </div>
    );
};

export default HeaderDock;
