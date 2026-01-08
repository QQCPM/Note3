import React, { useEffect, useRef, useState } from 'react';
import { useAIStore, type SessionTab } from '@/store/aiStore';
import { useUIStore } from '@/store/uiStore';
import { applyEdit, rejectEdit } from '@/services/aiEditService';
import DiffPreview from '@/components/AI/DiffPreview';
import CleanChatMessage from '@/components/Chat/CleanChatMessage';
import ActionLog from '@/components/Chat/ActionLog';
import { Search, Loader2, Plus, X, ExternalLink } from 'lucide-react';

// ============================================================================
// TAB BAR COMPONENT - With detach support
// ============================================================================

interface TabBarProps {
  windowId?: string;
}

const TabBar: React.FC<TabBarProps> = ({ windowId }) => {
  const {
    activeNoteId,
    getOrCreateSession,
    createTab,
  } = useAIStore();

  const {
    getWindowById,
    setWindowActiveTab,
    detachTab,
    removeTabFromWindow,
  } = useUIStore();

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Get session using proper method that creates session if needed
  const session = getOrCreateSession(activeNoteId);

  const window = windowId ? getWindowById(windowId) : null;

  // Get tabs for this window (filter session tabs by window's tabIds)
  const windowTabs = window
    ? session.tabs.filter(t => window.tabIds.includes(t.id))
    : session.tabs;

  const activeTabId = window?.activeTabId || session.activeTabId;

  const handleCreateTab = () => {
    const newTab = createTab(activeNoteId);
    // Add to current window
    if (windowId) {
      useUIStore.getState().addTabToWindow(windowId, newTab.id);
      setWindowActiveTab(windowId, newTab.id);
    }
  };

  const handleSwitchTab = (tabId: string) => {
    if (windowId) {
      setWindowActiveTab(windowId, tabId);
    }
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (windowId) {
      removeTabFromWindow(windowId, tabId);
    }
  };

  const handleDetachTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    // Calculate position for new window
    const position = {
      x: 200 + Math.random() * 100,
      y: 150 + Math.random() * 100,
    };
    detachTab(tabId, position);
  };

  const handleDoubleClick = (e: React.MouseEvent, tab: SessionTab) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditingName(tab.name);
  };

  const handleFinishRename = (tabId: string) => {
    if (editingName.trim()) {
      useAIStore.getState().renameTab(activeNoteId, tabId, editingName.trim());
    }
    setEditingTabId(null);
    setEditingName('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter') {
      handleFinishRename(tabId);
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
      setEditingName('');
    }
  };

  // Token status color
  const getTokenColor = (tokens: number): string => {
    if (tokens > 80000) return 'text-red-400';
    if (tokens > 40000) return 'text-yellow-400';
    return 'text-green-400';
  };

  // Always show tab bar now (for detach functionality)
  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-[#21262d]/50 overflow-x-auto scrollbar-hide">
      {windowTabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const isEditing = editingTabId === tab.id;
        const canDetach = windowTabs.length > 1 || window?.isPrimary;

        return (
          <div
            key={tab.id}
            onClick={() => handleSwitchTab(tab.id)}
            onDoubleClick={(e) => handleDoubleClick(e, tab)}
            className={`
              group flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer transition-all
              ${isActive
                ? 'bg-[#21262d]/80 text-[#c9d1d9]'
                : 'hover:bg-[#161b22]/60 text-[#6e7681] hover:text-[#8b949e]'
              }
            `}
            title={isEditing ? undefined : `${tab.name} (double-click to rename)`}
          >
            {isEditing ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleFinishRename(tab.id)}
                onKeyDown={(e) => handleRenameKeyDown(e, tab.id)}
                className="bg-transparent border-none outline-none text-[11px] w-12 text-[#c9d1d9]"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-[11px] truncate max-w-[60px]">
                {tab.name || `Chat ${index + 1}`}
              </span>
            )}

            {/* Token badge */}
            {tab.tokenEstimate > 1000 && (
              <span className={`text-[9px] opacity-80 ${getTokenColor(tab.tokenEstimate)}`}>
                {tab.tokenEstimate > 1000
                  ? `${Math.round(tab.tokenEstimate / 1000)}k`
                  : tab.tokenEstimate
                }
              </span>
            )}

            {/* Action buttons - show on hover */}
            {!isEditing && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Detach button */}
                {canDetach && (
                  <button
                    onClick={(e) => handleDetachTab(e, tab.id)}
                    className="p-0.5 rounded hover:bg-[#30363d] transition-all"
                    title="Pop out to new window"
                  >
                    <ExternalLink size={9} className="text-[#58a6ff]" />
                  </button>
                )}

                {/* Close button */}
                <button
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  className="p-0.5 rounded hover:bg-[#30363d] transition-all"
                  title="Close tab"
                >
                  <X size={10} className="text-[#6e7681]" />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* New tab button */}
      <button
        onClick={handleCreateTab}
        className="p-1 rounded hover:bg-[#21262d] transition-colors ml-0.5"
        title="New conversation"
      >
        <Plus size={12} className="text-[#484f58]" />
      </button>
    </div>
  );
};

