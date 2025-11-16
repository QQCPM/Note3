# Phase 3: Multi-Block Orchestration - Design Document

## Research Summary

Based on 2025 best practices for workflow orchestration:

### Key Patterns
1. **Planner-Executor**: AI plans workflow, then executes step-by-step
2. **State Machine**: Explicit states, transitions, retries, timeouts
3. **Modular Design**: Single-responsibility components
4. **Conditional Edges**: Adapt workflow based on feedback
5. **Error Handling**: Retries, rollback, human-in-the-loop

### Core Principles
- Start simple, iterate
- Clear input/output contracts
- Observability & logging
- Template-based reusability
- Data flow management via State

---

## Architecture Design

### 1. Orchestration Engine

**Purpose**: Execute multi-step workflows with state management

**Components**:
```rust
// Workflow state machine
enum WorkflowState {
    Planning,        // AI planning the workflow
    Executing,       // Executing steps
    DataFlow,        // Passing data between blocks
    Validating,      // Checking results
    Completed,       // Success
    Failed(String),  // Error with reason
    Paused,          // Waiting for input
}

// Workflow step
struct WorkflowStep {
    id: String,
    step_type: StepType,
    inputs: HashMap<String, Value>,
    outputs: HashMap<String, Value>,
    status: StepStatus,
    retry_count: u32,
    max_retries: u32,
}

enum StepType {
    CreateNote,
    CreateDatabase,
    CreateArtifact,
    DataTransform,   // Transform data between blocks
    Validate,        // Validate results
    Custom(String),  // Custom step
}

enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed(String),
    Skipped,
}
```

**Key Methods**:
```rust
pub struct OrchestrationEngine {
    state: WorkflowState,
    steps: Vec<WorkflowStep>,
    context: WorkflowContext,
}

impl OrchestrationEngine {
    // Plan workflow from user intent
    pub async fn plan(prompt: String, ai: &AIManager) -> Result<Vec<WorkflowStep>>;

    // Execute workflow
    pub async fn execute(&mut self, db: &SqlitePool) -> Result<WorkflowResult>;

    // Handle step failure with retry
    pub async fn handle_failure(&mut self, step: &WorkflowStep) -> Result<()>;

    // Pass data from one step to another
    pub fn data_flow(&mut self, from_step: &str, to_step: &str, mapping: DataMapping) -> Result<()>;
}
```

---

### 2. Template System

**Purpose**: Pre-defined workflow patterns for common use cases

**Template Structure**:
```rust
struct WorkflowTemplate {
    id: String,
    name: String,
    description: String,
    tags: Vec<String>,
    steps: Vec<TemplateStep>,
    data_mappings: Vec<DataMapping>,
}

struct TemplateStep {
    id: String,
    step_type: StepType,
    config: Value,          // Step configuration
    depends_on: Vec<String>, // Dependencies
}

struct DataMapping {
    from_step: String,
    from_field: String,
    to_step: String,
    to_field: String,
    transform: Option<TransformFn>,
}
```

**Built-in Templates**:

1. **Expense Tracker**
   - Create note "Expense Tracker"
   - Create database (Date, Category, Amount, Notes)
   - Create artifact: data entry form
   - Create artifact: pie chart by category

2. **Todo List**
   - Create note "Todo List"
   - Create database (Task, Status, Priority, Due Date)
   - Create artifact: kanban board

3. **Project Dashboard**
   - Create note "Project Dashboard"
   - Create database: Projects
   - Create database: Tasks
   - Create artifact: timeline view
   - Create artifact: progress charts

4. **Meeting Notes**
   - Create note "Meeting [Date]"
   - Create database: Action Items
   - Create database: Attendees
   - Create artifact: summary template

---

### 3. State Manager

**Purpose**: Track workflow execution and enable rollback

```rust
struct WorkflowContext {
    workflow_id: String,
    note_id: String,
    created_blocks: Vec<String>,  // For rollback
    variables: HashMap<String, Value>,  // Shared state
    execution_log: Vec<ExecutionEvent>,
}

struct ExecutionEvent {
    timestamp: DateTime<Utc>,
    step_id: String,
    event_type: EventType,
    details: Value,
}

enum EventType {
    StepStarted,
    StepCompleted,
    StepFailed,
    DataFlowCompleted,
    RollbackInitiated,
}
```

**Features**:
- Track all created blocks
- Enable rollback on failure
- Store intermediate results
- Log execution for debugging

---

### 4. Data Flow Engine

**Purpose**: Transform and pass data between workflow steps

