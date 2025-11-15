import { useAIStore } from '@/store/aiStore';
import { useBlocksStore } from '@/store/blocksStore';
import { searchWeb, type SearchResult } from './webSearch';
import { tauriAI, type Tool } from './tauriAI';

/**
 * AI Edit Service
 *
 * Provides streaming AI capabilities for direct canvas editing.
 * Integrates with tauriAI for real AI backend, with mock implementation for development.
 */

// Tool definitions for AI function calling
export const AI_EDIT_TOOLS: Tool[] = [
  {
    type: 'function' as const,
    function: {
      name: 'edit_block',
      description: 'Edit the content of a text block on the canvas. Use this when the user asks you to add, modify, or improve content.',
      parameters: {
        type: 'object',
        properties: {
          block_id: {
            type: 'string',
            description: 'The ID of the block to edit',
          },
          new_content: {
            type: 'string',
            description: 'The new content for the block',
          },
          reason: {
            type: 'string',
            description: 'Brief explanation of why you made these changes',
          },
        },
        required: ['block_id', 'new_content', 'reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_web',
      description: 'Search the web for current information. Use this when you need up-to-date facts, research, or information not in your training data.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
        },
        required: ['query'],
      },
    },
  },
];

interface StreamChatOptions {
  blockId: string;
  userMessage: string;
  onStream?: (chunk: string) => void;
  onToolCall?: (toolName: string, args: any) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Stream AI chat with editing capabilities
 * Integrates with tauriAI when available, falls back to mock
 */
export async function streamAIEditChat(options: StreamChatOptions): Promise<void> {
  const { userMessage, onComplete, onError } = options;
  const aiStore = useAIStore.getState();

  try {
    aiStore.setLoading(true);
    aiStore.setCurrentRequest(userMessage);

    // Add user message
    aiStore.addMessage({
      role: 'user',
      content: userMessage,
    });

    // Check if tauriAI is initialized
    const useTauriAI = tauriAI.isInitialized();

    if (useTauriAI) {
      // Use real tauriAI service
      await streamWithTauriAI(options);
    } else {
      // Use mock implementation for development
      await streamWithMock(options);
    }

    onComplete?.();
  } catch (error) {
    console.error('AI edit stream error:', error);
    onError?.(error as Error);
    aiStore.addMessage({
      role: 'assistant',
      content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  } finally {
    aiStore.setLoading(false);
    aiStore.setCurrentRequest(null);
  }
}

/**
 * Stream with real Tauri AI backend
 */
async function streamWithTauriAI(options: StreamChatOptions): Promise<void> {
  const { blockId, userMessage, onStream, onToolCall } = options;
  const aiStore = useAIStore.getState();
  const blocksStore = useBlocksStore.getState();

  onStream?.('Using AI backend...\n');

  // TODO: Implement streaming chat with tools
  // For now, use chatWithTools method
  try {
    const result = await tauriAI.chatWithTools(
      [{ role: 'user', content: userMessage }],
      AI_EDIT_TOOLS
    );

    aiStore.addMessage({
      role: 'assistant',
      content: result.content,
      toolCalls: result.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
      })),
    });

    // Handle tool calls
    if (result.tool_calls && result.tool_calls.length > 0) {
      for (const toolCall of result.tool_calls) {
        onToolCall?.(toolCall.name, toolCall.arguments);

        if (toolCall.name === 'edit_block') {
          const block = blocksStore.blocks.find((b) => b.id === blockId);
          if (block) {
            aiStore.addPendingEdit({
              blockId,
              originalContent: (block.data as any).content || '',
              proposedContent: toolCall.arguments.new_content,
              reason: toolCall.arguments.reason || 'AI-generated content',
            });
          }
        } else if (toolCall.name === 'search_web') {
          const results = await searchWeb(toolCall.arguments.query);
          onStream?.(`\n✅ Found ${results.length} results\n`);
        }
      }
    }
  } catch (error) {
    console.error('TauriAI error:', error);
    throw error;
  }
}

/**
 * Mock streaming implementation for development
 */
