# MCP & Skills Systems

## Model Context Protocol (MCP)

### Overview
MCP is a protocol that allows AI models to access external tools and services. Weave implements an MCP manager to coordinate multiple MCP servers.

### Architecture

```
┌─────────────────┐
│   AI Assistant  │
└────────┬────────┘
         │ Function calls
         ↓
┌─────────────────┐
│   MCP Manager   │
└────────┬────────┘
         │ Tool routing
         ↓
┌─────────────────────────────────┐
│       MCP Servers               │
├─────────────────────────────────┤
│ GitHub │ FS │ Search │ DB │ ... │
└─────────────────────────────────┘
```

### MCP Server Configuration

```typescript
interface MCPServerConfig {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  provider: string; // 'github', 'filesystem', 'search', etc.
  config: {
    [key: string]: any; // Provider-specific config
  };
  tools: MCPTool[];
}

interface MCPTool {
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
```

### Available MCP Servers

#### 1. GitHub MCP
**Purpose**: Access GitHub repositories, issues, PRs

**Tools**:
- `github_read_repo`: Read repository structure
- `github_read_file`: Read file contents
- `github_list_issues`: List issues
- `github_read_issue`: Read issue details
- `github_list_prs`: List pull requests
- `github_read_pr`: Read PR details

**Configuration**:
```json
{
  "id": "github",
  "name": "GitHub",
  "icon": "🐙",
  "enabled": true,
  "provider": "github",
  "config": {
    "token": "ghp_...",
    "default_owner": "username",
    "default_repo": "repo-name"
  }
}
```

#### 2. Filesystem MCP
**Purpose**: Read/write local files

**Tools**:
- `fs_read_file`: Read file contents
- `fs_write_file`: Write to file
- `fs_list_directory`: List directory contents
- `fs_search`: Search files by name/content

**Configuration**:
```json
{
  "id": "filesystem",
  "name": "Filesystem",
  "icon": "📁",
  "enabled": true,
  "provider": "filesystem",
  "config": {
    "allowed_paths": [
      "~/Documents",
      "~/Projects"
    ],
    "denied_paths": [
      "~/.ssh",
      "~/.aws"
    ]
  }
}
```

#### 3. Web Search MCP
**Purpose**: Search the web for current information

**Tools**:
- `web_search`: Search query
- `web_fetch`: Fetch webpage content

**Configuration**:
```json
{
  "id": "web-search",
  "name": "Web Search",
  "icon": "🔍",
  "enabled": true,
  "provider": "brave",
  "config": {
    "api_key": "BSA...",
    "max_results": 10
  }
}
```

#### 4. Database MCP
**Purpose**: Query external databases

**Tools**:
- `db_query`: Execute SQL query
- `db_schema`: Get table schema

**Configuration**:
```json
{
  "id": "database",
  "name": "Database",
  "icon": "📊",
  "enabled": false,
  "provider": "postgres",
  "config": {
    "host": "localhost",
    "port": 5432,
    "database": "mydb",
    "username": "user",
    "password": "***"
  }
}
```

#### 5. Figma MCP
**Purpose**: Read Figma designs

**Tools**:
- `figma_get_file`: Get file structure
- `figma_get_images`: Export images

**Configuration**:
```json
{
  "id": "figma",
  "name": "Figma",
  "icon": "🎨",
  "enabled": false,
  "provider": "figma",
  "config": {
    "token": "figd_...",
    "default_file": "file-key"
  }
}
```

#### 6. Notion MCP
**Purpose**: Sync with Notion workspace

**Tools**:
- `notion_read_page`: Read page content
- `notion_search`: Search pages
- `notion_create_page`: Create new page

**Configuration**:
```json
{
  "id": "notion",
  "name": "Notion",
  "icon": "🗂️",
  "enabled": false,
  "provider": "notion",
  "config": {
    "token": "secret_...",
    "default_database": "database-id"
  }
}
```

#### 7. Gmail MCP
**Purpose**: Read/send emails

**Tools**:
- `gmail_list`: List emails
- `gmail_read`: Read email
- `gmail_send`: Send email

**Configuration**:
```json
{
  "id": "gmail",
  "name": "Gmail",
  "icon": "📧",
  "enabled": false,
  "provider": "gmail",
  "config": {
    "credentials_path": "~/.weave/gmail_credentials.json"
  }
}
```

### MCP Manager Implementation

