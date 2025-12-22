import { invoke } from '@tauri-apps/api/core';

/**
 * Tauri AI Service
 * 
 * Unified AI Configuration:
 * - Agent: GPT-5.2 (OpenAI)
 * - Code Generation: GLM-4.6 (Ollama cloud) - excellent for coding
 * - Embeddings: text-embedding-3-large (OpenAI)
 * - Reranker: Qwen3-Reranker-4B (Ollama local)
 */

// ========================================
// TYPES
// ========================================

export interface AIConfig {
  embeddings: EmbeddingConfig;
  reranker?: EmbeddingConfig;
  agent: OpenAIConfig;
  api_code_generation?: OpenAIConfig;
  ollama_cloud?: OllamaCloudConfig;  // For GLM-4.6 code generation
}

export interface OllamaCloudConfig {
  api_key: string;
  model: string;
}

export interface EmbeddingConfig {
  endpoint: string;
  model: string;
  dimension: number;
}

export interface OpenAIConfig {
  api_key: string;
  model: string;
  temperature: number;
  max_tokens?: number;
}

export interface PersistedConfig {
  openai_api_key: string;
  ollama_api_key?: string;
  openai_model: string;
  temperature: number;
  max_tokens?: number;
}

export interface HealthStatus {
  embedding_service: boolean;
  reranker_service: boolean;
  local_code_service: boolean;
  agent_service: boolean;
  api_code_service: boolean;
}

export interface ArtifactResult {
  title: string;
  html: string;
  css: string;
  javascript: string;
}

export interface DatabaseResult {
  title: string;
  columns: Array<{
    name: string;
    column_type: string;
    options?: string[];
  }>;
  rows: any[];
  view: { type: string };
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface ChatWithToolsResponse {
  content: string;
  tool_calls: ToolCall[];
}

export type StreamedContentType = 
  | { type: 'OutputText'; text: string }
  | { type: 'ReasoningText'; text: string }
  | { type: 'ReasoningSummary'; text: string }
  | { type: 'Done' }
  | { type: 'Empty' };

export function isReasoningContent(content: StreamedContentType): boolean {
  return content.type === 'ReasoningText' || content.type === 'ReasoningSummary';
}

export function getStreamedText(content: StreamedContentType): string | null {
  if (content.type === 'OutputText' || content.type === 'ReasoningText' || content.type === 'ReasoningSummary') {
    return content.text;
  }
  return null;
}

export interface SearchResult {
  note_id: string;
  title: string;
  similarity: number;
  content_preview: string;
}

// ========================================
// SERVICE
// ========================================

class TauriAIService {
  private initialized = false;

  async initialize(config: AIConfig): Promise<void> {
    try {
      await invoke('ai_initialize', { config });
      this.initialized = true;
      console.log('✅ AI initialized successfully');
    } catch (error) {
      console.error('❌ AI initialization failed:', error);
      throw error;
    }
  }

  async getConfig(): Promise<AIConfig | null> {
    try {
      return await invoke('ai_get_config');
    } catch (error) {
      console.error('Failed to get AI config:', error);
      return null;
    }
  }

  async loadPersistedConfig(): Promise<PersistedConfig | null> {
    try {
      return await invoke('ai_load_persisted_config');
    } catch (error) {
      console.log('No persisted config found (will use defaults)');
      return null;
    }
  }

