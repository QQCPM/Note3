# Weave - Quick Start Guide

This guide will get you up and running with Weave in 15 minutes.

## 📋 Prerequisites Checklist

Before starting, make sure you have:

- [ ] **Node.js 20+** installed
  ```bash
  node --version  # Should be v20.0.0 or higher
  ```

- [ ] **Rust 1.75+** installed
  ```bash
  rustc --version  # Should be 1.75.0 or higher
  ```

- [ ] **SQLite 3** installed (usually comes pre-installed)
  ```bash
  sqlite3 --version
  ```

- [ ] **Tauri CLI** installed
  ```bash
  cargo install tauri-cli
  ```

## 🚀 Installation (5 minutes)

### Step 1: Clone and Install

```bash
# Clone the repository
git clone <repo-url>
cd Note3

# Install dependencies
npm install
```

### Step 2: Setup Database

```bash
# Navigate to Tauri directory
cd src-tauri

# Create database
sqlx database create

# Run migrations
sqlx migrate run

# Go back to root
cd ..
```

### Step 3: Start Development Server

```bash
# Start the app
npm run tauri dev
```

🎉 **Weave should now launch!** You'll see a window with the note-taking interface.

## 🤖 AI Setup (10 minutes)

You have two options: **Local Models** (free, private) or **API-Based** (easier, paid).

### Option A: Local Models (Recommended for Privacy)

**Step 1: Install Tools**

```bash
# Install Python packages
pip install huggingface-hub llama-cpp-python
```

**Step 2: Download Models**

```bash
# Create models directory
mkdir -p models

# Download code generation model (~20 GB)
huggingface-cli download Qwen/Qwen3-Coder-30B-Instruct-GGUF \
  qwen3-coder-30b-q4_k_m.gguf \
  --local-dir ./models

# Download embedding model (~600 MB)
huggingface-cli download Qwen/Qwen3-Embedding-0.6B-GGUF \
  qwen3-embedding-0.6b-q8_0.gguf \
  --local-dir ./models
```

**Step 3: Start Model Servers**

Open **two terminal windows**:

**Terminal 1 - Code Generation Server:**
```bash
python -m llama_cpp.server \
  --model ./models/qwen3-coder-30b-q4_k_m.gguf \
  --port 8080 \
  --n_ctx 128000 \
  --n_gpu_layers 35
```

**Terminal 2 - Embedding Server:**
```bash
python -m llama_cpp.server \
  --model ./models/qwen3-embedding-0.6b-q8_0.gguf \
  --port 8081 \
  --embedding \
  --n_gpu_layers 35
```

> **Note**: `--n_gpu_layers 35` enables GPU acceleration. Remove if you don't have a GPU.

**Step 4: Configure Weave**

In Weave app:
1. Open **Settings** (⚙️ icon)
2. Go to **AI Configuration**
3. Set:
   - Code Generation Provider: `Local`
   - Code Generation Endpoint: `http://localhost:8080`
   - Embeddings Provider: `Local`
   - Embeddings Endpoint: `http://localhost:8081`
4. Click **Save**

✅ **You're ready to use local AI!**

### Option B: API-Based (Easier Setup)

**Step 1: Get API Keys**

1. **OpenAI API Key**:
   - Go to https://platform.openai.com/api-keys
   - Create a new API key
   - Copy the key (starts with `sk-...`)

2. **Brave Search API Key** (optional, for web search):
   - Go to https://brave.com/search/api/
   - Sign up for free tier (2,000 queries/month)
   - Copy the API key

**Step 2: Configure Weave**

In Weave app:
1. Open **Settings** (⚙️ icon)
2. Go to **AI Configuration**
3. Set:
   - Code Generation Provider: `OpenAI`
   - Model: `gpt-4o`
   - API Key: `sk-...` (paste your key)
   - Note Understanding Provider: `OpenAI`
   - Model: `gpt-4o`
   - Embeddings Provider: `OpenAI`
   - Model: `text-embedding-3-large`
