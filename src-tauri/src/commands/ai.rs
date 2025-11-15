use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use crate::db::{Note, Block};

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteWithBlocks {
    pub note: Note,
    pub blocks: Vec<Block>,
}

/// Get a note with all its blocks - for AI context
#[tauri::command]
pub async fn get_note_with_blocks(
    db: tauri::State<'_, SqlitePool>,
    note_id: String,
) -> Result<NoteWithBlocks, String> {
    // Get the note
    let note = sqlx::query_as::<_, Note>(
        "SELECT * FROM notes WHERE id = ? AND is_deleted = 0"
    )
    .bind(&note_id)
    .fetch_one(db.inner())
    .await
    .map_err(|e| format!("Note not found: {}", e))?;

    // Get all blocks for this note
    let blocks = sqlx::query_as::<_, Block>(
        "SELECT * FROM blocks WHERE note_id = ? ORDER BY position ASC"
    )
    .bind(&note_id)
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("Failed to fetch blocks: {}", e))?;

    Ok(NoteWithBlocks { note, blocks })
}
