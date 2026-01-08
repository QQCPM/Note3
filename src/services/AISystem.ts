/**
 * AISystem - Unified AI Service Coordinator
 * 
 * Single entry point for all AI functionality in the Note3 app.
 * Consolidates and synchronizes:
 * - tauriAI (core Tauri IPC)
 * - aiEditService (canvas editing)
 * - aiTools (database/artifact tools)
 * - chatService (conversations)
 * - recommendationService (learning aids)
 * - agenticAI (autonomous tasks)
 * - orchestration (workflows)
 * - webSearch (web search)
 */

import { tauriAI, createMacM2UltraConfig, createMacM2ProConfig, createMacM2ProHybridConfig, createCloudOnlyConfig, createDemoConfig, type AIConfig, type Message } from './tauriAI';
import { streamAIEditChat, applyEdit, rejectEdit } from './aiEditService';
import { aiToolsService } from './aiTools';
import { sendChatMessage, chatWithNoteEdit, type ChatMessage } from './chatService';
import {
  analyzeNoteForRecommendations,
  generateMindmap,
  generateFlashcards,
  generateConcepts,
  generateExercises,
  generateResources,
  generateSlides,
  initializeGeminiService,
  isGeminiServiceReady,
  clearRecommendationCache,
  clearAllRecommendationCache,
} from './recommendationService';
import { agenticAI } from './agenticAI';
import { orchestrationService } from './orchestration';
import { searchWeb, formatSearchResults } from './webSearch';
import { initializeYouTubeSearch } from './courseGenerator/youtubeSearch';
import { useAIStore } from '@/store/aiStore';

// ============================================================================
// TYPES
// ============================================================================

export type AISystemStatus = 'uninitialized' | 'initializing' | 'ready' | 'partial' | 'error';

export interface AISystemHealth {
  status: AISystemStatus;
  services: {
    embedding: boolean;
    reranker: boolean;
    localCode: boolean;
    agent: boolean;
    apiCode: boolean;
  };
  error?: string;
  lastCheck: Date;
}

export type AISystemMode =
  | 'm2-ultra'      // Mac M2 Ultra 64GB+ - full local models
  | 'm2-pro'        // Mac M2 Pro 16GB - minimal local (embedding only) + cloud
  | 'm2-pro-hybrid' // Mac M2 Pro 16GB - local embedding + reranker + cloud
  | 'cloud-only'    // No local models - everything via OpenAI API
  | 'demo';         // GLM-4.6 via Ollama Cloud

export interface AISystemConfig {
  openaiApiKey: string;
  ollamaApiKey?: string;  // For GLM-4.6 cloud code generation
  geminiApiKey?: string;  // For Gemini 3 Pro slide generation
  useGlm46?: boolean;     // Force GLM-4.6 instead of local models (legacy, use mode: 'demo')
  mode?: AISystemMode;    // Machine-specific configuration mode
  autoInitialize?: boolean;
}

type AIEventType =
  | 'status-change'
  | 'health-update'
  | 'error'
  | 'chat-start'
  | 'chat-complete'
  | 'tool-call'
  | 'edit-proposed'
  | 'edit-applied'
  | 'edit-rejected';

type AIEventCallback = (data: any) => void;

// ============================================================================
// AI SYSTEM CLASS
// ============================================================================

class AISystemService {
  private _status: AISystemStatus = 'uninitialized';
  private _health: AISystemHealth | null = null;
  private _config: AIConfig | null = null;
  private _eventListeners: Map<AIEventType, Set<AIEventCallback>> = new Map();
  private _initPromise: Promise<void> | null = null;

  // ========================================================================
  // INITIALIZATION & STATUS
  // ========================================================================

  /**
   * Initialize the AI system with OpenAI API key
   * This is the single entry point for all AI initialization
   */
  async initialize(config: AISystemConfig): Promise<AISystemHealth> {
    // Prevent multiple simultaneous initializations
    if (this._initPromise) {
      await this._initPromise;
      return this._health!;
    }

    this._initPromise = this._doInitialize(config);

    try {
      await this._initPromise;
      return this._health!;
    } finally {
      this._initPromise = null;
    }
  }