**Rust Backend**:
```rust
// src-tauri/src/mcp/manager.rs
use std::collections::HashMap;
use serde_json::Value;

pub struct MCPManager {
    servers: HashMap<String, MCPServer>,
    enabled_servers: HashSet<String>,
}

impl MCPManager {
    pub async fn start_server(&mut self, config: MCPServerConfig) -> Result<()> {
        let server = MCPServer::new(config).await?;
        self.servers.insert(server.id.clone(), server);
        Ok(())
    }

    pub async fn stop_server(&mut self, server_id: &str) -> Result<()> {
        if let Some(server) = self.servers.remove(server_id) {
            server.shutdown().await?;
        }
        Ok(())
    }

    pub async fn call_tool(
        &self,
        server_id: &str,
        tool: &str,
        params: Value,
    ) -> Result<Value> {
        let server = self.servers.get(server_id)
            .ok_or("Server not found")?;

        if !self.enabled_servers.contains(server_id) {
            return Err("Server not enabled".into());
        }

        server.call_tool(tool, params).await
    }

    pub fn list_tools(&self) -> Vec<MCPTool> {
        self.servers.values()
            .filter(|s| self.enabled_servers.contains(&s.id))
            .flat_map(|s| s.tools.clone())
            .collect()
    }

    pub fn enable_server(&mut self, server_id: &str) {
        self.enabled_servers.insert(server_id.to_string());
    }

    pub fn disable_server(&mut self, server_id: &str) {
        self.enabled_servers.remove(server_id);
    }
}
```

**Frontend Integration**:
```typescript
// services/mcp/manager.ts
export class MCPService {
  async listServers(): Promise<MCPServerConfig[]> {
    return invoke('mcp_list_servers');
  }

  async enableServer(serverId: string): Promise<void> {
    return invoke('mcp_enable_server', { serverId });
  }

  async disableServer(serverId: string): Promise<void> {
    return invoke('mcp_disable_server', { serverId });
  }

  async callTool(serverId: string, tool: string, params: any): Promise<any> {
    return invoke('mcp_call_tool', { serverId, tool, params });
  }

  async listAvailableTools(): Promise<MCPTool[]> {
    return invoke('mcp_list_tools');
  }
}
```

---

## Skills System

### Overview
Skills are specialized instruction sets that enhance the AI's capabilities for specific tasks. They modify the system prompt to add expertise.

### Skill Structure

```typescript
interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
  instructions: string; // System prompt addition
  tools?: string[];      // Required MCP tools
  model?: string;        // Preferred model
  priority: number;      // Higher = earlier in prompt
}
```

### Default Skills

#### 1. Note Writer
```markdown
## Note Writer Skill

You are an expert note-taker specialized in creating well-structured,
comprehensive notes. When writing notes:

1. Use clear hierarchical structure (headings, sub-headings)
2. Include relevant examples and code snippets
3. Add LaTeX for mathematical formulas
4. Create tables for comparisons
5. Use toggle sections for detailed information
6. Link to related notes when appropriate

Output in Markdown with custom block syntax:
- `$$...$$` for display math
- `$...$` for inline math
- `/database` for creating tables
- `/artifact` for interactive examples

Always prioritize clarity and comprehensiveness.
```

#### 2. Code Generator
```markdown
## Code Generator Skill

You are a senior software engineer specialized in creating clean,
production-ready code. When generating code:

1. Follow language-specific best practices
2. Include comprehensive error handling
3. Add inline documentation and comments
4. Write testable, modular code
5. Consider performance and security
6. Provide usage examples

Always explain your design decisions and trade-offs.
For web artifacts, use modern HTML5, CSS3, and vanilla JavaScript.
```

#### 3. Data Analyzer
```markdown
## Data Analyzer Skill

You are a data scientist specialized in analyzing structured data.
When analyzing databases:

1. Understand the schema and relationships
2. Generate efficient SQL queries for insights
3. Create visualizations in artifact blocks
4. Identify patterns, trends, and anomalies
5. Provide statistical summaries
6. Suggest data quality improvements

Use the `query_database` tool to access data.
Present findings clearly with charts and tables.
```

#### 4. UI Designer
```markdown
## UI Designer Skill

You are a UI/UX designer specialized in creating beautiful,
functional interfaces. When designing:

1. Follow modern design principles
2. Ensure responsive layouts
3. Use appropriate color theory
4. Consider accessibility (WCAG AA)
5. Create intuitive user flows
6. Use consistent spacing and typography

For artifacts, use Tailwind-inspired utility classes.
Always explain design decisions.
```

