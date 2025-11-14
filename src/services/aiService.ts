import type { AIMode, AIContext } from '@/store/aiStore';
import type { Block, DatabaseBlockData, Note } from '@/types';
import {
  analyzeDatabase,
  queryDatabase,
  detectPatterns,
  type QueryResult,
  type AnalysisResult,
} from '@/components/Blocks/Database/DatabaseAITools';

/**
 * Unified AI Service
 *
 * This service handles all AI operations across the application:
 * - Ask mode: semantic search, RAG, database queries, web search
 * - Edit mode: automatic editing, note organization
 */

export interface AIRequest {
  mode: AIMode;
  message: string;
  context: AIContext;
  blocks?: Block[];
  notes?: Note[];
}

export interface AIResponse {
  content: string;
  metadata?: {
    type: 'database_query' | 'semantic_search' | 'edit_operation' | 'general' | 'analysis';
    results?: any;
    blocksAffected?: string[];
    suggestedFollowUps?: string[];
  };
}

class UnifiedAIService {
  /**
   * Main entry point for AI requests
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    const { mode, message, context } = request;

    // Route to appropriate handler based on mode and context
    if (mode === 'ask') {
      return this.handleAskMode(message, context, request);
    } else {
      return this.handleEditMode(message, context, request);
    }
  }

  /**
   * ASK MODE: Query and search operations
   */
  private async handleAskMode(
    message: string,
    context: AIContext,
    request: AIRequest
  ): Promise<AIResponse> {
    const lowerMessage = message.toLowerCase();

    // Database queries
    if (context.databaseData) {
      // Check if message is asking about the database
      if (this.isDatabaseQuery(lowerMessage)) {
        return this.handleDatabaseQuery(message, context.databaseData);
      }

      // Check if asking for analysis
      if (this.isAnalysisRequest(lowerMessage)) {
        return this.handleDatabaseAnalysis(context.databaseData);
      }

      // Check if asking for patterns
      if (this.isPatternRequest(lowerMessage)) {
        return this.handlePatternDetection(context.databaseData);
      }
    }

    // Semantic search across notes
    if (this.isSemanticSearchQuery(lowerMessage)) {
      return this.handleSemanticSearch(message, request.notes || []);
    }

    // Web search
    if (this.isWebSearchQuery(lowerMessage)) {
      return this.handleWebSearch(message);
    }

    // General question about notes/content
    if (context.noteId && request.notes) {
      return this.handleNoteQuery(message, context.noteId, request.notes);
    }

    // Default: general AI response
    return this.handleGeneralQuery(message, context);
  }

  /**
   * EDIT MODE: Automatic editing and organization
   */
  private async handleEditMode(
    message: string,
    context: AIContext,
    request: AIRequest
  ): Promise<AIResponse> {
    const lowerMessage = message.toLowerCase();

    // Database editing
    if (context.databaseData) {
      if (this.isDatabaseEditRequest(lowerMessage)) {
        return this.handleDatabaseEdit(message, context);
      }
    }

    // Block editing
    if (context.blockId && request.blocks) {
      if (this.isBlockEditRequest(lowerMessage)) {
        return this.handleBlockEdit(message, context, request.blocks);
      }
    }

    // Note organization
    if (context.noteId) {
      if (this.isOrganizationRequest(lowerMessage)) {
        return this.handleNoteOrganization(message, context, request.blocks || []);
      }
    }

    // Default: provide edit suggestions
    return this.handleEditSuggestions(message, context);
  }

  // ========================================
  // ASK MODE: DATABASE OPERATIONS
  // ========================================

  private isDatabaseQuery(message: string): boolean {
    const queryKeywords = [
      'show', 'find', 'get', 'what', 'how many', 'count', 'average', 'sum',
      'total', 'min', 'max', 'where', 'filter', 'search', 'containing',
    ];
    return queryKeywords.some(keyword => message.includes(keyword));
  }

  private isAnalysisRequest(message: string): boolean {
    const analysisKeywords = ['analyze', 'analysis', 'insights', 'statistics', 'stats', 'overview'];
    return analysisKeywords.some(keyword => message.includes(keyword));
  }

