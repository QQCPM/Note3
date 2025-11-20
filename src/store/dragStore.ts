import { create } from 'zustand';

// What is being dragged
export interface DraggedNote {
  noteId: string;
  title: string;
  icon: string;
}

interface DragState {
  // Drag state
  isDragging: boolean;
  draggedNote: DraggedNote | null;

  // Current mouse position (screen coordinates - clientX/clientY)
  mousePosition: { x: number; y: number } | null;

  // Actions
  startDrag: (note: DraggedNote, initialPosition: { x: number; y: number }) => void;
  updateDragPosition: (position: { x: number; y: number }) => void;
  endDrag: () => void;
}

export const useDragStore = create<DragState>((set) => ({
  isDragging: false,
  draggedNote: null,
  mousePosition: null,

  startDrag: (note, initialPosition) => set({
    isDragging: true,
    draggedNote: note,
    mousePosition: initialPosition,
  }),

  updateDragPosition: (position) => set((state) => {
    if (!state.isDragging) return state;
    return { mousePosition: position };
  }),

  endDrag: () => set({
    isDragging: false,
    draggedNote: null,
    mousePosition: null,
  }),
}));
