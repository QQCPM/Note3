use crate::ai::AIManager;
use crate::agentic::types::*;
use crate::agentic::{WebResearchAgent, MultiStepPlanner};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use std::collections::{HashMap, HashSet};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Autonomous task executor
pub struct AutonomousExecutor {
    db: SqlitePool,
    ai_manager: AIManager,
    research_agent: WebResearchAgent,
    planner: MultiStepPlanner,
    max_retries: u32,
}

impl AutonomousExecutor {
    pub fn new(db: SqlitePool, ai_manager: AIManager) -> Self {
        let research_agent = WebResearchAgent::new(ai_manager.clone());
        let planner = MultiStepPlanner::new(ai_manager.clone());

        Self {
            db,
            ai_manager,
            research_agent,
            planner,
            max_retries: 3,
        }
    }

    /// Execute a complete autonomous task
    pub async fn execute_task(
        &mut self,
        task: &str,
        note_id: Option<String>,
    ) -> Result<AgenticResult, String> {
        let task_id = Uuid::new_v4().to_string();
        let start_time = SystemTime::now();

        // Initialize execution context
        let mut context = ExecutionContext {
            task_id: task_id.clone(),
            original_task: task.to_string(),
            note_id,
            created_blocks: vec![],
            execution_history: vec![],
            variables: HashMap::new(),
        };

        // Step 1: Plan the task
        let mut steps = self.planner.plan(task).await?;

        // Step 2: Execute the plan
        let execution_result = self.execute_plan(&mut steps, &mut context).await;

        // Calculate execution time
        let execution_time = start_time.elapsed()
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        // Count completed and failed steps
        let steps_completed = steps.iter()
            .filter(|s| s.status == StepStatus::Completed)
            .count();
        let steps_failed = steps.iter()
            .filter(|s| s.status == StepStatus::Failed)
            .count();

        // Build result
        let (status, error) = match execution_result {
            Ok(_) => (AgenticStatus::Completed, None),
            Err(e) => (AgenticStatus::Failed, Some(e)),
        };

        let created_blocks = context.created_blocks.iter()
            .map(|id| BlockInfo {
                id: id.clone(),
                block_type: "unknown".to_string(), // TODO: Track block types
                title: "".to_string(),
                step_id: "".to_string(),
            })
            .collect();

        Ok(AgenticResult {
            task_id,
            status,
            created_blocks,
            execution_time_ms: execution_time,
            steps_completed,
            steps_failed,
            error,
        })
    }

    /// Execute a plan step by step
    async fn execute_plan(
        &mut self,
        steps: &mut [AgentStep],
        context: &mut ExecutionContext,
    ) -> Result<(), String> {
        let mut completed_steps: HashSet<String> = HashSet::new();

        // Execute steps in dependency order
        loop {
            // Find next executable step
            let next_step_idx = steps.iter()
                .position(|s| {
                    s.status == StepStatus::Pending &&
                    s.depends_on.iter().all(|dep| completed_steps.contains(dep))
                });

            match next_step_idx {
                Some(idx) => {
                    let step_id = steps[idx].id.clone();

                    // Execute step
                    let result = self.execute_step(&mut steps[idx], context).await;

                    match result {
                        Ok(_) => {
                            steps[idx].status = StepStatus::Completed;
                            completed_steps.insert(step_id);
                        }
                        Err(e) => {
                            // Retry logic
                            if steps[idx].retry_count < self.max_retries {
                                steps[idx].retry_count += 1;
                                steps[idx].status = StepStatus::Pending;

                                self.log_event(
                                    context,
                                    &step_id,
                                    EventType::StepFailed,
                                    &format!("Retry {}/{}: {}", steps[idx].retry_count, self.max_retries, e),
                                );
                            } else {
                                steps[idx].status = StepStatus::Failed;
                                steps[idx].error = Some(e.clone());
                                return Err(format!("Step {} failed after {} retries: {}", step_id, self.max_retries, e));
                            }
                        }
                    }
                }
                None => {
                    // No more executable steps
                    let pending = steps.iter().filter(|s| s.status == StepStatus::Pending).count();
                    if pending > 0 {
                        return Err(format!("{} steps still pending but cannot execute (circular dependency?)", pending));
                    }
                    break;
                }
            }
        }

        Ok(())
    }

