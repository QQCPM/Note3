use crate::ai::{
    AIManager, OpenAIConfig, OpenAIService, ReasoningEffort,
    BuiltInTool, ResponsesInput, ResponsesResult, ResponsesToolCall,
    Message, FunctionDefinition,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

// ============================================================================
// GPT-5.2 AGENTIC SYSTEM
// Full agent with web search, code execution, image generation, and more
// ============================================================================

/// Configuration for the GPT-5 Agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GPT5AgentConfig {
    /// Model to use (default: gpt-5.2)
    pub model: String,
    /// Reasoning effort level
    pub reasoning_effort: ReasoningEffort,
    /// Maximum tokens for output
    pub max_tokens: u32,
    /// Enable web search
    pub enable_web_search: bool,
    /// Enable code interpreter
    pub enable_code_interpreter: bool,
    /// Code interpreter memory limit
    pub code_interpreter_memory: String,
    /// Enable file search
    pub enable_file_search: bool,
    /// Enable image generation
    pub enable_image_generation: bool,
    /// Custom function tools
    pub custom_tools: Vec<FunctionDefinition>,
    /// Maximum conversation turns before compaction
    pub max_turns_before_compaction: usize,
    /// System instructions
    pub system_instructions: Option<String>,
}

impl Default for GPT5AgentConfig {
    fn default() -> Self {
        Self {
            model: "gpt-5.2".to_string(),
            reasoning_effort: ReasoningEffort::Medium,
            max_tokens: 16384,
            enable_web_search: true,
            enable_code_interpreter: true,
            code_interpreter_memory: "4g".to_string(),
            enable_file_search: true,
            enable_image_generation: true,
            custom_tools: vec![],
            max_turns_before_compaction: 20,
            system_instructions: None,
        }
    }
}

impl GPT5AgentConfig {
    /// Create a config optimized for learning/research tasks
    pub fn for_learning() -> Self {
        Self {
            model: "gpt-5.2".to_string(),
            reasoning_effort: ReasoningEffort::High,
            max_tokens: 32768,
            enable_web_search: true,
            enable_code_interpreter: true,
            code_interpreter_memory: "4g".to_string(),
            enable_file_search: true,
            enable_image_generation: true,
            custom_tools: vec![],
            max_turns_before_compaction: 30,
            system_instructions: Some(
                "You are an expert learning assistant. When creating educational content:\n\
                 1. Break down complex topics into digestible sections\n\
                 2. Use web search to find current, accurate information\n\
                 3. Create code examples and run them to verify they work\n\
                 4. Generate illustrations and diagrams to aid understanding\n\
                 5. Create interactive artifacts when appropriate\n\
                 6. Always cite sources for factual claims\n\
                 7. Organize content logically with clear headings\n\
                 8. Include practice exercises and examples".to_string()
            ),
        }
    }

    /// Create a config optimized for project creation
    pub fn for_project_creation() -> Self {
        Self {
            model: "gpt-5.2".to_string(),
            reasoning_effort: ReasoningEffort::High,
            max_tokens: 65536,
            enable_web_search: true,
            enable_code_interpreter: true,
            code_interpreter_memory: "16g".to_string(),
            enable_file_search: true,
            enable_image_generation: true,
            custom_tools: vec![],
            max_turns_before_compaction: 50,
            system_instructions: Some(
                "You are an expert project creator. When building comprehensive projects:\n\
                 1. First analyze the source material thoroughly\n\
                 2. Create a structured outline with multiple notes/sections\n\
                 3. Research additional context via web search when needed\n\
                 4. Generate code artifacts for interactive demonstrations\n\
                 5. Create visualizations and diagrams using image generation\n\
                 6. Build databases for structured data\n\
                 7. Ensure all content is interconnected and well-organized\n\
                 8. Include summaries, key takeaways, and practice materials".to_string()
            ),
        }
    }
}

