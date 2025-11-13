// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod commands;

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
            generate_artifact_stream,
            generate_artifact,
            generate_database,
            generate_embedding,
            semantic_search,
            get_ai_config,
            save_ai_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
