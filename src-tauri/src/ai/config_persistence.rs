use super::AIConfig;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

/// Persisted configuration structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedConfig {
    /// OpenAI API Key
    pub openai_api_key: String,

    /// Ollama API Key (for cloud models like minimax-m2:cloud)
    #[serde(default)]
    pub ollama_api_key: Option<String>,

    /// OpenAI Model (e.g., "gpt-5.2", "gpt-4o-mini")
    #[serde(default = "default_model")]
    pub openai_model: String,

    /// Temperature for AI responses
    #[serde(default = "default_temperature")]
    pub temperature: f32,

    /// Max tokens per response
    #[serde(default = "default_max_tokens")]
    pub max_tokens: Option<u32>,
}

fn default_model() -> String {
    "gpt-5.2".to_string()
}

fn default_temperature() -> f32 {
    0.7
}

fn default_max_tokens() -> Option<u32> {
    Some(32768) // GPT-5.2 supports up to 32K output tokens
}

impl Default for PersistedConfig {
    fn default() -> Self {
        Self {
            openai_api_key: String::new(),
            ollama_api_key: None,
            openai_model: default_model(),
            temperature: default_temperature(),
            max_tokens: default_max_tokens(),
        }
    }
}

impl PersistedConfig {
    /// Load config from app data directory
    pub fn load(app_data_dir: &PathBuf) -> Result<Self, String> {
        let config_path = Self::get_config_path(app_data_dir);

        if !config_path.exists() {
            return Err("Config file not found".to_string());
        }

        let contents = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        let config: PersistedConfig = serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse config file: {}", e))?;

        Ok(config)
    }

    /// Save config to app data directory
    pub fn save(&self, app_data_dir: &PathBuf) -> Result<(), String> {
        // Ensure app data directory exists
        fs::create_dir_all(app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;

        let config_path = Self::get_config_path(app_data_dir);

        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(&config_path, json)
            .map_err(|e| format!("Failed to write config file: {}", e))?;

        Ok(())
    }

    /// Get the path to the config file
    fn get_config_path(app_data_dir: &PathBuf) -> PathBuf {
        app_data_dir.join("ai_config.json")
    }

    /// Convert to full AIConfig
    /// Uses the saved model, temperature, and max_tokens settings
    pub fn to_ai_config(&self) -> AIConfig {
        AIConfig::new_with_options(
            self.openai_api_key.clone(),
            self.ollama_api_key.clone().unwrap_or_default(),
            self.openai_model.clone(),
            self.temperature,
            self.max_tokens,
        )
    }

    /// Create from AIConfig
    pub fn from_ai_config(config: &AIConfig) -> Self {
        Self {
            openai_api_key: config.agent.api_key.clone(),
            ollama_api_key: None,
            openai_model: config.agent.model.clone(),
            temperature: config.agent.temperature,
            max_tokens: config.agent.max_tokens,
        }
    }
}
