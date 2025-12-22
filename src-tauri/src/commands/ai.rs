use crate::ai::{AIConfig, AIManager, Message, Tool, ToolCall, PersistedConfig};
use tauri::{State, AppHandle};
use std::sync::Arc;
use tokio::sync::RwLock;

// Global AI manager state
pub struct AIState {
    pub manager: Arc<RwLock<Option<AIManager>>>,
}

impl AIState {
    pub fn new() -> Self {
        Self {
            manager: Arc::new(RwLock::new(None)),
        }
    }

    /// Helper to get a cloned AIManager instance or return an error if not initialized
    pub async fn get_ai_manager(&self) -> Result<AIManager, String> {
        let manager_lock = self.manager.read().await;
        manager_lock
            .as_ref()
            .cloned()
            .ok_or("AI not initialized".to_string())
    }
}

/// Initialize the AI system with configuration
#[tauri::command]
pub async fn ai_initialize(
    config: AIConfig,
    state: State<'_, AIState>,
) -> Result<(), String> {
    let manager = AIManager::new(config);

    // Health check (silently check - status available via ai_health_check command)
    let _health = manager.health_check().await?;

    // NOTE: We don't print warnings here - graceful degradation
    // Users can check service status in the Settings tab UI
    // Embedding service is optional - app works fine without it

    *state.manager.write().await = Some(manager);

    Ok(())
}

/// Get current AI configuration
#[tauri::command]
pub async fn ai_get_config(state: State<'_, AIState>) -> Result<Option<AIConfig>, String> {
    let manager_lock = state.manager.read().await;

    Ok(manager_lock.as_ref().map(|m| m.config.clone()))
}

/// Load persisted configuration from disk
#[tauri::command]
pub async fn ai_load_persisted_config(app_handle: AppHandle) -> Result<PersistedConfig, String> {
    use tauri::Manager;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    PersistedConfig::load(&app_data_dir)
}

/// Save configuration to disk
#[tauri::command]
pub async fn ai_save_config(
    config: PersistedConfig,
    app_handle: AppHandle,
) -> Result<(), String> {
    use tauri::Manager;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    config.save(&app_data_dir)
}

/// Update AI configuration and save to disk
#[tauri::command]
pub async fn ai_update_and_save_config(
    config: PersistedConfig,
    app_handle: AppHandle,
    state: State<'_, AIState>,
) -> Result<(), String> {
    use tauri::Manager;
    // Save to disk first
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    config.save(&app_data_dir)?;

    // Convert to AIConfig and reinitialize
    let ai_config = config.to_ai_config();
    let manager = AIManager::new(ai_config);

    // Health check (silently check - status available via ai_health_check command)
    let _health = manager.health_check().await?;

    // NOTE: We don't print warnings here - graceful degradation
    // Users can check service status in the Settings tab UI

    // Update the running manager
    *state.manager.write().await = Some(manager);

    Ok(())
}

/// Check health status of AI services
#[tauri::command]
pub async fn ai_health_check(
    state: State<'_, AIState>,
) -> Result<crate::ai::HealthStatus, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized. Call ai_initialize first.")?;

    manager.health_check().await
}

/// Generate embedding for text (using local model)
#[tauri::command]
pub async fn ai_generate_embedding(
    text: String,
    state: State<'_, AIState>,
) -> Result<Vec<f32>, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    manager.embedding_service.generate(&text).await
}

/// Generate embeddings for multiple texts (batched, local model)
#[tauri::command]
pub async fn ai_generate_embeddings_batch(
    texts: Vec<String>,
    state: State<'_, AIState>,
) -> Result<Vec<Vec<f32>>, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    manager.embedding_service.generate_batch(texts).await
}

