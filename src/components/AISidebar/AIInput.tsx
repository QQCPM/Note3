import React, { useState, useRef, useMemo } from 'react';
import { useNotesStore, useBlocksStore } from '@/store';
import { useAIStore, type AIMessage } from '@/store/aiStore';
import { useUIStore } from '@/store/uiStore';
import { streamAIEditChat } from '@/services/aiEditService';
import { createBlock } from '@/utils/tauri';
import { ArrowUp, Paperclip, Globe, FileText, Loader2, AtSign } from 'lucide-react';
import type { NoteWithChildren } from '@/types';

// Helper to flatten note tree
const flattenNotes = (notes: NoteWithChildren[]): NoteWithChildren[] => {
  const result: NoteWithChildren[] = [];
  const traverse = (items: NoteWithChildren[]) => {
    for (const item of items) {
      result.push(item);
      if (item.children) traverse(item.children);
    }
  };
  traverse(notes);
  return result;
};

// Helper to convert AIMessage[] to simple format for API
const convertMessagesToHistory = (messages: AIMessage[]): Array<{ role: string; content: string }> => {
  return messages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
};

interface AIInputProps {
  windowId?: string;
}

const AIInput: React.FC<AIInputProps> = ({ windowId }) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { activeNoteId, getNoteById, notes } = useNotesStore();
  const { blocks, addBlock } = useBlocksStore();
  const {
    addMessage,
    activeNoteId: aiActiveNoteId,
    globalSession,
    noteSessions
  } = useAIStore();
  const { getWindowById } = useUIStore();
  const activeNote = activeNoteId ? getNoteById(activeNoteId) : null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get current session messages for conversation history
  const getCurrentSessionMessages = (): AIMessage[] => {
    const session = aiActiveNoteId
      ? noteSessions[aiActiveNoteId]
      : globalSession;

    if (!session) return [];

    // Use window's activeTabId if available
    const windowData = windowId ? getWindowById(windowId) : null;
    const activeTabId = windowData?.activeTabId || session.activeTabId;
    const activeTab = session.tabs.find(t => t.id === activeTabId);
    return activeTab?.messages || [];
  };

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Flatten notes for searching
  const allNotes = useMemo(() => flattenNotes(notes), [notes]);

  // Filter notes based on mention query
  const mentionResults = useMemo(() => {
    if (!mentionQuery) return [];
    return allNotes
      .filter(n => n.title?.toLowerCase().includes(mentionQuery.toLowerCase()))
      .slice(0, 6);
  }, [mentionQuery, allNotes]);

  // Get or create target block for Agent mode
  const getTargetBlock = async () => {
    if (!activeNoteId) return null;

    // Find first text block in active note
    const noteBlocks = blocks.filter((b) => b.note_id === activeNoteId);
    const textBlocks = noteBlocks.filter((b) => b.type === 'text');

    if (textBlocks.length > 0) {
      return textBlocks[textBlocks.length - 1];
    }

    // No text blocks - create one
    try {
      const newBlock = await createBlock({
        note_id: activeNoteId,
        type: 'text',
        position: noteBlocks.length,
        data: { type: 'text', content: '' },
      });
      addBlock(newBlock);
      return newBlock;
    } catch (error) {
      console.error('Failed to create target block:', error);
      return null;
    }
  };

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage('');
    setMentionQuery(null);
    setIsLoading(true);

    await handleSmartAgent(userMessage);
    setIsLoading(false);
  };

  const handleSmartAgent = async (userMessage: string) => {
    // Get conversation history BEFORE adding the new user message
    const previousMessages = getCurrentSessionMessages();
    const conversationHistory = convertMessagesToHistory(previousMessages);

    console.log(`💬 Conversation history: ${conversationHistory.length} messages`);

    addMessage({
      role: 'user',
      content: userMessage,
    });

    // Global mode: No active note - use chat with memory file tools
    if (!activeNoteId) {
      console.log('🌐 AIInput: Global mode (no active note) - using streamGlobalChat');

      try {
        // Import the global chat function which has memory file tools
        const { streamGlobalChat } = await import('@/services/aiEditService');

        await streamGlobalChat({
          userMessage: userMessage,
          conversationHistory: conversationHistory,
          onStream: (chunk) => {
            console.log('📥 Global chat stream:', chunk.substring(0, 50));
          },
          onComplete: () => {
            console.log('✅ Global chat completed');
          },
          onError: (error) => {
            console.error('❌ Global chat error:', error);
          },
        });
      } catch (error) {
        console.error('❌ Global chat error:', error);
        const aiStore = useAIStore.getState();
        aiStore.clearCurrentThinking();
        aiStore.setLoading(false);
        addMessage({
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        });
      }
      return;
    }

    // Note mode: Use block editing with streamAIEditChat
    const targetBlock = await getTargetBlock();
    if (!targetBlock) {
      addMessage({
        role: 'assistant',
        content: 'Error: Failed to get target block.',
      });
      return;
    }

    console.log('🚀 AIInput: Sending message to AI:', userMessage);

    await streamAIEditChat({
      blockId: targetBlock?.id || '',
      userMessage: userMessage,
      conversationHistory: conversationHistory, // Pass conversation history!
      onStream: (chunk) => {
        console.log('📥 AIInput: Received chunk:', chunk.substring(0, 50));
      },
      onToolCall: (toolName, args) => {
        console.log('🔧 AIInput: Tool called:', toolName, args);
      },
      onComplete: () => {
        console.log('✅ AIInput: Stream completed');
      },
      onError: (error) => {
        console.error('❌ AIInput: Stream error:', error);
        addMessage({
          role: 'assistant',
          content: `Error: ${error.message}`,
        });
      },
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setMessage(value);
    setCursorPosition(cursorPos);

    // Check for @mention trigger
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Only show autocomplete if no space after @ (typing a mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionQuery(textAfterAt);
        setMentionIndex(0);
        return;
      }
    }

    setMentionQuery(null);
  };

  const insertMention = (note: NoteWithChildren) => {
    const textBeforeCursor = message.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const textAfterCursor = message.slice(cursorPosition);

    // Replace @query with @NoteName
    const newMessage =
      message.slice(0, lastAtIndex) +
      `@${note.title} ` +
      textAfterCursor;

    setMessage(newMessage);
    setMentionQuery(null);

    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention navigation
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionResults.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    // Normal Enter handling
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-3 pb-3 relative">
      {/* @mention autocomplete dropdown */}
      {mentionQuery !== null && mentionResults.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-2 py-1.5 text-xs text-[#6e7681] border-b border-[#30363d] flex items-center gap-1.5">
            <AtSign size={12} />
            Reference a note
          </div>
          <div className="max-h-48 overflow-y-auto">
            {mentionResults.map((note, idx) => (
              <button
                key={note.id}
                onClick={() => insertMention(note)}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${idx === mentionIndex
                  ? 'bg-[#21262d] text-[#58a6ff]'
                  : 'text-[#c9d1d9] hover:bg-[#21262d]'
                  }`}
              >
                <span className="text-base">{note.icon || '📄'}</span>
                <span className="truncate">{note.title || 'Untitled'}</span>
                {note.id === activeNoteId && (
                  <span className="ml-auto text-xs text-[#6e7681]">(current)</span>
                )}
              </button>
            ))}
          </div>
          {mentionResults.length === 0 && mentionQuery && (
            <div className="px-3 py-2 text-sm text-[#6e7681]">
              No notes found for "{mentionQuery}"
            </div>
          )}
        </div>
      )}

      <div className="bg-[#0d1117] rounded-lg border border-[#21262d] p-3 flex flex-col gap-2 transition-all hover:border-[#30363d]">
        {/* Context indicator */}
        {activeNote && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <FileText className="w-3 h-3 text-[#58a6ff]" />
            <span className="text-xs text-[#7d8590] truncate flex-1">{activeNote.title}</span>
          </div>
        )}

        {/* Text input */}
        <textarea
          ref={textareaRef}
          className="w-full bg-transparent border-none outline-none text-[#c9d1d9] text-sm placeholder-[#6e7681] resize-none min-h-[44px] max-h-[120px] px-1"
          placeholder={activeNote ? "Ask about this note... (@ to reference)" : "What's on your mind?"}
          rows={2}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />

        {/* Action row */}
        <div className="flex items-center justify-between pt-1 px-1">
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 text-[#6e7681] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded-md transition-colors"
              title="Attach file"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
            <button
              className="flex items-center gap-1.5 px-2 py-1 text-[#6e7681] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded-md transition-colors text-xs"
              title="Web search"
            >
              <Globe className="w-3 h-3" />
              <span className="hidden sm:inline">Search</span>
            </button>
            <button
              onClick={() => {
                setMessage(m => m + '@');
                setMentionQuery('');
                textareaRef.current?.focus();
              }}
              className="flex items-center gap-1.5 px-2 py-1 text-[#6e7681] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded-md transition-colors text-xs"
              title="Reference another note"
            >
              <AtSign className="w-3 h-3" />
              <span className="hidden sm:inline">Mention</span>
            </button>
          </div>

          <button
            onClick={handleSend}
            disabled={!message.trim() || isLoading}
            className={`p-1.5 rounded-full transition-all duration-200 ${message.trim() && !isLoading
              ? 'bg-[#238636] text-white hover:bg-[#2ea043]'
              : 'bg-[#21262d] text-[#6e7681] cursor-not-allowed'
              }`}
            title="Send message (Enter)"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIInput;
