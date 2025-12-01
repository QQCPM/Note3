import React, { useEffect, useRef, useState } from 'react';
import { useAIStore } from '@/store/aiStore';
import { applyEdit, rejectEdit } from '@/services/aiEditService';
import DiffPreview from '@/components/AI/DiffPreview';
import CleanChatMessage from '@/components/Chat/CleanChatMessage';
import ProgressTimeline from '@/components/Chat/ProgressTimeline';
import { Search, Loader2 } from 'lucide-react';

const AgentTab: React.FC = () => {
  const { 
    messages, 
    isLoading, 
    pendingEdits,
    currentThinkingSteps,
  } = useAIStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingEdits, currentThinkingSteps]);

  const handleAcceptEdit = async (editId: string) => {
    try {
      await applyEdit(editId);
    } catch (error) {
      console.error('Failed to apply edit:', error);
    }
  };

  const handleRejectEdit = (editId: string) => {
    rejectEdit(editId);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      console.log('🔍 Searching knowledge base:', searchQuery);
      // TODO: Implement knowledge search
      setSearchQuery('');
    }
  };

  // Get pending edits
  const currentPendingEdits = pendingEdits.filter((e) => e.status === 'pending');

  return (
    <div className="tab-content active" id="agentTab">
      <div className="ai-conversation-flow">
        {/* Knowledge Search Bar */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 bg-[#161b22]/60 border border-[#30363d]/40 rounded-lg px-3 py-2 transition-all focus-within:border-[#58a6ff]/50 focus-within:bg-[#161b22]/80">
            <Search size={14} className="text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search knowledge base..."
              className="flex-1 bg-transparent border-none outline-none text-gray-300 text-sm placeholder-gray-600"
            />
          </div>
        </div>

        {/* Welcome message if no messages yet */}
        {messages.length === 0 && (
          <>
            <div className="message-group chat-bubble px-4">
              <span className="ai-message-label">AI Agent</span>
              <p className="ai-message-text text-[#8b949e] text-sm leading-relaxed">
                Hi! I'm your AI assistant. I can help you understand your notes and answer questions about them.
                <br/><br/>
                Select a note from the sidebar and ask me anything about its content!
              </p>
            </div>

            <div className="message-group chat-bubble px-4">
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

        {/* Display conversation messages using CleanChatMessage */}
        <div className="px-4 space-y-4">
          {messages
            .filter(msg => msg.role !== 'system')
            .map((msg, idx, filtered) => (
              <CleanChatMessage
                key={msg.id}
                role={msg.role as 'user' | 'assistant'}
                content={msg.content}
                isLatest={idx === filtered.length - 1}
                messageId={msg.id}
                thinkingSteps={msg.thinkingSteps}
                citations={msg.citations}
              />
            ))}
        </div>

        {/* Live progress timeline while AI is processing */}
        {isLoading && currentThinkingSteps.length > 0 && (
          <div className="px-4 mt-4">
            <ProgressTimeline
              steps={currentThinkingSteps}
              isLive={true}
            />
          </div>
        )}

        {/* Loading indicator when no thinking steps yet */}
        {isLoading && currentThinkingSteps.length === 0 && (
          <div className="message-group chat-bubble px-4">
            <span className="ai-message-label">AI Agent</span>
            <div className="flex items-center gap-2 text-[#8b949e] text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        )}

        {/* Pending Edits */}
        {currentPendingEdits.length > 0 && (
          <div className="px-4 space-y-3 mb-4 mt-4">
            {currentPendingEdits.map((edit) => (
              <DiffPreview
                key={edit.id}
                edit={edit}
                onAccept={() => handleAcceptEdit(edit.id)}
                onReject={() => handleRejectEdit(edit.id)}
                autoFocus={currentPendingEdits.length === 1}
              />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default AgentTab;