  private isPatternRequest(message: string): boolean {
    const patternKeywords = ['pattern', 'trend', 'anomal', 'duplicate', 'missing', 'quality'];
    return patternKeywords.some(keyword => message.includes(keyword));
  }

  private async handleDatabaseQuery(
    message: string,
    dbData: DatabaseBlockData
  ): Promise<AIResponse> {
    try {
      const result: QueryResult = queryDatabase(dbData, message);

      let content = `**Query Result:**\n\n${result.explanation}\n\n`;

      if (result.summary) {
        content += `**Summary:** ${result.summary}\n\n`;
      }

      if (result.count !== undefined) {
        content += `**Count:** ${result.count} rows\n\n`;
      }

      if (result.statistics !== undefined) {
        content += `**Result:** ${typeof result.statistics === 'number' ? result.statistics.toFixed(2) : JSON.stringify(result.statistics)}\n\n`;
      }

      if (result.rows && result.rows.length > 0) {
        content += `Found ${result.rows.length} matching rows.\n`;
      }

      return {
        content,
        metadata: {
          type: 'database_query',
          results: result,
          suggestedFollowUps: [
            'Show me more details',
            'Analyze these results',
            'Export this data',
          ],
        },
      };
    } catch (error) {
      return {
        content: `I encountered an error processing your database query: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { type: 'database_query' },
      };
    }
  }

  private async handleDatabaseAnalysis(dbData: DatabaseBlockData): Promise<AIResponse> {
    try {
      const analysis: AnalysisResult = analyzeDatabase(dbData, {
        include_patterns: true,
        include_recommendations: true,
      });

      let content = `**Database Analysis**\n\n`;
      content += `${analysis.summary}\n\n`;

      if (analysis.insights && analysis.insights.length > 0) {
        content += `**Key Insights:**\n`;
        analysis.insights.forEach(insight => {
          content += `• ${insight}\n`;
        });
        content += '\n';
      }

      if (analysis.patterns && analysis.patterns.length > 0) {
        content += `**Patterns Detected:** ${analysis.patterns.length}\n`;
        const criticalPatterns = analysis.patterns.filter(p => p.severity === 'high');
        if (criticalPatterns.length > 0) {
          content += `⚠️ ${criticalPatterns.length} critical issue(s) found\n`;
        }
        content += '\n';
      }

      if (analysis.recommendations && analysis.recommendations.length > 0) {
        content += `**Recommendations:**\n`;
        analysis.recommendations.forEach(rec => {
          content += `💡 ${rec}\n`;
        });
      }

      return {
        content,
        metadata: {
          type: 'analysis',
          results: analysis,
          suggestedFollowUps: [
            'Show me the patterns',
            'What are the critical issues?',
            'How can I improve this database?',
          ],
        },
      };
    } catch (error) {
      return {
        content: `I encountered an error analyzing the database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { type: 'analysis' },
      };
    }
  }

