import { create } from 'zustand';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: AIToolCall[];
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

export interface PendingEdit {
  id: string;
  blockId: string;
  originalContent: string;
  proposedContent: string;
  reason: string;
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected';
}

interface AIState {
  // Conversation state
  messages: AIMessage[];
  isLoading: boolean;
  currentRequest: string | null;

  // Edit state
  pendingEdits: PendingEdit[];
  activeEditId: string | null;

  // AI panel state
  isEditMode: boolean;
  targetBlockId: string | null;

  // Actions
  addMessage: (message: Omit<AIMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setCurrentRequest: (request: string | null) => void;

  // Edit actions
  addPendingEdit: (edit: Omit<PendingEdit, 'id' | 'timestamp' | 'status'>) => void;
  acceptEdit: (editId: string) => void;
  rejectEdit: (editId: string) => void;
  clearPendingEdits: () => void;
  setActiveEdit: (editId: string | null) => void;

  // Mode actions
  enterEditMode: (blockId: string) => void;
  exitEditMode: () => void;
}

export const useAIStore = create<AIState>((set) => ({
  // Initial state
  messages: [],
  isLoading: false,
  currentRequest: null,
  pendingEdits: [],
  activeEditId: null,
  isEditMode: false,
  targetBlockId: null,

  // Message actions
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: `msg-${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
        },
      ],
    })),

  clearMessages: () => set({ messages: [] }),

  setLoading: (loading) => set({ isLoading: loading }),

  setCurrentRequest: (request) => set({ currentRequest: request }),

  // Edit actions
  addPendingEdit: (edit) =>
    set((state) => ({
      pendingEdits: [
        ...state.pendingEdits,
        {
          ...edit,
          id: `edit-${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          status: 'pending' as const,
        },
      ],
    })),

  acceptEdit: (editId) =>
    set((state) => ({
      pendingEdits: state.pendingEdits.map((edit) =>
        edit.id === editId ? { ...edit, status: 'accepted' as const } : edit
      ),
    })),

  rejectEdit: (editId) =>
    set((state) => ({
      pendingEdits: state.pendingEdits.map((edit) =>
        edit.id === editId ? { ...edit, status: 'rejected' as const } : edit
      ),
    })),

  clearPendingEdits: () => set({ pendingEdits: [] }),

  setActiveEdit: (editId) => set({ activeEditId: editId }),

  // Mode actions
  enterEditMode: (blockId) =>
    set({
      isEditMode: true,
      targetBlockId: blockId,
      messages: [],
      pendingEdits: [],
    }),

  exitEditMode: () =>
    set({
      isEditMode: false,
      targetBlockId: null,
      currentRequest: null,
      isLoading: false,
    }),
}));
