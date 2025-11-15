# Weave AI Systems Architecture - Comprehensive Analysis

## 1. CURRENT AI IMPLEMENTATION

### 1.1 AI Service Architecture
The project uses a **hybrid cloud + local AI architecture** with Tauri (Rust) backend and React frontend.

#### Frontend Service (`src/services/ai.ts` and `src/services/tauriAI.ts`)
- **AIService**: Wrapper around Tauri commands for AI operations
- **TauriAI**: Singleton service for backend AI integration
- Methods:
  - `initialize(config)` - Initialize AI with configuration
  - `generateEmbedding(text)` - Generate single embedding (local)
  - `generateEmbeddingsBatch(texts)` - Batch embeddings (local)
  - `generateArtifact(prompt)` - Generate HTML/CSS/JS artifacts
  - `generateDatabase(prompt)` - Generate database schemas
  - `chat(messages)` - Basic chat without tools
  - `chatWithTools(messages, tools)` - Function calling enabled
  - `rerank(query, documents)` - Rerank search results
  - `readBlock(blockId)` - Read block content
  - `getNoteContext(noteId)` - Get full note with all blocks

#### Configuration System (`src/types/ai.ts`)
```typescript
AIConfig {
  embeddings: LocalModelConfig       // Qwen3-Embedding-0.6B (local)
  reranker?: LocalModelConfig        // Optional: Qwen3-Reranker-8B
  local_code_generation?: LocalModelConfig  // Optional: Qwen3-Coder-30B
  agent: APIModelConfig              // GPT-4o or Claude Sonnet (API)
  api_code_generation?: APIModelConfig      // Fallback code generation
}
```

**Provider Support**:
- Local models: Run via llama.cpp server
- OpenAI: GPT-4o, GPT-4o-mini
- Anthropic: Claude Sonnet 4, Claude Opus

### 1.2 AI Integration Points

#### 1. Embeddings (Vector Search)
- **Model**: Qwen3-Embedding-0.6B (1024-dimensional)
- **Purpose**: Semantic search over notes
- **Usage**: `tauriAI.generateEmbedding(text)` or batch
- **Storage**: Embeddings stored in SQLite with pgvector-like similarity
- **Invocation**:
  - Backend creates embeddings for notes
  - Used for semantic search queries
  - Current: Mock implementation, real backend would integrate pgvector

#### 2. Code Generation (Artifacts)
- **Model**: Qwen3-Coder-30B (local) or GPT-4o (API)
- **Purpose**: Generate interactive HTML/CSS/JS from natural language
- **Integration Point**: `TextBlock` slash command `/artifact`
- **Flow**:
  ```
  User: "/artifact" -> AIPromptModal -> tauriAI.generateArtifact()
  -> Placeholder ArtifactBlock created
  -> AI generates HTML/CSS/JS
  -> Block updated with generated code
  -> Code rendered in sandboxed iframe
  ```
- **Error Handling**: Falls back to error UI if generation fails

#### 3. Database Schema Generation
- **Model**: GPT-4o (API)
- **Purpose**: Create database tables from natural language descriptions
- **Integration Point**: `TextBlock` slash command `/database`
- **Flow**: Similar to artifact generation
- **Output Format**:
  ```typescript
  DatabaseResult {
    title: string
    columns: Array<{name, column_type, options?}>
    rows: any[]
    view: {type: 'table' | 'gallery' | 'calendar'}
  }
  ```

#### 4. Note Editing (Agent Mode)
- **Model**: GPT-4o with function calling
- **Purpose**: AI-powered editing like Cursor IDE
- **Entry Point**: "AI Edit" button on text blocks
- **Architecture**: Multi-turn conversation with tool calling

---

## 2. AGENT SYSTEMS

### 2.1 Agent Implementation (`src/services/aiEditService.ts`)

The main agent system is `streamAIEditChat()` which provides intelligent block editing.

#### Architecture
```
User Input (AIEditPanel)
    ↓
streamAIEditChat()
    ↓
Choose backend:
├─ Real Tauri AI (if initialized)
│  └─ streamWithTauriAI() - Multi-turn loop
└─ Mock (for development)
   └─ streamWithMock() - Simulated responses
    ↓
Conversation History Management
    ↓
Tool Calling Loop (max 5 turns)
    ↓
Process Results (read_block, read_note, edit_block, search_web)
    ↓
Pending Edits (with diff preview)
    ↓
User Accept/Reject
```

