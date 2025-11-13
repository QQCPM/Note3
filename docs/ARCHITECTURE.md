# Weave Architecture Overview

## Project Vision
Weave is an AI-native note-taking platform that combines hierarchical note management, live code artifacts, dynamic databases, LaTeX rendering, and multiple AI systems.

## Technology Stack

### Desktop Application
- **Framework**: Tauri 2.0
  - Rust backend for performance-critical operations
  - Native OS WebView (no bundled Chromium)
  - 50% less memory usage vs Electron (30-40 MB vs 100 MB)
  - Startup time <500ms
  - Smaller bundle size (3-10 MB vs 80-120 MB)

### Frontend
- **Framework**: React 18+ with TypeScript
- **UI Framework**: Tailwind CSS + Headless UI
- **State Management**:
  - Zustand (global state)
  - React Query (server state, caching, optimistic updates)
- **Editor**: Lexical (Facebook's React-first editor)
  - Extensible plugin architecture
  - Custom nodes for databases, artifacts, LaTeX, toggles
- **LaTeX Rendering**: KaTeX 0.16+ (20-30x faster than MathJax)
- **Markdown Parser**: Remark + Rehype

### Backend
- **Primary Backend**: Rust (Tauri Commands)
- **API Layer**: tRPC (TypeScript-first RPC)
- **Database**: SQLite + SQLx
  - Embedded database (no server needed)
  - Type-safe queries with SQLx
  - Migrations with `sqlx-cli`

### AI Systems
1. **Code Generation**: Qwen3-Coder-30B (Local via llama.cpp)
2. **Note Understanding**: GPT-4o (API) OR DeepSeek-R1 (Local)
3. **Embeddings**: Qwen3-Embedding-0.6B (Local) OR OpenAI text-embedding-3-large (API)

## Key Features

### 1. Hierarchical Note Management
- Tree structure with unlimited nesting
- Drag-and-drop reordering
- Context menus for note operations
- Icons and titles customization

### 2. Block-Based Editor
- **Text Blocks**: Headings (H1, H2), paragraphs
- **Database Blocks**: Tables with multiple views (table, gallery, calendar)
- **Artifact Blocks**: Live HTML/CSS/JS execution in sandboxed iframes
- **Task Blocks**: Checkboxes, priorities, completion tracking
- **LaTeX Blocks**: Inline ($...$) and display ($$...$$) math

### 3. AI Integration
- **Artifact Generation**: Natural language → interactive code
- **Semantic Search**: Find notes by meaning, not just keywords
- **Note Editing**: Intelligent editing like Cursor IDE
- **Database Creation**: Natural language → table schema
- **Web Search**: Integrated search via Brave API

### 4. MCP (Model Context Protocol)
- GitHub integration
- Filesystem access
- Web search
- External database queries
- Figma, Notion, Gmail integrations

### 5. Skills System
- Specialized instruction sets for AI
- Note Writer, Code Generator, Data Analyzer
- User can activate/deactivate skills
- Multiple skills can be active simultaneously

## Design Principles

1. **Local-First**: All data stored locally (SQLite)
2. **Privacy**: No telemetry, optional cloud sync
3. **Performance**: Fast startup, minimal memory usage
4. **Extensibility**: Plugin architecture via MCP
5. **AI-Native**: AI integrated into every workflow

## File Structure

```
weave/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # React hooks
│   ├── services/           # AI, MCP services
│   ├── store/              # Zustand stores
│   └── types/              # TypeScript types
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/       # Tauri commands
│   │   ├── db/             # Database layer
│   │   ├── ai/             # AI orchestration
│   │   └── mcp/            # MCP manager
│   └── migrations/         # SQLx migrations
├── docs/                   # Documentation
└── models/                 # AI models (gitignored)
```

## Security

- **API Keys**: Stored in OS keychain
- **Artifact Sandbox**: Iframes with CSP restrictions
- **No Remote Code**: All AI models run locally or via trusted APIs
- **End-to-End Encryption**: For optional cloud sync

## Performance Targets

- App startup: <500ms
- Note loading: <100ms
- AI first token: <2s
- Memory usage: <100 MB
- Bundle size: <15 MB
