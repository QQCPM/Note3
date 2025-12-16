use serde::{Deserialize, Serialize};
use reqwest::Client;
use futures_util::StreamExt;
use super::{ArtifactResult, DatabaseResult};

// ============================================================================
// CONFIGURATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIConfig {
    pub api_key: String,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: Option<u32>,
    /// Reasoning effort for GPT-5.x models (none, minimal, low, medium, high, xhigh)
    #[serde(default = "default_reasoning_effort")]
    pub reasoning_effort: ReasoningEffort,
    /// Whether to use the Responses API (for GPT-5.x with built-in tools)
    #[serde(default)]
    pub use_responses_api: bool,
}

fn default_reasoning_effort() -> ReasoningEffort {
    ReasoningEffort::Medium
}

/// Reasoning effort levels for GPT-5.x models
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ReasoningEffort {
    /// No reasoning tokens (fastest, non-reasoning mode)
    None,
    /// ~10% of max_tokens for reasoning
    Minimal,
    /// ~20% of max_tokens for reasoning
    Low,
    /// ~50% of max_tokens for reasoning (balanced)
    #[default]
    Medium,
    /// ~80% of max_tokens for reasoning
    High,
    /// ~95% of max_tokens for reasoning (deepest analysis, GPT-5.2+)
    Xhigh,
}

impl ReasoningEffort {
    pub fn as_str(&self) -> &'static str {
        match self {
            ReasoningEffort::None => "none",
            ReasoningEffort::Minimal => "minimal",
            ReasoningEffort::Low => "low",
            ReasoningEffort::Medium => "medium",
            ReasoningEffort::High => "high",
            ReasoningEffort::Xhigh => "xhigh",
        }
    }
}

// ============================================================================
// BUILT-IN TOOLS (Responses API)
// ============================================================================

