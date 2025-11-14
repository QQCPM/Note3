// AI system types for hybrid architecture
import type { Note } from './note';

// ============================================================================
// HYBRID AI CONFIGURATION
// ============================================================================

export interface AIConfig {
  // Local models (privacy, speed, cost-effective)
  embeddings: LocalModelConfig;

  // Optional: local reranking model
  reranker?: LocalModelConfig;

  // Optional: local code generation model (Qwen3-30B-Coder)
  local_code_generation?: LocalModelConfig;

  // Cloud API models (reasoning, quality)
  agent: APIModelConfig;

  // Optional: separate API config for code generation (fallback)
  api_code_generation?: APIModelConfig;
}

export interface LocalModelConfig {
  provider: 'local';
  model: string; // e.g., 'qwen3-embedding-0.6b'
  endpoint: string; // e.g., 'http://localhost:8081'
  dimension?: number; // Embedding dimension (e.g., 1024)
}

export interface APIModelConfig {
  provider: 'openai' | 'anthropic';
  model: string; // e.g., 'gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4'
  api_key: string;
  temperature?: number;
  max_tokens?: number;
}

// Legacy interface for backward compatibility
export interface ModelConfig {
  provider: 'local' | 'openai' | 'anthropic';
  model: string;
  endpoint?: string; // For local models
  api_key?: string; // For API providers
  temperature?: number;
  max_tokens?: number;
  context_length?: number;
}

export interface WebSearchConfig {
  provider: 'brave' | 'google' | 'local';
  api_key?: string;
  max_results?: number;
}

// ============================================================================
// AI CONVERSATIONS
// ============================================================================

export interface AIConversation {
  id: string;
  note_id: string;
  created_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  created_at: string;
}

// ============================================================================
// AI TOOLS (Function Calling)
// ============================================================================

export interface AITool {
  name: string;
  description: string;
  parameters: {
    [key: string]: {
      type: string;
      description: string;
      required?: boolean;
    };
  };
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: any;
}

export interface ToolResult {
  tool_call_id: string;
  result: any;
  error?: string;
}

// ============================================================================
// EMBEDDINGS (Local Model)
// ============================================================================

export interface Embedding {
  id: string;
  note_id: string;
  content_hash: string;
  embedding: number[]; // Vector
  model: string;
  created_at: string;
}

export interface SemanticSearchResult {
  note: Note;
  similarity: number;
  snippet?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a default AI configuration
 * User must provide OpenAI API key
 */
export function createDefaultAIConfig(openaiApiKey: string): AIConfig {
  return {
    embeddings: {
      provider: 'local',
      model: 'qwen3-embedding-0.6b',
      endpoint: 'http://localhost:8081',
      dimension: 1024,
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

/**
 * Create Mac M2 Ultra optimized configuration
 * Full local AI stack with Q8_0 (8-bit) models - excellent quality, 50% memory
 */
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
    local_code_generation: {
      provider: 'local',
      model: 'qwen3-coder-30b',
      endpoint: 'http://localhost:8080',
      dimension: 0,
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

/**
 * Create an API-only configuration (no local models)
 * Useful for users who don't want to run local models
 */
export function createAPIOnlyConfig(openaiApiKey: string): AIConfig {
  return {
    embeddings: {
      provider: 'local',
      model: 'text-embedding-3-large',
      endpoint: 'https://api.openai.com/v1',
      dimension: 3072,
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

/**
 * Validate AI configuration
 */
export function validateAIConfig(config: AIConfig): string[] {
  const errors: string[] = [];

  // Check embeddings config
  if (!config.embeddings.endpoint) {
    errors.push('Embeddings endpoint is required');
  }
  if (!config.embeddings.model) {
    errors.push('Embeddings model is required');
  }

  // Check agent config
  if (!config.agent.api_key) {
    errors.push('Agent API key is required');
  }
  if (!config.agent.model) {
    errors.push('Agent model is required');
  }

  // Validate temperature
  if (config.agent.temperature !== undefined) {
    if (config.agent.temperature < 0 || config.agent.temperature > 2) {
      errors.push('Agent temperature must be between 0 and 2');
    }
  }

  return errors;
}
