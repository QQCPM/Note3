# Weave - AI-Native Note-Taking Platform

<div align="center">

  **A powerful, privacy-focused note-taking app with integrated AI capabilities**

  ![Status](https://img.shields.io/badge/status-in%20development-yellow)
  ![License](https://img.shields.io/badge/license-TBD-blue)

</div>

## 🌟 Overview

Weave is an AI-native note-taking platform that combines hierarchical note management with powerful AI capabilities. Built with Tauri, React, and Rust, it offers a desktop-first experience with local-first data storage and optional AI integration.

### Key Features

- 📝 **Hierarchical Note Management** - Organize notes in unlimited nested structures
- 🎨 **Live Code Artifacts** - Generate and run interactive HTML/CSS/JS directly in notes
- 📊 **Dynamic Databases** - Create tables with multiple views (table, gallery, calendar)
- 🧮 **LaTeX Support** - Beautiful math rendering with KaTeX
- 🤖 **Multiple AI Systems** - Code generation, semantic search, intelligent editing
- 🔌 **MCP Protocol** - Extensible tool system (GitHub, filesystem, web search, etc.)
- ✨ **Skills System** - Specialized AI capabilities for different tasks
- 🔒 **Privacy-Focused** - Local-first, no telemetry, encrypted cloud sync (optional)

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Rust** 1.75+ ([Install](https://rustup.rs/))
- **SQLite** 3 (Usually pre-installed)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd Note3

# Install dependencies
npm install

# Setup database
cd src-tauri
sqlx database create
sqlx migrate run
cd ..

# Start development server
npm run tauri dev
```

### AI Models Setup

Weave supports both **local models** (free, private) and **API-based models** (easier, paid).

#### Option 1: Local Models (Recommended)

```bash
# Install tools
pip install huggingface-hub llama-cpp-python

# Download models
huggingface-cli download Qwen/Qwen3-Coder-30B-Instruct-GGUF \
  qwen3-coder-30b-q4_k_m.gguf --local-dir ./models

huggingface-cli download Qwen/Qwen3-Embedding-0.6B-GGUF \
  qwen3-embedding-0.6b-q8_0.gguf --local-dir ./models

# Start model servers
# Terminal 1:
python -m llama_cpp.server --model ./models/qwen3-coder-30b-q4_k_m.gguf --port 8080

# Terminal 2:
python -m llama_cpp.server --model ./models/qwen3-embedding-0.6b-q8_0.gguf --port 8081 --embedding
```

Then in Weave Settings:
- Code Generation: `http://localhost:8080`
- Embeddings: `http://localhost:8081`

#### Option 2: API-Based

Get API keys from:
- [OpenAI](https://platform.openai.com/api-keys)
- [Brave Search](https://brave.com/search/api/)

Configure in Weave Settings → AI Configuration.

## 📚 Documentation

- **[Architecture](./docs/ARCHITECTURE.md)** - System architecture and tech stack
- **[Database Schema](./docs/DATABASE_SCHEMA.md)** - Data models and queries
- **[AI Systems](./docs/AI_SYSTEMS.md)** - AI model configuration and integration
- **[UI Components](./docs/UI_COMPONENTS.md)** - Component hierarchy and design
- **[Roadmap](./docs/IMPLEMENTATION_ROADMAP.md)** - Phase-by-phase development plan
- **[MCP & Skills](./docs/MCP_SKILLS.md)** - Extensibility systems

## 🏗️ Project Structure

```
weave/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom hooks
│   ├── services/           # AI, MCP services
│   ├── store/              # State management
│   └── types/              # TypeScript types
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri commands
│   │   ├── db/             # Database layer
│   │   ├── ai/             # AI orchestration
│   │   └── mcp/            # MCP manager
│   └── migrations/         # Database migrations
├── docs/                   # Documentation
├── models/                 # AI models (gitignored)
```

## 🛠️ Technology Stack

### Desktop Application
- **Tauri 2.0** - Rust backend + Native WebView
- **React 18+** - Component-based UI
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Vite** - Fast build tool

### Editor & UI
- **Lexical** - Extensible rich text editor
- **KaTeX** - Fast LaTeX rendering
- **Headless UI** - Accessible components

### Backend & Data
- **Rust** - Performance and safety
- **SQLite + SQLx** - Embedded database
- **Zustand** - Global state management
- **React Query** - Server state & caching

### AI Integration
- **llama.cpp** - Local model inference
- **OpenAI API** - Cloud AI (optional)
- **MCP Protocol** - Tool extensibility

## 🎯 Development Roadmap

### Phase 1: Foundation ✅ (Weeks 1-4)
- Tauri setup
- SQLite database
- Note tree with CRUD
- Basic text editing

### Phase 2: Block System (Weeks 5-8)
- Block-based editor
- Database blocks (table, gallery, calendar)
- Artifact blocks (live code)
- Task blocks

### Phase 3: AI Integration (Weeks 9-14)
- Artifact generation
- Semantic search
- AI chat interface
- Function calling tools

### Phase 4: MCP & Skills (Weeks 15-17)
- MCP manager
- MCP servers (GitHub, FS, Search)
- Skills system

### Phase 5: Polish & Testing (Weeks 18-20)
- Performance optimization
- Testing (70%+ coverage)
- UI/UX polish

### Phase 6: Release (Week 21-22)
- Beta release
- Website
- Public v1.0

See [Implementation Roadmap](./docs/IMPLEMENTATION_ROADMAP.md) for detailed breakdown.

## 🎨 Design System

### Colors (GitHub Dark Theme)
- Background: `#0d1117`, `#010409`, `#161b22`
- Borders: `#30363d`
- Text: `#c9d1d9`, `#8b949e`, `#6e7681`
- Accents: Blue `#58a6ff`, Purple `#a371f7`, Green `#3fb950`

### Typography
- Font: Inter
- Heading 1: 32px, 700
- Heading 2: 24px, 600
- Body: 15px, 400

## 🧪 Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test:all
```

## 📦 Building

```bash
# Development
npm run tauri dev

# Production build
npm run tauri build

# Output:
# - Windows: src-tauri/target/release/bundle/msi/*.msi
# - macOS: src-tauri/target/release/bundle/dmg/*.dmg
# - Linux: src-tauri/target/release/bundle/deb/*.deb
```

## 🎯 Performance Targets

- ✅ Startup time: <500ms
- ✅ Note loading: <100ms
- ✅ AI first token: <2s
- ✅ Memory usage: <100 MB
- ✅ Bundle size: <15 MB

## 🤝 Contributing

We welcome contributions! Please read our contributing guidelines (coming soon).

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

[TBD]

## 🙏 Acknowledgments

- **Tauri** - For the amazing desktop framework
- **Lexical** - For the powerful editor
- **Qwen** - For open-source AI models
- **GitHub** - For the beautiful dark theme inspiration

## 📞 Support

- 📖 **Documentation**: [./docs/](./docs/)
- 🐛 **Issues**: GitHub Issues (coming soon)
- 💬 **Discord**: Community server (coming soon)
- 📧 **Email**: support@weave.app (coming soon)

## 🗺️ Roadmap

### v1.0 (Current) - Foundation
- Core note-taking features
- AI integration
- MCP & Skills

### v1.1 - Collaboration
- Real-time collaboration (CRDT)
- Shared workspaces
- Comments

### v1.2 - Sync & Mobile
- Cloud sync (E2E encrypted)
- Mobile app (React Native)
- Progressive Web App

### v1.3 - Advanced AI
- Custom model fine-tuning
- Voice input/output
- Image generation

### v2.0 - Enterprise
- Team workspaces
- SSO integration
- On-premise deployment

---

<div align="center">

  **Built with ❤️ by the Weave team**

  [Website](https://weave.app) • [Docs](./docs/) • [Discord](#) • [Twitter](#)

</div>
