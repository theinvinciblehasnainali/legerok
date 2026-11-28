use tauri_plugin_sql::{Migration, MigrationKind};

mod mail;

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
        Migration {
            version: 2,
            description: "add_module_states_and_app_settings",
            sql: r#"
                CREATE TABLE IF NOT EXISTS module_states (
                    id TEXT PRIMARY KEY NOT NULL,
                    enabled INTEGER NOT NULL DEFAULT 0,
                    installed_at TEXT,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY NOT NULL,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_relay_tables",
            sql: r#"
                CREATE TABLE IF NOT EXISTS relay_mailboxes (
                    id TEXT PRIMARY KEY NOT NULL,
                    name TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    email TEXT NOT NULL,
                    smtp_host TEXT NOT NULL,
                    smtp_port INTEGER NOT NULL,
                    smtp_security TEXT NOT NULL DEFAULT 'tls',
                    imap_host TEXT NOT NULL,
                    imap_port INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    password TEXT NOT NULL,
                    daily_limit INTEGER NOT NULL DEFAULT 50,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS relay_campaigns (
                    id TEXT PRIMARY KEY NOT NULL,
                    name TEXT NOT NULL,
                    board_id TEXT NOT NULL,
                    mailbox_id TEXT NOT NULL,
                    mode TEXT NOT NULL DEFAULT 'hitl',
                    status TEXT NOT NULL DEFAULT 'draft',
                    email_field_key TEXT NOT NULL,
                    status_field_key TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
                    FOREIGN KEY (mailbox_id) REFERENCES relay_mailboxes(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS relay_sequence_steps (
                    id TEXT PRIMARY KEY NOT NULL,
                    campaign_id TEXT NOT NULL,
                    step_order INTEGER NOT NULL DEFAULT 0,
                    delay_days INTEGER NOT NULL DEFAULT 0,
                    subject_template TEXT NOT NULL,
                    body_template TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (campaign_id) REFERENCES relay_campaigns(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS relay_email_queue (
                    id TEXT PRIMARY KEY NOT NULL,
                    campaign_id TEXT NOT NULL,
                    record_id TEXT NOT NULL,
                    mailbox_id TEXT NOT NULL,
                    step_id TEXT,
                    to_email TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    body TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending_approval',
                    scheduled_at TEXT,
                    sent_at TEXT,
                    error_message TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (campaign_id) REFERENCES relay_campaigns(id) ON DELETE CASCADE,
                    FOREIGN KEY (mailbox_id) REFERENCES relay_mailboxes(id) ON DELETE CASCADE
                );
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_relay_inbox_messages",
            sql: r#"
                CREATE TABLE IF NOT EXISTS relay_inbox_messages (
                    id TEXT PRIMARY KEY NOT NULL,
                    mailbox_id TEXT NOT NULL,
                    uid INTEGER NOT NULL,
                    subject TEXT NOT NULL,
                    from_addr TEXT NOT NULL,
                    date_str TEXT NOT NULL,
                    snippet TEXT NOT NULL DEFAULT '',
                    body_text TEXT NOT NULL DEFAULT '',
                    body_html TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (mailbox_id) REFERENCES relay_mailboxes(id) ON DELETE CASCADE,
                    UNIQUE(mailbox_id, uid)
                );

                CREATE INDEX IF NOT EXISTS idx_relay_inbox_mailbox_uid
                ON relay_inbox_messages(mailbox_id, uid DESC);
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
        .invoke_handler(tauri::generate_handler![
            mail::test_mailbox_connection,
            mail::send_smtp_email,
            mail::fetch_imap_inbox,
            mail::delete_imap_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}