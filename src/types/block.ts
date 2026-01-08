// Block types matching database schema

export type BlockType = 'text' | 'heading1' | 'heading2' | 'database' | 'artifact' | 'task' | 'quiz' | 'web';

// Tauri boundary type - has string data from Rust
export interface TauriBlock {
  id: string;
  note_id: string;
  type: BlockType;
  position: number;
  data: string; // JSON string from Rust
  created_at: string;
  updated_at: string;
}

// Frontend type - has typed data
export interface Block {
  id: string;
  note_id: string;
  type: BlockType;
  position: number;
  data: BlockData; // Typed data for frontend use
  created_at: string;
  updated_at: string;
}

// Common layout properties for all blocks
export interface BlockLayout {
  width?: 'full' | 'half' | 'third' | 'quarter' | number; // number is percentage 0-100
  alignment?: 'left' | 'center' | 'right';
}

export type BlockData =
  | TextBlockData
  | HeadingBlockData
  | DatabaseBlockData
  | ArtifactBlockData
  | TaskBlockData
  | QuizBlockData
  | WebBlockData;

// Text Block
export interface TextBlockData extends BlockLayout {
  type: 'text';
  content: string;
}

// Heading Block
export interface HeadingBlockData extends BlockLayout {
  type: 'heading1' | 'heading2';
  content: string;
}

// Database Block
export interface DatabaseBlockData extends BlockLayout {
  type: 'database';
  title: string;
  columns: DatabaseColumn[];
  rows: DatabaseRowData[];
  view: 'table' | 'gallery' | 'calendar';
}

export interface DatabaseRowData {
  id: string;
  data: Record<string, any>; // Column name -> value
}

export interface DatabaseColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  options?: string[]; // For select type
  width?: number;
}

export interface DatabaseRow {
  id: string;
  block_id: string;
  data: Record<string, any>; // Column ID -> value
  position: number;
  created_at: string;
  updated_at: string;
}

// Artifact Block
export interface ArtifactBlockData extends BlockLayout {
  type: 'artifact';
  title: string;
  html: string;
  css: string;
  javascript: string;
  prompt?: string; // Original AI prompt
  customWidth?: number; // Custom width in pixels (for resize handle)
  customHeight?: number; // Custom height in pixels (for resize handle)
}

export interface Artifact {
  id: string;
  block_id: string;
  html: string;
  css: string;
  javascript: string;
  created_at: string;
  updated_at: string;
}

// Task Block
export interface TaskBlockData extends BlockLayout {
  type: 'task';
  title: string;
  tasks: Task[];
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
}

// Quiz Block
export interface QuizBlockData extends BlockLayout {
  type: 'quiz';
  title: string;
  problems: QuizProblem[];
}

export interface QuizProblem {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  selectedIndex?: number; // User's answer
  revealed?: boolean; // Whether the answer has been revealed
}

// Web Block
export interface WebBlockData extends BlockLayout {
  type: 'web';
  url: string;
  title?: string;
  customWidth?: number; // Custom width in pixels (for resize handle)
  customHeight?: number; // Custom height in pixels (for resize handle)
  prompt?: string; // Original prompt if AI-generated
}

// Block creation inputs (for Tauri)
export interface CreateBlockInput {
  note_id: string;
  type: BlockType;
  position?: number;
  data: BlockData; // Will be serialized to JSON string in tauri.ts
}

export interface UpdateBlockInput {
  id: string;
  type?: BlockType;
  position?: number;
  data?: string; // JSON string
}
