use crate::types::{Conversation, Message};
use rusqlite::{Connection, OpenFlags};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// Path to Cursor's global state database.
fn global_db_path() -> PathBuf {
    dirs::home_dir()
        .unwrap()
        .join("Library/Application Support/Cursor/User/globalStorage/state.vscdb")
}

/// Path to Cursor's workspace storage directory.
fn workspace_storage_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap()
        .join("Library/Application Support/Cursor/User/workspaceStorage")
}

/// Metadata about a composer extracted from workspace state.vscdb
struct ComposerMeta {
    project: String,
    created_at: u64,
    updated_at: u64,
}

/// Builds a map of composerId -> metadata (project, timestamps)
/// by scanning all workspace state.vscdb files.
fn build_composer_metadata_map() -> HashMap<String, ComposerMeta> {
    let mut map: HashMap<String, ComposerMeta> = HashMap::new();
    let ws_dir = workspace_storage_dir();

    let entries = match fs::read_dir(&ws_dir) {
        Ok(e) => e,
        Err(_) => return map,
    };

    for entry in entries.flatten() {
        let ws_path = entry.path();
        let workspace_json = ws_path.join("workspace.json");
        let state_db = ws_path.join("state.vscdb");

        // Read the project folder from workspace.json
        let folder = match read_workspace_folder(&workspace_json) {
            Some(f) => f,
            None => continue,
        };

        // Open the workspace's state.vscdb to get composer data
        let db = match Connection::open_with_flags(
            &state_db,
            OpenFlags::SQLITE_OPEN_READ_ONLY,
        ) {
            Ok(db) => db,
            Err(_) => continue,
        };

        let composer_data: String = match db.query_row(
            "SELECT value FROM ItemTable WHERE key = 'composer.composerData'",
            [],
            |row| row.get(0),
        ) {
            Ok(data) => data,
            Err(_) => continue,
        };

        // Parse composer data to get IDs and timestamps
        if let Ok(parsed) = serde_json::from_str::<Value>(&composer_data) {
            if let Some(composers) = parsed["allComposers"].as_array() {
                for composer in composers {
                    if let Some(id) = composer["composerId"].as_str() {
                        let created_at = composer["createdAt"].as_u64().unwrap_or(0);
                        let updated_at = composer["lastUpdatedAt"]
                            .as_u64()
                            .unwrap_or(created_at);

                        map.insert(id.to_string(), ComposerMeta {
                            project: folder.clone(),
                            created_at,
                            updated_at,
                        });
                    }
                }
            }
        }
    }

    map
}

/// Reads the folder path from a workspace.json file.
fn read_workspace_folder(path: &PathBuf) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    let parsed: Value = serde_json::from_str(&content).ok()?;
    let folder_uri = parsed["folder"].as_str()?;
    // Convert "file:///Users/riza/project" -> "/Users/riza/project"
    let decoded = folder_uri
        .strip_prefix("file://")
        .unwrap_or(folder_uri);
    // URL-decode %20 etc.
    Some(url_decode(decoded))
}

/// Simple URL decoder for common cases (%20 -> space, etc.)
fn url_decode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                result.push(byte as char);
            }
        } else {
            result.push(c);
        }
    }
    result
}

