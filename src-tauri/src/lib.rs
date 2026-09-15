use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: r#"
                CREATE TABLE IF NOT EXISTS boards (
                    id TEXT PRIMARY KEY NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    position INTEGER NOT NULL DEFAULT 0
                );
                    
                CREATE TABLE IF NOT EXISTS fields (
                    id TEXT PRIMARY KEY NOT NULL,
                    board_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    key TEXT NOT NULL,
                    type TEXT NOT NULL,
                    options TEXT,
                    required INTEGER NOT NULL DEFAULT 0,
                    position INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
                );
                
                CREATE TABLE IF NOT EXISTS records(
                    id TEXT PRIMARY KEY NOT NULL,
                    board_id TEXT NOT NULL,
                    data TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
                );
                
                CREATE INDEX IF NOT EXISTS idx_fields_board_id ON fields(board_id);
                CREATE INDEX IF NOT EXISTS idx_records_board_id ON records(board_id);
            "#,
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
            .add_migrations("sqlite:legerok.db", migrations)
            .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}