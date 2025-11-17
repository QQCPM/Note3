use super::types::*;
use serde_json::json;

/// Get all built-in workflow templates
pub fn get_builtin_templates() -> Vec<WorkflowTemplate> {
    vec![
        expense_tracker_template(),
        todo_list_template(),
        project_dashboard_template(),
        meeting_notes_template(),
        habit_tracker_template(),
    ]
}

/// Get template by ID
pub fn get_template_by_id(id: &str) -> Option<WorkflowTemplate> {
    get_builtin_templates().into_iter().find(|t| t.id == id)
}

/// Match prompt to template using keywords
pub fn match_template(prompt: &str) -> Option<WorkflowTemplate> {
    let prompt_lower = prompt.to_lowercase();

    for template in get_builtin_templates() {
        // Check if any tag matches
        if template.tags.iter().any(|tag| prompt_lower.contains(&tag.to_lowercase())) {
            return Some(template);
        }

        // Check if template name matches
        if prompt_lower.contains(&template.name.to_lowercase()) {
            return Some(template);
        }
    }

    None
}

// ============================================================================
// TEMPLATE: EXPENSE TRACKER
// ============================================================================

fn expense_tracker_template() -> WorkflowTemplate {
    WorkflowTemplate {
        id: "expense_tracker".to_string(),
        name: "Expense Tracker".to_string(),
        description: "Track expenses with database and visualizations".to_string(),
        tags: vec!["expense".to_string(), "money".to_string(), "budget".to_string(), "spending".to_string()],
        icon: "💰".to_string(),
        parameters: vec![
            TemplateParameter {
                name: "title".to_string(),
                param_type: ParameterType::String,
                description: "Title for the expense tracker".to_string(),
                default: Some(json!("Expense Tracker")),
                required: false,
            },
        ],
        steps: vec![
            TemplateStep {
                id: "create_note".to_string(),
                step_type: StepType::CreateNote,
                config: json!({
                    "title": "{{title}}"
                }),
                depends_on: vec![],
            },
            TemplateStep {
                id: "create_database".to_string(),
                step_type: StepType::CreateDatabase,
                config: json!({
                    "title": "Expenses",
                    "columns": [
                        {"name": "Date", "type": "date"},
                        {"name": "Category", "type": "select", "options": ["Food", "Transport", "Entertainment", "Shopping", "Bills", "Other"]},
                        {"name": "Amount", "type": "number"},
                        {"name": "Description", "type": "text"}
                    ],
                    "rows": []
                }),
                depends_on: vec!["create_note".to_string()],
            },
            TemplateStep {
                id: "create_chart".to_string(),
                step_type: StepType::CreateArtifact,
                config: json!({
                    "title": "Expense Chart",
                    "artifact_type": "pie_chart",
                    "data_source_step": "create_database",
                    "chart_config": {
                        "type": "pie",
                        "x_column": "Category",
                        "y_column": "Amount"
                    }
                }),
                depends_on: vec!["create_database".to_string()],
            },
        ],
        data_mappings: vec![
            DataMapping {
                from_step: "create_database".to_string(),
                from_field: "block_id".to_string(),
                to_step: "create_chart".to_string(),
                to_field: "data_source".to_string(),
                transform: None,
            },
        ],
    }
}

// ============================================================================
// TEMPLATE: TODO LIST
// ============================================================================