/// Built-in tools available in the Responses API
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BuiltInTool {
    /// Web search tool - searches the internet for real-time information
    WebSearch {
        #[serde(skip_serializing_if = "Option::is_none")]
        search_context_size: Option<String>, // "low", "medium", "high"
    },
    /// Code interpreter - runs Python code in a sandboxed environment
    CodeInterpreter {
        #[serde(skip_serializing_if = "Option::is_none")]
        container: Option<CodeInterpreterContainer>,
    },
    /// File search - searches through uploaded files
    FileSearch {
        #[serde(skip_serializing_if = "Option::is_none")]
        vector_store_ids: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        max_num_results: Option<u32>,
    },
    /// Image generation - generates images using DALL-E
    ImageGeneration {
        #[serde(skip_serializing_if = "Option::is_none")]
        quality: Option<String>, // "low", "medium", "high"
        #[serde(skip_serializing_if = "Option::is_none")]
        size: Option<String>, // "1024x1024", "1792x1024", etc.
    },
    /// Custom function tool (for your own functions)
    Function {
        function: FunctionDefinition,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeInterpreterContainer {
    #[serde(rename = "type")]
    pub container_type: String, // "auto"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_limit: Option<String>, // "1g", "4g", "16g", "64g"
}

impl BuiltInTool {
    /// Create a web search tool with default settings
    pub fn web_search() -> Self {
        BuiltInTool::WebSearch {
            search_context_size: Some("medium".to_string()),
        }
    }

    /// Create a code interpreter tool with specified memory
    pub fn code_interpreter(memory: Option<&str>) -> Self {
        BuiltInTool::CodeInterpreter {
            container: Some(CodeInterpreterContainer {
                container_type: "auto".to_string(),
                memory_limit: memory.map(|m| m.to_string()),
            }),
        }
    }

    /// Create a file search tool
    pub fn file_search(vector_store_ids: Option<Vec<String>>) -> Self {
        BuiltInTool::FileSearch {
            vector_store_ids,
            max_num_results: Some(20),
        }
    }

    /// Create an image generation tool
    pub fn image_generation() -> Self {
        BuiltInTool::ImageGeneration {
            quality: Some("high".to_string()),
            size: Some("1024x1024".to_string()),
        }
    }

    /// Create a custom function tool
    pub fn function(definition: FunctionDefinition) -> Self {
        BuiltInTool::Function { function: definition }
    }
}

/// Result from the Responses API
#[derive(Debug, Clone)]
pub struct ResponsesResult {
    pub id: String,
    pub content: String,
    pub tool_calls: Vec<ResponsesToolCall>,
    pub usage: Option<ResponsesUsageInfo>,
}

#[derive(Debug, Clone)]
pub struct ResponsesUsageInfo {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub reasoning_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub r#type: String,
    pub function: FunctionDefinition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

// ============================================================================
// CHAT COMPLETIONS API (Legacy, for GPT-4o and older)
// ============================================================================

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<Message>,
    temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_completion_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<Tool>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

// ============================================================================
// RESPONSES API (GPT-5.x with reasoning and built-in tools)
// ============================================================================

#[derive(Debug, Serialize)]
struct ResponsesApiRequest {
    model: String,
    input: Vec<ResponsesInput>,
    #[serde(skip_serializing_if = "Option::is_none")]
    instructions: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reasoning: Option<ReasoningConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<BuiltInTool>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_output_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponsesInput {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
struct ReasoningConfig {
    effort: String,
}

#[derive(Debug, Deserialize)]
struct ResponsesApiResponse {
    id: String,
    output: Vec<ResponsesOutput>,
    #[serde(default)]
    usage: Option<ResponsesUsage>,
}

#[derive(Debug, Deserialize)]
struct ResponsesOutput {
    #[serde(rename = "type")]
    output_type: String,
    #[serde(default)]
    content: Option<Vec<ResponsesContent>>,
    #[serde(default)]
    tool_calls: Option<Vec<ResponsesToolCall>>,
}

#[derive(Debug, Deserialize)]
struct ResponsesContent {
    #[serde(rename = "type")]
    content_type: String,
    #[serde(default)]
    text: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ResponsesToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub tool_type: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub arguments: Option<String>,
    // For web_search results
    #[serde(default)]
    pub results: Option<Vec<WebSearchResult>>,
    // For code_interpreter results
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub output: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct WebSearchResult {
    pub title: String,
    pub url: String,
    #[serde(default)]
    pub snippet: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ResponsesUsage {
    input_tokens: u32,
    output_tokens: u32,
    #[serde(default)]
    reasoning_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct ResponsesStreamChunk {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    delta: Option<ResponsesStreamDelta>,
}

#[derive(Debug, Deserialize)]
struct ResponsesStreamDelta {
    #[serde(rename = "type")]
    delta_type: Option<String>,
    #[serde(default)]
    text: Option<String>,
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

#[derive(Clone)]
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

        // GPT-5 and newer use max_completion_tokens, older models use max_tokens
        let is_gpt5_or_newer = self.config.model.starts_with("gpt-5") ||
                                self.config.model.starts_with("o1") ||
                                self.config.model.starts_with("o3");

        let request = ChatCompletionRequest {
            model: self.config.model.clone(),
            messages,
            temperature: self.config.temperature,
            max_tokens: if is_gpt5_or_newer { None } else { self.config.max_tokens },
            max_completion_tokens: if is_gpt5_or_newer { self.config.max_tokens } else { None },
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
      "id": "unique-column-id",
      "name": "Column name",
      "type": "text|number|date|select|checkbox",
      "options": ["option1", "option2"] // Only for select type
    }
  ],
  "rows": [] // Start with empty array
}

IMPORTANT: Each column MUST have a unique "id" field. Generate UUIDs or use format like "col_1", "col_2", etc.

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

    /// Chat with tools (function calling) - Chat Completions API
    pub async fn chat_with_tools(
        &self,
        messages: Vec<Message>,
        tools: Vec<Tool>,
    ) -> Result<(String, Vec<ToolCall>), String> {
        self.chat(messages, Some(tools)).await
    }

    // ========================================================================
    // RESPONSES API (GPT-5.x with reasoning and built-in tools)
    // ========================================================================

    /// Check if model supports Responses API
    fn supports_responses_api(&self) -> bool {
        self.config.model.starts_with("gpt-5") ||
        self.config.model.starts_with("o1") ||
        self.config.model.starts_with("o3")
    }

    /// Generate a response using the Responses API (GPT-5.x)
    /// Supports reasoning effort and built-in tools (web_search, code_interpreter, etc.)
    pub async fn responses(
        &self,
        input: Vec<ResponsesInput>,
        instructions: Option<String>,
        tools: Option<Vec<BuiltInTool>>,
    ) -> Result<ResponsesResult, String> {
        let url = "https://api.openai.com/v1/responses";

        // Build reasoning config based on model support
        let reasoning = if self.supports_responses_api() {
            Some(ReasoningConfig {
                effort: self.config.reasoning_effort.as_str().to_string(),
            })
        } else {
            None
        };

        let request = ResponsesApiRequest {
            model: self.config.model.clone(),
            input,
            instructions,
            reasoning,
            tools,
            max_output_tokens: self.config.max_tokens,
            temperature: Some(self.config.temperature),
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
            return Err(format!("OpenAI Responses API error {}: {}", status, error_text));
        }

        let api_response: ResponsesApiResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        // Extract content and tool results from response
        let mut content = String::new();
        let mut tool_calls = Vec::new();

        for output in api_response.output {
            // Extract text content
            if let Some(contents) = output.content {
                for c in contents {
                    if c.content_type == "text" {
                        if let Some(text) = c.text {
                            content.push_str(&text);
                        }
                    }
                }
            }
            // Extract tool call results
            if let Some(calls) = output.tool_calls {
                tool_calls.extend(calls);
            }
        }

        Ok(ResponsesResult {
            id: api_response.id,
            content,
            tool_calls,
            usage: api_response.usage.map(|u| ResponsesUsageInfo {
                input_tokens: u.input_tokens,
                output_tokens: u.output_tokens,
                reasoning_tokens: u.reasoning_tokens,
            }),
        })
    }

    /// Convenience method: Chat with web search enabled
    pub async fn chat_with_web_search(
        &self,
        input: &str,
        instructions: Option<String>,
    ) -> Result<ResponsesResult, String> {
        let input_messages = vec![ResponsesInput {
            role: "user".to_string(),
            content: input.to_string(),
        }];

        let tools = vec![BuiltInTool::web_search()];

        self.responses(input_messages, instructions, Some(tools)).await
    }

    /// Convenience method: Chat with code interpreter enabled
    pub async fn chat_with_code_interpreter(
        &self,
        input: &str,
        instructions: Option<String>,
        memory_limit: Option<&str>,
    ) -> Result<ResponsesResult, String> {
        let input_messages = vec![ResponsesInput {
            role: "user".to_string(),
            content: input.to_string(),
        }];

        let tools = vec![BuiltInTool::code_interpreter(memory_limit)];

        self.responses(input_messages, instructions, Some(tools)).await
    }

    /// Convenience method: Agentic chat with all tools enabled
    pub async fn agentic_chat(
        &self,
        input: Vec<ResponsesInput>,
        instructions: Option<String>,
    ) -> Result<ResponsesResult, String> {
        let tools = vec![
            BuiltInTool::web_search(),
            BuiltInTool::code_interpreter(Some("4g")),
            BuiltInTool::file_search(None),
        ];

        self.responses(input, instructions, Some(tools)).await
    }

    /// Stream response using the Responses API
    pub async fn responses_stream(
        &self,
        input: Vec<ResponsesInput>,
        instructions: Option<String>,
        tools: Option<Vec<BuiltInTool>>,
    ) -> Result<impl futures_core::Stream<Item = Result<String, String>>, String> {
        let url = "https://api.openai.com/v1/responses";

        let reasoning = if self.supports_responses_api() {
            Some(ReasoningConfig {
                effort: self.config.reasoning_effort.as_str().to_string(),
            })
        } else {
            None
        };

        let request = ResponsesApiRequest {
            model: self.config.model.clone(),
            input,
            instructions,
            reasoning,
            tools,
            max_output_tokens: self.config.max_tokens,
            temperature: Some(self.config.temperature),
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
            return Err(format!("OpenAI Responses API error {}: {}", status, error_text));
        }

        let stream = response.bytes_stream().map(|chunk_result| {
            match chunk_result {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    // Parse SSE format for Responses API
                    for line in text.lines() {
                        if line.starts_with("data: ") {
                            let json_str = &line[6..];
                            if json_str == "[DONE]" {
                                continue;
                            }
                            if let Ok(chunk) = serde_json::from_str::<ResponsesStreamChunk>(json_str) {
                                if chunk.event_type == "response.output_text.delta" {
                                    if let Some(delta) = chunk.delta {
                                        if let Some(text) = delta.text {
                                            return Ok(text);
                                        }
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

    /// Stream chat completion
    pub async fn chat_stream(
        &self,
        messages: Vec<Message>,
    ) -> Result<impl futures_core::Stream<Item = Result<String, String>>, String> {
        let url = "https://api.openai.com/v1/chat/completions";

        // GPT-5 and newer use max_completion_tokens, older models use max_tokens
        let is_gpt5_or_newer = self.config.model.starts_with("gpt-5") ||
                                self.config.model.starts_with("o1") ||
                                self.config.model.starts_with("o3");

        let request = ChatCompletionRequest {
            model: self.config.model.clone(),
            messages,
            temperature: self.config.temperature,
            max_tokens: if is_gpt5_or_newer { None } else { self.config.max_tokens },
            max_completion_tokens: if is_gpt5_or_newer { self.config.max_tokens } else { None },
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
            reasoning_effort: ReasoningEffort::Medium,
            use_responses_api: false,
        };

        let service = OpenAIService::new(config);

        let messages = vec![Message {
            role: "user".to_string(),
            content: "Say 'Hello!' and nothing else.".to_string(),
        }];

        let (response, _) = service.chat(messages, None).await.unwrap();
        assert!(response.contains("Hello"));
    }

    #[tokio::test]
    async fn test_responses_api() {
        // This requires a valid API key and GPT-5.x access - skip in CI
        if std::env::var("OPENAI_API_KEY").is_err() {
            return;
        }

        let config = OpenAIConfig {
            api_key: std::env::var("OPENAI_API_KEY").unwrap(),
            model: "gpt-5.2".to_string(),
            temperature: 0.7,
            max_tokens: Some(1000),
            reasoning_effort: ReasoningEffort::Medium,
            use_responses_api: true,
        };

        let service = OpenAIService::new(config);

        let input = vec![ResponsesInput {
            role: "user".to_string(),
            content: "Say 'Hello!' and nothing else.".to_string(),
        }];

        let result = service.responses(input, None, None).await.unwrap();
        assert!(result.content.contains("Hello"));
    }

    #[tokio::test]
    async fn test_web_search() {
        // This requires a valid API key and GPT-5.x access - skip in CI
        if std::env::var("OPENAI_API_KEY").is_err() {
            return;
        }

        let config = OpenAIConfig {
            api_key: std::env::var("OPENAI_API_KEY").unwrap(),
            model: "gpt-5.2".to_string(),
            temperature: 0.7,
            max_tokens: Some(2000),
            reasoning_effort: ReasoningEffort::Medium,
            use_responses_api: true,
        };

        let service = OpenAIService::new(config);

        let result = service.chat_with_web_search(
            "What's the current weather in San Francisco?",
            None,
        ).await.unwrap();

        // Should return content with web search results
        assert!(!result.content.is_empty());
    }
}