  async saveConfig(config: PersistedConfig): Promise<void> {
    try {
      await invoke('ai_save_config', { config });
      console.log('✅ Config saved successfully');
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  async updateAndSaveConfig(config: PersistedConfig): Promise<void> {
    try {
      await invoke('ai_update_and_save_config', { config });
      this.initialized = true;
      console.log('✅ Config updated and saved successfully');
    } catch (error) {
      console.error('Failed to update and save config:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      return await invoke('ai_health_check');
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    this.requireInitialized();
    return await invoke('ai_generate_embedding', { text });
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    this.requireInitialized();
    return await invoke('ai_generate_embeddings_batch', { texts });
  }

  async generateArtifact(prompt: string): Promise<ArtifactResult> {
    this.requireInitialized();
    return await invoke('ai_generate_artifact', { prompt });
  }

  async generateDatabase(prompt: string): Promise<DatabaseResult> {
    this.requireInitialized();
    return await invoke('ai_generate_database', { prompt });
  }

  async chat(messages: Message[]): Promise<string> {
    this.requireInitialized();
    return await invoke('ai_chat', { messages });
  }

  async chatWithTools(messages: Message[], tools: Tool[]): Promise<ChatWithToolsResponse> {
    this.requireInitialized();
    return await invoke('ai_chat_with_tools', { messages, tools });
  }

  async rerank(query: string, documents: string[]): Promise<number[]> {
    this.requireInitialized();
    return await invoke('ai_rerank', { query, documents });
  }

  async storeNoteEmbedding(noteId: string, content: string): Promise<void> {
    this.requireInitialized();
    await invoke('ai_store_note_embedding', { noteId, content });
  }

  async searchNotes(query: string, limit?: number): Promise<SearchResult[]> {
    this.requireInitialized();
    return await invoke('ai_search_notes', { query, limit });
  }

  async readBlock(blockId: string): Promise<string> {
    return await invoke('ai_read_block', { blockId });
  }

  async getNoteContext(noteId: string): Promise<string> {
    return await invoke('ai_get_note_context', { noteId });
  }

  async chatWithNoteContext(noteId: string, userMessage: string): Promise<string> {
    this.requireInitialized();
    return await invoke('ai_chat_with_note_context', { noteId, userMessage });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private requireInitialized() {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }
  }
}

export const tauriAI = new TauriAIService();

// ========================================
// CONFIGURATION HELPERS
// ========================================

/**
 * Base AI configuration
 * - Agent: GPT-5.2 (OpenAI)
 * - Code Gen: GLM-4.6 (Ollama cloud) - excellent for coding
 * - Embeddings: text-embedding-3-large (OpenAI)
 * - Reranker: Qwen3-Reranker-4B (Ollama local)
 */
function createBaseConfig(openaiKey: string, ollamaKey?: string): AIConfig {
  const config: AIConfig = {
    embeddings: {
      endpoint: 'https://api.openai.com/v1/embeddings',
      model: 'text-embedding-3-large',
      dimension: 3072,
    },
    reranker: {
      endpoint: 'http://localhost:11434',
      model: 'dengcao/Qwen3-Reranker-4B',
      dimension: 2048,
    },
    agent: {
      api_key: openaiKey,
      model: 'gpt-5.2',
      temperature: 0.3,
      max_tokens: 32768,
    },
  };

  // Add Ollama Cloud config for GLM-4.6 code generation if API key provided
  if (ollamaKey) {
    config.ollama_cloud = {
      api_key: ollamaKey,
      model: 'glm-4.6',
    };
  }

  return config;
}

// All modes use the same unified configuration
export const createDefaultAIConfig = createBaseConfig;
export const createMacM2UltraConfig = createBaseConfig;
export const createMacM2ProConfig = createBaseConfig;
export const createMacM2ProHybridConfig = createBaseConfig;
export const createCloudOnlyConfig = createBaseConfig;
export function createDemoConfig(openaiKey: string, ollamaKey: string): AIConfig {
  return createBaseConfig(openaiKey, ollamaKey);
}

/**
 * Validate AI configuration
 */
export function validateAIConfig(config: AIConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.embeddings.endpoint) errors.push('Embeddings endpoint is required');
  if (!config.embeddings.model) errors.push('Embeddings model is required');
  if (config.embeddings.dimension <= 0) errors.push('Embeddings dimension must be positive');
  if (!config.agent.api_key) errors.push('OpenAI API key is required');
  if (!config.agent.model) errors.push('Agent model is required');

  return { valid: errors.length === 0, errors };
}
