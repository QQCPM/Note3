import { create } from 'zustand';

// ============================================================================
// THINKING STEPS - Claude-style reasoning display
// ============================================================================

export type ThinkingStepType = 'thought' | 'search' | 'read' | 'tool' | 'analyze' | 'write' | 'create' | 'explore' | 'reasoning' | 'reasoning_summary';
export type ThinkingStepStatus = 'running' | 'complete' | 'error';

export interface ThinkingStep {
  id: string;
  type: ThinkingStepType;
  status: ThinkingStepStatus;
  description: string;
  details?: string;
  timestamp: Date;
  duration?: number; // ms
}

// ============================================================================
// CITATIONS - Source references from web search
// ============================================================================

export interface Citation {
  id: number; // [1], [2], etc.
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedDate?: string;
}

// ============================================================================
// AI MESSAGE - Extended with thinking and citations
// ============================================================================

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  noteId?: string;
  toolCalls?: AIToolCall[];
  // NEW: Thinking display
  thinkingSteps?: ThinkingStep[];
  isThinkingExpanded?: boolean;
  // NEW: Citations
  citations?: Citation[];
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

export interface DiffHunk {
  id: string;
  type: 'addition' | 'deletion' | 'modification';
  startLine: number;
  endLine: number;
  oldLines: string[];
  newLines: string[];
  contextBefore: string[];
  contextAfter: string[];
  status: 'pending' | 'accepted' | 'rejected';
}

export interface PendingEdit {
  id: string;
  blockId: string;
  originalContent: string;
  proposedContent: string;
  diffHunks: DiffHunk[]; // NEW: granular diff hunks
  reason: string;
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected';
  // For generated notes (localStorage-based)
  noteId?: string;
  isGeneratedNote?: boolean;
}

interface AIStore {
  // Conversation state
  messages: AIMessage[];
  isLoading: boolean;
  currentRequest: string | null;

  // NEW: Current thinking steps (for message being generated)
  currentThinkingSteps: ThinkingStep[];
  currentCitations: Citation[];

  // Edit state
  pendingEdits: PendingEdit[];
  activeEditId: string | null;

  // AI panel state
  isEditMode: boolean;
  targetBlockId: string | null;

