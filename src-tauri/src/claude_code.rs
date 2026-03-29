use crate::types::{Conversation, Message};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// Returns the path to the Claude Code data directory: ~/.claude
fn claude_home() -> PathBuf {
    dirs::home_dir().unwrap().join(".claude")
}

/// Reads ~/.claude/history.jsonl and groups entries by sessionId
/// to build a list of conversations.
pub fn list_conversations() -> Vec<Conversation> {
    let history_path = claude_home().join("history.jsonl");
    let content = match fs::read_to_string(&history_path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    // Group history entries by sessionId
    let mut sessions: HashMap<String, Vec<Value>> = HashMap::new();
    for line in content.lines() {
        if let Ok(entry) = serde_json::from_str::<Value>(line) {
            if let Some(session_id) = entry["sessionId"].as_str() {
                sessions
                    .entry(session_id.to_string())
                    .or_default()
                    .push(entry);
            }
        }
    }

    let mut conversations: Vec<Conversation> = Vec::new();

    for (session_id, entries) in &sessions {
        // Find the first entry that has actual user text (not a slash command)
        let first_display = entries
            .iter()
            .map(|e| e["display"].as_str().unwrap_or(""))
            .find(|d| !d.is_empty() && !d.starts_with('/'))
            .unwrap_or("(no preview)");

        let project = entries[0]["project"]
            .as_str()
            .unwrap_or("Unknown");

        let timestamps: Vec<u64> = entries
            .iter()
            .filter_map(|e| e["timestamp"].as_u64())
            .collect();

        let min_ts = timestamps.iter().copied().min().unwrap_or(0);
        let max_ts = timestamps.iter().copied().max().unwrap_or(0);

        conversations.push(Conversation {
            id: session_id.clone(),
            source: "claude-code".to_string(),
            title: truncate(first_display, 120).to_string(),
            preview: truncate(first_display, 120).to_string(),
            project: project.to_string(),
            created_at: min_ts,
            updated_at: max_ts,
            message_count: entries.len(),
        });
    }

    // Sort newest first
    conversations.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    conversations
}

/// Reads the session JSONL file to get the full message thread.
/// Searches across all project folders for the matching sessionId.
pub fn get_messages(session_id: &str) -> Vec<Message> {
    let projects_dir = claude_home().join("projects");
    let entries = match fs::read_dir(&projects_dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    // Search every project folder for a file named {session_id}.jsonl
    for entry in entries.flatten() {
        let session_file = entry.path().join(format!("{}.jsonl", session_id));
        if session_file.exists() {
            return parse_session_file(&session_file);
        }
    }

    vec![]
}

/// Parses a single session JSONL file into a list of Messages.
fn parse_session_file(path: &PathBuf) -> Vec<Message> {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let mut messages: Vec<Message> = Vec::new();

    for line in content.lines() {
        let entry: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let msg_type = match entry["type"].as_str() {
            Some(t) => t,
            None => continue,
        };

        // Only keep user and assistant messages
        if msg_type != "user" && msg_type != "assistant" {
            continue;
        }

        let role = entry["message"]["role"]
            .as_str()
            .unwrap_or(msg_type)
            .to_string();

        let content = extract_content(&entry["message"]["content"]);
        if content.is_empty() {
            continue;
        }

        let timestamp = parse_timestamp(&entry["timestamp"]);

        let uuid = entry["uuid"]
            .as_str()
            .unwrap_or("")
            .to_string();

        messages.push(Message {
            id: uuid,
            role,
            content,
            timestamp,
        });
    }

    messages
}

/// Extracts displayable text from a message's content field.
/// Content can be either a plain string or an array of content blocks.
fn extract_content(content: &Value) -> String {
    match content {
        // Simple string content
        Value::String(s) => s.clone(),
        // Array of content blocks — extract text blocks only
        Value::Array(blocks) => {
            blocks
                .iter()
                .filter_map(|block| {
                    if block["type"].as_str() == Some("text") {
                        block["text"].as_str().map(|s| s.to_string())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("\n\n")
        }
        _ => String::new(),
    }
}

/// Parses a timestamp that could be either an epoch number or an ISO string.
fn parse_timestamp(value: &Value) -> u64 {
    match value {
        Value::Number(n) => n.as_u64().unwrap_or(0),
        Value::String(s) => {
            // Parse ISO 8601 string like "2026-03-21T09:37:56.451Z"
            // Simple approach: try to extract epoch from the string
            chrono_parse_iso(s).unwrap_or(0)
        }
        _ => 0,
    }
}

/// Minimal ISO 8601 parser — returns epoch milliseconds.
fn chrono_parse_iso(s: &str) -> Option<u64> {
    // Format: "2026-03-21T09:37:56.451Z"
    let s = s.trim_end_matches('Z');
    let (date_part, time_part) = s.split_once('T')?;
    let date_parts: Vec<&str> = date_part.split('-').collect();
    let time_parts: Vec<&str> = time_part.split(':').collect();

    if date_parts.len() != 3 || time_parts.len() != 3 {
        return None;
    }

    let year: i64 = date_parts[0].parse().ok()?;
    let month: i64 = date_parts[1].parse().ok()?;
    let day: i64 = date_parts[2].parse().ok()?;

    let sec_parts: Vec<&str> = time_parts[2].split('.').collect();
    let hour: i64 = time_parts[0].parse().ok()?;
    let min: i64 = time_parts[1].parse().ok()?;
    let sec: i64 = sec_parts[0].parse().ok()?;
    let millis: i64 = if sec_parts.len() > 1 {
        sec_parts[1].parse().unwrap_or(0)
    } else {
        0
    };

    // Simple epoch calculation (not accounting for leap seconds, but close enough)
    let days = days_from_civil(year, month, day);
    let epoch_secs = days * 86400 + hour * 3600 + min * 60 + sec;
    Some((epoch_secs * 1000 + millis) as u64)
}

/// Converts a civil date to days since Unix epoch.
fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let y = if month <= 2 { year - 1 } else { year };
    let m = if month <= 2 { month + 9 } else { month - 3 };
    let era = y / 400;
    let yoe = y - era * 400;
    let doy = (153 * m + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
}

fn truncate(s: &str, max_len: usize) -> &str {
    if s.len() <= max_len {
        s
    } else {
        &s[..max_len]
    }
}
