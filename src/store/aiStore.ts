import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  thinkingSteps?: ThinkingStep[];
  isThinkingExpanded?: boolean;
  citations?: Citation[];
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

// ============================================================================
// SESSION TAB - Individual conversation within a note session
// ============================================================================

export interface SessionTab {
  id: string;
  name: string;           // "General", "Deep Dive", etc.
  messages: AIMessage[];
  createdAt: Date;
  tokenEstimate: number;  // Approximate tokens used
}

// ============================================================================
// NOTE SESSION - All conversations for a single note
// ============================================================================

export interface NoteSession {
  noteId: string | null;  // null = global session
  tabs: SessionTab[];
  activeTabId: string;
}

// ============================================================================
// DIFF & EDIT TYPES
// ============================================================================

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
  diffHunks: DiffHunk[];
  reason: string;
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected';
  noteId?: string;
  isGeneratedNote?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createDefaultTab(name: string = 'Chat'): SessionTab {
  return {
    id: `tab-${generateId()}`,
    name,
    messages: [],
    createdAt: new Date(),
    tokenEstimate: 0,
  };
}

function createDefaultSession(noteId: string | null): NoteSession {
  const defaultTab = createDefaultTab();
  return {
    noteId,
    tabs: [defaultTab],
    activeTabId: defaultTab.id,
  };
}

function estimateTokens(messages: AIMessage[]): number {
  // Rough estimate: 1 token ≈ 4 characters
  return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
}

// ============================================================================
// AI STORE INTERFACE
// ============================================================================

interface AIStore {
  // Session state
  noteSessions: Record<string, NoteSession>;  // noteId → session (using Record for persistence)
  globalSession: NoteSession;                  // Dashboard/general chat
  activeNoteId: string | null;                 // Currently active note
  activeFileId: string | null;                 // Currently active file (PDF, etc.)
  activeFileName: string | null;               // Name of the active file

  // Session actions
  getOrCreateSession: (noteId: string | null) => NoteSession;
  getActiveSession: () => NoteSession;
  switchSession: (noteId: string | null) => void;
  setActiveFile: (fileId: string | null, fileName?: string) => void;  // Switch to file context

  // Tab actions
  createTab: (noteId: string | null, name?: string) => SessionTab;
  switchTab: (noteId: string | null, tabId: string) => void;
  closeTab: (noteId: string | null, tabId: string) => void;
  renameTab: (noteId: string | null, tabId: string, name: string) => void;