#### Tool Definitions (`AI_EDIT_TOOLS`)

**Available Tools** (for function calling):
1. **read_block** - Read single block content by ID
2. **read_note** - Read entire note with all blocks
3. **edit_block** - Propose content changes to a block
4. **search_web** - Search web for current information

#### Agent Flow

```typescript
// System Prompt (dynamic, includes current block context)
const systemPrompt = `You are an AI agent that helps users edit their notes.

CURRENT CONTEXT:
- Current Block ID: ${blockId}
- Current Note ID: ${noteId}
- Current Block Content: [shown above]

Available tools:
- read_block: Read OTHER blocks
- read_note: Read full note context
- edit_block: Propose changes
- search_web: Search for current info

Multi-turn conversation with tools:
1. User sends message
2. AI responds + calls tools
3. Tool results added to conversation
4. AI continues (up to 5 turns)
5. Eventually calls edit_block
```

#### Conversation History Management
- Maintains full conversation for context
- Trims if exceeds 200K characters (~50K tokens)
- System prompt always included
- Keeps recent messages for maximum context

#### Editing Workflow
1. AI calls `edit_block` with new content + reason
2. Creates `PendingEdit` in AI store
3. Shows `DiffPreview` component with diff
4. User can:
   - Accept (Tab) → Applies edit to block + database
   - Reject (Esc) → Discards proposal
5. If more tool calls: Continue conversation
6. If edit_block called: Stop conversation

### 2.2 Agent Tab UI (`src/components/AISidebar/AgentTab.tsx`)

- **Welcome Message**: Guides users on capabilities
- **Quick Commands**: Shows available slash commands
- **Message Display**: Shows conversation history with timestamps
- **Pending Edits**: Displays diff previews with accept/reject buttons
- **Knowledge Search**: Search bar for semantic note search (TODO: implement)

### 2.3 Skill System (Framework for Agent Specialization)

Located in `src/types/skill.ts` and `src/components/AISidebar/SkillsTab.tsx`

```typescript
interface Skill {
  id: string
  name: string
  icon: string
  description: string
  enabled: boolean
  instructions: string  // Added to system prompt
  tools?: string[]      // Required MCP tools
  model?: string        // Preferred model
  priority?: number     // Higher = earlier in prompt
}
```

**Available Skills** (UI exists, backend integration pending):
1. 📝 Note Writer - Structured notes with best practices
2. 💻 Code Generator - Production-ready code
3. 📊 Data Analyzer - SQL queries and insights
4. 🎨 UI Designer - Beautiful, responsive interfaces
5. 🔍 Researcher - Web search and information synthesis
6. 📚 Summarizer - Condensing complex information
7. 🌐 Translator - Multi-language translation
8. 🧮 Math Solver - Step-by-step problem solving
9. ✍️ Editor - Grammar, clarity, and style improvements

**Implementation Status**: UI framework complete, backend integration pending

---

## 3. BLOCK TYPES & ARCHITECTURE

### 3.1 Block Type System (`src/types/block.ts`)

```typescript
type BlockType = 'text' | 'heading1' | 'heading2' | 'database' | 'artifact' | 'task' | 'web'