```rust
struct DataFlowEngine;

impl DataFlowEngine {
    // Extract data from database block
    pub async fn extract_from_database(
        block_id: &str,
        query: Option<Value>,
        db: &SqlitePool,
    ) -> Result<Vec<Value>>;

    // Transform data using AI or custom function
    pub async fn transform(
        data: Vec<Value>,
        transformation: Transformation,
        ai: Option<&AIManager>,
    ) -> Result<Vec<Value>>;

    // Inject data into artifact
    pub async fn inject_into_artifact(
        artifact_id: &str,
        data: Vec<Value>,
        mapping: DataMapping,
        db: &SqlitePool,
    ) -> Result<()>;

    // Database → Chart data
    pub async fn database_to_chart(
        database_id: &str,
        chart_type: ChartType,
        db: &SqlitePool,
    ) -> Result<ChartData>;
}

enum Transformation {
    AITransform(String),     // Use AI to transform
    Aggregate(AggregateOp),  // sum, avg, count, etc.
    Filter(FilterExpr),      // Filter rows
    Map(String),             // Map fields
    Custom(Box<dyn Fn(Value) -> Value>),
}
```

---

### 5. AI Workflow Planner

**Purpose**: Use AI to plan and adapt workflows

```rust
struct WorkflowPlanner;

impl WorkflowPlanner {
    // Plan workflow from natural language
    pub async fn plan_from_prompt(
        prompt: &str,
        context: &WorkflowContext,
        ai: &AIManager,
    ) -> Result<Vec<WorkflowStep>>;

    // Match prompt to template
    pub async fn match_template(
        prompt: &str,
        templates: &[WorkflowTemplate],
        ai: &AIManager,
    ) -> Result<Option<WorkflowTemplate>>;

    // Adapt workflow based on results
    pub async fn adapt_workflow(
        current_steps: Vec<WorkflowStep>,
        error: Option<&str>,
        ai: &AIManager,
    ) -> Result<Vec<WorkflowStep>>;
}
```

**Planning Process**:
1. Analyze user prompt
2. Check if matches existing template
3. If yes: instantiate template with params
4. If no: use AI to generate custom workflow
5. Validate plan before execution
6. Execute with error handling

---

## Implementation Plan

### Step 1: Core Orchestration Engine (Backend)
**Files**:
- `src-tauri/src/orchestration/mod.rs`
- `src-tauri/src/orchestration/engine.rs`
- `src-tauri/src/orchestration/state.rs`

**Tasks**:
1. Define workflow state machine
2. Implement step execution
3. Add retry logic
4. Add rollback capability

### Step 2: Template System (Backend)
**Files**:
- `src-tauri/src/orchestration/templates.rs`
- `src-tauri/src/orchestration/template_registry.rs`

**Tasks**:
1. Define template structure
2. Create built-in templates
3. Template instantiation logic
4. Template matching AI

### Step 3: Data Flow Engine (Backend)
**Files**:
- `src-tauri/src/orchestration/data_flow.rs`

**Tasks**:
1. Database extraction
2. Data transformation
3. Artifact injection
4. Database → Chart conversion

### Step 4: Tauri Commands (Backend)
**Files**:
- `src-tauri/src/commands/orchestration.rs`

**Commands**:
```rust
#[tauri::command]
pub async fn orchestrate_workflow(
    prompt: String,
    note_id: Option<String>,
    template_id: Option<String>,
    state: State<'_, AIState>,
    db: State<'_, SqlitePool>,
) -> Result<WorkflowResult, String>;

#[tauri::command]
pub async fn get_workflow_templates() -> Result<Vec<WorkflowTemplate>, String>;

#[tauri::command]
pub async fn get_workflow_status(
    workflow_id: String,
) -> Result<WorkflowStatus, String>;

#[tauri::command]
pub async fn cancel_workflow(
    workflow_id: String,
) -> Result<(), String>;
```

### Step 5: Frontend Service (TypeScript)
**Files**:
- `src/services/orchestration.ts`

**API**:
```typescript
class OrchestrationService {
  async orchestrateWorkflow(prompt: string, noteId?: string): Promise<WorkflowResult>;
  async getTemplates(): Promise<WorkflowTemplate[]>;
  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatus>;
  async cancelWorkflow(workflowId: string): Promise<void>;
}
```

### Step 6: UI Components (Frontend)
**Files**:
- `src/components/Orchestration/WorkflowBuilder.tsx`
- `src/components/Orchestration/TemplateSelector.tsx`
- `src/components/Orchestration/WorkflowStatus.tsx`

**Features**:
- Template selection UI
- Workflow progress visualization
- Error display and retry options

---

## Example Workflows

### Example 1: Expense Tracker

**User Prompt**: "Create an expense tracker"

