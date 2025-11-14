# Hybrid AI Setup Guide

## Overview

Weave uses a **hybrid AI architecture** that combines the best of both worlds:

- **Local Models** (embeddings, reranking) → Fast, private, cost-free
- **Cloud API** (ChatGPT/GPT-4o) → Powerful reasoning, tool use, code generation

This guide will help you set up both components.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         WEAVE AI                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐              ┌──────────────────┐    │
│  │  LOCAL MODELS    │              │   CLOUD API      │    │
│  │  (On your PC)    │              │   (Internet)     │    │
│  ├──────────────────┤              ├──────────────────┤    │
│  │                  │              │                  │    │
│  │  🔹 Embeddings   │              │  🔹 Chat Agent   │    │
│  │  Qwen3-0.6B      │              │  GPT-4o/GPT-5    │    │
│  │  (1024-dim)      │              │                  │    │
│  │                  │              │  🔹 Code Gen     │    │
│  │  🔹 Reranking    │              │  (Artifacts)     │    │
│  │  Optional        │              │                  │    │
│  │                  │              │  🔹 Note Editing │    │
│  │                  │              │                  │    │
│  │  🔹 FREE         │              │  🔹 Web Search   │    │
│  │  🔹 FAST         │              │                  │    │
│  │  🔹 PRIVATE      │              │  💰 Paid         │    │
│  └──────────────────┘              └──────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 1: Local Embedding Setup

### Why Local Embeddings?

- **Privacy**: Your note content never leaves your machine
- **Speed**: No network latency (~50ms vs 200ms+ for API)
- **Cost**: Free after initial setup
- **Always available**: Works offline

### Requirements

- **Disk Space**: ~500 MB for Qwen3-Embedding-0.6B model
- **RAM**: 2-4 GB during operation
- **CPU**: Any modern CPU (GPU optional for speed)

### Installation Steps

#### 1. Install llama.cpp

```bash
# Clone repository
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Build (CPU only)
make

# Or build with GPU support (NVIDIA)
make LLAMA_CUBLAS=1

# Or build with GPU support (AMD)
make LLAMA_HIPBLAS=1

# Or build with Metal (macOS)
make LLAMA_METAL=1
```

#### 2. Install Python Bindings

```bash
# Install Python bindings
pip install llama-cpp-python

# Or with GPU support (NVIDIA)
CMAKE_ARGS="-DLLAMA_CUBLAS=on" pip install llama-cpp-python

# Or with Metal (macOS)
CMAKE_ARGS="-DLLAMA_METAL=on" pip install llama-cpp-python
```

#### 3. Download Embedding Model

```bash
# Install Hugging Face CLI
pip install huggingface-hub

# Download Qwen3-Embedding-0.6B (recommended - fast & accurate)
huggingface-cli download \
  Qwen/Qwen3-Embedding-0.6B-GGUF \
  qwen3-embedding-0.6b-q8_0.gguf \
  --local-dir ./models

# Alternative: Smaller model for low-end hardware
huggingface-cli download \
  sentence-transformers/all-MiniLM-L6-v2-GGUF \
  all-MiniLM-L6-v2-q8_0.gguf \
  --local-dir ./models
```

#### 4. Start Embedding Server

Create a script `start-embedding-server.sh`:

```bash
#!/bin/bash

python -m llama_cpp.server \
  --model ./models/qwen3-embedding-0.6b-q8_0.gguf \
  --host 127.0.0.1 \
  --port 8081 \
  --embedding \
  --n_ctx 8192 \
  --n_gpu_layers 35  # Set to 0 for CPU-only

echo "Embedding server running on http://localhost:8081"
```

Run it:
```bash
chmod +x start-embedding-server.sh
./start-embedding-server.sh
```

#### 5. Verify Server

```bash
# Test the embedding endpoint
curl -X POST http://localhost:8081/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Hello, world!",
    "model": "qwen3-embedding-0.6b"
  }'

# Should return: {"data": [{"embedding": [0.123, -0.456, ...]}]}
```

---

