// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod commands;
mod ai;

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
            ai_health_check,
            ai_generate_embedding,
            ai_generate_embeddings_batch,
            ai_generate_artifact,
            ai_generate_database,
            ai_chat,
            ai_chat_with_tools,
            ai_rerank,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
