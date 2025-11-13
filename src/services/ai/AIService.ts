import { invoke } from '@tauri-apps/api/core';
import type {
  AIConfig,
  ModelConfig,
  ArtifactGenerationRequest,
  ArtifactGenerationResponse,
  DatabaseGenerationResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  SemanticSearchRequest,
  SemanticSearchResponse,
} from '@/types/ai';

export class AIService {
  private config: AIConfig | null = null;

  /**
   * Initialize AI service with configuration
   */
  async initialize(): Promise<void> {
    this.config = await this.getConfig();
  }

  /**
   * Get current AI configuration
   */
  async getConfig(): Promise<AIConfig> {
    return invoke<AIConfig>('get_ai_config');
  }

  /**
   * Save AI configuration
   */
  async saveConfig(config: AIConfig): Promise<void> {
    await invoke('save_ai_config', { config });
    this.config = config;
  }

  /**
   * Generate artifact from natural language prompt
   */
  async generateArtifact(
    prompt: string
  ): Promise<ArtifactGenerationResponse> {
    if (!this.config) {
      await this.initialize();
    }

    const request: ArtifactGenerationRequest = {
      prompt,
      type: 'artifact',
    };

    return invoke<ArtifactGenerationResponse>('generate_artifact', {
      request,
      config: this.config!.code_generation,
    });
  }

  /**
   * Generate artifact with streaming (future implementation)
   * For now, falls back to non-streaming
   */
  async *generateArtifactStream(prompt: string): AsyncGenerator<string> {
    // TODO: Implement actual streaming via Tauri events
    // For now, just yield the final result

    const result = await this.generateArtifact(prompt);

    // Simulate streaming by yielding chunks
    yield 'Generating HTML...';
    yield 'Generating CSS...';
    yield 'Generating JavaScript...';
    yield JSON.stringify(result);
  }

  /**
   * Generate database structure from natural language
   */
  async generateDatabase(
    prompt: string
  ): Promise<DatabaseGenerationResponse> {
    if (!this.config) {
      await this.initialize();
    }

    return invoke<DatabaseGenerationResponse>('generate_database', {
      prompt,
      config: this.config!.note_understanding,
    });
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    if (!this.config) {
      await this.initialize();
    }

    const request: EmbeddingRequest = { text };

    return invoke<EmbeddingResponse>('generate_embedding', {
      request,
      config: this.config!.embeddings,
    });
  }

  /**
   * Perform semantic search across notes
   */
  async semanticSearch(
    query: string,
    limit: number = 10
  ): Promise<SemanticSearchResponse> {
    if (!this.config) {
      await this.initialize();
    }

    const request: SemanticSearchRequest = { query, limit };

    const notes = await invoke<any>('semantic_search', {
      query: request.query,
      limit: request.limit,
      config: this.config!.embeddings,
    });

    return {
      notes: notes || [],
      scores: [], // TODO: Return similarity scores from backend
    };
  }

  /**
   * Check if AI service is configured
   */
  isConfigured(): boolean {
    if (!this.config) return false;

    // Check if at least code generation is configured
    const codeGen = this.config.code_generation;

    if (codeGen.provider === 'local') {
      return !!codeGen.endpoint;
    } else if (codeGen.provider === 'openai' || codeGen.provider === 'anthropic') {
      return !!codeGen.api_key;
    }

    return false;
  }

  /**
   * Get configuration status
   */
  getConfigStatus(): {
    codeGeneration: boolean;
    noteUnderstanding: boolean;
    embeddings: boolean;
    webSearch: boolean;
  } {
    if (!this.config) {
      return {
        codeGeneration: false,
        noteUnderstanding: false,
        embeddings: false,
        webSearch: false,
      };
    }

    const hasProvider = (config: ModelConfig) => {
      if (config.provider === 'local') return !!config.endpoint;
      return !!config.api_key;
    };

    return {
      codeGeneration: hasProvider(this.config.code_generation),
      noteUnderstanding: hasProvider(this.config.note_understanding),
      embeddings: hasProvider(this.config.embeddings),
      webSearch: !!this.config.web_search?.api_key,
    };
  }
}

// Singleton instance
export const aiService = new AIService();
