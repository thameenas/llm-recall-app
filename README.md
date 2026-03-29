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

## Getting started

### Option 1: Download the app 

1. Download the latest `.dmg` from the [Releases page](https://github.com/thameenas/llm-recall-app/releases)
2. Open the DMG and drag Recall to your Applications folder
3. Since this is a self-signed app and not apple signed, you will have to manually allow to open this app via security settings:
   
   <img width="50%" height="50%" src="https://github.com/user-attachments/assets/9d55445f-22c4-44f4-847a-e348ca9ba8f2" />



> Apple Silicon (M1/M2/M3/M4) Macs only.

### Option 2: Build from source

Requires [Node.js](https://nodejs.org/) (v18+) and [Rust](https://rustup.rs/).

```bash
# Clone the repo
git clone https://github.com/thameenas/llm-recall-app
cd llm-recall-app

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Or build a standalone .app
npm run tauri build
```

The built app will be in `src-tauri/target/release/bundle/macos/`.

No accounts, no cloud, no config needed — the app reads your chat history directly from disk.

## Where does it read data from?

Recall reads your local chat history in **read-only mode**. It never modifies your data.

| Source | Location |
|---|---|
| Claude Code | `~/.claude/history.jsonl` and `~/.claude/projects/` |
| Cursor | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` |

## Privacy

Everything runs locally on your machine. No data is sent anywhere. The app only reads files that Claude Code and Cursor have already written to your disk.
