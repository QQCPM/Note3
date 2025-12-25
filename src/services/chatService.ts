import { tauriAI, type Message } from './tauriAI';
import { useTransitionStore } from '@/store/transitionStore';
import { useBlocksStore } from '@/store/blocksStore';
import { createBlock } from '@/utils/tauri';
import { streamAIEditChat } from './aiEditService';
import { processSecretaryMessage, isPlanningRequest } from './secretaryService';
import type { TextBlockData } from '@/types';

/**
 * Chat Service
 *
 * Handles AI chat functionality in StartingPage
 * - Regular chat (no note context)
 * - Planning/scheduling (routed to Secretary)
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
  isSecretary?: boolean; // If this came from secretary service
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
 * Routes planning requests to Secretary Service
 */
export async function sendChatMessage(
  conversationHistory: ChatMessage[],
  userMessage: string
): Promise<string> {
  try {
    // Check if this is a planning/scheduling request
    if (isPlanningRequest(userMessage)) {
      console.log('📅 Detected planning request, routing to Secretary...');

      const secretaryResponse = await processSecretaryMessage(
        userMessage,
        convertToAIMessages(conversationHistory)
      );

      // Return the secretary's message
      // The actions are logged for debugging, could be used for UI feedback
      if (secretaryResponse.actions.length > 0) {
        console.log('🔧 Secretary actions:', secretaryResponse.actions);
      }

      return secretaryResponse.message;
    }

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
 * Chat with note context (@mention) for DATABASE notes
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
 * Chat with generated note context (@mention) for GENERATED notes (localStorage only)
 * This creates a pending edit for review before applying to the note
 */
export async function chatWithGeneratedNote(
  noteId: string,
  noteName: string,
  noteContent: string,
  userMessage: string
): Promise<{ response: string; newContent: string | null }> {
  try {
    console.log(`📝 Chat with generated note: "${noteName}" (${noteId})`);
    console.log(`📄 Note content length: ${noteContent.length} chars`);

    // Build a prompt that includes the note content and asks AI to generate/update
    const systemPrompt = `${CHAT_SYSTEM_PROMPT}

You are helping the user with a note titled "${noteName}".

CURRENT NOTE CONTENT:
---
${noteContent}
---

The user wants you to help with this note. Based on their request:
1. If they ask to add content, generate the NEW content to add
2. If they ask to modify, provide the UPDATED version
3. If they ask questions about the note, answer based on the content

Format your response as follows:
- First, provide a brief explanation of what you did
- Then, if you generated new content, include it in a section marked with:
  ===NEW CONTENT START===
  (your generated content here)
  ===NEW CONTENT END===

This allows the content to be automatically added to the note.`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    console.log('🤖 Sending to AI...');
    const response = await tauriAI.chat(messages);
    console.log('✅ AI response received');

    // Extract new content if present
    let newContent: string | null = null;
    const newContentMatch = response.match(/===NEW CONTENT START===([\s\S]*?)===NEW CONTENT END===/);

    if (newContentMatch) {
      newContent = newContentMatch[1].trim();
      console.log(`📝 New content extracted: ${newContent.length} chars`);

      // DON'T save yet - create a pending edit instead
      // The pending edit will be created by the caller and shown in preview panel
    }

    // Clean response for display (remove the markers)
    const cleanResponse = response
      .replace(/===NEW CONTENT START===[\s\S]*?===NEW CONTENT END===/, '')
      .trim();

    return {
      response: cleanResponse || `I've prepared new content for "${noteName}". Review the changes in the preview panel and click Accept to apply.`,
      newContent
    };
  } catch (error) {
    console.error('❌ Generated note chat failed:', error);
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
