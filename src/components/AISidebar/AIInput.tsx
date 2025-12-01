import React, { useState } from 'react';
import { useNotesStore, useBlocksStore } from '@/store';
import { useAIStore } from '@/store/aiStore';
import { streamAIEditChat } from '@/services/aiEditService';
import { createBlock } from '@/utils/tauri';
import { ArrowUp, Paperclip, Globe, FileText, Loader2 } from 'lucide-react';

const AIInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { activeNoteId, getNoteById } = useNotesStore();
  const { blocks, addBlock } = useBlocksStore();
  const { addMessage } = useAIStore();
  const activeNote = activeNoteId ? getNoteById(activeNoteId) : null;

  // Get or create target block for Agent mode
  const getTargetBlock = async () => {
    if (!activeNoteId) return null;

    // Find first text block in active note
    const noteBlocks = blocks.filter((b) => b.note_id === activeNoteId);
    const textBlocks = noteBlocks.filter((b) => b.type === 'text');

    if (textBlocks.length > 0) {
      // Return last text block (most recent)
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
    setIsLoading(true);

    // Let AI handle everything intelligently with tools
    // The AI will decide whether to create artifacts, databases, or edit text
    await handleSmartAgent(userMessage);
    setIsLoading(false);
  };

  const handleSmartAgent = async (userMessage: string) => {
    if (!activeNoteId) {
      addMessage({
        role: 'assistant',
        content: 'Error: No active note. Please select or create a note first.',
      });
      return;
    }

    // Add user message to store first (caller is responsible)
    addMessage({
      role: 'user',
      content: userMessage,
    });

    // Get or create target block
    const targetBlock = await getTargetBlock();
    if (!targetBlock) {
      addMessage({
        role: 'assistant',
        content: 'Error: Failed to get target block.',
      });
      return;
    }

    // Use the enhanced AI editing service with all tools
    // This includes: read_block, read_note, edit_block, search_web, create_artifact, create_database
    // Plus: 10 database tools
    const currentBlock = targetBlock; // Renaming for clarity with the provided snippet's context

    console.log('🚀 AIInput: Sending message to AI:', userMessage);
    console.log('🎯 AIInput: Current block ID:', currentBlock?.id);

    // Stream AI chat with edit capabilities
    await streamAIEditChat({
      blockId: currentBlock?.id || '',
      userMessage: userMessage,
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter alone: submit
    // Shift+Enter: new line (default textarea behavior)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default new line
      handleSend();
    }
    // Shift+Enter will naturally create a new line (no special handling needed)
  };

  return (
    <div className="px-3 pb-3">
      <div className="bg-[#0d1117] rounded-lg border border-[#21262d] p-3 flex flex-col gap-2 transition-all hover:border-[#30363d]">
        {/* Context indicator - only show if note is selected */}
        {activeNote && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <FileText className="w-3 h-3 text-[#58a6ff]" />
            <span className="text-xs text-[#7d8590] truncate flex-1">{activeNote.title}</span>
          </div>
        )}

        {/* Text input */}
        <textarea
          className="w-full bg-transparent border-none outline-none text-[#c9d1d9] text-sm placeholder-[#6e7681] resize-none min-h-[44px] max-h-[120px] px-1"
          placeholder={activeNote ? "Ask about this note..." : "What's on your mind?"}
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
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
          </div>

          <button
            onClick={handleSend}
            disabled={!message.trim() || isLoading}
            className={`p-1.5 rounded-full transition-all duration-200 ${
              message.trim() && !isLoading
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
