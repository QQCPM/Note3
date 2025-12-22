import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Note, NoteWithChildren } from '@/types';

interface NotesState {
  notes: NoteWithChildren[];
  activeNoteId: string | null;
  expandedIds: Set<string>;
  loading: boolean;
  error: string | null;

  // Core Actions
  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (noteId: string, updates: Partial<Note>) => void;
  deleteNote: (noteId: string) => void;
  setActiveNote: (noteId: string | null) => void;

  // Expansion Actions
  toggleExpanded: (noteId: string) => void;
  expandNote: (noteId: string) => void;
  collapseNote: (noteId: string) => void;
  isExpanded: (noteId: string) => boolean;

  // Pin Actions
  togglePinned: (noteId: string) => void;
  
  // Move Actions
  moveNote: (noteId: string, newParentId: string | null, newPosition: number) => void;
  moveToProject: (noteId: string, projectId: string | null) => void;

  // Query Helpers
  getNoteById: (noteId: string) => NoteWithChildren | null;
  getChildNotes: (parentId: string | null) => NoteWithChildren[];
  
  // Filtered Views (for sidebar sections)
  getStandaloneNotes: () => NoteWithChildren[];
  getProjectNotes: (projectId: string) => NoteWithChildren[];
  getPinnedNotes: () => NoteWithChildren[];
  
  // Tree Builders
  buildNoteTree: () => NoteWithChildren[];
  buildTreeForProject: (projectId: string) => NoteWithChildren[];
  buildStandaloneTree: () => NoteWithChildren[];
}

// Helper to flatten tree for filtering
const flattenTree = (notes: NoteWithChildren[]): NoteWithChildren[] => {
  const result: NoteWithChildren[] = [];
  const traverse = (items: NoteWithChildren[]) => {
    for (const item of items) {
      result.push(item);
      if (item.children) traverse(item.children);
    }
  };
  traverse(notes);
  return result;
};

