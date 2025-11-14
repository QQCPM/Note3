# Mac M2 Ultra Setup Guide - Full Local AI Stack

## Overview

This guide is specifically for running Weave on **Mac M2 Ultra with 128GB RAM** using:
- **Qwen3-30B-Coder** (code generation) - FP16
- **Qwen3-Embedding-8B** (semantic search) - FP16
- **Qwen3-Reranker-8B** (search reranking) - FP16
- **OpenAI API** (chat agent, web search)

**Total Memory Usage**: ~92GB (you have plenty of headroom!)

---

## Why This Setup is Perfect

✅ **128GB RAM**: Can run all 3 models simultaneously in FP16
✅ **Metal GPU**: M2 Ultra has 76-core GPU for incredible speed
✅ **Unified Memory**: CPU and GPU share the same 128GB pool
✅ **FP16 Precision**: Maximum quality (better than quantized)
✅ **100% Privacy**: Code/embeddings never leave your Mac
✅ **Low Cost**: Only pay for OpenAI chat API (~$5-10/month)

---

## Memory Breakdown

| Model | Precision | Memory | Purpose |
|-------|-----------|--------|---------|
| Qwen3-30B-Coder | FP16 | ~60GB | Artifact generation |
| Qwen3-Embedding-8B | FP16 | ~16GB | Note embeddings |
| Qwen3-Reranker-8B | FP16 | ~16GB | Search reranking |
| **Total** | | **~92GB** | **Within 128GB!** |

---

## Step 1: Install llama.cpp with Metal

### 1.1 Install Xcode Command Line Tools

```bash
# Install Xcode tools (if not already installed)
xcode-select --install

# Verify
xcode-select -p
# Should show: /Applications/Xcode.app/Contents/Developer
```

### 1.2 Install Homebrew (if needed)

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Add to PATH
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc
```

### 1.3 Clone and Build llama.cpp

```bash
# Create directory for AI models
mkdir -p ~/AI
cd ~/AI

# Clone llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Build with Metal support (M2 Ultra optimized)
make clean
LLAMA_METAL=1 make -j

# Verify Metal support
./llama-cli --help | grep -i metal
# Should show Metal-related options
```

### 1.4 Install Python Bindings with Metal

```bash
# Install Python 3.11+ (recommended)
brew install python@3.11

# Create virtual environment
python3.11 -m venv ~/AI/venv
source ~/AI/venv/bin/activate

# Install llama-cpp-python with Metal
CMAKE_ARGS="-DLLAMA_METAL=on" pip install llama-cpp-python

# Verify installation
python -c "from llama_cpp import Llama; print('✅ llama-cpp-python installed')"
```

---

## Step 2: Download Models

### 2.1 Install Hugging Face CLI

```bash
# Activate venv
source ~/AI/venv/bin/activate

# Install Hugging Face Hub
pip install huggingface-hub

# Login (optional, for faster downloads)
huggingface-cli login
```

### 2.2 Download Qwen3-30B-Coder (FP16)

```bash
# Create models directory
mkdir -p ~/AI/models

# Download Qwen3-30B-Coder GGUF (FP16)
huggingface-cli download \
  Qwen/Qwen3-Coder-30B-Instruct-GGUF \
  qwen3-coder-30b-instruct-f16.gguf \
  --local-dir ~/AI/models/qwen3-coder-30b

# Or download Q8_0 if you want to save memory (~30GB instead of 60GB)
huggingface-cli download \
  Qwen/Qwen3-Coder-30B-Instruct-GGUF \
  qwen3-coder-30b-instruct-q8_0.gguf \
  --local-dir ~/AI/models/qwen3-coder-30b
```

**Note**: If FP16 GGUF doesn't exist, download the original and convert:

```bash
# Download original model
huggingface-cli download \
  Qwen/Qwen3-Coder-30B-Instruct \
  --local-dir ~/AI/models/qwen3-coder-30b-original