  private async _doInitialize(config: AISystemConfig): Promise<void> {
    this._setStatus('initializing');
    console.log('🤖 [AISystem] Initializing unified AI system...');

    try {
      // Step 1: Try to load persisted config
      let openaiKey = config.openaiApiKey;

      if (!openaiKey) {
        const persistedConfig = await tauriAI.loadPersistedConfig();
        if (persistedConfig?.openai_api_key) {
          console.log('📂 [AISystem] Using persisted API key');
          openaiKey = persistedConfig.openai_api_key;
        }
      }

      // Step 2: Create config based on mode
      const ollamaKey = config.ollamaApiKey || '';
      const mode = config.mode || (ollamaKey || config.useGlm46 ? 'demo' : 'm2-ultra');

      switch (mode) {
        case 'm2-pro':
          console.log('💻 [AISystem] Using M2 Pro 16GB config (minimal local + cloud)');
          this._config = createMacM2ProConfig(openaiKey, ollamaKey);
          break;
        case 'm2-pro-hybrid':
          console.log('💻 [AISystem] Using M2 Pro 16GB hybrid config (local embed+rerank + cloud)');
          this._config = createMacM2ProHybridConfig(openaiKey, ollamaKey);
          break;
        case 'cloud-only':
          console.log('☁️ [AISystem] Using cloud-only config (no local models)');
          this._config = createCloudOnlyConfig(openaiKey, ollamaKey);
          break;
        case 'demo':
          console.log('🌩️ [AISystem] Using GLM-4.6 (Ollama Cloud) for code generation');
          this._config = createDemoConfig(openaiKey, ollamaKey);
          break;
        case 'm2-ultra':
        default:
          console.log('💻 [AISystem] Using M2 Ultra config (full local models - requires 64GB+ RAM)');
          this._config = createMacM2UltraConfig(openaiKey, ollamaKey);
          break;
      }

      // Step 3: Initialize Tauri AI backend
      await tauriAI.initialize(this._config);
      console.log('✅ [AISystem] Tauri AI backend initialized');

      // Step 4: Initialize Gemini service if API key is provided
      if (config.geminiApiKey) {
        try {
          initializeGeminiService(config.geminiApiKey);
          console.log('✅ [AISystem] Gemini service initialized for slide generation');
        } catch (geminiError) {
          console.warn('⚠️ [AISystem] Gemini service initialization failed:', geminiError);
          // Don't fail entire initialization if Gemini fails
        }
      }

      // Step 5: Initialize YouTube search if API key is provided
      const youtubeApiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      if (youtubeApiKey) {
        try {
          initializeYouTubeSearch(youtubeApiKey);
          console.log('✅ [AISystem] YouTube search initialized');
        } catch (youtubeError) {
          console.warn('⚠️ [AISystem] YouTube search initialization failed:', youtubeError);
          // Don't fail entire initialization if YouTube fails
        }
      }

      // Step 6: Initialize Deep Research service (uses Gemini API key)
      if (config.geminiApiKey) {
        try {
          const { initializeDeepResearch } = await import('./deepResearchService');
          initializeDeepResearch(config.geminiApiKey);
          console.log('✅ [AISystem] Deep Research service initialized');
        } catch (deepResearchError) {
          console.warn('⚠️ [AISystem] Deep Research initialization failed:', deepResearchError);
        }
      }

      // Step 7: Knowledge service is now integrated in the Course Generator Worker
      // No separate initialization needed - LlamaIndex is loaded lazily within the worker
      console.log('ℹ️ [AISystem] Knowledge service integrated in Course Generator Worker');

      // Step 8: Health check
      await this.checkHealth();

      // Step 9: Determine final status
      if (this._health?.services.agent) {
        const allHealthy = Object.values(this._health.services).every(v => v);
        this._setStatus(allHealthy ? 'ready' : 'partial');
        console.log(`✅ [AISystem] Initialization complete - Status: ${this._status}`);
      } else {
        this._setStatus('error');
        console.error('❌ [AISystem] Agent service not available');
      }

    } catch (error) {
      this._setStatus('error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._health = {
        status: 'error',
        services: { embedding: false, reranker: false, localCode: false, agent: false, apiCode: false },
        error: errorMessage,
        lastCheck: new Date(),
      };
      console.error('❌ [AISystem] Initialization failed:', error);
      console.error('❌ [AISystem] Error details:', errorMessage);
      console.error('❌ [AISystem] Please check:');
      console.error('   1. OpenAI API key is valid');
      console.error('   2. Tauri backend is running');
      console.error('   3. Network connection is available');
      throw error;
    }
  }

