import React, { useState, useRef, useMemo } from 'react';
import { useNotesStore, useBlocksStore } from '@/store';
import { useAIStore, type AIMessage } from '@/store/aiStore';
import { usePDFCaptureStore } from '@/store/pdfCaptureStore';
import { useFileStore } from '@/store/fileStore';
import { streamAIEditChat } from '@/services/aiEditService';
import { explainCapturedRegion } from '@/services/pdfVisionService';
import { createBlock } from '@/utils/tauri';
import { ArrowUp, Paperclip, Globe, FileText, Loader2, AtSign, Image, X, Sparkles, File as FileIcon } from 'lucide-react';
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

const AIInput: React.FC<AIInputProps> = ({ windowId: _windowId }) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { activeNoteId, getNoteById, notes } = useNotesStore();
  const { blocks, addBlock } = useBlocksStore();
  const {
    addMessage,
    activeNoteId: aiActiveNoteId,
    activeFileName,
  } = useAIStore();

  // PDF Capture context
  const { currentCapture, clearCapture } = usePDFCaptureStore();

  const activeNote = activeNoteId ? getNoteById(activeNoteId) : null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle quick explain for captured PDF region
  const handleQuickExplain = async () => {
    if (!currentCapture || isLoading) return;

    setIsLoading(true);

    // Add user message
    addMessage({
      role: 'user',
      content: `📷 [Captured region from "${currentCapture.pdfName}" - Page ${currentCapture.pageNumber}]\n\nPlease explain what this shows.`,
    });

    try {
      const explanation = await explainCapturedRegion(currentCapture, 'Please explain what this shows and help me understand it.');

      addMessage({
        role: 'assistant',
        content: explanation,
      });

      // Clear capture after successful explanation
      clearCapture();
    } catch (error) {
      console.error('Failed to explain captured region:', error);
      addMessage({
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to analyze the captured region. Please check your Gemini API key in settings.'}`,
      });
    }

    setIsLoading(false);
  };

  // Handle send with captured context
  const handleSendWithCapture = async (userQuestion: string) => {
    if (!currentCapture) return;

    setIsLoading(true);

    // Add user message
    addMessage({
      role: 'user',
      content: `📷 [About captured region from "${currentCapture.pdfName}" - Page ${currentCapture.pageNumber}]\n\n${userQuestion}`,
    });

    try {
      const explanation = await explainCapturedRegion(currentCapture, userQuestion);

      addMessage({
        role: 'assistant',
        content: explanation,
      });

      // Clear capture after response
      clearCapture();
    } catch (error) {
      console.error('Failed to explain captured region:', error);
      addMessage({
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to analyze the captured region.'}`,
      });
    }

    setIsLoading(false);
  };

  // Get current session messages for conversation history
  // IMPORTANT: Must use session.activeTabId to match addMessage behavior
  const getCurrentSessionMessages = (): AIMessage[] => {
    const store = useAIStore.getState();
    const currentNoteId = store.activeNoteId;

    // Get session directly from state (not via getOrCreateSession which might create empty)
    const session = currentNoteId === null
      ? store.globalSession
      : store.noteSessions[currentNoteId];

    if (!session) {
      console.log('🔍 getCurrentSessionMessages: No session for', currentNoteId);
      return [];
    }

    // CRITICAL: Use session.activeTabId - this is where addMessage stores messages
    // Do NOT use windowTabId which can be stale/different
    const activeTab = session.tabs.find(t => t.id === session.activeTabId);

    console.log('🔍 Session messages:', {
      noteId: currentNoteId,
      activeTabId: session.activeTabId,
      tabFound: !!activeTab,
      messageCount: activeTab?.messages?.length || 0,
    });

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

    // If there's a captured PDF context, use vision-based explanation
    if (currentCapture) {
      await handleSendWithCapture(userMessage);
    } else {
      await handleSmartAgent(userMessage);
    }
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

    // Detect if we're in file context (PDF viewing) vs actual note
    const isFileContext = aiActiveNoteId?.startsWith('file:');

    // File mode: Viewing a PDF or other file - use streamFileChat
    if (isFileContext && activeFileName) {
      console.log('📄 AIInput: File mode - using streamFileChat with Gemini 3 Pro', `(file: ${activeFileName})`);

      // Get file ID from session ID (remove 'file:' prefix)
      const fileId = aiActiveNoteId!.replace('file:', '');

      // Get the actual file from fileStore for PDF extraction
      const fileData = useFileStore.getState().getFile(fileId);
      const file = fileData?.file;

      try {
        // Import the file chat function
        const { streamFileChat } = await import('@/services/aiEditService');

        await streamFileChat({
          userMessage: userMessage,
          fileName: activeFileName,
          fileId: fileId,
          file: file, // Pass File object for PDF extraction
          conversationHistory: conversationHistory,
          onStream: (chunk) => {
            console.log('📥 File chat stream:', chunk.substring(0, 50));
          },
          onComplete: () => {
            console.log('✅ File chat completed');
          },
          onError: (error) => {
            console.error('❌ File chat error:', error);
          },
        });
      } catch (error) {
        console.error('❌ File chat error:', error);
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

    // Global mode: Dashboard/AI Secretary - ALWAYS use specialist mode
    if (!aiActiveNoteId) {
      console.log('🤖 AIInput: Dashboard Secretary mode - ALWAYS using specialist AI');

      const aiStore = useAIStore.getState();
      aiStore.setLoading(true);
      aiStore.addThinkingStep({
        type: 'thought',
        status: 'running',
        description: 'AI Secretary analyzing...',
      });

      try {
        // Import the secretary-only function (always uses LangGraph)
        const { sendSecretaryChatMessage } = await import('@/services/chatService');

        const result = await sendSecretaryChatMessage(
          userMessage,
          conversationHistory
        );

        // Complete thinking step with context
        const steps = aiStore.currentThinkingSteps;
        if (steps.length > 0) {
          aiStore.updateThinkingStep(steps[steps.length - 1].id, {
            status: 'complete',
            description: result.pendingRoadmap
              ? `Created learning plan: ${result.pendingRoadmap.name}`
              : 'Processed request via AI Secretary',
          });
        }
        aiStore.setLoading(false);

        // Add response message
        addMessage({
          role: 'assistant',
          content: result.error ? `Error: ${result.error}` : result.message,
        });
      } catch (error) {
        console.error('❌ Dashboard Secretary error:', error);
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
        {/* Captured PDF Context Preview */}
        {currentCapture && (
          <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-3 mb-1">
            <div className="flex items-start gap-3">
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden border border-[#30363d] bg-[#0d1117]">
                <img
                  src={currentCapture.imageDataUrl}
                  alt="Captured region"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Image size={12} className="text-[#58a6ff]" />
                  <span className="text-xs text-[#c9d1d9] font-medium truncate">
                    {currentCapture.pdfName}
                  </span>
                </div>
                <span className="text-[10px] text-[#6e7681]">
                  Page {currentCapture.pageNumber}
                </span>
                {currentCapture.extractedText && (
                  <p className="text-[10px] text-[#8b949e] mt-1 line-clamp-2">
                    "{currentCapture.extractedText.substring(0, 80)}..."
                  </p>
                )}
              </div>

              {/* Clear button */}
              <button
                onClick={clearCapture}
                className="flex-shrink-0 p-1 rounded hover:bg-[#21262d] text-[#6e7681] hover:text-[#f85149] transition-colors"
                title="Remove capture"
              >
                <X size={14} />
              </button>
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleQuickExplain}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#238636] text-white text-xs font-medium rounded-md hover:bg-[#2ea043] transition-colors disabled:opacity-50"
              >
                <Sparkles size={12} />
                Explain This
              </button>
              <span className="text-[10px] text-[#6e7681]">
                or ask a specific question below
              </span>
            </div>
          </div>
        )}

        {/* Context indicator - Show file name when file is active, or note title when note is active */}
        {(activeFileName || activeNote) && !currentCapture && (
          <div className="flex items-center gap-2 px-1 pb-1">
            {activeFileName ? (
              <>
                <FileIcon className="w-3 h-3 text-[#f0883e]" />
                <span className="text-xs text-[#7d8590] truncate flex-1">{activeFileName}</span>
              </>
            ) : activeNote ? (
              <>
                <FileText className="w-3 h-3 text-[#58a6ff]" />
                <span className="text-xs text-[#7d8590] truncate flex-1">{activeNote.title}</span>
              </>
            ) : null}
          </div>
        )}

        {/* Text input */}
        <textarea
          ref={textareaRef}
          className="w-full bg-transparent border-none outline-none text-[#c9d1d9] text-sm placeholder-[#6e7681] resize-none min-h-[44px] max-h-[120px] px-1"
          placeholder={currentCapture ? "Ask about the captured region..." : (activeFileName ? `Ask about ${activeFileName}...` : (activeNote ? "Ask about this note... (@ to reference)" : "What's on your mind?"))}
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
