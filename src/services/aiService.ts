import type { AIMode, AIContext } from '@/store/aiStore';
import type { Block, DatabaseBlockData, Note } from '@/types';
import {
  analyzeDatabase,
  queryDatabase,
  detectPatterns,
  type QueryResult,
  type AnalysisResult,
} from '@/components/Blocks/Database/DatabaseAITools';
import { aiProvider } from './aiProvider';
import { embeddingsService } from './embeddingsService';

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
      return this.handleSemanticSearch(message, request.notes || [], request.blocks || []);
    }

    // Web search
    if (this.isWebSearchQuery(lowerMessage)) {
      return this.handleWebSearch(message);
    }

    // General question about notes/content
    if (context.noteId && request.notes) {
      return this.handleNoteQuery(message, context.noteId, request.notes, request.blocks || []);
    }

    // Default: general AI response
    return this.handleGeneralQuery(message, context, request.notes || [], request.blocks || []);
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

  private async handleSemanticSearch(message: string, notes: Note[], blocks: Block[] = []): Promise<AIResponse> {
    const query = this.extractSearchQuery(message);

    try {
      // Use embeddings service for semantic search
      const results = await embeddingsService.semanticSearch(query, notes, blocks, 5);

      let content = `**Semantic Search Results for "${query}"**\n\n`;

      if (results.length === 0) {
        content += 'No relevant notes found. Try:\n';
        content += '• Rephrasing your query\n';
        content += '• Using different keywords\n';
        content += '• Searching for broader topics\n';
      } else {
        content += `Found ${results.length} relevant note(s):\n\n`;
        results.forEach((result, idx) => {
          content += `${idx + 1}. **${result.note.title}** (${(result.similarity * 100).toFixed(0)}% match)\n`;
          if (result.snippet) {
            content += `   ${result.snippet}\n`;
          }
          content += `   Created: ${new Date(result.note.created_at).toLocaleDateString()}\n\n`;
        });
      }

      return {
        content,
        metadata: {
          type: 'semantic_search',
          results: results.map(r => ({ id: r.note.id, title: r.note.title, similarity: r.similarity })),
          suggestedFollowUps: results.length > 0 ? [
            'Tell me more about the first result',
            'Search for something else',
            'Summarize these notes',
          ] : [],
        },
      };
    } catch (error) {
      console.error('Semantic search error:', error);
      // Fallback to keyword search
      return this.handleKeywordSearch(query, notes);
    }
  }

  /**
   * Fallback keyword search if embeddings fail
   */
  private async handleKeywordSearch(query: string, notes: Note[]): Promise<AIResponse> {
    const results = notes.filter(note =>
      note.title.toLowerCase().includes(query.toLowerCase())
    );

    let content = `**Search Results for "${query}"**\n\n`;
    content += `_Note: Using keyword search. Configure AI for semantic search._\n\n`;

    if (results.length === 0) {
      content += 'No notes found matching your query.\n';
    } else {
      content += `Found ${results.length} note(s):\n\n`;
      results.slice(0, 5).forEach(note => {
        content += `📄 **${note.title}**\n`;
        content += `   Created: ${new Date(note.created_at).toLocaleDateString()}\n\n`;
      });
    }

    return {
      content,
      metadata: {
        type: 'semantic_search',
        results: results.map(n => ({ id: n.id, title: n.title })),
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
    message: string,
    noteId: string,
    notes: Note[],
    blocks: Block[] = []
  ): Promise<AIResponse> {
    const note = notes.find(n => n.id === noteId);

    if (!note) {
      return {
        content: 'I couldn\'t find the note you\'re asking about.',
        metadata: { type: 'general' },
      };
    }

    try {
      // Use RAG to get relevant context
      const { contextText } = await embeddingsService.getRelevantContext(message, notes, blocks, 3);

      // Generate AI response with context
      const aiResponse = await aiProvider.generateCompletion([
        {
          role: 'system',
          content: `You are a helpful assistant analyzing notes. Answer the user's question using the provided context from their notes. Be concise and helpful.`,
        },
        {
          role: 'user',
          content: `${contextText}\n\nUser question: ${message}`,
        },
      ]);

      return {
        content: aiResponse.content,
        metadata: {
          type: 'general',
          suggestedFollowUps: [
            'Tell me more',
            'Find related notes',
            'Summarize this',
          ],
        },
      };
    } catch (error) {
      console.error('Note query error:', error);
      return {
        content: `**About: ${note.title}**\n\nI couldn't generate an AI response. ${error instanceof Error ? error.message : 'Please configure your AI provider in settings.'}\n\n*Tip: Set up OpenAI or Anthropic API key in settings for AI-powered responses.*`,
        metadata: { type: 'general' },
      };
    }
  }

  // ========================================
  // ASK MODE: GENERAL QUERIES
  // ========================================

  private async handleGeneralQuery(
    message: string,
    context: AIContext,
    notes: Note[] = [],
    blocks: Block[] = []
  ): Promise<AIResponse> {
    // If no context and AI not configured, show tips
    if (!context.noteId && !context.blockId && !aiProvider.isConfigured()) {
      let content = `I understand you're asking: "${message}"\n\n`;
      content += `**Tip:** Select a note or block to give me context, or configure AI in settings.\n\n`;
      content += `I can help you with:\n`;
      content += `• Answer questions about your data\n`;
      content += `• Search within specific notes\n`;
      content += `• Analyze database content\n`;
      content += `• Help organize your information\n`;

      return {
        content,
        metadata: { type: 'general' },
      };
    }

    try {
      // Use RAG to get relevant context from all notes
      const { contextText, notes: relevantNotes } = await embeddingsService.getRelevantContext(
        message,
        notes,
        blocks,
        3
      );

      // Build system prompt based on context
      let systemPrompt = `You are a helpful AI assistant. Answer the user's question clearly and concisely.`;

      if (relevantNotes.length > 0) {
        systemPrompt += ` Use the provided context from the user's notes to give informed answers.`;
      }

      // Generate AI response
      const aiResponse = await aiProvider.generateCompletion([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: relevantNotes.length > 0
            ? `${contextText}\n\nQuestion: ${message}`
            : message,
        },
      ]);

      return {
        content: aiResponse.content,
        metadata: {
          type: 'general',
          suggestedFollowUps: [
            'Tell me more',
            'Search my notes',
            'Related topics',
          ],
        },
      };
    } catch (error) {
      console.error('General query error:', error);
      return {
        content: `I couldn't generate an AI response: ${error instanceof Error ? error.message : 'Unknown error'}\n\n**Tip:** Configure your AI provider (OpenAI or Anthropic) in settings to enable AI-powered conversations.`,
        metadata: { type: 'general' },
      };
    }
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
    message: string,
    context: AIContext
  ): Promise<AIResponse> {
    if (!context.databaseData) {
      return {
        content: 'No database context found. Please select a database block first.',
        metadata: { type: 'edit_operation' },
      };
    }

    try {
      const dbData = context.databaseData;

      // Build database context for AI
      let dbContext = `Database: ${dbData.title}\n`;
      dbContext += `Columns: ${dbData.columns.map(c => `${c.name} (${c.type})`).join(', ')}\n`;
      dbContext += `Total rows: ${dbData.rows.length}\n\n`;

      // Sample some rows for context
      const sampleRows = dbData.rows.slice(0, 3);
      dbContext += `Sample data:\n${JSON.stringify(sampleRows, null, 2)}\n`;

      // Generate AI suggestions
      const aiResponse = await aiProvider.generateCompletion([
        {
          role: 'system',
          content: `You are a data organization expert. Given a database structure and user request, provide specific, actionable suggestions for improving the database. Be concise and practical.`,
        },
        {
          role: 'user',
          content: `${dbContext}\n\nUser request: ${message}\n\nProvide specific suggestions for how to improve this database based on the request.`,
        },
      ]);

      return {
        content: `**Database Edit Suggestions**\n\n${aiResponse.content}\n\n*Note: Review these suggestions carefully before applying changes.*`,
        metadata: {
          type: 'edit_operation',
          blocksAffected: context.blockId ? [context.blockId] : [],
          suggestedFollowUps: [
            'Apply these changes',
            'Show me more details',
            'Analyze data quality',
          ],
        },
      };
    } catch (error) {
      console.error('Database edit error:', error);
      return {
        content: `I couldn't generate edit suggestions. ${error instanceof Error ? error.message : 'Please configure your AI provider in settings.'}\n\n**Manual options:**\n• Add missing columns\n• Fill empty cells\n• Remove duplicates\n• Clean data`,
        metadata: {
          type: 'edit_operation',
          blocksAffected: context.blockId ? [context.blockId] : [],
        },
      };
    }
  }

  private async handleBlockEdit(
    message: string,
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

    try {
      // Extract block content
      let blockContent = '';
      if (block.type === 'text') {
        const textData = block.data as import('@/types/block').TextBlockData;
        blockContent = textData.content || '';
      } else if (block.type === 'heading1' || block.type === 'heading2') {
        const headingData = block.data as import('@/types/block').HeadingBlockData;
        blockContent = headingData.content || '';
      } else if (block.type === 'task') {
        const taskData = block.data as import('@/types/block').TaskBlockData;
        blockContent = `${taskData.title}\nTasks:\n${taskData.tasks.map(t => `- [${t.completed ? 'x' : ' '}] ${t.text}`).join('\n')}`;
      } else if (block.type === 'artifact') {
        const artifactData = block.data as import('@/types/block').ArtifactBlockData;
        blockContent = `Artifact: ${artifactData.title}`;
      } else if (block.type === 'database') {
        const dbData = block.data as import('@/types/block').DatabaseBlockData;
        blockContent = `Database: ${dbData.title}`;
      } else {
        blockContent = `${block.type} block`;
      }

      // Generate AI edit suggestions
      const aiResponse = await aiProvider.generateCompletion([
        {
          role: 'system',
          content: `You are a helpful editor. Given a block of content and the user's request, provide specific suggestions for how to improve or edit the content. Be concise and actionable.`,
        },
        {
          role: 'user',
          content: `Current content:\n${blockContent}\n\nUser request: ${message}\n\nProvide specific suggestions for improving this content.`,
        },
      ]);

      return {
        content: `**Edit Suggestions for ${block.type} block**\n\n${aiResponse.content}\n\n*Note: Review suggestions before applying.*`,
        metadata: {
          type: 'edit_operation',
          blocksAffected: [block.id],
          suggestedFollowUps: [
            'Apply these changes',
            'Suggest alternative edits',
            'Show original content',
          ],
        },
      };
    } catch (error) {
      console.error('Block edit error:', error);
      return {
        content: `I couldn't generate edit suggestions. ${error instanceof Error ? error.message : 'Please configure your AI provider in settings.'}\n\n**Current block type:** ${block.type}\n\nTell me what you'd like to change about this block.`,
        metadata: {
          type: 'edit_operation',
          blocksAffected: [block.id],
        },
      };
    }
  }

  private async handleNoteOrganization(
    message: string,
    context: AIContext,
    blocks: Block[]
  ): Promise<AIResponse> {
    const noteBlocks = blocks.filter(b => b.note_id === context.noteId);

    if (noteBlocks.length === 0) {
      return {
        content: 'No blocks found in this note.',
        metadata: { type: 'edit_operation' },
      };
    }

    try {
      // Build note structure overview
      let noteStructure = `Note has ${noteBlocks.length} blocks:\n\n`;

      const blocksByType = noteBlocks.reduce((acc, block) => {
        acc[block.type] = (acc[block.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(blocksByType).forEach(([type, count]) => {
        noteStructure += `• ${count} ${type} block(s)\n`;
      });

      noteStructure += `\nBlock preview:\n`;
      noteBlocks.slice(0, 5).forEach((block, idx) => {
        let preview = '';
        if (block.type === 'text') {
          const textData = block.data as import('@/types/block').TextBlockData;
          preview = textData.content?.substring(0, 50) + '...';
        } else if (block.type === 'heading1' || block.type === 'heading2') {
          const headingData = block.data as import('@/types/block').HeadingBlockData;
          preview = headingData.content?.substring(0, 50) + '...';
        } else {
          preview = `${block.type} block`;
        }
        noteStructure += `${idx + 1}. [${block.type}] ${preview}\n`;
      });

      // Generate AI organization suggestions
      const aiResponse = await aiProvider.generateCompletion([
        {
          role: 'system',
          content: `You are a content organization expert. Given a note's structure and user request, provide specific suggestions for organizing and improving the note structure. Be practical and actionable.`,
        },
        {
          role: 'user',
          content: `${noteStructure}\n\nUser request: ${message}\n\nProvide specific suggestions for organizing this note.`,
        },
      ]);

      return {
        content: `**Note Organization Suggestions**\n\n${aiResponse.content}\n\n*Note: Review suggestions before reorganizing.*`,
        metadata: {
          type: 'edit_operation',
          blocksAffected: noteBlocks.map(b => b.id),
          suggestedFollowUps: [
            'Apply this organization',
            'Show alternative structures',
            'Add section headings',
          ],
        },
      };
    } catch (error) {
      console.error('Note organization error:', error);
      return {
        content: `I couldn't generate organization suggestions. ${error instanceof Error ? error.message : 'Please configure your AI provider in settings.'}\n\n**Manual options:**\n• Group by type (${noteBlocks.length} blocks)\n• Sort by priority\n• Add structure headings\n• Remove duplicates`,
        metadata: {
          type: 'edit_operation',
          blocksAffected: noteBlocks.map(b => b.id),
        },
      };
    }
  }

  private async handleEditSuggestions(
    message: string,
    context: AIContext
  ): Promise<AIResponse> {
    // If AI not configured, provide manual guidance
    if (!aiProvider.isConfigured()) {
      return {
        content: `**Edit Mode**\n\nI'm ready to help you edit! To get started:\n• Select a block to edit it\n• Tell me what changes you want to make\n• I can organize, clean, and improve your content\n\n*Tip: Configure AI in settings for intelligent editing.*`,
        metadata: { type: 'edit_operation' },
      };
    }

    try {
      // Build context description
      let contextDesc = 'General editing request';
      if (context.blockId) {
        contextDesc = `Editing a ${context.blockType || 'block'}`;
      } else if (context.noteId) {
        contextDesc = 'Editing a note';
      }

      // Generate AI suggestions
      const aiResponse = await aiProvider.generateCompletion([
        {
          role: 'system',
          content: `You are a helpful editing assistant. Provide practical suggestions for editing content based on the user's request. Be concise and actionable.`,
        },
        {
          role: 'user',
          content: `Context: ${contextDesc}\nUser request: ${message}\n\nProvide helpful suggestions for making these edits.`,
        },
      ]);

      return {
        content: `**Edit Suggestions**\n\n${aiResponse.content}`,
        metadata: {
          type: 'edit_operation',
          suggestedFollowUps: [
            'Show me how to apply this',
            'Alternative approach',
            'More details',
          ],
        },
      };
    } catch (error) {
      console.error('Edit suggestions error:', error);
      return {
        content: `**Edit Mode**\n\nI'm ready to help with: "${message}"\n\n• Select a block or note to edit\n• Tell me specific changes you want\n• I can help organize and improve content\n\n*Tip: ${error instanceof Error ? error.message : 'Configure AI in settings for better suggestions.'}*`,
        metadata: { type: 'edit_operation' },
      };
    }
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
