// AI system types
import type { Note } from './note';

import type { Note } from './note';

export interface AIConfig {
  code_generation: ModelConfig;
  note_understanding: ModelConfig;
  embeddings: ModelConfig;
  web_search?: WebSearchConfig;
}

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

// AI Conversations
export interface AIConversation {
  id: string;
  note_id: string;
  created_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  created_at: string;
}

// AI Tools (Function Calling)
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

// Embeddings
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
