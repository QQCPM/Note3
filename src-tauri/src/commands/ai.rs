use crate::ai::{AIConfig, AIManager, Message, Tool, ToolCall, ArtifactResult, DatabaseResult};
use tauri::State;
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
}

/// Initialize the AI system with configuration
#[tauri::command]
pub async fn ai_initialize(
    config: AIConfig,
    state: State<'_, AIState>,
) -> Result<(), String> {
    let manager = AIManager::new(config);

    // Health check
    let health = manager.health_check().await?;

    if !health.embedding_service {
        eprintln!("Warning: Embedding service is not available. Semantic search will not work.");
    }

    *state.manager.write().await = Some(manager);

    Ok(())
}

/// Get current AI configuration
#[tauri::command]
pub async fn ai_get_config(state: State<'_, AIState>) -> Result<Option<AIConfig>, String> {
    let manager_lock = state.manager.read().await;

    Ok(manager_lock.as_ref().map(|m| m.config.clone()))
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

/// Generate artifact (HTML/CSS/JS) using GPT
#[tauri::command]
pub async fn ai_generate_artifact(
    prompt: String,
    state: State<'_, AIState>,
) -> Result<ArtifactResult, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    manager.code_service.generate_artifact(&prompt).await
}

/// Generate database schema using GPT
#[tauri::command]
pub async fn ai_generate_database(
    prompt: String,
    state: State<'_, AIState>,
) -> Result<DatabaseResult, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    manager.agent_service.generate_database(&prompt).await
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

// Note: Streaming commands would require a different approach with Tauri events
// For now, we're using non-streaming commands for simplicity
