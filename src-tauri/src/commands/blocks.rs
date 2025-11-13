use crate::db::{Block, CreateBlockInput};
use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;

#[tauri::command]
pub async fn get_blocks_by_note(
    db: tauri::State<'_, SqlitePool>,
    note_id: String,
) -> Result<Vec<Block>, String> {
    let blocks = sqlx::query_as::<_, Block>(
        "SELECT * FROM blocks WHERE note_id = ? ORDER BY position ASC"
    )
    .bind(&note_id)
    .fetch_all(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(blocks)
}

#[tauri::command]
pub async fn create_block(
    db: tauri::State<'_, SqlitePool>,
    input: CreateBlockInput,
) -> Result<Block, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    // Get max position for blocks in this note
    let position = if let Some(pos) = input.position {
        pos
    } else {
        let max_pos: Option<i64> = sqlx::query_scalar(
            "SELECT COALESCE(MAX(position), -1) FROM blocks WHERE note_id = ?"
        )
        .bind(&input.note_id)
        .fetch_one(db.inner())
        .await
        .map_err(|e| e.to_string())?;

        max_pos.unwrap_or(-1) + 1
    };

    sqlx::query(
        "INSERT INTO blocks (id, note_id, type, position, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&input.note_id)
    .bind(&input.block_type)
    .bind(position)
    .bind(&input.data)
    .bind(&now)
    .bind(&now)
    .execute(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Fetch and return the created block
    let block = sqlx::query_as::<_, Block>(
        "SELECT * FROM blocks WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(block)
}

#[tauri::command]
pub async fn update_block(
    db: tauri::State<'_, SqlitePool>,
    block_id: String,
    data: String,
) -> Result<Block, String> {
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE blocks SET data = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&data)
    .bind(&now)
    .bind(&block_id)
    .execute(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Fetch and return the updated block
    let block = sqlx::query_as::<_, Block>(
        "SELECT * FROM blocks WHERE id = ?"
    )
    .bind(&block_id)
    .fetch_one(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(block)
}

#[tauri::command]
pub async fn delete_block(
    db: tauri::State<'_, SqlitePool>,
    block_id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM blocks WHERE id = ?")
        .bind(&block_id)
        .execute(db.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