// All blocks have this structure
interface Block {
  id: string
  note_id: string
  type: BlockType
  position: number
  data: BlockData  // Type-specific data
  created_at: string
  updated_at: string
}
```

### 3.2 Block Types Implementation

#### 1. **TextBlock** (`src/components/Blocks/TextBlock.tsx`)
- **Purpose**: Markdown-style text content
- **Features**:
  - Auto-resizing textarea
  - Slash command menu (`/artifact`, `/database`, `/tasks`, etc.)
  - LaTeX support ($...$, $$...$$)
  - RichTextRenderer for display mode
  - AI Edit button on hover
  - Integration with AIEditPanel
- **Data Structure**:
  ```typescript
  TextBlockData {
    type: 'text'
    content: string
    width?: 'full' | 'half' | 'third' | 'quarter' | number
    alignment?: 'left' | 'center' | 'right'
  }
  ```
- **AI Integration**: Primary target for AI editing

#### 2. **HeadingBlock** (`src/components/Blocks/HeadingBlock.tsx`)
- **Purpose**: H1/H2 section headers
- **Data Structure**:
  ```typescript
  HeadingBlockData {
    type: 'heading1' | 'heading2'
    content: string
    layout?: BlockLayout
  }
  ```

#### 3. **ArtifactBlock** (`src/components/Blocks/ArtifactBlock.tsx`)
- **Purpose**: Live HTML/CSS/JS execution
- **Features**:
  - Sandboxed iframe rendering
  - Code editor for manual editing
  - Resize handles for custom dimensions
  - Responsive CSS support
  - Error handling with try-catch
- **Data Structure**:
  ```typescript
  ArtifactBlockData {
    type: 'artifact'
    title: string
    html: string
    css: string
    javascript: string
    prompt?: string  // Original AI prompt
    customWidth?: number
    customHeight?: number
  }
  ```
- **Sandbox Security**:
  - Content-Security-Policy in iframe
  - No external script loading
  - Try-catch wrapper around user JS
  - No access to parent document

#### 4. **DatabaseBlock** (`src/components/Blocks/DatabaseBlock.tsx`)
- **Purpose**: Structured data tables with multiple views
- **Features**:
  - Table View: Sortable columns, drag-to-reorder
  - Gallery View: Card-based display
  - Calendar View: Calendar grid display
  - Column Types: text, number, date, select, checkbox
  - Cell Editors: Type-specific input components
  - Data Persistence: Auto-saves to Tauri
- **Data Structure**:
  ```typescript
  DatabaseBlockData {
    type: 'database'
    title: string
    columns: DatabaseColumn[]
    rows: DatabaseRowData[]
    view: 'table' | 'gallery' | 'calendar'
  }
  ```
- **Cell Editor Components** (`src/components/Blocks/Database/CellEditors.tsx`):
  - TextCellEditor
  - NumberCellEditor
  - DateCellEditor
  - SelectCellEditor
  - CheckboxCellEditor
- **AI Integration**: Generated via `/database` command using `tauriAI.generateDatabase()`

#### 5. **TaskBlock** (`src/components/Blocks/TaskBlock.tsx`)
- **Purpose**: Checklist with priorities and due dates
- **Data Structure**:
  ```typescript
  TaskBlockData {
    type: 'task'
    title: string
    tasks: Task[]
  }
  
  Task {
    id: string
    text: string
    completed: boolean
    priority?: 'low' | 'medium' | 'high'
    due_date?: string
  }
  ```
- **Status**: Basic implementation, full CRUD pending

#### 6. **WebBlock** (`src/components/Blocks/WebBlock.tsx`)
- **Purpose**: Embedded web content (YouTube, websites)
- **Features**:
  - YouTube embed detection and conversion
  - Iframe embedding with error handling
  - Refresh controls
  - Fullscreen support
  - Loading states
  - X-Frame-Options error handling
- **Data Structure**:
  ```typescript
  WebBlockData {
    type: 'web'
    url: string
    title?: string
    customWidth?: number
    customHeight?: number
    prompt?: string  // Original prompt if AI-generated
  }
  ```

### 3.3 Block Layout System
All blocks support layout controls:
```typescript
interface BlockLayout {
  width?: 'full' | 'half' | 'third' | 'quarter' | number  // percentage
  alignment?: 'left' | 'center' | 'right'
}
```

**Component**: `BlockLayoutControls.tsx` - UI for setting layout
**Component**: `ResizableBlock.tsx` - Resize handles with drag support

---

## 4. AI INTERACTION WITH BLOCKS

### 4.1 Block Creation Flow via AI

#### From Text Block Slash Commands
```
User types "/" in TextBlock
    ↓
SlashCommandMenu appears with options:
├─ /heading1, /heading2 - Direct block creation
├─ /text - Direct block creation
├─ /tasks - Direct block creation
├─ /artifact - Opens AIPromptModal
├─ /database - Opens AIPromptModal
└─ /web - Opens AIPromptModal for URL
    ↓
For AI commands (/artifact, /database, /web):
AIPromptModal shown
    ↓
User enters prompt
    ↓
handleAIGenerate() called:

If artifact:
  1. Create placeholder block
  2. Call tauriAI.generateArtifact(prompt)
  3. Update block with generated code
  4. Display in iframe
  
If database:
  1. Create placeholder block
  2. Call tauriAI.generateDatabase(prompt)
  3. Convert schema to block format
  4. Display table view
  
If web:
  1. Get URL from prompt
  2. Create WebBlock directly
  3. Iframe loads URL
```

### 4.2 Block Editing via AI Agent

#### AIEditPanel Flow
```
User clicks "AI Edit" button on text block
    ↓
AIEditPanel modal opens
    ↓
User types request (e.g., "Tell me about black holes")
    ↓