// Helper to build tree from flat list filtered by condition
const buildTreeFromFlat = (
  allNotes: NoteWithChildren[],
  filterFn: (note: NoteWithChildren) => boolean
): NoteWithChildren[] => {
  // Get all notes that match the filter
  const filtered = allNotes.filter(filterFn);
  const filteredIds = new Set(filtered.map(n => n.id));
  
  // Build tree only from filtered notes
  const noteMap = new Map<string, NoteWithChildren>();
  filtered.forEach(n => noteMap.set(n.id, { ...n, children: [] }));
  
  const roots: NoteWithChildren[] = [];
  
  filtered.forEach(note => {
    const noteWithChildren = noteMap.get(note.id)!;
    // If parent is in filtered set, add as child; otherwise treat as root
    if (note.parent_id && filteredIds.has(note.parent_id)) {
      const parent = noteMap.get(note.parent_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(noteWithChildren);
      }
    } else {
      roots.push(noteWithChildren);
    }
  });
  
  // Sort by position
  const sortByPosition = (notes: NoteWithChildren[]) => {
    notes.sort((a, b) => a.position - b.position);
    notes.forEach(note => {
      if (note.children) sortByPosition(note.children);
    });
  };
  sortByPosition(roots);
  
  return roots;
};

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      // ========================================================================
      // STATE
      // ========================================================================
      notes: [],
      activeNoteId: null,
      expandedIds: new Set<string>(),
      loading: false,
      error: null,

      // ========================================================================
      // CORE ACTIONS
      // ========================================================================
      
      setNotes: (notes) => {
        // Ensure new fields have defaults for backward compatibility
        const notesWithDefaults = notes.map(n => ({
          ...n,
          project_id: n.project_id ?? null,
          type: n.type ?? 'note' as const,
          is_pinned: n.is_pinned ?? false,
        }));
        
        const noteMap = new Map<string, NoteWithChildren>(
          notesWithDefaults.map(n => [n.id, { ...n, children: [] }])
        );

        const tree: NoteWithChildren[] = [];

        notesWithDefaults.forEach(note => {
          const noteWithChildren = noteMap.get(note.id)!;
          if (note.parent_id === null) {
            tree.push(noteWithChildren);
          } else {
            const parent = noteMap.get(note.parent_id);
            if (parent) {
              parent.children = parent.children || [];
              parent.children.push(noteWithChildren);
            } else {
              // Orphan - add to root
              tree.push(noteWithChildren);
            }
          }
        });

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
        // Ensure new fields have defaults
        const noteWithDefaults = {
          ...note,
          project_id: note.project_id ?? null,
          type: note.type ?? 'note' as const,
          is_pinned: note.is_pinned ?? false,
        };
        
        set((state) => {
          const newNote: NoteWithChildren = { ...noteWithDefaults, children: [] };
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
            if (!addToParent(notes)) {
              // Parent not found, add to root
              notes.push(newNote);
            }
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

      setActiveNote: (noteId) => {
        set({ activeNoteId: noteId });
      },

      // ========================================================================
      // EXPANSION ACTIONS
      // ========================================================================

      toggleExpanded: (noteId) => {
        set((state) => {
          const expanded = new Set(state.expandedIds);
          if (expanded.has(noteId)) {
            expanded.delete(noteId);
          } else {
            expanded.add(noteId);
          }
          return { expandedIds: expanded };
        });
      },

      expandNote: (noteId) => {
        set((state) => {
          const expanded = new Set(state.expandedIds);
          expanded.add(noteId);
          return { expandedIds: expanded };
        });
      },

      collapseNote: (noteId) => {
        set((state) => {
          const expanded = new Set(state.expandedIds);
          expanded.delete(noteId);
          return { expandedIds: expanded };
        });
      },

      isExpanded: (noteId) => {
        return get().expandedIds.has(noteId);
      },

      // ========================================================================
      // PIN ACTIONS
      // ========================================================================

      togglePinned: (noteId) => {
        const note = get().getNoteById(noteId);
        if (note) {
          get().updateNote(noteId, { is_pinned: !note.is_pinned });
        }
      },

      // ========================================================================
      // MOVE ACTIONS
      // ========================================================================

      moveNote: (noteId, newParentId, newPosition) => {
        set((state) => {
          // Find the note first
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
          
          const noteToMove = findNote(state.notes);
          if (!noteToMove) return state;
          
          // Remove from current location
          const removeFromTree = (items: NoteWithChildren[]): NoteWithChildren[] => {
            return items.filter(item => {
              if (item.id === noteId) return false;
              if (item.children) {
                item.children = removeFromTree(item.children);
              }
              return true;
            });
          };
          
          const notes = removeFromTree([...state.notes]);
          
          // Create updated note
          const updatedNote: NoteWithChildren = {
            ...noteToMove,
            parent_id: newParentId,
            position: newPosition,
          };
          
          // Insert into new location
          if (newParentId === null) {
            notes.splice(newPosition, 0, updatedNote);
          } else {
            const insertIntoParent = (items: NoteWithChildren[]): boolean => {
              for (const item of items) {
                if (item.id === newParentId) {
                  if (!item.children) item.children = [];
                  item.children.splice(newPosition, 0, updatedNote);
                  return true;
                }
                if (item.children && insertIntoParent(item.children)) {
                  return true;
                }
              }
              return false;
            };
            insertIntoParent(notes);
          }
          
          return { notes };
        });
      },

      moveToProject: (noteId, projectId) => {
        get().updateNote(noteId, { project_id: projectId });
      },

      // ========================================================================
      // QUERY HELPERS
      // ========================================================================

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

      // ========================================================================
      // FILTERED VIEWS (for sidebar sections)
      // ========================================================================

      getStandaloneNotes: () => {
        // Notes with project_id = null (not belonging to any project)
        const allNotes = flattenTree(get().notes);
        return allNotes.filter(n => n.project_id === null || n.project_id === undefined);
      },

      getProjectNotes: (projectId) => {
        // Notes belonging to a specific project
        const allNotes = flattenTree(get().notes);
        return allNotes.filter(n => n.project_id === projectId);
      },

      getPinnedNotes: () => {
        // All pinned notes regardless of project
        const allNotes = flattenTree(get().notes);
        return allNotes.filter(n => n.is_pinned);
      },

      // ========================================================================
      // TREE BUILDERS
      // ========================================================================

      buildNoteTree: () => {
        return get().notes;
      },

      buildTreeForProject: (projectId) => {
        const allNotes = flattenTree(get().notes);
        return buildTreeFromFlat(allNotes, n => n.project_id === projectId);
      },

      buildStandaloneTree: () => {
        const allNotes = flattenTree(get().notes);
        return buildTreeFromFlat(allNotes, n => n.project_id === null || n.project_id === undefined);
      },
    }),
    {
      name: 'note3-notes-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notes: state.notes,
        activeNoteId: state.activeNoteId,
        expandedIds: Array.from(state.expandedIds),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.expandedIds = new Set(state.expandedIds as unknown as string[]);
        }
      },
    }
  )
);
