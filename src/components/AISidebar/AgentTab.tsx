import React from 'react';

const AgentTab: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="chat-container flex-1">
        {/* Welcome message from AI */}
        <div className="chat-bubble assistant">
          <div className="mb-2 text-xs font-semibold text-accent-blue">AI Agent</div>
          <p>
            Hello! I'm your AI assistant. I can help you with:
            <br /><br />
            • Generating interactive code artifacts<br />
            • Creating databases and tables<br />
            • Searching and organizing notes<br />
            • Analyzing data<br />
            • Answering questions
          </p>
        </div>

        {/* Quick Commands Info */}
        <div className="chat-bubble system">
          <div className="info-card">
            <div className="info-card-title">Quick Commands</div>
            <div className="space-y-1 text-xs">
              <div><code className="px-2 py-0.5 bg-bg-primary rounded text-accent-blue">/artifact</code> Create live code</div>
              <div><code className="px-2 py-0.5 bg-bg-primary rounded text-accent-blue">/database</code> Create table</div>
              <div><code className="px-2 py-0.5 bg-bg-primary rounded text-accent-blue">/tasks</code> Create task list</div>
              <div><code className="px-2 py-0.5 bg-bg-primary rounded text-accent-blue">/heading</code> Create heading</div>
            </div>
          </div>
        </div>

        {/* Prompt to start */}
        <div className="chat-bubble assistant">
          <div className="mb-2 text-xs font-semibold text-accent-blue">AI Agent</div>
          <p>Type your message below to get started!</p>
        </div>
      </div>
    </div>
  );
};

export default AgentTab;