handleSubmit() → streamAIEditChat()
    ↓
System Prompt created:
  - Current block ID & content
  - Available tools
  - Tool descriptions
    ↓
Conversation started with AI:
  
Turn 1:
  AI: Thinks about user request
  AI: Calls search_web tool if needed
  Conversation continues
  
Turn 2-5:
  AI: Uses read_block/read_note for context
  AI: Processes tool results
  AI: Eventually calls edit_block
    ↓
When edit_block called:
  1. PendingEdit created in AI store
  2. DiffPreview shown to user
  3. Conversation may continue OR ends
    ↓
User:
  - Presses Tab or Accept button → applyEdit()
    - Block content updated in store
    - Block persisted to database via Tauri
    - PendingEdit marked as accepted
  
  - Presses Esc or Reject button → rejectEdit()
    - PendingEdit marked as rejected
    - Block unchanged
```

### 4.3 Block Data Persistence

#### Tauri Commands (Backend)
```typescript
await updateBlock(blockId, blockData)  // Updates in SQLite
```

#### Frontend Store Updates
```typescript
useBlocksStore.updateBlock(blockId, {data: newData})
```

#### State Management
```typescript
// blocksStore (Zustand)
- blocks: Block[]
- updateBlock(blockId, updates)
- deleteBlock(blockId)
- getBlocksByNoteId(noteId)

// aiStore (Zustand)
- pendingEdits: PendingEdit[]
- addPendingEdit(edit)
- acceptEdit(editId)
- rejectEdit(editId)
```

---

## 5. TOOL/FUNCTION CALLING IMPLEMENTATION

### 5.1 Tool Definition Format

```typescript
interface Tool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: {
        [paramName]: {
          type: string
          description: string
          required?: boolean
        }
      }
      required: string[]
    }
  }
}
```

### 5.2 Available Tools for AI Agent (`AI_EDIT_TOOLS`)

#### 1. read_block
```typescript
{
  name: 'read_block',
  description: 'Read the content of ANY block by its ID',
  parameters: {
    block_id: {type: 'string', description: 'The ID of the block to read'}
  }
}
```

**Implementation**:
```typescript
if (functionName === 'read_block') {
  const blockContent = await tauriAI.readBlock(parsedArgs.block_id)
  conversationHistory.push({
    role: 'user',
    content: `[Block ${blockId} content]:\n${blockContent}`
  })
}
```

#### 2. read_note
```typescript
{
  name: 'read_note',
  description: 'Read the ENTIRE note with ALL blocks',
  parameters: {
    note_id: {type: 'string', description: 'The ID of the note to read'}
  }
}
```

**Implementation**:
```typescript
if (functionName === 'read_note') {
  const noteContent = await tauriAI.getNoteContext(parsedArgs.note_id)
  conversationHistory.push({
    role: 'user',
    content: `[Full note content]:\n${noteContent}`
  })
}
```

#### 3. edit_block
```typescript
{
  name: 'edit_block',
  description: 'Edit the content of a text block on the canvas',
  parameters: {
    block_id: {type: 'string', description: 'The ID of the block to edit'},
    new_content: {type: 'string', description: 'The new content for the block'},
    reason: {type: 'string', description: 'Brief explanation of changes'}
  }
}
```

**Implementation**:
```typescript
if (functionName === 'edit_block') {
  const block = blocksStore.blocks.find(b => b.id === blockId)
  aiStore.addPendingEdit({
    blockId,
    originalContent: (block.data as any).content || '',
    proposedContent: parsedArgs.new_content,
    reason: parsedArgs.reason
  })
}
```

#### 4. search_web
```typescript
{
  name: 'search_web',
  description: 'Search the web for current information',
  parameters: {
    query: {type: 'string', description: 'The search query'}
  }
}
```

**Implementation**:
```typescript
if (functionName === 'search_web') {
  const results = await searchWeb(parsedArgs.query)
  const searchSummary = results.slice(0, 3).map(r => 
    `- ${r.title}: ${r.snippet}`
  ).join('\n')
  conversationHistory.push({
    role: 'user',
    content: `[Search results]:\n${searchSummary}`
  })
}
```

### 5.3 Tool Result Processing

Multi-turn conversation handling:
```typescript
let shouldContinue = false

for (const toolCall of result.tool_calls) {
  // Extract function name and arguments
  // Execute tool
  // Add result to conversation
  
  if (toolCall affects_context) {
    shouldContinue = true  // Continue conversation
  }
}

