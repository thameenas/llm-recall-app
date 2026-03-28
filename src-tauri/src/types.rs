use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub id: String,
    pub source: String,       // "claude-code" or "cursor"
    pub title: String,
    pub preview: String,      // first ~120 chars of first user message
    pub project: String,      // project folder path
    pub created_at: u64,      // epoch milliseconds
    pub updated_at: u64,
    pub message_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: String,
    pub role: String,         // "user" or "assistant"
    pub content: String,
    pub timestamp: u64,       // epoch milliseconds
}
