# Phase 0 Day 2: Artifact Structure Deep Analysis

**Date**: 2025-01-15
**Purpose**: Complete understanding of how artifacts work in Weave for AI training
**Status**: Foundation Analysis - No Coding Yet

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Implementation Status](#2-current-implementation-status)
3. [Data Storage Architecture](#3-data-storage-architecture)
4. [Code Structure & Separation](#4-code-structure--separation)
5. [Execution Environment & Security](#5-execution-environment--security)
6. [Editing Capabilities (Current Gap)](#6-editing-capabilities-current-gap)
7. [AI Generation System](#7-ai-generation-system)
8. [Common Artifact Patterns](#8-common-artifact-patterns)
9. [Artifact Lifecycle](#9-artifact-lifecycle)
10. [Constraints & Limitations](#10-constraints--limitations)
11. [AI Training Rules for Artifact Understanding](#11-ai-training-rules-for-artifact-understanding)

---

## 1. Executive Summary

### What Are Artifacts?

Artifacts in Weave are **self-contained interactive HTML/CSS/JavaScript widgets** embedded directly in notes. They allow users to create:
- Timers and countdown clocks
- Calculators and converters
- Data visualizations and charts
- Interactive forms
- Custom animations
- Games and simulations

### Current Implementation State

**CRITICAL FINDING**: The current ArtifactBlock implementation is a **proof-of-concept with hardcoded example**:

- ✅ **Data structure exists**: `html`, `css`, `javascript` fields defined in types
- ✅ **Execution environment works**: Sandboxed iframe renders artifacts
- ✅ **AI generation stub exists**: `generateArtifact()` method in AI service
- ❌ **NOT CONNECTED**: Block doesn't use `block.data` - shows hardcoded neural network
- ❌ **NO EDITOR**: No way to edit artifact code after creation
- ❌ **MOCK AI**: `generateArtifact()` returns placeholder, not real AI-generated code

### Why This Matters for AI Enhancement

To enable AI to truly understand and manipulate artifacts, we need:

1. **Connect data to rendering**: Block must use `block.data.{html,css,javascript}`
2. **Implement code editor**: Allow manual editing (Monaco/CodeMirror integration)
3. **Real AI generation**: Replace mock with actual LLM integration
4. **AI editing capability**: Add `edit_artifact` tool for the AI agent
5. **Template library**: Common patterns AI can learn from

---

## 2. Current Implementation Status

### File: `src/components/Blocks/ArtifactBlock.tsx` (112 lines)

```typescript
import React from 'react';
import type { Block } from '@/types';
import BlockLayoutControls from '@/components/Blocks/BlockLayoutControls';
import ResizableBlock from '@/components/Blocks/ResizableBlock';

interface ArtifactBlockProps {
  block: Block;
}

const ArtifactBlock: React.FC<ArtifactBlockProps> = ({ block }) => {

  // ⚠️ HARDCODED - Not using block.data!
  const iframeSrcDoc = `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    margin: 0;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: Arial, sans-serif;
  }
  .container {
    text-align: center;
    color: white;
  }
  .neural-net {
    margin: 30px 0;
  }
  .layer {
    display: inline-flex;
    flex-direction: column;
    gap: 20px;
    margin: 0 30px;
  }
  .neuron {
    width: 50px;
    height: 50px;
    background: rgba(255, 255, 255, 0.2);
    border: 3px solid white;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.3s;
  }
  .neuron:hover {
    background: rgba(255, 255, 255, 0.4);
    transform: scale(1.2);
  }
</style>
</head>
<body>
  <div class='container'>
    <h2>Neural Network Layers</h2>
    <div class='neural-net'>
      <div class='layer'>
        <div class='neuron'></div>
        <div class='neuron'></div>
        <div class='neuron'></div>
      </div>
      <div class='layer'>
        <div class='neuron'></div>
        <div class='neuron'></div>
      </div>
      <div class='layer'>
        <div class='neuron'></div>
      </div>
    </div>
    <p>Click neurons to activate</p>
  </div>
  <script>
    document.querySelectorAll('.neuron').forEach(neuron => {
      neuron.addEventListener('click', () => {
        neuron.style.background = 'rgba(255, 255, 255, 0.6)';
        setTimeout(() => {
          neuron.style.background = 'rgba(255, 255, 255, 0.2)';
        }, 500);
      });
    });
  </script>
</body>
</html>`;

  return (
    <ResizableBlock block={block}>
      <div className="relative h-full">
        {/* Glassmorphic floating control pill - Hidden until hover */}
        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover/block:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full backdrop-blur-sm bg-white/[0.03] border border-white/20 shadow-xl pointer-events-auto">
            <button className="px-2.5 py-1 text-xs hover:bg-white/20 rounded-full transition-all text-gray-700">
              Edit
            </button>
            <div className="h-4 w-px bg-gray-400 mx-1"></div>
            <BlockLayoutControls block={block} />
          </div>
        </div>

        {/* Artifact Container - Fills full space */}
        <div className="bg-[#0d1117] rounded overflow-hidden border border-[#21262d] h-full w-full">
          <iframe
            className="w-full h-full"
            sandbox="allow-scripts"
            srcDoc={iframeSrcDoc}
          ></iframe>
        </div>
      </div>
    </ResizableBlock>
  );
};

export default ArtifactBlock;
```

### What's Wrong

| Issue | Impact | Fix Required |
|-------|--------|--------------|
| Hardcoded `iframeSrcDoc` | Block ignores `block.data` | Use `block.data.{html,css,javascript}` |
| No editor implementation | Can't edit after creation | Add code editor modal |
| "Edit" button does nothing | Poor UX | Connect to editor modal |
| No runtime error handling | Crashes break entire note | Add error boundary + try/catch |

---

## 3. Data Storage Architecture

### Type Definition (from `src/types/block.ts`)

```typescript
export interface ArtifactBlockData extends BlockLayout {
  type: 'artifact';
  title: string;           // Human-readable title (e.g., "Pomodoro Timer")
  html: string;            // HTML markup (body content)
  css: string;             // CSS styles
  javascript: string;      // JavaScript code
  created_at: string;      // ISO timestamp
  updated_at: string;      // ISO timestamp for edits
}
```

### Database Storage (SQLite via Tauri)

Artifacts are stored in the `blocks` table:

```sql
CREATE TABLE blocks (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    type TEXT NOT NULL,              -- 'artifact'
    position INTEGER NOT NULL,
    data TEXT NOT NULL,              -- JSON string of ArtifactBlockData
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);
```

### Example JSON Storage

```json
{
  "type": "artifact",
  "title": "Pomodoro Timer",
  "html": "<div class='timer'><h1 id='time'>25:00</h1><button id='start'>Start</button></div>",
  "css": "body { background: #1a1a2e; color: white; text-align: center; } .timer { margin-top: 50px; } h1 { font-size: 4em; } button { padding: 15px 30px; font-size: 1.2em; cursor: pointer; }",
  "javascript": "let minutes = 25; let seconds = 0; let interval; document.getElementById('start').onclick = function() { interval = setInterval(function() { if(seconds === 0) { if(minutes === 0) { clearInterval(interval); alert('Time up!'); return; } minutes--; seconds = 59; } else { seconds--; } document.getElementById('time').textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds; }, 1000); };",
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z",
  "width": "full",
  "alignment": "center"
}
```

---

## 4. Code Structure & Separation

### Why Separate HTML/CSS/JavaScript?

1. **AI Generation**: LLMs can generate each part separately (better prompting)
2. **Editing UX**: Users can edit HTML/CSS/JS in separate tabs
3. **Validation**: Can validate each language independently
4. **Debugging**: Easier to identify which part has errors
5. **Templates**: Can reuse CSS across multiple artifacts

### How They Combine

The three fields are assembled into a complete HTML document:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* CSS from block.data.css */
    ${block.data.css}
  </style>
</head>
<body>
  <!-- HTML from block.data.html -->
  ${block.data.html}

  <script>
    // JavaScript from block.data.javascript
    ${block.data.javascript}
  </script>
</body>
</html>
```

### Proper Implementation (SHOULD BE)

```typescript
const ArtifactBlock: React.FC<ArtifactBlockProps> = ({ block }) => {
  const artifactData = block.data as ArtifactBlockData;

  // Build complete HTML document from separate parts
  const iframeSrcDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Base styles for consistency */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
    }

    /* User CSS */
    ${artifactData.css}
  </style>
</head>
<body>
  ${artifactData.html}

  <script>
    try {
      ${artifactData.javascript}
    } catch (error) {
      document.body.innerHTML = '<div style="color: red; padding: 20px;">Error: ' + error.message + '</div>';
    }
  </script>
</body>
</html>`;

  return (
    <ResizableBlock block={block}>
      {/* ... UI with proper error handling ... */}
      <iframe
        className="w-full h-full"
        sandbox="allow-scripts"
        srcDoc={iframeSrcDoc}
        title={artifactData.title}
      />
    </ResizableBlock>
  );
};
```

---

## 5. Execution Environment & Security

### Sandboxed Iframe

Artifacts run in an **isolated iframe** with restricted permissions:

```html
<iframe
  sandbox="allow-scripts"
  srcDoc={/* generated HTML */}
/>
```

### Security Model

| Feature | Status | Security Implication |
|---------|--------|---------------------|
| `sandbox="allow-scripts"` | ✅ Enabled | JavaScript can run |
| `allow-same-origin` | ❌ **NOT** enabled | Cannot access parent window |
| `allow-forms` | ❌ **NOT** enabled | Form submission blocked |
| `allow-popups` | ❌ **NOT** enabled | Cannot open new windows |
| `allow-top-navigation` | ❌ **NOT** enabled | Cannot redirect parent |
| `srcDoc` (not `src`) | ✅ Safe | No external URL loading |

### What Artifacts CAN Do

✅ **Allowed:**
- Manipulate their own DOM
- Use `setTimeout`, `setInterval`
- Create event listeners
- Use Canvas API, SVG
- Local storage within iframe
- Inline styles and classes
- Console logging (visible in dev tools)

❌ **Blocked:**
- Access parent window (`window.parent` blocked)
- Make fetch/XHR requests (CORS + sandbox)
- Access localStorage of parent
- Access user's camera/microphone
- Open popups or new windows
- Submit forms to external URLs
- Navigate parent page

### Comparison with WebBlock

WebBlock uses MORE permissive sandbox:

```html
<iframe
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
  src={externalUrl}
/>
```

**Why the difference?**
- **WebBlock**: Embedding trusted external content (YouTube, Google Docs)
- **ArtifactBlock**: User/AI-generated code - needs stricter isolation

### Content Security Policy (CSP)

**Currently**: No CSP headers detected

**Should add** (for defense in depth):
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               script-src 'unsafe-inline';
               style-src 'unsafe-inline';
               img-src data: blob:;">
```

---

## 6. Editing Capabilities (Current Gap)

### Current State: NO EDITOR

The "Edit" button exists but does nothing:

```tsx
<button className="px-2.5 py-1 text-xs hover:bg-white/20 rounded-full transition-all text-gray-700">
  Edit
</button>
```

### What's Needed

**Option 1: Modal Code Editor (Recommended)**

```tsx
import MonacoEditor from '@monaco-editor/react';

const ArtifactEditor = ({ block, onSave, onClose }) => {
  const [html, setHtml] = useState(block.data.html);
  const [css, setCss] = useState(block.data.css);
  const [javascript, setJavascript] = useState(block.data.javascript);
  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js'>('html');

  return (
    <div className="artifact-editor-modal">
      <div className="tabs">
        <button onClick={() => setActiveTab('html')}>HTML</button>
        <button onClick={() => setActiveTab('css')}>CSS</button>
        <button onClick={() => setActiveTab('js')}>JavaScript</button>
      </div>

      <MonacoEditor
        language={activeTab === 'html' ? 'html' : activeTab === 'css' ? 'css' : 'javascript'}
        value={activeTab === 'html' ? html : activeTab === 'css' ? css : javascript}
        onChange={(value) => {
          if (activeTab === 'html') setHtml(value);
          else if (activeTab === 'css') setCss(value);
          else setJavascript(value);
        }}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on'
        }}
      />

      <div className="preview">
        <iframe srcDoc={buildPreview(html, css, javascript)} />
      </div>

      <button onClick={() => onSave({ html, css, javascript })}>
        Save Changes
      </button>
    </div>
  );
};
```

**Option 2: Inline Split View**

- Left: Code editor
- Right: Live preview
- Similar to CodePen/JSFiddle

### Dependencies Needed

```bash
npm install @monaco-editor/react
# OR
npm install @uiw/react-codemirror
```

---

## 7. AI Generation System

### Current Service: `src/services/ai.ts`

```typescript
interface ArtifactResult {
  title?: string;
  html: string;
  css: string;
  javascript: string;
}

class AIService {
  async generateArtifact(prompt: string): Promise<ArtifactResult> {
    // ⚠️ MOCK IMPLEMENTATION - Replace with real AI
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          title: 'AI Generated Artifact',
          html: `<div style="padding: 20px;">
            <h2>Generated from: "${prompt}"</h2>
            <p>This is a mock AI-generated artifact. Replace with actual AI implementation.</p>
          </div>`,
          css: `body {
            font-family: Arial, sans-serif;
            background: #161b22;
            color: #e6edf3;
            min-height: 100vh;
            padding: 20px;
          }`,
          javascript: `console.log('AI Generated Artifact loaded');`
        });
      }, 1000);
    });
  }
}
```

### How It's Used (Slash Command Flow)

1. User types `/artifact` in note
2. AI Prompt Modal opens
3. User enters: "Create a Pomodoro timer"
4. Modal calls `aiService.generateArtifact(prompt)`
5. Mock returns placeholder code
6. Block is created with returned `{html, css, javascript}`
7. Block renders the artifact

### What Real Implementation Needs

```typescript
async generateArtifact(prompt: string): Promise<ArtifactResult> {
  // Call actual LLM (Claude, GPT-4, Qwen-Coder)
  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4',
      messages: [
        {
          role: 'system',
          content: ARTIFACT_GENERATION_PROMPT // See section 8
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    })
  });

  const result = await response.json();

  // Parse LLM response into {html, css, javascript}
  return parseArtifactFromLLM(result.content);
}
```

---

## 8. Common Artifact Patterns

Based on research documents and typical use cases, here are the most common artifact types AI should understand:

### 8.1 Pomodoro Timer

**User Request**: "Create a Pomodoro timer"

**Expected Output**:
```html
<!-- HTML -->
<div class="pomodoro">
  <h1 id="time">25:00</h1>
  <div class="controls">
    <button id="start">Start</button>
    <button id="pause">Pause</button>
    <button id="reset">Reset</button>
  </div>
