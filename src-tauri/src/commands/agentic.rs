use crate::agentic::*;
use crate::commands::ai::AIState;
use tauri::State;
use sqlx::SqlitePool;

/// Execute an autonomous task with AI planning and research
#[tauri::command]
pub async fn agentic_execute_task(
    task: String,
    note_id: Option<String>,
    state: State<'_, AIState>,
    db: State<'_, SqlitePool>,
) -> Result<AgenticResult, String> {
    // Get AI manager
    let ai_manager = state.get_ai_manager().await?;

    // Create executor
    let mut executor = AutonomousExecutor::new(db.inner().clone(), ai_manager);

    // Execute task
    executor.execute_task(&task, note_id).await
}

/// Plan a task without executing (for preview)
#[tauri::command]
pub async fn agentic_plan_task(
    task: String,
    state: State<'_, AIState>,
) -> Result<Vec<AgentStep>, String> {
    // Get AI manager
    let ai_manager = state.get_ai_manager().await?;

    // Create planner
    let planner = MultiStepPlanner::new(ai_manager);

    // Plan task
    planner.plan(&task).await
}

/// Research a topic and return summary
#[tauri::command]
pub async fn agentic_research(
    query: String,
    state: State<'_, AIState>,
) -> Result<ResearchResult, String> {
    // Get AI manager
    let ai_manager = state.get_ai_manager().await?;

    // Create research agent
    let agent = WebResearchAgent::new(ai_manager);

    // Research
    agent.research(&query).await
}

/// Research and extract structured data
#[tauri::command]
pub async fn agentic_research_and_extract(
    query: String,
    schema: DataSchema,
    count: usize,
    state: State<'_, AIState>,
) -> Result<Vec<std::collections::HashMap<String, serde_json::Value>>, String> {
    // Get AI manager
    let ai_manager = state.get_ai_manager().await?;

    // Create research agent
    let agent = WebResearchAgent::new(ai_manager);

    // Research and extract
    agent.research_and_extract(&query, schema, count).await
}

/// Verify data accuracy
#[tauri::command]
pub async fn agentic_verify_data(
    data: Vec<std::collections::HashMap<String, serde_json::Value>>,
    state: State<'_, AIState>,
) -> Result<ValidationResult, String> {
    // Get AI manager
    let ai_manager = state.get_ai_manager().await?;

    // Create research agent
    let agent = WebResearchAgent::new(ai_manager);

    // Verify
    agent.verify_data(&data).await
}