  /**
   * Check health of all AI services
   */
  async checkHealth(): Promise<AISystemHealth> {
    try {
      const health = await tauriAI.healthCheck();

      this._health = {
        status: this._status,
        services: {
          embedding: health.embedding_service,
          reranker: health.reranker_service,
          localCode: health.local_code_service,
          agent: health.agent_service,
          apiCode: health.api_code_service,
        },
        lastCheck: new Date(),
      };

      this._emit('health-update', this._health);
      return this._health;

    } catch (error) {
      this._health = {
        status: 'error',
        services: { embedding: false, reranker: false, localCode: false, agent: false, apiCode: false },
        error: error instanceof Error ? error.message : String(error),
        lastCheck: new Date(),
      };
      return this._health;
    }
  }

  /**
   * Get current status
   */
  get status(): AISystemStatus {
    return this._status;
  }

  /**
   * Get current health
   */
  get health(): AISystemHealth | null {
    return this._health;
  }

  /**
   * Check if AI is ready to use
   */
  get isReady(): boolean {
    return this._status === 'ready' || this._status === 'partial';
  }

  private _setStatus(status: AISystemStatus) {
    const oldStatus = this._status;
    this._status = status;
    if (oldStatus !== status) {
      this._emit('status-change', { oldStatus, newStatus: status });
    }
  }

  // ========================================================================
  // CHAT - Unified chat interface
  // ========================================================================

  /**
   * Send a chat message (general conversation)
   */
  async chat(messages: Message[]): Promise<string> {
    this._requireReady();
    this._emit('chat-start', { type: 'general' });

    try {
      const response = await tauriAI.chat(messages);
      this._emit('chat-complete', { type: 'general', success: true });
      return response;
    } catch (error) {
      this._emit('error', { source: 'chat', error });
      throw error;
    }
  }

  /**
   * Send a chat message using conversation history
   */
  async sendMessage(history: ChatMessage[], message: string): Promise<string> {
    this._requireReady();
    return sendChatMessage(history, message);
  }

  /**
   * Chat with note context - creates content in the note
   */
  async chatWithNote(noteId: string, noteName: string, message: string, history: ChatMessage[] = []): Promise<string> {
    this._requireReady();
    this._emit('chat-start', { type: 'note-edit', noteId });

    try {
      const response = await chatWithNoteEdit(noteId, noteName, message, history);
      this._emit('chat-complete', { type: 'note-edit', noteId, success: true });
      return response;
    } catch (error) {
      this._emit('error', { source: 'chatWithNote', error });
      throw error;
    }
  }

  /**
   * Stream AI edit with tool calling
   */
  async streamEdit(options: {
    blockId: string;
    userMessage: string;
    onStream?: (chunk: string) => void;
    onToolCall?: (toolName: string, args: any) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
  }): Promise<void> {
    this._requireReady();
    this._emit('chat-start', { type: 'edit', blockId: options.blockId });

    const wrappedOnToolCall = (name: string, args: any) => {
      this._emit('tool-call', { name, args });
      options.onToolCall?.(name, args);
    };

    const wrappedOnComplete = () => {
      this._emit('chat-complete', { type: 'edit', blockId: options.blockId, success: true });
      options.onComplete?.();
    };

    return streamAIEditChat({
      ...options,
      onToolCall: wrappedOnToolCall,
      onComplete: wrappedOnComplete,
    });
  }

  // ========================================================================
  // EDITS - Accept/reject proposed edits
  // ========================================================================

  /**
   * Apply a pending edit
   */
  async applyEdit(editId: string): Promise<void> {
    await applyEdit(editId);
    this._emit('edit-applied', { editId });
  }

