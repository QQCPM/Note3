use crate::db::{RootNode, CreateRootNodeInput, UpdateRootNodeInput};
use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;

#[tauri::command]
pub async fn get_all_root_nodes(
    db: tauri::State<'_, SqlitePool>,
) -> Result<Vec<RootNode>, String> {
    let nodes = sqlx::query_as::<_, RootNode>(
        "SELECT * FROM root_nodes ORDER BY term ASC"
    )
    .fetch_all(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(nodes)
}

#[tauri::command]
pub async fn get_root_node_by_id(
    db: tauri::State<'_, SqlitePool>,
    node_id: String,
) -> Result<RootNode, String> {
    let node = sqlx::query_as::<_, RootNode>(
        "SELECT * FROM root_nodes WHERE id = ?"
    )
    .bind(&node_id)
    .fetch_one(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(node)
}

#[tauri::command]
pub async fn get_root_nodes_by_note(
    db: tauri::State<'_, SqlitePool>,
    note_id: String,
) -> Result<Vec<RootNode>, String> {
    let nodes = sqlx::query_as::<_, RootNode>(
        "SELECT * FROM root_nodes WHERE note_id = ? ORDER BY start_offset ASC"
    )
    .bind(&note_id)
    .fetch_all(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(nodes)
}

#[tauri::command]
pub async fn get_root_nodes_by_project(
    db: tauri::State<'_, SqlitePool>,
    project_id: Option<String>,
) -> Result<Vec<RootNode>, String> {
    let nodes = if let Some(pid) = project_id {
        sqlx::query_as::<_, RootNode>(
            "SELECT * FROM root_nodes WHERE project_id = ? OR project_id IS NULL ORDER BY term ASC"
        )
        .bind(pid)
        .fetch_all(db.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as::<_, RootNode>(
            "SELECT * FROM root_nodes WHERE project_id IS NULL ORDER BY term ASC"
        )
        .fetch_all(db.inner())
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(nodes)
}

#[tauri::command]
pub async fn search_root_nodes(
    db: tauri::State<'_, SqlitePool>,
    query: String,
    project_id: Option<String>,
) -> Result<Vec<RootNode>, String> {
    let search_pattern = format!("%{}%", query.to_lowercase());
    
    let nodes = if let Some(pid) = project_id {
        sqlx::query_as::<_, RootNode>(
            "SELECT * FROM root_nodes 
             WHERE (project_id = ? OR project_id IS NULL) 
             AND (LOWER(term) LIKE ? OR LOWER(highlighted_text) LIKE ?)
             ORDER BY 
                CASE WHEN LOWER(term) = ? THEN 0
                     WHEN LOWER(term) LIKE ? THEN 1
                     ELSE 2 END,
                term ASC
             LIMIT 20"
        )
        .bind(&pid)
        .bind(&search_pattern)
        .bind(&search_pattern)
        .bind(&query.to_lowercase())
        .bind(&format!("{}%", query.to_lowercase()))
        .fetch_all(db.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as::<_, RootNode>(
            "SELECT * FROM root_nodes 
             WHERE LOWER(term) LIKE ? OR LOWER(highlighted_text) LIKE ?
             ORDER BY 
                CASE WHEN LOWER(term) = ? THEN 0
                     WHEN LOWER(term) LIKE ? THEN 1
                     ELSE 2 END,
                term ASC
             LIMIT 20"
        )
        .bind(&search_pattern)
        .bind(&search_pattern)
        .bind(&query.to_lowercase())
        .bind(&format!("{}%", query.to_lowercase()))
        .fetch_all(db.inner())
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(nodes)
}

#[tauri::command]
pub async fn create_root_node(
    db: tauri::State<'_, SqlitePool>,
    input: CreateRootNodeInput,
) -> Result<RootNode, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let created_by = input.created_by.unwrap_or_else(|| "user".to_string());

    sqlx::query(
        "INSERT INTO root_nodes (id, term, highlighted_text, note_id, block_id, start_offset, end_offset, project_id, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&input.term)
    .bind(&input.highlighted_text)
    .bind(&input.note_id)
    .bind(&input.block_id)
    .bind(input.start_offset)
    .bind(input.end_offset)
    .bind(&input.project_id)
    .bind(&created_by)
    .bind(&now)
    .bind(&now)
    .execute(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Also insert into FTS table for search
    sqlx::query(
        "INSERT INTO root_nodes_fts (id, term, highlighted_text) VALUES (?, ?, ?)"
    )
    .bind(&id)
    .bind(&input.term)
    .bind(&input.highlighted_text)
    .execute(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    get_root_node_by_id(db, id).await
}

#[tauri::command]
pub async fn update_root_node(
    db: tauri::State<'_, SqlitePool>,
    node_id: String,
    input: UpdateRootNodeInput,
) -> Result<RootNode, String> {
    let now = Utc::now().to_rfc3339();

    let mut updates = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(term) = &input.term {
        updates.push("term = ?");
        bind_values.push(term.clone());
    }

    if let Some(highlighted_text) = &input.highlighted_text {
        updates.push("highlighted_text = ?");
        bind_values.push(highlighted_text.clone());
    }

    updates.push("updated_at = ?");
    bind_values.push(now.clone());

    if updates.len() == 1 {
        return get_root_node_by_id(db, node_id).await;
    }

    let query = format!("UPDATE root_nodes SET {} WHERE id = ?", updates.join(", "));

    let mut query_builder = sqlx::query(&query);
    for value in bind_values {
        query_builder = query_builder.bind(value);
    }
    query_builder = query_builder.bind(&node_id);

    query_builder
        .execute(db.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Update FTS table if term or highlighted_text changed
    if input.term.is_some() || input.highlighted_text.is_some() {
        let node = get_root_node_by_id(db.clone(), node_id.clone()).await?;
        
        sqlx::query("DELETE FROM root_nodes_fts WHERE id = ?")
            .bind(&node_id)
            .execute(db.inner())
            .await
            .map_err(|e| e.to_string())?;
            
        sqlx::query("INSERT INTO root_nodes_fts (id, term, highlighted_text) VALUES (?, ?, ?)")
            .bind(&node_id)
            .bind(&node.term)
            .bind(&node.highlighted_text)
            .execute(db.inner())
            .await
            .map_err(|e| e.to_string())?;
    }

    get_root_node_by_id(db, node_id).await
}

#[tauri::command]
pub async fn delete_root_node(
    db: tauri::State<'_, SqlitePool>,
    node_id: String,
) -> Result<(), String> {
    // Delete from FTS first
    sqlx::query("DELETE FROM root_nodes_fts WHERE id = ?")
        .bind(&node_id)
        .execute(db.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Delete from main table
    sqlx::query("DELETE FROM root_nodes WHERE id = ?")
        .bind(&node_id)
        .execute(db.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_root_node_by_term(
    db: tauri::State<'_, SqlitePool>,
    term: String,
    project_id: Option<String>,
) -> Result<Option<RootNode>, String> {
    let node = if let Some(pid) = project_id {
        sqlx::query_as::<_, RootNode>(
            "SELECT * FROM root_nodes WHERE LOWER(term) = LOWER(?) AND (project_id = ? OR project_id IS NULL) LIMIT 1"
        )
        .bind(&term)
        .bind(&pid)
        .fetch_optional(db.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as::<_, RootNode>(
            "SELECT * FROM root_nodes WHERE LOWER(term) = LOWER(?) LIMIT 1"
        )
        .bind(&term)
        .fetch_optional(db.inner())
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(node)
}