# Convert to GGUF FP16
cd ~/AI/llama.cpp
python convert_hf_to_gguf.py \
  ~/AI/models/qwen3-coder-30b-original \
  --outfile ~/AI/models/qwen3-coder-30b/qwen3-coder-30b-f16.gguf \
  --outtype f16
```

### 2.3 Download Qwen3-Embedding-8B (FP16)

```bash
# Download Qwen3-Embedding-8B GGUF
huggingface-cli download \
  Qwen/Qwen3-Embedding-8B-GGUF \
  qwen3-embedding-8b-f16.gguf \
  --local-dir ~/AI/models/qwen3-embedding-8b

# If GGUF doesn't exist, download and convert
huggingface-cli download \
  Qwen/Qwen3-Embedding-8B \
  --local-dir ~/AI/models/qwen3-embedding-8b-original

cd ~/AI/llama.cpp
python convert_hf_to_gguf.py \
  ~/AI/models/qwen3-embedding-8b-original \
  --outfile ~/AI/models/qwen3-embedding-8b/qwen3-embedding-8b-f16.gguf \
  --outtype f16
```

### 2.4 Download Qwen3-Reranker-8B (FP16)

```bash
# Download Qwen3-Reranker-8B GGUF
huggingface-cli download \
  Qwen/Qwen3-Reranker-8B-GGUF \
  qwen3-reranker-8b-f16.gguf \
  --local-dir ~/AI/models/qwen3-reranker-8b

# If GGUF doesn't exist, download and convert
huggingface-cli download \
  Qwen/Qwen3-Reranker-8B \
  --local-dir ~/AI/models/qwen3-reranker-8b-original

cd ~/AI/llama.cpp
python convert_hf_to_gguf.py \
  ~/AI/models/qwen3-reranker-8b-original \
  --outfile ~/AI/models/qwen3-reranker-8b/qwen3-reranker-8b-f16.gguf \
  --outtype f16
```

---

## Step 3: Create Startup Scripts

### 3.1 Code Generation Server (Port 8080)

Create `~/AI/scripts/start-coder.sh`:

```bash
#!/bin/bash

# Activate virtual environment
source ~/AI/venv/bin/activate

# Start Qwen3-30B-Coder server
python -m llama_cpp.server \
  --model ~/AI/models/qwen3-coder-30b/qwen3-coder-30b-f16.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  --n_ctx 32768 \
  --n_gpu_layers -1 \
  --n_threads 8 \
  --verbose \
  2>&1 | tee ~/AI/logs/coder.log

# Flags explained:
# --n_ctx 32768      : Context length (Qwen3 supports up to 32k)
# --n_gpu_layers -1  : Use all GPU layers (Metal will handle)
# --n_threads 8      : CPU threads for offloading
# --verbose          : Show detailed logs
```

Make executable:
```bash
chmod +x ~/AI/scripts/start-coder.sh
```

### 3.2 Embedding Server (Port 8081)

Create `~/AI/scripts/start-embedding.sh`:

```bash
#!/bin/bash

# Activate virtual environment
source ~/AI/venv/bin/activate

# Start Qwen3-Embedding-8B server
python -m llama_cpp.server \
  --model ~/AI/models/qwen3-embedding-8b/qwen3-embedding-8b-f16.gguf \
  --host 127.0.0.1 \
  --port 8081 \
  --embedding \
  --n_ctx 8192 \
  --n_gpu_layers -1 \
  --n_threads 4 \
  --verbose \
  2>&1 | tee ~/AI/logs/embedding.log
```

Make executable:
```bash
chmod +x ~/AI/scripts/start-embedding.sh
```

### 3.3 Reranker Server (Port 8082)

Create `~/AI/scripts/start-reranker.sh`:

```bash
#!/bin/bash

# Activate virtual environment
source ~/AI/venv/bin/activate

# Start Qwen3-Reranker-8B server
python -m llama_cpp.server \
  --model ~/AI/models/qwen3-reranker-8b/qwen3-reranker-8b-f16.gguf \
  --host 127.0.0.1 \
  --port 8082 \
  --embedding \
  --n_ctx 8192 \
  --n_gpu_layers -1 \
  --n_threads 4 \
  --verbose \
  2>&1 | tee ~/AI/logs/reranker.log