  /**
   * Reject a pending edit
   */
  rejectEdit(editId: string): void {
    rejectEdit(editId);
    this._emit('edit-rejected', { editId });
  }

  /**
   * Get pending edits from store
   */
  get pendingEdits() {
    return useAIStore.getState().pendingEdits;
  }

  // ========================================================================
  // TOOLS - Database and Artifact tools
  // ========================================================================

  /**
   * Get all available AI tools
   */
  async getTools() {
    this._requireReady();
    return aiToolsService.getAllTools();
  }

  /**
   * Execute a database tool
   */
  async executeDatabaseTool(toolName: string, params: any) {
    this._requireReady();
    return aiToolsService.executeTool(toolName, params);
  }

  /**
   * Execute an artifact tool
   */
  async executeArtifactTool(toolName: string, params: any) {
    this._requireReady();
    return aiToolsService.executeTool(toolName, params);
  }

  // ========================================================================
  // GENERATION - Create content, artifacts, databases
  // ========================================================================

  /**
   * Generate an artifact (HTML/CSS/JS)
   */
  async generateArtifact(prompt: string) {
    this._requireReady();
    return tauriAI.generateArtifact(prompt);
  }

  /**
   * Generate a database schema
   */
  async generateDatabase(prompt: string) {
    this._requireReady();
    return tauriAI.generateDatabase(prompt);
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text: string) {
    this._requireReady();
    return tauriAI.generateEmbedding(text);
  }

  /**
   * Generate embeddings in batch
   */
  async generateEmbeddingsBatch(texts: string[]) {
    this._requireReady();
    return tauriAI.generateEmbeddingsBatch(texts);
  }

  // ========================================================================
  // SEARCH - Semantic and web search
  // ========================================================================

  /**
   * Search notes semantically
   */
  async searchNotes(query: string, limit?: number) {
    this._requireReady();
    return tauriAI.searchNotes(query, limit);
  }

  /**
   * Search the web
   */
  async searchWeb(query: string, options?: { max_results?: number; language?: string }) {
    return searchWeb(query, options);
  }

  /**
   * Format search results for display
   */
  formatSearchResults = formatSearchResults;

  /**
   * Rerank search results
   */
  async rerank(query: string, documents: string[]) {
    this._requireReady();
    return tauriAI.rerank(query, documents);
  }

  // ========================================================================
  // RECOMMENDATIONS - Learning aids
  // ========================================================================

  /**
   * Generate all recommendations for a note
   */
  async analyzeNote(noteId: string) {
    this._requireReady();
    return analyzeNoteForRecommendations(noteId);
  }

  /**
   * Generate mindmap for a note
   */
  async generateMindmap(noteId: string) {
    this._requireReady();
    return generateMindmap(noteId);
  }

  /**
   * Generate flashcards for a note
   */
  async generateFlashcards(noteId: string) {
    this._requireReady();
    return generateFlashcards(noteId);
  }

  /**
   * Generate concepts for a note
   */
  async generateConcepts(noteId: string) {
    this._requireReady();
    return generateConcepts(noteId);
  }

  /**
   * Generate exercises for a note
   */
  async generateExercises(noteId: string) {
    this._requireReady();
    return generateExercises(noteId);
  }

  /**
   * Generate resources for a note
   */
  async generateResources(noteId: string) {
    this._requireReady();
    return generateResources(noteId);
  }

  /**
   * Clear recommendation cache for a note
   */
  clearRecommendationCache(noteId: string) {
    clearRecommendationCache(noteId);
  }

  /**
   * Clear all recommendation caches
   */
  clearAllRecommendationCache() {
    clearAllRecommendationCache();
  }

  /**
   * Generate educational slides from note content using Gemini 3 Pro
   */
  async generateSlides(
    noteId: string,
    numSlides: number = 8,
    onProgress?: (progress: { current: number; total: number; message: string }) => void
  ) {
    this._requireReady();
    return generateSlides(noteId, numSlides, onProgress);
  }

  /**
   * Check if Gemini service is ready for slide generation
   */
  isGeminiReady(): boolean {
    return isGeminiServiceReady();
  }

