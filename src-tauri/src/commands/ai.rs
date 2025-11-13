use serde::{Deserialize, Serialize};
use tauri::{Emitter, Window};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub code_generation: ModelConfig,
    pub note_understanding: ModelConfig,
    pub embeddings: ModelConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_search: Option<WebSearchConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub provider: String,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    pub temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_length: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSearchConfig {
    pub provider: String,
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactGenerationRequest {
    pub prompt: String,
    #[serde(rename = "type")]
    pub artifact_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactGenerationResponse {
    pub html: String,
    pub css: String,
    pub javascript: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseColumn {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub column_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseGenerationResponse {
    pub title: String,
    pub columns: Vec<DatabaseColumn>,
    pub rows: Vec<serde_json::Value>,
    pub view: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingRequest {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    pub embedding: Vec<f32>,
    pub dimension: i64,
}

/// Generate artifact with streaming
#[tauri::command]
pub async fn generate_artifact_stream(
    window: Window,
    request: ArtifactGenerationRequest,
    config: ModelConfig,
) -> Result<(), String> {
    // For now, emit a simple event for testing
    // In production, this will call the AI model and stream responses

    let event_name = "artifact-generation-chunk";

    // Simulate streaming by sending chunks
    window.emit(event_name, "Generating artifact...").map_err(|e| e.to_string())?;

    // TODO: Actual implementation will:
    // 1. Call the configured AI endpoint (local or API)
    // 2. Stream the response
    // 3. Parse HTML, CSS, JavaScript from response
    // 4. Emit chunks to frontend

    Ok(())
}

/// Generate artifact (non-streaming for simplicity)
#[tauri::command]
pub async fn generate_artifact(
    request: ArtifactGenerationRequest,
    _config: ModelConfig,
) -> Result<ArtifactGenerationResponse, String> {
    // TODO: Implement actual AI generation
    // For now, return a placeholder

    match request.artifact_type.as_str() {
        "artifact" => {
            // Generate HTML/CSS/JS artifact
            Ok(ArtifactGenerationResponse {
                title: Some("Generated Artifact".to_string()),
                html: format!("<div class='container'><h1>AI Generated: {}</h1><p>This is a placeholder. AI integration coming soon!</p></div>", request.prompt),
                css: "body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; } .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }".to_string(),
                javascript: "console.log('Artifact loaded!');".to_string(),
            })
        },
        _ => {
            Err("Unsupported artifact type".to_string())
        }
    }
}

/// Generate database from natural language
#[tauri::command]
pub async fn generate_database(
    _prompt: String,
    _config: ModelConfig,
) -> Result<DatabaseGenerationResponse, String> {
    // TODO: Implement actual AI generation
    // For now, return a sample database structure

    Ok(DatabaseGenerationResponse {
        title: "AI Generated Database".to_string(),
        columns: vec![
            DatabaseColumn {
                id: "col_1".to_string(),
                name: "Name".to_string(),
                column_type: "text".to_string(),
                options: None,
            },
            DatabaseColumn {
                id: "col_2".to_string(),
                name: "Status".to_string(),
                column_type: "select".to_string(),
                options: Some(vec![
                    "Todo".to_string(),
                    "In Progress".to_string(),
                    "Done".to_string(),
                ]),
            },
            DatabaseColumn {
                id: "col_3".to_string(),
                name: "Due Date".to_string(),
                column_type: "date".to_string(),
                options: None,
            },
        ],
        rows: vec![],
        view: "table".to_string(),
    })
}

/// Generate embedding for text
#[tauri::command]
pub async fn generate_embedding(
    _request: EmbeddingRequest,
    _config: ModelConfig,
) -> Result<EmbeddingResponse, String> {
    // TODO: Implement actual embedding generation
    // This will call local embedding model or OpenAI API

    // Placeholder: return dummy embedding
    let dimension = 1024; // Qwen3-Embedding dimension
    let embedding = vec![0.0; dimension];

    Ok(EmbeddingResponse {
        embedding,
        dimension: dimension as i64,
    })
}

/// Semantic search using embeddings
#[tauri::command]
pub async fn semantic_search(
    _query: String,
    _limit: Option<i64>,
    _config: ModelConfig,
) -> Result<Vec<crate::db::Note>, String> {
    // TODO: Implement actual semantic search
    // 1. Generate embedding for query
    // 2. Search database using vector similarity
    // 3. Return top N results

    // Placeholder: return empty results
    Ok(vec![])
}

/// Get or create default AI configuration
#[tauri::command]
pub async fn get_ai_config() -> Result<AIConfig, String> {
    // TODO: Load from persistent storage (SQLite or config file)
    // For now, return default configuration

    Ok(AIConfig {
        code_generation: ModelConfig {
            provider: "local".to_string(),
            model: "qwen3-coder-30b".to_string(),
            endpoint: Some("http://localhost:8080/v1/completions".to_string()),
            api_key: None,
            temperature: 0.7,
            max_tokens: Some(4096),
            context_length: Some(128000),
        },
        note_understanding: ModelConfig {
            provider: "openai".to_string(),
            model: "gpt-4o".to_string(),
            endpoint: Some("https://api.openai.com/v1/chat/completions".to_string()),
            api_key: None, // User must configure
            temperature: 0.5,
            max_tokens: Some(4096),
            context_length: None,
        },
        embeddings: ModelConfig {
            provider: "local".to_string(),
            model: "qwen3-embedding-0.6b".to_string(),
            endpoint: Some("http://localhost:8081/v1/embeddings".to_string()),
            api_key: None,
            temperature: 0.0,
            max_tokens: None,
            context_length: None,
        },
        web_search: Some(WebSearchConfig {
            provider: "brave".to_string(),
            api_key: String::new(), // User must configure
        }),
    })
}

/// Save AI configuration
#[tauri::command]
pub async fn save_ai_config(_config: AIConfig) -> Result<(), String> {
    // TODO: Save to persistent storage (SQLite or config file)
    // For now, just validate and return success

    Ok(())
}
