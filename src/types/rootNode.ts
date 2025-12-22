// Root Node - in-place definition with cross-note linking
// A root node is a highlighted piece of text that becomes a referenceable definition

export interface RootNode {
  id: string;
  term: string;                    // The @mention trigger (e.g., "Backpropagation")
  highlighted_text: string;        // The full definition text
  note_id: string;                 // Source note where definition lives
  block_id: string;                // Source block in that note
  start_offset: number;            // Character position start within block
  end_offset: number;              // Character position end within block
  project_id: string | null;       // Optional: scope to specific project
  created_by: 'user' | 'ai';       // Who created this root node
  created_at: string;
  updated_at: string;
}

export interface CreateRootNodeInput {
  term: string;
  highlighted_text: string;
  note_id: string;
  block_id: string;
  start_offset: number;
  end_offset: number;
  project_id?: string | null;
  created_by?: 'user' | 'ai';
}

export interface UpdateRootNodeInput {
  term?: string;
  highlighted_text?: string;
}

// For the @mention dropdown - combined view of root nodes and notes
export interface MentionableItem {
  type: 'root_node' | 'note' | 'file';
  id: string;
  label: string;                   // Display name in dropdown
  description?: string;            // Optional description/preview
  icon?: string;                   // Icon to show
  // For root nodes
  rootNode?: RootNode;
  // For notes
  noteId?: string;
  notePath?: string;
}

// Navigation target when clicking a root node reference
export interface RootNodeNavigationTarget {
  note_id: string;
  block_id: string;
  start_offset: number;
  end_offset: number;
}