/// Message in the agent's conversation history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub role: AgentRole,
    pub content: String,
    /// Tool calls made in this message (for assistant messages)
    #[serde(default)]
    pub tool_calls: Vec<AgentToolCall>,
    /// Tool results (for tool messages)
    #[serde(default)]
    pub tool_results: Vec<AgentToolResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AgentRole {
    User,
    Assistant,
    Tool,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentToolCall {
    pub id: String,
    pub tool_type: String,
    pub name: Option<String>,
    pub arguments: Option<String>,
    /// Results from built-in tools
    pub results: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentToolResult {
    pub tool_call_id: String,
    pub result: Value,
    pub success: bool,
}

/// Result from an agent execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentExecutionResult {
    /// Final response content
    pub content: String,
    /// All tool calls made during execution
    pub tool_calls: Vec<AgentToolCall>,
    /// Web search results (if any)
    pub web_search_results: Vec<WebSearchInfo>,
    /// Code execution results (if any)
    pub code_results: Vec<CodeExecutionInfo>,
    /// Generated images (if any)
    pub generated_images: Vec<GeneratedImageInfo>,
    /// Token usage
    pub usage: Option<UsageInfo>,
    /// Number of turns taken
    pub turns: usize,
    /// Whether context was compacted
    pub context_compacted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSearchInfo {
    pub query: String,
    pub results: Vec<SearchResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultItem {
    pub title: String,
    pub url: String,
    pub snippet: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeExecutionInfo {
    pub code: String,
    pub output: String,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedImageInfo {
    pub prompt: String,
    pub url: Option<String>,
    pub base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageInfo {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub reasoning_tokens: Option<u32>,
    pub total_tokens: u32,
}

/// The main GPT-5.2 Agent
pub struct GPT5Agent {
    service: OpenAIService,
    config: GPT5AgentConfig,
    conversation_history: Vec<AgentMessage>,
    total_tokens_used: u32,
}

impl GPT5Agent {
    /// Create a new GPT-5 Agent
    pub fn new(api_key: &str, config: GPT5AgentConfig) -> Self {
        let openai_config = OpenAIConfig {
            api_key: api_key.to_string(),
            model: config.model.clone(),
            temperature: 0.7,
            max_tokens: Some(config.max_tokens),
            reasoning_effort: config.reasoning_effort,
            use_responses_api: true,
        };

        Self {
            service: OpenAIService::new(openai_config),
            config,
            conversation_history: vec![],
            total_tokens_used: 0,
        }
    }

    /// Create from an existing AIManager
    pub fn from_ai_manager(ai_manager: &AIManager, config: GPT5AgentConfig) -> Self {
        let mut openai_config = ai_manager.config.agent.clone();
        openai_config.model = config.model.clone();
        openai_config.max_tokens = Some(config.max_tokens);
        openai_config.reasoning_effort = config.reasoning_effort;
        openai_config.use_responses_api = true;

        Self {
            service: OpenAIService::new(openai_config),
            config,
            conversation_history: vec![],
            total_tokens_used: 0,
        }
    }

    /// Build the list of enabled tools
    fn build_tools(&self) -> Vec<BuiltInTool> {
        let mut tools = vec![];

        if self.config.enable_web_search {
            tools.push(BuiltInTool::web_search());
        }

        if self.config.enable_code_interpreter {
            tools.push(BuiltInTool::code_interpreter(Some(&self.config.code_interpreter_memory)));
        }

        if self.config.enable_file_search {
            tools.push(BuiltInTool::file_search(None));
        }

        if self.config.enable_image_generation {
            tools.push(BuiltInTool::image_generation());
        }

        // Add custom function tools
        for func in &self.config.custom_tools {
            tools.push(BuiltInTool::function(func.clone()));
        }

        tools
    }

    /// Convert conversation history to Responses API input format
    fn build_input(&self, new_message: Option<&str>) -> Vec<ResponsesInput> {
        let mut input = vec![];

        // Add conversation history
        for msg in &self.conversation_history {
            match msg.role {
                AgentRole::User | AgentRole::Assistant => {
                    input.push(ResponsesInput {
                        role: if msg.role == AgentRole::User { "user" } else { "assistant" }.to_string(),
                        content: msg.content.clone(),
                    });
                }
                AgentRole::Tool => {
                    // Tool results are included in the flow
                    for result in &msg.tool_results {
                        input.push(ResponsesInput {
                            role: "tool".to_string(),
                            content: serde_json::to_string(&result).unwrap_or_default(),
                        });
                    }
                }
                AgentRole::System => {
                    // System messages handled via instructions
                }
            }
        }

        // Add new user message
        if let Some(message) = new_message {
            input.push(ResponsesInput {
                role: "user".to_string(),
                content: message.to_string(),
            });
        }

        input
    }

    /// Execute the agent with a user message
    pub async fn execute(&mut self, user_message: &str) -> Result<AgentExecutionResult, String> {
        // Add user message to history
        self.conversation_history.push(AgentMessage {
            role: AgentRole::User,
            content: user_message.to_string(),
            tool_calls: vec![],
            tool_results: vec![],
        });

        // Check if we need to compact context
        let context_compacted = if self.conversation_history.len() > self.config.max_turns_before_compaction {
            self.compact_context().await?;
            true
        } else {
            false
        };

        let mut all_tool_calls = vec![];
        let mut web_search_results = vec![];
        let mut code_results = vec![];
        let mut generated_images = vec![];
        let mut total_usage = UsageInfo {
            input_tokens: 0,
            output_tokens: 0,
            reasoning_tokens: None,
            total_tokens: 0,
        };
        let mut turns = 0;
        const MAX_TURNS: usize = 10;

        // Agentic loop - continue until no more tool calls
        loop {
            turns += 1;
            if turns > MAX_TURNS {
                return Err("Maximum agent turns exceeded".to_string());
            }

            // Build input and call API
            let input = self.build_input(None);
            let tools = self.build_tools();

            let result = self.service.responses(
                input,
                self.config.system_instructions.clone(),
                if tools.is_empty() { None } else { Some(tools) },
            ).await?;

            // Update token usage
            if let Some(usage) = &result.usage {
                total_usage.input_tokens += usage.input_tokens;
                total_usage.output_tokens += usage.output_tokens;
                if let Some(reasoning) = usage.reasoning_tokens {
                    total_usage.reasoning_tokens = Some(
                        total_usage.reasoning_tokens.unwrap_or(0) + reasoning
                    );
                }
            }

            // Process tool calls
            let mut has_tool_calls = false;
            for tool_call in &result.tool_calls {
                has_tool_calls = true;

                let agent_tool_call = AgentToolCall {
                    id: tool_call.id.clone(),
                    tool_type: tool_call.tool_type.clone(),
                    name: tool_call.name.clone(),
                    arguments: tool_call.arguments.clone(),
                    results: None,
                };

                // Process based on tool type
                match tool_call.tool_type.as_str() {
                    "web_search" | "web_search_call" => {
                        if let Some(results) = &tool_call.results {
                            let search_info = WebSearchInfo {
                                query: tool_call.arguments.clone().unwrap_or_default(),
                                results: results.iter().map(|r| SearchResultItem {
                                    title: r.title.clone(),
                                    url: r.url.clone(),
                                    snippet: r.snippet.clone(),
                                }).collect(),
                            };
                            web_search_results.push(search_info);
                        }
                    }
                    "code_interpreter" | "code_interpreter_call" => {
                        if let (Some(code), Some(output)) = (&tool_call.code, &tool_call.output) {
                            code_results.push(CodeExecutionInfo {
                                code: code.clone(),
                                output: output.clone(),
                                success: true,
                            });
                        }
                    }
                    "image_generation" | "image_generation_call" => {
                        generated_images.push(GeneratedImageInfo {
                            prompt: tool_call.arguments.clone().unwrap_or_default(),
                            url: None, // Would be populated from actual response
                            base64: None,
                        });
                    }
                    _ => {}
                }

                all_tool_calls.push(agent_tool_call);
            }

            // Add assistant response to history
            self.conversation_history.push(AgentMessage {
                role: AgentRole::Assistant,
                content: result.content.clone(),
                tool_calls: all_tool_calls.iter().cloned().collect(),
                tool_results: vec![],
            });

            // If no tool calls, we're done
            if !has_tool_calls {
                total_usage.total_tokens = total_usage.input_tokens + total_usage.output_tokens;

                return Ok(AgentExecutionResult {
                    content: result.content,
                    tool_calls: all_tool_calls,
                    web_search_results,
                    code_results,
                    generated_images,
                    usage: Some(total_usage),
                    turns,
                    context_compacted,
                });
            }

            // Tool calls are automatically handled by GPT-5.2 Responses API
            // The model continues with tool results in the next iteration
        }
    }

    /// Compact the conversation context to manage long conversations
    async fn compact_context(&mut self) -> Result<(), String> {
        if self.conversation_history.len() < 4 {
            return Ok(()); // Not enough to compact
        }

        // Keep first 2 messages (usually system context) and last 4 messages
        let history_len = self.conversation_history.len();
        let to_summarize = &self.conversation_history[2..history_len - 4];

        if to_summarize.is_empty() {
            return Ok(());
        }

        // Build summary prompt
        let summary_prompt = format!(
            "Summarize the following conversation context concisely, preserving:\n\
             1. Key decisions made\n\
             2. Important information discovered\n\
             3. Current state of the task\n\
             4. Any pending actions\n\
             \n\
             Conversation:\n{}",
            to_summarize.iter()
                .map(|m| format!("{:?}: {}", m.role, m.content))
                .collect::<Vec<_>>()
                .join("\n")
        );

        // Get summary (using simple chat, not full agent loop)
        let summary_input = vec![ResponsesInput {
            role: "user".to_string(),
            content: summary_prompt,
        }];

        let summary_result = self.service.responses(summary_input, None, None).await?;

        // Rebuild conversation history with compacted middle section
        let mut new_history = vec![];

        // Keep first 2 messages
        new_history.extend(self.conversation_history[..2].iter().cloned());

        // Add summary as system context
        new_history.push(AgentMessage {
            role: AgentRole::System,
            content: format!("[Previous conversation summary]\n{}", summary_result.content),
            tool_calls: vec![],
            tool_results: vec![],
        });

        // Keep last 4 messages
        new_history.extend(self.conversation_history[history_len - 4..].iter().cloned());

        self.conversation_history = new_history;

        Ok(())
    }

    /// Clear conversation history
    pub fn clear_history(&mut self) {
        self.conversation_history.clear();
        self.total_tokens_used = 0;
    }

    /// Get current conversation history
    pub fn get_history(&self) -> &[AgentMessage] {
        &self.conversation_history
    }

    /// Get total tokens used in this session
    pub fn get_total_tokens(&self) -> u32 {
        self.total_tokens_used
    }

    /// Execute a complex project creation task
    pub async fn create_learning_project(
        &mut self,
        source_content: &str,
        project_name: &str,
    ) -> Result<AgentExecutionResult, String> {
        let prompt = format!(
            "Create a comprehensive learning project called \"{}\" based on the following content.\n\
             \n\
             SOURCE MATERIAL:\n{}\n\
             \n\
             INSTRUCTIONS:\n\
             1. First, analyze the source material thoroughly\n\
             2. Create an outline with multiple sections/chapters\n\
             3. For each section:\n\
                - Write clear explanations\n\
                - Use web search to find additional context and examples\n\
                - Create code examples and run them to verify they work\n\
                - Generate diagrams/illustrations where helpful\n\
                - Add practice exercises\n\
             4. Create a summary with key takeaways\n\
             5. Build any relevant databases for structured information\n\
             \n\
             Be thorough and create high-quality educational content.",
            project_name, source_content
        );

        self.execute(&prompt).await
    }

    /// Execute a research task with citations
    pub async fn research_topic(
        &mut self,
        topic: &str,
        depth: &str, // "quick", "moderate", "deep"
    ) -> Result<AgentExecutionResult, String> {
        let prompt = format!(
            "Research the following topic with {} depth:\n\
             \n\
             TOPIC: {}\n\
             \n\
             INSTRUCTIONS:\n\
             1. Search the web for current, authoritative sources\n\
             2. Compile information from multiple sources\n\
             3. Verify facts by cross-referencing\n\
             4. Create a structured report with:\n\
                - Executive summary\n\
                - Key findings\n\
                - Detailed sections\n\
                - Data visualizations if relevant\n\
                - Sources and citations\n\
             5. If relevant, create code examples or interactive demonstrations\n\
             \n\
             Prioritize accuracy and cite all sources.",
            depth, topic
        );

        self.execute(&prompt).await
    }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/// Create a GPT-5 agent optimized for learning projects
pub fn create_learning_agent(api_key: &str) -> GPT5Agent {
    GPT5Agent::new(api_key, GPT5AgentConfig::for_learning())
}

/// Create a GPT-5 agent optimized for project creation
pub fn create_project_agent(api_key: &str) -> GPT5Agent {
    GPT5Agent::new(api_key, GPT5AgentConfig::for_project_creation())
}

/// Create a default GPT-5 agent
pub fn create_default_agent(api_key: &str) -> GPT5Agent {
    GPT5Agent::new(api_key, GPT5AgentConfig::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_defaults() {
        let config = GPT5AgentConfig::default();
        assert_eq!(config.model, "gpt-5.2");
        assert!(config.enable_web_search);
        assert!(config.enable_code_interpreter);
    }

    #[test]
    fn test_build_tools() {
        let agent = GPT5Agent::new("test-key", GPT5AgentConfig::default());
        let tools = agent.build_tools();

        assert!(tools.len() >= 4); // web_search, code_interpreter, file_search, image_generation
    }

    #[test]
    fn test_learning_config() {
        let config = GPT5AgentConfig::for_learning();
        assert_eq!(config.reasoning_effort, ReasoningEffort::High);
        assert!(config.system_instructions.is_some());
    }
}
