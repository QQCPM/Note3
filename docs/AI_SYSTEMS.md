# AI Systems Configuration

## Overview
Weave uses multiple AI models for different tasks. All models are **configurable** and can be swapped or run locally/remotely.

## Model Architecture

### 1. Code Generation (Artifacts)

**Primary Model**: Qwen3-Coder-30B (Local)

**Purpose**: Generate HTML/CSS/JavaScript artifacts from natural language

**Configuration**:
```typescript
interface CodeGenerationConfig {
  provider: 'local' | 'openai' | 'anthropic';
  model: string; // e.g., 'qwen3-coder-30b'
  endpoint: string; // e.g., 'http://localhost:8080'
  context_length: number; // 128000
  temperature: number; // 0.7
  system_prompt: string;
}
```

**System Prompt**:
```
You are an expert frontend developer. Generate clean, modern HTML/CSS/JavaScript
code based on user descriptions. Always include:
1. Semantic HTML5 structure
2. Inline CSS with modern styling
3. Vanilla JavaScript (no external dependencies)
4. Responsive design
5. Accessibility features

Output ONLY the complete HTML document, no explanations.
```

**Implementation**:
- Run locally via llama.cpp server
- Stream responses to frontend
- Cache generated artifacts

### 2. Note Understanding & Editing

**Primary Model**: GPT-4o (API) OR DeepSeek-R1 (Local)

**Purpose**:
- Semantic search
- Note summarization
- Intelligent editing (like Cursor IDE)
- Database schema generation
- Database query generation

**Configuration**:
```typescript
interface NoteAIConfig {
  provider: 'openai' | 'anthropic' | 'local';
  model: string; // e.g., 'gpt-4o', 'deepseek-r1'
  api_key?: string; // For API providers
  endpoint?: string; // For local models
  temperature: number; // 0.3-0.7 (task-dependent)
  max_tokens: number;
  tools: Tool[]; // Function calling tools
}
```

**Available Tools**:
```typescript
const tools = [
  {
    name: "read_note",
    description: "Read the content of a note by ID",
    parameters: {
      note_id: "string"
    }
  },
  {
    name: "edit_note",
    description: "Edit note content with specific changes",
    parameters: {
      note_id: "string",
      changes: "array" // [{ type, position, text }]
    }
  },
  {
    name: "search_notes",
    description: "Search notes semantically",
    parameters: {
      query: "string",
      limit: "number"
    }
  },
  {
    name: "create_database",
    description: "Create a database block from natural language",
    parameters: {
      schema: "object" // { columns, initial_data }
    }
  },
  {
    name: "query_database",
    description: "Query a database block with natural language",
    parameters: {
      block_id: "string",
      query: "string"
    }
  },
  {
    name: "search_web",
    description: "Search the web for current information",
    parameters: {
      query: "string",
      num_results: "number"
    }
  }
];
```

### 3. Embeddings (Semantic Search)

**Primary Model**: Qwen3-Embedding-0.6B (Local) OR OpenAI text-embedding-3-large (API)

**Purpose**: Generate vector embeddings for semantic search

**Configuration**:
```typescript
interface EmbeddingConfig {
  provider: 'local' | 'openai';
  model: string; // e.g., 'qwen3-embedding-0.6b'
  endpoint?: string; // For local: 'http://localhost:8081'
  api_key?: string; // For OpenAI
  dimension: number; // 1024 (Qwen3) or 3072 (OpenAI)
  batch_size: number; // Process multiple texts at once
}
```

**Implementation**:
```rust
// Rust Tauri command
#[tauri::command]
async fn generate_embedding(
    text: String,
    config: EmbeddingConfig
) -> Result<Vec<f32>, String> {
    match config.provider {
        "local" => {
            let response = reqwest::Client::new()
                .post(&config.endpoint)
                .json(&json!({ "input": text }))
                .send()
                .await?;

            let embedding: Vec<f32> = response.json().await?;
            Ok(embedding)
        },
        "openai" => {
            // Call OpenAI API
            // ...
        }
    }
}
```

## AI Service Architecture

### Frontend Service (TypeScript)

