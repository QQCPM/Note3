use serde::{Deserialize, Serialize};
use reqwest::Client;
use futures_util::StreamExt;
use super::{ArtifactResult, DatabaseResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIConfig {
    pub api_key: String,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Tool {
    pub r#type: String,
    pub function: FunctionDefinition,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FunctionDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub r#type: String,
    pub function: FunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<Message>,
    temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<Tool>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
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
    content: Option<String>,
    #[serde(default)]
    tool_calls: Vec<ToolCall>,
}

#[derive(Debug, Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    delta: Delta,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Delta {
    content: Option<String>,
    #[serde(default)]
    tool_calls: Vec<ToolCall>,
}

pub struct OpenAIService {
    client: Client,
    config: OpenAIConfig,
}

impl OpenAIService {
    pub fn new(config: OpenAIConfig) -> Self {
        Self {
            client: Client::new(),
            config,
        }
    }

    /// Generate a chat completion (non-streaming)
    pub async fn chat(&self, messages: Vec<Message>, tools: Option<Vec<Tool>>) -> Result<(String, Vec<ToolCall>), String> {
        let url = "https://api.openai.com/v1/chat/completions";

        let request = ChatCompletionRequest {
            model: self.config.model.clone(),
            messages,
            temperature: self.config.temperature,
            max_tokens: self.config.max_tokens,
            tools,
            stream: None,
        };

        let response = self.client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI API error {}: {}", status, error_text));
        }

        let completion: ChatCompletionResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let choice = completion.choices.first()
            .ok_or("No choices in response")?;

        let content = choice.message.content.clone().unwrap_or_default();
        let tool_calls = choice.message.tool_calls.clone();

        Ok((content, tool_calls))
    }

    /// Generate artifact (HTML/CSS/JS) with specialized prompt
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

        let (content, _) = self.chat(messages, None).await?;

        // Parse JSON response
        let artifact: ArtifactResult = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse artifact JSON: {}. Response: {}", e, content))?;

        Ok(artifact)
    }

    /// Generate database schema from natural language
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

        let (content, _) = self.chat(messages, None).await?;

        // Parse JSON response
        let database: DatabaseResult = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse database JSON: {}. Response: {}", e, content))?;

        Ok(database)
    }

    /// Chat with tools (function calling)
    pub async fn chat_with_tools(
        &self,
        messages: Vec<Message>,
        tools: Vec<Tool>,
    ) -> Result<(String, Vec<ToolCall>), String> {
        self.chat(messages, Some(tools)).await
    }

    /// Stream chat completion
    pub async fn chat_stream(
        &self,
        messages: Vec<Message>,
    ) -> Result<impl futures_core::Stream<Item = Result<String, String>>, String> {
        let url = "https://api.openai.com/v1/chat/completions";

        let request = ChatCompletionRequest {
            model: self.config.model.clone(),
            messages,
            temperature: self.config.temperature,
            max_tokens: self.config.max_tokens,
            tools: None,
            stream: Some(true),
        };

        let response = self.client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI API error {}: {}", status, error_text));
        }

        let stream = response.bytes_stream().map(|chunk_result| {
            match chunk_result {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    // Parse SSE format: "data: {...}\n\n"
                    for line in text.lines() {
                        if line.starts_with("data: ") {
                            let json_str = &line[6..];
                            if json_str == "[DONE]" {
                                continue;
                            }
                            if let Ok(chunk) = serde_json::from_str::<StreamChunk>(json_str) {
                                if let Some(choice) = chunk.choices.first() {
                                    if let Some(content) = &choice.delta.content {
                                        return Ok(content.clone());
                                    }
                                }
                            }
                        }
                    }
                    Ok(String::new())
                }
                Err(e) => Err(format!("Stream error: {}", e)),
            }
        });

        Ok(stream)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_chat() {
        // This requires a valid API key - skip in CI
        if std::env::var("OPENAI_API_KEY").is_err() {
            return;
        }

        let config = OpenAIConfig {
            api_key: std::env::var("OPENAI_API_KEY").unwrap(),
            model: "gpt-4o-mini".to_string(),
            temperature: 0.7,
            max_tokens: Some(100),
        };

        let service = OpenAIService::new(config);

        let messages = vec![Message {
            role: "user".to_string(),
            content: "Say 'Hello!' and nothing else.".to_string(),
        }];

        let (response, _) = service.chat(messages, None).await.unwrap();
        assert!(response.contains("Hello"));
    }
}