async function streamWithMock(options: StreamChatOptions): Promise<void> {
  const { blockId, userMessage, onStream, onToolCall } = options;
  const aiStore = useAIStore.getState();
  const blocksStore = useBlocksStore.getState();

  // Simulate streaming thinking process
  const thinkingSteps = [
    'Analyzing your request...',
    'Understanding the context...',
    'Preparing response...',
  ];

  for (const step of thinkingSteps) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    onStream?.(step + '\n');
  }

  // Detect intent and call appropriate function
  const lowerMessage = userMessage.toLowerCase();

  // Check if web search is needed
  if (
    lowerMessage.includes('search') ||
    lowerMessage.includes('latest') ||
    lowerMessage.includes('current') ||
    lowerMessage.includes('what is') ||
    lowerMessage.includes('tell me about')
  ) {
    // Extract search query
    const searchQuery = extractSearchQuery(userMessage);

    onStream?.(`\n🔍 Searching web for: "${searchQuery}"\n`);
    onToolCall?.('search_web', { query: searchQuery });

    // Perform web search
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const searchResults = await searchWeb(searchQuery);

    onStream?.(`\n✅ Found ${searchResults.length} results\n`);
    onStream?.(`\n📝 Generating content from sources...\n`);

    // Generate content based on search results
    const generatedContent = await generateContentFromSearch(searchQuery, searchResults);

    // Get current block
    const block = blocksStore.blocks.find((b) => b.id === blockId);
    if (!block) {
      throw new Error('Block not found');
    }

    // Call edit_block tool
    onToolCall?.('edit_block', {
      block_id: blockId,
      new_content: generatedContent,
      reason: `Added comprehensive information about "${searchQuery}" based on web research`,
    });

    // Add to pending edits
    aiStore.addPendingEdit({
      blockId,
      originalContent: (block.data as any).content || '',
      proposedContent: generatedContent,
      reason: `Added information about "${searchQuery}"`,
    });

    // Add assistant message
    aiStore.addMessage({
      role: 'assistant',
      content: `I've researched "${searchQuery}" and prepared an edit with the latest information. Review the changes and accept or reject them.`,
      toolCalls: [
        {
          id: `call-${Date.now()}`,
          name: 'edit_block',
          arguments: {
            block_id: blockId,
            new_content: generatedContent,
            reason: `Research on ${searchQuery}`,
          },
        },
      ],
    });
  } else if (
    lowerMessage.includes('add') ||
    lowerMessage.includes('write') ||
    lowerMessage.includes('create')
  ) {
    // Direct edit request
    const content = generateContentFromPrompt(userMessage);

    const block = blocksStore.blocks.find((b) => b.id === blockId);
    if (!block) {
      throw new Error('Block not found');
    }

    onToolCall?.('edit_block', {
      block_id: blockId,
      new_content: content,
      reason: 'Generated content based on user request',
    });

    aiStore.addPendingEdit({
      blockId,
      originalContent: (block.data as any).content || '',
      proposedContent: content,
      reason: 'AI-generated content',
    });

    aiStore.addMessage({
      role: 'assistant',
      content: `I've created the content you requested. Review and accept if it looks good.`,
    });
  } else {
    // General conversation
    aiStore.addMessage({
      role: 'assistant',
      content: `I can help you edit this block. Try asking me to:\n• Research and add information about a topic\n• Write specific content\n• Improve or expand existing text\n\nWhat would you like me to do?`,
    });
  }
}

/**
 * Extract search query from user message
 */
function extractSearchQuery(message: string): string {
  const cleaned = message
    .toLowerCase()
    .replace(/^(search for|tell me about|what is|what are|explain|describe)\s+/i, '')
    .replace(/\?$/g, '')
    .trim();

  return cleaned || message;
}

/**
 * Generate content from search results
 */
async function generateContentFromSearch(query: string, results: SearchResult[]): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const title = `# ${query.charAt(0).toUpperCase() + query.slice(1)}\n\n`;
  const intro = `Based on the latest research and information from ${results.length} sources:\n\n`;

  const mainContent = results
    .map((result, idx) => {
      const sectionTitle = result.title
        .replace(new RegExp(query, 'gi'), '')
        .replace(/^[\s\-:|]+/, '')
        .replace(/[\s\-:|]+$/, '')
        .trim() || `Source ${idx + 1}`;

      return `## ${sectionTitle}\n\n${result.snippet}\n\n*Source: ${result.source || new URL(result.url).hostname}${result.publishedDate ? ` | ${result.publishedDate}` : ''}*\n`;
    })
    .join('\n');

  const keyTakeaways = generateKeyTakeaways(results);
  const footer = `\n## Summary\n\n${keyTakeaways}\n\n---\n*Information compiled from ${results.length} authoritative sources | Generated on ${new Date().toLocaleDateString()}*`;

  return title + intro + mainContent + footer;
}

/**
 * Generate key takeaways from search results
 */
function generateKeyTakeaways(_results: SearchResult[]): string {
  const takeaways = [
    'Multiple authoritative sources confirm the fundamental concepts',
    'Recent research continues to expand our understanding of this topic',
    'Current scientific consensus is based on extensive observation and study',
  ];

  return takeaways.map((point) => `• ${point}`).join('\n');
}

/**
 * Generate content from direct prompt
 */
function generateContentFromPrompt(prompt: string): string {
  return `# AI-Generated Content\n\nBased on your request: "${prompt}"\n\n${prompt}\n\nThis content was generated by AI. Feel free to edit or modify as needed.`;
}

/**
 * Apply accepted edit to block
 */
export async function applyEdit(editId: string): Promise<void> {
  const aiStore = useAIStore.getState();
  const blocksStore = useBlocksStore.getState();

  const edit = aiStore.pendingEdits.find((e) => e.id === editId);
  if (!edit) {
    throw new Error('Edit not found');
  }

  const block = blocksStore.blocks.find((b) => b.id === edit.blockId);
  if (!block) {
    throw new Error('Block not found');
  }

  // Update block content
  const updatedData = {
    ...block.data,
    content: edit.proposedContent,
  };

  // Update in store
  blocksStore.updateBlock(edit.blockId, { data: updatedData });

  // Update in database
  const { updateBlock } = await import('@/utils/tauri');
  await updateBlock(edit.blockId, updatedData);

  // Mark edit as accepted
  aiStore.acceptEdit(editId);

  console.log('✅ Edit applied successfully');
}

/**
 * Reject edit
 */
export function rejectEdit(editId: string): void {
  const aiStore = useAIStore.getState();
  aiStore.rejectEdit(editId);
  console.log('❌ Edit rejected');
}