#### 5. Researcher
```markdown
## Researcher Skill

You are a research specialist skilled in finding and synthesizing
information. When researching:

1. Use web search for current information
2. Verify facts from multiple sources
3. Cite sources properly
4. Summarize key findings
5. Identify knowledge gaps
6. Provide actionable insights

Use the `search_web` tool when needed.
Organize research in structured notes.
```

#### 6. Summarizer
```markdown
## Summarizer Skill

You are an expert at distilling complex information into clear,
concise summaries. When summarizing:

1. Identify key points and main themes
2. Remove redundant information
3. Maintain critical context
4. Use bullet points for clarity
5. Highlight important statistics or quotes
6. Provide multiple summary lengths (brief, detailed)

Adapt summary style to content type (article, meeting, code, etc.)
```

#### 7. Translator
```markdown
## Translator Skill

You are a professional translator fluent in multiple languages.
When translating:

1. Preserve original meaning and tone
2. Adapt idioms and cultural references
3. Maintain formatting (markdown, code blocks)
4. Note untranslatable terms
5. Provide context when needed
6. Support technical and creative content

Always specify source and target languages.
```

#### 8. Math Solver
```markdown
## Math Solver Skill

You are a mathematics expert specialized in problem-solving.
When solving math problems:

1. Show step-by-step solutions
2. Explain the reasoning behind each step
3. Use LaTeX for all mathematical notation
4. Provide visualizations when helpful
5. Verify solutions
6. Suggest alternative approaches

Use display math ($$...$$) for important equations.
Create artifacts for interactive graphs.
```

#### 9. Editor
```markdown
## Editor Skill

You are a professional editor focused on improving written content.
When editing:

1. Fix grammar, spelling, and punctuation
2. Improve clarity and conciseness
3. Enhance flow and structure
4. Maintain the author's voice
5. Suggest stronger word choices
6. Flag ambiguous statements

Provide both inline edits and explanatory comments.
Use the `edit_note` tool for direct modifications.
```

### Skill Manager Implementation

**Rust Backend**:
```rust
// src-tauri/src/skills/manager.rs
#[tauri::command]
pub async fn get_active_skills(
    state: State<'_, AppState>
) -> Result<Vec<Skill>, String> {
    sqlx::query_as!(
        Skill,
        "SELECT * FROM skills WHERE enabled = TRUE ORDER BY priority DESC"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())
}

pub fn build_system_prompt(base_prompt: &str, skills: &[Skill]) -> String {
    let mut prompt = base_prompt.to_string();

    // Add skills in priority order
    for skill in skills.iter().filter(|s| s.enabled) {
        prompt.push_str("\n\n---\n\n");
        prompt.push_str(&skill.instructions);
    }

    prompt
}
```

**Frontend UI**:
```typescript
// components/Skills/SkillPill.tsx
const SkillPill: React.FC<{ skill: Skill }> = ({ skill }) => {
  const { toggleSkill } = useSkills();

  return (
    <button
      className={`skill-pill ${skill.enabled ? 'active' : ''}`}
      onClick={() => toggleSkill(skill.id)}
    >
      <div className="skill-pill-check">
        {skill.enabled && '✓'}
      </div>
      <span className="skill-pill-icon">{skill.icon}</span>
      <span>{skill.name}</span>
    </button>
  );
};
```

### Skill Composition

Multiple skills can be active simultaneously. The system prompt is built by concatenating:

```
[Base System Prompt]
---
[Skill 1 Instructions] (highest priority)
---
[Skill 2 Instructions]
---
[Skill 3 Instructions]
---
...
```

Example combined prompt with Note Writer + Code Generator:
```
You are Weave AI, an intelligent assistant for note-taking...

---

## Note Writer Skill
You are an expert note-taker specialized in creating well-structured...

---

## Code Generator Skill
You are a senior software engineer specialized in creating clean...
```

### Best Practices

1. **Skill Selection**: Activate only relevant skills for the current task
2. **Skill Conflicts**: Some skills may conflict (e.g., Summarizer + Note Writer)
3. **Performance**: More skills = longer prompts = slower responses
4. **Custom Skills**: Users can create custom skills in settings
5. **Tool Requirements**: Skills can require specific MCP tools
