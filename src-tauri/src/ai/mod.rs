pub mod embedding;
pub mod openai;
pub mod local;
pub mod config_persistence;

pub use embedding::{EmbeddingConfig, LocalEmbeddingService};
pub use openai::{OpenAIConfig, OpenAIService, Message, Tool, ToolCall};
pub use local::{LocalModelConfig, LocalModelService};
pub use config_persistence::PersistedConfig;

use serde::{Deserialize, Serialize};

// ============================================================================
// SHARED TYPES (used by both local and OpenAI services)
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
    pub name: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
}

/// Complete AI configuration for the hybrid system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    /// Local embedding model (privacy, speed, cost)
    pub embeddings: EmbeddingConfig,

    /// Optional: local reranking model
    pub reranker: Option<EmbeddingConfig>,

    /// Optional: local code generation model (Qwen3-30B-Coder)
    pub local_code_generation: Option<LocalModelConfig>,

    /// OpenAI config for agent tasks (reasoning, tool use)
    pub agent: OpenAIConfig,

    /// Optional: separate OpenAI config for code generation (fallback)
    pub api_code_generation: Option<OpenAIConfig>,
}

impl AIConfig {
    pub fn default() -> Self {
        Self {
            embeddings: EmbeddingConfig {
                endpoint: "http://localhost:8081".to_string(),
                model: "qwen3-embedding-0.6b".to_string(),
                dimension: 1024,
            },
            reranker: None,
            local_code_generation: None,
            agent: OpenAIConfig {
                api_key: String::new(), // User must provide
                model: "gpt-4o".to_string(),
                temperature: 0.7,
                max_tokens: Some(4096),
            },
            api_code_generation: None, // Will use agent config if not specified
        }
    }

    /// Mac M2 Ultra optimized configuration
    pub fn mac_m2_ultra(openai_key: String) -> Self {
        Self {
            embeddings: EmbeddingConfig {
                endpoint: "http://localhost:8081".to_string(),
                model: "qwen3-embedding-8b".to_string(),
                dimension: 8192,
            },
            reranker: Some(EmbeddingConfig {
                endpoint: "http://localhost:8082".to_string(),
                model: "qwen3-reranker-8b".to_string(),
                dimension: 8192,
            }),
            local_code_generation: Some(LocalModelConfig {
                endpoint: "http://localhost:8080".to_string(),
                model: "qwen3-coder-30b".to_string(),
                max_tokens: 4096,
                temperature: 0.7,
            }),
            agent: OpenAIConfig {
                api_key: openai_key,
                model: "gpt-4o".to_string(),
                temperature: 0.7,
                max_tokens: Some(4096),
            },
            api_code_generation: None,
        }
    }

    /// Get the OpenAI config for code generation (artifact creation fallback)
    pub fn get_api_code_generation_config(&self) -> &OpenAIConfig {
        self.api_code_generation.as_ref().unwrap_or(&self.agent)
    }
}

/// Manages both local and cloud AI services
pub struct AIManager {
    pub config: AIConfig,
    pub embedding_service: LocalEmbeddingService,
    pub reranker_service: Option<LocalEmbeddingService>,
    pub local_code_service: Option<LocalModelService>,
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
            agent_service,
            api_code_service,
        }
    }

    /// Health check for all services
    pub async fn health_check(&self) -> Result<HealthStatus, String> {
        let embedding_ok = self.embedding_service.health_check().await.is_ok();

        let reranker_ok = if let Some(ref service) = self.reranker_service {
            service.health_check().await.is_ok()
        } else {
            false
        };

        let local_code_ok = if let Some(ref service) = self.local_code_service {
            service.health_check().await.is_ok()
        } else {
            false
        };

        // Simple check for OpenAI - we'll validate API key on first use
        let agent_ok = true;

        Ok(HealthStatus {
            embedding_service: embedding_ok,
            reranker_service: reranker_ok,
            local_code_service: local_code_ok,
            agent_service: agent_ok,
            api_code_service: agent_ok,
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
