use serde::{Deserialize, Serialize};
use reqwest::Client;
use super::{ArtifactResult, DatabaseResult};

/// Ollama Cloud service for GLM-4.6 and other cloud models
#[derive(Clone)]
pub struct OllamaCloudService {
    client: Client,
    api_key: String,
    model: String,
}

#[derive(Debug, Serialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    message: OllamaMessageResponse,
}

#[derive(Debug, Deserialize)]
struct OllamaMessageResponse {
    content: String,
}

impl OllamaCloudService {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
            model,
        }
    }

    /// Create with GLM-4.6 as default
    pub fn glm4(api_key: String) -> Self {
        Self::new(api_key, "glm-4.6".to_string())
    }

    /// Chat with Ollama Cloud
    pub async fn chat(&self, messages: Vec<OllamaMessage>) -> Result<String, String> {
        let request = OllamaChatRequest {
            model: self.model.clone(),
            messages,
            stream: false,
        };

        let response = self.client
            .post("https://ollama.com/api/chat")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Ollama Cloud request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Ollama Cloud API error {}: {}", status, error_text));
        }

        let completion: OllamaChatResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

        Ok(completion.message.content)
    }

    /// Generate artifact using GLM-4.6
    pub async fn generate_artifact(&self, user_prompt: &str) -> Result<ArtifactResult, String> {
        let system_prompt = r#"You are an expert frontend developer. Generate clean, modern HTML/CSS/JavaScript code.

Return ONLY valid JSON with this exact structure:
{
  "title": "Brief title",
  "html": "Complete HTML",
  "css": "Complete CSS",
  "javascript": "Complete JavaScript"
}

Requirements:
- Modern, beautiful UI with dark theme
- Responsive design
- Vanilla JavaScript only
- NO explanations, ONLY JSON"#;

        let messages = vec![
            OllamaMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            OllamaMessage {
                role: "user".to_string(),
                content: user_prompt.to_string(),
            },
        ];

        let response = self.chat(messages).await?;
        
        // Extract JSON from response
        let json_str = extract_json(&response);
        
        serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse artifact JSON: {}. Response: {}", e, json_str))
    }

    /// Generate database schema using GLM-4.6
    pub async fn generate_database(&self, user_prompt: &str) -> Result<DatabaseResult, String> {
        let system_prompt = r#"Generate a database schema as JSON:
{
  "title": "Database name",
  "columns": [
    {"id": "col_1", "name": "Name", "type": "text"},
    {"id": "col_2", "name": "Status", "type": "select", "options": ["Active", "Done"]}
  ],
  "rows": []
}

Column types: text, number, date, select, checkbox
Each column MUST have unique "id".
Return ONLY JSON, no explanations."#;

        let messages = vec![
            OllamaMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            OllamaMessage {
                role: "user".to_string(),
                content: user_prompt.to_string(),
            },
        ];

        let response = self.chat(messages).await?;
        let json_str = extract_json(&response);
        
        serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse database JSON: {}. Response: {}", e, json_str))
    }

    /// Health check
    pub async fn health_check(&self) -> Result<(), String> {
        // Simple test message
        let messages = vec![
            OllamaMessage {
                role: "user".to_string(),
                content: "Hi".to_string(),
            },
        ];
        
        self.chat(messages).await?;
        Ok(())
    }
}

/// Extract JSON from potential markdown response
fn extract_json(response: &str) -> &str {
    if response.contains("```json") {
        response
            .split("```json")
            .nth(1)
            .and_then(|s| s.split("```").next())
            .unwrap_or(response)
            .trim()
    } else if response.contains("```") {
        response
            .split("```")
            .nth(1)
            .unwrap_or(response)
            .trim()
    } else {
        response.trim()
    }
}
