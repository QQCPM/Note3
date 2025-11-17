import React, { useState, useEffect } from 'react';
import { tauriAI } from '@/services/tauriAI';
import { Settings, Check, X, Loader2, Sparkles } from 'lucide-react';

const SettingsTab: React.FC = () => {
  // Skills state
  const [skills, setSkills] = useState([
    { id: '1', name: '📝 Note Writer', icon: '📝', active: true },
    { id: '2', name: '💻 Code Generator', icon: '💻', active: true },
    { id: '3', name: '📊 Data Analyzer', icon: '📊', active: true },
    { id: '4', name: '🎨 UI Designer', icon: '🎨', active: false },
    { id: '5', name: '🔍 Researcher', icon: '🔍', active: false },
    { id: '6', name: '📚 Summarizer', icon: '📚', active: false },
    { id: '7', name: '🌐 Translator', icon: '🌐', active: false },
    { id: '8', name: '🧮 Math Solver', icon: '🧮', active: false },
    { id: '9', name: '✍️ Editor', icon: '✍️', active: false },
  ]);

  const toggleSkill = (id: string) => {
    setSkills(skills.map(skill =>
      skill.id === id ? { ...skill, active: !skill.active } : skill
    ));
  };

  // MCP tools state
  const [mcpTools, setMcpTools] = useState([
    { id: 'github', name: 'GitHub', icon: '🐙', active: true },
    { id: 'filesystem', name: 'Filesystem', icon: '📁', active: true },
    { id: 'websearch', name: 'Web Search', icon: '🔍', active: true },
    { id: 'database', name: 'Database', icon: '📊', active: false },
    { id: 'figma', name: 'Figma', icon: '🎨', active: false },
    { id: 'gmail', name: 'Gmail', icon: '📧', active: false },
  ]);

  const toggleMCPTool = (id: string) => {
    setMcpTools(mcpTools.map(tool =>
      tool.id === id ? { ...tool, active: !tool.active } : tool
    ));
  };

  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(8192); // Increased default

  const checkHealth = async () => {
    setLoading(true);
    try {
      const status = await tauriAI.healthCheck();
      setHealth(status);
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const config = await tauriAI.loadPersistedConfig();
      if (config) {
        setApiKey(config.openai_api_key || '');
        setModel(config.openai_model || 'gpt-4o');
        setTemperature(config.temperature || 0.7);
        setMaxTokens(config.max_tokens || 4096);
      }
    } catch (error) {
      console.log('No persisted config found');
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError('');

    try {
      const config = {
        openai_api_key: apiKey,
        openai_model: model,
        temperature,
        max_tokens: maxTokens,
      };

      await tauriAI.updateAndSaveConfig(config);
      setSaveSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);

      // Refresh health check
      await checkHealth();
    } catch (error: any) {
      setSaveError(error.toString());
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadConfig();
    checkHealth();
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const ServiceStatus = ({ name, status }: { name: string; status: boolean }) => (
    <div className="flex items-center justify-between py-2 px-3 bg-[#0d1117] rounded border border-[#30363d]">
      <span className="text-sm text-gray-300">{name}</span>
      {status ? (
        <Check size={16} className="text-green-500" />
      ) : (
        <X size={16} className="text-gray-600" />
      )}
    </div>
  );

  return (
    <div className="tab-content active overflow-y-auto">
      <div className="ai-conversation-flow">
        {/* AI Skills Section */}
        <div className="settings-section">
          <div className="section-card">
            <div className="section-header">
              <div className="section-title">
                <Sparkles size={14} className="inline mr-2" />
                AI Skills
              </div>
              <button className="section-action" onClick={() => alert('Manage skills')}>
                Manage
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', margin: '-4px' }}>
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className={`skill-pill ${skill.active ? 'active' : ''}`}
                  onClick={() => toggleSkill(skill.id)}
                >
                  <div className="skill-pill-check">{skill.active ? '✓' : ''}</div>
                  <span>{skill.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-divider"></div>

        {/* MCP Servers Section */}
        <div className="settings-section">
          <div className="section-card">
            <div className="section-header">
              <div className="section-title">🔌 MCP Servers</div>
              <button className="section-action" onClick={() => alert('Add new MCP server')}>
                + Add
              </button>
            </div>

            <div>
              {mcpTools.map((tool) => (
                <div
                  key={tool.id}
                  className="mcp-tool-item"
                  onClick={() => toggleMCPTool(tool.id)}
                >
                  <div className="mcp-tool-info">
                    <span className="mcp-tool-icon">{tool.icon}</span>
                    <span className="mcp-tool-name">{tool.name}</span>
                  </div>
                  <div className={`toggle-switch ${tool.active ? 'active' : ''}`}>
                    <div className="toggle-slider"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="message-group" style={{ marginTop: '16px' }}>
          <div className="bg-[#161b22] rounded-lg p-3 border border-[#30363d]">
            <div className="text-xs text-gray-400 mb-2 font-semibold">💡 About Settings</div>
            <div className="text-xs text-gray-500 leading-relaxed space-y-2">
              <p>
                <strong className="text-gray-400">Skills:</strong> Specialized instruction
                sets that enhance AI capabilities for specific tasks.
              </p>
              <p>
                <strong className="text-gray-400">MCP Servers:</strong> External tools that
                provide the AI with additional capabilities like GitHub integration, file
                system access, and web search.
              </p>
            </div>
          </div>
        </div>

        <div className="settings-divider"></div>

        {/* OpenAI Configuration - Existing content */}
        <div className="settings-section px-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings size={20} className="text-purple-400" />
            <h2 className="text-lg font-semibold text-white">OpenAI Configuration</h2>
          </div>

          {/* Service Status */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-400">Service Status</h3>
          <button
            onClick={checkHealth}
            disabled={loading}
            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            {loading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Checking...
              </>
            ) : (
              'Refresh'
            )}
          </button>
        </div>

        {health && (
          <div className="space-y-2">
            <ServiceStatus name="Embeddings (Local)" status={health.embedding_service} />
            <ServiceStatus name="Code Gen (Local)" status={health.local_code_service} />
            <ServiceStatus name="Reranker (Local)" status={health.reranker_service} />
            <ServiceStatus name="GPT Agent (API)" status={health.agent_service} />
          </div>
        )}
      </div>

      {/* OpenAI Configuration */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-400">OpenAI Configuration</h3>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-gray-300 focus:border-purple-500 focus:outline-none"
          >
            <option value="gpt-4o">GPT-4o (Recommended)</option>
            <option value="gpt-4o-mini">GPT-4o Mini (Faster, Cheaper)</option>
            <option value="o1-preview">O1 Preview (Best Reasoning)</option>
            <option value="o1-mini">O1 Mini (Fast Reasoning)</option>
            <option value="gpt-5">GPT-5 (When Available)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Changes take effect immediately after saving
          </p>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-proj-..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-gray-300 focus:border-purple-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Your API key is saved securely and persists across app restarts
          </p>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Max Response Length: {maxTokens.toLocaleString()} tokens
          </label>
          <input
            type="range"
            min="1024"
            max="16384"
            step="1024"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1K (faster)</span>
            <span>16K (maximum)</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Higher values allow longer responses but cost more. GPT-4o supports up to 16K output tokens.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={saveConfig}
            disabled={saving || !apiKey}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <Check size={14} />
                Saved!
              </>
            ) : (
              'Save Configuration'
            )}
          </button>
        </div>

        {saveError && (
          <div className="bg-red-900/20 border border-red-700/30 rounded p-2 text-xs text-red-300">
            Error: {saveError}
          </div>
        )}

        {saveSuccess && (
          <div className="bg-green-900/20 border border-green-700/30 rounded p-2 text-xs text-green-300">
            Configuration saved and AI system reinitialized successfully!
          </div>
        )}
      </div>

      {/* Local Models */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-400">Local Models</h3>

        <div className="bg-[#0d1117] border border-[#30363d] rounded p-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Embedding Model</span>
            <span className="text-gray-300">Qwen3-8B (8192-dim)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Code Generation</span>
            <span className="text-gray-300">Qwen3-30B (Q8_0)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Reranker</span>
            <span className="text-gray-300">Qwen3-8B</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Memory</span>
            <span className="text-gray-300">~46GB / 128GB</span>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          <div>• Port 8081: Embeddings</div>
          <div>• Port 8080: Code Generation</div>
          <div>• Port 8082: Reranking</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400">Quick Actions</h3>

        <button
          onClick={checkHealth}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm transition-colors"
        >
          Check All Services
        </button>

        <button
          onClick={() => window.open('https://platform.openai.com/api-keys', '_blank')}
          className="w-full bg-[#0d1117] hover:bg-[#161b22] border border-[#30363d] text-gray-300 px-4 py-2 rounded text-sm transition-colors"
        >
          Get OpenAI API Key →
        </button>

        <button
          onClick={() => window.open('https://platform.openai.com/usage', '_blank')}
          className="w-full bg-[#0d1117] hover:bg-[#161b22] border border-[#30363d] text-gray-300 px-4 py-2 rounded text-sm transition-colors"
        >
          View API Usage →
        </button>
      </div>

          {/* Cost Info */}
          <div className="bg-purple-900/20 border border-purple-700/30 rounded p-3">
            <div className="text-xs text-purple-300 font-semibold mb-2">💰 Cost Savings</div>
            <div className="text-xs text-gray-400 space-y-1">
              <div>• Embeddings: $0 (local)</div>
              <div>• Code Gen: $0 (local with fallback)</div>
              <div>• Chat: ~$5-20/month (GPT-4o)</div>
              <div className="pt-2 border-t border-purple-700/30 text-purple-300">
                Total: ~$5-20/month vs $50-100 all-API
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
