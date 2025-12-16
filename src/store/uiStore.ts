import { create } from 'zustand';

interface ContextMenuState {
  visible: boolean;
  position: { x: number; y: number } | null;
  noteId: string | null;
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

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  aiSidebarCollapsed: boolean;
  aiSidebarWidth: number;
  aiSidebarTab: 'agent' | 'recommend' | 'settings';

  // Canvas Mode
  canvasMode: 'note' | 'canvas' | 'dashboard' | 'graph';

  // Menus & Modals
  contextMenu: ContextMenuState;
  slashMenu: SlashMenuState;
  aiPromptModal: AIPromptModalState;

  // Actions
  toggleSidebar: () => void;
  toggleAISidebar: () => void;
  setAISidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setAISidebarCollapsed: (collapsed: boolean) => void;
  setAISidebarTab: (tab: 'agent' | 'recommend' | 'settings') => void;
  setCanvasMode: (mode: 'note' | 'canvas' | 'dashboard' | 'graph') => void;

  // Context Menu
  showContextMenu: (x: number, y: number, noteId: string) => void;
  hideContextMenu: () => void;

  // Slash Menu
  showSlashMenu: (x: number, y: number, blockId?: string) => void;
  hideSlashMenu: () => void;

  // AI Prompt Modal
  showAIPromptModal: (type: 'artifact' | 'database', blockId?: string) => void;
  hideAIPromptModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  aiSidebarCollapsed: false,
  aiSidebarWidth: 350,
  aiSidebarTab: 'agent',

  canvasMode: 'note',

  contextMenu: {
    visible: false,
    position: null,
    noteId: null,
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

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleAISidebar: () => set((state) => ({ aiSidebarCollapsed: !state.aiSidebarCollapsed })),
  setAISidebarWidth: (width) => set({ aiSidebarWidth: width }),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setAISidebarCollapsed: (collapsed) => set({ aiSidebarCollapsed: collapsed }),

  setAISidebarTab: (tab) => set({ aiSidebarTab: tab }),

  setCanvasMode: (mode) => set(() => {
    // KEEP LEFT SIDEBAR OPEN for drag-and-drop to work!
    // Only auto-collapse the AI sidebar when entering canvas mode
    if (mode === 'canvas') {
      return {
        canvasMode: mode,
        sidebarCollapsed: false, // KEEP OPEN so drag-and-drop works
        aiSidebarCollapsed: true,
      };
    }
    // Dashboard mode: collapse AI sidebar for clean focus
    if (mode === 'dashboard') {
      return {
        canvasMode: mode,
        sidebarCollapsed: false,
        aiSidebarCollapsed: true,
      };
    }
    // Graph mode: immersive 3D view, collapse sidebars for full focus
    if (mode === 'graph') {
      return {
        canvasMode: mode,
        sidebarCollapsed: true,
        aiSidebarCollapsed: true,
      };
    }
    // Auto-expand both sidebars when entering note mode
    return {
      canvasMode: mode,
      sidebarCollapsed: false,
      aiSidebarCollapsed: false,
    };
  }),

  showContextMenu: (x, y, noteId) => set({
    contextMenu: { visible: true, position: { x, y }, noteId }
  }),

  hideContextMenu: () => set({
    contextMenu: { visible: false, position: null, noteId: null }
  }),

  showSlashMenu: (x, y, blockId) => set({
    slashMenu: { visible: true, position: { x, y }, blockId: blockId || null }
  }),

  hideSlashMenu: () => set({
    slashMenu: { visible: false, position: null, blockId: null }
  }),

  showAIPromptModal: (type, blockId) => set({
    aiPromptModal: { visible: true, type, blockId: blockId || null }
  }),

  hideAIPromptModal: () => set({
    aiPromptModal: { visible: false, type: null, blockId: null }
  }),
}));