</div>
```

```css
/* CSS */
body {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: white;
}
.pomodoro {
  text-align: center;
  background: rgba(255,255,255,0.1);
  padding: 40px;
  border-radius: 20px;
  backdrop-filter: blur(10px);
}
#time {
  font-size: 5em;
  margin: 0;
  font-weight: 300;
}
.controls {
  margin-top: 30px;
  display: flex;
  gap: 15px;
  justify-content: center;
}
button {
  padding: 15px 30px;
  font-size: 1.1em;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  background: white;
  color: #667eea;
  font-weight: 600;
  transition: transform 0.2s;
}
button:hover {
  transform: scale(1.05);
}
```

```javascript
// JavaScript
let minutes = 25;
let seconds = 0;
let interval = null;
let isRunning = false;

const timeDisplay = document.getElementById('time');
const startBtn = document.getElementById('start');
const pauseBtn = document.getElementById('pause');
const resetBtn = document.getElementById('reset');

function updateDisplay() {
  const m = String(minutes).padStart(2, '0');
  const s = String(seconds).padStart(2, '0');
  timeDisplay.textContent = `${m}:${s}`;
}

function tick() {
  if (seconds === 0) {
    if (minutes === 0) {
      clearInterval(interval);
      alert('Pomodoro complete! Take a break.');
      return;
    }
    minutes--;
    seconds = 59;
  } else {
    seconds--;
  }
  updateDisplay();
}

