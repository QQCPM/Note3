# AI Edit Mode - IDE-Style Canvas Editing

## Overview

The AI Edit Mode brings IDE-style AI assistance directly to your canvas, inspired by **Cursor IDE** and **GitHub Copilot**. Ask AI to research topics, generate content, and see proposed changes as interactive diffs that you can accept or reject.

## Features

### ✨ Smart AI Editing
- **Research & Write**: Ask AI about any topic and it searches the web and generates comprehensive content
- **Direct Edits**: AI proposes changes directly to your blocks
- **Streaming Responses**: See AI's thinking process in real-time
- **Web Search Integration**: AI can search the web for current information

### 🎨 IDE-Style Diff Preview
- **Visual Diffs**: See proposed changes in familiar red/green format (like Git diffs)
- **Accept/Reject Controls**: Review each change before applying
- **Keyboard Shortcuts**: Tab to accept, Alt+Delete to reject
- **Multiple Edits**: Handle multiple proposed changes in sequence

### 🔧 Function Calling
- **edit_block**: AI can modify block content
- **search_web**: AI can search for information
- **insert_content**: AI can add new blocks

---

## How to Use

### 1. Activate AI Edit Mode

Hover over any text block and click the **"✨ AI Edit"** button that appears in the top-right corner.

### 2. Ask AI to Edit

Type your request in the AI Edit Panel. Examples:

```
"Tell me about black holes"
"Write a summary of quantum physics"
"Add information about machine learning"
"Explain the theory of relativity"
```

### 3. Review Proposed Changes

AI will:
1. Search the web if needed
2. Generate comprehensive content
3. Show you a **diff preview** of proposed changes

The diff shows:
- 🔴 **Red lines** = Content to be removed
- 🟢 **Green lines** = Content to be added
- **Gray lines** = Unchanged content

### 4. Accept or Reject

**Keyboard Shortcuts:**
- `Tab` = Accept changes
- `Alt+Delete` = Reject changes
- `Esc` = Reject changes

**Mouse:**
- Click "Accept" button (green)
- Click "Reject" button (red)

---

## User Flow Example

```
┌─────────────────────────────────────┐
│  TextBlock                          │
│  [Hover to see "✨ AI Edit" button]│
│                                     │
│  Current content...                 │
└─────────────────────────────────────┘

↓ Click "✨ AI Edit"

┌─────────────────────────────────────┐
│  🤖 AI Editor                    [×]│
├─────────────────────────────────────┤
│  Input: Tell me about black holes   │
│                                     │
│  🤖 AI: Searching web...            │
│  🤖 AI: Found 5 sources             │
│  🤖 AI: Generating content...       │
│                                     │
│  📝 Proposed Changes:               │
│  ┌───────────────────────────────┐ │
│  │ - Old content                 │ │
│  │ + # Black Holes               │ │
│  │ + Based on latest research... │ │
│  │ + ## NASA Science             │ │
│  │ + Black holes are...          │ │
│  └───────────────────────────────┘ │
│                                     │
│  [✓ Accept (Tab)]  [✗ Reject]      │
└─────────────────────────────────────┘

↓ Press Tab to Accept

┌─────────────────────────────────────┐
│  TextBlock                          │
│                                     │
│  # Black Holes                      │
│  Based on latest research...        │
│  ## NASA Science                    │
│  Black holes are...                 │
│                                     │
└─────────────────────────────────────┘
```

---

## Architecture

### Components

#### 1. **AIEditPanel** (`src/components/AI/AIEditPanel.tsx`)
- Main AI editing interface
- Streaming chat UI
- Displays conversation and pending edits

#### 2. **DiffPreview** (`src/components/AI/DiffPreview.tsx`)
- IDE-style diff viewer
- Shows red/green line-by-line changes
- Accept/reject controls
- Keyboard shortcut support

#### 3. **AI Edit Service** (`src/services/aiEditService.ts`)
- Streaming chat with function calling
- Tool definitions for AI
- Edit application logic
- Web search integration

#### 4. **Web Search Service** (`src/services/webSearch.ts`)
- Mock web search (ready for real API)
- Supports Brave Search, Google, etc.
- Formats results for AI consumption

#### 5. **AI Store** (`src/store/aiStore.ts`)
- Manages conversation state
- Tracks pending edits
- Edit mode state management

---

## Technical Details

### AI Tools (Function Calling)

The AI has access to these tools:

```typescript
{
  name: 'edit_block',
  description: 'Edit content of a text block',
  parameters: {
    block_id: string,
    new_content: string,
    reason: string
  }
}

{
  name: 'search_web',
  description: 'Search the web for information',
  parameters: {
    query: string
  }
}

{
  name: 'insert_content',
  description: 'Insert new content after block',
  parameters: {
    after_block_id: string,
    content: string
  }
}
```