**AI Planning**:
```json
{
  "template": "expense_tracker",
  "steps": [
    {
      "id": "step1",
      "type": "CreateNote",
      "config": {"title": "Expense Tracker"}
    },
    {
      "id": "step2",
      "type": "CreateDatabase",
      "depends_on": ["step1"],
      "config": {
        "title": "Expenses",
        "columns": [
          {"name": "Date", "type": "date"},
          {"name": "Category", "type": "select", "options": ["Food", "Transport", "Entertainment"]},
          {"name": "Amount", "type": "number"},
          {"name": "Notes", "type": "text"}
        ]
      }
    },
    {
      "id": "step3",
      "type": "CreateArtifact",
      "depends_on": ["step2"],
      "config": {
        "title": "Add Expense Form",
        "artifact_type": "form",
        "data_source": "step2.database_id"
      }
    },
    {
      "id": "step4",
      "type": "CreateArtifact",
      "depends_on": ["step2"],
      "config": {
        "title": "Expense Chart",
        "artifact_type": "pie_chart",
        "data_source": "step2.database_id",
        "chart_config": {
          "x": "Category",
          "y": "Amount"
        }
      }
    }
  ],
  "data_mappings": [
    {
      "from": "step2.database_id",
      "to": "step3.artifact.data_source"
    },
    {
      "from": "step2.database_id",
      "to": "step4.artifact.data_source"
    }
  ]
}
```

**Execution**:
1. Create note "Expense Tracker"
2. Create database with expense columns
3. Use db_create_chart_data to generate chart config
4. Create form artifact with database reference
5. Create pie chart artifact with database reference
6. Return workflow result with all block IDs

---

### Example 2: Custom Workflow

**User Prompt**: "Create a project tracker with tasks, milestones, and a Gantt chart"

**AI Planning** (custom, no template):
```json
{
  "custom": true,
  "steps": [
    {
      "id": "step1",
      "type": "CreateNote",
      "config": {"title": "Project Tracker"}
    },
    {
      "id": "step2",
      "type": "CreateDatabase",
      "config": {
        "title": "Tasks",
        "columns": [
          {"name": "Task", "type": "text"},
          {"name": "Status", "type": "select", "options": ["Todo", "In Progress", "Done"]},
          {"name": "Start Date", "type": "date"},
          {"name": "End Date", "type": "date"},
          {"name": "Assignee", "type": "text"}
        ]
      }
    },
    {
      "id": "step3",
      "type": "CreateDatabase",
      "config": {
        "title": "Milestones",
        "columns": [
          {"name": "Milestone", "type": "text"},
          {"name": "Date", "type": "date"},
          {"name": "Status", "type": "select", "options": ["Pending", "Completed"]}
        ]
      }
    },
    {
      "id": "step4",
      "type": "CreateArtifact",
      "config": {
        "title": "Gantt Chart",
        "artifact_type": "gantt",
        "data_source": "step2.database_id"
      }
    }
  ]
}
```

---

## Error Handling Strategy

### Retry Logic
```rust
async fn execute_step_with_retry(
    step: &WorkflowStep,
    context: &WorkflowContext,
) -> Result<Value> {
    let mut attempts = 0;
    let mut last_error = None;

    while attempts < step.max_retries {
        match execute_step_internal(step, context).await {
            Ok(result) => return Ok(result),
            Err(e) => {
                attempts += 1;
                last_error = Some(e);

                if attempts < step.max_retries {
                    // Exponential backoff
                    sleep(Duration::from_secs(2u64.pow(attempts)));
                }
            }
        }
    }

    Err(last_error.unwrap())
}
```

### Rollback on Failure
```rust
async fn rollback_workflow(context: &WorkflowContext, db: &SqlitePool) -> Result<()> {
    // Delete blocks in reverse order
    for block_id in context.created_blocks.iter().rev() {
        delete_block(block_id, db).await?;
    }

    // Log rollback
    log_event(ExecutionEvent {
        event_type: EventType::RollbackCompleted,
        details: json!({"blocks_removed": context.created_blocks.len()}),
        ...
    });

    Ok(())
}
```

---

## Success Metrics

1. **Template Coverage**: 5+ built-in templates
2. **Success Rate**: >90% for templated workflows
3. **Execution Time**: <5s for typical 4-step workflow
4. **Error Recovery**: Automatic retry on transient failures
5. **Data Flow**: Seamless data passing between blocks

---

## Next Steps

1. ✅ Research workflow patterns
2. ✅ Design architecture
3. ⏳ Implement orchestration engine
4. ⏳ Implement template system
5. ⏳ Implement data flow
6. ⏳ Add Tauri commands
7. ⏳ Create frontend service
8. ⏳ Test end-to-end
9. ⏳ Document

**Estimated Lines of Code**: ~2,000 lines
- Backend orchestration: ~1,200 lines
- Frontend service: ~300 lines
- Templates: ~300 lines
- Documentation: ~200 lines
