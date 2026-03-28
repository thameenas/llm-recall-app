# Project Context

## Overview
This project is a scaffold for building cross-platform desktop applications using Tauri, a framework for building binaries, with a React and TypeScript frontend. It leverages Rust for the backend logic and native system interactions, while React handles the user interface. The primary purpose is to provide a robust starting point for hybrid desktop applications.

## Architecture
The architecture follows a hybrid desktop application pattern, separating the system into a frontend and a backend:
-   **Frontend (UI Layer)**: Built with React and TypeScript, managed by Vite. It renders the user interface and handles user interactions.
-   **Backend (Native Layer)**: Written in Rust, powered by the Tauri framework. It provides access to native system APIs, handles computationally intensive tasks, and can expose custom commands to the frontend via an Inter-Process Communication (IPC) bridge.
-   **IPC (Inter-Process Communication)**: Frontend components communicate with the Rust backend using Tauri's `@tauri-apps/api` for invoking native commands and receiving events.

## Core Workflows
1.  **Application Launch**: The Rust `main.rs` initializes the Tauri application, creating a webview window that loads the React frontend (`index.html`).
2.  **User Interaction**: The React frontend displays the UI. User actions (e.g., button clicks) can trigger JavaScript functions.
3.  **Native Functionality Invocation**: If a user action requires native system access or complex logic, the React frontend uses the `@tauri-apps/api` to invoke a corresponding command exposed by the Rust backend.
4.  **Backend Processing**: The Rust backend receives the invoked command, executes its logic (which might include using Tauri plugins like `plugin-opener` for system operations), and can return results to the frontend.
5.  **UI Update**: The React frontend receives results from the backend and updates its state and UI accordingly.

## Data Models & State
-   **Frontend State**: Managed locally by React components (using `useState`, `useReducer`, or other state management patterns) for UI-specific data.
-   **Backend Data Models**: No application-specific data models are explicitly defined in this scaffold. However, the presence of `serde` and `serde_json` in `Cargo.toml` indicates that the Rust backend is set up for efficient serialization and deserialization of data, which would be crucial for defining application-specific data structures (e.g., `struct`s with `#[derive(Serialize, Deserialize)]`) for IPC or persistence.
-   **IPC Data Transfer**: Data transferred between frontend and backend via Tauri's IPC mechanism is typically JSON-serializable, leveraging `serde_json` on the Rust side for conversion to/from Rust types.

## API & Interfaces
-   **Frontend-to-Backend IPC**:
    -   **Method**: `invoke` function from `@tauri-apps/api`.
    -   **Contract**: `await invoke('command_name', { payload_key: payload_value })`. `command_name` refers to a Rust function annotated with `#[tauri::command]`. The payload is a JavaScript object that gets serialized to JSON and deserialized into Rust function arguments.
-   **Backend-Exposed Commands**:
    -   **Convention**: Rust functions annotated with `#[tauri::command]` are exposed to the frontend.
    -   **Example (Inferred from `plugin-opener`)**: While not explicitly shown as custom commands in this scaffold, `tauri-plugin-opener` typically exposes commands like `open` or `open_with` to allow the frontend to open URLs or files using the system's default application. A hypothetical command might look like `fn open_url(url: String) -> Result<(), String>`.

## Key Components
-   **`src/` (Frontend)**: Contains the React application's source code.
    -   `App.tsx`: The main React component, serving as the application's root UI.
    -   `main.tsx`: Entry point for the React application, responsible for mounting the `App` component.
-   **`src-tauri/` (Backend)**: Contains the Rust backend code and Tauri configuration.
    -   `src/main.rs`: The main entry point for the Rust desktop application, which calls `tmprecall_scaffold_lib::run()` to start the Tauri application.
    -   `src/lib.rs`: The library crate containing the core Tauri application setup and potentially custom Rust commands.
    -   `Cargo.toml`: Rust project manifest, specifying dependencies (`tauri`, `serde`, `tauri-plugin-opener`) and build settings.
    -   `tauri.conf.json`: Tauri application configuration, including window settings, allowed IPC commands, and plugin configurations.
    -   `build.rs`: Rust build script, often used for bundling frontend assets or other pre-build steps for Tauri.

## Dependencies & Environment
### Frontend (Node.js/npm)
-   **Frameworks**: `react` (v19.1.0), `react-dom` (v19.1.0)
-   **Tauri API**: `@tauri-apps/api` (v2), `@tauri-apps/plugin-opener` (v2)
-   **Build Tooling**: `vite` (v7.0.4), `@vitejs/plugin-react` (v4.6.0)
-   **Language**: `typescript` (~5.8.3)
-   **CLI**: `@tauri-apps/cli` (v2)

### Backend (Rust/Cargo)
-   **Tauri Core**: `tauri` (v2)
-   **Plugins**: `tauri-plugin-opener` (v2)
-   **Serialization**: `serde` (v1, with `derive` feature), `serde_json` (v1)
-   **Build Utilities**: `tauri-build` (v2)

### Development Environment
-   Node.js (for frontend tooling)
-   Rust Toolchain (for backend compilation)
-   Recommended IDE: VS Code with Tauri and `rust-analyzer` extensions.

## Development Notes
-   **Frontend Development**: Use `npm run dev` (or `vite`) to run the frontend in development mode with hot-reloading.
-   **Tauri Development**: Use `npm run tauri dev` (via `@tauri-apps/cli`) to run the full desktop application, bundling the frontend into the webview and providing live reload for both frontend and backend changes.
-   **Type Safety**: TypeScript is used extensively for frontend code, providing strong type checking. Rust also enforces strong typing in the backend.
-   **Build Process**: `npm run build` first compiles the TypeScript frontend, then `tauri build` compiles the Rust backend and bundles the frontend assets.
-   **.gitignore**: Standard entries for Node.js (`node_modules`, `dist`) and common editor files, plus `logs` for application logs.