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
  canvasMode: 'note' | 'canvas';

  // Menus & Modals
  contextMenu: ContextMenuState;
  slashMenu: SlashMenuState;
  aiPromptModal: AIPromptModalState;

  // Actions
  toggleSidebar: () => void;
  toggleAISidebar: () => void;
  setAISidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setAISidebarTab: (tab: 'agent' | 'recommend' | 'settings') => void;
  setCanvasMode: (mode: 'note' | 'canvas') => void;

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

  setAISidebarTab: (tab) => set({ aiSidebarTab: tab }),

  setCanvasMode: (mode) => set((state) => {
    // Auto-collapse both sidebars when entering canvas mode
    if (mode === 'canvas') {
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