## Part 2: OpenAI API Setup

### Why OpenAI API?

- **Powerful reasoning**: GPT-4o is state-of-the-art
- **Tool calling**: Function calling for MCP integration
- **Code quality**: Best for artifact generation
- **Reliability**: Production-grade API

### Cost Estimate

With GPT-4o (recommended):
- **Input**: $2.50 / 1M tokens
- **Output**: $10.00 / 1M tokens

Typical usage:
- Artifact generation: ~1,000 tokens → $0.01
- Chat message: ~500 tokens → $0.005
- Database generation: ~800 tokens → $0.008

**Monthly estimate**: $5-20 for moderate usage

Budget alternative: Use `gpt-4o-mini` ($0.15/$0.60 per 1M tokens)

### Setup Steps

#### 1. Get API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)
5. **Save it securely** - you won't see it again!

#### 2. Test API Key

```bash
# Test with curl
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Say hello!"}]
  }'
```

---

## Part 3: Configure Weave

### Option A: UI Configuration (Coming Soon)

A settings panel will be added to configure AI in the app.

### Option B: Initialize in Code (Current)

Add this to your `src/App.tsx` or create an initialization component:

```typescript
import { aiService } from '@/services/ai';
import { createDefaultAIConfig } from '@/types/ai';
import { useEffect, useState } from 'react';

function AIInitializer() {
  const [status, setStatus] = useState<'idle' | 'initializing' | 'ready' | 'error'>('idle');

  useEffect(() => {
    async function initAI() {
      setStatus('initializing');

      try {
        // Get API key from environment or prompt user
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY ||
                      prompt('Enter your OpenAI API key:');

        if (!apiKey) {
          setStatus('error');
          return;
        }

        // Create configuration
        const config = createDefaultAIConfig(apiKey);

        // Initialize AI system
        await aiService.initialize(config);

        // Health check
        const health = await aiService.healthCheck();

        if (!health.embedding_service) {
          console.warn('Embedding service unavailable. Semantic search will be disabled.');
        }

        if (!health.agent_service) {
          console.error('Agent service unavailable. Check API key.');
          setStatus('error');
          return;
        }

        setStatus('ready');
        console.log('AI system ready!');
      } catch (error) {
        console.error('AI initialization failed:', error);
        setStatus('error');
      }
    }

    initAI();
  }, []);

  return (
    <div style={{ padding: 10, background: '#1e1e1e', color: '#fff' }}>
      AI Status: {status}
      {status === 'error' && ' - Check console for errors'}
    </div>
  );
}

export default AIInitializer;
```

### Environment Variables

Create `.env` file:

```bash
# OpenAI API Key
VITE_OPENAI_API_KEY=sk-...

# Local embedding endpoint (optional, defaults to localhost:8081)
VITE_EMBEDDING_ENDPOINT=http://localhost:8081

# Model selections (optional)
VITE_AGENT_MODEL=gpt-4o
VITE_EMBEDDING_MODEL=qwen3-embedding-0.6b
```

---

## Part 4: Testing

### Test Embedding Generation

```typescript
import { aiService } from '@/services/ai';

async function testEmbeddings() {
  const text = "The quick brown fox jumps over the lazy dog";
  const embedding = await aiService.generateEmbedding(text);

  console.log('Embedding dimension:', embedding.length);
  console.log('First 5 values:', embedding.slice(0, 5));
}
```

### Test Artifact Generation

```typescript
import { aiService } from '@/services/ai';

async function testArtifact() {
  const prompt = "Create a simple counter with increment and decrement buttons";
  const result = await aiService.generateArtifact(prompt);

  console.log('Title:', result.title);
  console.log('HTML:', result.html);
  console.log('CSS:', result.css);
  console.log('JS:', result.javascript);
}
```

### Test Chat

```typescript
import { aiService } from '@/services/ai';

async function testChat() {
  const messages = [
    { role: 'user', content: 'What is 2+2?' }
  ];

  const response = await aiService.chat(messages);
  console.log('Response:', response);
}
```

---

## Troubleshooting