  // Actions - Messages
  addMessage: (message: Omit<AIMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (messageId: string, updates: Partial<AIMessage>) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setCurrentRequest: (request: string | null) => void;

  // NEW: Actions - Thinking Steps
  addThinkingStep: (step: Omit<ThinkingStep, 'id' | 'timestamp'>) => void;
  updateThinkingStep: (stepId: string, updates: Partial<ThinkingStep>) => void;
  clearCurrentThinking: () => void;
  
  // NEW: Actions - Citations
  addCitation: (citation: Omit<Citation, 'id'>) => Citation;
  clearCurrentCitations: () => void;
  
  // NEW: Actions - Toggle thinking expanded
  toggleThinkingExpanded: (messageId: string) => void;

  // Actions - Edits
  addPendingEdit: (edit: Omit<PendingEdit, 'id' | 'timestamp' | 'status'>) => void;
  acceptEdit: (editId: string) => void;
  rejectEdit: (editId: string) => void;
  clearPendingEdits: () => void;
  setActiveEdit: (editId: string | null) => void;

  // NEW: Hunk-level actions
  acceptHunk: (editId: string, hunkId: string) => void;
  rejectHunk: (editId: string, hunkId: string) => void;
  acceptAllHunks: (editId: string) => void;
  rejectAllHunks: (editId: string) => void;

  // Actions - Mode
  enterEditMode: (blockId: string) => void;
  exitEditMode: () => void;
}

export const useAIStore = create<AIStore>((set, get) => ({
  // Initial state
  messages: [],
  isLoading: false,
  currentRequest: null,
  currentThinkingSteps: [],
  currentCitations: [],
  pendingEdits: [],
  activeEditId: null,
  isEditMode: false,
  targetBlockId: null,

  // Message actions
  addMessage: (message) =>
    set((state) => {
      // Complete all running steps before attaching to message
      const completedSteps = message.role === 'assistant' 
        ? state.currentThinkingSteps.map(step => ({
            ...step,
            status: step.status === 'running' ? 'complete' as const : step.status,
            duration: step.status === 'running' ? Date.now() - step.timestamp.getTime() : step.duration,
          }))
        : state.currentThinkingSteps;

      // Attach current thinking steps and citations to the message
      const newMessage: AIMessage = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        thinkingSteps: message.role === 'assistant' ? [...completedSteps] : undefined,
        citations: message.role === 'assistant' ? [...state.currentCitations] : undefined,
        isThinkingExpanded: false,
      };
      
      return {
        messages: [...state.messages, newMessage],
        // Clear current thinking/citations after attaching to message
        currentThinkingSteps: message.role === 'assistant' ? [] : state.currentThinkingSteps,
        currentCitations: message.role === 'assistant' ? [] : state.currentCitations,
      };
    }),

  updateMessage: (messageId, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      ),
    })),

  clearMessages: () => set({ messages: [], currentThinkingSteps: [], currentCitations: [] }),

  setLoading: (loading) => set((state) => {
    // When loading is set to false, complete all running steps
    if (!loading && state.currentThinkingSteps.length > 0) {
      const completedSteps = state.currentThinkingSteps.map(step => ({
        ...step,
        status: step.status === 'running' ? 'complete' as const : step.status,
        duration: step.status === 'running' ? Date.now() - step.timestamp.getTime() : step.duration,
      }));
      return { isLoading: loading, currentThinkingSteps: completedSteps };
    }
    return { isLoading: loading };
  }),

  setCurrentRequest: (request) => set({ currentRequest: request }),

  // Thinking Steps actions
  addThinkingStep: (step) =>
    set((state) => ({
      currentThinkingSteps: [
        ...state.currentThinkingSteps,
        {
          ...step,
          id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        },
      ],
    })),

  updateThinkingStep: (stepId, updates) =>
    set((state) => ({
      currentThinkingSteps: state.currentThinkingSteps.map((step) =>
        step.id === stepId
          ? { ...step, ...updates, duration: updates.status === 'complete' ? Date.now() - step.timestamp.getTime() : step.duration }
          : step
      ),
    })),

  clearCurrentThinking: () => set({ currentThinkingSteps: [] }),

  // Citation actions
  addCitation: (citation) => {
    const state = get();
    const newId = state.currentCitations.length + 1;
    const newCitation: Citation = { ...citation, id: newId };
    
    set((state) => ({
      currentCitations: [...state.currentCitations, newCitation],
    }));
    
    return newCitation;
  },

  clearCurrentCitations: () => set({ currentCitations: [] }),

  // Toggle thinking expanded
  toggleThinkingExpanded: (messageId) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, isThinkingExpanded: !msg.isThinkingExpanded } : msg
      ),
    })),

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

  // Hunk-level actions
  acceptHunk: (editId, hunkId) =>
    set((state) => ({
      pendingEdits: state.pendingEdits.map((edit) =>
        edit.id === editId
          ? {
            ...edit,
            diffHunks: edit.diffHunks.map((hunk) =>
              hunk.id === hunkId ? { ...hunk, status: 'accepted' as const } : hunk
            ),
          }
          : edit
      ),
    })),

  rejectHunk: (editId, hunkId) =>
    set((state) => ({
      pendingEdits: state.pendingEdits.map((edit) =>
        edit.id === editId
          ? {
            ...edit,
            diffHunks: edit.diffHunks.map((hunk) =>
              hunk.id === hunkId ? { ...hunk, status: 'rejected' as const } : hunk
            ),
          }
          : edit
      ),
    })),

  acceptAllHunks: (editId) =>
    set((state) => ({
      pendingEdits: state.pendingEdits.map((edit) =>
        edit.id === editId
          ? {
            ...edit,
            diffHunks: edit.diffHunks.map((hunk) => ({ ...hunk, status: 'accepted' as const })),
            status: 'accepted' as const,
          }
          : edit
      ),
    })),

  rejectAllHunks: (editId) =>
    set((state) => ({
      pendingEdits: state.pendingEdits.map((edit) =>
        edit.id === editId
          ? {
            ...edit,
            diffHunks: edit.diffHunks.map((hunk) => ({ ...hunk, status: 'rejected' as const })),
            status: 'rejected' as const,
          }
          : edit
      ),
    })),

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
