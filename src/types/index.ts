// Re-export all types
export * from './note';
export * from './block';
export * from './ai';
export * from './mcp';
export * from './skill';
export * from './canvas';
export * from './project';
export * from './dashboard';
export * from './rootNode';
export * from './memory';

// UI State types
export interface UIState {
  activeNoteId: string | null;
  sidebarCollapsed: boolean;
  aiSidebarTab: 'agent' | 'recommend' | 'settings';
  contextMenuVisible: boolean;
  contextMenuPosition: { x: number; y: number } | null;
  contextMenuNoteId: string | null;
  slashMenuVisible: boolean;
  slashMenuPosition: { x: number; y: number } | null;
  aiPromptModalVisible: boolean;
  aiPromptModalType: 'artifact' | 'database' | null;
}

// App State
export interface AppState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
}
