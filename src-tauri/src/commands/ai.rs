use crate::ai::{AIConfig, AIManager, Message, Tool, ToolCall};
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

/// Generate artifact using LOCAL Qwen3-30B-Coder (if available)
/// Falls back to OpenAI if local model not configured
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
                eprintln!("Local code generation failed, falling back to API: {}", e);
            }
        }
    }

    // Fallback to OpenAI
    manager.api_code_service.generate_artifact(&prompt).await
}

/// Generate database schema using LOCAL or API
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
    if let Some(ref service) = manager.local_code_service {
        match service.generate_database(&prompt).await {
            Ok(result) => return Ok(result),
            Err(e) => {
                eprintln!("Local database generation failed, falling back to API: {}", e);
            }
        }
    }

    // Fallback to OpenAI
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

/// Rerank search results using local Qwen3-Reranker-8B
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
        .ok_or("Reranker not configured. Enable Qwen3-Reranker-8B in settings.")?;

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