/// Generate artifact using LOCAL Qwen3-30B-Coder, Ollama Cloud (GLM-4.6), or OpenAI
#[tauri::command]
pub async fn ai_generate_artifact(
    prompt: String,
    state: State<'_, AIState>,
) -> Result<crate::ai::ArtifactResult, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    // Try local first if available
    if let Some(ref service) = manager.local_code_service {
        match service.generate_artifact(&prompt).await {
            Ok(result) => return Ok(result),
            Err(e) => {
                eprintln!("Local code generation failed: {}", e);
            }
        }
    }

    // Try Ollama Cloud (GLM-4.6) if configured
    if let Some(ref service) = manager.ollama_cloud_service {
        match service.generate_artifact(&prompt).await {
            Ok(result) => return Ok(result),
            Err(e) => {
                eprintln!("Ollama Cloud (GLM-4.6) failed, falling back to OpenAI: {}", e);
            }
        }
    }

    // Fallback to OpenAI
    manager.api_code_service.generate_artifact(&prompt).await
}

/// Generate database schema using LOCAL, Ollama Cloud (GLM-4.6), or OpenAI
#[tauri::command]
pub async fn ai_generate_database(
    prompt: String,
    state: State<'_, AIState>,
) -> Result<crate::ai::DatabaseResult, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    // Try local first if available
    let mut result = if let Some(ref service) = manager.local_code_service {
        match service.generate_database(&prompt).await {
            Ok(result) => result,
            Err(e) => {
                eprintln!("Local database generation failed: {}", e);
                // Try Ollama Cloud next
                if let Some(ref ollama) = manager.ollama_cloud_service {
                    match ollama.generate_database(&prompt).await {
                        Ok(result) => result,
                        Err(e2) => {
                            eprintln!("Ollama Cloud failed: {}", e2);
                            manager.agent_service.generate_database(&prompt).await?
                        }
                    }
                } else {
                    manager.agent_service.generate_database(&prompt).await?
                }
            }
        }
    } else if let Some(ref service) = manager.ollama_cloud_service {
        // Try Ollama Cloud (GLM-4.6)
        match service.generate_database(&prompt).await {
            Ok(result) => result,
            Err(e) => {
                eprintln!("Ollama Cloud failed, falling back to OpenAI: {}", e);
                manager.agent_service.generate_database(&prompt).await?
            }
        }
    } else {
        // Fallback to OpenAI
        manager.agent_service.generate_database(&prompt).await?
    };

    // Ensure all columns have IDs (safety check)
    for column in &mut result.columns {
        if column.id.is_empty() {
            column.id = uuid::Uuid::new_v4().to_string();
        }
    }

    Ok(result)
}

/// Chat with AI agent (using GPT for reasoning)
#[tauri::command]
pub async fn ai_chat(
    messages: Vec<Message>,
    state: State<'_, AIState>,
) -> Result<String, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    let (response, _tool_calls) = manager.agent_service.chat(messages, None).await?;

    Ok(response)
}

/// Chat with AI agent with tool support (function calling)
#[tauri::command]
pub async fn ai_chat_with_tools(
    messages: Vec<Message>,
    tools: Vec<Tool>,
    state: State<'_, AIState>,
) -> Result<ChatWithToolsResponse, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    let (response, tool_calls) = manager.agent_service.chat_with_tools(messages, tools).await?;

    Ok(ChatWithToolsResponse {
        content: response,
        tool_calls,
    })
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ChatWithToolsResponse {
    pub content: String,
    pub tool_calls: Vec<ToolCall>,
}

/// Rerank search results using local Qwen3-Reranker-4B
#[tauri::command]
pub async fn ai_rerank(
    query: String,
    documents: Vec<String>,
    state: State<'_, AIState>,
) -> Result<Vec<f32>, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    let reranker = manager.reranker_service.as_ref()
        .ok_or("Reranker not configured. Enable Qwen3-Reranker-4B in settings.")?;

    // Generate embeddings for query + each document
    let mut scores = Vec::new();

    for doc in documents {
        let combined = format!("Query: {}\nDocument: {}", query, doc);
        let embedding = reranker.generate(&combined).await?;

        // Use first value as relevance score (reranker models output this way)
        scores.push(embedding.get(0).copied().unwrap_or(0.0));
    }

    Ok(scores)
}

