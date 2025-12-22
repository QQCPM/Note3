# Note3 AI Architecture

## Unified Configuration

All AI modes use the same unified configuration:

| Component | Model | Provider |
|-----------|-------|----------|
| **Agent** | GPT-5.2 | OpenAI API |
| **Code Generation** | MiniMax-M2 | Ollama (cloud) - #1 open-source for coding |
| **Embeddings** | text-embedding-3-large | OpenAI API (3072 dimensions) |
| **Reranker** | Qwen3-Reranker-4B | Ollama (local) |

## Setup

### 1. Install Ollama

```bash
brew install ollama
```

### 2. Pull Required Models

```bash
# Reranker model
ollama pull dengcao/Qwen3-Reranker-4B

# Code generation model (ranked #1 open-source for coding)
ollama pull minimax-m2:cloud
```

### 3. Start the AI Services

```bash
./start-ai.sh
```

### 4. Run the App

```bash
npm run tauri:dev
```

## Services

| Service | Endpoint | Purpose |
|---------|----------|---------|
| Ollama | localhost:11434 | Local reranker |
| OpenAI | api.openai.com | Embeddings + Chat |

## API Keys Required

| Service | Purpose | Get Key |
|---------|---------|---------|
| OpenAI | Embeddings + Generation | [platform.openai.com](https://platform.openai.com/api-keys) |

## Cost Estimate

| Operation | Cost |
|-----------|------|
| Embedding (text-embedding-3-large) | $0.13/1M tokens |
| Chat (GPT-5.2) | ~$8-30/1M tokens |
| Reranking | FREE (local) |

## Search Pipeline

```
1. Query → OpenAI embedding (text-embedding-3-large)
2. Cosine similarity against stored embeddings → Top 50
3. Qwen3-Reranker-4B (local) → Top 5 chunks
4. GPT-5.2 generates response
```