### Diff Algorithm

Uses the `diff` library to compute line-by-line differences:

```typescript
import { diffLines } from 'diff';

const changes = diffLines(originalContent, proposedContent);
// Returns array of Change objects with:
// - added: boolean
// - removed: boolean
// - value: string
// - count: number
```

### State Management

```typescript
interface PendingEdit {
  id: string;
  blockId: string;
  originalContent: string;
  proposedContent: string;
  reason: string;
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected';
}
```

---

## Web Search Integration

### Current: Mock Implementation

```typescript
// Mock search returns realistic results
const results = await searchWeb('black holes');
// Returns: SearchResult[]
```

### Future: Real API Integration

Ready to integrate with:

**1. Brave Search API** (Recommended)
```typescript
VITE_BRAVE_SEARCH_API_KEY=your-api-key
```

**2. Google Custom Search**
```typescript
VITE_GOOGLE_SEARCH_API_KEY=your-api-key
VITE_GOOGLE_SEARCH_ENGINE_ID=your-engine-id
```

**3. Bing Search API**
```typescript
VITE_BING_SEARCH_API_KEY=your-api-key
```

Uncomment and configure in `src/services/webSearch.ts`.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Hover` | Show AI Edit button |
| `Click AI Edit` | Open AI Edit Panel |
| `Tab` | Accept proposed changes |
| `Alt+Delete` | Reject proposed changes |
| `Esc` | Close AI Edit Panel or reject changes |

---

## Comparison with IDEs

### Similar to Cursor IDE
- ✅ Diff-based approval workflow
- ✅ Streaming AI responses
- ✅ Accept/reject controls
- ✅ Function calling for actions

### Similar to GitHub Copilot
- ✅ Inline edit proposals
- ✅ Tab to accept
- ✅ Alt+Delete to reject
- ✅ AI-powered content generation

### Unique to Weave
- 🎯 Canvas-based editing (not file-based)
- 🎯 Web search integration for research
- 🎯 Note-focused AI assistance
- 🎯 Block-level granularity

---

## Future Enhancements

### Planned Features
- [ ] **Real OpenAI API integration** with streaming
- [ ] **Multi-block edits** - Edit multiple blocks at once
- [ ] **Edit history** - Undo/redo AI edits
- [ ] **AI suggestions** - Proactive improvement suggestions
- [ ] **Custom prompts** - Save and reuse common prompts
- [ ] **Collaborative editing** - See AI edits from team members
- [ ] **Voice input** - Ask AI via voice commands
- [ ] **Real web search API** - Brave Search or Google
- [ ] **Contextual editing** - AI understands full note context
- [ ] **Smart formatting** - Auto-format AI-generated content

### Potential Integrations
- [ ] **MCP Tools** - Model Context Protocol for extended capabilities
- [ ] **Skills System** - Teach AI custom workflows
- [ ] **RAG** - Retrieve relevant content from all notes
- [ ] **Code execution** - Run code in AI responses
- [ ] **LaTeX rendering** - Math formulas in AI responses

---

## Troubleshooting

### AI Edit button doesn't appear
- Make sure you're hovering over a text block
- Check that the block is not in edit mode
- Try refreshing the page

### Diff preview is empty
- Check browser console for errors
- Verify the AI service is running
- Ensure there are actual content differences

### Keyboard shortcuts don't work
- Make sure the AI Edit Panel has focus
- Check that no other modal is open
- Try clicking inside the diff preview area

### Web search returns no results
- This is expected with mock implementation
- Results are context-aware (try "black holes" or "quantum physics")
- Real API integration coming soon

---

## Development

### Adding New AI Tools

```typescript
// In src/services/aiEditService.ts
export const AI_EDIT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'your_tool_name',
      description: 'What your tool does',
      parameters: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: 'Parameter description',
          },
        },
        required: ['param1'],
      },
    },
  },
];
```

### Customizing Diff Display

```typescript
// In src/components/AI/DiffPreview.tsx
// Modify colors, layout, or behavior
className={`diff-line flex ${
  part.added
    ? 'bg-green-500/10 text-green-300'  // Customize
    : part.removed
    ? 'bg-red-500/10 text-red-300'      // Customize
    : 'text-gray-400'
}`}
```

---

## Credits

Inspired by:
- **Cursor IDE** - Diff-based editing workflow
- **GitHub Copilot** - Inline code suggestions
- **Claude Code** - Agent-based assistance

Built with:
- React + TypeScript
- Zustand (state management)
- `diff` library (diff algorithm)
- Tauri (desktop app framework)

---

## License

Part of the Weave project - AI-native note-taking platform.
