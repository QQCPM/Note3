import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================================
// EXISTING INTERFACES
// ============================================================================

interface ContextMenuState {
  visible: boolean;
  position: { x: number; y: number } | null;
  noteId: string | null;
  treeItemId: string | null;
}

interface SlashMenuState {
  visible: boolean;
  position: { x: number; y: number } | null;
  blockId: string | null;
}

interface AIPromptModalState {
  visible: boolean;
  type: 'artifact' | 'database' | null;
  blockId: string | null;
}

// ============================================================================
// AI WINDOW INTERFACE - Browser-style tab management
// ============================================================================

export interface AIWindow {
  id: string;
  sessionKey: string;       // "global" | noteId - which session this window views
  tabIds: string[];         // Which tabs are currently in this window
  activeTabId: string;      // Which tab is active in this window
  isPrimary: boolean;       // Is this the docked sidebar?
  zIndex: number;           // Stacking order for floating windows
  // Floating window properties:
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

// ============================================================================
// UI STATE INTERFACE
// ============================================================================

interface UIState {
  // Sidebar (legacy - will be replaced by aiWindows)
  sidebarCollapsed: boolean;
  aiSidebarCollapsed: boolean;
  aiSidebarWidth: number;
  aiSidebarTab: 'agent' | 'recommend' | 'settings';
  aiSidebarMode: 'docked' | 'floating';
  aiFloatingPosition: { x: number; y: number };
  aiFloatingSize: { width: number; height: number };

  // AI Windows - Multi-window management
  aiWindows: AIWindow[];
  nextZIndex: number;  // Counter for window stacking


  // Canvas Mode
  canvasMode: 'note' | 'canvas' | 'dashboard' | 'graph' | 'course';

  // Menus & Modals
  contextMenu: ContextMenuState;
  slashMenu: SlashMenuState;
  aiPromptModal: AIPromptModalState;

  // Sidebar Actions (legacy)
  toggleSidebar: () => void;
  toggleAISidebar: () => void;
  setAISidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setAISidebarCollapsed: (collapsed: boolean) => void;
  setAISidebarTab: (tab: 'agent' | 'recommend' | 'settings') => void;
  setAISidebarMode: (mode: 'docked' | 'floating') => void;
  setAIFloatingPosition: (pos: { x: number; y: number }) => void;
  setAIFloatingSize: (size: { width: number; height: number }) => void;
  setCanvasMode: (mode: 'note' | 'canvas' | 'dashboard' | 'graph' | 'course') => void;

  // AI Window Actions
  getPrimaryWindow: (sessionKey: string) => AIWindow | undefined;
  getWindowById: (windowId: string) => AIWindow | undefined;
  getWindowForTab: (tabId: string) => AIWindow | undefined;

  createWindow: (sessionKey: string, tabId: string, position?: { x: number; y: number }) => AIWindow;
  closeWindow: (windowId: string) => void;

  addTabToWindow: (windowId: string, tabId: string) => void;
  removeTabFromWindow: (windowId: string, tabId: string) => void;
  moveTabToWindow: (tabId: string, fromWindowId: string, toWindowId: string) => void;
  detachTab: (tabId: string, position?: { x: number; y: number }) => AIWindow | null;

  setWindowActiveTab: (windowId: string, tabId: string) => void;
  updateWindowPosition: (windowId: string, position: { x: number; y: number }) => void;
  updateWindowSize: (windowId: string, size: { width: number; height: number }) => void;
  bringWindowToFront: (windowId: string) => void;
  reorderTabs: (windowId: string, tabIds: string[]) => void;

  ensurePrimaryWindow: (sessionKey: string, initialTabId?: string) => AIWindow;

  // Context Menu
  showContextMenu: (x: number, y: number, noteId: string | null, treeItemId?: string | null) => void;
  hideContextMenu: () => void;

  // Slash Menu
  showSlashMenu: (x: number, y: number, blockId?: string) => void;
  hideSlashMenu: () => void;

