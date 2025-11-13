import React from 'react';

const MCPTab: React.FC = () => {
  const mcpServers = [
    { id: 'github', name: 'GitHub', icon: '🐙', enabled: true },
    { id: 'filesystem', name: 'Filesystem', icon: '📁', enabled: true },
    { id: 'web-search', name: 'Web Search', icon: '🔍', enabled: true },
    { id: 'database', name: 'Database', icon: '📊', enabled: false },
    { id: 'figma', name: 'Figma', icon: '🎨', enabled: false },
    { id: 'notion', name: 'Notion', icon: '🗂️', enabled: false },
    { id: 'gmail', name: 'Gmail', icon: '📧', enabled: false },
  ];

  const toggleServer = (id: string) => {
    console.log('Toggle server:', id);
    // TODO: Implement MCP server toggling
  };

  return (
    <div className="tab-content active" id="mcpTab">
        <div className="ai-conversation-flow">
            <div className="section-card">
                <div className="section-header">
                    <div className="section-title">🔌 MCP Servers</div>
                    <button className="section-action" onClick={() => alert('Add new MCP server')}>+ Add</button>
                </div>

                {mcpServers.map((server) => (
                  <div key={server.id} className="mcp-tool-item" onClick={() => toggleServer(server.id)}>
                    <div className="mcp-tool-info">
                        <span className="mcp-tool-icon">{server.icon}</span>
                        <span className="mcp-tool-name">{server.name}</span>
                    </div>
                    <div className={`toggle-switch ${server.enabled ? 'active' : ''}`}>
                        <div className="toggle-slider"></div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="message-group" style={{ marginTop: '16px' }}>
                <div className="bg-[#161b22] rounded-lg p-4 border border-[#30363d]">
                    <div className="text-sm text-gray-400 mb-2">About MCP</div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        Model Context Protocol (MCP) servers provide your AI with external capabilities. Enable the tools you need, and the AI can use them to fetch data, interact with services, and extend its functionality.
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default MCPTab;