```typescript
// services/ai/AIService.ts
export class AIService {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  // Artifact generation with streaming
  async *generateArtifact(prompt: string): AsyncGenerator<string> {
    const response = await fetch(this.config.endpoints.code_generation, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        system_prompt: this.config.system_prompts.artifact,
        temperature: 0.7,
        stream: true
      })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const text = decoder.decode(value);
      yield text;
    }
  }

  // Note editing
  async *editNote(
    noteId: string,
    instruction: string
  ): AsyncGenerator<string> {
    // Get note content
    const note = await invoke('read_note', { noteId });

    // Call AI with function calling
    const response = await this.callWithTools({
      messages: [
        { role: 'system', content: this.config.system_prompts.note_editor },
        { role: 'user', content: instruction },
        { role: 'user', content: `Note content:\n${note.content}` }
      ],
      tools: this.config.tools
    });

    // Handle tool calls
    if (response.tool_calls) {
      for (const toolCall of response.tool_calls) {
        yield* this.handleToolCall(toolCall);
      }
    }
  }

  // Semantic search
  async semanticSearch(
    query: string,
    limit: number = 10
  ): Promise<Note[]> {
    // Generate query embedding
    const embedding = await invoke('generate_embedding', { text: query });

    // Search database
    const results = await invoke('semantic_search', {
      embedding,
      limit
    });

    return results;
  }
}
```

### Backend Service (Rust)

```rust
// src-tauri/src/ai/mod.rs
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct AIConfig {
    pub code_generation: ModelConfig,
    pub note_understanding: ModelConfig,
    pub embeddings: ModelConfig,
}

#[derive(Serialize, Deserialize)]
pub struct ModelConfig {
    pub provider: String,
    pub model: String,
    pub endpoint: Option<String>,
    pub api_key: Option<String>,
    pub temperature: f32,
}

#[tauri::command]
pub async fn generate_artifact_stream(
    prompt: String,
    config: ModelConfig,
) -> Result<(), String> {
    // Stream artifact generation
    // Implementation depends on provider
    Ok(())
}

#[tauri::command]
pub async fn semantic_search(
    embedding: Vec<f32>,
    limit: i64,
    state: State<'_, AppState>,
) -> Result<Vec<Note>, String> {
    let results = sqlx::query_as!(
        Note,
        r#"
        SELECT n.*,
               1 - (e.embedding <=> $1) as similarity
        FROM notes n
        JOIN embeddings e ON e.note_id = n.id
        ORDER BY similarity DESC
        LIMIT $2
        "#,
        &embedding,
        limit
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(results)
}
```

## Model Installation Guide (For User)

### Local Model Setup

**1. Install llama.cpp**:
```bash
# Clone llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Build
make

# Install Python bindings
pip install llama-cpp-python
```

**2. Download Models**:
```bash
# Install huggingface-cli
pip install huggingface-hub

# Download Qwen3-Coder-30B
huggingface-cli download Qwen/Qwen3-Coder-30B-Instruct-GGUF \
  qwen3-coder-30b-q4_k_m.gguf \
  --local-dir ./models

# Download Qwen3-Embedding
huggingface-cli download Qwen/Qwen3-Embedding-0.6B-GGUF \
  qwen3-embedding-0.6b-q8_0.gguf \
  --local-dir ./models
```

**3. Start Model Servers**:
```bash
# Terminal 1: Code generation
python -m llama_cpp.server \
  --model ./models/qwen3-coder-30b-q4_k_m.gguf \
  --port 8080 \
  --n_ctx 128000 \
  --n_gpu_layers 35

# Terminal 2: Embeddings
python -m llama_cpp.server \
  --model ./models/qwen3-embedding-0.6b-q8_0.gguf \
  --port 8081 \
  --embedding \
  --n_gpu_layers 35
```

**4. Configure Weave**:
In Weave settings, configure:
- Code Generation endpoint: `http://localhost:8080`
- Embedding endpoint: `http://localhost:8081`
- Model: `local`

### API-Based Setup

**1. Get API Keys**:
- OpenAI: https://platform.openai.com/api-keys
- Brave Search: https://brave.com/search/api/

**2. Configure Weave**:
In Weave settings:
- Note Understanding provider: `OpenAI`
- Model: `gpt-4o`
- API Key: `sk-...`

## Performance Optimization

### Caching
```rust
use moka::future::Cache;

let embedding_cache = Cache::builder()
    .max_capacity(10_000)
    .time_to_live(Duration::from_secs(3600))
    .build();
```

### Batching
```typescript
// Batch multiple embedding requests
async function batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    body: JSON.stringify({ inputs: texts })
  });
  return response.json();
}
```

### Streaming
All AI responses should stream to provide immediate feedback:
```typescript
for await (const chunk of generateArtifact(prompt)) {
  updateUI(chunk);
}
```
