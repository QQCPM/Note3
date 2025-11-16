use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

/// Agent step types for autonomous task execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AgentStepType {
    /// Research a topic on the web
    Research {
        query: String,
        purpose: String,
    },

    /// Extract structured data from research results
    ExtractData {
        query: String,
        schema: DataSchema,
        count: usize,
    },

    /// Create a note block
    CreateNote {
        title: String,
        parent_id: Option<String>,
    },

    /// Create a database block
    CreateDatabase {
        title: String,
        columns: Vec<DatabaseColumn>,
    },

    /// Create an artifact block
    CreateArtifact {
        title: String,
        artifact_type: String,
        content_prompt: String,
    },

    /// Generate content for a block
    GenerateContent {
        block_id: String,
        content_type: String,
        prompt: String,
    },

    /// Populate database with data
    PopulateDatabase {
        database_id: String,
        data_source: DataSource,
    },

    /// Validate work quality
    Validate {
        target: String,
        criteria: Vec<String>,
    },

    /// Reflect on work and improve
    Reflect {
        on: String,
        improve: bool,
    },
}

/// Agent step with execution tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStep {
    pub id: String,
    pub step_type: AgentStepType,
    pub depends_on: Vec<String>,
    pub status: StepStatus,
    pub result: Option<StepResult>,
    pub error: Option<String>,
    pub retry_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StepStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResult {
    pub success: bool,
    pub data: Option<Value>,
    pub message: String,
}

/// Data source for database population
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum DataSource {
    /// Data from web research
    Research {
        data: Vec<HashMap<String, Value>>,
    },
    /// AI-generated data
    AIGenerated {
        prompt: String,
    },
    /// Transformed from another database
    Transformed {
        source_database_id: String,
        transformation: String,
    },
}

/// Schema for structured data extraction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSchema {
    pub columns: Vec<ColumnSpec>,
    pub constraints: Vec<Constraint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnSpec {
    pub name: String,
    pub data_type: String,
    pub description: String,
    pub example: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseColumn {
    pub name: String,
    pub r#type: String,
    pub options: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Constraint {
    pub r#type: ConstraintType,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConstraintType {
    Required,
    Unique,
    Range { min: f64, max: f64 },
    Pattern { regex: String },
}

/// Research result from web search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResearchResult {
    pub query: String,
    pub sources: Vec<Source>,
    pub summary: String,
    pub data: Option<Vec<HashMap<String, Value>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

/// Execution context for autonomous tasks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionContext {
    pub task_id: String,
    pub original_task: String,
    pub note_id: Option<String>,
    pub created_blocks: Vec<String>,
    pub execution_history: Vec<ExecutionEvent>,
    pub variables: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionEvent {
    pub step_id: String,
    pub event_type: EventType,
    pub timestamp: i64,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    StepStarted,
    StepCompleted,
    StepFailed,
    DataExtracted,
    BlockCreated,
    ValidationPassed,
    ValidationFailed,
}

/// Final result of autonomous task execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgenticResult {
    pub task_id: String,
    pub status: AgenticStatus,
    pub created_blocks: Vec<BlockInfo>,
    pub execution_time_ms: u64,
    pub steps_completed: usize,
    pub steps_failed: usize,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockInfo {
    pub id: String,
    pub block_type: String,
    pub title: String,
    pub step_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgenticStatus {
    Planning,
    Researching,
    Extracting,
    Creating,
    Populating,
    Validating,
    Completed,
    Failed,
}

/// Validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub passed: bool,
    pub issues: Vec<ValidationIssue>,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationIssue {
    pub severity: IssueSeverity,
    pub description: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IssueSeverity {
    Error,
    Warning,
    Info,
}

/// Improvement suggestion from self-reflection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Improvement {
    pub target: String,
    pub description: String,
    pub action: String,
}
