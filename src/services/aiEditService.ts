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

/**
 * Trim conversation history to prevent context window overflow
 * Keeps system prompt + recent messages within character limit
 */
function trimConversationHistory(history: any[], maxChars: number): any[] {
  if (history.length === 0) return history;

  const systemPrompt = history[0]?.role === 'system' ? history[0] : null;
  const messages = systemPrompt ? history.slice(1) : history;

  let totalChars = systemPrompt ? systemPrompt.content.length : 0;
  const trimmedMessages: any[] = [];

  // Add messages from most recent, working backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgLength = JSON.stringify(msg).length;

    if (totalChars + msgLength > maxChars) {
      console.log(`⚠️ Conversation history trimmed: kept ${trimmedMessages.length} of ${messages.length} messages`);
      break;
    }

    trimmedMessages.unshift(msg);
    totalChars += msgLength;
  }

  // Always include system prompt at the beginning
  return systemPrompt ? [systemPrompt, ...trimmedMessages] : trimmedMessages;
}

// Tool definitions for AI function calling
export const AI_EDIT_TOOLS: Tool[] = [
  {
    type: 'function' as const,
    function: {
      name: 'read_block',
      description: 'Read the content of ANY block by its ID. Use this to read other blocks (not the current one shown in context).',
      parameters: {
        type: 'object',
        properties: {
          block_id: {
            type: 'string',
            description: 'The ID of the block to read',
          },
        },
        required: ['block_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_note',
      description: 'Read the ENTIRE note with ALL blocks (text, headings, databases, artifacts, etc). Use this when you need to understand the full context of a note.',
      parameters: {
        type: 'object',
        properties: {
          note_id: {
            type: 'string',
            description: 'The ID of the note to read',
          },
        },
        required: ['note_id'],
      },
    },
  },
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
    console.log('🚀 streamAIEditChat called with:', userMessage);
    aiStore.setLoading(true);
    aiStore.setCurrentRequest(userMessage);

    // Add user message
    aiStore.addMessage({
      role: 'user',
      content: userMessage,
    });

    // Check if tauriAI is initialized
    const useTauriAI = tauriAI.isInitialized();
    console.log('🔍 TauriAI initialized:', useTauriAI);

    if (useTauriAI) {
      // Use real tauriAI service
      console.log('✅ Using real TauriAI backend');
      await streamWithTauriAI(options);
    } else {
      // Use mock implementation for development
      console.log('⚠️ Using mock implementation');
      await streamWithMock(options);
    }

    console.log('✅ Stream completed successfully');
    onComplete?.();
  } catch (error) {
    console.error('❌ AI edit stream error:', error);
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

  console.log('🎯 streamWithTauriAI: blockId =', blockId);
  onStream?.('Using AI backend...\n');

  // Get current block and its note_id
  const currentBlock = blocksStore.blocks.find((b) => b.id === blockId);
  const noteId = currentBlock?.note_id || 'unknown';

  // Get current block content first
  let currentBlockContent = '[Empty block]';
  try {
    console.log('📖 Reading current block content:', blockId);
    currentBlockContent = await tauriAI.readBlock(blockId);
    console.log('📄 Current block content:', currentBlockContent);
  } catch (error) {
    console.error('⚠️ Failed to read current block:', error);
    // Try to get from store as fallback
    if (currentBlock && currentBlock.data) {
      currentBlockContent = (currentBlock.data as any).content || (currentBlock.data as any).text || '[Could not read block content]';
    }
  }

  // System prompt that instructs AI to use tools
  const systemPrompt = `You are an AI agent that helps users edit their notes.

CURRENT CONTEXT:
- Current Block ID: ${blockId}
- Current Note ID: ${noteId}

CURRENT BLOCK CONTENT:
\`\`\`
${currentBlockContent}
\`\`\`

Available tools:
- read_block: Read content of ANY block by its block_id (for reading OTHER blocks)
- read_note: Read the ENTIRE note with ALL blocks (use note_id: ${noteId} to read the full note this block belongs to)
- edit_block: Propose content changes to a block
- search_web: Search for current information when needed

IMPORTANT Instructions:
1. The CURRENT BLOCK CONTENT is shown above - this is what the user is working with
2. When user asks "what's my note about", you can:
   - Refer to the CURRENT BLOCK CONTENT shown above, OR
   - Use read_note with note_id: ${noteId} to see the FULL note with ALL blocks (recommended for complete context)
3. When user asks to "add more tips" or "improve content":
   - Analyze the CURRENT BLOCK CONTENT shown above
   - Use edit_block with block_id: ${blockId} to propose new content
4. Use read_block if you need to read OTHER specific blocks
5. Use search_web for current events or research
6. For edit_block, ALWAYS provide the complete new content (not just additions) and a clear reason

The current block can be: text, heading, database table, or code artifact. All types are readable.`;

  // Multi-turn conversation with tools
  try {
    // Initialize conversation history
    const conversationHistory: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    let maxTurns = 5; // Prevent infinite loops
    let currentTurn = 0;

    while (currentTurn < maxTurns) {
      currentTurn++;
      console.log(`📞 Turn ${currentTurn}: Calling tauriAI.chatWithTools...`);

      // Trim conversation history if it gets too long
      // Conservative estimate: 1 char ≈ 0.25 tokens, limit to ~50K tokens
      const trimmedHistory = trimConversationHistory(conversationHistory, 200000); // 200K chars ≈ 50K tokens

      const result = await tauriAI.chatWithTools(trimmedHistory, AI_EDIT_TOOLS);

      console.log('📥 Got result:', result);
      console.log('🔧 Tool calls:', result.tool_calls);

      // Add assistant's response to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: result.content,
      });

      // Show assistant message to user
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
        console.log(`🛠️ Processing ${result.tool_calls.length} tool calls`);

        let shouldContinue = false;

        for (const toolCall of result.tool_calls) {
          // OpenAI returns: { function: { name: "...", arguments: "..." } }
          const functionName = (toolCall as any).function?.name || toolCall.name;
          const functionArgs = (toolCall as any).function?.arguments || toolCall.arguments;

          // Parse arguments if it's a JSON string
          const parsedArgs = typeof functionArgs === 'string'
            ? JSON.parse(functionArgs)
            : functionArgs;

          console.log(`🔨 Tool call: ${functionName}`, parsedArgs);
          onToolCall?.(functionName, parsedArgs);

          if (functionName === 'read_block') {
            console.log('📖 Reading block:', parsedArgs.block_id);
            try {
              const blockContent = await tauriAI.readBlock(parsedArgs.block_id);
              console.log('📄 Block content:', blockContent);

              // Add tool result to conversation
              conversationHistory.push({
                role: 'user',
                content: `[Block ${parsedArgs.block_id} content]:\n${blockContent}`,
              });

              shouldContinue = true;
              onStream?.(`\n📖 Read block content (${blockContent.length} chars)\n`);
            } catch (error) {
              console.error('❌ Failed to read block:', error);
              conversationHistory.push({
                role: 'user',
                content: `[Error reading block]: ${error}`,
              });
            }
          } else if (functionName === 'read_note') {
            console.log('📚 Reading entire note:', parsedArgs.note_id);
            try {
              const noteContent = await tauriAI.getNoteContext(parsedArgs.note_id);
              console.log('📝 Note content:', noteContent);

              // Add tool result to conversation
              conversationHistory.push({
                role: 'user',
                content: `[Full note content]:\n${noteContent}`,
              });

              shouldContinue = true;
              onStream?.(`\n📚 Read full note (${noteContent.length} chars)\n`);
            } catch (error) {
              console.error('❌ Failed to read note:', error);
              conversationHistory.push({
                role: 'user',
                content: `[Error reading note]: ${error}`,
              });
            }
          } else if (functionName === 'edit_block') {
            const block = blocksStore.blocks.find((b) => b.id === blockId);
            console.log('📝 Found block:', block);
            if (block) {
              console.log('✏️ Adding pending edit');
              aiStore.addPendingEdit({
                blockId,
                originalContent: (block.data as any).content || '',
                proposedContent: parsedArgs.new_content,
                reason: parsedArgs.reason || 'AI-generated content',
              });
            } else {
              console.error('❌ Block not found:', blockId);
            }
          } else if (functionName === 'search_web') {
            const results = await searchWeb(parsedArgs.query);
            onStream?.(`\n✅ Found ${results.length} results\n`);

            // Add search results to conversation
            const searchSummary = results.slice(0, 3).map(r =>
              `- ${r.title}: ${r.snippet}`
            ).join('\n');

            conversationHistory.push({
              role: 'user',
              content: `[Search results for "${parsedArgs.query}"]: \n${searchSummary}`,
            });

            shouldContinue = true;
          }
        }

        // If we executed a tool that needs follow-up, continue the conversation
        if (shouldContinue) {
          continue;
        } else {
          // If edit_block was called, we're done
          break;
        }
      } else {
        // No tool calls, we're done
        console.log('✅ No more tool calls, conversation complete');
        break;
      }
    }

    if (currentTurn >= maxTurns) {
      console.warn('⚠️ Max turns reached, ending conversation');
    }
  } catch (error) {
    console.error('❌ TauriAI error:', error);
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
    lowerMessage.includes('create') ||
    lowerMessage.includes('make')
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
