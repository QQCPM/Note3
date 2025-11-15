-- Add unique constraint on note_id in embeddings table
-- This allows ON CONFLICT to work for upserts

CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_note_unique ON embeddings(note_id);
