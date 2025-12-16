/**
 * Project & File Tree Types
 *
 * These types power the new unified sidebar with projects,
 * file types, and AI-generated content support.
 */

// ============================================================================
// FILE TYPES
// ============================================================================

export type FileType =
  | 'note'       // Internal note (editable)
  | 'folder'     // Container for organization
  | 'pdf'        // PDF documents
  | 'video'      // Video files (.mp4, .mov, .webm)
  | 'audio'      // Audio files (.mp3, .m4a, .wav)
  | 'markdown'   // Markdown files (.md)
  | 'link'       // Web bookmarks
  | 'image';     // Images (.png, .jpg, .svg)

export type ItemStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'skipped';

export type ItemOrigin =
  | 'user'         // Created by user
  | 'ai_generated' // Created by AI
  | 'imported';    // Imported from file

// ============================================================================
// PROJECT TYPES
// ============================================================================

export type ProjectType = 'study' | 'roadmap' | 'general';
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface ProjectSettings {
  defaultNoteDepth: 'brief' | 'detailed' | 'comprehensive';
  includeFlashcards: boolean;
  includePractice: boolean;
  includeQuizzes: boolean;
  aiAssistEnabled: boolean;
  dailyTimeGoal?: number; // minutes
}

export interface Project {
  id: string;
  name: string;
  icon: string;
  type: ProjectType;
  description?: string;
  createdAt: string;
  updatedAt: string;
  progress: number; // 0-100
  status: ProjectStatus;
  settings: ProjectSettings;
  // For roadmap projects
  targetDate?: string;
  startDate?: string;
}

export interface CreateProjectInput {
  name: string;
  icon?: string;
  type: ProjectType;
  description?: string;
  settings?: Partial<ProjectSettings>;
  targetDate?: string;
}

// ============================================================================
// TREE ITEM TYPES
// ============================================================================

export interface AIMetadata {
  generatedFrom?: string;     // Source item ID
  generationPrompt?: string;  // What prompt was used
  canRegenerate: boolean;     // Can be regenerated
  generatedAt?: string;       // When it was generated
  model?: string;             // AI model used
}

export interface TreeItem {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  type: FileType;
  origin: ItemOrigin;
  status: ItemStatus;
  position: number;

  // For source files (pdf, video, audio, image)
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;      // For video/audio in seconds
  pageCount?: number;     // For PDFs

  // For notes
  noteId?: string;        // Reference to notes table

  // For links
  url?: string;
  favicon?: string;

  // For folders
  childCount?: number;

  // Progress & metadata
  progress?: number;      // 0-100
  dueDate?: string;
  isPinned: boolean;
  isExpanded?: boolean;

  // AI metadata
  aiMetadata?: AIMetadata;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface TreeItemWithChildren extends TreeItem {
  children: TreeItemWithChildren[];
}

export interface CreateTreeItemInput {
  projectId: string;
  parentId?: string | null;
  name: string;
  type: FileType;
  origin?: ItemOrigin;
  filePath?: string;
  url?: string;
  noteId?: string;
  fileSize?: number;
}

// ============================================================================
// TODAY'S TASKS (For Learning Secretary)
// ============================================================================

export type TaskType = 'learn' | 'practice' | 'review' | 'project';
export type TaskStatus = 'planned' | 'in_progress' | 'completed' | 'skipped' | 'rescheduled';

export interface TodayTask {
  id: string;
  projectId: string;
  treeItemId?: string;     // Related tree item (note/folder)
  title: string;
  description?: string;
  taskType: TaskType;
  scheduledDate: string;
  scheduledTime?: string;   // HH:MM format
  durationMinutes: number;
  status: TaskStatus;
  completedAt?: string;
  userRating?: number;      // 1-5 how it felt
  sourceType?: string;      // 'book', 'video', 'generated'
  sourceReference?: string; // note_id, URL, etc.
}

// ============================================================================
// SIDEBAR STATE
// ============================================================================

export interface SidebarSection {
  id: string;
  title: string;
  isExpanded: boolean;
}

export interface DragState {
  isDragging: boolean;
  draggedItem: TreeItem | null;
  dropTarget: string | null;
  dropPosition: 'before' | 'after' | 'inside' | null;
}

// ============================================================================
// FILE TYPE UTILITIES
// ============================================================================

export const FILE_TYPE_CONFIG: Record<FileType, {
  icon: string;
  label: string;
  extensions: string[];
  canHaveChildren: boolean;
  canEdit: boolean;
  canPreview: boolean;
}> = {
  note: {
    icon: '📄',
    label: 'Note',
    extensions: [],
    canHaveChildren: false,
    canEdit: true,
    canPreview: true,
  },
  folder: {
    icon: '📁',
    label: 'Folder',
    extensions: [],
    canHaveChildren: true,
    canEdit: false,
    canPreview: false,
  },
  pdf: {
    icon: '📕',
    label: 'PDF',
    extensions: ['.pdf'],
    canHaveChildren: false,
    canEdit: false,
    canPreview: true,
  },
  video: {
    icon: '🎥',
    label: 'Video',
    extensions: ['.mp4', '.mov', '.webm', '.avi'],
    canHaveChildren: false,
    canEdit: false,
    canPreview: true,
  },
  audio: {
    icon: '🎵',
    label: 'Audio',
    extensions: ['.mp3', '.m4a', '.m4p', '.wav', '.ogg', '.aac'],
    canHaveChildren: false,
    canEdit: false,
    canPreview: true,
  },
  markdown: {
    icon: '📝',
    label: 'Markdown',
    extensions: ['.md', '.markdown'],
    canHaveChildren: false,
    canEdit: true,
    canPreview: true,
  },
  link: {
    icon: '🔗',
    label: 'Link',
    extensions: [],
    canHaveChildren: false,
    canEdit: false,
    canPreview: true,
  },
  image: {
    icon: '🖼️',
    label: 'Image',
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
    canHaveChildren: false,
    canEdit: false,
    canPreview: true,
  },
};

/**
 * Get file type from file extension
 */
export function getFileTypeFromExtension(filename: string): FileType | null {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));

  for (const [type, config] of Object.entries(FILE_TYPE_CONFIG)) {
    if (config.extensions.includes(ext)) {
      return type as FileType;
    }
  }

  return null;
}

/**
 * Get icon for a tree item based on type and state
 */
export function getTreeItemIcon(item: TreeItem): string {
  // AI-generated items get special treatment
  if (item.origin === 'ai_generated') {
    if (item.type === 'folder') return '📁';
    if (item.type === 'note') return '📄';
  }

  return FILE_TYPE_CONFIG[item.type]?.icon || '📄';
}

/**
 * Check if a file type can have children
 */
export function canHaveChildren(type: FileType): boolean {
  return FILE_TYPE_CONFIG[type]?.canHaveChildren || false;
}
