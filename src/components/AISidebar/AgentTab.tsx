import React, { useEffect, useRef } from 'react';
import { useAIStore } from '@/store/aiStore';

const AgentTab: React.FC = () => {
  const { messages, isLoading } = useAIStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="tab-content active" id="agentTab">
      <div className="ai-conversation-flow">
        {/* Welcome message if no messages yet */}
        {messages.length === 0 && (
          <>
            <div className="message-group chat-bubble">
              <span className="ai-message-label">AI Agent</span>
              <p className="ai-message-text">
                Hi! I'm your AI assistant. I can help you understand your notes and answer questions about them.
                <br/><br/>
                Select a note from the sidebar and ask me anything about its content!
              </p>
            </div>

            <div className="message-group chat-bubble">
              <div className="bg-[#161b22] rounded-lg p-3 border border-[#30363d]">
                <div className="text-xs font-semibold text-purple-300 mb-2">Quick Commands</div>
                <div className="space-y-1 text-xs text-gray-300">
                  <div><code className="px-2 py-0.5 bg-[#0d1117] rounded">/artifact</code> Create live code</div>
                  <div><code className="px-2 py-0.5 bg-[#0d1117] rounded">/database</code> Create table</div>
                  <div><code className="px-2 py-0.5 bg-[#0d1117] rounded">/tasks</code> Create task list</div>
                  <div><code className="px-2 py-0.5 bg-[#0d1117] rounded">/heading</code> Create heading</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Display conversation messages */}
        {messages.map((msg) => (
          <div key={msg.id} className="message-group chat-bubble">
            <span className="ai-message-label">
              {msg.role === 'user' ? 'You' : 'AI Agent'}
            </span>
            <p className="ai-message-text" style={{ whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </p>
            <div className="text-xs text-gray-500 mt-1">
              {msg.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="message-group chat-bubble">
            <span className="ai-message-label">AI Agent</span>
            <p className="ai-message-text">
              <span className="animate-pulse">Thinking...</span>
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default AgentTab;
