import type { Block, Note, DatabaseBlockData } from '@/types';
import type { SemanticSearchResult } from '@/types/ai';
import { aiProvider } from './aiProvider';

/**
 * Embeddings Service
 *
 * Handles:
 * - Generating embeddings for notes and blocks
 * - Vector similarity search
 * - Semantic search across all content
 * - RAG (Retrieval Augmented Generation)
 */

interface EmbeddingCache {
  [contentHash: string]: {
    embedding: number[];
    model: string;
    timestamp: number;
  };
}

class EmbeddingsService {
  private cache: EmbeddingCache = {};
  private readonly CACHE_KEY = 'embeddings_cache';
  private readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    this.loadCache();
  }

  /**
   * Load embeddings cache from localStorage
   */
  private loadCache(): void {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        this.cache = JSON.parse(cached);
        // Clean old entries
        this.cleanCache();
      }
    } catch (error) {
      console.error('Failed to load embeddings cache:', error);
      this.cache = {};
    }
  }

  /**
   * Save embeddings cache to localStorage
   */
  private saveCache(): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.error('Failed to save embeddings cache:', error);
    }
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    Object.entries(this.cache).forEach(([hash, entry]) => {
      if (now - entry.timestamp > this.CACHE_TTL) {
        entriesToDelete.push(hash);
      }
    });

    entriesToDelete.forEach(hash => delete this.cache[hash]);

    if (entriesToDelete.length > 0) {
      this.saveCache();
    }
  }

  /**
   * Generate content hash for caching
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Generate embedding for text using configured provider
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const contentHash = this.hashContent(text);

    // Check cache first
    if (this.cache[contentHash]) {
      return this.cache[contentHash].embedding;
    }

    const config = aiProvider.getConfig();
    if (!config) {
      throw new Error('AI not configured');
    }

    const embeddingConfig = config.embeddings;

    try {
      let embedding: number[];

      if (embeddingConfig.provider === 'openai') {
        embedding = await this.generateOpenAIEmbedding(text, embeddingConfig);
      } else if (embeddingConfig.provider === 'local') {
        embedding = await this.generateLocalEmbedding(text, embeddingConfig);
      } else {
        throw new Error(`Embeddings not supported for provider: ${embeddingConfig.provider}`);
      }

      // Cache the result
      this.cache[contentHash] = {
        embedding,
        model: embeddingConfig.model,
        timestamp: Date.now(),
      };
      this.saveCache();

      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embedding using OpenAI
   */
  private async generateOpenAIEmbedding(text: string, config: any): Promise<number[]> {
    if (!config.api_key) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        model: config.model || 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI embeddings error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * Generate embedding using local model (Ollama)
   */
  private async generateLocalEmbedding(text: string, config: any): Promise<number[]> {
    const endpoint = config.endpoint || 'http://localhost:11434/api/embeddings';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'nomic-embed-text',
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Local embeddings error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Extract searchable text from a note and its blocks
   */
  private async extractNoteContent(note: Note, blocks: Block[]): Promise<string> {
    const noteBlocks = blocks.filter(b => b.note_id === note.id);

    let content = note.title + '\n\n';

    noteBlocks.forEach(block => {
      if (block.type === 'text') {
        const textData = block.data as import('@/types/block').TextBlockData;
        content += textData.content || '';
        content += '\n\n';
      } else if (block.type === 'heading1' || block.type === 'heading2') {
        const headingData = block.data as import('@/types/block').HeadingBlockData;
        content += '# ' + headingData.content + '\n\n';
      } else if (block.type === 'database') {
        const dbData = block.data as DatabaseBlockData;
        content += `Database: ${dbData.title}\n`;
        dbData.columns.forEach(col => {
          content += `Column: ${col.name} (${col.type})\n`;
        });
        content += '\n';
      } else if (block.type === 'task') {
        const taskData = block.data as import('@/types/block').TaskBlockData;
        content += `Task: ${taskData.title}\n`;
        taskData.tasks.forEach(t => {
          content += `- [${t.completed ? 'x' : ' '}] ${t.text}\n`;
        });
        content += '\n';
      }
    });

    return content.trim();
  }

  /**
   * Perform semantic search across all notes
   */
  async semanticSearch(
    query: string,
    notes: Note[],
    blocks: Block[],
    topK: number = 5
  ): Promise<SemanticSearchResult[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);

      // Generate embeddings for all notes (with caching)
      const noteEmbeddings = await Promise.all(
        notes.map(async (note) => {
          const content = await this.extractNoteContent(note, blocks);
          const embedding = await this.generateEmbedding(content);
          return { note, content, embedding };
        })
      );

      // Calculate similarities
      const results = noteEmbeddings.map(({ note, content, embedding }) => ({
        note,
        similarity: this.cosineSimilarity(queryEmbedding, embedding),
        snippet: this.extractSnippet(content, query),
      }));

      // Sort by similarity and return top K
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .filter(r => r.similarity > 0.7); // Only return relevant results
    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  }

  /**
   * Extract relevant snippet from content
   */
  private extractSnippet(content: string, query: string, length: number = 200): string {
    const queryWords = query.toLowerCase().split(' ');
    const sentences = content.split(/[.!?]\s+/);

    // Find sentence with most query words
    let bestSentence = sentences[0] || '';
    let maxMatches = 0;

    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      const matches = queryWords.filter(word => lowerSentence.includes(word)).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestSentence = sentence;
      }
    });

    // Truncate if too long
    if (bestSentence.length > length) {
      return bestSentence.substring(0, length) + '...';
    }

    return bestSentence;
  }

  /**
   * Get relevant context for RAG
   * Returns the most relevant notes and their content for answering a query
   */
  async getRelevantContext(
    query: string,
    notes: Note[],
    blocks: Block[],
    maxContext: number = 3
  ): Promise<{ notes: SemanticSearchResult[]; contextText: string }> {
    const relevantNotes = await this.semanticSearch(query, notes, blocks, maxContext);

    // Build context text
    let contextText = 'Relevant information from your notes:\n\n';

    relevantNotes.forEach((result) => {
      contextText += `## ${result.note.title}\n`;
      contextText += `${result.snippet}\n\n`;
    });

    return {
      notes: relevantNotes,
      contextText,
    };
  }

  /**
   * Clear embeddings cache
   */
  clearCache(): void {
    this.cache = {};
    localStorage.removeItem(this.CACHE_KEY);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { entries: number; size: string } {
    const entries = Object.keys(this.cache).length;
    const sizeBytes = new Blob([JSON.stringify(this.cache)]).size;
    const sizeKB = (sizeBytes / 1024).toFixed(2);

    return {
      entries,
      size: `${sizeKB} KB`,
    };
  }
}

export const embeddingsService = new EmbeddingsService();
