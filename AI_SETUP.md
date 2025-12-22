# AI System Setup Guide

## 🔧 Current Issue: "Can't Start AI Local Models"

**Problem**: GLM-4.6 is a **cloud model** that requires an Ollama API key.

## Why This Happens

The system is configured to use:
1. **Local Model** (Ollama): Qwen3-Reranker-4B ✅ Running
2. **Cloud Model** (Ollama Cloud): GLM-4.6 ❌ Needs API Key

## Solution

### Step 1: Enter Your Ollama API Key

1. Open the app: `http://localhost:1420/`
2. Click **Settings** tab (⚙️)
3. Scroll to **Ollama API Key** field
4. Get your API key from [Ollama API Keys](https://ollama.com/settings/keys)
5. Enter your OpenAI API Key
6. Click **Save Configuration**

### Step 2: Verify Service Health

Click **Check All Services** button. You should see:

- ✅ **Reranker (Local)**: Qwen3-Reranker-4B via Ollama localhost
- ✅ **Code Gen (Cloud)**: GLM-4.6 via Ollama Cloud API
- ✅ **Agent**: GPT-5.2 via OpenAI
- ✅ **Embeddings**: text-embedding-3-large via OpenAI

## What Each Service Does

| Service | Model | Where It Runs | Used For |
|---------|-------|---------------|----------|
| **Reranker** | Qwen3-Reranker-4B | Local Ollama | Improving search results |
| **Code Gen** | GLM-4.6 | Ollama Cloud | Generating code & artifacts |
| **Agent** | GPT-5.2 | OpenAI API | Chat & reasoning |
| **Embeddings** | text-embedding-3-large | OpenAI API | Semantic search |

## Troubleshooting

### "Code Gen (Local)" shows ❌

**This is expected!** GLM-4.6 is a cloud model, not local.

**Fix**: Enter your Ollama API key in Settings.

### "Reranker shows ❌

**Check**: Is Ollama running?

```bash
# Check status
curl http://localhost:11434/api/tags

# If not running, start it:
./start-ai.sh
```

### "Need Ollama API Key?"

For GLM-4.6 cloud model, get your API key from:
1. Go to [Ollama Settings](https://ollama.com/settings/keys)
2. Sign in with your Ollama account
3. Create a new API key and copy it

## API Keys Location

Your keys are stored securely in:
- **macOS**: `~/Library/Application Support/com.note.note/ai_config.json`
- **Linux**: `~/.config/note/ai_config.json`
- **Windows**: `%APPDATA%\note\ai_config.json`

## Quick Commands

```bash
# Start Ollama (for local reranker)
./start-ai.sh

# Check Ollama status
ollama list

# Start the app
npm run tauri:dev
```

## Cost Breakdown

| Service | Cost | Notes |
|---------|------|-------|
| Reranker | **FREE** | Runs locally |
| Code Gen | **~$0.01/request** | Ollama Cloud GLM-4.6 |
| Agent | **~$0.50/1K msgs** | OpenAI GPT-5.2 |
| Embeddings | **~$0.13/1M tokens** | OpenAI text-embedding-3-large |

**Estimated monthly cost**: $10-30 for typical usage


