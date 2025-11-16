use crate::orchestration::*;
use crate::commands::ai::AIState;
use tauri::State;
use sqlx::SqlitePool;
use serde_json::json;
use std::collections::HashMap;
use uuid::Uuid;

/// Get all available workflow templates
#[tauri::command]
pub async fn get_workflow_templates() -> Result<Vec<WorkflowTemplate>, String> {
    Ok(get_builtin_templates())
}

/// Get a specific template by ID
#[tauri::command]
pub async fn get_workflow_template(template_id: String) -> Result<WorkflowTemplate, String> {
    get_template_by_id(&template_id)
        .ok_or_else(|| format!("Template not found: {}", template_id))
}

/// Orchestrate a workflow from a prompt or template
#[tauri::command]
pub async fn orchestrate_workflow(
    prompt: Option<String>,
    template_id: Option<String>,
    parameters: Option<HashMap<String, serde_json::Value>>,
    note_id: Option<String>,
    state: State<'_, AIState>,
    db: State<'_, SqlitePool>,
) -> Result<WorkflowResult, String> {
    // Determine which template to use
    let template = if let Some(tid) = template_id {
        // Use specified template
        get_template_by_id(&tid)
            .ok_or_else(|| format!("Template not found: {}", tid))?
    } else if let Some(prompt_text) = prompt.as_ref() {
        // Try to match template from prompt
        match_template(prompt_text)
            .ok_or_else(|| "No template matched, custom workflows not yet implemented".to_string())?
    } else {
        return Err("Either prompt or template_id must be provided".to_string());
    };

    // Prepare parameters
    let params = parameters.unwrap_or_else(|| {
        let mut default_params = HashMap::new();

        // Use default parameter values from template
        for param in &template.parameters {
            if let Some(default_value) = &param.default {
                default_params.insert(param.name.clone(), default_value.clone());
            }
        }

        // If we have a prompt, try to extract title from it
        if let Some(prompt_text) = prompt {
            if !default_params.contains_key("title") {
                default_params.insert("title".to_string(), json!(prompt_text));
            }
        }

        default_params
    });

    // Instantiate template with parameters
    let steps = template.instantiate(params)?;

    // Create workflow
    let workflow_id = Uuid::new_v4().to_string();
    let mut engine = OrchestrationEngine::new(
        workflow_id,
        template.name.clone(),
        steps,
        note_id,
        db.inner().clone(),
    );

    // Execute workflow
    engine.execute().await
}

/// Create a custom workflow from AI-generated plan
#[tauri::command]
pub async fn create_custom_workflow(
    prompt: String,
    note_id: Option<String>,
    state: State<'_, AIState>,
    db: State<'_, SqlitePool>,
) -> Result<WorkflowResult, String> {
    // This would use AI to plan a custom workflow
    // For now, return an error directing to use templates
    Err("Custom workflows not yet implemented. Please use a template with orchestrate_workflow.".to_string())
}

/// Cancel a running workflow
#[tauri::command]
pub async fn cancel_workflow(workflow_id: String) -> Result<(), String> {
    // TODO: Implement workflow cancellation
    // This would need a workflow registry to track running workflows
    Err("Workflow cancellation not yet implemented".to_string())
}

/// Get workflow status (for long-running workflows)
#[tauri::command]
pub async fn get_workflow_status(workflow_id: String) -> Result<WorkflowState, String> {
    // TODO: Implement workflow status tracking
    // This would need a workflow registry
    Err("Workflow status tracking not yet implemented".to_string())
}
