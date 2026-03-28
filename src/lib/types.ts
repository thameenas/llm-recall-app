export interface Conversation {
  id: string;
  source: "claude-code" | "cursor";
  title: string;
  preview: string;
  project: string;
  created_at: number;
  updated_at: number;
  message_count: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}
