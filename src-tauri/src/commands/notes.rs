use crate::db::{Note, CreateNoteInput, UpdateNoteInput};
use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;

#[tauri::command]
pub async fn get_all_notes(
    db: tauri::State<'_, SqlitePool>,
) -> Result<Vec<Note>, String> {
    let notes = sqlx::query_as::<_, Note>(
        "SELECT * FROM notes WHERE is_deleted = 0 ORDER BY position ASC"
    )
    .fetch_all(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(notes)
}

#[tauri::command]
pub async fn get_note_by_id(
    db: tauri::State<'_, SqlitePool>,
    note_id: String,
) -> Result<Note, String> {
    let note = sqlx::query_as::<_, Note>(
        "SELECT * FROM notes WHERE id = ? AND is_deleted = 0"
    )
    .bind(&note_id)
    .fetch_one(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(note)
}

#[tauri::command]
pub async fn create_note(
    db: tauri::State<'_, SqlitePool>,
    input: CreateNoteInput,
) -> Result<Note, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let icon = input.icon.unwrap_or_else(|| "📝".to_string());

    // Get max position for sibling notes
    let position = if let Some(pos) = input.position {
        pos
    } else {
        let max_pos: Option<i64> = sqlx::query_scalar(
            "SELECT COALESCE(MAX(position), -1) FROM notes WHERE parent_id IS ? AND is_deleted = 0"
        )
        .bind(&input.parent_id)
        .fetch_one(db.inner())
        .await
        .map_err(|e| e.to_string())?;

        max_pos.unwrap_or(-1) + 1
    };

    sqlx::query(
        "INSERT INTO notes (id, parent_id, title, icon, position, created_at, updated_at, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)"
    )
    .bind(&id)
    .bind(&input.parent_id)
    .bind(&input.title)
    .bind(&icon)
    .bind(position)
    .bind(&now)
    .bind(&now)
    .execute(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Fetch and return the created note
    get_note_by_id(db, id).await
}

#[tauri::command]
pub async fn update_note(
    db: tauri::State<'_, SqlitePool>,
    note_id: String,
    input: UpdateNoteInput,
) -> Result<Note, String> {
    let now = Utc::now().to_rfc3339();

    // Build dynamic update query
    let mut updates = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(title) = &input.title {
        updates.push("title = ?");
        bind_values.push(title.clone());
    }

    if let Some(icon) = &input.icon {
        updates.push("icon = ?");
        bind_values.push(icon.clone());
    }

    if let Some(position) = input.position {
        updates.push("position = ?");
        bind_values.push(position.to_string());
    }

    if let Some(parent_id) = &input.parent_id {
        updates.push("parent_id = ?");
        bind_values.push(parent_id.clone());
    }

    updates.push("updated_at = ?");
    bind_values.push(now.clone());

    if updates.is_empty() {
        return get_note_by_id(db, note_id).await;
    }

    let query = format!("UPDATE notes SET {} WHERE id = ?", updates.join(", "));

    let mut query_builder = sqlx::query(&query);
    for value in bind_values {
        query_builder = query_builder.bind(value);
    }
    query_builder = query_builder.bind(&note_id);

    query_builder
        .execute(db.inner())
        .await
        .map_err(|e| e.to_string())?;

    get_note_by_id(db, note_id).await
}

#[tauri::command]
pub async fn delete_note(
    db: tauri::State<'_, SqlitePool>,
    note_id: String,
) -> Result<(), String> {
    // Soft delete
    sqlx::query("UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id = ?")
        .bind(Utc::now().to_rfc3339())
        .bind(&note_id)
        .execute(db.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_child_notes(
    db: tauri::State<'_, SqlitePool>,
    parent_id: Option<String>,
) -> Result<Vec<Note>, String> {
    let notes = if let Some(pid) = parent_id {
        sqlx::query_as::<_, Note>(
            "SELECT * FROM notes WHERE parent_id = ? AND is_deleted = 0 ORDER BY position ASC"
        )
        .bind(pid)
        .fetch_all(db.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as::<_, Note>(
            "SELECT * FROM notes WHERE parent_id IS NULL AND is_deleted = 0 ORDER BY position ASC"
        )
        .fetch_all(db.inner())
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(notes)
}