  // Message actions (operate on current session's active tab)
  addMessage: (message: Omit<AIMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (messageId: string, updates: Partial<AIMessage>) => void;
  clearMessages: () => void;  // Clears current tab only

  // Loading state
  isLoading: boolean;
  currentRequest: string | null;
  setLoading: (loading: boolean) => void;
  setCurrentRequest: (request: string | null) => void;

  // Thinking steps (for message being generated)
  currentThinkingSteps: ThinkingStep[];
  currentCitations: Citation[];
  addThinkingStep: (step: Omit<ThinkingStep, 'id' | 'timestamp'>) => void;
  updateThinkingStep: (stepId: string, updates: Partial<ThinkingStep>) => void;
  clearCurrentThinking: () => void;
  addCitation: (citation: Omit<Citation, 'id'>) => Citation;
  clearCurrentCitations: () => void;
  toggleThinkingExpanded: (messageId: string) => void;

  // Edit state
  pendingEdits: PendingEdit[];
  activeEditId: string | null;
  addPendingEdit: (edit: Omit<PendingEdit, 'id' | 'timestamp' | 'status'>) => void;
  acceptEdit: (editId: string) => void;
  rejectEdit: (editId: string) => void;
  clearPendingEdits: () => void;
  setActiveEdit: (editId: string | null) => void;
  acceptHunk: (editId: string, hunkId: string) => void;
  rejectHunk: (editId: string, hunkId: string) => void;
  acceptAllHunks: (editId: string) => void;
  rejectAllHunks: (editId: string) => void;

  // Edit mode
  isEditMode: boolean;
  targetBlockId: string | null;
  enterEditMode: (blockId: string) => void;
  exitEditMode: () => void;

  // Slide generation
  isGeneratingSlides: boolean;
  slideProgress: { current: number; total: number; message: string };
  generatedSlides: any[] | null;
  slideError: string | null;
  startSlideGeneration: () => void;
  updateSlideProgress: (progress: { current: number; total: number; message: string }) => void;
  finishSlideGeneration: (slides: any[]) => void;
  setSlideError: (error: string) => void;
  resetSlideState: () => void;

  // Legacy compatibility: get messages from current session
  get messages(): AIMessage[];
}

// ============================================================================
// AI STORE IMPLEMENTATION
// ============================================================================

export const useAIStore = create<AIStore>()(
  persist(
    (set, get) => ({
      // Initial state
      noteSessions: {},
      globalSession: createDefaultSession(null),
      activeNoteId: null,
      activeFileId: null,
      activeFileName: null,
      isLoading: false,
      currentRequest: null,
      currentThinkingSteps: [],
      currentCitations: [],
      pendingEdits: [],
      activeEditId: null,
      isEditMode: false,
      targetBlockId: null,
      isGeneratingSlides: false,
      slideProgress: { current: 0, total: 0, message: '' },
      generatedSlides: null,
      slideError: null,

      // ========================================================================
      // SESSION MANAGEMENT
      // ========================================================================

      getOrCreateSession: (noteId) => {
        if (noteId === null) {
          return get().globalSession;
        }

        const sessions = get().noteSessions;
        if (sessions[noteId]) {
          return sessions[noteId];
        }

        // Create new session for this note
        const newSession = createDefaultSession(noteId);
        set((state) => ({
          noteSessions: { ...state.noteSessions, [noteId]: newSession }
        }));
        return newSession;
      },

      getActiveSession: () => {
        const { activeNoteId } = get();
        return get().getOrCreateSession(activeNoteId);
      },

      switchSession: (noteId) => {
        // Clear file context when switching to a note
        set({ activeNoteId: noteId, activeFileId: null, activeFileName: null });
        // Ensure session exists
        get().getOrCreateSession(noteId);
      },

      setActiveFile: (fileId, fileName) => {
        if (fileId === null) {
          // Clearing file context - switch back to note context or global
          set({ activeFileId: null, activeFileName: null });
        } else {
          // Switch to file context - use file: prefix for session ID
          const fileSessionId = `file:${fileId}`;
          set({
            activeFileId: fileId,
            activeFileName: fileName || null,
            activeNoteId: fileSessionId, // Use prefixed ID in the session system
          });
          // Ensure session exists for this file
          get().getOrCreateSession(fileSessionId);
        }
      },

      // ========================================================================
      // TAB MANAGEMENT
      // ========================================================================

      createTab: (noteId, name) => {
        const tabName = name || `Chat ${get().getOrCreateSession(noteId).tabs.length + 1}`;
        const newTab = createDefaultTab(tabName);

        if (noteId === null) {
          set((state) => ({
            globalSession: {
              ...state.globalSession,
              tabs: [...state.globalSession.tabs, newTab],
              activeTabId: newTab.id,
            }
          }));
        } else {
          set((state) => {
            const session = state.noteSessions[noteId] || createDefaultSession(noteId);
            return {
              noteSessions: {
                ...state.noteSessions,
                [noteId]: {
                  ...session,
                  tabs: [...session.tabs, newTab],
                  activeTabId: newTab.id,
                }
              }
            };
          });
        }

        return newTab;
      },

      switchTab: (noteId, tabId) => {
        if (noteId === null) {
          set((state) => ({
            globalSession: { ...state.globalSession, activeTabId: tabId }
          }));
        } else {
          set((state) => {
            const session = state.noteSessions[noteId];
            if (!session) return state;
            return {
              noteSessions: {
                ...state.noteSessions,
                [noteId]: { ...session, activeTabId: tabId }
              }
            };
          });
        }
      },

      closeTab: (noteId, tabId) => {
        const updateSession = (session: NoteSession): NoteSession => {
          if (session.tabs.length <= 1) return session; // Can't close last tab

          const newTabs = session.tabs.filter(t => t.id !== tabId);
          const newActiveId = session.activeTabId === tabId
            ? newTabs[newTabs.length - 1].id
            : session.activeTabId;

          return { ...session, tabs: newTabs, activeTabId: newActiveId };
        };

        if (noteId === null) {
          set((state) => ({
            globalSession: updateSession(state.globalSession)
          }));
        } else {
          set((state) => {
            const session = state.noteSessions[noteId];
            if (!session) return state;
            return {
              noteSessions: {
                ...state.noteSessions,
                [noteId]: updateSession(session)
              }
            };
          });
        }
      },

      renameTab: (noteId, tabId, name) => {
        const updateSession = (session: NoteSession): NoteSession => ({
          ...session,
          tabs: session.tabs.map(t => t.id === tabId ? { ...t, name } : t)
        });

        if (noteId === null) {
          set((state) => ({
            globalSession: updateSession(state.globalSession)
          }));
        } else {
          set((state) => {
            const session = state.noteSessions[noteId];
            if (!session) return state;
            return {
              noteSessions: {
                ...state.noteSessions,
                [noteId]: updateSession(session)
              }
            };
          });
        }
      },

      // ========================================================================
      // MESSAGE MANAGEMENT
      // ========================================================================

      // Legacy compatibility getter
      get messages() {
        const session = get().getActiveSession();
        const activeTab = session.tabs.find(t => t.id === session.activeTabId);
        return activeTab?.messages || [];
      },

      addMessage: (message) => {
        set((state) => {
          const { activeNoteId, currentThinkingSteps, currentCitations } = state;

          // Complete all running steps before attaching to message
          const completedSteps = message.role === 'assistant'
            ? currentThinkingSteps.map(step => ({
              ...step,
              status: step.status === 'running' ? 'complete' as const : step.status,
              duration: step.status === 'running' ? Date.now() - step.timestamp.getTime() : step.duration,
            }))
            : currentThinkingSteps;

          const newMessage: AIMessage = {
            ...message,
            id: `msg-${generateId()}`,
            timestamp: new Date(),
            thinkingSteps: message.role === 'assistant' ? [...completedSteps] : undefined,
            citations: message.role === 'assistant' ? [...currentCitations] : undefined,
            isThinkingExpanded: false,
          };

          const updateSession = (session: NoteSession): NoteSession => {
            const activeTab = session.tabs.find(t => t.id === session.activeTabId);
            if (!activeTab) return session;

            return {
              ...session,
              tabs: session.tabs.map(t =>
                t.id === session.activeTabId
                  ? {
                    ...t,
                    messages: [...t.messages, newMessage],
                    tokenEstimate: estimateTokens([...t.messages, newMessage])
                  }
                  : t
              )
            };
          };

          if (activeNoteId === null) {
            return {
              globalSession: updateSession(state.globalSession),
              currentThinkingSteps: message.role === 'assistant' ? [] : currentThinkingSteps,
              currentCitations: message.role === 'assistant' ? [] : currentCitations,
            };
          } else {
            const existingSession = state.noteSessions[activeNoteId];
            const session = existingSession || createDefaultSession(activeNoteId);
            const updatedSession = updateSession(session);
            return {
              noteSessions: {
                ...state.noteSessions,
                [activeNoteId]: updatedSession
              },
              currentThinkingSteps: message.role === 'assistant' ? [] : currentThinkingSteps,
              currentCitations: message.role === 'assistant' ? [] : currentCitations,
            };
          }
        });
      },

      updateMessage: (messageId, updates) => {
        set((state) => {
          const { activeNoteId } = state;

          const updateSession = (session: NoteSession): NoteSession => ({
            ...session,
            tabs: session.tabs.map(tab => ({
              ...tab,
              messages: tab.messages.map(msg =>
                msg.id === messageId ? { ...msg, ...updates } : msg
              )
            }))
          });

          if (activeNoteId === null) {
            return { globalSession: updateSession(state.globalSession) };
          } else {
            const session = state.noteSessions[activeNoteId];
            if (!session) return state;
            return {
              noteSessions: {
                ...state.noteSessions,
                [activeNoteId]: updateSession(session)
              }
            };
          }
        });
      },

      clearMessages: () => {
        set((state) => {
          const { activeNoteId } = state;

          const updateSession = (session: NoteSession): NoteSession => ({
            ...session,
            tabs: session.tabs.map(tab =>
              tab.id === session.activeTabId
                ? { ...tab, messages: [], tokenEstimate: 0 }
                : tab
            )
          });

          if (activeNoteId === null) {
            return {
              globalSession: updateSession(state.globalSession),
              currentThinkingSteps: [],
              currentCitations: []
            };
          } else {
            const session = state.noteSessions[activeNoteId];
            if (!session) return state;
            return {
              noteSessions: {
                ...state.noteSessions,
                [activeNoteId]: updateSession(session)
              },
              currentThinkingSteps: [],
              currentCitations: []
            };
          }
        });
      },

      setLoading: (loading) => set((state) => {
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

      // ========================================================================
      // THINKING STEPS
      // ========================================================================

      addThinkingStep: (step) =>
        set((state) => ({
          currentThinkingSteps: [
            ...state.currentThinkingSteps,
            {
              ...step,
              id: `step-${generateId()}`,
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

      toggleThinkingExpanded: (messageId) => {
        set((state) => {
          const { activeNoteId } = state;

          const updateSession = (session: NoteSession): NoteSession => ({
            ...session,
            tabs: session.tabs.map(tab => ({
              ...tab,
              messages: tab.messages.map(msg =>
                msg.id === messageId ? { ...msg, isThinkingExpanded: !msg.isThinkingExpanded } : msg
              )
            }))
          });

          if (activeNoteId === null) {
            return { globalSession: updateSession(state.globalSession) };
          } else {
            const session = state.noteSessions[activeNoteId];
            if (!session) return state;
            return {
              noteSessions: {
                ...state.noteSessions,
                [activeNoteId]: updateSession(session)
              }
            };
          }
        });
      },

      // ========================================================================
      // EDIT MANAGEMENT
      // ========================================================================

      addPendingEdit: (edit) =>
        set((state) => ({
          pendingEdits: [
            ...state.pendingEdits,
            {
              ...edit,
              id: `edit-${generateId()}`,
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

      // ========================================================================
      // EDIT MODE
      // ========================================================================

      enterEditMode: (blockId) =>
        set({
          isEditMode: true,
          targetBlockId: blockId,
          pendingEdits: [],
        }),

      exitEditMode: () =>
        set({
          isEditMode: false,
          targetBlockId: null,
          currentRequest: null,
          isLoading: false,
        }),

      // ========================================================================
      // SLIDE GENERATION
      // ========================================================================

      startSlideGeneration: () =>
        set({
          isGeneratingSlides: true,
          slideError: null,
          slideProgress: { current: 0, total: 0, message: 'Starting...' },
        }),

      updateSlideProgress: (progress) => set({ slideProgress: progress }),

      finishSlideGeneration: (slides) =>
        set({
          isGeneratingSlides: false,
          generatedSlides: slides,
          slideProgress: { current: 0, total: 0, message: 'Complete' },
        }),

      setSlideError: (error) =>
        set({
          isGeneratingSlides: false,
          slideError: error,
        }),

      resetSlideState: () =>
        set({
          isGeneratingSlides: false,
          generatedSlides: null,
          slideError: null,
          slideProgress: { current: 0, total: 0, message: '' },
        }),
    }),
    {
      name: 'note3-ai-sessions',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        noteSessions: state.noteSessions,
        globalSession: state.globalSession,
        activeNoteId: state.activeNoteId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Reconstruct Date objects after rehydration
          const reconstructDates = (session: NoteSession): NoteSession => ({
            ...session,
            tabs: session.tabs.map(tab => ({
              ...tab,
              createdAt: new Date(tab.createdAt),
              messages: tab.messages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
                thinkingSteps: msg.thinkingSteps?.map(step => ({
                  ...step,
                  timestamp: new Date(step.timestamp)
                }))
              }))
            }))
          });

          state.globalSession = reconstructDates(state.globalSession);
          for (const noteId in state.noteSessions) {
            state.noteSessions[noteId] = reconstructDates(state.noteSessions[noteId]);
          }
        }
      },
    }
  )
);
