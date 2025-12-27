import React from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAIStore } from '@/store/aiStore';
import AISidebar from './AISidebar';

/**
 * AIWindowManager
 * 
 * Manages all AI windows (primary + detached).
 * - Primary window: docked sidebar
 * - Detached windows: floating panels
 * 
 * This component ensures that windows exist for the current session
 * and renders them appropriately.
 */
const AIWindowManager: React.FC = () => {
    const { aiWindows, ensurePrimaryWindow } = useUIStore();
    const { activeNoteId, getOrCreateSession } = useAIStore();

    // Determine current session key
    const sessionKey = activeNoteId || 'global';

    // Get or create session to ensure it exists
    const session = getOrCreateSession(activeNoteId);

    // Ensure primary window exists for current session
    React.useEffect(() => {
        if (session && session.tabs.length > 0) {
            const primaryWindow = aiWindows.find(w => w.sessionKey === sessionKey && w.isPrimary);
            if (!primaryWindow) {
                // Create primary window with first tab
                ensurePrimaryWindow(sessionKey, session.tabs[0].id);
            } else if (primaryWindow.tabIds.length === 0 && session.tabs.length > 0) {
                // Primary window exists but has no tabs - sync with session
                // Find tabs not assigned to any window and add them
                const assignedTabIds = new Set(aiWindows.flatMap(w => w.tabIds));
                const unassignedTabs = session.tabs.filter(t => !assignedTabIds.has(t.id));
                if (unassignedTabs.length > 0) {
                    unassignedTabs.forEach(tab => {
                        useUIStore.getState().addTabToWindow(primaryWindow.id, tab.id);
                    });
                }
            }
        }
    }, [sessionKey, session, aiWindows, ensurePrimaryWindow]);

    // Get all windows for current session
    const sessionWindows = aiWindows.filter(w => w.sessionKey === sessionKey);
    const primaryWindow = sessionWindows.find(w => w.isPrimary);
    const detachedWindows = sessionWindows.filter(w => !w.isPrimary);

    return (
        <>
            {/* Primary Window (docked sidebar) */}
            {primaryWindow && (
                <AISidebar
                    key={primaryWindow.id}
                    windowId={primaryWindow.id}
                />
            )}

            {/* Detached Windows (floating) */}
            {detachedWindows.map(window => (
                <FloatingAIWindow
                    key={window.id}
                    windowId={window.id}
                />
            ))}
        </>
    );
};

/**
 * FloatingAIWindow
 * 
 * A detached AI window that floats above the main content.
 * Wraps AISidebar in a draggable, resizable container.
 */
interface FloatingAIWindowProps {
    windowId: string;
}

const FloatingAIWindow: React.FC<FloatingAIWindowProps> = ({ windowId }) => {
    const {
        getWindowById,
        closeWindow,
        updateWindowPosition,
        updateWindowSize,
        bringWindowToFront,
    } = useUIStore();

    const window = getWindowById(windowId);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const isDragging = React.useRef(false);
    const isResizing = React.useRef(false);
    const dragOffset = React.useRef({ x: 0, y: 0 });
    const [isDraggingState, setIsDraggingState] = React.useState(false);
    const [isResizingState, setIsResizingState] = React.useState(false);

    if (!window) return null;

    // Bring window to front on any interaction
    const handleFocus = () => {
        bringWindowToFront(windowId);
    };

    const handleDragMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('.no-drag')) return;
        e.preventDefault();
        handleFocus();
        isDragging.current = true;
        setIsDraggingState(true);

        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            dragOffset.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    };

    const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        handleFocus();
        isResizing.current = true;
        setIsResizingState(true);
        document.body.style.cursor = 'nwse-resize';
        document.body.style.userSelect = 'none';
    };

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging.current && window) {
                const newX = e.clientX - dragOffset.current.x;
                const newY = e.clientY - dragOffset.current.y;

                const maxX = globalThis.innerWidth - (window.size?.width || 400);
                const maxY = globalThis.innerHeight - (window.size?.height || 550);

                updateWindowPosition(windowId, {
                    x: Math.max(0, Math.min(newX, maxX)),
                    y: Math.max(0, Math.min(newY, maxY)),
                });
            }

            if (isResizing.current && window) {
                const newWidth = e.clientX - (window.position?.x || 0);
                const newHeight = e.clientY - (window.position?.y || 0);

                updateWindowSize(windowId, {
                    width: Math.max(320, Math.min(newWidth, globalThis.innerWidth * 0.8)),
                    height: Math.max(400, Math.min(newHeight, globalThis.innerHeight * 0.9)),
                });
            }
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            isResizing.current = false;
            setIsDraggingState(false);
            setIsResizingState(false);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [windowId, window, updateWindowPosition, updateWindowSize]);

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        closeWindow(windowId);
    };

    return (
        <div
            ref={containerRef}
            className="fixed flex flex-col rounded-2xl overflow-hidden"
            onMouseDown={handleFocus}
            style={{
                left: window.position?.x || 150,
                top: window.position?.y || 150,
                width: window.size?.width || 400,
                height: window.size?.height || 550,
                zIndex: window.zIndex || 1001,
                background: '#0d1117',
                borderRadius: 16,
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(88, 166, 255, 0.3)',
                transition: isDraggingState || isResizingState ? 'none' : 'box-shadow 0.2s',
            }}
        >
            {/* Minimal drag zone at top - invisible */}
            <div
                className="absolute top-0 left-0 right-8 h-4 cursor-grab active:cursor-grabbing z-10"
                onMouseDown={handleDragMouseDown}
            />

            {/* Close Button - overlay */}
            <button
                onClick={handleClose}
                className="no-drag absolute top-1 right-1 p-1 rounded hover:bg-[#30363d] transition-colors z-20"
                title="Return tabs to main window"
            >
                <svg className="w-3 h-3 text-[#6e7681]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <AISidebar windowId={windowId} isDetached />
            </div>

            {/* Resize Handle */}
            <div
                className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-20 group"
                onMouseDown={handleResizeMouseDown}
            >
                <svg
                    className="w-full h-full text-[#30363d] group-hover:text-[#58a6ff] transition-colors"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path d="M14.5 18.5L18.5 14.5M10.5 18.5L18.5 10.5M6.5 18.5L18.5 6.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
            </div>
        </div>
    );
};

export default AIWindowManager;