fn todo_list_template() -> WorkflowTemplate {
    WorkflowTemplate {
        id: "todo_list".to_string(),
        name: "Todo List".to_string(),
        description: "Task management with kanban board".to_string(),
        tags: vec!["todo".to_string(), "task".to_string(), "checklist".to_string()],
        icon: "✓".to_string(),
        parameters: vec![
            TemplateParameter {
                name: "title".to_string(),
                param_type: ParameterType::String,
                description: "Title for the todo list".to_string(),
                default: Some(json!("Todo List")),
                required: false,
            },
        ],
        steps: vec![
            TemplateStep {
                id: "create_note".to_string(),
                step_type: StepType::CreateNote,
                config: json!({
                    "title": "{{title}}"
                }),
                depends_on: vec![],
            },
            TemplateStep {
                id: "create_database".to_string(),
                step_type: StepType::CreateDatabase,
                config: json!({
                    "title": "Tasks",
                    "columns": [
                        {"name": "Task", "type": "text"},
                        {"name": "Status", "type": "select", "options": ["Todo", "In Progress", "Done"]},
                        {"name": "Priority", "type": "select", "options": ["Low", "Medium", "High"]},
                        {"name": "Due Date", "type": "date"}
                    ],
                    "rows": []
                }),
                depends_on: vec!["create_note".to_string()],
            },
            TemplateStep {
                id: "create_kanban".to_string(),
                step_type: StepType::CreateArtifact,
                config: json!({
                    "title": "Kanban Board",
                    "artifact_type": "kanban",
                    "data_source_step": "create_database"
                }),
                depends_on: vec!["create_database".to_string()],
            },
        ],
        data_mappings: vec![
            DataMapping {
                from_step: "create_database".to_string(),
                from_field: "block_id".to_string(),
                to_step: "create_kanban".to_string(),
                to_field: "data_source".to_string(),
                transform: None,
            },
        ],
    }
}

// ============================================================================
// TEMPLATE: PROJECT DASHBOARD
// ============================================================================

fn project_dashboard_template() -> WorkflowTemplate {
    WorkflowTemplate {
        id: "project_dashboard".to_string(),
        name: "Project Dashboard".to_string(),
        description: "Project management with tasks and timeline".to_string(),
        tags: vec!["project".to_string(), "dashboard".to_string(), "planning".to_string()],
        icon: "📊".to_string(),
        parameters: vec![
            TemplateParameter {
                name: "title".to_string(),
                param_type: ParameterType::String,
                description: "Project name".to_string(),
                default: Some(json!("Project Dashboard")),
                required: false,
            },
        ],
        steps: vec![
            TemplateStep {
                id: "create_note".to_string(),
                step_type: StepType::CreateNote,
                config: json!({
                    "title": "{{title}}"
                }),
                depends_on: vec![],
            },
            TemplateStep {
                id: "create_tasks_db".to_string(),
                step_type: StepType::CreateDatabase,
                config: json!({
                    "title": "Tasks",
                    "columns": [
                        {"name": "Task", "type": "text"},
                        {"name": "Status", "type": "select", "options": ["Not Started", "In Progress", "Completed"]},
                        {"name": "Start Date", "type": "date"},
                        {"name": "End Date", "type": "date"},
                        {"name": "Assignee", "type": "text"}
                    ],
                    "rows": []
                }),
                depends_on: vec!["create_note".to_string()],
            },
            TemplateStep {
                id: "create_milestones_db".to_string(),
                step_type: StepType::CreateDatabase,
                config: json!({
                    "title": "Milestones",
                    "columns": [
                        {"name": "Milestone", "type": "text"},
                        {"name": "Target Date", "type": "date"},
                        {"name": "Status", "type": "select", "options": ["Pending", "Achieved"]}
                    ],
                    "rows": []
                }),
                depends_on: vec!["create_note".to_string()],
            },
            TemplateStep {
                id: "create_timeline".to_string(),
                step_type: StepType::CreateArtifact,
                config: json!({
                    "title": "Project Timeline",
                    "artifact_type": "gantt",
                    "data_source_step": "create_tasks_db"
                }),
                depends_on: vec!["create_tasks_db".to_string()],
            },
        ],
        data_mappings: vec![
            DataMapping {
                from_step: "create_tasks_db".to_string(),
                from_field: "block_id".to_string(),
                to_step: "create_timeline".to_string(),
                to_field: "data_source".to_string(),
                transform: None,
            },
        ],
    }
}

// ============================================================================
// TEMPLATE: MEETING NOTES
// ============================================================================