// ============================================================================
// AGENT TAB COMPONENT
// ============================================================================

interface AgentTabProps {
  windowId?: string;
}

const AgentTab: React.FC<AgentTabProps> = ({ windowId }) => {
  const {
    activeNoteId,
    getOrCreateSession,
    isLoading,
    pendingEdits,
    currentThinkingSteps,
    noteSessions,    // Subscribe to session changes for re-render
    globalSession,   // Subscribe to global session changes
  } = useAIStore();

  const { getWindowById } = useUIStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get current session directly from subscribed state (for reactivity)
  const session = activeNoteId === null
    ? globalSession
    : (noteSessions[activeNoteId] || getOrCreateSession(activeNoteId));

  // Get active tab - use window's activeTabId only if that tab exists in current session
  // Otherwise fallback to session's activeTabId (fixes stale window tab ID from persisted state)
  const window = windowId ? getWindowById(windowId) : null;
  const windowTabId = window?.activeTabId;
  const windowTabExists = windowTabId && session?.tabs.some(t => t.id === windowTabId);
  const activeTabId = windowTabExists ? windowTabId : session?.activeTabId;

  const activeTab = session?.tabs.find(t => t.id === activeTabId);
  const messages = activeTab?.messages || [];

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
      setSearchQuery('');
    }
  };

  // Get pending edits
  const currentPendingEdits = pendingEdits.filter((e) => e.status === 'pending');

  return (
    <div className="tab-content active flex flex-col h-full" id="agentTab">
      {/* Tab Bar */}
      <TabBar windowId={windowId} />

      <div className="ai-conversation-flow flex-1 overflow-y-auto">
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
                <br /><br />
                {activeNoteId
                  ? "Ask me anything about this note!"
                  : "Select a note from the sidebar and ask me anything about its content!"}
              </p>
            </div>

            <div className="message-group chat-bubble px-4">
              <div className="bg-[#161b22] rounded-lg p-3 border border-[#30363d]">
                <div className="text-xs font-semibold text-purple-300 mb-2">Quick Commands</div>
                <div className="space-y-1 text-xs text-gray-300">
                  <div><code className="px-2 py-0.5 bg-[#0d1117] rounded">/artifact</code> Create live code</div>
                  <div><code className="px-2 py-0.5 bg-[#0d1117] rounded">/database</code> Create table</div>
                  <div><code className="px-2 py-0.5 bg-[#0d1117] rounded">/tasks</code> Create task list</div>
                  <div><code className="px-2 py-0.5 bg-[#0d1117] rounded">@NoteName</code> Reference another note</div>
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

        {/* Live action log while AI is processing */}
        {isLoading && currentThinkingSteps.length > 0 && (
          <div className="px-4 mt-4">
            <ActionLog logs={currentThinkingSteps} />
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
