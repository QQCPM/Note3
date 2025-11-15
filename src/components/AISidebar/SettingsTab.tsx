import React, { useState, useEffect } from 'react';
import { tauriAI } from '@/services/tauriAI';
import { Settings, Check, X, Loader2 } from 'lucide-react';

const SettingsTab: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o');

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

  useEffect(() => {
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
    <div className="tab-content active p-4 space-y-6" id="settingsTab">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Settings size={20} className="text-purple-400" />
        <h2 className="text-lg font-semibold text-white">AI Settings</h2>
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
            Change requires app restart. Edit src/services/tauriAI.ts:309
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
            Set in .env file: VITE_OPENAI_API_KEY
          </p>
        </div>
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
  );
};

export default SettingsTab;
