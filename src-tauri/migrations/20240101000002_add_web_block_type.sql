-- Add 'web' block type to the CHECK constraint

-- SQLite doesn't support ALTER TABLE to modify CHECK constraints directly
-- We need to recreate the table with the new constraint

-- Step 1: Create new table with updated constraint
CREATE TABLE IF NOT EXISTS blocks_new (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('text', 'heading1', 'heading2', 'database', 'artifact', 'task', 'web')),
    position INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Copy data from old table to new table
INSERT INTO blocks_new (id, note_id, type, position, data, created_at, updated_at)
SELECT id, note_id, type, position, data, created_at, updated_at FROM blocks;

-- Step 3: Drop old table
DROP TABLE blocks;

-- Step 4: Rename new table to original name
ALTER TABLE blocks_new RENAME TO blocks;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_blocks_note ON blocks(note_id);
CREATE INDEX IF NOT EXISTS idx_blocks_position ON blocks(position);
CREATE INDEX IF NOT EXISTS idx_blocks_type ON blocks(type);
