# AI Agent Enhancement Research & Implementation Plan
## Comprehensive Analysis for Weave Note-Taking System

**Date:** 2025-01-15
**Branch Analyzed:** `claude/ai-canvas-editing-phase2-0111cTNAExhpkkzZbNQmNXMA`
**Goal:** Transform the AI agent into a fully autonomous system capable of creating complete notes with all block types, real-time web access, and IDE-level capabilities.

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current Architecture Deep Dive](#current-architecture-deep-dive)
3. [Industry Best Practices (2025)](#industry-best-practices-2025)
4. [Gap Analysis](#gap-analysis)
5. [Proposed Enhancement Architecture](#proposed-enhancement-architecture)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Technical Specifications](#technical-specifications)

---

## Executive Summary

### Current State
The Weave AI system has a solid foundation:
- ✅ Hybrid AI architecture (local embeddings + cloud agents)
- ✅ 4 tools for function calling (read_block, read_note, edit_block, search_web)
- ✅ Multi-turn conversations (max 5 turns)
- ✅ Supports TextBlock editing with diff preview
- ✅ 6 block types (text, heading, artifact, database, task, web)
- ⚠️ Mock web search implementation
- ⚠️ Limited to text block editing only
- ⚠️ Context window: ~50K tokens (~200K chars)

### Target State
Transform into a **fully autonomous AI agent** that can:
1. 🌐 Access real-time internet data and know current date/time
2. 🎨 Create and edit ALL block types (artifacts, databases, tasks, web embeds)
3. 📝 Generate complete notes from scratch with multiple blocks
4. 🔄 Execute multi-step workflows with longer context (100K+ tokens)
5. 🤖 Work autonomously like Cursor/Windsurf IDEs but for note-taking
6. 🧠 Use advanced reasoning with planning and reflection

---

## Current Architecture Deep Dive

### 1. Hybrid AI Stack

```
┌─────────────────────────────────────────────────────┐
│               WEAVE AI CURRENT STACK                 │
├─────────────────────────────────────────────────────┤
│ LOCAL (Free, Fast, Private)                          │
│  • Embeddings: Qwen3-0.6B (1024-dim, ~50ms)         │
│  • Optional Reranking: Qwen3-8B                      │
│  • Optional Code Gen: Qwen3-Coder-30B                │
│                                                      │
│ CLOUD (Powerful, Tool Support)                       │
│  • Agent: GPT-4o (multi-turn, function calling)      │
│  • Code Gen: GPT-4o (fallback)                       │
│  • Database Gen: GPT-4o                              │
│                                                      │
│ EXTERNAL                                             │
│  • Web Search: Mock implementation (NEEDS REAL API)  │
└─────────────────────────────────────────────────────┘
```

### 2. Current Tool Ecosystem

| Tool | Purpose | Status | Limitations |
|------|---------|--------|-------------|
| `read_block` | Read single block content | ✅ Working | - |
| `read_note` | Read entire note | ✅ Working | - |
| `edit_block` | Edit text blocks | ✅ Working | **Only works for TextBlock** |
| `search_web` | Web search | ⚠️ Mock | **Not real web search** |

### 3. Block Types Analysis

| Block Type | Can Create via AI? | Can Edit via AI? | Current Limitations |
|------------|-------------------|------------------|---------------------|
| TextBlock | ✅ Yes (manual) | ✅ Yes (`edit_block`) | - |
| HeadingBlock | ✅ Yes (manual) | ❌ No | No AI editing tool |
| ArtifactBlock | ✅ Yes (`/artifact`) | ❌ No | No `edit_artifact` tool |
| DatabaseBlock | ✅ Yes (`/database`) | ❌ No | No `edit_database` tool |
| TaskBlock | ✅ Yes (manual) | ❌ No | No `edit_task` tool |
| WebBlock | ✅ Yes (`/web`) | ❌ No | No `edit_web` tool |

**KEY FINDING:** AI can only edit TextBlocks. Cannot modify artifacts, databases, tasks, or web embeds after creation.

### 4. Conversation Flow Limitations

```typescript
// Current implementation in aiEditService.ts
const systemPrompt = `You are an AI agent that helps users edit their notes.

CURRENT CONTEXT:
- Current Block ID: ${blockId}  // ⚠️ Single block context only
- Current Note ID: ${noteId}
- Current Block Content: [shown above]

Available tools:
- read_block, read_note, edit_block, search_web
```

**Limitations:**
1. **Single-block focus:** System prompt centers on ONE block
2. **No note-wide creation:** Can't create multiple blocks in one request
3. **No composite workflows:** Can't say "create a note about X with artifact Y and database Z"
4. **Limited context awareness:** No understanding of note structure or user goals beyond current block

---

## Industry Best Practices (2025)

Based on extensive research of Anthropic Claude, OpenAI GPT-4, Cursor, Windsurf, and Cline:

### 1. Extended Context Windows (Critical)

**Industry Standard (2025):**
- Claude Sonnet 4.5: **1M tokens** (upgraded from 200K)
- GPT-4o: **400K tokens** input, **128K output**
- Gemini 2.5: **1M tokens**
- Llama 4 Scout: **10M tokens**

**Reality Check:**
> "Models do not use their context uniformly. A model claiming 200K tokens typically becomes unreliable around 130K, with sudden performance drops rather than gradual degradation." - Chroma Research, 2025

**Best Practice:**
- Use **100-200K token effective window** for reliable operation
- Implement **context compression** and **selective injection**
- Current Weave limit: **~50K tokens** → Should increase to **100-200K**

### 2. Advanced Tool Calling Architecture

**OpenAI Best Practices (2025):**

1. **Clear Function Definitions**
   - Descriptive names that convey purpose
   - Detailed descriptions with parameter explanations
   - Use enums and structured objects to prevent invalid states

2. **Optimize Function Design**
   - Aim for **<20 functions** for higher accuracy
   - Combine functions that are always called in sequence
   - Don't make the model fill arguments you already know

3. **Security Considerations**
   - Prompt injection attacks are the #1 risk
   - Validate all tool outputs before acting
   - Implement user confirmation for destructive actions

4. **Context Management**
   > "Ingesting large amounts of data from tool calls can overflow the LLM's context window, leading to compromised execution, hallucinations, and the LLM forgetting its task."

**Current Weave Status:**
- ✅ Has 4 tools (well under 20 limit)
- ⚠️ Tools are NOT combined (could optimize)
- ⚠️ No security validation on tool outputs
- ⚠️ Context trimming is basic (200K char limit)

### 3. Computer Use & Extended Capabilities (Anthropic)

**Claude Computer Use (Public Beta):**
- Visual interface interaction through screenshots
- **Maintains focus for 30+ hours** on complex tasks
- Real-time environment observation
- Code execution in sandboxed environments
- MCP (Model Context Protocol) for extensibility

**Key Insight:** Modern AI agents can:
- Execute code and see results
- Search the web and incorporate findings
- Maintain long-running sessions
- Use visual feedback for complex tasks

### 4. IDE-Style Agent Architectures (Cursor, Windsurf, Cline)

**Common Patterns:**

1. **Cascade/Index-Based Reasoning**
   - Static analysis creates dependency graph
   - Cross-file reasoning using project structure
   - Local caching for faster context retrieval

2. **Hybrid Local + Cloud Models**
   - Local models for fast completions
   - Cloud models for complex reasoning
   - Smart routing layer per task

3. **Agentic Workflow**
   - Take series of steps
   - Evaluate results
   - Fix own issues
   - Continue until goal achieved

4. **MCP Integration**
   - Run tests, manage Git, update docs
   - Project management integration
   - Custom tools via marketplace

**Pricing Comparison (2025):**
- Windsurf: $15/individual, $30/team (most affordable)
- Cursor: $20/seat
- Cline: Free (open source, VSCode extension)

---

## Gap Analysis

### Critical Gaps

#### 1. Web Search is Mock Implementation
**Current:** `searchWeb()` returns hardcoded results
**Impact:** Agent cannot access current information, doesn't know today's date
**Solution:** Integrate real search API (Brave, Tavily, or OpenAI web_search_preview)

#### 2. Cannot Edit Non-Text Blocks
**Current:** Only `edit_block` tool exists, works only for TextBlock
**Impact:** After creating artifacts/databases, user must manually edit them
**Solution:** Add 5 new tools:
- `edit_artifact` - Modify HTML/CSS/JS
- `edit_database` - Add/remove rows/columns
- `edit_task` - Manage task items
- `edit_web` - Change embedded URL
- `create_block` - Add new blocks to note

#### 3. No Multi-Block Creation Capability
**Current:** Agent operates on single block context
**Impact:** Cannot fulfill requests like "create a note about X with artifact timer and database"
**Solution:** Add orchestration tools:
- `create_note` - Initialize new note
- `create_block` - Add blocks to note (text, heading, artifact, database, task, web)
- `arrange_blocks` - Reorder blocks, set layout
- Enhanced system prompt for note-level thinking

#### 4. Limited Context Window (50K tokens)
**Current:** Trims to ~50K tokens
**Impact:** Cannot handle large notes or complex multi-step workflows
**Solution:**
- Increase to 100-200K effective tokens
- Implement smarter context compression
- Use Claude Sonnet 4.5 (1M context) or GPT-4o (400K)

#### 5. No Planning/Reflection Layer
**Current:** Direct tool calling without planning
**Impact:** Inefficient token usage, no error recovery
**Solution:** Add planning phase:
- Agent first creates execution plan
- User approves plan
- Agent executes with reflection checkpoints
- Can backtrack and retry on errors

#### 6. No Real-Time Data Access
**Current:** Knowledge cutoff limits
**Impact:** Cannot answer "what's the weather today" or "latest news on X"
**Solution:**
- Real web search API
- Weather API integration
- News API integration
- System tool that provides current date/time

---

## Proposed Enhancement Architecture

### 1. Enhanced Tool Ecosystem

```typescript
// ============================================================================
// BLOCK CREATION TOOLS
// ============================================================================

{
  name: 'create_block',
  description: 'Create a new block in the note. Use this to build complete notes with multiple components.',
  parameters: {
    note_id: string,
    block_type: 'text' | 'heading1' | 'heading2' | 'artifact' | 'database' | 'task' | 'web',
    data: BlockCreationData,
    position?: number,
    reason: string
  }
}

// Examples:
// - create_block(note_id, 'heading1', {content: 'My Project'})
// - create_block(note_id, 'text', {content: '# Introduction\n...'})
// - create_block(note_id, 'artifact', {title: 'Timer', prompt: 'Create a pomodoro timer'})
// - create_block(note_id, 'database', {title: 'Tasks', prompt: 'Project task tracker'})

// ============================================================================
// BLOCK EDITING TOOLS (Expanded)
// ============================================================================

{
  name: 'edit_text_block',
  description: 'Edit the content of a text or heading block',
  parameters: {
    block_id: string,
    new_content: string,
    reason: string
  }
}

{
  name: 'edit_artifact',
  description: 'Modify the HTML, CSS, or JavaScript of an artifact block. Use to fix bugs, add features, or improve design.',
  parameters: {
    block_id: string,
    html?: string,           // Partial updates supported
    css?: string,
    javascript?: string,
    reason: string
  }
}

{
  name: 'edit_database',
  description: 'Modify database structure or data. Can add/remove columns, add/update/delete rows.',
  parameters: {
    block_id: string,
    action: 'add_column' | 'remove_column' | 'add_row' | 'update_row' | 'delete_row' | 'update_schema',
    data: DatabaseEditData,
    reason: string
  }
}

{
  name: 'edit_task_list',
  description: 'Manage task items in a task block',
  parameters: {
    block_id: string,
    action: 'add' | 'complete' | 'uncomplete' | 'delete' | 'update' | 'reorder',
    task_data: TaskEditData,
    reason: string
  }
}

{
  name: 'edit_web_block',
  description: 'Change the URL of a web embed block',
  parameters: {
    block_id: string,
    url: string,
    title?: string,
    reason: string
  }
}

// ============================================================================
// INFORMATION GATHERING TOOLS (Enhanced)
// ============================================================================

{
  name: 'search_web_real',
  description: 'Search the internet for current, up-to-date information. Use when you need facts, news, research, or anything beyond your training data.',
  parameters: {
    query: string,
    num_results?: number,    // Default 5, max 10
    freshness?: 'day' | 'week' | 'month' | 'year',
    language?: string
  }
}

{
  name: 'get_current_datetime',
  description: 'Get the current date and time in ISO format. Use when you need to know today\'s date.',
  parameters: {}
  // Returns: {date: '2025-01-15', time: '14:30:00', timezone: 'UTC', ...}
}

{
  name: 'fetch_url_content',
  description: 'Fetch and extract text content from a specific URL. Use for reading articles, documentation, etc.',
  parameters: {
    url: string,
    extract_mode?: 'text' | 'markdown' | 'html'
  }
}

// ============================================================================
// NOTE ORCHESTRATION TOOLS
// ============================================================================

{
  name: 'create_note',
  description: 'Create a new note. Use when user asks to "make a note about X".',
  parameters: {
    title: string,
    tags?: string[],
    reason: string
  }
  // Returns: note_id for subsequent create_block calls
}

{
  name: 'arrange_blocks',
  description: 'Reorder blocks or set layout (width, alignment). Use to organize note structure.',
  parameters: {
    note_id: string,
    block_positions: Array<{block_id: string, position: number}>,
    layouts?: Array<{block_id: string, width: string, alignment: string}>
  }
}

{
  name: 'read_note_structure',
  description: 'Get high-level structure of a note (block types, positions, titles) without full content. Faster than read_note for planning.',
  parameters: {
    note_id: string
  }
}

// ============================================================================
// ADVANCED TOOLS
// ============================================================================

{
  name: 'execute_python',
  description: 'Execute Python code in a sandboxed environment. Use for calculations, data analysis, or generating visualizations.',
  parameters: {
    code: string,
    return_format?: 'text' | 'json' | 'image'
  }
}

{
  name: 'search_notes_semantic',
  description: 'Search all user notes using semantic similarity. Use to find related notes or reference past work.',
  parameters: {
    query: string,
    max_results?: number
  }
}
```

**Total Tools: 15** (within <20 best practice limit)

### 2. Enhanced System Prompt Architecture

```typescript
// Multi-mode system prompts based on user intent

// MODE 1: Note Creation Mode (when creating new notes)
const NOTE_CREATION_PROMPT = `You are an autonomous AI agent specialized in creating comprehensive notes.

CAPABILITIES:
You can create complete notes from scratch with multiple blocks:
- Text blocks (markdown, LaTeX)
- Heading blocks (H1, H2)
- Artifact blocks (interactive HTML/CSS/JS)
- Database blocks (tables with views)
- Task blocks (checklists with priorities)
- Web blocks (YouTube, websites)

WORKFLOW:
1. Understand user's goal
2. Search web if needed for current information
3. Plan note structure (what blocks, in what order)
4. Create blocks step-by-step using create_block
5. Arrange blocks for optimal layout
6. Verify completeness

AVAILABLE TOOLS:
- create_note: Start new note
- create_block: Add blocks (text, heading, artifact, database, task, web)
- search_web_real: Get current information
- get_current_datetime: Know today's date
- arrange_blocks: Organize layout
- read_note_structure: Check progress

EXAMPLE REQUEST: "Create a note about the latest AI trends with a database of top models"

YOUR PLAN:
1. create_note(title="AI Trends 2025")
2. search_web_real("latest AI trends 2025")
3. create_block(type='heading1', data={content: "AI Trends 2025"})
4. create_block(type='text', data={content: "[Summary from web search]"})
5. create_block(type='database', data={title: "Top AI Models", prompt: "Create table of top AI models with capabilities"})
6. arrange_blocks to set layout

IMPORTANT:
- Always verify current date/time when needed
- Search web for facts you're unsure about
- Create blocks in logical order (heading → content → interactive elements)
- Use proper markdown formatting
- Provide clear reasons for each action
`;

// MODE 2: Note Editing Mode (when editing existing notes)
const NOTE_EDITING_PROMPT = `You are an AI agent that helps improve and modify notes.

CURRENT CONTEXT:
- Note ID: ${noteId}
- Focused Block ID: ${blockId}
- Block Type: ${blockType}

CAPABILITIES:
You can edit ANY block type:
- Text: edit_text_block
- Artifacts: edit_artifact (HTML/CSS/JS changes)
- Databases: edit_database (rows, columns, schema)
- Tasks: edit_task_list (add, complete, reorder)
- Web: edit_web_block (change URL)

You can also:
- Add new blocks: create_block
- Search web: search_web_real
- Read other blocks: read_block, read_note
- Get current info: get_current_datetime

WORKFLOW:
1. Understand what user wants to change
2. Read relevant context (read_note, read_block)
3. Search web if current information needed
4. Make edits with clear reasoning
5. Verify changes are complete

EXAMPLE REQUEST: "Add a timer artifact to this note and update the database with today's date"

YOUR PLAN:
1. get_current_datetime() → "2025-01-15"
2. read_note(note_id) to understand context
3. create_block(type='artifact', data={title: "Pomodoro Timer", prompt: "25min timer with sound"})
4. edit_database(action='update_row', data={date_column: "2025-01-15"})
`;

// MODE 3: Research Mode (when answering questions)
const RESEARCH_PROMPT = `You are a research assistant with access to real-time information.

CAPABILITIES:
- search_web_real: Search the internet
- fetch_url_content: Read specific articles
- get_current_datetime: Know today's date
- search_notes_semantic: Search user's past notes
- execute_python: Run calculations/analysis

WORKFLOW:
1. Determine what information is needed
2. Search web for current facts
3. Fetch detailed content if needed
4. Synthesize information
5. Present findings with sources

IMPORTANT:
- Always cite sources with URLs
- Use get_current_datetime for time-sensitive queries
- Cross-reference multiple sources
- Mark information as "as of [date]"
`;
```

### 3. Extended Context Management

```typescript
interface ContextManager {
  maxTokens: number;           // 100-200K target
  compressionStrategy: 'selective' | 'summarize' | 'hierarchical';
  priorityRules: PriorityRule[];
}

// Selective Context Injection
// Keep most relevant parts, summarize or drop less relevant
const contextPriorities = [
  { type: 'system_prompt', priority: 100, compress: false },
  { type: 'current_block', priority: 90, compress: false },
  { type: 'user_request', priority: 85, compress: false },
  { type: 'tool_results', priority: 80, compress: 'summarize', max_age: 3 },
  { type: 'note_structure', priority: 70, compress: true },
  { type: 'historical_messages', priority: 50, compress: 'summarize', max_age: 5 }
];

// Hierarchical Context
// Instead of flat conversation history, structure as:
// - User Goal
//   - Subtask 1
//     - Tool calls
//     - Results
//   - Subtask 2
//     - ...

// When context limit approaching:
// 1. Summarize completed subtasks
// 2. Keep only recent tool results
// 3. Preserve system prompt and current goal
```

### 4. Planning & Reflection Architecture

```typescript
interface AgentWorkflow {
  phases: ['understand', 'plan', 'execute', 'reflect', 'complete'];
  currentPhase: Phase;
  plan: ExecutionPlan;
  checkpoints: Checkpoint[];
}

// PHASE 1: Understand
// - Parse user request
// - Identify intent (create note, edit block, research, etc.)
// - Determine required tools

// PHASE 2: Plan (NEW!)
// Agent creates explicit plan:
const plan = {
  goal: "Create comprehensive note about black holes with timer artifact",
  steps: [
    { action: 'search_web_real', params: {query: "black holes 2025"}, reason: "Get current info" },
    { action: 'create_note', params: {title: "Black Holes"}, reason: "Initialize note" },
    { action: 'create_block', params: {type: 'heading1'}, reason: "Add title" },
    { action: 'create_block', params: {type: 'text'}, reason: "Add summary from research" },
    { action: 'create_block', params: {type: 'artifact'}, reason: "Add study timer" },
    { action: 'arrange_blocks', params: {}, reason: "Organize layout" }
  ],
  estimated_turns: 6
};

// Show plan to user → User approves → Execute

// PHASE 3: Execute
// - Execute each step
// - Store results at checkpoints
// - Track progress

// PHASE 4: Reflect (NEW!)
// After each step or every N steps:
reflection = {
  completed: ["search_web_real", "create_note", "create_block (heading)"],
  current: "create_block (text)",
  remaining: ["create_block (artifact)", "arrange_blocks"],
  issues_encountered: [],
  next_action: "create_block with content from web search"
};

// If error occurs:
// - Reflect on what went wrong
// - Adjust plan
// - Retry with different approach

// PHASE 5: Complete
// - Verify all steps completed
// - Check goal achieved
// - Present results to user
```

### 5. Real-Time Data Integration

```typescript
// ============================================================================
// BRAVE SEARCH API INTEGRATION (Recommended)
// ============================================================================

// Why Brave?
// - $5-20/mo pricing (affordable)
// - 2000-15000 queries/month
// - Privacy-focused
// - Good quality results
// - Real-time web index

interface BraveSearchConfig {
  apiKey: string;
  endpoint: 'https://api.search.brave.com/res/v1/web/search';
  safeSearch: 'off' | 'moderate' | 'strict';
  freshness?: 'day' | 'week' | 'month' | 'year';
}

async function searchWebBrave(query: string, options: SearchOptions): Promise<SearchResult[]> {
  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${options.maxResults || 5}`,
    {
      headers: {
        'X-Subscription-Token': BRAVE_API_KEY,
        'Accept': 'application/json'
      }
    }
  );

  const data = await response.json();

  return data.web.results.map(result => ({
    title: result.title,
    snippet: result.description,
    url: result.url,
    source: new URL(result.url).hostname,
    publishedDate: result.page_age || result.published_date
  }));
}

// ============================================================================
// ALTERNATIVE: OPENAI WEB SEARCH (GPT-4o Native)
// ============================================================================

// OpenAI now provides web_search_preview tool
// - Built into GPT-4o and GPT-4o-mini
// - $30/1000 queries (GPT-4o), $25/1000 (4o-mini)
// - Automatic citations
// - No separate API needed

interface OpenAIWebSearchTool {
  type: 'web_search_preview';
  // Activates automatically when model needs current info
}

// Usage in chatWithTools:
const tools = [
  ...AI_EDIT_TOOLS,
  { type: 'web_search_preview' as const }
];

// Model will call web_search automatically when:
// - User asks about current events
// - Knowledge cutoff limitation detected
// - Time-sensitive query detected

// ============================================================================
// ALTERNATIVE: TAVILY API (AI-Optimized Search)
// ============================================================================

// Tavily is built specifically for AI agents
// - $50-200/mo for 1K-10K searches
// - Returns AI-optimized summaries
// - Includes relevance scoring
// - Source validation

// ============================================================================
// CURRENT DATE/TIME TOOL
// ============================================================================

function getCurrentDateTime() {
  const now = new Date();
  return {
    date: now.toISOString().split('T')[0],           // "2025-01-15"
    time: now.toISOString().split('T')[1].split('.')[0],  // "14:30:00"
    iso: now.toISOString(),                          // "2025-01-15T14:30:00.000Z"
    timestamp: now.getTime(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }),
    formatted: now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  };
}

// Add as tool:
{
  name: 'get_current_datetime',
  description: 'Get current date and time. Use when you need to know today\'s date or current time.',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal:** Enable real-time data access and basic multi-block operations

**Tasks:**
1. ✅ Integrate Brave Search API
   - Add API key to config
   - Replace mock `searchWeb()` with real implementation
   - Test with various queries
   - Handle rate limits and errors

2. ✅ Add `get_current_datetime` tool
   - Backend Tauri command
   - Frontend service integration
   - Add to AI_EDIT_TOOLS

3. ✅ Implement `create_block` tool
   - Support all 6 block types
   - Parameter validation
   - Position management
   - Add to diff preview system

4. ✅ Extend context window
   - Increase trim limit to 100-200K tokens
   - Test with Claude Sonnet 4.5 (1M context)
   - Implement better trimming strategy

**Success Metrics:**
- Agent can search web and get real results
- Agent knows current date/time
- Agent can create new blocks in existing notes
- Context window handles 100K+ tokens reliably

### Phase 2: Multi-Block Editing (Week 3-4)
**Goal:** Enable AI to edit all block types, not just text

**Tasks:**
1. ✅ Implement `edit_artifact` tool
   - Allow HTML/CSS/JS modifications
   - Partial update support (change only HTML, keep CSS/JS)
   - Code diff viewer for artifacts
   - Safety validation (no XSS, etc.)

2. ✅ Implement `edit_database` tool
   - Add/remove columns
   - Add/update/delete rows
   - Schema changes (column types, options)
   - Database diff viewer

3. ✅ Implement `edit_task_list` tool
   - Add/complete/delete tasks
   - Update task properties (priority, due date)
   - Reorder tasks

4. ✅ Implement `edit_web_block` tool
   - Change URL
   - Update title
   - Validate URLs

5. ✅ Create block-specific diff viewers
   - ArtifactDiffPreview (code diff)
   - DatabaseDiffPreview (schema/data diff)
   - TaskDiffPreview (task list diff)
   - WebDiffPreview (URL change preview)

**Success Metrics:**
- Agent can modify artifact code (fix bugs, add features)
- Agent can edit database structure and data
- Agent can manage task lists
- All edits show clear diffs for user approval

### Phase 3: Note Orchestration (Week 5-6)
**Goal:** Enable creation of complete notes from scratch

**Tasks:**
1. ✅ Implement `create_note` tool
   - Create new note with title, tags
   - Return note_id for subsequent operations
   - Set initial metadata

2. ✅ Implement `arrange_blocks` tool
   - Reorder blocks
   - Set layout (width, alignment)
   - Support side-by-side blocks

3. ✅ Implement `read_note_structure` tool
   - Return note metadata + block outline
   - Faster than full read_note
   - Use for planning

4. ✅ Create NOTE_CREATION_PROMPT
   - Specialized system prompt for note creation
   - Include examples and workflow
   - Test with various requests

5. ✅ Multi-block creation workflow
   - Agent can create 5+ blocks in sequence
   - Proper ordering and layout
   - Verify completeness

**Success Metrics:**
- Agent can create complete note from single request
- Example: "Create a note about Python with code examples and task list"
- Result: Note with H1, text blocks, artifact (Python code), task block
- Proper layout and organization

### Phase 4: Planning & Reflection (Week 7-8)
**Goal:** Add planning layer for complex multi-step operations

**Tasks:**
1. ✅ Implement planning phase
   - User request → Agent generates plan
   - Plan shows: goal, steps, estimated turns
   - User approves/modifies plan
   - Agent executes

2. ✅ Add reflection checkpoints
   - After each step: reflect on progress
   - Check if goal being achieved
   - Adjust plan if needed

3. ✅ Error recovery system
   - Detect when tool call fails
   - Reflect on why it failed
   - Try alternative approach
   - Max 3 retries per step

4. ✅ Progress tracking UI
   - Show plan in sidebar
   - Highlight current step
   - Check off completed steps
   - Display reflection notes

**Success Metrics:**
- Agent creates plans for complex requests
- User can review plan before execution
- Agent recovers from errors automatically
- Complex workflows complete reliably (90%+ success rate)

### Phase 5: Advanced Capabilities (Week 9-10)
**Goal:** IDE-level capabilities and extended integrations

**Tasks:**
1. ✅ Implement `execute_python` tool
   - Sandboxed Python execution
   - Support data analysis, calculations
   - Return text, JSON, or images
   - Timeout and memory limits

2. ✅ Implement `fetch_url_content` tool
   - Extract text from URLs
   - Support markdown conversion
   - Handle various content types
   - Rate limiting

3. ✅ Implement `search_notes_semantic` tool
   - Use local embeddings
   - Find similar notes
   - Return relevance scores
   - Use for referencing past work

4. ✅ Add advanced context management
   - Hierarchical context structure
   - Intelligent summarization
   - Priority-based retention
   - Support 200K+ effective context

5. ✅ MCP integration exploration
   - Research Model Context Protocol
   - Identify useful MCP servers
   - Plan integration architecture

**Success Metrics:**
- Agent can run Python for calculations
- Agent can read external URLs for research
- Agent can reference user's past notes
- Context window handles very large notes (50+ blocks)

### Phase 6: Polish & Optimization (Week 11-12)
**Goal:** Production readiness and performance optimization

**Tasks:**
1. ✅ Performance optimization
   - Reduce tool call latency
   - Cache search results (15min)
   - Optimize context trimming
   - Batch operations where possible

2. ✅ Security hardening
   - Input validation for all tools
   - XSS prevention in artifacts
   - SQL injection prevention in databases
   - Rate limiting on external APIs

3. ✅ Error handling & UX
   - Clear error messages
   - Graceful degradation
   - Offline mode (when APIs down)
   - User feedback collection

4. ✅ Documentation
   - User guide for AI capabilities
   - Developer docs for adding tools
   - Architecture documentation
   - Example workflows

5. ✅ Testing & QA
   - Unit tests for all tools
   - Integration tests for workflows
   - User acceptance testing
   - Performance benchmarks

**Success Metrics:**
- All tools have <2s average latency
- Security audit passes
- User satisfaction >4.5/5
- 95%+ uptime for AI features

---

## Technical Specifications

### 1. Backend Changes (Rust/Tauri)

```rust
// src-tauri/src/commands/ai.rs

/// Get current date and time
#[tauri::command]
pub async fn ai_get_current_datetime() -> Result<CurrentDateTime, String> {
    use chrono::{Utc, Local};

    let now_utc = Utc::now();
    let now_local = Local::now();

    Ok(CurrentDateTime {
        date: now_utc.format("%Y-%m-%d").to_string(),
        time: now_utc.format("%H:%M:%S").to_string(),
        iso: now_utc.to_rfc3339(),
        timestamp: now_utc.timestamp(),
        timezone: now_local.offset().to_string(),
        day_of_week: now_utc.format("%A").to_string(),
        formatted: now_local.format("%B %d, %Y at %I:%M %p").to_string(),
    })
}

/// Search web using Brave API
#[tauri::command]
pub async fn ai_search_web_brave(
    query: String,
    max_results: Option<usize>,
    freshness: Option<String>,
) -> Result<Vec<SearchResult>, String> {
    use reqwest;
    use serde_json::Value;

    let api_key = std::env::var("BRAVE_API_KEY")
        .map_err(|_| "Brave API key not configured".to_string())?;

    let client = reqwest::Client::new();
    let mut url = format!(
        "https://api.search.brave.com/res/v1/web/search?q={}&count={}",
        urlencoding::encode(&query),
        max_results.unwrap_or(5)
    );

    if let Some(f) = freshness {
        url.push_str(&format!("&freshness={}", f));
    }

    let response = client
        .get(&url)
        .header("X-Subscription-Token", api_key)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Search request failed: {}", e))?;

    let data: Value = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Parse results...
    let results = parse_brave_results(data)?;

    Ok(results)
}

/// Create a new block in note
#[tauri::command]
pub async fn ai_create_block(
    note_id: String,
    block_type: String,
    data: Value,
    position: Option<i32>,
    app_handle: AppHandle,
) -> Result<String, String> {
    use uuid::Uuid;

    // Get database connection
    let db = get_db_connection(&app_handle)?;

    // Generate block ID
    let block_id = Uuid::new_v4().to_string();

    // Determine position (append to end if not specified)
    let pos = match position {
        Some(p) => p,
        None => {
            // Get max position + 1
            let max_pos: Option<i32> = db.query_row(
                "SELECT MAX(position) FROM blocks WHERE note_id = ?",
                params![note_id],
                |row| row.get(0)
            ).unwrap_or(Some(0));
            max_pos.unwrap_or(0) + 1
        }
    };

    // Insert block
    db.execute(
        "INSERT INTO blocks (id, note_id, type, position, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
        params![block_id, note_id, block_type, pos, data.to_string()],
    ).map_err(|e| format!("Failed to create block: {}", e))?;

    Ok(block_id)
}

/// Edit artifact block
#[tauri::command]
pub async fn ai_edit_artifact(
    block_id: String,
    html: Option<String>,
    css: Option<String>,
    javascript: Option<String>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let db = get_db_connection(&app_handle)?;

    // Get current block data
    let current_data: String = db.query_row(
        "SELECT data FROM blocks WHERE id = ?",
        params![block_id],
        |row| row.get(0)
    ).map_err(|e| format!("Block not found: {}", e))?;

    let mut data: Value = serde_json::from_str(&current_data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    // Update only provided fields
    if let Some(h) = html {
        data["html"] = Value::String(h);
    }
    if let Some(c) = css {
        data["css"] = Value::String(c);
    }
    if let Some(j) = javascript {
        data["javascript"] = Value::String(j);
    }

    // Update block
    db.execute(
        "UPDATE blocks SET data = ?, updated_at = datetime('now') WHERE id = ?",
        params![data.to_string(), block_id],
    ).map_err(|e| format!("Failed to update artifact: {}", e))?;

    Ok(())
}

/// Edit database block
#[tauri::command]
pub async fn ai_edit_database(
    block_id: String,
    action: String,
    data: Value,
    app_handle: AppHandle,
) -> Result<(), String> {
    // Implementation similar to ai_edit_artifact
    // but handles database-specific operations:
    // - add_column: Add new column to schema
    // - remove_column: Remove column and all its data
    // - add_row: Insert new row
    // - update_row: Modify existing row
    // - delete_row: Remove row

    // ... implementation details ...

    Ok(())
}
```

### 2. Frontend Changes (TypeScript/React)

```typescript
// src/services/aiEditService.ts

// Updated tool definitions
export const AI_EDIT_TOOLS_V2: Tool[] = [
  // ... existing tools ...

  {
    type: 'function' as const,
    function: {
      name: 'create_block',
      description: 'Create a new block in the note. Use this to build complete notes with multiple components.',
      parameters: {
        type: 'object',
        properties: {
          note_id: { type: 'string', description: 'The ID of the note' },
          block_type: {
            type: 'string',
            enum: ['text', 'heading1', 'heading2', 'artifact', 'database', 'task', 'web'],
            description: 'Type of block to create'
          },
          data: {
            type: 'object',
            description: 'Block-specific data (content, title, prompt, etc.)'
          },
          position: {
            type: 'number',
            description: 'Position in note (optional, appends to end if not specified)'
          },
          reason: { type: 'string', description: 'Why creating this block' }
        },
        required: ['note_id', 'block_type', 'data', 'reason']
      }
    }
  },

  {
    type: 'function' as const,
    function: {
      name: 'edit_artifact',
      description: 'Modify HTML, CSS, or JavaScript of an artifact. Use to fix bugs, add features, or improve design.',
      parameters: {
        type: 'object',
        properties: {
          block_id: { type: 'string', description: 'ID of artifact block' },
          html: { type: 'string', description: 'New HTML (optional if only changing CSS/JS)' },
          css: { type: 'string', description: 'New CSS (optional)' },
          javascript: { type: 'string', description: 'New JavaScript (optional)' },
          reason: { type: 'string', description: 'Why making these changes' }
        },
        required: ['block_id', 'reason']
      }
    }
  },

  {
    type: 'function' as const,
    function: {
      name: 'get_current_datetime',
      description: 'Get current date and time. Use when you need to know today\'s date.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },

  // ... more tools ...
];

// Enhanced system prompt with mode selection
function getSystemPrompt(mode: 'create' | 'edit' | 'research', context: Context): string {
  const baseCapabilities = `
REAL-TIME CAPABILITIES:
- search_web_real: Search internet for current information
- get_current_datetime: Know today's date and time
- fetch_url_content: Read articles and documentation

BLOCK OPERATIONS:
- create_block: Add new blocks (text, heading, artifact, database, task, web)
- edit_text_block: Modify text/heading content
- edit_artifact: Change HTML/CSS/JavaScript
- edit_database: Modify tables (add/remove rows/columns)
- edit_task_list: Manage tasks
- read_block, read_note: Read content for context
`;

  if (mode === 'create') {
    return `You are an autonomous AI agent specialized in creating comprehensive notes.

${baseCapabilities}

WORKFLOW FOR NOTE CREATION:
1. Understand user's goal and requirements
2. Search web if you need current information or facts
3. Plan note structure (what blocks, in what order)
4. Create blocks step-by-step:
   - Start with heading (H1 for title)
   - Add text blocks for content
   - Add artifacts for interactive elements
   - Add databases for structured data
   - Add task blocks for action items
   - Add web blocks for embedded content
5. Arrange blocks with proper layout
6. Verify completeness

CURRENT CONTEXT:
- Note ID: ${context.noteId}
- Current Date: ${context.currentDate}

IMPORTANT:
- ALWAYS use get_current_datetime when you need today's date
- ALWAYS search web for facts you're uncertain about
- Create blocks in logical order
- Use proper markdown formatting
- Provide clear reasoning for each action
- Ask user if requirements unclear

EXAMPLE:
User: "Create a note about black holes with a study timer"
Your actions:
1. search_web_real("black holes 2025 latest research")
2. create_block(type='heading1', data={content: "Black Holes - Cosmic Mysteries"})
3. create_block(type='text', data={content: "[Comprehensive info from web search]"})
4. create_block(type='artifact', data={title: "Study Timer", prompt: "Pomodoro timer 25min"})
5. arrange_blocks to set proper layout
`;
  }

  if (mode === 'edit') {
    return `You are an AI agent that helps improve and modify notes.

${baseCapabilities}

CURRENT CONTEXT:
- Note ID: ${context.noteId}
- Block ID: ${context.blockId}
- Block Type: ${context.blockType}
- Current Date: ${context.currentDate}

WORKFLOW FOR EDITING:
1. Understand what user wants changed
2. Read necessary context (read_block, read_note)
3. Search web if current information needed
4. Make appropriate edits
5. Verify changes are complete

YOU CAN EDIT ANY BLOCK TYPE:
- Text/Heading: edit_text_block
- Artifact: edit_artifact (modify HTML/CSS/JS)
- Database: edit_database (change structure or data)
- Task: edit_task_list (add/complete tasks)
- Web: edit_web_block (change URL)

IMPORTANT:
- Use get_current_datetime for time-sensitive edits
- Search web to verify facts before editing
- Provide clear reasoning for changes
- Consider full context before editing

EXAMPLE:
User: "Fix the timer artifact to count down from 30 minutes"
Your actions:
1. read_block(artifact_block_id) to see current code
2. edit_artifact(block_id, javascript="[updated countdown logic]", reason="Changed from 25min to 30min")
`;
  }

  // mode === 'research'
  return `You are a research assistant with real-time information access.

${baseCapabilities}

CURRENT DATE: ${context.currentDate}

WORKFLOW FOR RESEARCH:
1. Identify what information user needs
2. Search web for current, accurate information
3. Fetch detailed content from URLs if needed
4. Synthesize findings from multiple sources
5. Present with proper citations

IMPORTANT:
- ALWAYS use search_web_real for current events, news, or recent developments
- ALWAYS cite sources with URLs
- Use get_current_datetime for time-sensitive queries
- Cross-reference multiple sources when possible
- Mark all information with "as of [date]"
- Be transparent about confidence level

EXAMPLE:
User: "What are the latest developments in AI?"
Your actions:
1. get_current_datetime() → "2025-01-15"
2. search_web_real("AI developments January 2025")
3. [Present findings with sources and dates]
`;
}

// Tool handling in streamWithTauriAI
async function streamWithTauriAI(options: StreamChatOptions): Promise<void> {
  // ... existing code ...

  // Handle new tools
  for (const toolCall of result.tool_calls) {
    const functionName = (toolCall as any).function?.name || toolCall.name;
    const parsedArgs = /* parse arguments */;

    if (functionName === 'get_current_datetime') {
      const dateTime = await tauriAI.getCurrentDateTime();
      conversationHistory.push({
        role: 'user',
        content: `[Current date/time]: ${JSON.stringify(dateTime, null, 2)}`
      });
      shouldContinue = true;

    } else if (functionName === 'create_block') {
      const blockId = await tauriAI.createBlock(
        parsedArgs.note_id,
        parsedArgs.block_type,
        parsedArgs.data,
        parsedArgs.position
      );

      aiStore.addPendingEdit({
        blockId,
        editType: 'create',
        proposedData: parsedArgs.data,
        reason: parsedArgs.reason
      });

      conversationHistory.push({
        role: 'user',
        content: `[Block created]: ${parsedArgs.block_type} block with ID ${blockId}`
      });

    } else if (functionName === 'edit_artifact') {
      const block = blocksStore.blocks.find(b => b.id === parsedArgs.block_id);
      if (block) {
        aiStore.addPendingEdit({
          blockId: parsedArgs.block_id,
          editType: 'artifact',
          originalContent: block.data,
          proposedContent: {
            html: parsedArgs.html,
            css: parsedArgs.css,
            javascript: parsedArgs.javascript
          },
          reason: parsedArgs.reason
        });
      }

    } else if (functionName === 'edit_database') {
      // Handle database edits...

    } // ... more tool handlers
  }
}
```

### 3. Configuration Updates

```typescript
// src/types/ai.ts

export interface AIConfig {
  // ... existing config ...

  // New: Web search configuration
  webSearch: {
    provider: 'brave' | 'tavily' | 'openai_native';
    apiKey?: string;
    maxResults: number;
    cacheDuration: number; // minutes
  };

  // New: Extended context settings
  contextManagement: {
    maxTokens: number;              // 100000-200000
    compressionStrategy: 'selective' | 'summarize' | 'hierarchical';
    priorityRules: ContextPriority[];
  };

  // New: Planning settings
  planning: {
    enabled: boolean;
    requireUserApproval: boolean;
    maxPlanSteps: number;
    reflectionInterval: number;  // Reflect every N steps
  };

  // New: Tool execution settings
  execution: {
    maxToolCallsPerTurn: number;   // Default: 10
    maxTurns: number;               // Default: 10 (increased from 5)
    timeout: number;                // Per-tool timeout in ms
    retryOnError: boolean;
    maxRetries: number;
  };
}

export interface ContextPriority {
  type: 'system_prompt' | 'user_request' | 'tool_result' | 'historical';
  priority: number;     // 0-100
  compress: boolean | 'summarize';
  maxAge?: number;      // For tool results, keep only last N
}
```

---

## Cost Analysis

### Current Costs (Monthly, Moderate Usage)

| Service | Usage | Cost |
|---------|-------|------|
| OpenAI GPT-4o | 1000 agent requests (~2M tokens) | $20 |
| Local Models | Unlimited (self-hosted) | $0 |
| **Total** | | **$20/mo** |

### Enhanced System Costs (Monthly, Moderate Usage)

| Service | Usage | Cost |
|---------|-------|------|
| OpenAI GPT-4o | 1000 agent requests (~4M tokens due to longer context) | $40 |
| Brave Search API | 5000 searches | $10 |
| Local Models | Unlimited (self-hosted) | $0 |
| **Total** | | **$50/mo** |

### Alternative: Use Claude Sonnet 4.5

| Service | Usage | Cost |
|---------|-------|------|
| Claude Sonnet 4.5 | 1000 agent requests (~4M tokens) | $12 |
| Brave Search API | 5000 searches | $10 |
| Local Models | Unlimited | $0 |
| **Total** | | **$22/mo** |

**Recommendation:** Claude Sonnet 4.5 offers:
- Lower cost ($12 vs $40 for same token usage)
- Larger context window (1M vs 400K)
- Better tool use capabilities
- Longer session focus (30+ hours on complex tasks)

---

## Risk Assessment

### High Priority Risks

1. **Context Window Reliability**
   - **Risk:** Performance degrades unpredictably with large contexts
   - **Mitigation:** Implement aggressive testing at 100K, 150K, 200K token levels; use hierarchical context compression
   - **Fallback:** If degradation detected, summarize older context automatically

2. **Tool Call Explosion**
   - **Risk:** Agent makes too many tool calls, exceeding cost limits
   - **Mitigation:** Set maxToolCallsPerTurn=10, maxTurns=10; require user approval for plans with >20 steps
   - **Monitoring:** Track tool usage per session, alert if excessive

3. **Web Search API Rate Limits**
   - **Risk:** Hit rate limits during high usage
   - **Mitigation:** Implement 15-minute cache; deduplicate similar queries; fallback to cached/mock results
   - **Alert:** Warn user when approaching rate limit

4. **Security: Prompt Injection**
   - **Risk:** Malicious user input tricks agent into unintended actions
   - **Mitigation:** Validate all tool outputs before execution; require user approval for destructive actions; sanitize inputs
   - **Testing:** Red team testing with known injection patterns

5. **Cost Overruns**
   - **Risk:** Users with large notes or many requests exceed budget
   - **Mitigation:** Implement usage quotas; show cost estimates before execution; offer pause/resume for long operations
   - **Monitoring:** Daily cost dashboard per user

### Medium Priority Risks

6. **Artifact Security (XSS)**
   - **Risk:** Generated artifacts contain malicious scripts
   - **Mitigation:** CSP headers in iframes; script validation; user warning for external URLs

7. **Database Schema Corruption**
   - **Risk:** AI generates invalid database schemas
   - **Mitigation:** Schema validation before applying; automatic backups before changes; user review required

8. **Planning Accuracy**
   - **Risk:** Agent creates plans that don't achieve user goals
   - **Mitigation:** User approval required; clear plan descriptions; ability to modify plan before execution

---

## Success Metrics

### User Experience Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Task Completion Rate | N/A | >90% | % of user requests fully resolved |
| User Satisfaction | N/A | >4.5/5 | Post-interaction survey |
| Time to Complete Note | N/A | <2 min | For standard note creation requests |
| Multi-Block Creation Success | 0% | >85% | % of successful multi-block creations |

### Technical Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Average Tool Latency | N/A | <2s | p95 latency per tool call |
| Context Window Utilization | ~30% (50K/200K) | ~50% (100K/200K) | Avg tokens used per session |
| Tool Call Success Rate | ~80% | >95% | % of tool calls that don't error |
| Web Search Accuracy | 0% (mock) | >90% | Relevance of search results |

### Business Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Monthly Active Users | N/A | +50% | Growth after AI enhancement |
| Average Session Length | N/A | +30% | Time spent using AI features |
| Cost per User | $0 | <$2 | Monthly AI costs / active users |
| Feature Adoption | N/A | >60% | % users who use AI creation features |

---

## Conclusion

This comprehensive enhancement plan transforms Weave from a basic AI editing tool into a **fully autonomous note-creation agent** on par with modern IDE coding assistants like Cursor and Windsurf.

### Key Transformations

1. **From Single-Block to Multi-Block:** Agent can create and edit ANY block type, not just text
2. **From Offline to Real-Time:** Web search and current date/time access
3. **From Reactive to Proactive:** Planning and reflection capabilities
4. **From Limited to Extended:** 100-200K token context windows
5. **From Simple to Sophisticated:** 15 tools covering all operations

### Implementation Priority

**Must-Have (Phase 1-3):** Real web search, multi-block creation, extended editing
**Should-Have (Phase 4):** Planning and reflection
**Nice-to-Have (Phase 5-6):** Python execution, MCP integration, advanced optimizations

### Expected Outcome

A user can say:
> "Create a comprehensive note about black holes with a study timer, task list for research, and database of famous discoveries"

And the agent will:
1. Search web for latest black hole research
2. Create note with proper title
3. Add heading, detailed text content with citations
4. Generate Pomodoro timer artifact
5. Create task list with research steps
6. Build database of discoveries with dates
7. Arrange everything with optimal layout
8. Present for user review

**All autonomously, in one request, in under 2 minutes.**

---

## Next Steps

1. **Review this document** with team
2. **Prioritize phases** based on resources
3. **Set up development environment** (Brave API key, Claude Sonnet 4.5 access)
4. **Begin Phase 1 implementation**
5. **Create detailed tickets** for each task
6. **Establish testing framework** for AI agent evaluation

---

**Document Version:** 1.0
**Last Updated:** 2025-01-15
**Author:** AI Architecture Research Team
**Status:** Ready for Implementation