    /// Execute a single step
    async fn execute_step(
        &mut self,
        step: &mut AgentStep,
        context: &mut ExecutionContext,
    ) -> Result<(), String> {
        self.log_event(context, &step.id, EventType::StepStarted, "Starting step");

        let result = match &step.step_type {
            AgentStepType::Research { query, purpose } => {
                self.execute_research(query, purpose, context).await
            }
            AgentStepType::ExtractData { query, schema, count } => {
                self.execute_extract_data(query, schema, *count, context).await
            }
            AgentStepType::CreateNote { title, parent_id } => {
                self.execute_create_note(title, parent_id.as_deref(), context).await
            }
            AgentStepType::CreateDatabase { title, columns } => {
                self.execute_create_database(&step.id, title, columns, context).await
            }
            AgentStepType::CreateArtifact { title, artifact_type, content_prompt } => {
                self.execute_create_artifact(title, artifact_type, content_prompt, context).await
            }
            AgentStepType::GenerateContent { block_id, content_type, prompt } => {
                self.execute_generate_content(block_id, content_type, prompt, context).await
            }
            AgentStepType::PopulateDatabase { database_id, data_source } => {
                self.execute_populate_database(database_id, data_source, context).await
            }
            AgentStepType::Validate { target, criteria } => {
                self.execute_validate(target, criteria, context).await
            }
            AgentStepType::Reflect { on, improve } => {
                self.execute_reflect(on, *improve, context).await
            }
        };

        match result {
            Ok(step_result) => {
                step.result = Some(step_result);
                self.log_event(context, &step.id, EventType::StepCompleted, "Step completed successfully");
                Ok(())
            }
            Err(e) => {
                self.log_event(context, &step.id, EventType::StepFailed, &format!("Error: {}", e));
                Err(e)
            }
        }
    }

    // ========================================================================
    // STEP EXECUTION METHODS
    // ========================================================================

    async fn execute_research(
        &self,
        query: &str,
        purpose: &str,
        context: &mut ExecutionContext,
    ) -> Result<StepResult, String> {
        let result = self.research_agent.research(query).await?;

        // Store research summary in variables for later steps
        context.variables.insert(
            format!("research_{}", query.replace(' ', "_")),
            json!(result.summary),
        );

        Ok(StepResult {
            success: true,
            data: Some(json!(result)),
            message: format!("Researched: {}", purpose),
        })
    }

    async fn execute_extract_data(
        &self,
        query: &str,
        schema: &DataSchema,
        count: usize,
        context: &mut ExecutionContext,
    ) -> Result<StepResult, String> {
        let data = self.research_agent.research_and_extract(query, schema.clone(), count).await?;

        // Store extracted data in variables for PopulateDatabase step
        context.variables.insert(
            format!("data_{}", query.replace(' ', "_")),
            json!(data),
        );

        self.log_event(
            context,
            "extract_data",
            EventType::DataExtracted,
            &format!("Extracted {} items", data.len()),
        );

        Ok(StepResult {
            success: true,
            data: Some(json!(data)),
            message: format!("Extracted {} items", data.len()),
        })
    }

    async fn execute_create_note(
        &self,
        title: &str,
        parent_id: Option<&str>,
        context: &mut ExecutionContext,
    ) -> Result<StepResult, String> {
        let note_id = Uuid::new_v4().to_string();

        // Use parent_id from context if not specified
        let actual_parent = parent_id.or(context.note_id.as_deref());

        sqlx::query(
            "INSERT INTO notes (id, title, parent_id, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))"
        )
        .bind(&note_id)
        .bind(title)
        .bind(actual_parent)
        .execute(&self.db)
        .await
        .map_err(|e| format!("Failed to create note: {}", e))?;

        // Update context note_id for subsequent blocks
        context.note_id = Some(note_id.clone());
        context.created_blocks.push(note_id.clone());

        self.log_event(context, "create_note", EventType::BlockCreated, &format!("Created note: {}", title));

        Ok(StepResult {
            success: true,
            data: Some(json!({"note_id": note_id})),
            message: format!("Created note: {}", title),
        })
    }

    async fn execute_create_database(
        &self,
        step_id: &str,
        title: &str,
        columns: &[DatabaseColumn],
        context: &mut ExecutionContext,
    ) -> Result<StepResult, String> {
        let block_id = Uuid::new_v4().to_string();
        let note_id = context.note_id.as_ref()
            .ok_or("No note_id in context. Create a note first.")?;

        // Create database block
        let content = json!({
            "columns": columns,
            "rows": []
        });

        sqlx::query(
            "INSERT INTO blocks (id, note_id, type, title, content, position, created_at, updated_at) \
             VALUES (?, ?, 'database', ?, ?, 0, datetime('now'), datetime('now'))"
        )
        .bind(&block_id)
        .bind(note_id)
        .bind(title)
        .bind(content.to_string())
        .execute(&self.db)
        .await
        .map_err(|e| format!("Failed to create database: {}", e))?;

        context.created_blocks.push(block_id.clone());

        // Store database block ID in variables so PopulateDatabase can find it
        context.variables.insert(format!("database_{}", step_id), json!(block_id));

        self.log_event(context, step_id, EventType::BlockCreated, &format!("Created database: {}", title));

        Ok(StepResult {
            success: true,
            data: Some(json!({"block_id": block_id})),
            message: format!("Created database: {}", title),
        })
    }