4. Go to **Web Search**
5. Set:
   - Provider: `Brave`
   - API Key: `BSA...` (paste your key)
6. Click **Save**

✅ **You're ready to use cloud AI!**

## 🎮 First Steps in Weave

### 1. Create Your First Note

1. Click **"+ New Page"** in the left sidebar
2. Type a title: "My First Note"
3. Press Enter

### 2. Add Content Blocks

Type `/` to open the command menu:

- **`/heading`** - Create a heading
- **`/text`** - Add a paragraph
- **`/database`** - Create a table
- **`/artifact`** - Generate interactive code
- **`/tasks`** - Create a task list

### 3. Generate an Artifact

1. Type `/artifact` and press Enter
2. Enter a prompt: "Create a colorful timer with start/stop buttons"
3. Click **"Generate with AI"**
4. Watch as AI generates live code!

### 4. Create a Database

1. Type `/database` and press Enter
2. Enter a prompt: "Create a table for tracking books with title, author, and rating"
3. Click **"Generate with AI"**
4. Switch between Table, Gallery, and Calendar views

### 5. Use AI Chat

1. Click the **AI Sidebar** (right side)
2. Type a question: "Help me organize my notes"
3. AI will suggest a structure and can create notes for you

### 6. Try Semantic Search

1. In the AI sidebar, type: "Find notes about machine learning"
2. AI will search by meaning, not just keywords

## 🔧 Configuration

### MCP Tools

Enable external tools in **AI Sidebar → MCP Tab**:

- **GitHub** - Read repos, issues, PRs
- **Filesystem** - Read/write local files
- **Web Search** - Search the web
- **Database** - Query external databases

Toggle the switches to enable/disable tools.

### Skills

Activate AI skills in **AI Sidebar → Skills Tab**:

- **Note Writer** - Expert note-taking
- **Code Generator** - Clean code generation
- **Data Analyzer** - Database analysis
- **UI Designer** - Beautiful interfaces
- **Researcher** - Web research

Click pills to activate/deactivate skills.

## 🎨 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + N` | New note |
| `/` | Open command menu |
| `Cmd/Ctrl + K` | Focus AI input |
| `Cmd/Ctrl + Enter` | Send AI message |
| `Cmd/Ctrl + B` | Bold text |
| `Cmd/Ctrl + I` | Italic text |
| `Esc` | Close modals/menus |

## 🐛 Troubleshooting

### App won't start

```bash
# Clean and reinstall
rm -rf node_modules
npm install

# Rebuild Tauri
cd src-tauri
cargo clean
cd ..
npm run tauri dev
```

### Database error

```bash
# Reset database
cd src-tauri
rm weave.db  # Caution: deletes all data
sqlx database create
sqlx migrate run
cd ..
```

### AI not working (Local)

1. Check model servers are running:
   ```bash
   curl http://localhost:8080/v1/models  # Should return model info
   curl http://localhost:8081/v1/models  # Should return model info
   ```

2. Check endpoints in Settings → AI Configuration

3. Check server logs for errors

### AI not working (API)

1. Verify API key is correct
2. Check you have credits (OpenAI billing)
3. Check internet connection

## 📚 Next Steps

- Read the [Implementation Plan](./IMPLEMENTATION_PLAN.md)
- Explore [Architecture Documentation](./docs/ARCHITECTURE.md)
- Check out [AI Systems Guide](./docs/AI_SYSTEMS.md)
- Review [Component Structure](./docs/UI_COMPONENTS.md)

## 🆘 Getting Help

- **Documentation**: Check `./docs/` folder
- **Issues**: GitHub Issues (coming soon)
- **Discord**: Community server (coming soon)
- **Email**: support@weave.app (coming soon)

## 🎉 You're All Set!

Start taking notes, generating artifacts, and exploring the power of AI-native note-taking!

---

**Happy note-taking! 📝✨**
