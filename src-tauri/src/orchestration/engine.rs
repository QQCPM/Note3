use super::types::*;
use crate::db::{Block, Note};
use crate::ai::AIManager;
use sqlx::SqlitePool;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Instant;
use chrono::Utc;
use uuid::Uuid;

pub struct OrchestrationEngine {
    pub workflow: Workflow,
    db: SqlitePool,
}

impl OrchestrationEngine {
    pub fn new(workflow_id: String, name: String, steps: Vec<WorkflowStep>, note_id: Option<String>, db: SqlitePool) -> Self {
        let context = WorkflowContext::new(workflow_id.clone(), note_id);

        Self {
            workflow: Workflow {
                id: workflow_id,
                name,
                state: WorkflowState::Planning,
                steps,
                context,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            },
            db,
        }
    }

    /// Execute the workflow
    pub async fn execute(&mut self) -> Result<WorkflowResult, String> {
        let start_time = Instant::now();

        self.workflow.state = WorkflowState::Executing;
        self.workflow.updated_at = Utc::now();

        let mut steps_completed = 0;
        let mut steps_failed = 0;

        // Execute steps in dependency order
        while let Some(step_id) = self.get_next_ready_step() {
            match self.execute_step(&step_id).await {
                Ok(_) => {
                    steps_completed += 1;
                }
                Err(e) => {
                    steps_failed += 1;
                    eprintln!("Step {} failed: {}", step_id, e);

                    // Check if we should retry
                    let step = self.workflow.steps.iter_mut()
                        .find(|s| s.id == step_id)
                        .unwrap();

                    if step.retry_count < step.max_retries {
                        step.retry_count += 1;
                        step.status = StepStatus::Pending;

                        self.workflow.context.log_event(ExecutionEvent {
                            timestamp: Utc::now(),
                            step_id: step_id.clone(),
                            event_type: EventType::StepRetrying,
                            details: json!({"attempt": step.retry_count, "error": e}),
                        });

                        eprintln!("Retrying step {} (attempt {}/{})", step_id, step.retry_count, step.max_retries);
                        continue;
                    } else {
                        // Max retries reached, fail the workflow
                        self.workflow.state = WorkflowState::Failed(e.clone());

                        // Rollback
                        self.rollback().await?;

                        return Ok(WorkflowResult {
                            workflow_id: self.workflow.id.clone(),
                            state: self.workflow.state.clone(),
                            created_blocks: vec![],
                            execution_time_ms: start_time.elapsed().as_millis() as u64,
                            steps_completed,
                            steps_failed,
                            error: Some(e),
                        });
                    }
                }
            }
        }

        // Check if all steps completed
        let all_completed = self.workflow.steps.iter()
            .all(|s| matches!(s.status, StepStatus::Completed | StepStatus::Skipped));

        if all_completed {
            self.workflow.state = WorkflowState::Completed;
        } else {
            self.workflow.state = WorkflowState::Failed("Not all steps completed".to_string());
        }

        self.workflow.updated_at = Utc::now();

        // Collect created blocks info
        let mut block_infos = Vec::new();
        for block_id in &self.workflow.context.created_blocks {
            if let Ok(block) = self.get_block(block_id).await {
                let title = self.extract_title_from_block(&block);
                block_infos.push(BlockInfo {
                    id: block.id,
                    block_type: block.block_type,
                    title,
                    step_id: "".to_string(), // TODO: track which step created which block
                });
            }
        }

        Ok(WorkflowResult {
            workflow_id: self.workflow.id.clone(),
            state: self.workflow.state.clone(),
            created_blocks: block_infos,
            execution_time_ms: start_time.elapsed().as_millis() as u64,
            steps_completed,
            steps_failed,
            error: None,
        })
    }

    /// Get the next step that's ready to execute
    fn get_next_ready_step(&self) -> Option<String> {
        let completed_steps: Vec<String> = self.workflow.steps.iter()
            .filter(|s| matches!(s.status, StepStatus::Completed))
            .map(|s| s.id.clone())
            .collect();

        self.workflow.steps.iter()
            .find(|s| matches!(s.status, StepStatus::Pending) && s.is_ready(&completed_steps))
            .map(|s| s.id.clone())
    }

