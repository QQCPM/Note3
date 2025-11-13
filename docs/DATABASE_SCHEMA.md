# Weave Database Schema

## Overview
SQLite database with full-text search and vector embeddings for semantic search.

## Core Tables

### notes
Hierarchical note structure with parent-child relationships.

```sql
CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES notes(id),
    title TEXT NOT NULL,
    icon TEXT,
    position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_notes_parent ON notes(parent_id);
CREATE INDEX idx_notes_position ON notes(position);
```

### note_content
Versioned content storage using Lexical editor state (JSON).

```sql
CREATE TABLE note_content (
    id TEXT PRIMARY KEY,
    note_id TEXT REFERENCES notes(id),
    content TEXT NOT NULL, -- JSON: Lexical editor state
    version INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### blocks
Individual content blocks within notes (databases, artifacts, tasks, text).

```sql
CREATE TABLE blocks (
    id TEXT PRIMARY KEY,
    note_id TEXT REFERENCES notes(id),
    type TEXT NOT NULL, -- 'database', 'artifact', 'task', 'heading', 'text'
    position INTEGER NOT NULL,
    data TEXT NOT NULL, -- JSON: block-specific data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_blocks_note ON blocks(note_id);
CREATE INDEX idx_blocks_position ON blocks(position);
```

### database_rows
Rows for database blocks with flexible JSON data storage.

```sql
CREATE TABLE database_rows (
    id TEXT PRIMARY KEY,
    block_id TEXT REFERENCES blocks(id),
    data TEXT NOT NULL, -- JSON: row data
    position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### artifacts
Code storage for artifact blocks.

```sql
CREATE TABLE artifacts (
    id TEXT PRIMARY KEY,
    block_id TEXT REFERENCES blocks(id),
    html TEXT,
    css TEXT,
    javascript TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## AI Tables

### ai_conversations
Conversation threads associated with notes.

```sql
CREATE TABLE ai_conversations (
    id TEXT PRIMARY KEY,
    note_id TEXT REFERENCES notes(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ai_messages
Individual messages in conversations.

```sql
CREATE TABLE ai_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT REFERENCES ai_conversations(id),
    role TEXT NOT NULL, -- 'user', 'assistant'
    content TEXT NOT NULL,
    model TEXT, -- which AI model was used
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id);
```

### embeddings
Vector embeddings for semantic search.

```sql
CREATE TABLE embeddings (
    id TEXT PRIMARY KEY,
    note_id TEXT REFERENCES notes(id),
    content_hash TEXT NOT NULL,
    embedding BLOB NOT NULL, -- Vector embedding
    model TEXT NOT NULL, -- embedding model used
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_embeddings_note ON embeddings(note_id);
```

## MCP & Skills Tables

### mcp_servers
MCP server configurations.

```sql
CREATE TABLE mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    config TEXT NOT NULL, -- JSON: server configuration
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### skills
AI skill definitions.

```sql
CREATE TABLE skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    instructions TEXT NOT NULL, -- Skill prompt/instructions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Full-Text Search

```sql
CREATE VIRTUAL TABLE notes_fts USING fts5(
    note_id,
    title,
    content,
    content='notes'
);
```

## Data Models (TypeScript)

```typescript
interface Note {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string;
  position: number;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

interface Block {
  id: string;
  note_id: string;
  type: 'database' | 'artifact' | 'task' | 'heading' | 'text';
  position: number;
  data: any; // Type-specific data
  created_at: string;
  updated_at: string;
}

interface DatabaseBlock {
  id: string;
  columns: Array<{
    id: string;
    name: string;
    type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  }>;
  view: 'table' | 'gallery' | 'calendar';
}

interface ArtifactBlock {
  id: string;
  html: string;
  css: string;
  javascript: string;
}

interface TaskBlock {
  id: string;
  tasks: Array<{
    id: string;
    text: string;
    completed: boolean;
    priority?: 'low' | 'medium' | 'high';
  }>;
}
```

## Migration Strategy

Use SQLx CLI for migrations:

```bash
# Create new migration
sqlx migrate add initial_schema

# Run migrations
sqlx migrate run

# Revert migration
sqlx migrate revert
```

## Query Patterns

### Hierarchical Notes
```sql
-- Get all child notes
WITH RECURSIVE note_tree AS (
  SELECT * FROM notes WHERE parent_id = ?
  UNION ALL
  SELECT n.* FROM notes n
  INNER JOIN note_tree nt ON n.parent_id = nt.id
)
SELECT * FROM note_tree;
```

### Semantic Search
```sql
-- Find similar notes using cosine similarity
SELECT n.*,
       1 - (e.embedding <=> ?) as similarity
FROM notes n
JOIN embeddings e ON e.note_id = n.id
ORDER BY similarity DESC
LIMIT 10;
```
