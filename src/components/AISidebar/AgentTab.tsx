import React from 'react';

const AgentTab: React.FC = () => {
  return (
    <div className="tab-content active" id="agentTab">
                <div className="ai-conversation-flow">
                    <div className="message-group chat-bubble">
                        <span className="ai-message-label">AI Agent</span>
                        <p className="ai-message-text">
                            I'm analyzing your unified canvas. I can see you have:
                            <br/><br/>
                            • 1 Database (Assignment Tracker)<br/>
                            • 1 Artifact (Neural Network Visualizer)<br/>
                            • 1 Task List (Study Tasks)<br/>
                            • Multiple text blocks
                        </p>
                    </div>

                    <div className="message-group chat-bubble">
                        <div className="bg-[#161b22] rounded-lg p-3 border border-[#30363d]">
                            <div className="text-xs font-semibold text-purple-300 mb-2">Quick Commands</div>
                            <div className="space-y-1 text-xs text-gray-300">
                                <div><code className="px-2 py-0.5 bg-[#0d1117] rounded">/artifact</code> Create live code</div>
                                <div><code className="px-2 py-0.5 bg-[#0d1117] rounded">/database</code> Create table</div>
                                <div><code className="px-2 py-0.5 bg-[#0d1117] rounded">/tasks</code> Create task list</div>
                                <div><code className="px-2 py-0.5 bg-[#0d1117] rounded">/heading</code> Create heading</div>
                            </div>
                        </div>
                    </div>

                    <div className="message-group chat-bubble">
                        <span className="ai-message-label">AI Agent</span>
                        <p className="ai-message-text">
                            What would you like me to help you with?
                            <br/><br/>
                            • Generate content for any block<br/>
                            • Create new artifacts or databases<br/>
                            • Analyze your data<br/>
                            • Use MCP tools for external data
                        </p>
                    </div>
                </div>
            </div>
  );
};

export default AgentTab;
