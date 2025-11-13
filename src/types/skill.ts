// Skills system types

export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
  instructions: string; // System prompt addition
  tools?: string[]; // Required MCP tools
  model?: string; // Preferred model
  priority?: number; // Higher = earlier in prompt
  created_at?: string;
}

export interface SkillCategory {
  name: string;
  skills: Skill[];
}
