// Note types matching database schema

export interface Note {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string;
  position: number;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
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
}

export interface UpdateNoteInput {
  id: string;
  title?: string;
  icon?: string;
  position?: number;
  parent_id?: string | null;
}