startBtn.addEventListener('click', () => {
  if (!isRunning) {
    interval = setInterval(tick, 1000);
    isRunning = true;
  }
});

pauseBtn.addEventListener('click', () => {
  clearInterval(interval);
  isRunning = false;
});

resetBtn.addEventListener('click', () => {
  clearInterval(interval);
  minutes = 25;
  seconds = 0;
  isRunning = false;
  updateDisplay();
});
```

### 8.2 Calculator

**User Request**: "Create a simple calculator"

**Key Elements**:
- HTML: Number buttons (0-9), operators (+, -, ×, ÷), equals, clear
- CSS: Grid layout for buttons, display screen
- JS: Click handlers, calculation logic, display update

### 8.3 Todo List

**User Request**: "Create a todo list widget"

**Key Elements**:
- HTML: Input field, add button, list container
- CSS: Checkbox styling, strikethrough for completed
- JS: Add/remove items, toggle completion, localStorage

### 8.4 Countdown Timer

**User Request**: "Create a countdown to New Year 2026"

**Key Elements**:
- HTML: Large display for days/hours/mins/secs
- CSS: Animated background, responsive layout
- JS: Date calculation, setInterval update, flip animation

### 8.5 Data Visualization (Chart)

**User Request**: "Create a bar chart showing sales data"

**Key Elements**:
- HTML: SVG container or Canvas element
- CSS: Chart styling, axis labels
- JS: Drawing logic, data binding, animations

### 8.6 Unit Converter

**User Request**: "Create a temperature converter"

**Key Elements**:
- HTML: Input fields for Celsius/Fahrenheit/Kelvin
- CSS: Clean form layout
- JS: Conversion formulas, two-way binding

### 8.7 Interactive Animation

**User Request**: "Create a bouncing ball animation"

**Key Elements**:
- HTML: Canvas element
- CSS: Full viewport canvas
- JS: RequestAnimationFrame loop, physics simulation

### 8.8 Form with Validation

**User Request**: "Create a contact form with validation"

**Key Elements**:
- HTML: Name, email, message inputs
- CSS: Error states, success states
- JS: Regex validation, error messages

---

## 9. Artifact Lifecycle

### Creation Flow

```
User Action → AI Generation → Database Storage → Rendering
```

1. **Trigger**: User types `/artifact` or clicks "+ Artifact" button
2. **Prompt**: Modal opens, user enters description
3. **AI Generation**:
   - Frontend calls `aiService.generateArtifact(prompt)`
   - AI returns `{title, html, css, javascript}`
4. **Block Creation**:
   - Frontend calls Tauri command `createBlock()`
   - Backend inserts into SQLite `blocks` table
   - Returns new block with ID
5. **Store Update**: Zustand store adds block to state
6. **Rendering**:
   - CanvasContent renders ArtifactBlock component
   - Component builds `srcDoc` from data
   - Iframe executes code

### Update Flow (When Editing Works)

```
User Edit → Validation → Database Update → Re-render
```

1. **Trigger**: User clicks "Edit" button
2. **Editor Opens**: Modal with code editor (3 tabs: HTML, CSS, JS)
3. **User Edits**: Changes code, sees live preview
4. **Save**: Clicks "Save Changes"
5. **Validation**:
   - HTML: Check for balanced tags
   - CSS: Parse for syntax errors
   - JS: Optional linting (ESLint)
6. **Update Database**:
   - Call Tauri `updateBlock(block.id, newData)`
   - Update `updated_at` timestamp
7. **Store Update**: Update Zustand state
8. **Re-render**: Component rebuilds iframe with new code

### Deletion Flow

```
User Delete → Confirmation → Database Delete → Store Cleanup
```

1. User clicks drag handle → Delete option
2. Confirmation modal (optional)
3. Call `deleteBlock(block.id)`
4. Remove from Zustand store
5. Component unmounts

---

## 10. Constraints & Limitations

### Technical Constraints

| Constraint | Limit | Reason |
|------------|-------|--------|
| **Code size** | Recommended <50KB per field | Large code slows rendering, database bloat |
| **Execution time** | No hard limit, but use `setTimeout` | Long loops freeze iframe |
| **External resources** | Cannot load (no CDN scripts/images) | Sandbox prevents fetch/XHR |
| **localStorage** | Isolated to iframe | Cannot persist to parent |
| **Console output** | Not visible to user | Only in DevTools |

### Security Constraints

- **No eval()**: Avoid `eval()` or `Function()` constructor (not blocked but dangerous)
- **No inline event handlers**: Prefer `addEventListener` over `onclick="..."`
- **XSS prevention**: Sanitize any user input displayed in artifact
- **CORS**: Cannot make API calls (blocked by sandbox + CORS)

### UX Constraints

- **Responsiveness**: Must work in various block widths (full, half, third, quarter)
- **Dark mode**: Should match Weave's dark theme aesthetics
- **Performance**: Avoid heavy animations if block is small
- **Accessibility**: Should support keyboard navigation

---

## 11. AI Training Rules for Artifact Understanding

When AI is trained to understand and generate artifacts, it must learn:

### Rule 1: Structure Recognition

**AI should identify** artifact structure from code:

```javascript
// Example artifact code (Pomodoro)
const artifactCode = {
  html: '<div class="timer">...</div>',
  css: 'body { ... } .timer { ... }',
  javascript: 'let minutes = 25; ...'
};

