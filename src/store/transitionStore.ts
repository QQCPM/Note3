import { create } from 'zustand';

interface HighlightedText {
  text: string;
  messageId: string;
  timestamp: number;
}

interface TransitionStore {
  // Captured content for transitions
  capturedHighlights: HighlightedText[];
  conversationContext: string[];

  // Actions
  addHighlight: (highlight: Omit<HighlightedText, 'timestamp'>) => void;
  removeHighlight: (messageId: string) => void;
  clearHighlights: () => void;
  setConversationContext: (context: string[]) => void;
  clearAll: () => void;
}

export const useTransitionStore = create<TransitionStore>((set) => ({
  // Initial state
  capturedHighlights: [],
  conversationContext: [],

  // Add a highlighted text snippet
  addHighlight: (highlight) =>
    set((state) => ({
      capturedHighlights: [
        ...state.capturedHighlights,
        {
          ...highlight,
          timestamp: Date.now(),
        },
      ],
    })),

  // Remove a specific highlight
  removeHighlight: (messageId) =>
    set((state) => ({
      capturedHighlights: state.capturedHighlights.filter(
        (h) => h.messageId !== messageId
      ),
    })),

  // Clear all highlights
  clearHighlights: () =>
    set({
      capturedHighlights: [],
    }),

  // Set conversation context
  setConversationContext: (context) =>
    set({
      conversationContext: context,
    }),

  // Clear everything
  clearAll: () =>
    set({
      capturedHighlights: [],
      conversationContext: [],
    }),
}));
