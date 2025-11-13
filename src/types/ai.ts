// AI system types
import type { Note } from './note';
import type { DatabaseColumn } from './block';

export interface AIConfig {
  code_generation: ModelConfig;
  note_understanding: ModelConfig;
  embeddings: ModelConfig;
  web_search?: WebSearchConfig;
}

export interface ModelConfig {
  provider: 'local' | 'openai' | 'anthropic';
  model: string;
  endpoint?: string;
  api_key?: string;
  temperature: number;
  max_tokens?: number;
  context_length?: number;
}

export interface WebSearchConfig {
  provider: 'brave' | 'serper';
  api_key: string;
}

export interface ArtifactGenerationRequest {
  prompt: string;
  type: 'artifact' | 'database';
}

export interface ArtifactGenerationResponse {
  html: string;
  css: string;
  javascript: string;
  title?: string;
}

export interface DatabaseGenerationResponse {
  title: string;
  columns: DatabaseColumn[];
  rows: any[];
  view: 'table' | 'gallery' | 'calendar';
}

export interface EmbeddingRequest {
  text: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  dimension: number;
}

export interface SemanticSearchRequest {
  query: string;
  limit?: number;
}

export interface SemanticSearchResponse {
  notes: Note[];
  scores: number[];
}

// Function calling tools
export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
}
