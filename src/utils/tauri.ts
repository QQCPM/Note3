// Tauri command wrappers with proper typing
import { invoke } from '@tauri-apps/api/core';
import type {
  Note,
  CreateNoteInput,
  Block,
  TauriBlock,
  CreateBlockInput,
  BlockData,
} from '@/types';
import { parseBlock, serializeBlockData } from './blockData';

// Note commands
export const getAllNotes = async (): Promise<Note[]> => {
  return invoke('get_all_notes');
};

export const getNoteById = async (noteId: string): Promise<Note> => {
  return invoke('get_note_by_id', { noteId });
};

export const createNote = async (input: CreateNoteInput): Promise<Note> => {
  return invoke('create_note', { input });
};

export const updateNote = async (
  noteId: string,
  input: Partial<Omit<Note, 'id' | 'created_at' | 'updated_at' | 'children'>>
): Promise<Note> => {
  return invoke('update_note', { noteId, input });
};

export const deleteNote = async (noteId: string): Promise<void> => {
  return invoke('delete_note', { noteId });
};

export const getChildNotes = async (parentId: string | null): Promise<Note[]> => {
  return invoke('get_child_notes', { parentId });
};

// Block commands
export const getBlocksByNote = async (noteId: string): Promise<Block[]> => {
  const tauriBlocks = await invoke<TauriBlock[]>('get_blocks_by_note', { noteId });
  return tauriBlocks.map(parseBlock);
};

export const createBlock = async (input: CreateBlockInput): Promise<Block> => {
  const tauriInput = {
    ...input,
    data: serializeBlockData(input.data),
  };
  const tauriBlock = await invoke<TauriBlock>('create_block', { input: tauriInput });
  return parseBlock(tauriBlock);
};

export const updateBlock = async (
  blockId: string,
  data: BlockData
): Promise<Block> => {
  const dataString = serializeBlockData(data);
  const tauriBlock = await invoke<TauriBlock>('update_block', { blockId, data: dataString });
  return parseBlock(tauriBlock);
};

export const deleteBlock = async (blockId: string): Promise<void> => {
  return invoke('delete_block', { blockId });
};
