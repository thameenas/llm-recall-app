mod claude_code;
mod cursor;
mod types;

use types::{Conversation, Message};

#[tauri::command]
fn list_conversations() -> Vec<Conversation> {
    let mut all = Vec::new();
    all.extend(claude_code::list_conversations());
    all.extend(cursor::list_conversations());
    // Sort all conversations newest first
    all.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    all
}

#[tauri::command]
fn get_messages(id: String, source: String) -> Vec<Message> {
    match source.as_str() {
        "claude-code" => claude_code::get_messages(&id),
        "cursor" => cursor::get_messages(&id),
        _ => vec![],
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![list_conversations, get_messages])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