fn meeting_notes_template() -> WorkflowTemplate {
    WorkflowTemplate {
        id: "meeting_notes".to_string(),
        name: "Meeting Notes".to_string(),
        description: "Meeting notes with action items and attendees".to_string(),
        tags: vec!["meeting".to_string(), "notes".to_string(), "agenda".to_string()],
        icon: "📝".to_string(),
        parameters: vec![
            TemplateParameter {
                name: "meeting_title".to_string(),
                param_type: ParameterType::String,
                description: "Meeting title".to_string(),
                default: Some(json!("Meeting Notes")),
                required: false,
            },
        ],
        steps: vec![
            TemplateStep {
                id: "create_note".to_string(),
                step_type: StepType::CreateNote,
                config: json!({
                    "title": "{{meeting_title}}"
                }),
                depends_on: vec![],
            },
            TemplateStep {
                id: "create_action_items".to_string(),
                step_type: StepType::CreateDatabase,
                config: json!({
                    "title": "Action Items",
                    "columns": [
                        {"name": "Action", "type": "text"},
                        {"name": "Owner", "type": "text"},
                        {"name": "Due Date", "type": "date"},
                        {"name": "Status", "type": "select", "options": ["Pending", "In Progress", "Done"]}
                    ],
                    "rows": []
                }),
                depends_on: vec!["create_note".to_string()],
            },
            TemplateStep {
                id: "create_attendees".to_string(),
                step_type: StepType::CreateDatabase,
                config: json!({
                    "title": "Attendees",
                    "columns": [
                        {"name": "Name", "type": "text"},
                        {"name": "Role", "type": "text"},
                        {"name": "Present", "type": "checkbox"}
                    ],
                    "rows": []
                }),
                depends_on: vec!["create_note".to_string()],
            },
        ],
        data_mappings: vec![],
    }
}

// ============================================================================
// TEMPLATE: HABIT TRACKER
// ============================================================================

fn habit_tracker_template() -> WorkflowTemplate {
    WorkflowTemplate {
        id: "habit_tracker".to_string(),
        name: "Habit Tracker".to_string(),
        description: "Track daily habits and visualize progress".to_string(),
        tags: vec!["habit".to_string(), "routine".to_string(), "tracking".to_string()],
        icon: "📅".to_string(),
        parameters: vec![
            TemplateParameter {
                name: "title".to_string(),
                param_type: ParameterType::String,
                description: "Tracker title".to_string(),
                default: Some(json!("Habit Tracker")),
                required: false,
            },
        ],
        steps: vec![
            TemplateStep {
                id: "create_note".to_string(),
                step_type: StepType::CreateNote,
                config: json!({
                    "title": "{{title}}"
                }),
                depends_on: vec![],
            },
            TemplateStep {
                id: "create_database".to_string(),
                step_type: StepType::CreateDatabase,
                config: json!({
                    "title": "Daily Habits",
                    "columns": [
                        {"name": "Date", "type": "date"},
                        {"name": "Exercise", "type": "checkbox"},
                        {"name": "Reading", "type": "checkbox"},
                        {"name": "Meditation", "type": "checkbox"},
                        {"name": "Water (glasses)", "type": "number"},
                        {"name": "Notes", "type": "text"}
                    ],
                    "rows": []
                }),
                depends_on: vec!["create_note".to_string()],
            },
            TemplateStep {
                id: "create_chart".to_string(),
                step_type: StepType::CreateArtifact,
                config: json!({
                    "title": "Progress Chart",
                    "artifact_type": "line_chart",
                    "data_source_step": "create_database"
                }),
                depends_on: vec!["create_database".to_string()],
            },
        ],
        data_mappings: vec![
            DataMapping {
                from_step: "create_database".to_string(),
                from_field: "block_id".to_string(),
                to_step: "create_chart".to_string(),
                to_field: "data_source".to_string(),
                transform: None,
            },
        ],
    }
}