```

Make executable:
```bash
chmod +x ~/AI/scripts/start-reranker.sh
```

### 3.4 Master Startup Script

Create `~/AI/scripts/start-all.sh`:

```bash
#!/bin/bash

echo "🚀 Starting Weave AI Stack (Mac M2 Ultra)"
echo "=========================================="

# Create logs directory
mkdir -p ~/AI/logs

# Start each server in background
echo "📦 Starting Code Generation (Qwen3-30B-Coder) on port 8080..."
~/AI/scripts/start-coder.sh &
CODER_PID=$!

echo "🔍 Starting Embeddings (Qwen3-Embedding-8B) on port 8081..."
~/AI/scripts/start-embedding.sh &
EMBED_PID=$!

echo "⚡ Starting Reranker (Qwen3-Reranker-8B) on port 8082..."
~/AI/scripts/start-reranker.sh &
RERANK_PID=$!

echo ""
echo "✅ All servers starting..."
echo "   - Coder:     http://localhost:8080 (PID: $CODER_PID)"
echo "   - Embedding: http://localhost:8081 (PID: $EMBED_PID)"
echo "   - Reranker:  http://localhost:8082 (PID: $RERANK_PID)"
echo ""
echo "📊 Memory usage: ~92GB / 128GB"
echo "🛑 To stop: pkill -f 'llama_cpp.server'"
echo ""
echo "Logs: ~/AI/logs/"
```

Make executable:
```bash
chmod +x ~/AI/scripts/start-all.sh
```

### 3.5 Create Logs Directory

```bash
mkdir -p ~/AI/logs
mkdir -p ~/AI/scripts
```

---

## Step 4: Test Each Server

### 4.1 Start All Servers

```bash
# Start everything
~/AI/scripts/start-all.sh

# Wait 30-60 seconds for models to load
# Monitor Activity Monitor to see memory usage
```

### 4.2 Test Code Generation Server

```bash
# Test completion endpoint
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-coder-30b",
    "messages": [
      {"role": "system", "content": "You are a coding assistant."},
      {"role": "user", "content": "Write a Python function to calculate fibonacci"}
    ],
    "max_tokens": 500,
    "temperature": 0.7
  }'

# Should return code!
```

### 4.3 Test Embedding Server

```bash
# Test embedding generation
curl -X POST http://localhost:8081/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "input": "The quick brown fox jumps over the lazy dog",
    "model": "qwen3-embedding-8b"
  }'

# Should return vector: {"data": [{"embedding": [0.123, -0.456, ...]}]}
```

### 4.4 Test Reranker Server

```bash
# Test reranking
curl -X POST http://localhost:8082/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Query: machine learning\nDocument: AI and neural networks",
    "model": "qwen3-reranker-8b"
  }'

# Should return relevance score
```

---

## Step 5: Update Weave Backend for Local Models

### 5.1 Create Local Model Service

Create `src-tauri/src/ai/local.rs`:

```rust
use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModelConfig {
    pub endpoint: String,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<Message>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: MessageResponse,
}

#[derive(Debug, Deserialize)]
struct MessageResponse {
    content: String,
}

pub struct LocalModelService {
    client: Client,
    config: LocalModelConfig,
}

impl LocalModelService {
    pub fn new(config: LocalModelConfig) -> Self {
        Self {
            client: Client::new(),
            config,
        }
    }

