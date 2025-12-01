import React, { useState, useEffect, useRef } from 'react';
import { useNotesStore } from '@/store';
import { useLayoutStore } from '@/store/layoutStore';
import { useTransitionStore } from '@/store/transitionStore';
import { useAIStore } from '@/store/aiStore';
import CleanChatMessage from './CleanChatMessage';
import ChatInput from './ChatInput';
import './ChatPanel.css';

interface ChatPanelProps {
  className?: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ className = '' }) => {
  const { messages } = useAIStore();
  const { notes } = useNotesStore();
  const { showNotePanel } = useLayoutStore();
  const { addHighlight, setConversationContext } = useTransitionStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isRecommendationsVisible, setIsRecommendationsVisible] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (input: string) => {
    // Hide recommendations on first message
    if (isRecommendationsVisible && messages.length === 0) {
      setIsRecommendationsVisible(false);
    }

    // Check for @mention
    const mentionMatch = input.match(/@(\w+)/);

    if (mentionMatch) {
      const noteName = mentionMatch[1];
      const note = notes.find((n) =>
        n.title.toLowerCase() === noteName.toLowerCase()
      );

      if (note) {
        // Set conversation context
        const context = messages.map((m) => m.content);
        setConversationContext(context);

        // Trigger panel transition
        showNotePanel(note.id);

        // Import and call AI edit service
        const { streamAIEditChat } = await import('@/services/aiEditService');
        const { capturedHighlights } = useTransitionStore.getState();

        // Start AI editing with context
        await streamAIEditChat({
          blockId: '', // Will be determined by service
          userMessage: input,
          onStream: (chunk) => {
            console.log('📥 Streaming:', chunk);
          },
          onComplete: () => {
            console.log('✅ Edit complete');
          },
          onError: (error) => {
            console.error('❌ Edit error:', error);
          },
        });

        return;
      }
    }

    // Normal chat message (no @mention)
    // Add user message
    const { addMessage } = useAIStore.getState();
    addMessage({
      role: 'user',
      content: input,
    });

    // Simulate AI response (replace with real AI later)
    setTimeout(() => {
      addMessage({
        role: 'assistant',
        content: 'This is a placeholder response. Real AI integration coming soon!',
      });
    }, 500);
  };

  const handleTextSelection = (messageId: string) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (selectedText && selectedText.length > 3) {
      // Auto-capture highlight
      addHighlight({
        text: selectedText,
        messageId,
      });

      // Visual feedback (will add highlight styling)
      console.log('✓ Captured highlight:', selectedText);
    }
  };

  return (
    <div className={`chat-panel ${className}`}>
      {/* Messages Area */}
      <div className="chat-messages">
        {/* Show recommendations if no messages yet */}
        {messages.length === 0 && isRecommendationsVisible && (
          <div className="recommendations-container">
            <div className="recommendations-header">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.5 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM7.25 4a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V4Z" />
              </svg>
              <span>Suggested for you</span>
            </div>
            <div className="recommendations-grid">
              <div className="recommendation-card">
                <div className="card-icon">⚡</div>
                <h4>Test your knowledge</h4>
                <p>Based on recent notes</p>
              </div>
              <div className="recommendation-card">
                <div className="card-icon">🔗</div>
                <h4>Connect concepts</h4>
                <p>Find related topics</p>
              </div>
              <div className="recommendation-card">
                <div className="card-icon">📚</div>
                <h4>Review patterns</h4>
                <p>Strengthen understanding</p>
              </div>
              <div className="recommendation-card">
                <div className="card-icon">🔬</div>
                <h4>Deep dive</h4>
                <p>Explore in detail</p>
              </div>
            </div>
          </div>
        )}

        {/* Chat messages */}
        <div className="messages-list">
          {messages.map((message, idx) => (
            <div
              key={message.id}
              onMouseUp={() => handleTextSelection(message.id)}
            >
              <CleanChatMessage
                role={message.role}
                content={message.content}
                isLatest={idx === messages.length - 1}
                messageId={message.id}
              />
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <ChatInput onSubmit={handleSubmit} />
    </div>
  );
};

export default ChatPanel;
