import React, { useState } from 'react';
import { useNotesStore, useBlocksStore } from '@/store';
import { useAIStore, type AIMode } from '@/store/aiStore';
import { unifiedAIService } from '@/services/aiService';
import { Sparkles, Edit3, Lock, Zap, Send } from 'lucide-react';

const AIInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const [showModeMenu, setShowModeMenu] = useState(false);

  // Stores
  const { activeNoteId, getNoteById, notes } = useNotesStore();
  const { blocks } = useBlocksStore();
  const { mode, setMode, context, isProcessing, setProcessing, addMessage, capabilities } = useAIStore();

  const activeNote = activeNoteId ? getNoteById(activeNoteId) : null;

  const handleSend = async () => {
    if (message.trim() && !isProcessing) {
      // Add user message
      addMessage({
        role: 'user',
        content: message,
      });

      const userMessage = message;
      setMessage('');
      setProcessing(true);

      try {
        // Process with unified AI service
        const response = await unifiedAIService.processRequest({
          mode,
          message: userMessage,
          context,
          blocks,
          notes,
        });

        // Add AI response
        addMessage({
          role: 'assistant',
          content: response.content,
          metadata: response.metadata,
        });
      } catch (error) {
        addMessage({
          role: 'assistant',
          content: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: { type: 'general' },
        });
      } finally {
        setProcessing(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  const handleModeChange = (newMode: AIMode) => {
    setMode(newMode);
    setShowModeMenu(false);
  };

  const getModeConfig = (m: AIMode) => {
    if (m === 'ask') {
      return {
        icon: Sparkles,
        label: 'Ask Mode',
        description: 'Query, search, and analyze',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        borderColor: 'border-purple-500/30',
      };
    } else {
      return {
        icon: Edit3,
        label: 'Edit Mode',
        description: 'Modify and organize',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        borderColor: 'border-blue-500/30',
      };
    }
  };

  const currentMode = getModeConfig(mode);
  const ModeIcon = currentMode.icon;

  // Context display
  const getContextDisplay = () => {
    if (context.databaseData) {
      return `📊 Database: ${context.databaseData.title}`;
    } else if (context.blockType) {
      return `📦 ${context.blockType} block`;
    } else if (activeNote) {
      return `📄 ${activeNote.title}`;
    } else {
      return 'No context';
    }
  };

  return (
    <div className="ai-input-unified">
      {/* Context & Capabilities Bar */}
      <div className="px-3 py-2 border-b border-[#30363d] bg-[#0d1117]/50">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Context:</span>
            <span className="text-gray-300">{getContextDisplay()}</span>
          </div>
          {capabilities.canQueryDatabase && (
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
              DB Query
            </span>
          )}
        </div>
      </div>

      {/* Text Input */}
      <textarea
        className="input-field"
        placeholder={
          mode === 'ask'
            ? 'Ask me anything... (query database, search notes, analyze data)'
            : 'Tell me what to edit... (organize, clean, improve)'
        }
        rows={2}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isProcessing}
      />

      {/* Action Row */}
      <div className="input-actions">
        {/* Mode Selector */}
        <div className="relative">
          <button
            className={`mode-selector-text ${currentMode.bgColor} ${currentMode.borderColor} border`}
            onClick={() => setShowModeMenu(!showModeMenu)}
          >
            <ModeIcon className={`w-3.5 h-3.5 ${currentMode.color}`} />
            <span className={currentMode.color}>{currentMode.label}</span>
            <span className="dropdown-arrow text-gray-500">▾</span>
          </button>

          {/* Mode Menu Dropdown */}
          {showModeMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowModeMenu(false)}
              />

              {/* Menu */}
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#161b22] border border-[#30363d] rounded-lg shadow-lg z-20 overflow-hidden">
                {(['ask', 'edit'] as AIMode[]).map((m) => {
                  const modeConfig = getModeConfig(m);
                  const MIcon = modeConfig.icon;
                  const isActive = mode === m;

                  return (
                    <button
                      key={m}
                      onClick={() => handleModeChange(m)}
                      className={`w-full px-3 py-2 text-left transition-colors ${
                        isActive
                          ? `${modeConfig.bgColor} ${modeConfig.borderColor} border-l-2`
                          : 'hover:bg-[#21262d]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <MIcon className={`w-4 h-4 mt-0.5 ${modeConfig.color}`} />
                        <div className="flex-1">
                          <div className={`text-sm font-medium ${modeConfig.color}`}>
                            {modeConfig.label}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {modeConfig.description}
                          </div>
                        </div>
                        {isActive && (
                          <div className={`w-2 h-2 rounded-full ${modeConfig.bgColor} ${modeConfig.borderColor} border mt-1`} />
                        )}
                      </div>
                    </button>
                  );
                })}

                {/* Capabilities Info */}
                <div className="border-t border-[#30363d] p-2 bg-[#0d1117]">
                  <div className="text-xs text-gray-500 mb-1">Available:</div>
                  <div className="flex flex-wrap gap-1">
                    {capabilities.canQueryDatabase && (
                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
                        Database
                      </span>
                    )}
                    {capabilities.canSearchNotes && (
                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">
                        Search
                      </span>
                    )}
                    {capabilities.canEditBlocks && (
                      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded text-xs">
                        Edit
                      </span>
                    )}
                    {capabilities.canOrganizeNotes && (
                      <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-xs">
                        Organize
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            className="action-btn"
            title="Lock context (keep current selection)"
            disabled={!context.blockId && !context.noteId}
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
          <button
            className="action-btn"
            title="Use web search"
            disabled={isProcessing}
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
          <button
            className={`send-btn ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Send message (Cmd+Enter)"
            onClick={handleSend}
            disabled={!message.trim() || isProcessing}
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Suggested Actions (when idle) */}
      {!isProcessing && capabilities.suggestedActions.length > 0 && message === '' && (
        <div className="px-3 py-2 border-t border-[#30363d] bg-[#0d1117]/30">
          <div className="text-xs text-gray-500 mb-1.5">Try asking:</div>
          <div className="flex flex-wrap gap-1">
            {capabilities.suggestedActions.slice(0, 3).map((action, idx) => (
              <button
                key={idx}
                onClick={() => setMessage(action)}
                className="px-2 py-1 bg-[#21262d] hover:bg-[#30363d] text-gray-300 rounded text-xs transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInput;
