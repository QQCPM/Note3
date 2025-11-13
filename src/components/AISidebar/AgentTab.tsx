import React from 'react';

const AgentTab: React.FC = () => {
  return (
    <div className="tab-content active flex-1 overflow-y-auto">
      <div className="ai-conversation-flow">
        <div className="message-group chat-bubble">
          <span className="ai-message-label">AI Agent</span>
          <p className="ai-message-text">
            Hello! I'm your AI assistant. I can help you with:
            <br /><br />
            • Generating interactive code artifacts<br />
            • Creating databases and tables<br />
            • Searching and organizing notes<br />
            • Analyzing data<br />
            • Answering questions
          </p>
        </div>

        <div className="message-group chat-bubble">
          <div className="bg-bg-tertiary rounded-lg p-3 border border-border">
            <div className="text-xs font-semibold text-accent-purple mb-2">Quick Commands</div>
            <div className="space-y-1 text-xs text-text-primary">
              <div><code className="px-2 py-0.5 bg-bg-primary rounded">/artifact</code> Create live code</div>
              <div><code className="px-2 py-0.5 bg-bg-primary rounded">/database</code> Create table</div>
              <div><code className="px-2 py-0.5 bg-bg-primary rounded">/tasks</code> Create task list</div>
              <div><code className="px-2 py-0.5 bg-bg-primary rounded">/heading</code> Create heading</div>
            </div>
          </div>
        </div>

        <div className="message-group chat-bubble">
          <span className="ai-message-label">AI Agent</span>
          <p className="ai-message-text">
            Type your message below to get started!
          </p>
        </div>
      </div>
    </div>
  );
};

export default AgentTab;
