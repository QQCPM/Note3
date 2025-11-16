use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use chrono::{DateTime, Utc};

// ============================================================================
// WORKFLOW STATE MACHINE
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WorkflowState {
    Planning,
    Executing,
    DataFlow,
    Validating,
    Completed,
    Failed(String),
    Paused,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed(String),
    Skipped,
}

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub id: String,
    pub name: String,
    pub state: WorkflowState,
    pub steps: Vec<WorkflowStep>,
    pub context: WorkflowContext,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub id: String,
    pub step_type: StepType,
    pub config: StepConfig,
    pub depends_on: Vec<String>,
    pub inputs: HashMap<String, Value>,
    pub outputs: HashMap<String, Value>,
    pub status: StepStatus,
    pub retry_count: u32,
    pub max_retries: u32,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum StepType {
    CreateNote,
    CreateDatabase,
    CreateArtifact,
    DataTransform,
    Validate,
    AIGenerate,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepConfig {
    #[serde(flatten)]
    pub params: Value,
}

impl WorkflowStep {
    pub fn new(id: String, step_type: StepType, config: Value) -> Self {
        Self {
            id,
            step_type,
            config: StepConfig { params: config },
            depends_on: Vec::new(),
            inputs: HashMap::new(),
            outputs: HashMap::new(),
            status: StepStatus::Pending,
            retry_count: 0,
            max_retries: 3,
            error: None,
        }
    }

    pub fn with_dependencies(mut self, depends_on: Vec<String>) -> Self {
        self.depends_on = depends_on;
        self
    }

    pub fn is_ready(&self, completed_steps: &[String]) -> bool {
        self.depends_on.iter().all(|dep| completed_steps.contains(dep))
    }
}

// ============================================================================
// WORKFLOW CONTEXT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowContext {
    pub workflow_id: String,
    pub note_id: Option<String>,
    pub created_blocks: Vec<String>,
    pub variables: HashMap<String, Value>,
    pub execution_log: Vec<ExecutionEvent>,
}

impl WorkflowContext {
    pub fn new(workflow_id: String, note_id: Option<String>) -> Self {
        Self {
            workflow_id,
            note_id,
            created_blocks: Vec::new(),
            variables: HashMap::new(),
            execution_log: Vec::new(),
        }
    }

    pub fn add_block(&mut self, block_id: String) {
        self.created_blocks.push(block_id);
    }

    pub fn set_variable(&mut self, key: String, value: Value) {
        self.variables.insert(key, value);
    }

    pub fn get_variable(&self, key: &str) -> Option<&Value> {
        self.variables.get(key)
    }

    pub fn log_event(&mut self, event: ExecutionEvent) {
        self.execution_log.push(event);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionEvent {
    pub timestamp: DateTime<Utc>,
    pub step_id: String,
    pub event_type: EventType,
    pub details: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    StepStarted,
    StepCompleted,
    StepFailed,
    StepRetrying,
    DataFlowCompleted,
    ValidationPassed,
    ValidationFailed,
    RollbackInitiated,
    RollbackCompleted,
}

// ============================================================================
// WORKFLOW RESULT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowResult {
    pub workflow_id: String,
    pub state: WorkflowState,
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

// ============================================================================
// DATA FLOW TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataMapping {
    pub from_step: String,
    pub from_field: String,
    pub to_step: String,
    pub to_field: String,
    pub transform: Option<Transformation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "config")]
pub enum Transformation {
    AITransform { prompt: String },
    Aggregate { operation: String, column: String },
    Filter { expression: String },
    Map { mapping: HashMap<String, String> },
    GroupBy { columns: Vec<String>, aggregations: Vec<Value> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartData {
    pub chart_type: ChartType,
    pub data: Vec<Value>,
    pub config: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChartType {
    Pie,
    Bar,
    Line,
    Scatter,
    Gantt,
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub icon: String,
    pub steps: Vec<TemplateStep>,
    pub data_mappings: Vec<DataMapping>,
    pub parameters: Vec<TemplateParameter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateStep {
    pub id: String,
    pub step_type: StepType,
    pub config: Value,
    pub depends_on: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateParameter {
    pub name: String,
    pub param_type: ParameterType,
    pub description: String,
    pub default: Option<Value>,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ParameterType {
    String,
    Number,
    Boolean,
    Array,
    Object,
}

impl WorkflowTemplate {
    pub fn instantiate(&self, params: HashMap<String, Value>) -> Result<Vec<WorkflowStep>, String> {
        let mut steps = Vec::new();

        for template_step in &self.steps {
            // Replace parameters in config
            let config = self.replace_params(&template_step.config, &params)?;

            let mut step = WorkflowStep::new(
                template_step.id.clone(),
                template_step.step_type.clone(),
                config,
            );

            step.depends_on = template_step.depends_on.clone();
            steps.push(step);
        }

        Ok(steps)
    }

    fn replace_params(&self, config: &Value, params: &HashMap<String, Value>) -> Result<Value, String> {
        // Simple parameter replacement (can be enhanced)
        let config_str = serde_json::to_string(config).map_err(|e| e.to_string())?;
        let mut result = config_str;

        for (key, value) in params {
            let placeholder = format!("{{{{{}}}}}", key);
            let value_str = if value.is_string() {
                value.as_str().unwrap().to_string()
            } else {
                serde_json::to_string(value).map_err(|e| e.to_string())?
            };
            result = result.replace(&placeholder, &value_str);
        }

        serde_json::from_str(&result).map_err(|e| e.to_string())
    }
}
