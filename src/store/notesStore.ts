import { create } from 'zustand';
import { Note, NoteWithChildren } from '@/types';

interface NotesState {
  notes: NoteWithChildren[];
  activeNoteId: string | null;
  expandedNoteIds: Set<string>;
  loading: boolean;
  error: string | null;

  // Actions
  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (noteId: string, updates: Partial<Note>) => void;
  deleteNote: (noteId: string) => void;
  setActiveNote: (noteId: string | null) => void;
  toggleExpanded: (noteId: string) => void;
  expandNote: (noteId: string) => void;
  collapseNote: (noteId: string) => void;
  moveNote: (noteId: string, newParentId: string | null, newPosition: number) => void;

  // Helpers
  getNoteById: (noteId: string) => NoteWithChildren | null;
  getChildNotes: (parentId: string | null) => NoteWithChildren[];
  buildNoteTree: () => NoteWithChildren[];
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  activeNoteId: null,
  expandedNoteIds: new Set(),
  loading: false,
  error: null,

  setNotes: (notes) => {
    const noteMap = new Map<string, NoteWithChildren>(
      notes.map(n => [n.id, { ...n, children: [] }])
    );

    // Build tree structure
    const tree: NoteWithChildren[] = [];

    notes.forEach(note => {
      const noteWithChildren = noteMap.get(note.id)!;

      if (note.parent_id === null) {
        tree.push(noteWithChildren);
      } else {
        const parent = noteMap.get(note.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(noteWithChildren);
        }
      }
    });

    // Sort by position
    const sortByPosition = (notes: NoteWithChildren[]) => {
      notes.sort((a, b) => a.position - b.position);
      notes.forEach(note => {
        if (note.children) sortByPosition(note.children);
      });
    };
    sortByPosition(tree);

    set({ notes: tree });
  },

  addNote: (note) => {
    set((state) => {
      const newNote: NoteWithChildren = { ...note, children: [] };
      const notes = [...state.notes];

      if (note.parent_id === null) {
        notes.push(newNote);
      } else {
        const addToParent = (items: NoteWithChildren[]): boolean => {
          for (const item of items) {
            if (item.id === note.parent_id) {
              if (!item.children) item.children = [];
              item.children.push(newNote);
              return true;
            }
            if (item.children && addToParent(item.children)) {
              return true;
            }
          }
          return false;
        };
        addToParent(notes);
      }

      return { notes };
    });
  },

  updateNote: (noteId, updates) => {
    set((state) => {
      const updateInTree = (items: NoteWithChildren[]): NoteWithChildren[] => {
        return items.map(item => {
          if (item.id === noteId) {
            return { ...item, ...updates };
          }
          if (item.children) {
            return { ...item, children: updateInTree(item.children) };
          }
          return item;
        });
      };

      return { notes: updateInTree(state.notes) };
    });
  },

  deleteNote: (noteId) => {
    set((state) => {
      const deleteFromTree = (items: NoteWithChildren[]): NoteWithChildren[] => {
        return items.filter(item => {
          if (item.id === noteId) return false;
          if (item.children) {
            item.children = deleteFromTree(item.children);
          }
          return true;
        });
      };

      return {
        notes: deleteFromTree(state.notes),
        activeNoteId: state.activeNoteId === noteId ? null : state.activeNoteId
      };
    });
  },

  setActiveNote: (noteId) => set({ activeNoteId: noteId }),

  toggleExpanded: (noteId) => {
    set((state) => {
      const expanded = new Set(state.expandedNoteIds);
      if (expanded.has(noteId)) {
        expanded.delete(noteId);
      } else {
        expanded.add(noteId);
      }
      return { expandedNoteIds: expanded };
    });
  },

  expandNote: (noteId) => {
    set((state) => {
      const expanded = new Set(state.expandedNoteIds);
      expanded.add(noteId);
      return { expandedNoteIds: expanded };
    });
  },

  collapseNote: (noteId) => {
    set((state) => {
      const expanded = new Set(state.expandedNoteIds);
      expanded.delete(noteId);
      return { expandedNoteIds: expanded };
    });
  },

  moveNote: (noteId, newParentId, newPosition) => {
    // TODO: Implement drag-and-drop reordering
    console.log('moveNote', { noteId, newParentId, newPosition });
  },

  getNoteById: (noteId) => {
    const findNote = (items: NoteWithChildren[]): NoteWithChildren | null => {
      for (const item of items) {
        if (item.id === noteId) return item;
        if (item.children) {
          const found = findNote(item.children);
          if (found) return found;
        }
      }
      return null;
    };

    return findNote(get().notes);
  },

  getChildNotes: (parentId) => {
    if (parentId === null) {
      return get().notes;
    }

    const parent = get().getNoteById(parentId);
    return parent?.children || [];
  },

  buildNoteTree: () => {
    return get().notes;
  },
}));
