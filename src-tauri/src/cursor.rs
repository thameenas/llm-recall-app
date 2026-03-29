use crate::types::{Conversation, Message};
use rusqlite::{Connection, OpenFlags};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
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

/// Metadata about a composer.
struct ComposerMeta {
    project: String,
    created_at: u64,
    updated_at: u64,
}

/// Reads composer metadata and subagent IDs from both data sources:
/// 1. Per-workspace state.vscdb (older Cursor versions)
/// 2. Global cursorDiskKV composerData:{id} keys (newer Cursor versions)
///
/// Returns (metadata_map, subagent_ids)
fn build_composer_metadata(
    global_db: &Connection,
) -> (HashMap<String, ComposerMeta>, HashSet<String>) {
    let mut map: HashMap<String, ComposerMeta> = HashMap::new();
    let mut subagent_ids: HashSet<String> = HashSet::new();

    // Source 1: per-workspace state.vscdb files
    let ws_dir = workspace_storage_dir();
    if let Ok(entries) = fs::read_dir(&ws_dir) {
        for entry in entries.flatten() {
            let ws_path = entry.path();
            let workspace_json = ws_path.join("workspace.json");
            let state_db = ws_path.join("state.vscdb");

            let folder = match read_workspace_folder(&workspace_json) {
                Some(f) => f,
                None => continue,
            };

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

            if let Ok(parsed) = serde_json::from_str::<Value>(&composer_data) {
                if let Some(composers) = parsed["allComposers"].as_array() {
                    for composer in composers {
                        if let Some(id) = composer["composerId"].as_str() {
                            let created_at = composer["createdAt"].as_u64().unwrap_or(0);
                            let updated_at = composer["lastUpdatedAt"]
                                .as_u64()
                                .unwrap_or(created_at);

                            map.insert(
                                id.to_string(),
                                ComposerMeta {
                                    project: folder.clone(),
                                    created_at,
                                    updated_at,
                                },
                            );
                        }
                    }
                }
            }
        }
    }

    // Source 2: global cursorDiskKV composerData:{id} keys (newer Cursor)
    if let Ok(mut stmt) = global_db.prepare(
        "SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'",
    ) {
        let rows = stmt.query_map([], |row| {
            let key: String = row.get(0)?;
            let value: Option<String> = row.get(1)?;
            Ok((key, value))
        });

        if let Ok(rows) = rows {
            for row in rows.flatten() {
                let (key, value) = row;
                let json_str = match value {
                    Some(v) => v,
                    None => continue,
                };

                let parsed: Value = match serde_json::from_str(&json_str) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let composer_id = key
                    .strip_prefix("composerData:")
                    .unwrap_or("")
                    .to_string();

                if composer_id.is_empty() {
                    continue;
                }

                // Collect subagent IDs to filter them out later
                if let Some(subs) = parsed["subagentComposerIds"].as_array() {
                    for sub in subs {
                        if let Some(sid) = sub.as_str() {
                            subagent_ids.insert(sid.to_string());
                        }
                    }
                }

                // Only insert if not already present from workspace scan
                if !map.contains_key(&composer_id) {
                    let created_at = parsed["createdAt"].as_u64().unwrap_or(0);
                    let updated_at = parsed["lastUpdatedAt"]
                        .as_u64()
                        .unwrap_or(created_at);

                    // Try to extract project from attached file URIs
                    let project = extract_project_from_uris(&parsed)
                        .unwrap_or_else(|| "Unknown project".to_string());

                    map.insert(
                        composer_id,
                        ComposerMeta {
                            project,
                            created_at,
                            updated_at,
                        },
                    );
                }
            }
        }
    }

    (map, subagent_ids)
}

/// Tries to extract a project path from allAttachedFileCodeChunksUris in composerData.
fn extract_project_from_uris(composer: &Value) -> Option<String> {
    let uris = composer["allAttachedFileCodeChunksUris"].as_array()?;
    if uris.is_empty() {
        return None;
    }

    // Find the common prefix of all file URIs
    let paths: Vec<String> = uris
        .iter()
        .filter_map(|u| u.as_str())
        .map(|u| {
            let decoded = u.strip_prefix("file://").unwrap_or(u);
            url_decode(decoded)
        })
        .collect();

    if paths.is_empty() {
        return None;
    }

    // Find common directory prefix
    let first = &paths[0];
    let mut common_end = first.len();
    for path in &paths[1..] {
        let shared = first
            .chars()
            .zip(path.chars())
            .take_while(|(a, b)| a == b)
            .count();
        if shared < common_end {
            common_end = shared;
        }
    }

    let common = &first[..common_end];
    // Trim to last directory separator
    let trimmed = common.rfind('/').map(|i| &common[..i]).unwrap_or(common);
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

/// Reads the folder path from a workspace.json file.
fn read_workspace_folder(path: &PathBuf) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    let parsed: Value = serde_json::from_str(&content).ok()?;
    let folder_uri = parsed["folder"].as_str()?;
    let decoded = folder_uri.strip_prefix("file://").unwrap_or(folder_uri);
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

    // Build metadata and subagent ID set
    let (metadata_map, subagent_ids) = build_composer_metadata(&db);

    // Get all bubble keys grouped by composerId
    let mut stmt = match db.prepare(
        "SELECT key FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'",
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let mut composer_bubbles: HashMap<String, Vec<String>> = HashMap::new();
    let rows = stmt.query_map([], |row| {
        let key: String = row.get(0)?;
        Ok(key)
    });

    if let Ok(rows) = rows {
        for row in rows.flatten() {
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
        // Skip subagent composers — they're part of a parent conversation
        if subagent_ids.contains(composer_id) {
            continue;
        }

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
                if parsed["type"].as_u64() == Some(1) {
                    if let Some(text) = parsed["text"].as_str() {
                        if !text.is_empty() {
                            return text.to_string();
                        }
                    }
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
        "SELECT key, value FROM cursorDiskKV WHERE key LIKE ?1",
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
                None => continue,
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