if (shouldContinue) {
  // Loop back to next turn
} else if (edit_block_was_called) {
  break  // Conversation complete
}
```

### 5.4 Tool Call Response Format (OpenAI-compatible)

```typescript
interface ChatWithToolsResponse {
  content: string  // Assistant's text response
  tool_calls: Array<{
    id: string
    name: string
    arguments: any  // Can be JSON string or object
  }>
}
```

**Argument Parsing**:
```typescript
const functionArgs = (toolCall as any).function?.arguments || toolCall.arguments

const parsedArgs = typeof functionArgs === 'string'
  ? JSON.parse(functionArgs)
  : functionArgs
```

---

## 6. HYBRID AI ARCHITECTURE

### 6.1 Multi-Model Strategy

The system uses different models for different tasks:

```
┌─────────────────────────────────────────────────────┐
│                  WEAVE AI HYBRID                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  LOCAL MODELS (Privacy, Speed, Free)                │
│  ├─ Embeddings: Qwen3-Embedding-0.6B                │
│  │  (1024-dim, semantic search)                     │
│  ├─ Reranking: Qwen3-Reranker-8B (optional)         │
│  │  (Improve search relevance)                      │
│  └─ Code Gen: Qwen3-Coder-30B (optional)            │
│     (Local HTML/CSS/JS generation)                  │
│                                                      │
│  CLOUD API (Powerful, Tool Support, Reasoning)      │
│  ├─ Chat Agent: GPT-4o or Claude Sonnet 4           │
│  │  (Multi-turn, function calling, reasoning)       │
│  ├─ Code Gen: GPT-4o (fallback)                     │
│  │  (If local code gen unavailable)                 │
│  └─ Database Gen: GPT-4o                            │
│     (Schema generation from natural language)       │
│                                                      │
│  EXTERNAL SERVICES                                  │
│  └─ Web Search: Brave Search API (or mock)          │
│     (Current information, web research)             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 6.2 Configuration Options

**Default Setup** (Most Common):
```typescript
{
  embeddings: {
    provider: 'local',
    model: 'qwen3-embedding-0.6b',
    endpoint: 'http://localhost:8081',
    dimension: 1024
  },
  agent: {
    provider: 'openai',
    model: 'gpt-4o',
    api_key: 'sk-...',
    temperature: 0.7,
    max_tokens: 4096
  }
}
```

**Mac M2 Ultra Setup** (Powerful Local):
```typescript
{
  embeddings: {model: 'qwen3-embedding-8b', dimension: 8192},
  reranker: {model: 'qwen3-reranker-8b'},
  local_code_generation: {model: 'qwen3-coder-30b'},
  agent: {model: 'gpt-4o', api_key: 'sk-...'}
}
```

**API-Only Setup** (No Local Models):
```typescript
{
  embeddings: {
    provider: 'openai',
    model: 'text-embedding-3-large',
    api_key: 'sk-...',
    dimension: 3072
  },
  agent: {model: 'gpt-4o', api_key: 'sk-...'}
}
```

### 6.3 Model Selection Logic

#### For Embeddings
```typescript
if (config.embeddings.provider === 'local') {
  // POST to http://localhost:8081/v1/embeddings
  // Fast, private, always available
} else if (config.embeddings.provider === 'openai') {
  // Call OpenAI API
  // Requires internet, has cost
}
```

#### For Code Generation (Artifacts)
```typescript
if (config.local_code_generation) {
  // Use local Qwen3-Coder-30B first
  // Endpoint: http://localhost:8080
} else {
  // Fall back to agent API (GPT-4o)
  // Endpoint: OpenAI API
}
```

#### For Agent (Chat, Function Calling)
```typescript
// Always use cloud API for agent
// (Local DeepSeek/Llama support coming)
if (config.agent.provider === 'openai') {
  // Use GPT-4o with function calling
} else if (config.agent.provider === 'anthropic') {
  // Use Claude Sonnet 4 with tool_use
}
```

### 6.4 Fallback Strategy

**Graceful Degradation**:
```typescript
async function generateArtifact(prompt: string) {
  try {
    // Try local model first (if configured)
    if (config.local_code_generation) {
      return await callLocalCodeGen(prompt)
    }
  } catch (error) {
    console.warn('Local code generation failed, using API')
  }
  
  try {
    // Fall back to API
    return await callOpenAICodeGen(prompt)
  } catch (error) {
    console.error('All code generation failed')
    throw error
  }
}
```

### 6.5 Health Check System