  // AI Prompt Modal
  showAIPromptModal: (type: 'artifact' | 'database', blockId?: string) => void;
  hideAIPromptModal: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateWindowId(): string {
  return `win-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// UI STORE IMPLEMENTATION
// ============================================================================

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarCollapsed: false,
      aiSidebarCollapsed: false,
      aiSidebarWidth: 350,
      aiSidebarTab: 'agent',
      aiSidebarMode: 'docked',
      aiFloatingPosition: { x: 100, y: 100 },
      aiFloatingSize: { width: 400, height: 600 },

      // AI Windows - start empty, created on demand
      aiWindows: [],
      nextZIndex: 1001,  // Start above primary (1000)

      canvasMode: 'note',

      contextMenu: {
        visible: false,
        position: null,
        noteId: null,
        treeItemId: null,
      },

      slashMenu: {
        visible: false,
        position: null,
        blockId: null,
      },

      aiPromptModal: {
        visible: false,
        type: null,
        blockId: null,
      },

      // ========================================================================
      // LEGACY SIDEBAR ACTIONS
      // ========================================================================

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleAISidebar: () => set((state) => ({ aiSidebarCollapsed: !state.aiSidebarCollapsed })),
      setAISidebarWidth: (width) => set({ aiSidebarWidth: width }),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setAISidebarCollapsed: (collapsed) => set({ aiSidebarCollapsed: collapsed }),

      setAISidebarTab: (tab) => set({ aiSidebarTab: tab }),
      setAISidebarMode: (mode) => set({ aiSidebarMode: mode }),
      setAIFloatingPosition: (pos) => set({ aiFloatingPosition: pos }),
      setAIFloatingSize: (size) => set({ aiFloatingSize: size }),

      setCanvasMode: (mode) => set(() => {
        if (mode === 'canvas') {
          return {
            canvasMode: mode,
            sidebarCollapsed: false,
            aiSidebarCollapsed: true,
          };
        }
        if (mode === 'dashboard') {
          return {
            canvasMode: mode,
            sidebarCollapsed: false,
            aiSidebarCollapsed: true,
          };
        }
        if (mode === 'graph') {
          return {
            canvasMode: mode,
            sidebarCollapsed: true,
            aiSidebarCollapsed: true,
          };
        }
        if (mode === 'course') {
          // Course mode: full-screen experience, close AI sidebar by default
          return {
            canvasMode: mode,
            sidebarCollapsed: true,
            aiSidebarCollapsed: true,
          };
        }
        return {
          canvasMode: mode,
          sidebarCollapsed: false,
          aiSidebarCollapsed: false,
        };
      }),

      // ========================================================================
      // AI WINDOW GETTERS
      // ========================================================================

      getPrimaryWindow: (sessionKey) => {
        return get().aiWindows.find(w => w.sessionKey === sessionKey && w.isPrimary);
      },

      getWindowById: (windowId) => {
        return get().aiWindows.find(w => w.id === windowId);
      },

      getWindowForTab: (tabId) => {
        return get().aiWindows.find(w => w.tabIds.includes(tabId));
      },

      // ========================================================================
      // AI WINDOW ACTIONS
      // ========================================================================

      ensurePrimaryWindow: (sessionKey, initialTabId) => {
        const existing = get().getPrimaryWindow(sessionKey);
        if (existing) return existing;

        // Create new primary window
        const newWindow: AIWindow = {
          id: generateWindowId(),
          sessionKey,
          tabIds: initialTabId ? [initialTabId] : [],
          activeTabId: initialTabId || '',
          isPrimary: true,
          zIndex: 1000,  // Primary always base level
        };

        set((state) => ({
          aiWindows: [...state.aiWindows, newWindow]
        }));

        return newWindow;
      },

      createWindow: (sessionKey, tabId, position) => {
        // Remove tab from its current window
        const currentWindow = get().getWindowForTab(tabId);
        if (currentWindow) {
          get().removeTabFromWindow(currentWindow.id, tabId);
        }

        const nextZ = get().nextZIndex;

        // Create new detached window
        const newWindow: AIWindow = {
          id: generateWindowId(),
          sessionKey,
          tabIds: [tabId],
          activeTabId: tabId,
          isPrimary: false,
          zIndex: nextZ,
          position: position || { x: 150, y: 150 },
          size: { width: 400, height: 550 },
        };

        set((state) => ({
          aiWindows: [...state.aiWindows, newWindow],
          nextZIndex: nextZ + 1,
        }));

        return newWindow;
      },

      closeWindow: (windowId) => {
        const windowToClose = get().getWindowById(windowId);
        if (!windowToClose || windowToClose.isPrimary) return;

        // Return all tabs to primary window
        const primaryWindow = get().getPrimaryWindow(windowToClose.sessionKey);
        if (primaryWindow && windowToClose.tabIds.length > 0) {
          set((state) => ({
            aiWindows: state.aiWindows.map(w => {
              if (w.id === primaryWindow.id) {
                const newTabIds = [...w.tabIds, ...windowToClose.tabIds];
                return {
                  ...w,
                  tabIds: newTabIds,
                  activeTabId: w.activeTabId || newTabIds[0],
                };
              }
              return w;
            }).filter(w => w.id !== windowId)
          }));
        } else {
          // Just remove the window
          set((state) => ({
            aiWindows: state.aiWindows.filter(w => w.id !== windowId)
          }));
        }
      },

      addTabToWindow: (windowId, tabId) => {
        set((state) => ({
          aiWindows: state.aiWindows.map(w => {
            if (w.id === windowId && !w.tabIds.includes(tabId)) {
              return {
                ...w,
                tabIds: [...w.tabIds, tabId],
                activeTabId: w.activeTabId || tabId,
              };
            }
            return w;
          })
        }));
      },

      removeTabFromWindow: (windowId, tabId) => {
        set((state) => ({
          aiWindows: state.aiWindows.map(w => {
            if (w.id === windowId) {
              const newTabIds = w.tabIds.filter(id => id !== tabId);
              const newActiveTabId = w.activeTabId === tabId
                ? newTabIds[newTabIds.length - 1] || ''
                : w.activeTabId;
              return {
                ...w,
                tabIds: newTabIds,
                activeTabId: newActiveTabId,
              };
            }
            return w;
          }).filter(w => w.isPrimary || w.tabIds.length > 0) // Remove empty non-primary windows
        }));
      },

      moveTabToWindow: (tabId, fromWindowId, toWindowId) => {
        get().removeTabFromWindow(fromWindowId, tabId);
        get().addTabToWindow(toWindowId, tabId);
      },

      detachTab: (tabId, position) => {
        const currentWindow = get().getWindowForTab(tabId);
        if (!currentWindow) return null;

        // Don't detach if it's the only tab in a non-primary window
        if (!currentWindow.isPrimary && currentWindow.tabIds.length === 1) {
          return null;
        }

        return get().createWindow(currentWindow.sessionKey, tabId, position);
      },

      setWindowActiveTab: (windowId, tabId) => {
        set((state) => ({
          aiWindows: state.aiWindows.map(w => {
            if (w.id === windowId && w.tabIds.includes(tabId)) {
              return { ...w, activeTabId: tabId };
            }
            return w;
          })
        }));
      },

      updateWindowPosition: (windowId, position) => {
        set((state) => ({
          aiWindows: state.aiWindows.map(w =>
            w.id === windowId ? { ...w, position } : w
          )
        }));
      },

      updateWindowSize: (windowId, size) => {
        set((state) => ({
          aiWindows: state.aiWindows.map(w =>
            w.id === windowId ? { ...w, size } : w
          )
        }));
      },

      bringWindowToFront: (windowId) => {
        const window = get().getWindowById(windowId);
        if (!window) return;

        const nextZ = get().nextZIndex;
        set((state) => ({
          aiWindows: state.aiWindows.map(w =>
            w.id === windowId ? { ...w, zIndex: nextZ } : w
          ),
          nextZIndex: nextZ + 1,
        }));
      },

      reorderTabs: (windowId, tabIds) => {
        set((state) => ({
          aiWindows: state.aiWindows.map(w =>
            w.id === windowId ? { ...w, tabIds } : w
          )
        }));
      },

      // ========================================================================
      // CONTEXT MENU
      // ========================================================================

      showContextMenu: (x, y, noteId, treeItemId = null) => set({
        contextMenu: { visible: true, position: { x, y }, noteId, treeItemId }
      }),

      hideContextMenu: () => set({
        contextMenu: { visible: false, position: null, noteId: null, treeItemId: null }
      }),

      // ========================================================================
      // SLASH MENU
      // ========================================================================

      showSlashMenu: (x, y, blockId) => set({
        slashMenu: { visible: true, position: { x, y }, blockId: blockId || null }
      }),

      hideSlashMenu: () => set({
        slashMenu: { visible: false, position: null, blockId: null }
      }),

      // ========================================================================
      // AI PROMPT MODAL
      // ========================================================================

      showAIPromptModal: (type, blockId) => set({
        aiPromptModal: { visible: true, type, blockId: blockId || null }
      }),

      hideAIPromptModal: () => set({
        aiPromptModal: { visible: false, type: null, blockId: null }
      }),
    }),
    {
      name: 'note3-ui-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist window layout
        aiWindows: state.aiWindows,
        aiSidebarWidth: state.aiSidebarWidth,
        aiSidebarTab: state.aiSidebarTab,
      }),
    }
  )
);
