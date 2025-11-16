// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod commands;
mod ai;
mod orchestration;
mod agentic;

use db::initialize_database;
use commands::*;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize database
            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                match initialize_database(&app_handle).await {
                    Ok(pool) => {
                        app_handle.manage(pool);
                        println!("Database setup complete");
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize database: {}", e);
                        std::process::exit(1);
                    }
                }
            });

            // Initialize AI state
            app.manage(commands::ai::AIState::new());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Note commands
            get_all_notes,
            get_note_by_id,
            create_note,
            update_note,
            delete_note,
            get_child_notes,
            // Block commands
            get_blocks_by_note,
            create_block,
            update_block,
            delete_block,
            // AI commands
            ai_initialize,
            ai_get_config,
            ai_load_persisted_config,
            ai_save_config,
            ai_update_and_save_config,
            ai_health_check,
            ai_generate_embedding,
            ai_generate_embeddings_batch,
            ai_generate_artifact,
            ai_generate_database,
            ai_chat,
            ai_chat_with_tools,
            ai_rerank,
            ai_store_note_embedding,
            ai_search_notes,
            ai_read_block,
            ai_get_note_context,
            ai_chat_with_note_context,
            // Advanced AI tools (Phase 1 & 2)
            ai_get_tools,
            ai_get_database_tools,
            ai_get_artifact_tools,
            ai_execute_database_tool,
            ai_execute_artifact_tool,
            ai_chat_with_auto_tools,
            // Orchestration (Phase 3)
            get_workflow_templates,
            get_workflow_template,
            orchestrate_workflow,
            create_custom_workflow,
            cancel_workflow,
            get_workflow_status,
            // Agentic AI (Phase 4)
            agentic_execute_task,
            agentic_plan_task,
            agentic_research,
            agentic_research_and_extract,
            agentic_verify_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