    /// Execute a single step
    async fn execute_step(&mut self, step_id: &str) -> Result<(), String> {
        let step_index = self.workflow.steps.iter()
            .position(|s| s.id == step_id)
            .ok_or("Step not found")?;

        // Update status to running
        self.workflow.steps[step_index].status = StepStatus::Running;

        self.workflow.context.log_event(ExecutionEvent {
            timestamp: Utc::now(),
            step_id: step_id.to_string(),
            event_type: EventType::StepStarted,
            details: json!({}),
        });

        // Execute based on step type
        let step = &self.workflow.steps[step_index].clone();
        let result = match &step.step_type {
            StepType::CreateNote => self.execute_create_note(step).await,
            StepType::CreateDatabase => self.execute_create_database(step).await,
            StepType::CreateArtifact => self.execute_create_artifact(step).await,
            StepType::DataTransform => self.execute_data_transform(step).await,
            StepType::Validate => self.execute_validate(step).await,
            StepType::AIGenerate => self.execute_ai_generate(step).await,
            StepType::Custom(_) => Err("Custom steps not yet implemented".to_string()),
        };

        // Update step status based on result
        match result {
            Ok(output) => {
                let step = &mut self.workflow.steps[step_index];
                step.status = StepStatus::Completed;
                step.outputs = output;

                self.workflow.context.log_event(ExecutionEvent {
                    timestamp: Utc::now(),
                    step_id: step_id.to_string(),
                    event_type: EventType::StepCompleted,
                    details: json!({"outputs": step.outputs}),
                });

                Ok(())
            }
            Err(e) => {
                let step = &mut self.workflow.steps[step_index];
                step.status = StepStatus::Failed(e.clone());
                step.error = Some(e.clone());

                self.workflow.context.log_event(ExecutionEvent {
                    timestamp: Utc::now(),
                    step_id: step_id.to_string(),
                    event_type: EventType::StepFailed,
                    details: json!({"error": e}),
                });

                Err(e)
            }
        }
    }

    /// Execute create note step
    async fn execute_create_note(&mut self, step: &WorkflowStep) -> Result<HashMap<String, Value>, String> {
        let title = step.config.params.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled Note");

        let parent_id = self.workflow.context.note_id.clone();

        // Create note
        let note_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO notes (id, title, parent_id, created_at, updated_at, is_deleted)
             VALUES (?, ?, ?, datetime('now'), datetime('now'), 0)"
        )
        .bind(&note_id)
        .bind(title)
        .bind(parent_id.as_deref())
        .execute(&self.db)
        .await
        .map_err(|e| format!("Failed to create note: {}", e))?;

        // If this is the first note and we don't have a note_id, set it
        if self.workflow.context.note_id.is_none() {
            self.workflow.context.note_id = Some(note_id.clone());
        }

        let mut outputs = HashMap::new();
        outputs.insert("note_id".to_string(), json!(note_id));

