import React, { useState } from 'react';
import { useNotesStore } from '@/store';

const AIInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const { activeNoteId, getNoteById } = useNotesStore();
  const activeNote = activeNoteId ? getNoteById(activeNoteId) : null;

  const handleSend = () => {
    if (message.trim()) {
      console.log('Send message:', message);
      // TODO: Implement AI message sending
      setMessage('');
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