  /**
   * Initialize Gemini service with API key (can be called separately)
   */
  initializeGemini(apiKey: string): void {
    initializeGeminiService(apiKey);
    console.log('✅ [AISystem] Gemini service initialized');
  }

  // ========================================================================
  // AGENTIC - Autonomous AI tasks
  // ========================================================================

  /**
   * Execute an autonomous task
   */
  async executeTask(task: string, noteId?: string) {
    this._requireReady();
    return agenticAI.executeTask(task, noteId);
  }

  /**
   * Plan a task without executing
   */
  async planTask(task: string) {
    this._requireReady();
    return agenticAI.planTask(task);
  }

  /**
   * Research a topic
   */
  async research(query: string) {
    this._requireReady();
    return agenticAI.research(query);
  }

  /**
   * Research and extract structured data
   */
  async researchAndExtract(query: string, schema: any, count: number) {
    this._requireReady();
    return agenticAI.researchAndExtract(query, schema, count);
  }

  // ========================================================================
  // ORCHESTRATION - Workflows
  // ========================================================================

  /**
   * Get workflow templates
   */
  async getWorkflowTemplates() {
    this._requireReady();
    return orchestrationService.getTemplates();
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(options: {
    prompt?: string;
    templateId?: string;
    parameters?: Record<string, any>;
    noteId?: string;
  }) {
    this._requireReady();
    return orchestrationService.orchestrateWorkflow(options);
  }

  /**
   * Create expense tracker
   */
  async createExpenseTracker(title?: string, noteId?: string) {
    this._requireReady();
    return orchestrationService.createExpenseTracker(title, noteId);
  }

  /**
   * Create todo list
   */
  async createTodoList(title?: string, noteId?: string) {
    this._requireReady();
    return orchestrationService.createTodoList(title, noteId);
  }

  // ========================================================================
  // CONTEXT - Note and block reading
  // ========================================================================

  /**
   * Read a block's content
   */
  async readBlock(blockId: string) {
    return tauriAI.readBlock(blockId);
  }

  /**
   * Get full note context
   */
  async getNoteContext(noteId: string) {
    return tauriAI.getNoteContext(noteId);
  }

  /**
   * Chat about a note with RAG
   */
  async chatWithNoteContext(noteId: string, message: string) {
    this._requireReady();
    return tauriAI.chatWithNoteContext(noteId, message);
  }

  // ========================================================================
  // EVENTS - Event emitter pattern
  // ========================================================================

  /**
   * Subscribe to AI events
   */
  on(event: AIEventType, callback: AIEventCallback): () => void {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from AI events
   */
  off(event: AIEventType, callback: AIEventCallback): void {
    this._eventListeners.get(event)?.delete(callback);
  }

  private _emit(event: AIEventType, data: any): void {
    this._eventListeners.get(event)?.forEach(cb => {
      try {
        cb(data);
      } catch (error) {
        console.error(`[AISystem] Event handler error for ${event}:`, error);
      }
    });
  }

  // ========================================================================
  // STORE ACCESS - Direct access to AI store
  // ========================================================================

  /**
   * Get the AI store state
   */
  get store() {
    return useAIStore.getState();
  }

  /**
   * Clear all messages in the store
   */
  clearMessages() {
    useAIStore.getState().clearMessages();
  }

  /**
   * Clear pending edits
   */
  clearPendingEdits() {
    useAIStore.getState().clearPendingEdits();
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private _requireReady() {
    if (!this.isReady) {
      throw new Error('AI System not initialized. Call AISystem.initialize() first.');
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * The unified AI System instance
 * 
 * Usage:
 * ```ts
 * import { AISystem } from '@/services/AISystem';
 * 
 * // Initialize (once, in App.tsx)
 * await AISystem.initialize({ openaiApiKey: 'sk-...' });
 * 
 * // Use anywhere
 * const response = await AISystem.chat([{ role: 'user', content: 'Hello' }]);
 * const results = await AISystem.searchNotes('quantum physics');
 * await AISystem.streamEdit({ blockId, userMessage: 'Add info about black holes' });
 * ```
 */
export const AISystem = new AISystemService();

// Re-export types for convenience
export type { AIConfig, HealthStatus, Message } from './tauriAI';
export type { ChatMessage } from './chatService';
