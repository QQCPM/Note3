# UI Components Structure

## Design System

### Colors (GitHub Dark Theme)
```css
--bg-primary: #0d1117;
--bg-secondary: #010409;
--bg-tertiary: #161b22;
--border: #30363d;
--text-primary: #c9d1d9;
--text-secondary: #8b949e;
--text-tertiary: #6e7681;
--accent-blue: #58a6ff;
--accent-purple: #a371f7;
--accent-green: #3fb950;
--accent-red: #f85149;
```

### Typography
- Font: Inter
- Heading 1: 32px, 700 weight
- Heading 2: 24px, 600 weight
- Body: 15px, 400 weight
- Small: 13px, 400 weight
- Tiny: 11px, 400 weight

## Component Hierarchy

```
App
├── NoteTreeSidebar
│   ├── NoteTree
│   │   ├── NoteTreeItem (recursive)
│   │   │   ├── Chevron
│   │   │   ├── Icon
│   │   │   └── Title
│   │   └── ContextMenu
│   └── NewPageButton
│
├── MainCanvas
│   ├── Header
│   │   ├── PageIcon
│   │   ├── PageTitle
│   │   └── CommandHint
│   │
│   └── CanvasContent
│       ├── Block (multiple, draggable)
│       │   ├── BlockHandle
│       │   └── BlockContent
│       │       ├── TextBlock
│       │       │   ├── HeadingBlock (H1, H2)
│       │       │   └── ParagraphBlock
│       │       │
│       │       ├── DatabaseBlock
│       │       │   ├── DatabaseHeader
│       │       │   │   ├── Title
│       │       │   │   ├── ViewSelector
│       │       │   │   └── OptionsButton
│       │       │   └── DatabaseView
│       │       │       ├── TableView
│       │       │       ├── GalleryView
│       │       │       └── CalendarView
│       │       │
│       │       ├── ArtifactBlock
│       │       │   ├── ArtifactHeader
│       │       │   │   ├── Title
│       │       │   │   ├── Badge
│       │       │   │   ├── EditCodeButton
│       │       │   │   └── AskAIButton
│       │       │   └── ArtifactPreview (sandboxed iframe)
│       │       │
│       │       └── TaskBlock
│       │           ├── TaskHeader
│       │           ├── TaskList
│       │           │   └── TaskItem (multiple)
│       │           │       ├── Checkbox
│       │           │       └── Text
│       │           └── AddTaskButton
│       │
│       └── SlashCommandMenu
│           └── SlashMenuItem (multiple)
│
└── AISidebar
    ├── TabNav
    │   ├── AgentTab
    │   ├── MCPTab
    │   └── SkillsTab
    │
    ├── TabContent
    │   ├── AgentTabContent
    │   │   └── ConversationFlow
    │   │       ├── AIMessage (multiple)
    │   │       └── UserMessage (multiple)
    │   │
    │   ├── MCPTabContent
    │   │   ├── SectionCard
    │   │   │   ├── SectionHeader
    │   │   │   └── MCPToolList
    │   │   │       └── MCPToolItem (multiple)
    │   │   │           ├── ToolIcon
    │   │   │           ├── ToolName
    │   │   │           └── ToggleSwitch
    │   │   └── InfoCard
    │   │
    │   └── SkillsTabContent
    │       ├── SectionCard
    │       │   ├── SectionHeader
    │       │   └── SkillPillContainer
    │       │       └── SkillPill (multiple)
    │       │           ├── Checkbox
    │       │           ├── Icon
    │       │           └── Name
    │       └── InfoCard
    │
    └── AIInput
        ├── ContextIndicator
        │   ├── ContextIcon
        │   ├── ContextText
        │   └── ActionButtons
        ├── InputField (textarea)
        └── ActionRow
            ├── ModeSelector
            └── ActionButtons
                ├── LockButton
                ├── SearchButton
                └── SendButton

Modals:
├── AIPromptModal
│   ├── ModalTitle
│   ├── ModalDescription
│   ├── PromptInput (textarea)
│   └── ActionButtons
│       ├── GenerateButton
│       └── CancelButton
│
└── ContextMenu
    └── ContextMenuItem (multiple)
```

## Key Component Specifications

### NoteTreeItem
```typescript
interface NoteTreeItemProps {
  note: Note;
  level: number;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}
```

**Features**:
- Recursive rendering for nested notes
- Expand/collapse with chevron
- Custom icon per note
- Right-click context menu
- Active state highlighting
- Drag-and-drop (future)

### Block System
```typescript
type BlockType = 'text' | 'heading1' | 'heading2' | 'database' | 'artifact' | 'task';

interface Block {
  id: string;
  type: BlockType;
  position: number;
  data: any; // Type-specific data
}

interface BlockProps {
  block: Block;
  onUpdate: (data: any) => void;
  onDelete: () => void;
  onDragStart: () => void;
}
```

