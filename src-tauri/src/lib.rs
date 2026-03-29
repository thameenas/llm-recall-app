mod claude_code;
mod cursor;
mod types;

use pulldown_cmark::{Options, Parser, html};
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

/// Converts markdown text to HTML using pulldown-cmark.
/// Supports tables, strikethrough, task lists (GFM features).
#[tauri::command]
fn markdown_to_html(text: String) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);

    let parser = Parser::new_ext(&text, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    html_output
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![list_conversations, get_messages, markdown_to_html])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
