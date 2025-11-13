import { create } from 'zustand';
import { Block } from '@/types';

interface BlocksState {
  blocks: Block[];
  loading: boolean;
  error: string | null;

  // Actions
  setBlocks: (blocks: Block[]) => void;
  addBlock: (block: Block) => void;
  updateBlock: (blockId: string, updates: Partial<Block>) => void;
  deleteBlock: (blockId: string) => void;
  reorderBlocks: (noteId: string, blockIds: string[]) => void;

  // Helpers
  getBlocksByNoteId: (noteId: string) => Block[];
  getBlockById: (blockId: string) => Block | null;
}

export const useBlocksStore = create<BlocksState>((set, get) => ({
  blocks: [],
  loading: false,
  error: null,

  setBlocks: (blocks) => {
    // Sort by position
    const sorted = [...blocks].sort((a, b) => a.position - b.position);
    set({ blocks: sorted });
  },

  addBlock: (block) => {
    set((state) => {
      const blocks = [...state.blocks, block];
      blocks.sort((a, b) => a.position - b.position);
      return { blocks };
    });
  },

  updateBlock: (blockId, updates) => {
    set((state) => ({
      blocks: state.blocks.map(block =>
        block.id === blockId ? { ...block, ...updates } : block
      )
    }));
  },

  deleteBlock: (blockId) => {
    set((state) => ({
      blocks: state.blocks.filter(block => block.id !== blockId)
    }));
  },

  reorderBlocks: (noteId, blockIds) => {
    set((state) => {
      const blocks = state.blocks.map(block => {
        if (block.note_id === noteId) {
          const newPosition = blockIds.indexOf(block.id);
          return newPosition !== -1 ? { ...block, position: newPosition } : block;
        }
        return block;
      });
      return { blocks };
    });
  },

  getBlocksByNoteId: (noteId) => {
    return get().blocks.filter(block => block.note_id === noteId);
  },

  getBlockById: (blockId) => {
    return get().blocks.find(block => block.id === blockId) || null;
  },
}));