**Features**:
- Drag handle (⋮⋮) on hover
- Type-specific rendering
- Inline editing
- Block-level operations (delete, duplicate, convert)

### DatabaseBlock
```typescript
interface DatabaseColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  options?: string[]; // For select type
}

interface DatabaseBlockData {
  columns: DatabaseColumn[];
  rows: DatabaseRow[];
  view: 'table' | 'gallery' | 'calendar';
}

interface DatabaseRow {
  id: string;
  values: Record<string, any>;
}
```

**Views**:
1. **Table View**: Spreadsheet-like with inline editing
2. **Gallery View**: Card-based layout
3. **Calendar View**: Calendar grid with date-based events

### ArtifactBlock
```typescript
interface ArtifactBlockData {
  html: string;
  css: string;
  javascript: string;
  prompt?: string; // Original AI prompt
}
```

**Features**:
- Sandboxed iframe execution
- Code editor modal
- AI regeneration
- Export functionality
- Security: CSP headers, no external requests

### TaskBlock
```typescript
interface Task {
  id: string;
  text: string;
  completed: boolean;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
}

interface TaskBlockData {
  tasks: Task[];
}
```

**Features**:
- Checkbox toggle
- Inline text editing
- Add/remove tasks
- Keyboard shortcuts (Cmd+Enter for new task)

### SlashCommandMenu
```typescript
interface SlashCommand {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  action: () => void;
  requiresAI?: boolean;
}
```

**Commands**:
- `/artifact` - Create interactive code (AI)
- `/database` - Create table (AI)
- `/tasks` - Create task list
- `/heading` - Create heading (H1, H2)
- `/text` - Regular paragraph

### AISidebar Tabs

**Agent Tab**:
- Conversation history
- Streaming responses
- Quick command suggestions
- Context awareness

**MCP Tab**:
- List of available MCP servers
- Enable/disable toggles
- Configuration buttons
- Server status indicators

**Skills Tab**:
- Available skill pills
- Active/inactive state
- Skill descriptions
- Manage skills button

### AIInput
```typescript
interface AIInputProps {
  context: {
    noteId: string;
    noteTitle: string;
  };
  mode: 'agent' | 'code' | 'search';
  onSend: (message: string) => void;
  onModeChange: (mode: string) => void;
}
```

**Features**:
- Context indicator (current note)
- Mode selector (Agent, Code, Search)
- Action buttons (Lock, Search Web, Send)
- Auto-resize textarea
- Keyboard shortcuts (Cmd+Enter to send)

## Styling Guidelines

### Borders
- Main borders: 1px solid #30363d
- Hover borders: 1px solid #58a6ff (20% opacity)
- Active borders: 1px solid #58a6ff

### Border Radius
- Small: 6px (buttons, pills)
- Medium: 8px (cards, blocks)
- Large: 12px (modals, major sections)
- Full: 50% (circles, avatars)

### Shadows
- Small: 0 2px 8px rgba(0, 0, 0, 0.2)
- Medium: 0 8px 24px rgba(0, 0, 0, 0.3)
- Large: 0 20px 60px rgba(0, 0, 0, 0.5)

### Transitions
- Fast: 0.15s (hovers, simple state changes)
- Medium: 0.3s (expansions, mode switches)
- Slow: 0.5s (page transitions, complex animations)

### Spacing
- Tight: 4px
- Small: 8px
- Medium: 12px
- Default: 16px
- Large: 24px
- XLarge: 32px

## Responsive Behavior

### Breakpoints
- Desktop: 1024px+ (default)
- Tablet: 768px-1023px (collapse sidebar)
- Mobile: <768px (stack layout, future)

### Sidebar Behavior
- Desktop: Fixed width (240px left, 480px right)
- Tablet: Collapsible drawers
- Mobile: Full-screen modals

## Accessibility

### Keyboard Navigation
- Tab: Navigate between blocks
- Enter: Edit block
- Cmd+/: Open slash command menu
- Cmd+K: Focus AI input
- Cmd+B: Toggle bold (in text blocks)
- Cmd+I: Toggle italic
- Cmd+Enter: Send AI message
- Esc: Close modals/menus

### ARIA Labels
All interactive elements must have proper ARIA labels:
- Buttons: `aria-label`
- Inputs: `aria-labelledby`
- Menus: `role="menu"`, `aria-expanded`
- Modals: `role="dialog"`, `aria-modal="true"`

### Focus Management
- Visible focus rings
- Trap focus in modals
- Return focus after modal close
- Skip navigation links
