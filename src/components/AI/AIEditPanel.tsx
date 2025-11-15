import React, { useState, useRef, useEffect } from 'react';
import { useAIStore } from '@/store/aiStore';
import { streamAIEditChat, applyEdit, rejectEdit } from '@/services/aiEditService';
import DiffPreview from './DiffPreview';
import { Bot, Send, X, Loader2 } from 'lucide-react';

interface AIEditPanelProps {
  blockId: string;
  onClose: () => void;
}

/**
 * AIEditPanel Component
 *
 * Main AI editing interface with streaming chat and diff preview.
 * Shows the AI's thinking process and proposed edits in real-time.
 */
const AIEditPanel: React.FC<AIEditPanelProps> = ({ blockId, onClose }) => {
  const [inputValue, setInputValue] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isLoading, pendingEdits, exitEditMode } = useAIStore();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue.trim();
    setInputValue('');
    setStreamingText('');

    await streamAIEditChat({
      blockId,
      userMessage: message,
      onStream: (chunk) => {
        setStreamingText((prev) => prev + chunk);
      },
      onToolCall: (toolName, args) => {
        console.log('🔧 Tool called:', toolName, args);
      },
      onComplete: () => {
        setStreamingText('');
      },
      onError: (error) => {
        console.error('AI Error:', error);
        setStreamingText('');
      },
    });
  };

  const handleAcceptEdit = async (editId: string) => {
    try {
      await applyEdit(editId);
      // If no more pending edits, close panel
      const remaining = useAIStore.getState().pendingEdits.filter((e) => e.status === 'pending');
      if (remaining.length <= 1) {
        handleClose();
      }
    } catch (error) {
      console.error('Failed to apply edit:', error);
    }
  };

  const handleRejectEdit = (editId: string) => {
    rejectEdit(editId);
  };

  const handleClose = () => {
    exitEditMode();
    onClose();
  };

  // Get pending edits for this block
  const blockPendingEdits = pendingEdits.filter(
    (edit) => edit.blockId === blockId && edit.status === 'pending'
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-[#30363d] rounded-xl w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#161b22]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-200">AI Editor</h2>
              <p className="text-xs text-gray-500">Ask me to edit this block</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-200 transition-colors p-1 hover:bg-gray-800 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Welcome message */}
          {messages.length === 0 && !streamingText && (
            <div className="text-center py-8 text-gray-500">
              <Bot size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-sm mb-2">Hi! I can help you edit this block.</p>
              <p className="text-xs">
                Try: "Tell me about black holes" or "Write a summary of quantum physics"
              </p>
            </div>
          )}

          {/* Conversation messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#161b22] text-gray-300 border border-[#30363d]'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <p className="text-xs text-gray-500">
                      🔧 Called: {message.toolCalls.map((tc) => tc.name).join(', ')}
                    </p>
                  </div>
                )}
              </div>
              {message.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-white">You</span>
                </div>
              )}
            </div>
          ))}

          {/* Streaming text */}
          {streamingText && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-white" />
              </div>
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-[#161b22] text-gray-300 border border-[#30363d]">
                <p className="text-sm whitespace-pre-wrap">{streamingText}</p>
                <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-1"></span>
              </div>
            </div>
          )}

          {/* Pending edits */}
          {blockPendingEdits.length > 0 && (
            <div className="space-y-3 mt-6">
              {blockPendingEdits.map((edit) => (
                <DiffPreview
                  key={edit.id}
                  edit={edit}
                  onAccept={() => handleAcceptEdit(edit.id)}
                  onReject={() => handleRejectEdit(edit.id)}
                  autoFocus={blockPendingEdits.length === 1}
                />
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-[#30363d] p-4 bg-[#161b22]">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask AI to edit... (e.g., 'Tell me about black holes')"
              disabled={isLoading}
              className="flex-1 bg-[#0d1117] text-gray-300 placeholder-gray-600 px-4 py-2.5 rounded-lg border border-[#30363d] focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 text-sm"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send
                </>
              )}
            </button>
          </form>
          <p className="text-xs text-gray-600 mt-2 text-center">
            AI can search the web and edit content directly
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIEditPanel;
