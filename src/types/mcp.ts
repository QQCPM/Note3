// MCP (Model Context Protocol) types

export interface MCPServerConfig {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  provider: string; // 'github', 'filesystem', 'search', etc.
  config: Record<string, any>; // Provider-specific config
  tools: MCPTool[];
  created_at?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: {
    [key: string]: {
      type: string;
      description: string;
      required: boolean;
    };
  };
}

export interface MCPToolCall {
  server_id: string;
  tool_name: string;
  parameters: any;
}

export interface MCPToolResult {
  success: boolean;
  result?: any;
  error?: string;
}
