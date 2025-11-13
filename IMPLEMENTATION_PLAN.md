# Weave - Implementation Plan

## Project Overview

**Weave** is an AI-native note-taking platform that combines hierarchical note management with powerful AI capabilities. This document outlines the complete implementation strategy.

## Quick Links

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Database Schema](./docs/DATABASE_SCHEMA.md)
- [AI Systems](./docs/AI_SYSTEMS.md)
- [UI Components](./docs/UI_COMPONENTS.md)
- [Implementation Roadmap](./docs/IMPLEMENTATION_ROADMAP.md)
- [MCP & Skills](./docs/MCP_SKILLS.md)

## What We're Building

### Core Features

1. **Hierarchical Note Management**
   - Tree structure with unlimited nesting
   - Drag-and-drop reordering
   - Icons and custom titles
   - Context menu operations

2. **Block-Based Editor**
   - Text blocks (headings, paragraphs)
   - Database blocks (table, gallery, calendar views)
   - Artifact blocks (live code execution)
   - Task blocks (todo lists)
   - LaTeX blocks (math rendering)

3. **AI Integration**
   - Artifact generation from natural language
   - Semantic search across notes
   - Intelligent note editing
   - Database creation and querying
   - Web search integration

4. **MCP System**
   - GitHub, Filesystem, Web Search
   - External database connections
   - Figma, Notion, Gmail integrations

5. **Skills System**
   - Specialized AI capabilities
   - Note Writer, Code Generator, Data Analyzer
   - Custom user-defined skills

## Technology Stack

### Desktop Application
- **Tauri 2.0**: Rust backend + React frontend
- **React 18+**: Component-based UI
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Lexical**: Rich text editor
- **SQLite**: Local database

### AI Models (User-Configurable)
1. **Code Generation**: Qwen3-Coder-30B (local) or OpenAI
2. **Note Understanding**: GPT-4o (API) or DeepSeek-R1 (local)
3. **Embeddings**: Qwen3-Embedding (local) or OpenAI

## Implementation Strategy

### Phase 1: Foundation (Weeks 1-4)
✅ **Goal**: Basic app structure with note management

**Deliverables**:
- Tauri app that launches
- SQLite database with schema
- Note tree with CRUD operations
- Basic text editing

### Phase 2: Block System (Weeks 5-8)
✅ **Goal**: Complete block-based editor

**Deliverables**:
- All block types (text, database, artifact, task)
- Slash command menu
- Block persistence
- Drag-and-drop

### Phase 3: AI Integration (Weeks 9-14)
✅ **Goal**: AI-powered features

**Deliverables**:
- Artifact generation
- Semantic search
- AI chat interface
- Function calling tools

### Phase 4: MCP & Skills (Weeks 15-17)
✅ **Goal**: Extensibility systems

**Deliverables**:
- MCP manager with 3+ servers
- Skills system with default skills
- Configuration UI

### Phase 5: Polish & Testing (Weeks 18-20)
✅ **Goal**: Production-ready quality

**Deliverables**:
- Performance optimization
- Comprehensive testing
- UI/UX polish
- Documentation

### Phase 6: Release (Week 21-22)
✅ **Goal**: Public launch

**Deliverables**:
- Beta release
- Website
- v1.0 public release

## Getting Started

### Prerequisites

```bash
# Node.js 20+
node --version

# Rust 1.75+
rustc --version

# Tauri CLI
cargo install tauri-cli

# SQLite 3
sqlite3 --version
```

### Initial Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd weave

# 2. Install dependencies
npm install

# 3. Setup database
cd src-tauri
sqlx database create
sqlx migrate run

# 4. Start development server
cd ..
npm run tauri dev
```

### AI Models Setup (User Guide)

#### Option 1: Local Models (Free, Private)

**Download Models**:
```bash
# Install tools
pip install huggingface-hub llama-cpp-python

# Download Qwen3-Coder-30B (code generation)
huggingface-cli download Qwen/Qwen3-Coder-30B-Instruct-GGUF \
  qwen3-coder-30b-q4_k_m.gguf \
  --local-dir ./models

# Download Qwen3-Embedding (semantic search)
huggingface-cli download Qwen/Qwen3-Embedding-0.6B-GGUF \
  qwen3-embedding-0.6b-q8_0.gguf \
  --local-dir ./models
```

**Start Model Servers**:
```bash
# Terminal 1: Code generation server
python -m llama_cpp.server \
  --model ./models/qwen3-coder-30b-q4_k_m.gguf \
  --port 8080 \
  --n_ctx 128000

# Terminal 2: Embedding server
python -m llama_cpp.server \
  --model ./models/qwen3-embedding-0.6b-q8_0.gguf \
  --port 8081 \
  --embedding
```

**Configure in Weave**:
- Settings → AI Configuration
- Code Generation: Local (`http://localhost:8080`)
- Embeddings: Local (`http://localhost:8081`)
- Note Understanding: Local or OpenAI

#### Option 2: API-Based (Easier, Paid)

**Get API Keys**:
- OpenAI: https://platform.openai.com/api-keys
- Brave Search: https://brave.com/search/api/

**Configure in Weave**:
- Settings → AI Configuration
- Code Generation: OpenAI (`gpt-4o`)
- Note Understanding: OpenAI (`gpt-4o`)
- Embeddings: OpenAI (`text-embedding-3-large`)
- Web Search: Brave API

