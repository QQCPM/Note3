import { invoke } from '@tauri-apps/api/core';

/**
 * Tauri AI Service
 * 
 * Wrapper around Rust AI backend commands.
 * Provides type-safe interface to all AI operations.
 */

// ========================================
// TYPES
// ========================================
// 
// NOTE: These types are duplicated in @/types/ai.ts with a more sophisticated
// type system (includes provider discrimination). This duplication exists because:
// 1. The Rust backend expects these simplified structures via Tauri IPC
// 2. The types/ai.ts provides higher-level abstractions for TypeScript usage
// 
// TODO: Consolidate these types by either:
//   a) Using types/ai.ts types and mapping them before sending to Rust
//   b) Or updating Rust types to match the types/ai.ts structure
//

export interface AIConfig {
  embeddings: EmbeddingConfig;
  reranker?: EmbeddingConfig;
  local_code_generation?: LocalModelConfig;
  agent: OpenAIConfig;
  api_code_generation?: OpenAIConfig;
}

export interface EmbeddingConfig {
  endpoint: string;
  model: string;
  dimension: number;
}

export interface LocalModelConfig {
  endpoint: string;
  model: string;
  max_tokens: number;
  temperature: number;
}

export interface OpenAIConfig {
  api_key: string;
  model: string;
  temperature: number;
  max_tokens?: number;
}

export interface PersistedConfig {
  openai_api_key: string;
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

  /**
   * Initialize AI system with configuration
   */
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

  /**
   * Get current AI configuration
   */
  async getConfig(): Promise<AIConfig | null> {
    try {
      return await invoke('ai_get_config');
    } catch (error) {
      console.error('Failed to get AI config:', error);
      return null;
    }
  }

  /**
   * Load persisted configuration from disk
   */
  async loadPersistedConfig(): Promise<PersistedConfig | null> {
    try {
      return await invoke('ai_load_persisted_config');
    } catch (error) {
      console.log('No persisted config found (will use .env defaults)');
      return null;
    }
  }

  /**
   * Save configuration to disk
   */
  async saveConfig(config: PersistedConfig): Promise<void> {
    try {
      await invoke('ai_save_config', { config });
      console.log('✅ Config saved successfully');
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  /**
   * Update AI configuration and save to disk
   */
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

  /**
   * Check health status of all AI services
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      return await invoke('ai_health_check');
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for text (using local model)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      return await invoke('ai_generate_embedding', { text });
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batched, local model)
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      return await invoke('ai_generate_embeddings_batch', { texts });
    } catch (error) {
      console.error('Batch embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate artifact (HTML/CSS/JS) from prompt
   * Uses local Qwen3-30B-Coder if available, falls back to OpenAI
   */
  async generateArtifact(prompt: string): Promise<ArtifactResult> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      return await invoke('ai_generate_artifact', { prompt });
    } catch (error) {
      console.error('Artifact generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate database schema from prompt
   * Uses local model if available, falls back to OpenAI
   */
  async generateDatabase(prompt: string): Promise<DatabaseResult> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      return await invoke('ai_generate_database', { prompt });
    } catch (error) {
      console.error('Database generation failed:', error);
      throw error;
    }
  }

  /**
   * Chat with AI agent (using GPT for reasoning)
   */
  async chat(messages: Message[]): Promise<string> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      return await invoke('ai_chat', { messages });
    } catch (error) {
      console.error('Chat failed:', error);
      throw error;
    }
  }

  /**
   * Chat with AI agent with tool support (function calling)
   */
  async chatWithTools(messages: Message[], tools: Tool[]): Promise<ChatWithToolsResponse> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      return await invoke('ai_chat_with_tools', { messages, tools });
    } catch (error) {
      console.error('Chat with tools failed:', error);
      throw error;
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
      return await invoke('ai_rerank', { query, documents });
    } catch (error) {
      console.error('Reranking failed:', error);
      throw error;
    }
  }

  /**
   * Store embedding for a note
   */
  async storeNoteEmbedding(noteId: string, content: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      await invoke('ai_store_note_embedding', { noteId, content });
    } catch (error) {
      console.error('Failed to store note embedding:', error);
      throw error;
    }
  }

  /**
   * Search notes semantically using embeddings
   */
  async searchNotes(query: string, limit?: number): Promise<SearchResult[]> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      return await invoke('ai_search_notes', { query, limit });
    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  }

  /**
   * Read a single block's content
   */
  async readBlock(blockId: string): Promise<string> {
    try {
      return await invoke('ai_read_block', { blockId });
    } catch (error) {
      console.error('Failed to read block:', error);
      throw error;
    }
  }

  /**
   * Get note context (note + all blocks) formatted for AI
   */
  async getNoteContext(noteId: string): Promise<string> {
    try {
      return await invoke('ai_get_note_context', { noteId });
    } catch (error) {
      console.error('Failed to get note context:', error);
      throw error;
    }
  }

  /**
   * Chat with AI about a specific note (RAG pattern)
   */
  async chatWithNoteContext(noteId: string, userMessage: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      return await invoke('ai_chat_with_note_context', { noteId, userMessage });
    } catch (error) {
      console.error('Chat with note context failed:', error);
      throw error;
    }
  }

  /**
   * Check if AI is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const tauriAI = new TauriAIService();

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Create default AI configuration
 */
export function createDefaultAIConfig(openaiKey: string = ''): AIConfig {
  return {
    embeddings: {
      endpoint: 'http://localhost:8081',
      model: 'qwen3-embedding-0.6b',
      dimension: 1024,
    },
    agent: {
      api_key: openaiKey,
      model: 'gpt-5.1',
      temperature: 0.3,
      max_tokens: 16000,
    },
  };
}

/**
 * Create Mac M2 Ultra optimized configuration
 */
export function createMacM2UltraConfig(openaiKey: string): AIConfig {
  return {
    embeddings: {
      endpoint: 'http://localhost:8081',
      model: 'qwen3-embedding-8b',
      dimension: 8192,
    },
    reranker: {
      endpoint: 'http://localhost:8082',
      model: 'qwen3-reranker-8b',
      dimension: 8192,
    },
    local_code_generation: {
      endpoint: 'http://localhost:8080',
      model: 'qwen3-coder-30b',
      max_tokens: 8192,
      temperature: 0.7,
    },
    agent: {
      api_key: openaiKey,
      model: 'gpt-5.1', // Upgraded to GPT-5.1 with advanced reasoning
      temperature: 0.3, // Lower for more focused, accurate responses
      max_tokens: 16000, // Increased for longer, more detailed responses
    },
  };
}

/**
 * Validate AI configuration
 */
export function validateAIConfig(config: AIConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check embeddings
  if (!config.embeddings.endpoint) {
    errors.push('Embeddings endpoint is required');
  }
  if (!config.embeddings.model) {
    errors.push('Embeddings model is required');
  }
  if (config.embeddings.dimension <= 0) {
    errors.push('Embeddings dimension must be positive');
  }

  // Check agent
  if (!config.agent.api_key) {
    errors.push('OpenAI API key is required for agent');
  }
  if (!config.agent.model) {
    errors.push('Agent model is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
