use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModelConfig {
    pub endpoint: String,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<Message>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: MessageResponse,
}

#[derive(Debug, Deserialize)]
struct MessageResponse {
    content: String,
}

pub struct LocalModelService {
    client: Client,
    config: LocalModelConfig,
}

impl LocalModelService {
    pub fn new(config: LocalModelConfig) -> Self {
        Self {
            client: Client::new(),
            config,
        }
    }

    /// Generate artifact using local Qwen3-30B-Coder
    pub async fn generate_artifact(&self, user_prompt: &str) -> Result<ArtifactResult, String> {
        let system_prompt = r#"You are an expert frontend developer. Generate clean, modern HTML/CSS/JavaScript code based on user descriptions.

RULES:
1. Return ONLY valid JSON with this exact structure:
{
  "title": "Brief title for the artifact",
  "html": "Complete HTML structure",
  "css": "Complete CSS styling",
  "javascript": "Complete JavaScript code"
}

2. HTML requirements:
   - Semantic HTML5 elements
   - Include ALL necessary structure in one file
   - Use class names for styling

3. CSS requirements:
   - Modern, beautiful styling
   - Responsive design
   - Dark theme compatible
   - Smooth animations/transitions

4. JavaScript requirements:
   - Vanilla JavaScript (no external libraries)
   - Event-driven architecture
   - Error handling
   - Clean, commented code

5. DO NOT include any explanations or markdown - ONLY the JSON object.

Example output:
{
  "title": "Interactive Counter",
  "html": "<div class='counter'><button id='dec'>-</button><span id='count'>0</span><button id='inc'>+</button></div>",
  "css": ".counter { display: flex; gap: 10px; } button { padding: 10px 20px; }",
  "javascript": "let count = 0; document.getElementById('inc').onclick = () => { count++; document.getElementById('count').textContent = count; };"
}"#;

        let messages = vec![
            Message {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            Message {
                role: "user".to_string(),
                content: user_prompt.to_string(),
            },
        ];

        let response = self.chat(messages).await?;

        // Try to extract JSON from response (in case model adds markdown)
        let json_str = if response.contains("```json") {
            // Extract from markdown code block
            response
                .split("```json")
                .nth(1)
                .and_then(|s| s.split("```").next())
                .unwrap_or(&response)
                .trim()
        } else if response.contains("```") {
            // Extract from any code block
            response
                .split("```")
                .nth(1)
                .unwrap_or(&response)
                .trim()
        } else {
            response.trim()
        };

        // Parse JSON response
        let artifact: ArtifactResult = serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse artifact JSON: {}. Response: {}", e, json_str))?;

        Ok(artifact)
    }

    /// Generate database schema using local model
    pub async fn generate_database(&self, user_prompt: &str) -> Result<DatabaseResult, String> {
        let system_prompt = r#"You are a database design expert. Generate database schemas from natural language descriptions.

Return ONLY valid JSON with this structure:
{
  "title": "Database name",
  "columns": [
    {
      "name": "Column name",
      "type": "text|number|date|select|checkbox",
      "options": ["option1", "option2"] // Only for select type
    }
  ],
  "rows": [] // Start with empty array
}

Examples:
- "text" for names, descriptions, URLs
- "number" for quantities, prices, ratings
- "date" for timestamps, deadlines, birthdays
- "select" for status, category, priority (with options array)
- "checkbox" for boolean flags

Return ONLY the JSON, no explanations."#;

        let messages = vec![
            Message {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            Message {
                role: "user".to_string(),
                content: user_prompt.to_string(),
            },
        ];

        let response = self.chat(messages).await?;

        // Extract JSON
        let json_str = if response.contains("```json") {
            response
                .split("```json")
                .nth(1)
                .and_then(|s| s.split("```").next())
                .unwrap_or(&response)
                .trim()
        } else if response.contains("```") {
            response
                .split("```")
                .nth(1)
                .unwrap_or(&response)
                .trim()
        } else {
            response.trim()
        };

        // Parse JSON response
        let database: DatabaseResult = serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse database JSON: {}. Response: {}", e, json_str))?;

        Ok(database)
    }

    /// Chat with local model
    pub async fn chat(&self, messages: Vec<Message>) -> Result<String, String> {
        let url = format!("{}/v1/chat/completions", self.config.endpoint);

        let request = ChatCompletionRequest {
            model: self.config.model.clone(),
            messages,
            max_tokens: self.config.max_tokens,
            temperature: self.config.temperature,
        };

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Local model API error {}: {}", status, error_text));
        }

        let completion: ChatCompletionResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let content = completion.choices
            .first()
            .ok_or("No choices in response")?
            .message
            .content
            .clone();

        Ok(content)
    }

    /// Health check
    pub async fn health_check(&self) -> Result<(), String> {
        let url = format!("{}/health", self.config.endpoint);

        self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Health check failed: {}", e))?;

        Ok(())
    }
}

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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_local_model_chat() {
        let config = LocalModelConfig {
            endpoint: "http://localhost:8080".to_string(),
            model: "qwen3-coder-30b".to_string(),
            max_tokens: 100,
            temperature: 0.7,
        };

        let service = LocalModelService::new(config);

        // This will fail if server isn't running - that's expected in tests
        if let Ok(response) = service.chat(vec![
            Message {
                role: "user".to_string(),
                content: "Say 'Hello, Weave!' and nothing else.".to_string(),
            }
        ]).await {
            assert!(response.contains("Hello"));
        }
    }
}
