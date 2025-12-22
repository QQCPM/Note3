pub mod embedding;
pub mod openai;
pub mod local;
pub mod ollama_cloud;
pub mod config_persistence;
pub mod tools;

pub use embedding::{EmbeddingConfig, LocalEmbeddingService};
pub use openai::{
    OpenAIConfig, OpenAIService, Message, Tool, ToolCall, FunctionDefinition,
    ReasoningEffort, BuiltInTool, ResponsesInput, ResponsesResult, ResponsesToolCall,
};
pub use local::{LocalModelConfig, LocalModelService};
pub use ollama_cloud::OllamaCloudService;
pub use config_persistence::PersistedConfig;
pub use tools::{ToolDefinition, ToolResult, get_all_tools, get_database_tools, get_artifact_tools};

use serde::{Deserialize, Serialize};

// ============================================================================
// SHARED TYPES
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct ArtifactResult {
    pub title: String,
    pub html: String,
    pub css: String,
    pub javascript: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseResult {
    pub title: String,
    pub columns: Vec<DatabaseColumn>,
    pub rows: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseColumn {
    #[serde(default = "generate_column_id")]
    pub id: String,
    pub name: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
}

fn generate_column_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

// ============================================================================
// AI CONFIGURATION
// - Agent: GPT-5.2 (OpenAI)
// - Code Gen: MiniMax-M2 (Ollama cloud) - #1 open-source for coding
// - Embeddings: text-embedding-3-large (OpenAI)
// - Reranker: Qwen3-Reranker-4B (Ollama local)
// ============================================================================

/// Ollama configuration for local/cloud models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaConfig {
    pub endpoint: String,
    pub model: String,
}

/// Legacy Ollama Cloud configuration (kept for backward compatibility)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaCloudConfig {
    pub api_key: String,
    pub model: String,
}

/// AI configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub embeddings: EmbeddingConfig,
    pub reranker: Option<EmbeddingConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_code_generation: Option<LocalModelConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ollama_code_generation: Option<OllamaConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ollama_cloud: Option<OllamaCloudConfig>,
    pub agent: OpenAIConfig,
    pub api_code_generation: Option<OpenAIConfig>,
}

impl AIConfig {
    /// Create unified AI config
    /// - Agent: GPT-5.2 (OpenAI)
    /// - Code Gen: MiniMax-M2 (Ollama cloud) - #1 open-source for coding
    /// - Embeddings: text-embedding-3-large (OpenAI)
    /// - Reranker: Qwen3-Reranker-4B (Ollama local)
    pub fn new(openai_key: String) -> Self {
        Self::new_with_ollama(openai_key, String::new())
    }
    
    /// Create config with Ollama API key
    pub fn new_with_ollama(openai_key: String, ollama_key: String) -> Self {
        Self::new_with_options(openai_key, ollama_key, "gpt-5.2".to_string(), 0.3, Some(32768))
    }

    /// Create config with full customization options
    pub fn new_with_options(
        openai_key: String,
        ollama_key: String,
        model: String,
        temperature: f32,
        max_tokens: Option<u32>,
    ) -> Self {
        Self {
            embeddings: EmbeddingConfig {
                endpoint: "https://api.openai.com/v1/embeddings".to_string(),
                model: "text-embedding-3-large".to_string(),
                dimension: 3072,
            },
            reranker: Some(EmbeddingConfig {
                endpoint: "http://localhost:11434".to_string(),
                model: "dengcao/Qwen3-Reranker-4B".to_string(),
                dimension: 2048,
            }),
            local_code_generation: None,
            ollama_code_generation: None,
            ollama_cloud: if !ollama_key.is_empty() {
                Some(OllamaCloudConfig {
                    api_key: ollama_key,
                    model: "glm-4.6".to_string(),  // Z.ai GLM-4.6: 355B MoE, excellent for coding
                })
            } else {
                None
            },
            agent: OpenAIConfig {
                api_key: openai_key,
                model,
                temperature,
                max_tokens,
                reasoning_effort: ReasoningEffort::Medium,
                use_responses_api: true,
            },
            api_code_generation: None,
        }
    }

    pub fn default() -> Self {
        Self::new(String::new())
    }

    pub fn mac_m2_ultra(openai_key: String) -> Self {
        Self::new(openai_key)
    }

    pub fn demo_mode(openai_key: String, _ollama_key: String) -> Self {
        Self::new(openai_key)
    }

    pub fn get_api_code_generation_config(&self) -> &OpenAIConfig {
        self.api_code_generation.as_ref().unwrap_or(&self.agent)
    }
}

// ============================================================================
// AI MANAGER
// ============================================================================

#[derive(Clone)]
pub struct AIManager {
    pub config: AIConfig,
    pub embedding_service: LocalEmbeddingService,
    pub reranker_service: Option<LocalEmbeddingService>,
    pub local_code_service: Option<LocalModelService>,
    pub ollama_cloud_service: Option<OllamaCloudService>,
    pub agent_service: OpenAIService,
    pub api_code_service: OpenAIService,
}

impl AIManager {
    pub fn new(config: AIConfig) -> Self {
        let embedding_service = LocalEmbeddingService::new(config.embeddings.clone());

        let reranker_service = config.reranker.as_ref()
            .map(|cfg| LocalEmbeddingService::new(cfg.clone()));

        let local_code_service = config.local_code_generation.as_ref()
            .map(|cfg| LocalModelService::new(cfg.clone()));

        // Use GLM-4.6 via Ollama Cloud API (https://ollama.com/api/chat)
        let ollama_cloud_service = config.ollama_cloud.as_ref()
            .map(|cfg| OllamaCloudService::new(cfg.api_key.clone(), cfg.model.clone()));

        let agent_service = OpenAIService::new(config.agent.clone());

        let api_code_service = if let Some(ref code_config) = config.api_code_generation {
            OpenAIService::new(code_config.clone())
        } else {
            OpenAIService::new(config.agent.clone())
        };

        Self {
            config,
            embedding_service,
            reranker_service,
            local_code_service,
            ollama_cloud_service,
            agent_service,
            api_code_service,
        }
    }

    pub async fn health_check(&self) -> Result<HealthStatus, String> {
        let embedding_ok = self.embedding_service.health_check().await.is_ok();

        // Check reranker service asynchronously (avoid block_on which can deadlock)
        let reranker_ok = if let Some(ref service) = self.reranker_service {
            service.health_check().await.is_ok()
        } else {
            false
        };

        // Check local code service or ollama cloud service asynchronously
        let local_code_ok = if let Some(ref service) = self.local_code_service {
            service.health_check().await.is_ok()
        } else if let Some(ref service) = self.ollama_cloud_service {
            service.health_check().await.is_ok()
        } else {
            false
        };

        Ok(HealthStatus {
            embedding_service: embedding_ok,
            reranker_service: reranker_ok,
            local_code_service: local_code_ok,
            agent_service: true,
            api_code_service: true,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthStatus {
    pub embedding_service: bool,
    pub reranker_service: bool,
    pub local_code_service: bool,
    pub agent_service: bool,
    pub api_code_service: bool,
}