// Note: Streaming commands would require a different approach with Tauri events
// For now, we're using non-streaming commands for simplicity

/// Store embedding for a note
#[tauri::command]
pub async fn ai_store_note_embedding(
    note_id: String,
    content: String,
    state: State<'_, AIState>,
    db: State<'_, sqlx::SqlitePool>,
) -> Result<(), String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    // Generate embedding
    let embedding = manager.embedding_service.generate(&content).await?;

    // Calculate content hash for cache invalidation
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    let content_hash = format!("{:x}", hasher.finish());

    // Convert Vec<f32> to bytes
    let embedding_bytes: Vec<u8> = embedding
        .iter()
        .flat_map(|f| f.to_le_bytes())
        .collect();

    // Store in database
    let id = uuid::Uuid::new_v4().to_string();
    let model = manager.config.embeddings.model.clone();

    sqlx::query(
        "INSERT INTO embeddings (id, note_id, content_hash, embedding, model, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(note_id) DO UPDATE SET
         content_hash = excluded.content_hash,
         embedding = excluded.embedding,
         created_at = excluded.created_at"
    )
    .bind(&id)
    .bind(&note_id)
    .bind(&content_hash)
    .bind(&embedding_bytes)
    .bind(&model)
    .execute(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct SearchResult {
    pub note_id: String,
    pub title: String,
    pub similarity: f32,
    pub content_preview: String,
}

/// Search notes semantically using embeddings
#[tauri::command]
pub async fn ai_search_notes(
    query: String,
    limit: Option<usize>,
    state: State<'_, AIState>,
    db: State<'_, sqlx::SqlitePool>,
) -> Result<Vec<SearchResult>, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    // Generate query embedding
    let query_embedding = manager.embedding_service.generate(&query).await?;

    // Get all note embeddings from database
    #[derive(sqlx::FromRow)]
    struct EmbeddingRow {
        note_id: String,
        embedding: Vec<u8>,
    }

    let rows: Vec<EmbeddingRow> = sqlx::query_as(
        "SELECT note_id, embedding FROM embeddings"
    )
    .fetch_all(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Calculate cosine similarity for each
    let mut results: Vec<(String, f32)> = Vec::new();

    for row in rows {
        // Convert bytes back to Vec<f32>
        let embedding: Vec<f32> = row.embedding
            .chunks_exact(4)
            .map(|bytes| f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
            .collect();

        // Calculate cosine similarity
        let similarity = cosine_similarity(&query_embedding, &embedding);
        results.push((row.note_id, similarity));
    }

    // Sort by similarity (descending)
    results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    // Take top N results
    let limit = limit.unwrap_or(10);
    results.truncate(limit);

    // Fetch note details
    let mut search_results = Vec::new();
    for (note_id, similarity) in results {
        // Get note title
        let note: crate::db::Note = sqlx::query_as(
            "SELECT * FROM notes WHERE id = ? AND is_deleted = 0"
        )
        .bind(&note_id)
        .fetch_one(db.inner())
        .await
        .map_err(|e| e.to_string())?;

        // Get blocks for preview
        let blocks: Vec<crate::db::Block> = sqlx::query_as(
            "SELECT * FROM blocks WHERE note_id = ? ORDER BY position ASC LIMIT 3"
        )
        .bind(&note_id)
        .fetch_all(db.inner())
        .await
        .map_err(|e| e.to_string())?;

        let content_preview = blocks
            .iter()
            .map(|b| {
                // Parse block data as JSON and extract text content
                if let Ok(data) = serde_json::from_str::<serde_json::Value>(&b.data) {
                    data.get("text")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string()
                } else {
                    String::new()
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(200)
            .collect::<String>();

        search_results.push(SearchResult {
            note_id: note.id,
            title: note.title,
            similarity,
            content_preview,
        });
    }

    Ok(search_results)
}

/// Read a single block's content by block ID
#[tauri::command]
pub async fn ai_read_block(
    block_id: String,
    db: State<'_, sqlx::SqlitePool>,
) -> Result<String, String> {
    // Get block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ?"
    )
    .bind(&block_id)
    .fetch_one(db.inner())
    .await
    .map_err(|e| format!("Block not found: {}", e))?;

    // Parse block data
    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&block.data) {
        match block.block_type.as_str() {
            "text" => {
                // Try different possible field names
                let text_content = data.get("text")
                    .or_else(|| data.get("content"))
                    .or_else(|| data.get("value"))
                    .and_then(|v| v.as_str());

                if let Some(text) = text_content {
                    return Ok(text.to_string());
                } else {
                    return Ok(String::from("[Empty text block]"));
                }
            }
            "heading1" => {
                let text = data.get("text")
                    .or_else(|| data.get("content"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("[Empty heading]");
                return Ok(format!("# {}", text));
            }
            "heading2" => {
                let text = data.get("text")
                    .or_else(|| data.get("content"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("[Empty heading]");
                return Ok(format!("## {}", text));
            }
            "database" => {
                // Extract database content with full table data
                let mut output = String::new();

                if let Some(title) = data.get("title").and_then(|v| v.as_str()) {
                    output.push_str(&format!("## Database: {}\n\n", title));
                } else {
                    output.push_str("## Database Table\n\n");
                }

                // Extract columns
                if let Some(columns) = data.get("columns").and_then(|v| v.as_array()) {
                    let col_names: Vec<String> = columns
                        .iter()
                        .filter_map(|col| {
                            col.get("name").and_then(|n| n.as_str()).map(String::from)
                        })
                        .collect();

                    if !col_names.is_empty() {
                        // Create markdown table header
                        output.push_str("| ");
                        output.push_str(&col_names.join(" | "));
                        output.push_str(" |\n");
                        output.push_str("| ");
                        output.push_str(&vec!["---"; col_names.len()].join(" | "));
                        output.push_str(" |\n");

                        // Extract rows
                        if let Some(rows) = data.get("rows").and_then(|v| v.as_array()) {
                            for row in rows {
                                if let Some(row_obj) = row.as_object() {
                                    output.push_str("| ");
                                    let row_values: Vec<String> = col_names
                                        .iter()
                                        .map(|col_name| {
                                            row_obj
                                                .get(col_name)
                                                .and_then(|v| {
                                                    if v.is_string() {
                                                        v.as_str().map(String::from)
                                                    } else {
                                                        Some(v.to_string())
                                                    }
                                                })
                                                .unwrap_or_else(|| "-".to_string())
                                        })
                                        .collect();
                                    output.push_str(&row_values.join(" | "));
                                    output.push_str(" |\n");
                                }
                            }
                        }
                    }
                }

                return Ok(output);
            }
            "artifact" => {
                // Extract artifact content with code
                let mut output = String::new();

                if let Some(title) = data.get("title").and_then(|v| v.as_str()) {
                    output.push_str(&format!("## Code Artifact: {}\n\n", title));
                } else {
                    output.push_str("## Code Artifact\n\n");
                }

                // Extract HTML
                if let Some(html) = data.get("html").and_then(|v| v.as_str()) {
                    if !html.is_empty() {
                        output.push_str("### HTML:\n```html\n");
                        output.push_str(html);
                        output.push_str("\n```\n\n");
                    }
                }

                // Extract CSS
                if let Some(css) = data.get("css").and_then(|v| v.as_str()) {
                    if !css.is_empty() {
                        output.push_str("### CSS:\n```css\n");
                        output.push_str(css);
                        output.push_str("\n```\n\n");
                    }
                }

                // Extract JavaScript
                if let Some(js) = data.get("javascript").and_then(|v| v.as_str()) {
                    if !js.is_empty() {
                        output.push_str("### JavaScript:\n```javascript\n");
                        output.push_str(js);
                        output.push_str("\n```\n\n");
                    }
                }

                if output.ends_with("## Code Artifact\n\n") {
                    output.push_str("[Empty artifact]\n");
                }

                return Ok(output);
            }
            _ => {
                return Ok(format!("[Unknown block type: {}]", block.block_type));
            }
        }
    }

    Err(String::from("Failed to parse block data"))
}

/// Get note context (note + all blocks) formatted for AI
#[tauri::command]
pub async fn ai_get_note_context(
    note_id: String,
    db: State<'_, sqlx::SqlitePool>,
) -> Result<String, String> {
    // Get note
    let note: crate::db::Note = sqlx::query_as(
        "SELECT * FROM notes WHERE id = ? AND is_deleted = 0"
    )
    .bind(&note_id)
    .fetch_one(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Get all blocks
    let blocks: Vec<crate::db::Block> = sqlx::query_as(
        "SELECT * FROM blocks WHERE note_id = ? ORDER BY position ASC"
    )
    .bind(&note_id)
    .fetch_all(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Debug: Log block count and data
    eprintln!("DEBUG: Found {} blocks for note '{}'", blocks.len(), note.title);

    // Format as text
    let mut context = format!("# {}\n\n", note.title);

    for (i, block) in blocks.iter().enumerate() {
        eprintln!("DEBUG: Block {}: type='{}', data='{}'", i, block.block_type, block.data);

        // Parse block data
        if let Ok(data) = serde_json::from_str::<serde_json::Value>(&block.data) {
            match block.block_type.as_str() {
                "text" => {
                    // Try different possible field names
                    let text_content = data.get("text")
                        .or_else(|| data.get("content"))
                        .or_else(|| data.get("value"))
                        .and_then(|v| v.as_str());

                    if let Some(text) = text_content {
                        eprintln!("DEBUG: Extracted text: '{}'", text);
                        context.push_str(text);
                        context.push_str("\n\n");
                    } else {
                        eprintln!("DEBUG: No text found in data: {:?}", data);
                    }
                }
                "heading1" => {
                    let text = data.get("text")
                        .or_else(|| data.get("content"))
                        .and_then(|v| v.as_str());
                    if let Some(text) = text {
                        context.push_str(&format!("# {}\n\n", text));
                    }
                }
                "heading2" => {
                    let text = data.get("text")
                        .or_else(|| data.get("content"))
                        .and_then(|v| v.as_str());
                    if let Some(text) = text {
                        context.push_str(&format!("## {}\n\n", text));
                    }
                }
                "database" => {
                    // Extract database content
                    if let Some(title) = data.get("title").and_then(|v| v.as_str()) {
                        context.push_str(&format!("## Database: {}\n", title));
                    } else {
                        context.push_str("## Database Table\n");
                    }
                    // CRITICAL: Include block_id so AI knows how to reference this database
                    context.push_str(&format!("**[Database Block ID: {}]**\n\n", block.id));

                    // Extract columns
                    if let Some(columns) = data.get("columns").and_then(|v| v.as_array()) {
                        let col_names: Vec<String> = columns
                            .iter()
                            .filter_map(|col| {
                                col.get("name").and_then(|n| n.as_str()).map(String::from)
                            })
                            .collect();

                        if !col_names.is_empty() {
                            // Create markdown table header
                            context.push_str("| ");
                            context.push_str(&col_names.join(" | "));
                            context.push_str(" |\n");
                            context.push_str("| ");
                            context.push_str(&vec!["---"; col_names.len()].join(" | "));
                            context.push_str(" |\n");

                            // Extract rows
                            if let Some(rows) = data.get("rows").and_then(|v| v.as_array()) {
                                for row in rows {
                                    if let Some(row_obj) = row.as_object() {
                                        context.push_str("| ");
                                        let row_values: Vec<String> = col_names
                                            .iter()
                                            .map(|col_name| {
                                                row_obj
                                                    .get(col_name)
                                                    .and_then(|v| {
                                                        if v.is_string() {
                                                            v.as_str().map(String::from)
                                                        } else {
                                                            Some(v.to_string())
                                                        }
                                                    })
                                                    .unwrap_or_else(|| "-".to_string())
                                            })
                                            .collect();
                                        context.push_str(&row_values.join(" | "));
                                        context.push_str(" |\n");
                                    }
                                }
                            }
                            context.push_str("\n");
                        }
                    }
                }
                "artifact" => {
                    // Extract artifact content
                    if let Some(title) = data.get("title").and_then(|v| v.as_str()) {
                        context.push_str(&format!("## Code Artifact: {}\n\n", title));
                    } else {
                        context.push_str("## Code Artifact\n\n");
                    }

                    // Extract code details
                    if let Some(html) = data.get("html").and_then(|v| v.as_str()) {
                        if !html.is_empty() {
                            context.push_str("HTML:\n```html\n");
                            context.push_str(&html.chars().take(500).collect::<String>());
                            if html.len() > 500 {
                                context.push_str("...(truncated)");
                            }
                            context.push_str("\n```\n\n");
                        }
                    }

                    if let Some(css) = data.get("css").and_then(|v| v.as_str()) {
                        if !css.is_empty() {
                            context.push_str("CSS:\n```css\n");
                            context.push_str(&css.chars().take(300).collect::<String>());
                            if css.len() > 300 {
                                context.push_str("...(truncated)");
                            }
                            context.push_str("\n```\n\n");
                        }
                    }

                    if let Some(js) = data.get("javascript").and_then(|v| v.as_str()) {
                        if !js.is_empty() {
                            context.push_str("JavaScript:\n```javascript\n");
                            context.push_str(&js.chars().take(300).collect::<String>());
                            if js.len() > 300 {
                                context.push_str("...(truncated)");
                            }
                            context.push_str("\n```\n\n");
                        }
                    }
                }
                _ => {}
            }
        } else {
            eprintln!("DEBUG: Failed to parse block data as JSON");
        }
    }

    eprintln!("DEBUG: Final context length: {} chars", context.len());
    eprintln!("DEBUG: Final context: '{}'", context);

    Ok(context)
}

/// Chat with AI about a specific note (RAG pattern)
#[tauri::command]
pub async fn ai_chat_with_note_context(
    note_id: String,
    user_message: String,
    state: State<'_, AIState>,
    db: State<'_, sqlx::SqlitePool>,
) -> Result<String, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    // Get note context
    let context = ai_get_note_context(note_id, db).await?;

    // Create system message with context
    let system_message = Message {
        role: "system".to_string(),
        content: format!(
            "You are an AI assistant helping the user understand their notes. \
             Here is the content of the note they are asking about:\n\n{}\n\n\
             Answer their questions based on this content.",
            context
        ),
    };

    let user_msg = Message {
        role: "user".to_string(),
        content: user_message,
    };

    // Chat with agent
    let (response, _tool_calls) = manager.agent_service.chat(
        vec![system_message, user_msg],
        None
    ).await?;

    Ok(response)
}

/// Get all available tools for AI to use
#[tauri::command]
pub async fn ai_get_tools() -> Result<Vec<crate::ai::ToolDefinition>, String> {
    Ok(crate::ai::get_all_tools())
}

/// Get database-specific tools
#[tauri::command]
pub async fn ai_get_database_tools() -> Result<Vec<crate::ai::ToolDefinition>, String> {
    Ok(crate::ai::get_database_tools())
}

/// Get artifact-specific tools
#[tauri::command]
pub async fn ai_get_artifact_tools() -> Result<Vec<crate::ai::ToolDefinition>, String> {
    Ok(crate::ai::get_artifact_tools())
}

/// Execute a database tool
#[tauri::command]
pub async fn ai_execute_database_tool(
    tool_name: String,
    params: serde_json::Value,
    db: State<'_, sqlx::SqlitePool>,
) -> Result<crate::ai::ToolResult, String> {
    crate::ai::tools::execute_database_tool(&tool_name, params, db.inner()).await
}

/// Execute an artifact tool
#[tauri::command]
pub async fn ai_execute_artifact_tool(
    tool_name: String,
    params: serde_json::Value,
    db: State<'_, sqlx::SqlitePool>,
) -> Result<crate::ai::ToolResult, String> {
    crate::ai::tools::execute_artifact_tool(&tool_name, params, db.inner()).await
}

/// Enhanced AI chat with automatic tool calling
/// The AI will use database and artifact tools as needed
#[tauri::command]
pub async fn ai_chat_with_auto_tools(
    messages: Vec<crate::ai::Message>,
    note_id: Option<String>,
    state: State<'_, AIState>,
    db: State<'_, sqlx::SqlitePool>,
) -> Result<String, String> {
    let manager_lock = state.manager.read().await;
    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    // Get all available tools
    let tools = crate::ai::get_all_tools();

    // Convert to OpenAI tool format
    let openai_tools: Vec<crate::ai::Tool> = tools
        .iter()
        .map(|t| crate::ai::Tool {
            r#type: "function".to_string(),
            function: crate::ai::FunctionDefinition {
                name: t.name.clone(),
                description: t.description.clone(),
                parameters: t.parameters.clone(),
            },
        })
        .collect();

    // Add note context if provided
    let mut enhanced_messages = messages.clone();
    if let Some(nid) = note_id {
        if let Ok(context) = ai_get_note_context(nid.clone(), db.clone()).await {
            enhanced_messages.insert(
                0,
                crate::ai::Message {
                    role: "system".to_string(),
                    content: format!(
                        "You have access to advanced tools for working with databases and artifacts. \
                         Here is the current note context:\n\n{}\n\n\
                         Use the available tools to help answer questions and perform tasks.",
                        context
                    ),
                },
            );
        }
    }

    // Initial AI response with tool calls
    let (mut response, mut tool_calls) = manager
        .agent_service
        .chat(enhanced_messages.clone(), Some(openai_tools.clone()))
        .await?;

    // Execute tool calls and continue conversation
    let max_iterations = 5;
    let mut iteration = 0;

    while !tool_calls.is_empty() && iteration < max_iterations {
        iteration += 1;

        // Execute each tool call
        for tool_call in &tool_calls {
            let tool_name = &tool_call.function.name;

            // Parse arguments (they come as a JSON string from OpenAI)
            let params: serde_json::Value = serde_json::from_str(&tool_call.function.arguments)
                .unwrap_or(serde_json::json!({}));

            // Execute the tool
            let result = if tool_name.starts_with("db_") {
                ai_execute_database_tool(tool_name.to_string(), params, db.clone()).await?
            } else if tool_name.starts_with("artifact_") {
                ai_execute_artifact_tool(tool_name.to_string(), params, db.clone()).await?
            } else {
                continue;
            };

            // Add tool result as a message
            enhanced_messages.push(crate::ai::Message {
                role: "user".to_string(),
                content: format!(
                    "Tool '{}' result:\n{}",
                    tool_name,
                    serde_json::to_string_pretty(&result).unwrap_or_default()
                ),
            });
        }

        // Continue conversation with new tool results
        let (new_response, new_tool_calls) = manager
            .agent_service
            .chat(enhanced_messages.clone(), Some(openai_tools.clone()))
            .await?;

        response = new_response;
        tool_calls = new_tool_calls;
    }

    Ok(response)
}

// Helper function for cosine similarity
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let magnitude_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let magnitude_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if magnitude_a == 0.0 || magnitude_b == 0.0 {
        return 0.0;
    }

    dot_product / (magnitude_a * magnitude_b)
}
