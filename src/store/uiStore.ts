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
  aiSidebarTab: 'agent' | 'mcp' | 'skills';

  // Menus & Modals
  contextMenu: ContextMenuState;
  slashMenu: SlashMenuState;
  aiPromptModal: AIPromptModalState;

  // Actions
  toggleSidebar: () => void;
  toggleAISidebar: () => void;
  setAISidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setAISidebarTab: (tab: 'agent' | 'mcp' | 'skills') => void;

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