// AI should extract:
{
  "type": "timer",
  "subtype": "pomodoro",
  "interactive": true,
  "elements": ["heading", "buttons", "timer_logic"],
  "purpose": "productivity tool for time management",
  "customizable_params": ["duration", "alert_sound"]
}
```

### Rule 2: Intent Understanding

When user says: **"Add a timer to this note"**

AI should understand:
1. **What**: Create an artifact block
2. **Type**: Timer (likely Pomodoro for productivity)
3. **Placement**: Add to current note
4. **Default behavior**: 25-minute countdown, start/pause/reset controls
5. **Styling**: Match note's theme (dark mode, purple accents)

### Rule 3: Code Generation Patterns

**Template Structure**:
```javascript
{
  "html": "Semantic, accessible markup (use <button>, <input>, headings)",
  "css": "Mobile-first, dark theme, Weave color palette (#667eea, #764ba2)",
  "javascript": "Vanilla JS, no dependencies, error handling with try/catch"
}
```

**Best Practices AI Must Follow**:
- ✅ Use modern ES6+ JavaScript
- ✅ Add comments for complex logic
- ✅ Include error handling
- ✅ Make UI responsive (flex/grid)
- ✅ Use semantic HTML
- ❌ Don't use external libraries (no jQuery, React, etc.)
- ❌ Don't use `eval()` or `innerHTML` with user input
- ❌ Don't make network requests

### Rule 4: Editing Intelligence

When user says: **"Fix the timer, it's not counting down"**

AI should:
1. **Read current code**: Use `readBlock(artifactId)` to get `{html, css, javascript}`
2. **Analyze bug**:
   ```javascript
   // Current code (buggy):
   setInterval(tick, 1000);

   // AI identifies: setInterval not stored, can't be paused

   // AI fix:
   interval = setInterval(tick, 1000);
   ```
3. **Generate minimal diff**: Only change the broken part
4. **Preserve user customizations**: Don't overwrite CSS if bug is in JS

### Rule 5: Template Matching

AI should maintain a **mental library** of common patterns:

| User Request | Template to Use | Key Features |
|--------------|-----------------|--------------|
| "timer", "pomodoro", "countdown" | Pomodoro Timer | 25min default, start/pause/reset |
| "calculator" | Simple Calculator | 0-9 buttons, +−×÷, clear, display |
| "todo", "checklist", "tasks" | Todo List | Add items, check off, delete, localStorage |
| "chart", "graph", "visualize data" | Chart.js-like | Canvas/SVG, data input, responsive |
| "converter", "unit conversion" | Unit Converter | Input fields, two-way binding, formulas |
| "clock" | Analog/Digital Clock | Real-time update, timezone support |
| "stopwatch" | Stopwatch | Lap times, reset, millisecond precision |

### Rule 6: Dependency Understanding

AI must understand artifact ↔ database connections:

**Example**: User says "Create a chart showing data from my expenses database"

AI should:
1. **Identify database**: Search note for database blocks, find "Expenses"
2. **Read database schema**: Use `readBlock(databaseId)` to get columns
3. **Extract relevant data**: Parse rows, aggregate by category
4. **Generate chart code**:
   ```javascript
   // JavaScript in artifact
   const expensesData = ${JSON.stringify(aggregatedData)};
   // ... chart drawing logic using expensesData
   ```
5. **Hardcode data for now**: Since artifacts can't dynamically read databases (sandboxed)
6. **Future**: Add tool `linkArtifactToDatabase(artifactId, databaseId, mapping)`

### Rule 7: Error Diagnosis

When artifact doesn't work, AI should:

1. **Read runtime errors** (if exposed): Parse console.error messages
2. **Common issues**:
   - `getElementById` returns null → Element ID mismatch
   - `setInterval is not defined` → Missing variable declaration
   - Nothing renders → HTML structure error
   - Buttons don't work → Event listeners not attached
3. **Fix systematically**:
   ```javascript
   // Before fix:
   document.getElementById('btn').onclick = start;

   // AI diagnosis: 'btn' element might not exist when script runs

   // After fix:
   document.addEventListener('DOMContentLoaded', () => {
     const btn = document.getElementById('btn');
     if (btn) btn.onclick = start;
   });
   ```

### Rule 8: Validation Rules

Before saving artifact code, AI should validate:

**HTML Validation**:
- Balanced tags: `<div>` has closing `</div>`
- No dangerous tags: `<script src="external">`, `<iframe src="evil">`
- Semantic structure: Use `<button>` not `<div onclick>`

**CSS Validation**:
- Syntax: `property: value;` format
- No `@import` (blocks external resources)
- Avoid `!important` (code smell)

**JavaScript Validation**:
- No syntax errors: Can run through simple parser
- No `eval()`, `Function()` constructor
- No infinite loops: `while(true)` without break
- Has error handling: `try/catch` around risky code

### Rule 9: Customization Understanding

When user says: **"Make the timer 30 minutes instead"**

AI should:
1. **Locate parameter**: Find `let minutes = 25` in JavaScript
2. **Change value**: `let minutes = 30`
3. **Update related**: Change display initial value if hardcoded
4. **Preserve rest**: Don't touch CSS, HTML, or other JS logic

### Rule 10: Style Consistency

All AI-generated artifacts should follow **Weave Design System**:

**Colors**:
- Background: `#1a1a2e`, `#16213e`, gradients with `#667eea` and `#764ba2`
- Text: `#e6edf3` (light gray)
- Accents: `#667eea` (purple-blue)
- Buttons: White with purple text, or purple background

