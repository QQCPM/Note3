use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Get the base path for memory files (app data directory)
#[tauri::command]
pub async fn get_memory_base_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    
    let memory_dir = app_dir.join("memory");
    
    // Create directory if it doesn't exist
    if !memory_dir.exists() {
        fs::create_dir_all(&memory_dir).map_err(|e| e.to_string())?;
    }
    
    Ok(memory_dir.to_string_lossy().to_string())
}

/// Get the path for a specific project
#[tauri::command]
pub async fn get_project_path(project_id: String) -> Result<String, String> {
    // For now, return a project-specific subdirectory
    // In a real implementation, this would look up the project's actual path
    // from the database or project configuration
    
    // This is a placeholder - the actual implementation would query the projects table
    // For now we'll use a convention-based path
    Err("Project path lookup not implemented - use project's actual directory".to_string())
}

/// Read a memory file from disk
#[tauri::command]
pub async fn read_memory_file(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);
    
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }
    
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file {}: {}", path, e))
}

/// Write content to a memory file
#[tauri::command]
pub async fn write_memory_file(path: String, content: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    
    // Create parent directories if they don't exist
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }
    
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write file {}: {}", path, e))
}

/// Check if a memory file exists
#[tauri::command]
pub async fn memory_file_exists(path: String) -> Result<bool, String> {
    let file_path = PathBuf::from(&path);
    Ok(file_path.exists())
}

/// Delete a memory file
#[tauri::command]
pub async fn delete_memory_file(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    
    if !file_path.exists() {
        return Ok(()); // Already doesn't exist
    }
    
    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete file {}: {}", path, e))
}

/// List all memory files in a directory
#[tauri::command]
pub async fn list_memory_files(directory: String) -> Result<Vec<String>, String> {
    let dir_path = PathBuf::from(&directory);
    
    if !dir_path.exists() {
        return Ok(vec![]);
    }
    
    let entries = fs::read_dir(&dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    let mut files = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "md" {
                        files.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    
    Ok(files)
}
