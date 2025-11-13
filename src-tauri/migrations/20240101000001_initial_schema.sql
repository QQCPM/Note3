-- Initial database schema for Weave

-- Notes table (hierarchical structure)
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '📝',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_notes_parent ON notes(parent_id);
CREATE INDEX IF NOT EXISTS idx_notes_position ON notes(position);
CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(is_deleted);

-- Note content (versioned)
CREATE TABLE IF NOT EXISTS note_content (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_note_content_note ON note_content(note_id);
CREATE INDEX IF NOT EXISTS idx_note_content_version ON note_content(note_id, version DESC);

-- Blocks (databases, artifacts, tasks within notes)
CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('text', 'heading1', 'heading2', 'database', 'artifact', 'task')),
    position INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blocks_note ON blocks(note_id);
CREATE INDEX IF NOT EXISTS idx_blocks_position ON blocks(position);
CREATE INDEX IF NOT EXISTS idx_blocks_type ON blocks(type);

-- Database rows (for database blocks)
CREATE TABLE IF NOT EXISTS database_rows (
    id TEXT PRIMARY KEY,
    block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_database_rows_block ON database_rows(block_id);
CREATE INDEX IF NOT EXISTS idx_database_rows_position ON database_rows(position);

-- Artifacts (stored code)
CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    html TEXT,
    css TEXT,
    javascript TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artifacts_block ON artifacts(block_id);

-- AI conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,
    note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_note ON ai_conversations(note_id);

-- AI messages
CREATE TABLE IF NOT EXISTS ai_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);

-- Embeddings (for semantic search)
CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    embedding BLOB NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_embeddings_note ON embeddings(note_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON embeddings(content_hash);

-- MCP server configurations
CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '🔌',
    enabled BOOLEAN NOT NULL DEFAULT 1,
    config TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Skills configurations
CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '✨',
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT 0,
    instructions TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skills_enabled ON skills(enabled);
CREATE INDEX IF NOT EXISTS idx_skills_priority ON skills(priority DESC);

-- Full-text search for notes
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    note_id,
    title,
    content
);

-- Insert default skills
INSERT OR IGNORE INTO skills (id, name, icon, description, enabled, instructions, priority) VALUES
('skill-note-writer', 'Note Writer', '📝', 'Expert note-taking with structure', 1, 'You are an expert note-taker specialized in creating well-structured, comprehensive notes.', 100),
('skill-code-gen', 'Code Generator', '💻', 'Generate clean, production-ready code', 1, 'You are a senior software engineer specialized in creating clean, production-ready code.', 90),
('skill-data-analyzer', 'Data Analyzer', '📊', 'Analyze structured data and databases', 1, 'You are a data scientist specialized in analyzing structured data.', 80);
