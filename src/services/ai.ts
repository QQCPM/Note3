import { invoke } from '@tauri-apps/api/core';
import type { AIConfig } from '@/types';

interface ArtifactResult {
  title: string;
  html: string;
  css: string;
  javascript: string;
}

interface DatabaseResult {
  title: string;
  columns: Array<{
    name: string;
    type: string;
    options?: string[];
  }>;
  rows: any[];
}

interface HealthStatus {
  embedding_service: boolean;
  reranker_service: boolean;
  local_code_service: boolean;
  agent_service: boolean;
  api_code_service: boolean;
}

class AIService {
  private initialized: boolean = false;

  /**
   * Initialize the AI system with configuration
   * Must be called before using any AI features
   */
  async initialize(config: AIConfig): Promise<void> {
    try {
      await invoke('ai_initialize', { config });
      this.initialized = true;
      console.log('AI system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI:', error);
      throw error;
    }
  }

  /**
   * Get current AI configuration
   */
  async getConfig(): Promise<AIConfig | null> {
    try {
      const config = await invoke<AIConfig | null>('ai_get_config');
      return config;
    } catch (error) {
      console.error('Failed to get AI config:', error);
      return null;
    }
  }

  /**
   * Check health status of all AI services
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      return await invoke<HealthStatus>('ai_health_check');
    } catch (error) {
      console.error('AI health check failed:', error);
      return {
        embedding_service: false,
        reranker_service: false,
        local_code_service: false,
        agent_service: false,
        api_code_service: false,
      };
    }
  }

  /**
   * Generate embedding for a single text (local model)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      return await invoke<number[]>('ai_generate_embedding', { text });
    } catch (error) {
      console.error('Failed to generate embedding:', error);
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
      return await invoke<number[][]>('ai_generate_embeddings_batch', { texts });
    } catch (error) {
      console.error('Failed to generate embeddings batch:', error);
      throw error;
    }
  }

  /**
   * Generate an artifact (HTML/CSS/JS) from a prompt using GPT
   */
  async generateArtifact(prompt: string): Promise<ArtifactResult> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      return await invoke<ArtifactResult>('ai_generate_artifact', { prompt });
    } catch (error) {
      console.error('Failed to generate artifact:', error);
      throw error;
    }
  }

  /**
   * Generate a database schema from a prompt using GPT
   */
  async generateDatabase(prompt: string): Promise<DatabaseResult> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      return await invoke<DatabaseResult>('ai_generate_database', { prompt });
    } catch (error) {
      console.error('Failed to generate database:', error);
      throw error;
    }
  }

  /**
   * Chat with AI agent using GPT
   */
  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      return await invoke<string>('ai_chat', { messages });
    } catch (error) {
      console.error('Failed to chat with AI:', error);
      throw error;
    }
  }

  /**
   * Chat with AI agent with tool/function calling support
   */
  async chatWithTools(
    messages: Array<{ role: string; content: string }>,
    tools: Array<any>
  ): Promise<{ content: string; tool_calls: any[] }> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      return await invoke<{ content: string; tool_calls: any[] }>(
        'ai_chat_with_tools',
        { messages, tools }
      );
    } catch (error) {
      console.error('Failed to chat with tools:', error);
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
      return await invoke<number[]>('ai_rerank', { query, documents });
    } catch (error) {
      console.error('Failed to rerank:', error);
      throw error;
    }
  }

  /**
   * Helper: Check if AI is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

export const aiService = new AIService();