### Embedding Server Issues

**Problem**: Connection refused to localhost:8081

**Solutions**:
1. Check if server is running: `curl http://localhost:8081/health`
2. Check firewall settings
3. Try different port: `--port 8082`

**Problem**: Out of memory

**Solutions**:
1. Use smaller model: `all-MiniLM-L6-v2` (22M params vs 600M)
2. Reduce context length: `--n_ctx 2048`
3. Disable GPU layers: `--n_gpu_layers 0`

### OpenAI API Issues

**Problem**: 401 Unauthorized

**Solutions**:
1. Check API key is correct
2. Ensure no extra spaces in key
3. Verify key hasn't expired

**Problem**: 429 Rate limit exceeded

**Solutions**:
1. Wait a few seconds between requests
2. Upgrade to paid tier on OpenAI
3. Use `gpt-4o-mini` for cheaper alternative

**Problem**: 500 Server error

**Solutions**:
1. Check OpenAI status: https://status.openai.com/
2. Retry with exponential backoff
3. Try alternative model

---

## Performance Optimization

### Embedding Caching

Embeddings are expensive to compute. Cache them:

```rust
// In src-tauri/src/ai/embedding.rs
use moka::future::Cache;

let cache = Cache::builder()
    .max_capacity(10_000)
    .time_to_live(Duration::from_secs(3600))
    .build();
```

### Batch Embedding Generation

Process multiple texts at once:

```typescript
const texts = ['text1', 'text2', 'text3'];
const embeddings = await aiService.generateEmbeddingsBatch(texts);
```

### GPU Acceleration

For embedding server:
```bash
# Use all available GPU layers
--n_gpu_layers 35

# Monitor GPU usage
nvidia-smi -l 1
```

---

## Cost Optimization

### Use gpt-4o-mini for Development

```typescript
const config = {
  embeddings: { /* local config */ },
  agent: {
    provider: 'openai',
    model: 'gpt-4o-mini', // 93% cheaper than gpt-4o
    api_key: apiKey,
    temperature: 0.7,
    max_tokens: 4096,
  },
};
```

### Reduce max_tokens

```typescript
const config = {
  agent: {
    // ...
    max_tokens: 1024, // Instead of 4096
  },
};
```

### Local-Only Mode (Coming Soon)

For 100% free operation, use local models for everything:
- Embeddings: Qwen3-Embedding-0.6B
- Agent: Qwen3-Coder-30B (requires powerful PC)
- Code Gen: DeepSeek-Coder-33B

---

## Next Steps

1. ✅ Set up local embedding server
2. ✅ Get OpenAI API key
3. ✅ Configure Weave
4. ✅ Test all features
5. 🔄 Build semantic search UI
6. 🔄 Add AI chat interface
7. 🔄 Implement MCP tools
8. 🔄 Add skills system

---

## Additional Resources

- [OpenAI API Docs](https://platform.openai.com/docs)
- [llama.cpp GitHub](https://github.com/ggerganov/llama.cpp)
- [Qwen3 Model Card](https://huggingface.co/Qwen)
- [Weave AI Systems Docs](./AI_SYSTEMS.md)
- [MCP & Skills Guide](./MCP_SKILLS.md)

---

## FAQ

**Q: Can I use only local models?**
A: Yes! Replace OpenAI with Qwen3-Coder-30B running locally. See `docs/AI_SYSTEMS.md`.

**Q: Can I use Anthropic Claude instead of OpenAI?**
A: Yes! Change provider to `'anthropic'` and use `claude-sonnet-4` or `claude-opus-4`.

**Q: How much disk space do I need?**
A: ~500 MB for embedding model, ~20 GB for full local code generation model.

**Q: Does this work offline?**
A: Embeddings work offline. Agent/code generation requires internet (unless using local LLM).

**Q: How do I update models?**
A: Download new GGUF files and update the `--model` path in startup script.

**Q: Can I run on a laptop?**
A: Yes! Embedding model runs fine on any modern laptop. For GPUs, ensure you have 4GB+ VRAM.
