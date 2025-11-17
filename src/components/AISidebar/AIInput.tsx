import React, { useState } from 'react';
import { useNotesStore, useBlocksStore } from '@/store';
import { useAIStore } from '@/store/aiStore';
import { streamAIEditChat } from '@/services/aiEditService';
import { createBlock } from '@/utils/tauri';

const AIInput: React.FC = () => {
  const [message, setMessage] = useState('');
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
    if (!message.trim()) return;

    const userMessage = message.trim();
    setMessage('');

    // Let AI handle everything intelligently with tools
    // The AI will decide whether to create artifacts, databases, or edit text
    await handleSmartAgent(userMessage);
  };

  const handleSmartAgent = async (userMessage: string) => {
    if (!activeNoteId) {
      addMessage({
        role: 'assistant',
        content: 'Error: No active note. Please select or create a note first.',
      });
      return;
    }

    // User message will be added by streamAIEditChat (avoid duplicates)

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
    // Plus: 10 database tools + 10 artifact tools
    // The AI will intelligently decide which tools to use based on the request
    await streamAIEditChat({
      blockId: targetBlock.id,
      userMessage,
      onComplete: () => {
        console.log('✅ Smart agent complete');
      },
      onError: (error) => {
        console.error('❌ Smart agent error:', error);
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
    <div className="ai-input-unified">
      {/* Context indicator */}
      <div className="input-context">
        <span className="context-icon">▣</span>
        <span className="context-text">{activeNote?.title || 'No note selected'}</span>
        <button className="context-action" title="Remove context">×</button>
        <button className="context-action" title="Settings">⚙</button>
      </div>

      {/* Text input */}
      <textarea
        className="input-field"
        placeholder="what's on ur mind"
        rows={2}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Action row */}
      <div className="input-actions">
        <div className="action-buttons">
          <button className="send-btn" title="Send message (Enter)" onClick={handleSend}>
            ↗
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIInput;