/// Lists all Cursor conversations by reading the global state database.
pub fn list_conversations() -> Vec<Conversation> {
    let db_path = global_db_path();
    let db = match Connection::open_with_flags(
        &db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY,
    ) {
        Ok(db) => db,
        Err(_) => return vec![],
    };

    // Build composer -> metadata mapping from workspace databases
    let metadata_map = build_composer_metadata_map();

    // Get all bubble keys to group by composerId
    let mut stmt = match db.prepare(
        "SELECT key FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    // Count messages per composer and find the first user message
    let mut composer_bubbles: HashMap<String, Vec<String>> = HashMap::new();
    let rows = stmt.query_map([], |row| {
        let key: String = row.get(0)?;
        Ok(key)
    });

    if let Ok(rows) = rows {
        for row in rows.flatten() {
            // key format: "bubbleId:{composerId}:{messageId}"
            let parts: Vec<&str> = row.splitn(3, ':').collect();
            if parts.len() == 3 {
                composer_bubbles
                    .entry(parts[1].to_string())
                    .or_default()
                    .push(parts[2].to_string());
            }
        }
    }

    let mut conversations: Vec<Conversation> = Vec::new();

    for (composer_id, bubble_ids) in &composer_bubbles {
        // Get the first user message as preview
        let preview = get_first_user_message(&db, composer_id, bubble_ids);

        let meta = metadata_map.get(composer_id);

        let project = meta
            .map(|m| m.project.clone())
            .unwrap_or_else(|| "Unknown project".to_string());

        let project_name = project
            .rsplit('/')
            .next()
            .unwrap_or(&project)
            .to_string();

        let created_at = meta.map(|m| m.created_at).unwrap_or(0);
        let updated_at = meta.map(|m| m.updated_at).unwrap_or(created_at);

        conversations.push(Conversation {
            id: composer_id.clone(),
            source: "cursor".to_string(),
            title: format!("{} — {}", project_name, truncate(&preview, 60)),
            preview: truncate(&preview, 120).to_string(),
            project,
            created_at,
            updated_at,
            message_count: bubble_ids.len(),
        });
    }

    conversations.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    conversations
}

/// Gets the first user message text for a conversation.
fn get_first_user_message(db: &Connection, composer_id: &str, bubble_ids: &[String]) -> String {
    for bubble_id in bubble_ids {
        let key = format!("bubbleId:{}:{}", composer_id, bubble_id);
        let value: Option<String> = db
            .query_row(
                "SELECT value FROM cursorDiskKV WHERE key = ?1",
                [&key],
                |row| row.get(0),
            )
            .ok();

        if let Some(json_str) = value {
            if let Ok(parsed) = serde_json::from_str::<Value>(&json_str) {
                // type 1 = user message
                if parsed["type"].as_u64() == Some(1) {
                    if let Some(text) = parsed["text"].as_str() {
                        if !text.is_empty() {
                            return text.to_string();
                        }
                    }
                    // Also check rawText field
                    if let Some(text) = parsed["rawText"].as_str() {
                        if !text.is_empty() {
                            return text.to_string();
                        }
                    }
                }
            }
        }
    }
    "(no preview)".to_string()
}

/// Gets all messages for a specific conversation.
pub fn get_messages(composer_id: &str) -> Vec<Message> {
    let db_path = global_db_path();
    let db = match Connection::open_with_flags(
        &db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY,
    ) {
        Ok(db) => db,
        Err(_) => return vec![],
    };

    let pattern = format!("bubbleId:{}:%", composer_id);
    let mut stmt = match db.prepare(
        "SELECT key, value FROM cursorDiskKV WHERE key LIKE ?1"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let mut messages: Vec<Message> = Vec::new();

    let rows = stmt.query_map([&pattern], |row| {
        let key: String = row.get(0)?;
        let value: Option<String> = row.get(1)?;
        Ok((key, value))
    });

    if let Ok(rows) = rows {
        for row in rows.flatten() {
            let (_key, value) = row;
            let json_str = match value {
                Some(v) => v,
                None => continue, // skip NULL entries
            };

            let parsed: Value = match serde_json::from_str(&json_str) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let msg_type = parsed["type"].as_u64().unwrap_or(0);
            let role = match msg_type {
                1 => "user",
                2 => "assistant",
                _ => continue,
            };

            let text = parsed["text"]
                .as_str()
                .or_else(|| parsed["rawText"].as_str())
                .unwrap_or("")
                .to_string();

            if text.is_empty() {
                continue;
            }

            let bubble_id = parsed["bubbleId"]
                .as_str()
                .unwrap_or("")
                .to_string();

            let timestamp = parsed["timestamp"].as_u64().unwrap_or(0);

            messages.push(Message {
                id: bubble_id,
                role: role.to_string(),
                content: text,
                timestamp,
            });
        }
    }

    messages
}

fn truncate(s: &str, max_len: usize) -> &str {
    if s.len() <= max_len {
        s
    } else {
        &s[..max_len]
    }
}
