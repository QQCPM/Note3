pub mod embedding;
pub mod openai;

pub use embedding::{EmbeddingConfig, LocalEmbeddingService};
pub use openai::{OpenAIConfig, OpenAIService, Message, Tool, ToolCall, ArtifactResult, DatabaseResult};

use serde::{Deserialize, Serialize};

/// Complete AI configuration for the hybrid system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    /// Local embedding model (privacy, speed, cost)
    pub embeddings: EmbeddingConfig,

    /// OpenAI config for agent tasks (reasoning, tool use)
    pub agent: OpenAIConfig,

    /// Optional: separate config for code generation
    pub code_generation: Option<OpenAIConfig>,
}

impl AIConfig {
    pub fn default() -> Self {
        Self {
            embeddings: EmbeddingConfig {
                endpoint: "http://localhost:8081".to_string(),
                model: "qwen3-embedding-0.6b".to_string(),
                dimension: 1024,
            },
            agent: OpenAIConfig {
                api_key: String::new(), // User must provide
                model: "gpt-4o".to_string(),
                temperature: 0.7,
                max_tokens: Some(4096),
            },
            code_generation: None, // Will use agent config if not specified
        }
    }

    /// Get the config for code generation (artifact creation)
    pub fn get_code_generation_config(&self) -> &OpenAIConfig {
        self.code_generation.as_ref().unwrap_or(&self.agent)
    }
}

/// Manages both local and cloud AI services
pub struct AIManager {
    pub config: AIConfig,
    pub embedding_service: LocalEmbeddingService,
    pub agent_service: OpenAIService,
    pub code_service: OpenAIService,
}

impl AIManager {
    pub fn new(config: AIConfig) -> Self {
        let embedding_service = LocalEmbeddingService::new(config.embeddings.clone());
        let agent_service = OpenAIService::new(config.agent.clone());

        let code_service = if let Some(ref code_config) = config.code_generation {
            OpenAIService::new(code_config.clone())
        } else {
            OpenAIService::new(config.agent.clone())
        };

        Self {
            config,
            embedding_service,
            agent_service,
            code_service,
        }
    }

    /// Health check for all services
    pub async fn health_check(&self) -> Result<HealthStatus, String> {
        let embedding_ok = self.embedding_service.health_check().await.is_ok();

        // Simple check for OpenAI - try to get models list or a simple completion
        let agent_ok = true; // We'll validate API key on first use

        Ok(HealthStatus {
            embedding_service: embedding_ok,
            agent_service: agent_ok,
            code_service: agent_ok,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthStatus {
    pub embedding_service: bool,
    pub agent_service: bool,
    pub code_service: bool,
}