```typescript
async healthCheck(): Promise<HealthStatus> {
  return {
    embedding_service: await checkEmbeddingEndpoint(),
    reranker_service: await checkRerankerEndpoint(),
    local_code_service: await checkLocalCodeService(),
    agent_service: await checkAPIConnection(),
    api_code_service: await checkAPIConnection()
  }
}
```

### 6.6 Performance Characteristics

| Component | Model | Speed | Accuracy | Cost |
|-----------|-------|-------|----------|------|
| Embeddings | Qwen3-0.6B | ~50ms | High | Free |
| Reranking | Qwen3-8B | ~100ms | Very High | Free |
| Code Gen (Local) | Qwen3-30B | ~2-5s | High | Free |
| Code Gen (API) | GPT-4o | ~2-3s | Very High | ~$0.01/req |
| Chat Agent | GPT-4o | ~1-3s | Excellent | ~$0.005/req |
| Web Search | Brave API | ~500ms | Recent | $5-20/mo |

---

## 7. CURRENT CAPABILITIES

### 7.1 Implemented Features

- ✅ Block-based note editor (text, heading, artifact, database, task, web)
- ✅ LaTeX rendering (inline $...$ and display $$...$$)
- ✅ AI artifact generation (HTML/CSS/JS)
- ✅ AI database schema generation
- ✅ AI-powered note editing with diff preview
- ✅ Multi-turn conversations with tool calling
- ✅ Function calling support (4 tools: read_block, read_note, edit_block, search_web)
- ✅ Web search integration (mock implementation)
- ✅ Hybrid AI configuration (local + cloud)
- ✅ Block-level layout controls (width, alignment)
- ✅ Resizable blocks (artifacts, web)
- ✅ Multiple database views (table, gallery, calendar)
- ✅ Keyboard shortcuts for diff preview (Tab=accept, Esc=reject)
- ✅ Pending edits with acceptance workflow

### 7.2 In Progress / TODO

- 🔄 Semantic search (embeddings generated, search UI pending)
- 🔄 Skills system (UI complete, backend integration pending)
- 🔄 MCP system (architecture designed, implementation pending)
- 🔄 Task block full CRUD
- 🔄 Settings panel for AI configuration
- 🔄 Real web search (Brave API integration)
- 🔄 Local-only mode (full local model stack)

### 7.3 Future Enhancements

- Real-time collaboration
- Cloud sync
- Custom AI models
- Advanced RAG system
- Code execution in artifacts
- Full MCP ecosystem integration

---

## 8. EXTENSION POINTS FOR FULL EDITING

To extend AI to have full editing capabilities (across all block types, not just text):

### 8.1 Enhanced Tool Set

Add new tools to `AI_EDIT_TOOLS`:
```typescript
{
  name: 'edit_artifact',
  description: 'Edit artifact HTML/CSS/JavaScript',
  parameters: {
    block_id: string,
    html?: string,
    css?: string,
    javascript?: string,
    reason: string
  }
},
{
  name: 'edit_database',
  description: 'Edit database columns/rows',
  parameters: {
    block_id: string,
    action: 'add_row' | 'delete_row' | 'add_column' | 'delete_column' | 'update_cell',
    data: any,
    reason: string
  }
},
{
  name: 'edit_task',
  description: 'Edit task list items',
  parameters: {
    block_id: string,
    action: 'add_task' | 'complete_task' | 'remove_task',
    data: any
  }
}
```

### 8.2 Extended Tool Handling

Update `streamWithTauriAI()` to handle new edit types:
```typescript
else if (functionName === 'edit_artifact') {
  // Handle artifact editing
  aiStore.addPendingEdit({...})
}
else if (functionName === 'edit_database') {
  // Handle database editing
  aiStore.addPendingEdit({...})
}
```

### 8.3 Block-Specific Editors

Create corresponding edit handlers and diff viewers for each block type.

---

## SUMMARY

The Weave AI system is a sophisticated **hybrid architecture** that:

1. **Combines Cloud + Local AI** for optimal cost/performance/privacy tradeoff
2. **Implements Multi-Tool Agent System** with intelligent tool use and multi-turn conversations
3. **Provides Block-Based Editing** with AI assistance at the block level
4. **Uses Tauri for Performance** - native desktop app with Rust backend
5. **Enables Extensibility** - MCP and Skills systems for future AI capabilities

The current implementation focuses on **text block editing** but has the foundation to extend to all block types with additional tools and UI components.