        Ok(outputs)
    }

    /// Execute create database step
    async fn execute_create_database(&mut self, step: &WorkflowStep) -> Result<HashMap<String, Value>, String> {
        let note_id = self.workflow.context.note_id.as_ref()
            .ok_or("No note_id in context")?;

        let title = step.config.params.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Database");

        let columns = step.config.params.get("columns")
            .ok_or("Missing columns in database config")?;

        // Clone existing rows if present, otherwise use an empty array value
        let rows = step.config.params.get("rows")
            .cloned()
            .unwrap_or_else(|| json!([]));

        // Create database block
        let block_id = Uuid::new_v4().to_string();
        let data = json!({
            "title": title,
            "columns": columns,
            "rows": rows
        });

        // Get current max position
        let max_position: Option<i32> = sqlx::query_scalar(
            "SELECT MAX(position) FROM blocks WHERE note_id = ?"
        )
        .bind(note_id)
        .fetch_optional(&self.db)
        .await
        .map_err(|e| format!("Failed to get max position: {}", e))?
        .flatten();

        let position = max_position.unwrap_or(-1) + 1;

        sqlx::query(
            "INSERT INTO blocks (id, note_id, type, data, position, created_at, updated_at)
             VALUES (?, ?, 'database', ?, ?, datetime('now'), datetime('now'))"
        )
        .bind(&block_id)
        .bind(note_id)
        .bind(data.to_string())
        .bind(position)
        .execute(&self.db)
        .await
        .map_err(|e| format!("Failed to create database block: {}", e))?;

        self.workflow.context.add_block(block_id.clone());

        let mut outputs = HashMap::new();
        outputs.insert("block_id".to_string(), json!(block_id));
        outputs.insert("block_type".to_string(), json!("database"));

        Ok(outputs)
    }

    /// Execute create artifact step
    async fn execute_create_artifact(&mut self, step: &WorkflowStep) -> Result<HashMap<String, Value>, String> {
        let note_id = self.workflow.context.note_id.as_ref()
            .ok_or("No note_id in context")?;

        let title = step.config.params.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Artifact");

        // Check if we need to get data from another step
        let data_source_step = step.config.params.get("data_source_step")
            .and_then(|v| v.as_str());

        let mut artifact_data = json!({
            "title": title,
            "html": "",
            "css": "",
            "javascript": ""
        });

        // If there's a chart config, generate chart artifact
        if let Some(chart_config) = step.config.params.get("chart_config") {
            let chart_type = chart_config.get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("pie");

            // Get database ID from previous step if specified
            let database_id = if let Some(source_step) = data_source_step {
                self.get_step_output(source_step, "block_id")?
                    .as_str()
                    .ok_or("Invalid database ID")?
                    .to_string()
            } else {
                return Err("No data source for chart".to_string());
            };

            // Generate chart artifact
            artifact_data = self.generate_chart_artifact(&database_id, chart_type, chart_config).await?;
        }

        // Create artifact block
        let block_id = Uuid::new_v4().to_string();

        let max_position: Option<i32> = sqlx::query_scalar(
            "SELECT MAX(position) FROM blocks WHERE note_id = ?"
        )
        .bind(note_id)
        .fetch_optional(&self.db)
        .await
        .map_err(|e| format!("Failed to get max position: {}", e))?
        .flatten();

        let position = max_position.unwrap_or(-1) + 1;

        sqlx::query(
            "INSERT INTO blocks (id, note_id, type, data, position, created_at, updated_at)
             VALUES (?, ?, 'artifact', ?, ?, datetime('now'), datetime('now'))"
        )
        .bind(&block_id)
        .bind(note_id)
        .bind(artifact_data.to_string())
        .bind(position)
        .execute(&self.db)
        .await
        .map_err(|e| format!("Failed to create artifact block: {}", e))?;

        self.workflow.context.add_block(block_id.clone());

        let mut outputs = HashMap::new();
        outputs.insert("block_id".to_string(), json!(block_id));
        outputs.insert("block_type".to_string(), json!("artifact"));

        Ok(outputs)
    }

    /// Execute data transform step
    async fn execute_data_transform(&mut self, _step: &WorkflowStep) -> Result<HashMap<String, Value>, String> {
        // TODO: Implement data transformation logic
        Ok(HashMap::new())
    }

    /// Execute validate step
    async fn execute_validate(&mut self, _step: &WorkflowStep) -> Result<HashMap<String, Value>, String> {
        // TODO: Implement validation logic
        Ok(HashMap::new())
    }

    /// Execute AI generate step
    async fn execute_ai_generate(&mut self, _step: &WorkflowStep) -> Result<HashMap<String, Value>, String> {
        // TODO: Implement AI generation logic
        Ok(HashMap::new())
    }

    /// Generate a chart artifact from a database
    async fn generate_chart_artifact(&self, database_id: &str, chart_type: &str, _chart_config: &Value) -> Result<Value, String> {
        // Get database data
        let block = self.get_block(database_id).await?;
        let data: Value = serde_json::from_str(&block.data)
            .map_err(|e| format!("Invalid block data: {}", e))?;

        let title = data.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Chart");

        // Generate simple chart HTML based on type
        let (html, css, javascript) = match chart_type {
            "pie" => self.generate_pie_chart(&data),
            "bar" => self.generate_bar_chart(&data),
            "line" => self.generate_line_chart(&data),
            _ => ("".to_string(), "".to_string(), "".to_string()),
        };

        Ok(json!({
            "title": format!("{} Chart", title),
            "html": html,
            "css": css,
            "javascript": javascript
        }))
    }

    fn generate_pie_chart(&self, database_data: &Value) -> (String, String, String) {
        let html = r#"
<div class="chart-container">
    <canvas id="pieChart"></canvas>
</div>
        "#.to_string();

        let css = r#"
.chart-container {
    width: 100%;
    max-width: 500px;
    margin: 20px auto;
}
        "#.to_string();

        let javascript = format!(r#"
// Chart data from database
const databaseData = {};

// Use Chart.js to render (assuming it's loaded)
if (typeof Chart !== 'undefined') {{
    const ctx = document.getElementById('pieChart').getContext('2d');
    new Chart(ctx, {{
        type: 'pie',
        data: {{
            labels: ['Category A', 'Category B', 'Category C'],
            datasets: [{{
                data: [30, 50, 20],
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
            }}]
        }},
        options: {{
            responsive: true,
            maintainAspectRatio: true
        }}
    }});
}}
        "#, serde_json::to_string_pretty(database_data).unwrap_or_default());

        (html, css, javascript)
    }

    fn generate_bar_chart(&self, _database_data: &Value) -> (String, String, String) {
        // Similar to pie chart but with bar type
        ("".to_string(), "".to_string(), "".to_string())
    }

    fn generate_line_chart(&self, _database_data: &Value) -> (String, String, String) {
        // Similar to pie chart but with line type
        ("".to_string(), "".to_string(), "".to_string())
    }

    /// Get output value from a previous step
    fn get_step_output(&self, step_id: &str, key: &str) -> Result<&Value, String> {
        let step = self.workflow.steps.iter()
            .find(|s| s.id == step_id)
            .ok_or("Step not found")?;

        step.outputs.get(key)
            .ok_or(format!("Output key '{}' not found in step '{}'", key, step_id))
    }

    /// Get a block by ID
    async fn get_block(&self, block_id: &str) -> Result<Block, String> {
        sqlx::query_as::<_, Block>("SELECT * FROM blocks WHERE id = ?")
            .bind(block_id)
            .fetch_one(&self.db)
            .await
            .map_err(|e| format!("Block not found: {}", e))
    }

    /// Extract title from block data
    fn extract_title_from_block(&self, block: &Block) -> String {
        if let Ok(data) = serde_json::from_str::<Value>(&block.data) {
            data.get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Untitled")
                .to_string()
        } else {
            "Untitled".to_string()
        }
    }

    /// Rollback the workflow (delete created blocks)
    async fn rollback(&mut self) -> Result<(), String> {
        self.workflow.context.log_event(ExecutionEvent {
            timestamp: Utc::now(),
            step_id: "rollback".to_string(),
            event_type: EventType::RollbackInitiated,
            details: json!({"blocks_to_remove": self.workflow.context.created_blocks.len()}),
        });

        // Delete blocks in reverse order
        for block_id in self.workflow.context.created_blocks.iter().rev() {
            sqlx::query("DELETE FROM blocks WHERE id = ?")
                .bind(block_id)
                .execute(&self.db)
                .await
                .map_err(|e| format!("Failed to delete block: {}", e))?;
        }

        self.workflow.context.log_event(ExecutionEvent {
            timestamp: Utc::now(),
            step_id: "rollback".to_string(),
            event_type: EventType::RollbackCompleted,
            details: json!({}),
        });

        Ok(())
    }
}