**Typography**:
- Font: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Headings: Font-weight 300-600, no bold (700+)
- Body: 14-16px, line-height 1.5

**Spacing**:
- Padding: 20px, 30px, 40px (multiples of 10)
- Margins: 15px, 20px, 30px
- Border-radius: 10px, 15px, 20px (rounded, not sharp)

**Animations**:
- Transitions: 0.2s, 0.3s (fast, not sluggish)
- Hover effects: `transform: scale(1.05)`, `opacity: 0.8`
- Easing: `ease-in-out` or `cubic-bezier`

---

## Summary for AI Training

### Current Artifact System Capabilities

✅ **What Works**:
- Data structure exists and is sound
- Sandboxed execution environment is secure
- Iframe rendering works reliably
- Block layout controls work (resize, align)

❌ **What's Missing**:
- Block doesn't use stored data (hardcoded example)
- No code editor for manual editing
- AI generation is mock/placeholder
- No error boundaries or runtime error handling
- No artifact templates or pattern library
- No connection to databases (artifacts can't read data dynamically)

### Priority Fixes for Phase 1 (AI Database Understanding)

While Phase 1 focuses on databases, artifacts need minimal fixes:

1. **Connect block to data** (1 hour):
   ```typescript
   const iframeSrcDoc = buildArtifactHTML(block.data.html, block.data.css, block.data.javascript);
   ```

2. **Add error boundary** (30 min):
   ```typescript
   <ErrorBoundary>
     <iframe srcDoc={iframeSrcDoc} />
   </ErrorBoundary>
   ```

3. **Document templates** (2 hours):
   - Create `/templates/artifacts/pomodoro.json`
   - Create `/templates/artifacts/calculator.json`
   - Create `/templates/artifacts/todo.json`

### For Phase 2: AI Artifact Understanding (Full Implementation)

Will implement:
- Monaco code editor integration
- Real AI generation (Claude/GPT-4)
- `edit_artifact` tool for AI agent
- Template matching system
- Code validation and sanitization
- Error diagnosis and auto-fix
- Artifact ↔ database linking (read-only for now)

---

**End of Artifact Analysis**

This document provides complete understanding of how artifacts work, their current limitations, and what AI needs to learn to truly understand and manipulate them.

Next: Phase 0 Day 3 - Connection Point Analysis (how databases and artifacts can work together)
