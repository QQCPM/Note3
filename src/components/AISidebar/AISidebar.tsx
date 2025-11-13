import React from 'react';
import { useUIStore } from '@/store';
import AgentTab from './AgentTab';
import MCPTab from './MCPTab';
import SkillsTab from './SkillsTab';
import AIInput from './AIInput';

const AISidebar: React.FC = () => {
  const { aiSidebarTab, setAISidebarTab } = useUIStore();

  return (
    <aside
      className="w-[480px] flex-shrink-0 border-l border-border flex flex-col"
      style={{
        background: 'radial-gradient(circle at top left, rgba(185, 28, 28, 0.15) 0%, rgba(234, 88, 12, 0.08) 40%, #010409 80%)',
      }}
    >
      {/* Tab Navigation */}
      <header className="flex-shrink-0 border-b border-border flex items-end justify-center bg-transparent">
        <nav className="flex items-center">
          <button
            className={`tab-button ${aiSidebarTab === 'agent' ? 'active' : ''}`}
            onClick={() => setAISidebarTab('agent')}
          >
            Agent
          </button>
          <button
            className={`tab-button ${aiSidebarTab === 'mcp' ? 'active' : ''}`}
            onClick={() => setAISidebarTab('mcp')}
          >
            MCP
          </button>
          <button
            className={`tab-button ${aiSidebarTab === 'skills' ? 'active' : ''}`}
            onClick={() => setAISidebarTab('skills')}
          >
            Skills
          </button>
        </nav>
      </header>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {aiSidebarTab === 'agent' && <AgentTab />}
        {aiSidebarTab === 'mcp' && <MCPTab />}
        {aiSidebarTab === 'skills' && <SkillsTab />}
      </div>

      {/* AI Input */}
      <AIInput />
    </aside>
  );
};

export default AISidebar;
