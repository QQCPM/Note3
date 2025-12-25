# AI Guide

Complete guide for configuring and troubleshooting AI features in Weave.

## Current Model Configuration

| Service | Model | Provider | Purpose |
|---------|-------|----------|---------|
| **Agent** | GPT-5.2 | OpenAI API | Chat & reasoning |
| **Code Gen** | GLM-4.6 | Ollama Cloud | Code generation |
| **Embeddings** | text-embedding-3-large | OpenAI API | Semantic search |
| **Reranker** | Qwen3-Reranker-4B | Ollama (local) | Improving search results |
| **Slides** | Gemini 3 Pro | Google AI API | Educational slide generation |

## Quick Setup

### 1. Start Local Services

```bash
./start-ai.sh
```

This will:
- Start Ollama service
- Pull Qwen3-Reranker-4B model if not present

### 2. Configure API Keys

Create a `.env` file in the project root:

```bash
VITE_OPENAI_API_KEY=sk-your-openai-key
VITE_OLLAMA_API_KEY=your-ollama-key     # For GLM-4.6 code generation
VITE_GEMINI_API_KEY=AIza-your-gemini-key  # For slide generation
```

**Important:**
- Keys must start with `VITE_` to be accessible in the frontend
- No spaces around `=`, no quotes around values
- Restart dev server after changing `.env`

### 3. Run the App

```bash
npm run tauri:dev
```

## API Keys

| Service | Get Key From |
|---------|-------------|
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) |
| Ollama | [ollama.com/settings/keys](https://ollama.com/settings/keys) |
| Google AI | [ai.google.dev](https://ai.google.dev/) |

## Educational Slides (Gemini 3 Pro)

Generate detailed educational slides from any note:

1. Open any note with content
2. Go to **Recommendations** tab in AI sidebar
3. Click **"Educational Slides"** card
4. Click **Generate** button

Features:
- 8-14 slides per topic
- Professional diagrams and visuals
- Mathematical notation support
- 2K resolution output

## Troubleshooting

### "AI not initialized"

1. Check browser console (F12) for errors
2. Verify API keys are in `.env` with correct format
3. Restart dev server: `npm run tauri:dev`

### "Code Gen shows ❌"

GLM-4.6 requires an Ollama API key. Enter it in Settings or `.env`.

### "Reranker shows ❌"

Check if Ollama is running:
```bash
curl http://localhost:11434/api/tags
```

If not running, start it:
```bash
./start-ai.sh
```

### Clear Cache

```bash
rm -rf node_modules/.vite
npm run tauri:dev
```

### Test API Key

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_KEY"
```

## Cost Estimate

| Service | Cost |
|---------|------|
| Embeddings | ~$0.13/1M tokens |
| Agent (GPT-5.2) | ~$8-30/1M tokens |
| Code Gen (GLM-4.6) | ~$0.01/request |
| Slides (Gemini) | ~$0.04/image |
| Reranker | FREE (local) |

**Estimated monthly cost**: $10-30 for typical usage

## Search Pipeline

```
Query → OpenAI embedding → Cosine similarity (Top 50) → Qwen3 rerank (Top 5) → GPT-5.2 response
```

## Secretary Memory System

The app uses 3 markdown files for AI-driven planning:

- `AI.md` - Learning profile and preferences
- `Project.md` - Project context and milestones
- `Daily.md` - Today's plan and tasks

Files are stored in:
- **macOS**: `~/Library/Application Support/com.note3.app/memory/`
