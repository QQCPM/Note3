import { create } from 'zustand';
import type { Block, DatabaseBlockData } from '@/types';

// AI Mode types
export type AIMode = 'ask' | 'edit';

// Context types - what AI is currently working with
export interface AIContext {
  noteId: string | null;
  blockId: string | null;
  blockType: Block['type'] | null;
  // For database-specific context
  databaseData?: DatabaseBlockData;
}

// Conversation message types
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  // Metadata for special message types
  metadata?: {
    type?: 'database_query' | 'semantic_search' | 'edit_operation' | 'general' | 'analysis';
    query?: string;
    results?: any;
    blocksAffected?: string[];
    suggestedFollowUps?: string[];
  };
}

// AI capabilities based on context
export interface AICapabilities {
  canQueryDatabase: boolean;
  canSearchNotes: boolean;
  canEditBlocks: boolean;
  canOrganizeNotes: boolean;
  canUseWebSearch: boolean;
  suggestedActions: string[];
}

interface AIState {
  // Current mode
  mode: AIMode;

  // Context awareness
  context: AIContext;

  // Conversation history
  messages: AIMessage[];

  // Processing state
  isProcessing: boolean;

  // Capabilities based on current context
  capabilities: AICapabilities;

  // Actions
  setMode: (mode: AIMode) => void;
  setContext: (context: Partial<AIContext>) => void;
  clearContext: () => void;

  // Messaging
  addMessage: (message: Omit<AIMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setProcessing: (processing: boolean) => void;

  // Capabilities
  updateCapabilities: (capabilities: Partial<AICapabilities>) => void;

  // Query helpers
  getDatabaseContext: () => DatabaseBlockData | null;
  hasActiveContext: () => boolean;
}

const defaultCapabilities: AICapabilities = {
  canQueryDatabase: false,
  canSearchNotes: true,
  canEditBlocks: false,
  canOrganizeNotes: false,
  canUseWebSearch: false,
  suggestedActions: [],
};

const defaultContext: AIContext = {
  noteId: null,
  blockId: null,
  blockType: null,
  databaseData: undefined,
};

export const useAIStore = create<AIState>((set, get) => ({
  mode: 'ask',
  context: defaultContext,
  messages: [],
  isProcessing: false,
  capabilities: defaultCapabilities,

  setMode: (mode) => {
    set({ mode });

    // Update capabilities based on mode
    const capabilities = get().capabilities;
    if (mode === 'edit') {
      set({
        capabilities: {
          ...capabilities,
          canEditBlocks: true,
          canOrganizeNotes: true,
        },
      });
    } else {
      set({
        capabilities: {
          ...capabilities,
          canEditBlocks: false,
          canOrganizeNotes: false,
        },
      });
    }
  },

  setContext: (contextUpdate) => {
    const newContext = { ...get().context, ...contextUpdate };
    set({ context: newContext });

    // Update capabilities based on context
    const capabilities: AICapabilities = {
      canQueryDatabase: !!newContext.databaseData,
      canSearchNotes: true,
      canEditBlocks: get().mode === 'edit' && !!newContext.blockId,
      canOrganizeNotes: get().mode === 'edit' && !!newContext.noteId,
      canUseWebSearch: true,
      suggestedActions: generateSuggestedActions(newContext, get().mode),
    };

    set({ capabilities });
  },

  clearContext: () => {
    set({
      context: defaultContext,
      capabilities: {
        ...defaultCapabilities,
        canEditBlocks: get().mode === 'edit',
        canOrganizeNotes: get().mode === 'edit',
      },
    });
  },

  addMessage: (message) => {
    const newMessage: AIMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  setProcessing: (processing) => {
    set({ isProcessing: processing });
  },

  updateCapabilities: (capabilitiesUpdate) => {
    set((state) => ({
      capabilities: {
        ...state.capabilities,
        ...capabilitiesUpdate,
      },
    }));
  },

  getDatabaseContext: () => {
    return get().context.databaseData || null;
  },

  hasActiveContext: () => {
    const { noteId, blockId } = get().context;
    return !!noteId || !!blockId;
  },
}));

/**
 * Generate suggested actions based on current context and mode
 */
function generateSuggestedActions(context: AIContext, mode: AIMode): string[] {
  const suggestions: string[] = [];

  if (mode === 'ask') {
    // Ask mode suggestions
    if (context.databaseData) {
      suggestions.push('Query database data');
      suggestions.push('Analyze database statistics');
      suggestions.push('Find patterns in data');
    }

    if (context.noteId) {
      suggestions.push('Search within this note');
      suggestions.push('Summarize note content');
    }

    suggestions.push('Semantic search across all notes');
    suggestions.push('Web search for information');
  } else {
    // Edit mode suggestions
    if (context.blockId) {
      suggestions.push('Edit this block');
      suggestions.push('Improve formatting');
    }

    if (context.noteId) {
      suggestions.push('Organize note structure');
      suggestions.push('Add missing sections');
      suggestions.push('Fix inconsistencies');
    }

    if (context.databaseData) {
      suggestions.push('Add missing columns');
      suggestions.push('Fill empty cells');
      suggestions.push('Clean duplicate data');
    }
  }

  return suggestions;
}

/**
 * Hook to sync AI context with currently focused block
 */
export function useAIContextSync(block: Block | null) {
  const { setContext, clearContext } = useAIStore();

  React.useEffect(() => {
    if (block) {
      setContext({
        blockId: block.id,
        noteId: block.note_id,
        blockType: block.type,
        databaseData: block.type === 'database' ? (block.data as DatabaseBlockData) : undefined,
      });
    } else {
      clearContext();
    }

    return () => {
      // Cleanup on unmount
    };
  }, [block, setContext, clearContext]);
}

// React import for useEffect
import React from 'react';
