import React, { useState, useEffect } from 'react';
import { aiProvider } from '@/services/aiProvider';
import { embeddingsService } from '@/services/embeddingsService';
import { Settings, Eye, EyeOff, Save, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import type { AIConfig } from '@/types/ai';

const SettingsTab: React.FC = () => {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const currentConfig = await aiProvider.loadConfig();
    setConfig(currentConfig);
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setMessage(null);

    try {
      await aiProvider.saveConfig(config);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = () => {
    embeddingsService.clearCache();
    setMessage({ type: 'success', text: 'Embeddings cache cleared!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const updateNoteUnderstanding = (field: string, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      note_understanding: {
        ...config.note_understanding,
        [field]: value,
      },
    });
  };

  const updateEmbeddings = (field: string, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      embeddings: {
        ...config.embeddings,
        [field]: value,
      },
    });
  };

  if (!config) {
    return (
      <div className="tab-content active flex-1 overflow-y-auto custom-scrollbar p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Loading settings...</div>
        </div>
      </div>
    );
  }

  const cacheStats = embeddingsService.getCacheStats();

  return (
    <div className="tab-content active flex-1 overflow-y-auto custom-scrollbar p-4">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-200">AI Configuration</h2>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            message.type === 'success' ? 'bg-green-900/30 border border-green-700/50 text-green-300' : 'bg-red-900/30 border border-red-700/50 text-red-300'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        {/* Note Understanding (Chat/Completion) */}
        <div className="bg-[#161b22] rounded-lg p-4 border border-[#30363d]">
          <h3 className="text-sm font-semibold text-purple-300 mb-3">Note Understanding & Chat</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Provider</label>
              <select
                value={config.note_understanding.provider}
                onChange={(e) => updateNoteUnderstanding('provider', e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="local">Local (Ollama)</option>
              </select>
            </div>

            {config.note_understanding.provider === 'openai' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Model</label>
                  <select
                    value={config.note_understanding.model}
                    onChange={(e) => updateNoteUnderstanding('model', e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
                  >
                    <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">API Key</label>
                  <div className="flex gap-2">
                    <input
                      type={showApiKeys ? 'text' : 'password'}
                      value={config.note_understanding.api_key || ''}
                      onChange={(e) => updateNoteUnderstanding('api_key', e.target.value)}
                      placeholder="sk-..."
                      className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
                    />
                    <button
                      onClick={() => setShowApiKeys(!showApiKeys)}
                      className="p-1.5 hover:bg-[#30363d] rounded"
                      title={showApiKeys ? 'Hide API keys' : 'Show API keys'}
                    >
                      {showApiKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {config.note_understanding.provider === 'anthropic' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Model</label>
                  <select
                    value={config.note_understanding.model}
                    onChange={(e) => updateNoteUnderstanding('model', e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
                  >
                    <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                    <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                    <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">API Key</label>
                  <div className="flex gap-2">
                    <input
                      type={showApiKeys ? 'text' : 'password'}
                      value={config.note_understanding.api_key || ''}
                      onChange={(e) => updateNoteUnderstanding('api_key', e.target.value)}
                      placeholder="sk-ant-..."
                      className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
                    />
                    <button
                      onClick={() => setShowApiKeys(!showApiKeys)}
                      className="p-1.5 hover:bg-[#30363d] rounded"
                      title={showApiKeys ? 'Hide API keys' : 'Show API keys'}
                    >
                      {showApiKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {config.note_understanding.provider === 'local' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Model</label>
                  <input
                    type="text"
                    value={config.note_understanding.model}
                    onChange={(e) => updateNoteUnderstanding('model', e.target.value)}
                    placeholder="llama2"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Endpoint</label>
                  <input
                    type="text"
                    value={config.note_understanding.endpoint || ''}
                    onChange={(e) => updateNoteUnderstanding('endpoint', e.target.value)}
                    placeholder="http://localhost:11434/api/chat"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Temperature</label>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.note_understanding.temperature || 0.7}
                  onChange={(e) => updateNoteUnderstanding('temperature', parseFloat(e.target.value))}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Max Tokens</label>
                <input
                  type="number"
                  min="100"
                  max="8000"
                  step="100"
                  value={config.note_understanding.max_tokens || 2000}
                  onChange={(e) => updateNoteUnderstanding('max_tokens', parseInt(e.target.value))}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Embeddings (Semantic Search) */}
        <div className="bg-[#161b22] rounded-lg p-4 border border-[#30363d]">
          <h3 className="text-sm font-semibold text-purple-300 mb-3">Embeddings & Semantic Search</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Provider</label>
              <select
                value={config.embeddings.provider}
                onChange={(e) => updateEmbeddings('provider', e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
              >
                <option value="openai">OpenAI</option>
                <option value="local">Local (Ollama)</option>
              </select>
            </div>

            {config.embeddings.provider === 'openai' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Model</label>
                  <select
                    value={config.embeddings.model}
                    onChange={(e) => updateEmbeddings('model', e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
                  >
                    <option value="text-embedding-3-small">text-embedding-3-small (Recommended)</option>
                    <option value="text-embedding-3-large">text-embedding-3-large</option>
                    <option value="text-embedding-ada-002">text-embedding-ada-002 (Legacy)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">API Key</label>
                  <div className="flex gap-2">
                    <input
                      type={showApiKeys ? 'text' : 'password'}
                      value={config.embeddings.api_key || ''}
                      onChange={(e) => updateEmbeddings('api_key', e.target.value)}
                      placeholder="sk-..."
                      className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
                    />
                    <button
                      onClick={() => setShowApiKeys(!showApiKeys)}
                      className="p-1.5 hover:bg-[#30363d] rounded"
                      title={showApiKeys ? 'Hide API keys' : 'Show API keys'}
                    >
                      {showApiKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {config.embeddings.provider === 'local' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Model</label>
                  <input
                    type="text"
                    value={config.embeddings.model}
                    onChange={(e) => updateEmbeddings('model', e.target.value)}
                    placeholder="nomic-embed-text"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Endpoint</label>
                  <input
                    type="text"
                    value={config.embeddings.endpoint || ''}
                    onChange={(e) => updateEmbeddings('endpoint', e.target.value)}
                    placeholder="http://localhost:11434/api/embeddings"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-gray-300"
                  />
                </div>
              </>
            )}

            {/* Cache Stats */}
            <div className="bg-[#0d1117] rounded p-3 border border-[#30363d]/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Embeddings Cache</span>
                <button
                  onClick={handleClearCache}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              </div>
              <div className="text-xs text-gray-300">
                {cacheStats.entries} entries • {cacheStats.size}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>

        {/* Info */}
        <div className="bg-[#161b22] rounded-lg p-3 border border-[#30363d]">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-gray-400 space-y-1">
              <p><strong className="text-gray-300">Note Understanding:</strong> Powers the Ask/Edit modes for conversations and content editing.</p>
              <p><strong className="text-gray-300">Embeddings:</strong> Powers semantic search and RAG (Retrieval Augmented Generation) for finding relevant notes.</p>
              <p className="text-blue-300 mt-2">All API keys are stored locally in your browser.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