    /// Generate artifact using local Qwen3-30B-Coder
    pub async fn generate_artifact(&self, user_prompt: &str) -> Result<ArtifactResult, String> {
        let system_prompt = r#"You are an expert frontend developer. Generate clean, modern HTML/CSS/JavaScript code.

Return ONLY valid JSON with this structure:
{
  "title": "Brief title",
  "html": "Complete HTML",
  "css": "Complete CSS",
  "javascript": "Complete JavaScript"
}

No explanations, just the JSON."#;

        let messages = vec![
            Message {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            Message {
                role: "user".to_string(),
                content: user_prompt.to_string(),
            },
        ];

        let response = self.chat(messages).await?;

        // Parse JSON response
        let artifact: ArtifactResult = serde_json::from_str(&response)
            .map_err(|e| format!("Failed to parse artifact JSON: {}", e))?;

        Ok(artifact)
    }

    /// Chat with local model
    pub async fn chat(&self, messages: Vec<Message>) -> Result<String, String> {
        let url = format!("{}/v1/chat/completions", self.config.endpoint);

        let request = ChatCompletionRequest {
            model: self.config.model.clone(),
            messages,
            max_tokens: self.config.max_tokens,
            temperature: self.config.temperature,
        };

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("API error {}: {}", status, error_text));
        }

        let completion: ChatCompletionResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let content = completion.choices
            .first()
            .ok_or("No choices in response")?
            .message
            .content
            .clone();

        Ok(content)
    }

    /// Health check
    pub async fn health_check(&self) -> Result<(), String> {
        let url = format!("{}/health", self.config.endpoint);

        self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Health check failed: {}", e))?;

        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArtifactResult {
    pub title: String,
    pub html: String,
    pub css: String,
    pub javascript: String,
}
```

### 5.2 Update AI Module

Update `src-tauri/src/ai/mod.rs`:

```rust
pub mod embedding;
pub mod openai;
pub mod local;  // NEW

pub use embedding::{EmbeddingConfig, LocalEmbeddingService};
pub use openai::{OpenAIConfig, OpenAIService, Message, Tool, ToolCall, ArtifactResult, DatabaseResult};
pub use local::{LocalModelConfig, LocalModelService};  // NEW

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    // Local models
    pub embeddings: EmbeddingConfig,
    pub reranker: Option<EmbeddingConfig>,
    pub code_generation: Option<LocalModelConfig>,  // NEW: Local Qwen3-30B

    // Cloud API
    pub agent: OpenAIConfig,
}

impl AIConfig {
    pub fn mac_m2_ultra_default(openai_key: String) -> Self {
        Self {
            embeddings: EmbeddingConfig {
                endpoint: "http://localhost:8081".to_string(),
                model: "qwen3-embedding-8b".to_string(),
                dimension: 8192,  // Qwen3-8B dimension
            },
            reranker: Some(EmbeddingConfig {
                endpoint: "http://localhost:8082".to_string(),
                model: "qwen3-reranker-8b".to_string(),
                dimension: 8192,
            }),
            code_generation: Some(LocalModelConfig {
                endpoint: "http://localhost:8080".to_string(),
                model: "qwen3-coder-30b".to_string(),
                max_tokens: 4096,
                temperature: 0.7,
            }),
            agent: OpenAIConfig {
                api_key: openai_key,
                model: "gpt-4o".to_string(),
                temperature: 0.7,
                max_tokens: Some(4096),
            },
        }
    }
}

pub struct AIManager {
    pub config: AIConfig,
    pub embedding_service: LocalEmbeddingService,
    pub reranker_service: Option<LocalEmbeddingService>,
    pub code_service: Option<LocalModelService>,  // NEW
    pub agent_service: OpenAIService,
}

impl AIManager {
    pub fn new(config: AIConfig) -> Self {
        let embedding_service = LocalEmbeddingService::new(config.embeddings.clone());

        let reranker_service = config.reranker.as_ref()
            .map(|cfg| LocalEmbeddingService::new(cfg.clone()));

        let code_service = config.code_generation.as_ref()
            .map(|cfg| LocalModelService::new(cfg.clone()));

        let agent_service = OpenAIService::new(config.agent.clone());

        Self {
            config,
            embedding_service,
            reranker_service,
            code_service,
            agent_service,
        }
    }

