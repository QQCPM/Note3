/**
 * AI System Types
 * 
 * Unified Configuration:
 * - Agent: GPT-5.2 (OpenAI)
 * - Code Generation: GPT-5.2 (OpenAI)
 * - Embeddings: text-embedding-3-large (OpenAI)
 * - Reranker: Qwen3-Reranker-4B (Ollama local)
 */

import type { Note } from './note';

// ============================================================================
// AI CONFIGURATION
// ============================================================================

export interface AIConfig {
  embeddings: LocalModelConfig;
  reranker?: LocalModelConfig;
  agent: APIModelConfig;
  api_code_generation?: APIModelConfig;
}

export interface LocalModelConfig {
  provider: 'local';
  model: string;
  endpoint: string;
  dimension?: number;
}

export interface APIModelConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  api_key: string;
  temperature?: number;
  max_tokens?: number;
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
// EMBEDDINGS
// ============================================================================

export interface Embedding {
  id: string;
  note_id: string;
  content_hash: string;
  embedding: number[];
  model: string;
  created_at: string;
}

export interface SemanticSearchResult {
  note: Note;
  similarity: number;
  snippet?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateAIConfig(config: AIConfig): string[] {
  const errors: string[] = [];

  if (!config.embeddings.endpoint) errors.push('Embeddings endpoint is required');
  if (!config.embeddings.model) errors.push('Embeddings model is required');
  if (!config.agent.api_key) errors.push('Agent API key is required');
  if (!config.agent.model) errors.push('Agent model is required');

  if (config.agent.temperature !== undefined) {
    if (config.agent.temperature < 0 || config.agent.temperature > 2) {
      errors.push('Agent temperature must be between 0 and 2');
    }
  }

  return errors;
}
