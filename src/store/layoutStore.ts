import { create } from 'zustand';

interface LayoutStore {
  // Panel visibility state
  notePanelVisible: boolean;
  currentEditingNoteId: string | null;
  isTransitioning: boolean;

  // Actions
  showNotePanel: (noteId: string) => void;
  hideNotePanel: () => void;
  setTransitioning: (transitioning: boolean) => void;
}

export const useLayoutStore = create<LayoutStore>((set) => ({
  // Initial state
  notePanelVisible: false,
  currentEditingNoteId: null,
  isTransitioning: false,

  // Show note panel with smooth transition
  showNotePanel: (noteId) => {
    set({ isTransitioning: true });

    // Small delay to trigger CSS transition
    setTimeout(() => {
      set({
        notePanelVisible: true,
        currentEditingNoteId: noteId,
      });
    }, 50);

    // Clear transitioning flag after animation completes
    setTimeout(() => {
      set({ isTransitioning: false });
    }, 450); // 400ms transition + 50ms buffer
  },

  // Hide note panel with smooth transition
  hideNotePanel: () => {
    set({ isTransitioning: true });

    // Trigger exit animation
    set({ notePanelVisible: false });

    // Clear state after animation completes
    setTimeout(() => {
      set({
        currentEditingNoteId: null,
        isTransitioning: false,
      });
    }, 350); // 300ms transition + 50ms buffer
  },

  // Manual transition state control
  setTransitioning: (transitioning) => set({ isTransitioning: transitioning }),
}));
