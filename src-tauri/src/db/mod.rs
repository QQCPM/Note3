use sqlx::{sqlite::SqlitePool, migrate::MigrateDatabase, Sqlite};
use tauri::Manager;

pub async fn initialize_database(app_handle: &tauri::AppHandle) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    // Get app data directory
    let app_dir = app_handle.path().app_data_dir()?;
    std::fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("weave.db");
    let db_url = format!("sqlite:{}", db_path.display());

    // Create database if it doesn't exist
    if !Sqlite::database_exists(&db_url).await.unwrap_or(false) {
        println!("Creating database at: {}", db_url);
        Sqlite::create_database(&db_url).await?;
    }

    // Connect to database
    let pool = SqlitePool::connect(&db_url).await?;

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await?;

    println!("Database initialized successfully");

    Ok(pool)
}

// Database models
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Note {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub icon: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
    pub is_deleted: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CreateNoteInput {
    pub parent_id: Option<String>,
    pub title: String,
    pub icon: Option<String>,
    pub position: Option<i64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UpdateNoteInput {
    pub title: Option<String>,
    pub icon: Option<String>,
    pub position: Option<i64>,
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Block {
    pub id: String,
    pub note_id: String,
    #[sqlx(rename = "type")]
    pub block_type: String,
    pub position: i64,
    pub data: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CreateBlockInput {
    pub note_id: String,
    #[serde(rename = "type")]
    pub block_type: String,
    pub data: String,
    pub position: Option<i64>,
}
