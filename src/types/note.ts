// Note types matching database schema

export type NoteType = 'note' | 'folder';

export interface Note {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string;
  position: number;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  // New fields for unified sidebar
  project_id: string | null;  // null = standalone, otherwise belongs to project
  type: NoteType;             // 'note' or 'folder' (folders can have children)
  is_pinned: boolean;         // appears in pinned section
}

export interface NoteContent {
  id: string;
  note_id: string;
  content: string; // JSON: Lexical editor state
  version: number;
  created_at: string;
}

export interface NoteWithChildren extends Note {
  children?: NoteWithChildren[];
  isExpanded?: boolean;
}

export interface CreateNoteInput {
  parent_id?: string | null;
  title: string;
  icon?: string;
  position?: number;
  project_id?: string | null;
  type?: NoteType;
  is_pinned?: boolean;
}

export interface UpdateNoteInput {
  id: string;
  title?: string;
  icon?: string;
  position?: number;
  parent_id?: string | null;
  project_id?: string | null;
  type?: NoteType;
  is_pinned?: boolean;
}
