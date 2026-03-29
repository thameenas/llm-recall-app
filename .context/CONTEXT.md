# Project Context

## Overview
Recall is a desktop application built with Tauri, Rust, and React/TypeScript that unifies and enables browsing and searching of AI chat history from multiple sources, specifically Claude Code and Cursor. The application operates locally, reading chat history directly from disk in a read-only fashion, without requiring accounts, cloud services, or complex configurations, prioritizing user privacy and data ownership.

## Architecture
Recall employs a client-server architecture characteristic of Tauri applications, where a Rust backend serves a React/TypeScript frontend rendered within a webview.
- **Rust Backend (`src-tauri/`):** Responsible for native interactions, including locating user data directories, reading proprietary chat history files (JSONL for Claude Code, SQLite for Cursor), parsing these into a unified data model, and exposing this data to the frontend via Tauri commands.
- **React Frontend (`src/`):** Provides the user interface, displays conversation lists, message threads, search functionality, and filtering options. It interacts with the Rust backend to fetch data and performs client-side search and rendering.
- **Tauri Bridge:** Facilitates communication between the webview (React) and the native Rust backend, exposing Rust functions as callable commands to the JavaScript context.
- **Data Flow:** Raw chat history files are read by Rust, parsed and structured into a common format, serialized to JSON, and sent to the React frontend. The frontend then indexes this data using `minisearch` for efficient client-side querying and renders it.

## Core Workflows
1.  **Application Initialization & Data Ingestion:**
    *   On startup, the Rust backend invokes OS-specific directory lookups (using `dirs`) to locate Claude Code (`~/.claude/history.jsonl`, `~/.claude/projects/`) and Cursor (`~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`) chat history files.
    *   Dedicated Rust modules (`claude_code.rs`, `cursor.rs`) parse these varied file formats (JSONL, SQLite) into a unified Rust data model (`types.rs`).
    *   The complete, unified conversation data, including messages, is then serialized to JSON using `serde` and sent to the React frontend via a Tauri command.
2.  **Conversation Display & Navigation:**
    *   The React frontend (`App.tsx`) receives the full dataset.
    *   `Sidebar.tsx` and `ConversationList.tsx` display a list of all conversations, sorted by last message date, allowing the user to select one.
    *   `MessageThread.tsx` renders the selected conversation's messages, applying Markdown formatting and syntax highlighting.
3.  **Global Search (Across Conversations):**
    *   The frontend indexes the received conversations (title, first message, project name) using `minisearch`.
    *   User input in the global search bar filters this client-side index, showing matching conversations. Fuzzy matching is supported.
4.  **In-Conversation Search (Within Messages):**
    *   When a conversation is open, `minisearch` indexes its messages.
    *   User input (`Cmd + F`) triggers search within the active conversation's messages, with matches highlighted and keyboard navigation (`Enter`/`Shift+Enter`) enabled.
5.  **Filtering:**
    *   The frontend allows filtering the conversation list by source (All, Claude Code, Cursor) and date range, applying these filters to the client-side indexed data.

## Data Models & State
**1. Rust Backend Data Models (`src-tauri/src/types.rs` - inferred):**
```rust
// Represents the source of a conversation
#[derive(Debug, serde::Serialize, serde::Deserialize, Clone, Copy)]
pub enum ConversationSource {
    ClaudeCode,
    Cursor,
}

// Represents a single message within a conversation
#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Message {
    pub id: String,         // Unique message ID
    pub role: String,       // e.g., "user", "assistant"
    pub content: String,    // Raw markdown content of the message
    pub timestamp: u64,     // Unix timestamp (milliseconds)
}

// Represents a complete conversation thread
#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Conversation {
    pub id: String,                     // Unique conversation ID (e.g., source_id)
    pub title: String,                  // Display title for the conversation
    pub source: ConversationSource,     // Source of the conversation
    pub last_message_timestamp: u64,    // Timestamp of the last message for sorting
    pub first_message_preview: String,  // Short preview for search/display
    pub project_name: Option<String>,   // Optional project context for search
    pub messages: Vec<Message>,         // Full list of messages in the conversation
}
```

**2. Frontend Data Models (`src/lib/types.ts` - inferred):**
```typescript
// Corresponds to ConversationSource in Rust
export type ConversationSource = 'ClaudeCode' | 'Cursor';

// Corresponds to Message in Rust
export interface Message {
  id: string;
  role: 'user' | 'assistant'; // Role of the speaker
  content: string; // Markdown content
  timestamp: number; // Unix timestamp (milliseconds)
}

// Corresponds to Conversation in Rust
export interface Conversation {
  id: string;
  title: string;
  source: ConversationSource;
  last_message_timestamp: number;
  first_message_preview: string;
  project_name?: string;
  messages: Message[];
}
```

**3. Frontend State (React):**
*   `conversations: Conversation[]`: The full list of loaded conversations, indexed by `minisearch`.
*   `selectedConversationId: string | null`: The ID of the conversation currently displayed in the `MessageThread`.
*   `globalSearchQuery: string`: Current text in the global search bar.
*   `inConversationSearchQuery: string`: Current text in the active conversation's search bar.
*   `filterOptions: { source?: ConversationSource; dateRange?: [number, number] }`: Active filters for the conversation list.
*   `searchMatches: { messageId: string; startIndex: number; endIndex: number }[]`: Details of current search matches within a conversation for highlighting and navigation.

