# Recall

Browse and search your AI chat history from **Claude Code** and **Cursor** in one place.

If you switch between Claude Code and Cursor, your conversations end up scattered across different storage formats and locations. Recall brings them together in a single, fast, searchable interface.

![Dark themed three-panel interface](https://img.shields.io/badge/platform-macOS-lightgrey)

<img width="75%" height="75%" alt="Screenshot 2026-03-29 at 1 33 25 PM" src="https://github.com/user-attachments/assets/c7b4d8b8-7a76-4a6b-bf72-708ec284e48e" />


## Features

- **Unified conversation list** from both Claude Code and Cursor, sorted by date
- **Search across all conversations** by title, first message, or project name — with fuzzy matching (typos are OK)
- **Search within a conversation** to find specific messages, with match highlighting and navigation
- **Filter by source** (All / Claude Code / Cursor) and by date range
- **Markdown rendering** with syntax-highlighted code blocks and tables
- **Keyboard shortcuts**
  - `Cmd + F` — search within the open conversation
  - `Up / Down` arrows — navigate the conversation list
  - `Enter / Shift + Enter` — jump between search matches
  - `Escape` — clear search

## Requirements

- macOS
- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://rustup.rs/) (install with `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)

## Getting started

```bash
# Clone the repo
git clone [<repo-url>](https://github.com/thameenas/llm-recall-app)
cd recall

# Install dependencies
npm install

# Run the app
npm run tauri dev
```

The app will open in a native window. It reads your chat history directly from disk — no accounts, no cloud, no config needed.

## Where does it read data from?

Recall reads your local chat history in **read-only mode**. It never modifies your data.

| Source | Location |
|---|---|
| Claude Code | `~/.claude/history.jsonl` and `~/.claude/projects/` |
| Cursor | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` |


## Building a standalone app

To create a `.app` bundle you can double-click to launch:

```bash
npm run tauri build
```

The built app will be in `src-tauri/target/release/bundle/macos/`.

## Privacy

Everything runs locally on your machine. No data is sent anywhere. The app only reads files that Claude Code and Cursor have already written to your disk.
