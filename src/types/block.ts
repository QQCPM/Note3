// Block types matching database schema

export type BlockType = 'text' | 'heading1' | 'heading2' | 'database' | 'artifact' | 'task' | 'web';

export interface Block {
  id: string;
  note_id: string;
  type: BlockType;
  position: number;
  data: string; // JSON string
  created_at: string;
  updated_at: string;
}

export type BlockData =
  | TextBlockData
  | HeadingBlockData
  | DatabaseBlockData
  | ArtifactBlockData
  | TaskBlockData
  | WebBlockData;

// Text Block
export interface TextBlockData {
  type: 'text';
  content: string;
}

// Heading Block
export interface HeadingBlockData {
  type: 'heading1' | 'heading2';
  content: string;
}

// Database Block
export interface DatabaseBlockData {
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
export interface ArtifactBlockData {
  type: 'artifact';
  title: string;
  html: string;
  css: string;
  javascript: string;
  prompt?: string; // Original AI prompt
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
export interface TaskBlockData {
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

// Web Block
export interface WebBlockData {
  type: 'web';
  url: string;
  title?: string;
  height?: number; // Custom height in pixels
  prompt?: string; // Original prompt if AI-generated
}

// Block creation inputs
export interface CreateBlockInput {
  note_id: string;
  type: BlockType;
  position?: number;
  data: string; // JSON string
}

export interface UpdateBlockInput {
  id: string;
  type?: BlockType;
  position?: number;
  data?: string; // JSON string
}
