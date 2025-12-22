-- Root Nodes table for in-place definitions with cross-note linking
-- A root node is a highlighted piece of text that becomes a referenceable definition

CREATE TABLE IF NOT EXISTS root_nodes (
    id TEXT PRIMARY KEY,
    term TEXT NOT NULL,                    -- The @mention trigger (e.g., "Backpropagation")
    highlighted_text TEXT NOT NULL,        -- The full definition text
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    start_offset INTEGER NOT NULL,         -- Character position start within block
    end_offset INTEGER NOT NULL,           -- Character position end within block
    project_id TEXT,                       -- Optional: scope to specific project
    created_by TEXT NOT NULL DEFAULT 'user' CHECK(created_by IN ('user', 'ai')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast @mention lookups
CREATE INDEX IF NOT EXISTS idx_root_nodes_term ON root_nodes(term);

-- Index for finding root nodes in a specific note
CREATE INDEX IF NOT EXISTS idx_root_nodes_note ON root_nodes(note_id);

-- Index for finding root nodes in a specific block
CREATE INDEX IF NOT EXISTS idx_root_nodes_block ON root_nodes(block_id);

-- Index for project-scoped queries
CREATE INDEX IF NOT EXISTS idx_root_nodes_project ON root_nodes(project_id);

-- Full-text search for root node terms (for fuzzy @mention matching)
CREATE VIRTUAL TABLE IF NOT EXISTS root_nodes_fts USING fts5(
    id,
    term,
    highlighted_text
);