## Project Structure

```
weave/
├── src/                          # React frontend
│   ├── components/
│   │   ├── Editor/               # Lexical editor
│   │   ├── Sidebar/              # Note tree
│   │   ├── AIPanel/              # AI sidebar
│   │   ├── Blocks/               # Block components
│   │   └── Modals/               # Modal dialogs
│   ├── hooks/                    # Custom React hooks
│   ├── services/
│   │   ├── ai/                   # AI services
│   │   ├── mcp/                  # MCP manager
│   │   └── search/               # Web search
│   ├── store/                    # Zustand stores
│   ├── types/                    # TypeScript types
│   ├── App.tsx
│   └── main.tsx
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/             # Tauri commands
│   │   │   ├── notes.rs
│   │   │   ├── blocks.rs
│   │   │   ├── ai.rs
│   │   │   └── mcp.rs
│   │   ├── db/                   # Database layer
│   │   │   ├── mod.rs
│   │   │   ├── notes.rs
│   │   │   └── blocks.rs
│   │   ├── ai/                   # AI orchestration
│   │   │   ├── mod.rs
│   │   │   ├── code_gen.rs
│   │   │   └── embeddings.rs
│   │   └── mcp/                  # MCP manager
│   │       ├── mod.rs
│   │       └── servers/
│   ├── migrations/               # SQLx migrations
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── AI_SYSTEMS.md
│   ├── UI_COMPONENTS.md
│   ├── IMPLEMENTATION_ROADMAP.md
│   └── MCP_SKILLS.md
│
├── models/                       # AI models (gitignored)
│   ├── qwen3-coder-30b.gguf
│   └── qwen3-embedding.gguf
│
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

## Design Principles

### 1. Exact Design Match
- UI must match the HTML prototype exactly
- Colors, spacing, typography from prototype
- Animations and interactions preserved

### 2. Local-First
- All data stored locally in SQLite
- No cloud requirements
- Optional sync (future)

### 3. Privacy-Focused
- No telemetry
- API keys stored in OS keychain
- User controls all data

### 4. Performance
- <500ms startup time
- <100ms note loading
- <100 MB memory usage
- <15 MB bundle size

### 5. Extensibility
- MCP protocol for external tools
- Skills system for AI customization
- Plugin architecture (future)

## Development Guidelines

### Component Development
1. Match HTML prototype styling exactly
2. Use TypeScript for all components
3. Implement proper error boundaries
4. Add loading and error states
5. Write unit tests for logic

### State Management
1. Use Zustand for global state
2. Use React Query for server state
3. Optimistic updates for better UX
4. Persist state to SQLite

### AI Integration
1. All AI operations must stream
2. Handle errors gracefully
3. Provide fallback options
4. Cache where appropriate

### Security
1. Sandbox all artifact code
2. Store API keys securely
3. Validate all user input
4. Implement CSP headers

## Testing Strategy

### Unit Tests (70% coverage)
```bash
npm run test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### Platform Testing
- Windows 10/11
- macOS 12+
- Ubuntu 20.04+

## Building for Production

```bash
# Development build
npm run tauri dev

# Production build (current platform)
npm run tauri build

# Output:
# - Windows: src-tauri/target/release/bundle/msi/*.msi
# - macOS: src-tauri/target/release/bundle/dmg/*.dmg
# - Linux: src-tauri/target/release/bundle/deb/*.deb
#          src-tauri/target/release/bundle/appimage/*.AppImage
```

## Performance Targets

- ✅ App startup: <500ms
- ✅ Note loading: <100ms
- ✅ AI first token: <2s
- ✅ Memory usage: <100 MB
- ✅ Bundle size: <15 MB

## Success Metrics

### Technical
- Startup time
- Memory usage
- AI response latency
- Test coverage

### User
- Daily active users
- Notes created per user
- AI interactions per session
- User retention (7-day, 30-day)

### AI
- Artifact success rate: >90%
- Search relevance: >85%
- Edit acceptance: >80%
- Tool accuracy: >95%

## Next Steps

1. **Review Documentation**: Read all docs in `./docs/`
2. **Setup Environment**: Install prerequisites
3. **Start Development**: Follow Phase 1 roadmap
4. **Configure AI**: Set up models (local or API)
5. **Build MVP**: Focus on core features first

## Support & Resources

### Documentation
- Architecture: `./docs/ARCHITECTURE.md`
- Database: `./docs/DATABASE_SCHEMA.md`
- AI Systems: `./docs/AI_SYSTEMS.md`
- Components: `./docs/UI_COMPONENTS.md`
- Roadmap: `./docs/IMPLEMENTATION_ROADMAP.md`

### External Resources
- Tauri Docs: https://tauri.app/
- React Docs: https://react.dev/
- Lexical Docs: https://lexical.dev/
- SQLx Docs: https://github.com/launchbadge/sqlx

### AI Model Resources
- llama.cpp: https://github.com/ggerganov/llama.cpp
- Hugging Face: https://huggingface.co/
- OpenAI API: https://platform.openai.com/

## License

[TBD]

## Contributors

[TBD]

---

**Last Updated**: November 2025
**Version**: 1.0
**Status**: Ready for Implementation