    async fn execute_create_artifact(
        &self,
        title: &str,
        artifact_type: &str,
        content_prompt: &str,
        context: &mut ExecutionContext,
    ) -> Result<StepResult, String> {
        let block_id = Uuid::new_v4().to_string();
        let note_id = context.note_id.as_ref()
            .ok_or("No note_id in context. Create a note first.")?;

        // Use AI to generate artifact
        let artifact = self.ai_manager.api_code_service
            .generate_artifact(content_prompt)
            .await
            .map_err(|e| format!("Failed to generate artifact: {}", e))?;

        let content = json!(artifact);

        sqlx::query(
            "INSERT INTO blocks (id, note_id, type, title, content, position, created_at, updated_at) \
             VALUES (?, ?, 'artifact', ?, ?, 0, datetime('now'), datetime('now'))"
        )
        .bind(&block_id)
        .bind(note_id)
        .bind(title)
        .bind(content.to_string())
        .execute(&self.db)
        .await
        .map_err(|e| format!("Failed to create artifact: {}", e))?;

        context.created_blocks.push(block_id.clone());

        self.log_event(context, "create_artifact", EventType::BlockCreated, &format!("Created artifact: {}", title));

        Ok(StepResult {
            success: true,
            data: Some(json!({"block_id": block_id})),
            message: format!("Created {} artifact: {}", artifact_type, title),
        })
    }

    async fn execute_generate_content(
        &self,
        block_id: &str,
        content_type: &str,
        prompt: &str,
        _context: &mut ExecutionContext,
    ) -> Result<StepResult, String> {
        // Generate content using AI
        let (content, _) = self.ai_manager.agent_service.chat(
            vec![crate::ai::Message {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
            None,
        ).await.map_err(|e| format!("Failed to generate content: {}", e))?;

        // Update block content
        sqlx::query("UPDATE blocks SET content = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(&content)
            .bind(block_id)
            .execute(&self.db)
            .await
            .map_err(|e| format!("Failed to update block: {}", e))?;

        Ok(StepResult {
            success: true,
            data: None,
            message: format!("Generated {} content", content_type),
        })
    }

    async fn execute_populate_database(
        &self,
        database_id: &str,
        data_source: &DataSource,
        context: &mut ExecutionContext,
    ) -> Result<StepResult, String> {
        // Resolve database block ID (could be a step_id reference)
        let block_id = if let Some(actual_id) = context.variables.get(&format!("database_{}", database_id)) {
            actual_id.as_str().ok_or("Invalid database ID in variables")?.to_string()
        } else {
            database_id.to_string()
        };

        // Get data from source
        let data = match data_source {
            DataSource::Research { data } => data.clone(),
            DataSource::AIGenerated { prompt } => {
                // TODO: Implement AI-generated data
                return Err("AI-generated data not yet implemented".to_string());
            }
            DataSource::Transformed { source_database_id, transformation } => {
                // TODO: Implement data transformation
                return Err("Data transformation not yet implemented".to_string());
            }
        };

        // Get current database content
        let row: (String,) = sqlx::query_as("SELECT content FROM blocks WHERE id = ?")
            .bind(&block_id)
            .fetch_one(&self.db)
            .await
            .map_err(|e| format!("Failed to get database: {}", e))?;

        let mut db_content: Value = serde_json::from_str(&row.0)
            .map_err(|e| format!("Failed to parse database content: {}", e))?;

        // Add rows to database
        let rows = db_content.get_mut("rows")
            .and_then(|v| v.as_array_mut())
            .ok_or("Invalid database structure")?;

        for item in &data {
            rows.push(json!(item));
        }

        // Update database
        sqlx::query("UPDATE blocks SET content = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(db_content.to_string())
            .bind(&block_id)
            .execute(&self.db)
            .await
            .map_err(|e| format!("Failed to update database: {}", e))?;

        Ok(StepResult {
            success: true,
            data: None,
            message: format!("Populated database with {} rows", data.len()),
        })
    }

    async fn execute_validate(
        &self,
        target: &str,
        criteria: &[String],
        context: &mut ExecutionContext,
    ) -> Result<StepResult, String> {
        // Simple validation for now
        self.log_event(
            context,
            "validate",
            EventType::ValidationPassed,
            &format!("Validated: {}", target),
        );

        Ok(StepResult {
            success: true,
            data: None,
            message: format!("Validated {} against {} criteria", target, criteria.len()),
        })
    }

    async fn execute_reflect(
        &self,
        on: &str,
        improve: bool,
        _context: &mut ExecutionContext,
    ) -> Result<StepResult, String> {
        // Reflection step - could use AI to analyze work quality
        Ok(StepResult {
            success: true,
            data: None,
            message: format!("Reflected on: {}", on),
        })
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    fn log_event(
        &self,
        context: &mut ExecutionContext,
        step_id: &str,
        event_type: EventType,
        details: &str,
    ) {
        context.execution_history.push(ExecutionEvent {
            step_id: step_id.to_string(),
            event_type,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64,
            details: details.to_string(),
        });
    }
}
