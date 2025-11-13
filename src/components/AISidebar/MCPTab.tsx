import React, { useState } from 'react';

interface MCPServer {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

const MCPTab: React.FC = () => {
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([
    { id: 'github', name: 'GitHub', icon: '🐙', enabled: true },
    { id: 'filesystem', name: 'Filesystem', icon: '📁', enabled: true },
    { id: 'web-search', name: 'Web Search', icon: '🔍', enabled: true },
    { id: 'database', name: 'Database', icon: '📊', enabled: false },
    { id: 'figma', name: 'Figma', icon: '🎨', enabled: false },
    { id: 'notion', name: 'Notion', icon: '🗂️', enabled: false },
    { id: 'gmail', name: 'Gmail', icon: '📧', enabled: false },
  ]);

  const toggleServer = (id: string) => {
    setMcpServers(mcpServers.map(server =>
      server.id === id ? { ...server, enabled: !server.enabled } : server
    ));
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="tab-content-container">
        <div className="section-card">
          <div className="section-header">
            <div>
              <div className="section-title">🔌 MCP Servers</div>
              <div className="section-subtitle">Connect external tools and services</div>
            </div>
            <button
              className="px-3 py-1.5 text-sm bg-accent-blue text-white rounded-sm hover:bg-interactive-hover transition-colors"
              onClick={() => alert('Add new MCP server')}
            >
              + Add
            </button>
          </div>

          <div>
            {mcpServers.map((server) => (
              <div key={server.id} className="mcp-tool-item" onClick={() => toggleServer(server.id)}>
                <div className="mcp-tool-info">
                  <span className="mcp-tool-icon">{server.icon}</span>
                  <span className="mcp-tool-name">{server.name}</span>
                </div>
                <div className={`toggle-switch ${server.enabled ? 'active' : ''}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="info-card">
          <div className="info-card-title">About MCP</div>
          <p>
            Model Context Protocol (MCP) servers provide your AI with external capabilities.
            Enable the tools you need, and the AI can use them to fetch data, interact with services,
            and extend its functionality.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MCPTab;
