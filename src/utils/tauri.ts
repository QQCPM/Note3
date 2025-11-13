// Tauri command wrappers with proper typing
import { invoke } from '@tauri-apps/api/core';
import type {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  Block,
  CreateBlockInput,
} from '@/types';

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
  input: UpdateNoteInput
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
  return invoke('get_blocks_by_note', { noteId });
};

export const createBlock = async (input: CreateBlockInput): Promise<Block> => {
  return invoke('create_block', { input });
};

export const updateBlock = async (
  blockId: string,
  data: string
): Promise<Block> => {
  return invoke('update_block', { blockId, data });
};

export const deleteBlock = async (blockId: string): Promise<void> => {
  return invoke('delete_block', { blockId });
};
