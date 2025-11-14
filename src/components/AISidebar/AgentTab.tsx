import React, { useEffect, useRef } from 'react';
import { useAIStore } from '@/store/aiStore';
import { Bot, User, Sparkles } from 'lucide-react';

const AgentTab: React.FC = () => {
  const { messages, mode, capabilities } = useAIStore();
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="tab-content active flex-1 overflow-y-auto custom-scrollbar" id="agentTab">
      <div className="ai-conversation-flow p-4">
        {/* Welcome message when no messages */}
        {messages.length === 0 && (
          <>
            <div className="message-group chat-bubble">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-5 h-5 text-blue-400" />
                <span className="ai-message-label">AI Agent</span>
              </div>
              <p className="ai-message-text">
                I'm your AI assistant, ready to help you with:
                <br/><br/>
                <strong className="text-purple-300">Ask Mode (Current: {mode === 'ask' ? '✓' : '○'}):</strong><br/>
                • Query database data<br/>
                • Search across notes<br/>
                • Analyze patterns and statistics<br/>
                • Web search for information<br/>
                <br/>
                <strong className="text-blue-300">Edit Mode (Current: {mode === 'edit' ? '✓' : '○'}):</strong><br/>
                • Automatically edit blocks<br/>
                • Organize note structure<br/>
                • Clean and improve data<br/>
                • Fix inconsistencies<br/>
              </p>
            </div>

            {/* Current capabilities */}
            {(capabilities.canQueryDatabase || capabilities.suggestedActions.length > 0) && (
              <div className="message-group chat-bubble">
                <div className="bg-[#161b22] rounded-lg p-3 border border-[#30363d]">
                  <div className="text-xs font-semibold text-purple-300 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {capabilities.canQueryDatabase ? 'Database Tools Available' : 'Suggested Actions'}
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-300">
                    {capabilities.suggestedActions.slice(0, 5).map((action, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-purple-400" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="message-group chat-bubble">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-5 h-5 text-blue-400" />
                <span className="ai-message-label">AI Agent</span>
              </div>
              <p className="ai-message-text">
                Select a block to give me context, then ask me anything!
              </p>
            </div>
          </>
        )}

        {/* Conversation messages */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-group chat-bubble ${
              message.role === 'user' ? 'user-message' : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {message.role === 'assistant' ? (
                <>
                  <Bot className="w-5 h-5 text-blue-400" />
                  <span className="ai-message-label">AI Agent</span>
                </>
              ) : (
                <>
                  <User className="w-5 h-5 text-purple-400" />
                  <span className="ai-message-label text-purple-300">You</span>
                </>
              )}
              <span className="text-xs text-gray-500">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="ai-message-text whitespace-pre-wrap">
              {message.content}
            </div>

            {/* Metadata display for special message types */}
            {message.metadata && message.metadata.suggestedFollowUps && message.metadata.suggestedFollowUps.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs text-gray-500">Follow up:</span>
                {message.metadata.suggestedFollowUps.map((followUp, idx) => (
                  <button
                    key={idx}
                    className="px-2 py-1 bg-[#21262d] hover:bg-[#30363d] text-gray-300 rounded text-xs transition-colors"
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Scroll anchor */}
        <div ref={conversationEndRef} />
      </div>
    </div>
  );
};

export default AgentTab;