    /// Health check
    pub async fn health_check(&self) -> Result<HealthStatus, String> {
        let embedding_ok = self.embedding_service.health_check().await.is_ok();

        let reranker_ok = if let Some(ref service) = self.reranker_service {
            service.health_check().await.is_ok()
        } else {
            false
        };

        let code_gen_ok = if let Some(ref service) = self.code_service {
            service.health_check().await.is_ok()
        } else {
            false
        };

        Ok(HealthStatus {
            embedding_service: embedding_ok,
            reranker_service: reranker_ok,
            code_generation_service: code_gen_ok,
            agent_service: true,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthStatus {
    pub embedding_service: bool,
    pub reranker_service: bool,
    pub code_generation_service: bool,
    pub agent_service: bool,
}
```

### 5.3 Update Commands

Update `src-tauri/src/commands/ai.rs` to add:

```rust
/// Generate artifact using LOCAL Qwen3-30B-Coder
#[tauri::command]
pub async fn ai_generate_artifact_local(
    prompt: String,
    state: State<'_, AIState>,
) -> Result<crate::ai::local::ArtifactResult, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    if let Some(ref service) = manager.code_service {
        service.generate_artifact(&prompt).await
    } else {
        Err("Local code generation not configured".to_string())
    }
}

/// Rerank search results
#[tauri::command]
pub async fn ai_rerank(
    query: String,
    documents: Vec<String>,
    state: State<'_, AIState>,
) -> Result<Vec<f32>, String> {
    let manager_lock = state.manager.read().await;

    let manager = manager_lock
        .as_ref()
        .ok_or("AI not initialized")?;

    if let Some(ref service) = manager.reranker_service {
        // Generate embeddings for query + each document
        let mut scores = Vec::new();

        for doc in documents {
            let combined = format!("Query: {}\nDocument: {}", query, doc);
            let embedding = service.generate(&combined).await?;

            // Use first value as relevance score (reranker models output this way)
            scores.push(embedding[0]);
        }

        Ok(scores)
    } else {
        Err("Reranker not configured".to_string())
    }
}
```

Add to `main.rs` invoke_handler:
```rust
ai_generate_artifact_local,
ai_rerank,
```

---

## Step 6: Configure Frontend

### 6.1 Update TypeScript Types

Update `src/types/ai.ts`:

```typescript
export interface AIConfig {
  // Local models
  embeddings: LocalModelConfig;
  reranker?: LocalModelConfig;
  code_generation?: LocalModelConfig;  // NEW

  // Cloud API
  agent: APIModelConfig;
}

export function createMacM2UltraConfig(openaiApiKey: string): AIConfig {
  return {
    embeddings: {
      provider: 'local',
      model: 'qwen3-embedding-8b',
      endpoint: 'http://localhost:8081',
      dimension: 8192,
    },
    reranker: {
      provider: 'local',
      model: 'qwen3-reranker-8b',
      endpoint: 'http://localhost:8082',
      dimension: 8192,
    },
    code_generation: {
      provider: 'local',
      model: 'qwen3-coder-30b',
      endpoint: 'http://localhost:8080',
      dimension: 0,  // Not applicable
    },
    agent: {
      provider: 'openai',
      model: 'gpt-4o',
      api_key: openaiApiKey,
      temperature: 0.7,
      max_tokens: 4096,
    },
  };
}
```

### 6.2 Update AI Service

Update `src/services/ai.ts`:

```typescript
/**
 * Generate artifact using LOCAL Qwen3-30B-Coder
 * Falls back to OpenAI if local model not available
 */
async generateArtifact(prompt: string): Promise<ArtifactResult> {
  if (!this.initialized) {
    throw new Error('AI not initialized. Call initialize() first.');
  }

  try {
    // Try local first
    return await invoke<ArtifactResult>('ai_generate_artifact_local', { prompt });
  } catch (error) {
    console.warn('Local code generation failed, falling back to OpenAI:', error);

    // Fallback to OpenAI
    return await invoke<ArtifactResult>('ai_generate_artifact', { prompt });
  }
}

/**
 * Rerank search results using local Qwen3-Reranker-8B
 */
async rerank(query: string, documents: string[]): Promise<number[]> {
  if (!this.initialized) {
    throw new Error('AI not initialized. Call initialize() first.');
  }

  try {
    return await invoke<number[]>('ai_rerank', { query, documents });
  } catch (error) {
    console.error('Failed to rerank:', error);
    throw error;
  }
}
```

---

## Step 7: Performance Optimization

### 7.1 Monitor GPU Usage

```bash
# Install Metal developer tools
sudo xcode-select --install

# Monitor GPU in Activity Monitor
# Look for "GPU History" tab
# Should see all 76 cores in use!
```

### 7.2 Optimize Context Length

For faster inference, reduce context if you don't need it:

```bash
# In startup scripts, change:
--n_ctx 32768  # to
--n_ctx 8192   # if you only need 8k context
```

### 7.3 Enable Flash Attention (if supported)

```bash
# In startup scripts, add:
--flash-attn
```

### 7.4 Batch Size Tuning

```bash
# For embedding server, increase batch size:
--n_batch 512  # Process more tokens at once
```

---

## Step 8: Create LaunchAgent for Auto-Start

Create `~/Library/LaunchAgents/com.weave.ai.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.weave.ai</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>~/AI/scripts/start-all.sh</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>~/AI/logs/launchd.out</string>

    <key>StandardErrorPath</key>
    <string>~/AI/logs/launchd.err</string>
</dict>
</plist>
```

Load it:
```bash
launchctl load ~/Library/LaunchAgents/com.weave.ai.plist

# Unload:
# launchctl unload ~/Library/LaunchAgents/com.weave.ai.plist
```

---

## Troubleshooting

### Issue: "Metal not supported"

**Solution**:
```bash
# Rebuild llama.cpp
cd ~/AI/llama.cpp
make clean
LLAMA_METAL=1 make -j

# Verify
./llama-cli --help | grep -i metal
```

### Issue: "Out of memory"

**Solution**: You shouldn't hit this with 128GB, but if you do:
- Reduce context length: `--n_ctx 8192`
- Use Q8_0 quantization instead of FP16 (saves 50% memory)
- Close other apps

### Issue: "Model loading very slow"

**Solution**:
- Ensure models are on fast SSD (not external drive)
- First load takes longest (model caching)
- Subsequent loads faster

### Issue: "Server crashes"

**Solution**:
```bash
# Check logs
tail -f ~/AI/logs/*.log

# Restart individual server
pkill -f 'llama_cpp.server.*8080'
~/AI/scripts/start-coder.sh
```

---

## Performance Benchmarks

Expected performance on M2 Ultra (128GB):

| Task | Model | Tokens/sec | Latency |
|------|-------|------------|---------|
| Code Generation | Qwen3-30B FP16 | ~30-40 | ~3-5s for 500 tokens |
| Embedding | Qwen3-8B FP16 | ~100-150 | ~50ms per text |
| Reranking | Qwen3-8B FP16 | ~100-150 | ~50ms per pair |

---

## Cost Analysis

### Setup Costs
- **Hardware**: Already have M2 Ultra! ✅
- **Models**: FREE (download from HuggingFace)
- **Software**: FREE (open source)

### Ongoing Costs
- **Electricity**: ~$5-10/month (running 24/7)
- **OpenAI API**: ~$5-20/month (chat only)
- **Total**: ~$10-30/month

### Comparison to Cloud-Only
- **Cloud embeddings**: $0.13 per 1M tokens
- **Cloud code gen**: $2.50-10 per 1M tokens
- **Your savings**: ~$50-100/month!

---

## Next Steps

1. ✅ Install llama.cpp with Metal
2. ✅ Download all 3 models
3. ✅ Start servers and test
4. ✅ Configure Weave backend
5. ✅ Update frontend
6. 🔄 Build and test end-to-end
7. 🔄 Benchmark performance
8. 🔄 Set up auto-start

---

## Summary

Your Mac M2 Ultra setup is **perfect** for running the full local AI stack:

✅ **Privacy**: All code/embeddings stay on your Mac
✅ **Speed**: Metal acceleration = 10x faster than CPU
✅ **Quality**: FP16 = maximum precision
✅ **Cost**: Only pay for OpenAI chat (~$10/month)
✅ **Capacity**: 92GB / 128GB = plenty of headroom

This is a **production-grade** setup that rivals cloud services!