  private async handlePatternDetection(dbData: DatabaseBlockData): Promise<AIResponse> {
    try {
      const patterns = detectPatterns(dbData);

      let content = `**Pattern Detection Results**\n\n`;

      if (patterns.length === 0) {
        content += 'No significant patterns detected. Your data looks clean! ✨\n';
      } else {
        const critical = patterns.filter(p => p.severity === 'high');
        const warnings = patterns.filter(p => p.severity === 'medium');
        const info = patterns.filter(p => p.severity === 'low');

        if (critical.length > 0) {
          content += `**Critical Issues (${critical.length}):**\n`;
          critical.forEach(p => {
            content += `❌ ${p.description}\n`;
            if (p.affected_rows) content += `   Affects ${p.affected_rows} rows\n`;
          });
          content += '\n';
        }

        if (warnings.length > 0) {
          content += `**Warnings (${warnings.length}):**\n`;
          warnings.forEach(p => {
            content += `⚠️ ${p.description}\n`;
            if (p.affected_rows) content += `   Affects ${p.affected_rows} rows\n`;
          });
          content += '\n';
        }

        if (info.length > 0) {
          content += `**Insights (${info.length}):**\n`;
          info.forEach(p => {
            content += `ℹ️ ${p.description}\n`;
          });
        }
      }

      return {
        content,
        metadata: {
          type: 'analysis',
          results: { patterns },
          suggestedFollowUps: patterns.length > 0 ? [
            'How do I fix these issues?',
            'Show me the affected rows',
            'Analyze the data quality',
          ] : [],
        },
      };
    } catch (error) {
      return {
        content: `I encountered an error detecting patterns: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { type: 'analysis' },
      };
    }
  }

  // ========================================
  // ASK MODE: SEMANTIC SEARCH
  // ========================================

  private isSemanticSearchQuery(message: string): boolean {
    const searchKeywords = ['search', 'find notes', 'look for', 'notes about', 'notes containing'];
    return searchKeywords.some(keyword => message.includes(keyword));
  }

  private async handleSemanticSearch(message: string, notes: Note[]): Promise<AIResponse> {
    // TODO: Implement actual semantic search with embeddings
    // For now, simple keyword search

    const query = this.extractSearchQuery(message);
    const results = notes.filter(note =>
      note.title.toLowerCase().includes(query.toLowerCase())
    );

    let content = `**Search Results for "${query}"**\n\n`;

    if (results.length === 0) {
      content += 'No notes found matching your query.\n';
    } else {
      content += `Found ${results.length} note(s):\n\n`;
      results.slice(0, 5).forEach(note => {
        content += `📄 **${note.title}**\n`;
        content += `   Created: ${new Date(note.created_at).toLocaleDateString()}\n`;
        content += '\n';
      });

      if (results.length > 5) {
        content += `... and ${results.length - 5} more\n`;
      }
    }

    return {
      content,
      metadata: {
        type: 'semantic_search',
        results: results.map(n => ({ id: n.id, title: n.title })),
        suggestedFollowUps: results.length > 0 ? [
          'Show me the first note',
          'Search for something else',
          'Organize these notes',
        ] : [],
      },
    };
  }

  // ========================================
  // ASK MODE: WEB SEARCH
  // ========================================

  private isWebSearchQuery(message: string): boolean {
    const webKeywords = ['search web', 'google', 'look up', 'find online', 'search online'];
    return webKeywords.some(keyword => message.includes(keyword));
  }

  private async handleWebSearch(message: string): Promise<AIResponse> {
    // TODO: Implement actual web search
    return {
      content: `**Web Search**\n\nWeb search feature coming soon! I'll be able to search the web for "${message}" and bring back results.`,
      metadata: {
        type: 'general',
        suggestedFollowUps: [
          'Search my notes instead',
          'Tell me what you know about this',
        ],
      },
    };
  }

  // ========================================
  // ASK MODE: NOTE QUERIES
  // ========================================

  private async handleNoteQuery(
    _message: string,
    noteId: string,
    notes: Note[]
  ): Promise<AIResponse> {
    const note = notes.find(n => n.id === noteId);

    if (!note) {
      return {
        content: 'I couldn\'t find the note you\'re asking about.',
        metadata: { type: 'general' },
      };
    }

    let content = `**About: ${note.title}**\n\n`;
    content += `I'm analyzing this note to answer your question...\n\n`;
    content += `*Note: Full semantic understanding and RAG capabilities coming soon!*`;

    return {
      content,
      metadata: {
        type: 'general',
        suggestedFollowUps: [
          'Summarize this note',
          'Find related notes',
          'Organize this note',
        ],
      },
    };
  }

  // ========================================
  // ASK MODE: GENERAL QUERIES
  // ========================================

  private async handleGeneralQuery(message: string, context: AIContext): Promise<AIResponse> {
    let content = `I understand you're asking: "${message}"\n\n`;

    if (!context.noteId && !context.blockId) {
      content += `**Tip:** Select a note or block to give me context, then I can:\n`;
      content += `• Answer questions about your data\n`;
      content += `• Search within specific notes\n`;
      content += `• Analyze database content\n`;
      content += `• Help organize your information\n`;
    } else {
      content += `I'm here to help! I can:\n`;
      if (context.databaseData) {
        content += `• Query your database\n`;
        content += `• Analyze data patterns\n`;
      }
      content += `• Search across your notes\n`;
      content += `• Answer questions about your content\n`;
    }

    return {
      content,
      metadata: {
        type: 'general',
        suggestedFollowUps: [
          'Analyze my data',
          'Search my notes',
          'Show me statistics',
        ],
      },
    };
  }

  // ========================================
  // EDIT MODE: OPERATIONS
  // ========================================

  private isDatabaseEditRequest(message: string): boolean {
    const editKeywords = ['add column', 'fill', 'clean', 'remove duplicates', 'fix', 'update'];
    return editKeywords.some(keyword => message.includes(keyword));
  }

  private isBlockEditRequest(message: string): boolean {
    const editKeywords = ['edit', 'change', 'update', 'modify', 'rewrite', 'improve'];
    return editKeywords.some(keyword => message.includes(keyword));
  }

  private isOrganizationRequest(message: string): boolean {
    const orgKeywords = ['organize', 'structure', 'rearrange', 'sort', 'group', 'categorize'];
    return orgKeywords.some(keyword => message.includes(keyword));
  }

  private async handleDatabaseEdit(
    _message: string,
    context: AIContext
  ): Promise<AIResponse> {
    return {
      content: `**Database Edit Mode**\n\nI can help edit your database, but I need your confirmation first.\n\nWhat would you like me to do?\n• Add missing columns\n• Fill empty cells\n• Remove duplicates\n• Clean data\n\n*Note: Automatic editing coming soon!*`,
      metadata: {
        type: 'edit_operation',
        blocksAffected: context.blockId ? [context.blockId] : [],
      },
    };
  }

  private async handleBlockEdit(
    _message: string,
    context: AIContext,
    blocks: Block[]
  ): Promise<AIResponse> {
    const block = blocks.find(b => b.id === context.blockId);

    if (!block) {
      return {
        content: 'I couldn\'t find the block you want to edit.',
        metadata: { type: 'edit_operation' },
      };
    }

    return {
      content: `**Edit Mode: ${block.type} block**\n\nI can help edit this block. What would you like me to change?\n\n*Note: Automatic block editing coming soon!*`,
      metadata: {
        type: 'edit_operation',
        blocksAffected: [block.id],
      },
    };
  }

  private async handleNoteOrganization(
    _message: string,
    context: AIContext,
    blocks: Block[]
  ): Promise<AIResponse> {
    const noteBlocks = blocks.filter(b => b.note_id === context.noteId);

    return {
      content: `**Note Organization**\n\nI can help organize your note with ${noteBlocks.length} blocks.\n\nPossible organizations:\n• Group by type\n• Sort by priority\n• Add structure headings\n• Remove duplicates\n\n*Note: Automatic organization coming soon!*`,
      metadata: {
        type: 'edit_operation',
        blocksAffected: noteBlocks.map(b => b.id),
      },
    };
  }

  private async handleEditSuggestions(
    _message: string,
    _context: AIContext
  ): Promise<AIResponse> {
    return {
      content: `**Edit Mode**\n\nI'm ready to help you edit! To get started:\n• Select a block to edit it\n• Tell me what changes you want to make\n• I can organize, clean, and improve your content\n\n*Note: Full editing capabilities coming soon!*`,
      metadata: { type: 'edit_operation' },
    };
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  private extractSearchQuery(message: string): string {
    // Remove common search prefixes
    let query = message
      .replace(/^(search|find|look for|notes about|notes containing)\s+/i, '')
      .replace(/^(for|about)\s+/i, '')
      .trim();

    // Remove quotes if present
    query = query.replace(/^["'](.*)["']$/, '$1');

    return query || message;
  }
}

export const unifiedAIService = new UnifiedAIService();
