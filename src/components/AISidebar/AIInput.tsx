import React, { useState } from 'react';
import { useNotesStore } from '@/store';
import { useAIStore } from '@/store/aiStore';
import { tauriAI } from '@/services/tauriAI';

const AIInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const { activeNoteId, getNoteById } = useNotesStore();
  const { addMessage, setLoading } = useAIStore();
  const activeNote = activeNoteId ? getNoteById(activeNoteId) : null;

  const handleSend = async () => {
    if (!message.trim()) return;

    const userMessage = message.trim();
    setMessage('');

    // Add user message to conversation
    addMessage({
      role: 'user',
      content: userMessage,
      noteId: activeNoteId || undefined,
    });

    try {
      setLoading(true);

      let response: string;

      // If there's an active note, chat with note context (RAG)
      if (activeNoteId) {
        response = await tauriAI.chatWithNoteContext(activeNoteId, userMessage);
      } else {
        // Otherwise, just do a general chat
        response = await tauriAI.chat([
          { role: 'user', content: userMessage },
        ]);
      }

      // Add AI response to conversation
      addMessage({
        role: 'assistant',
        content: response,
        noteId: activeNoteId || undefined,
      });
    } catch (error) {
      console.error('AI chat failed:', error);
      addMessage({
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get AI response'}`,
        noteId: activeNoteId || undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
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
        placeholder="Ask me anything about your canvas..."
        rows={2}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Action row */}
      <div className="input-actions">
        <button className="mode-selector-text">
          <span>Agent Mode</span>
          <span className="dropdown-arrow" style={{ color: '#6e7681' }}>▾</span>
        </button>
        <div className="action-buttons">
          <button className="action-btn" title="Lock context">◉</button>
          <button className="action-btn" title="Search web">⚡</button>
          <button className="send-btn" title="Send message (Cmd+Enter)" onClick={handleSend}>
            ↗
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIInput;