## API & Interfaces
The primary interface between the Rust backend and the React frontend is through Tauri commands.

**Tauri Commands (Rust functions exposed to JavaScript):**
*   `get_all_conversations()`:
    *   **Description:** Fetches, parses, and unifies all chat history data from configured sources (Claude Code, Cursor).
    *   **Parameters:** None.
    *   **Returns:** A JSON-serialized `Vec<Conversation>` containing all conversations and their full message contents. This is the main data payload for the frontend.
*   `open_external_link(url: String)`:
    *   **Description:** Opens the specified URL in the user's default web browser. Utilizes the `tauri-plugin-opener`.
    *   **Parameters:** `url: String` (The URL to open).
    *   **Returns:** `Result<(), String>` (Success or error message).

**Frontend Components & Interactions:**
*   **`App.tsx`:** Coordinates overall state, fetches data from Rust, and manages global search/filter state.
*   **`Sidebar.tsx`:** Provides input for global search, source filters (All, Claude Code, Cursor), and potentially date range filters. It renders `ConversationList`.
*   **`ConversationList.tsx`:** Displays summarized `Conversation` objects. Allows user selection (e.g., click, arrow keys) to update `selectedConversationId`.
*   **`MessageThread.tsx`:** Displays the `messages` of the `selectedConversation`. Implements in-conversation search (`Cmd + F`), match highlighting, and navigation (`Enter`/`Shift+Enter`).
*   **Keyboard Shortcuts:**
    *   `Cmd + F`: Activates in-conversation search.
    *   `Up / Down` arrows: Navigate the `ConversationList`.
    *   `Enter / Shift + Enter`: Navigate between search matches within `MessageThread`.
    *   `Escape`: Clears the current search.

## Key Components
*   **`src-tauri/src/main.rs`:** The entry point for the Tauri application, initializes the Rust core library.
*   **`src-tauri/src/lib.rs`:** Defines the Rust library, registers Tauri commands, and orchestrates the data ingestion process by calling specialized parsing modules.
*   **`src-tauri/src/claude_code.rs`:** Module dedicated to reading and parsing chat history data specifically from Claude Code's `history.jsonl` and project directories.
*   **`src-tauri/src/cursor.rs`:** Module dedicated to reading and parsing chat history data from Cursor's `state.vscdb` (an SQLite database).
*   **`src-tauri/src/types.rs`:** Defines the core Rust data structures (`Conversation`, `Message`, `ConversationSource`) used for the unified chat history model.
*   **`src/App.tsx`:** The root React component, handling application-wide state, data fetching from Tauri, and rendering major layout sections.
*   **`src/components/ConversationList.tsx`:** React component responsible for rendering the list of conversations in the sidebar and managing selection.
*   **`src/components/MessageThread.tsx`:** React component for displaying the messages of a chosen conversation, including markdown rendering and in-message search/highlighting.
*   **`src/components/Sidebar.tsx`:** React component containing the global search input, filters, and embedding the `ConversationList`.
*   **`src/lib/search.ts`:** Frontend utility module likely encapsulating the `minisearch` logic for both global and in-conversation search operations.
*   **`src/lib/types.ts`:** TypeScript interfaces defining the frontend data models, mirroring the Rust types.

## Dependencies & Environment
**Frontend (Node.js/npm):**
*   `react`, `react-dom`: Core UI library.
*   `typescript`: JavaScript superset for type safety.
*   `vite`, `@vitejs/plugin-react`: Fast build tool and React plugin.
*   `tailwindcss`, `@tailwindcss/typography`, `@tailwindcss/vite`: Utility-first CSS framework for styling, including rich typography.
*   `minisearch`: Client-side full-text search library, used for fuzzy matching across conversations and within messages.
*   `@tauri-apps/api`: JavaScript API for interacting with the Tauri backend.
*   `@tauri-apps/plugin-opener`: Tauri plugin for opening external URLs.
*   `@types/react`, `@types/react-dom`: TypeScript type definitions for React.

**Backend (Rust/Cargo):**
*   `tauri`, `tauri-plugin-opener`: Core Tauri framework and external link plugin.
*   `serde`, `serde_json`: Serialization/deserialization framework for Rust data structures, essential for data transfer between Rust and JavaScript.
*   `rusqlite` (with `bundled` feature): SQLite bindings for Rust, used to read Cursor's `state.vscdb` file.
*   `dirs`: Cross-platform utility for retrieving common user directories (e.g., home directory, application support).
*   `pulldown-cmark` (with `html` feature): A Markdown parser for Rust, likely used for processing/stripping markdown content in the backend before sending to the frontend, or potentially for generating HTML previews.

**Development Environment:**
*   Node.js (v18+)
*   Rust
*   macOS (primary target platform, Apple Silicon)

## Development Notes
*   **Privacy-Focused:** Emphasized as a core principle; all operations are local, and data is only read, never modified or sent externally.
*   **Read-Only Data Access:** The application strictly reads chat history files from their default locations on disk and does not alter them.
*   **Cross-Platform Potential:** While currently targeting macOS, Tauri's nature implies potential for Windows/Linux builds with minimal changes to the Rust logic.
*   **Unified Data Schema:** A critical convention is the consistent `Conversation` and `Message` data model defined in both Rust (`types.rs`) and TypeScript (`types.ts`) for seamless data exchange.
*   **Debounced Search:** `src/hooks/useDebounce.ts` suggests that search inputs are debounced to improve performance and user experience by delaying search execution until the user pauses typing.