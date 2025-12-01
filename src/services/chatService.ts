import { tauriAI, type Message } from './tauriAI';
import { useTransitionStore } from '@/store/transitionStore';
import { useBlocksStore } from '@/store/blocksStore';
import { createBlock } from '@/utils/tauri';
import { streamAIEditChat } from './aiEditService';
import type { TextBlockData } from '@/types';

/**
 * Chat Service
 *
 * Handles AI chat functionality in StartingPage
 * - Regular chat (no note context)
 * - Chat with note context (@mention)
 * - Manages conversation history
 * - Converts highlights to context
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  noteId?: string; // If this message involves a note
}

/**
 * Convert chat messages to AI messages format
 */
function convertToAIMessages(messages: ChatMessage[]): Message[] {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Build context from captured highlights
 */
function buildHighlightsContext(): string {
  const { capturedHighlights } = useTransitionStore.getState();

  if (capturedHighlights.length === 0) {
    return '';
  }

  const highlightsText = capturedHighlights
    .map((h, idx) => `[${idx + 1}] "${h.text}"`)
    .join('\n');

  return `

IMPORTANT CONTEXT (for reference only - DO NOT repeat this in your output):
The user has highlighted the following existing content from the note:
${highlightsText}

Use this as context to understand what already exists. Generate ONLY the NEW content requested - do not include the highlighted text in your output.`;
}

/**
 * System prompt for chat - includes LaTeX formatting rules
 */
const CHAT_SYSTEM_PROMPT = `You are an intelligent AI assistant in a note-taking app.

**CRITICAL: LaTeX FORMATTING RULES**
When writing mathematical formulas or equations:
- ✅ USE: Single dollar signs for inline math: $x^2 + y^2 = r^2$
- ✅ USE: Double dollar signs for display/block math ON A SINGLE LINE:
  $$E = mc^2$$
  $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$

CRITICAL RULES:
- ❌ NEVER use: \\[ ... \\] or [ ... ] for display math
- ❌ NEVER use: \\( ... \\) or ( ... ) for inline math  
- ❌ NEVER use: Plain brackets like [ V = \\frac{1}{3} B h ]
- ❌ NEVER split a formula across multiple lines - keep entire formula on ONE line
- ❌ NEVER put text immediately after closing $$

CORRECT (single line, text separated):
$$ds^2 = -c^2 dt^2 + dr^2 + r^2 d\\Omega^2$$

where the terms represent time, radial, and angular components.

WRONG (split across lines):
$$ds^2 = -c^2 dt^2 
+ dr^2$$

WRONG (text immediately after $$):
$$E = mc^2$$ where E is energy

Be helpful, concise, and format your responses with proper markdown.`;

/**
 * Regular chat (no note context)
 */
export async function sendChatMessage(
  conversationHistory: ChatMessage[],
  userMessage: string
): Promise<string> {
  try {
    console.log('💬 Sending chat message to AI...');

    // Convert to AI messages format with system prompt
    const messages: Message[] = [
      {
        role: 'system',
        content: CHAT_SYSTEM_PROMPT,
      },
      ...convertToAIMessages(conversationHistory),
      {
        role: 'user',
        content: userMessage,
      }
    ];

    // Get AI response
    const response = await tauriAI.chat(messages);
    console.log('✅ AI response received');

    return response;
  } catch (error) {
    console.error('❌ Chat failed:', error);
    throw error;
  }
}

/**
 * Chat with note context (@mention)
 * This triggers AI editing of the mentioned note by creating a new block and using AI tools
 */
export async function chatWithNoteEdit(
  noteId: string,
  noteName: string,
  userMessage: string,
  _conversationHistory: ChatMessage[] // Unused for now, will be used for context in future
): Promise<string> {
  try {
    console.log(`📝 Chat with note context: "${noteName}" (${noteId})`);
    console.log(`💬 User message: "${userMessage}"`);

    // Build context from highlights
    const highlightsContext = buildHighlightsContext();

    // Build full message with explicit instructions
    let fullMessage = userMessage;

    if (highlightsContext) {
      // If there are highlights, add them as context with clear instructions
      fullMessage = `${userMessage}

${highlightsContext}

Remember: Create ONLY new content. The highlighted text is just for reference - don't repeat it in your response.`;
    }

    // Step 1: Create a new empty text block in the note
    console.log('📦 Creating new block in note...');

    const newBlockData: TextBlockData = {
      type: 'text',
      content: '', // Start empty, AI will fill it
    };

    const newBlock = await createBlock({
      note_id: noteId,
      type: 'text',
      data: newBlockData,
    });

    console.log(`✅ New block created: ${newBlock.id} in note ${noteId}`);

    // Add block to store so UI updates immediately
    useBlocksStore.getState().addBlock(newBlock);
    console.log(`📊 Block added to store. Total blocks: ${useBlocksStore.getState().blocks.length}`);

    // Step 2: Trigger AI editing on this block using streamAIEditChat
    // This will use AI tools to edit the block and create a pending edit
    return new Promise((resolve, reject) => {
      console.log(`🤖 Starting AI edit on block ${newBlock.id}...`);
      
      streamAIEditChat({
        blockId: newBlock.id,
        userMessage: fullMessage,
        onStream: (chunk) => {
          // Only log non-empty chunks
          if (chunk.trim()) {
            console.log('📝 AI stream:', chunk.substring(0, 100));
          }
        },
        onComplete: () => {
          console.log('✅ AI editing complete');
          // Clear highlights after using them
          useTransitionStore.getState().clearHighlights();

          // Return a success message
          resolve(`I've added content to "${noteName}". You can review the changes in the preview panel.`);
        },
        onError: (error) => {
          console.error('❌ AI editing failed:', error);
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error('❌ Note context chat failed:', error);
    throw error;
  }
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a chat message object
 */
export function createChatMessage(
  role: 'user' | 'assistant' | 'system',
  content: string,
  noteId?: string
): ChatMessage {
  return {
    id: generateMessageId(),
    role,
    content,
    timestamp: Date.now(),
    noteId,
  };
}

/**
 * Check if AI is initialized and ready
 */
export async function checkAIReady(): Promise<boolean> {
  try {
    const health = await tauriAI.healthCheck();
    return health.agent_service;
  } catch (error) {
    console.error('❌ AI health check failed:', error);
    return false;
  }
}
