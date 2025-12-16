# Sidebar Design Guide

## Overview

This document provides specifications for designing the sidebar component. Use this to implement and test different design variations.

---

## Current Architecture

### File Location
```
src/components/Sidebar/UnifiedSidebar.tsx
```

### Key Dependencies
- **React** with TypeScript
- **Zustand** for state management (`useProjectStore`, `useNotesStore`, `useUIStore`)
- **lucide-react** for icons
- **Tailwind CSS** for styling

---

## Data Structures

### TreeItemWithChildren
```typescript
interface TreeItemWithChildren {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  type: 'folder' | 'note' | 'pdf' | 'video' | 'audio' | 'markdown' | 'link' | 'image';
  origin: 'user' | 'ai_generated' | 'imported';
  status: 'not_started' | 'in_progress' | 'completed';
  position: number;
  isPinned: boolean;
  noteId?: string;
  filePath?: string;
  children: TreeItemWithChildren[];
  createdAt: string;
  updatedAt: string;
}
```

### Project
```typescript
interface Project {
  id: string;
  name: string;
  icon: string;  // emoji
  type: 'general' | 'course' | 'book' | 'research';
  description?: string;
  progress: number;  // 0-100
  status: 'active' | 'paused' | 'completed' | 'archived';
}
```

---

## Store Actions Available

```typescript
// From useProjectStore
const {
  projects,              // Project[]
  activeProjectId,       // string | null
  setActiveProject,      // (id: string) => void
  buildTree,             // (projectId: string) => TreeItemWithChildren[]
  initializeDefaults,    // () => void
  addTreeItem,           // (input: CreateTreeItemInput) => TreeItem
  expandedIds,           // Set<string>
  toggleExpanded,        // (itemId: string) => void
  setSelectedItem,       // (itemId: string | null) => void
  selectedItemId,        // string | null
} = useProjectStore();

// From useNotesStore
const { setActiveNote } = useNotesStore();

// From useUIStore
const { sidebarCollapsed } = useUIStore();
```

---

## Design Elements to Implement

### 1. Container
- Width: 280px (fixed)
- Height: calc(100vh - 16px)
- Margin: 8px
- Background: #010409 (dark)
- Border-radius: 16px (rounded-2xl)

### 2. Tree Item Row
Each row should have:
- **Expand/Collapse button** (for folders or items with children)
- **Icon** (folder or document)
- **Name** (truncate if too long)
- **Status indicator** (on the right)

### 3. Status Indicators
- **Completed**: Green checkmark in green circle
- **In Progress**: Orange dot (solid)
- **Not Started**: Gray dot (solid)

### 4. Action Buttons
Buttons for creating new content:
- New Folder
- New Note
- Upload files

---

## Sample Data for Testing

The store initializes with this sample data:

```
📘 Deep Learning (35% progress)
├── 📁 Part I: Applied Mathematics
│   ├── 📄 Linear Algebra ✓
│   ├── 📄 Probability & Information Theory 🟠
│   └── 📄 Numerical Computation ⚪
├── 📁 Part II: Deep Networks
└── 📁 Part III: Deep Learning Research
```

---

## Design Variations to Test

### Layout A: Minimal Tree
- Just the file tree
- Action buttons at top
- Upload zone at bottom

### Layout B: Project Header + Tree
- Project icon, name, description at top
- Progress bar
- File tree below
- Action buttons at bottom

### Layout C: Sectioned
- "Pinned" section at top
- "Recent" section
- Full tree below
- Search bar

### Layout D: Tab-based
- Tabs: Files | Outline | Search
- Different content per tab

---

## Color Palette

```css
/* Backgrounds */
--bg-primary: #010409;
--bg-secondary: #0d1117;
--bg-hover: #161b22;
--bg-selected: #1f2937;

/* Text */
--text-primary: #e6edf3;
--text-secondary: #8b949e;
--text-muted: #6e7681;

/* Accents */
--accent-blue: #58a6ff;
--accent-green: #3fb950;
--accent-orange: #d29922;
--accent-red: #f85149;

/* Borders */
--border-default: #30363d;
--border-muted: #21262d;
```

---

## Icon Reference

Using lucide-react icons:
- `ChevronDown`, `ChevronRight` - expand/collapse
- `FolderPlus` - new folder
- `FileText` - new note / document
- `Upload` - upload files
- `Check` - completed status
- `Search` - search bar
- `Star` - pinned items
- `Clock` - recent items

---

## Implementation Template

```tsx
import React, { useEffect } from 'react';
import { /* icons */ } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useNotesStore, useUIStore } from '@/store';
import { TreeItemWithChildren } from '@/types/project';

const UnifiedSidebar: React.FC = () => {
  // 1. Get store data
  const { projects, activeProjectId, buildTree, ... } = useProjectStore();
  const { sidebarCollapsed } = useUIStore();

  // 2. Initialize on mount
  useEffect(() => {
    initializeDefaults();
  }, []);

  // 3. Build tree data
  const tree = activeProject ? buildTree(activeProject.id) : [];

  // 4. Handle collapsed state
  if (sidebarCollapsed) return null;

  // 5. Render your design
  return (
    <nav className="sidebar bg-[#010409] ...">
      {/* Your design here */}
    </nav>
  );
};

export default UnifiedSidebar;
```

---

## Testing Checklist

- [ ] Tree expands/collapses correctly
- [ ] Clicking note opens it in canvas
- [ ] Status indicators show correct states
- [ ] New Folder creates folder
- [ ] New Note creates note
- [ ] Upload zone works (visual only for now)
- [ ] Responsive to content length
- [ ] Scrolls when content overflows

---

## Current Simplified Design

The current implementation has:
1. **Top**: New Folder + New Note buttons
2. **Middle**: Scrollable file tree
3. **Bottom**: Upload drop zone

This is the baseline. Try different arrangements!
