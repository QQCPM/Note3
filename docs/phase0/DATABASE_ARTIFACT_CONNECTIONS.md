# Phase 0 Day 3: Database-Artifact Connection Point Analysis

**Date**: 2025-01-15
**Purpose**: Understand how databases and artifacts can/should interact for AI orchestration
**Status**: Foundation Analysis - No Coding Yet

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State: Zero Connection](#2-current-state-zero-connection)
3. [Technical Barriers](#3-technical-barriers)
4. [Use Case Patterns](#4-use-case-patterns)
5. [Proposed Connection Architecture](#5-proposed-connection-architecture)
6. [Data Flow Patterns](#6-data-flow-patterns)
7. [AI Orchestration Workflow](#7-ai-orchestration-workflow)
8. [Implementation Approaches](#8-implementation-approaches)
9. [Security & Safety Considerations](#9-security--safety-considerations)
10. [Phase Roadmap](#10-phase-roadmap)

---

## 1. Executive Summary

### The Core Question

**Can artifacts read from databases?**

**Current Answer**: ❌ **NO** - Artifacts are sandboxed iframes with no access to other blocks

**Should They?**

✅ **YES** - This is essential for:
- Data visualizations (charts, graphs)
- Progress dashboards
- Live statistics displays
- Interactive reports
- Task analytics

### The Core Problem

Databases and artifacts exist in **isolated silos**:

```
┌─────────────────────┐
│   DatabaseBlock     │
│   (SQL data store)  │
│                     │
│  ┌───┬───┬───┐     │
│  │ A │ B │ C │     │
│  ├───┼───┼───┤     │
│  │ 1 │ 2 │ 3 │     │
│  └───┴───┴───┘     │
└─────────────────────┘
         ↕ NO CONNECTION
┌─────────────────────┐
│   ArtifactBlock     │
│  (Sandboxed iframe) │
│                     │
│  <html> chart?      │
│  Where's the data?  │
│                     │
└─────────────────────┘
```

### The Solution

**AI acts as the bridge** between databases and artifacts:

```
User: "Create a chart showing my expense data"

AI Workflow:
1. Find database block (search for "expense" database)
2. Read database using exportForAI() → {schema, data, statistics}
3. Generate artifact with EMBEDDED data as JSON
4. Create artifact block with chart code + hardcoded data
5. Result: Working chart that displays the data

Future: Database updates trigger artifact re-render (Phase 4+)
```

---

## 2. Current State: Zero Connection

### What Exists Today

✅ **DatabaseBlock**:
- Stores structured data (columns + rows)
- Has `exportForAI()` utility to convert to AI-readable format
- Can be read via `getBlocksByNote(noteId)` Tauri command

✅ **ArtifactBlock**:
- Executes HTML/CSS/JavaScript in sandboxed iframe
- Can display charts/visualizations IF data is hardcoded in JavaScript
- Cannot access parent window or other blocks

❌ **No Bridge**:
- No API for artifacts to read database data
- No event system for database → artifact communication
- No shared state between blocks

### Evidence: Current Tauri Commands

```typescript
// src/utils/tauri.ts
export const getBlocksByNote = async (noteId: string): Promise<Block[]> => {
  const tauriBlocks = await invoke<TauriBlock[]>('get_blocks_by_note', { noteId });
  return tauriBlocks.map(parseBlock);
};

export const updateBlock = async (blockId: string, data: BlockData): Promise<Block> => {
  const dataString = serializeBlockData(data);
  const tauriBlock = await invoke<TauriBlock>('update_block', { blockId, data: dataString });
  return parseBlock(tauriBlock);
};
```

**Key Observation**: These commands are available to the **frontend app**, but **NOT to sandboxed iframes**.

### Why Zero Connection?

**By design**: Sandboxed iframes provide security isolation:

```html
<iframe
  sandbox="allow-scripts"
  srcDoc={artifactHTML}
></iframe>
```

**Blocked capabilities**:
- ❌ Cannot call `window.parent` (no same-origin)
- ❌ Cannot make fetch/XHR requests (CORS + sandbox)
- ❌ Cannot access Tauri commands (not exposed to iframe)
- ❌ Cannot read from parent DOM (security violation)

**This is GOOD for security** but means artifacts can't be dynamic.

---

## 3. Technical Barriers

### Barrier 1: Sandbox Isolation

**Problem**: Artifacts run in sandboxed iframes that cannot communicate with parent

**Technical Details**:
```html
<!-- Current implementation -->
<iframe
  sandbox="allow-scripts"  <!-- ONLY allows scripts, nothing else -->
  srcDoc={generatedHTML}
/>

<!-- What would be needed for communication -->
<iframe
  sandbox="allow-scripts allow-same-origin"
  srcDoc={generatedHTML}
/>
```

**Why NOT allow `allow-same-origin`?**
- Security risk: Malicious code could access parent window
- User-generated JavaScript shouldn't escape sandbox
- AI-generated code could have bugs that compromise app

**Implication**: Data must be embedded at artifact creation time, not fetched at runtime.

### Barrier 2: No Shared State Management

**Problem**: React state (Zustand) is not accessible from iframes

```typescript
// Parent app has access to blocks
const blocks = useBlocksStore(state => state.blocks);
const databaseBlocks = blocks.filter(b => b.type === 'database');

// ❌ Artifact iframe CANNOT access this
// It has its own isolated JavaScript context
```

**Implication**: Cannot create "reactive" artifacts that update when database changes.

### Barrier 3: No Tauri API Exposure

**Problem**: Tauri commands are only available to main window, not iframes

```javascript
// Parent window - WORKS
import { invoke } from '@tauri-apps/api/core';
const blocks = await invoke('get_blocks_by_note', { noteId });

// Artifact iframe - FAILS
// @tauri-apps/api not available in iframe context
// Even if imported, would fail CORS/sandbox check
```

**Implication**: Artifacts cannot make backend calls to read database data.

### Barrier 4: No Message Passing System

**Problem**: No `postMessage` communication setup between parent and iframe

**What could work** (but doesn't exist):
```typescript
// Parent window
window.addEventListener('message', (event) => {
  if (event.data.type === 'REQUEST_DATABASE_DATA') {
    const data = getDatabaseData(event.data.databaseId);
    iframe.contentWindow.postMessage({ type: 'DATABASE_DATA', data }, '*');
  }
});

// Artifact iframe
window.parent.postMessage({ type: 'REQUEST_DATABASE_DATA', databaseId: 'db-123' }, '*');
```

**Why not implemented?**
- Adds complexity
- Security concerns (validating messages)
- Not needed for current use cases
- Can be added in Phase 4 if needed

---

## 4. Use Case Patterns

Understanding **when and why** users want databases and artifacts connected:

### Use Case 1: Expense Tracker Dashboard

**User Goal**: "Visualize my monthly spending by category"

**Blocks Needed**:
1. **Database**: Expenses (Date, Category, Amount, Description)
2. **Artifact**: Pie chart showing spending by category

**Current Workaround**: User manually creates chart with hardcoded data

**With AI Enhancement**:
```
User: "Create a pie chart showing my expenses by category"

AI:
1. Find "Expenses" database in current note
2. Read database: exportForAI(databaseData)
3. Aggregate data: {Food: $450, Transport: $200, Entertainment: $150}
4. Generate artifact with chart code + embedded aggregated data
5. Create artifact block
```

**Result**: Working pie chart with current data snapshot

### Use Case 2: Workout Progress Tracker

**User Goal**: "Track my weightlifting progress over time"

**Blocks Needed**:
1. **Database**: Workouts (Date, Exercise, Weight, Reps, Sets)
2. **Artifact**: Line graph showing weight progression

**With AI Enhancement**:
```
User: "Show my bench press progress over the last 3 months"

AI:
1. Find "Workouts" database
2. Filter rows: Exercise="Bench Press" AND Date >= (today - 90 days)
3. Extract data points: [{date: "2024-10-15", weight: 135}, {date: "2024-10-22", weight: 140}, ...]
4. Generate line chart artifact with embedded time-series data
5. Create artifact block
```

**Result**: Line graph showing weight progression

### Use Case 3: Study Session Analytics

**User Goal**: "See how many hours I've studied each subject"

**Blocks Needed**:
1. **Database**: Study Sessions (Subject, Duration, Date, Quality)
2. **Artifact**: Bar chart showing total hours per subject

**With AI Enhancement**:
```
User: "Create a bar chart of my study time by subject"

AI:
1. Find "Study Sessions" database
2. Aggregate: SUM(Duration) GROUP BY Subject
3. Result: {Math: 45hrs, Physics: 32hrs, CS: 28hrs, ...}
4. Generate bar chart artifact with embedded aggregated data
5. Create artifact block
```

**Result**: Bar chart showing study distribution

### Use Case 4: Task Completion Rate

**User Goal**: "Visualize my task completion rate this month"

**Blocks Needed**:
1. **Database**: Tasks (Title, Status, Due Date, Priority, Completed Date)
2. **Artifact**: Progress ring/donut chart

**With AI Enhancement**:
```
User: "Show my task completion rate for January"

AI:
1. Find "Tasks" database
2. Filter: Due Date in January 2025
3. Calculate: completed/total ratio
4. Result: {completed: 23, incomplete: 7, total: 30, percentage: 76.7}
5. Generate donut chart with embedded stats
6. Create artifact block
```

**Result**: Circular progress chart showing 76.7% completion

### Use Case 5: Book Reading Log

**User Goal**: "Track books I've read with ratings visualization"

**Blocks Needed**:
1. **Database**: Books (Title, Author, Rating, Date Finished, Genre)
2. **Artifact**: Star rating distribution histogram

**With AI Enhancement**:
```
User: "Create a chart showing my book ratings distribution"

AI:
1. Find "Books" database
2. Group by Rating: {5-stars: 12, 4-stars: 18, 3-stars: 8, 2-stars: 2, 1-star: 0}
3. Generate histogram artifact with embedded counts
4. Create artifact block
```

**Result**: Histogram showing rating distribution

### Common Patterns Identified

| Pattern | Database Role | Artifact Role | AI Workflow |
|---------|---------------|---------------|-------------|
| **Time Series** | Stores data with timestamps | Line/area chart | Filter by date range → extract (date, value) pairs |
| **Categorical Aggregation** | Stores items with categories | Pie/bar chart | GROUP BY category → COUNT or SUM |
| **Progress Tracking** | Stores completion states | Progress ring/bar | Calculate percentage: completed/total |
| **Distribution Analysis** | Stores numeric values | Histogram | GROUP BY value ranges → count frequencies |
| **Comparison** | Stores items with metrics | Side-by-side bars | Extract metrics per item → compare |

---

## 5. Proposed Connection Architecture

### Architecture: AI as the Bridge

```
┌─────────────────────────────────────────────────────────────┐
│                        User Request                          │
│  "Create a chart showing my expense breakdown by category"   │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                    AI Agent (Claude/GPT-4)                    │
│                                                               │
│  1. Parse intent: chart visualization of database            │
│  2. Identify blocks needed: expense database → chart         │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│          Tool Call: read_note(current_note_id)                │
│                                                               │
│  Returns: {                                                   │
│    "blocks": [                                                │
│      { "id": "block-1", "type": "heading1", ... },           │
│      { "id": "block-2", "type": "database",                  │
│        "data": {                                              │
│          "title": "Monthly Expenses",                         │
│          "columns": [...],                                    │
│          "rows": [...]                                        │
│        }                                                      │
│      },                                                       │
│      ...                                                      │
│    ]                                                          │
│  }                                                            │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│      AI Processing: Extract & Transform Database Data         │
│                                                               │
│  1. Find database with title matching "expense"               │
│  2. Use exportForAI() format to understand schema             │
│  3. Aggregate data:                                           │
│     const categoryTotals = {};                                │
│     rows.forEach(row => {                                     │
│       const category = row.data[categoryColumnId];            │
│       const amount = row.data[amountColumnId];                │
│       categoryTotals[category] =                              │
│         (categoryTotals[category] || 0) + amount;             │
│     });                                                       │
│  4. Result: { "Food": 450, "Transport": 200, ... }           │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│       Tool Call: create_block(type="artifact", ...)           │
│                                                               │
│  data: {                                                      │
│    title: "Expense Breakdown Chart",                          │
│    html: "<canvas id='chart'></canvas>",                      │
│    css: "...",                                                │
│    javascript: `                                              │
│      // EMBEDDED DATA (hardcoded from database)               │
│      const expenseData = {                                    │
│        "Food": 450,                                           │
│        "Transport": 200,                                      │
│        "Entertainment": 150,                                  │
│        "Utilities": 100                                       │
│      };                                                       │
│                                                               │
│      // Chart rendering code                                  │
│      const canvas = document.getElementById('chart');         │
│      const ctx = canvas.getContext('2d');                     │
│      // ... draw pie chart using expenseData ...              │
│    `                                                          │
│  }                                                            │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                   Artifact Block Created                      │
│                                                               │
│   Displays: Pie chart with Food (45%), Transport (20%),      │
│             Entertainment (15%), Utilities (10%)              │
│                                                               │
│   Data is SNAPSHOT from database at creation time            │
│   (Not live-updating - that comes in Phase 4)                │
└──────────────────────────────────────────────────────────────┘
```

### Key Insight: Snapshot vs Live Data

**Phase 1-3 (MVP)**: **SNAPSHOT** approach
- Artifact contains hardcoded data from database at creation time
- If database updates, artifact shows stale data
- User can regenerate artifact to get fresh data

**Phase 4+ (Advanced)**: **LIVE** approach (optional)
- Implement `postMessage` communication
- Artifact sends request to parent: "Give me latest data for database-id-123"
- Parent responds with current database state
- Artifact re-renders with fresh data
- Optional: Auto-refresh every N seconds

**Why snapshot first?**
- ✅ Simpler to implement (no communication layer needed)
- ✅ Safer (no runtime data exposure)
- ✅ Faster (no continuous querying)
- ✅ Good enough for 90% of use cases

---

## 6. Data Flow Patterns

### Pattern 1: Direct Embedding (Simple)

**Use Case**: Small datasets (<100 rows)

**Flow**:
```
Database (100 rows) → AI reads all → Embeds in artifact → Chart renders
```

**Artifact JavaScript**:
```javascript
// All data embedded directly
const expenses = [
  { date: "2025-01-01", category: "Food", amount: 45.50 },
  { date: "2025-01-02", category: "Transport", amount: 12.00 },
  // ... 98 more rows
];

// Chart code uses 'expenses' array
drawChart(expenses);
```

**Pros**: Simple, no aggregation needed
**Cons**: Large code size if dataset is big

### Pattern 2: Pre-Aggregated Embedding (Recommended)

**Use Case**: Large datasets (100+ rows) or complex queries

**Flow**:
```
Database (1000 rows) → AI aggregates → Embeds summary → Chart renders
```

**AI Aggregation**:
```javascript
// AI processes database before embedding
const rawData = databaseRows; // 1000 expense entries

// Aggregate by category
const aggregated = rawData.reduce((acc, row) => {
  const category = row.data[categoryColumnId];
  const amount = row.data[amountColumnId];
  acc[category] = (acc[category] || 0) + amount;
  return acc;
}, {});

// Result: { "Food": 4500, "Transport": 2000, "Entertainment": 1500 }
```

**Artifact JavaScript**:
```javascript
// Only aggregated data embedded (tiny payload)
const categoryTotals = {
  "Food": 4500,
  "Transport": 2000,
  "Entertainment": 1500,
  "Utilities": 1000
};

// Chart code uses aggregated data
drawPieChart(categoryTotals);
```

**Pros**: Tiny code size, fast rendering
**Cons**: Loses detail (can't drill down)

### Pattern 3: Multi-Level Embedding (Advanced)

**Use Case**: Interactive dashboards with drill-down

**Flow**:
```
Database → AI creates hierarchical summary → Embeds nested object → Interactive chart
```

**Artifact JavaScript**:
```javascript
// Hierarchical data structure
const expenseData = {
  summary: {
    "Food": 4500,
    "Transport": 2000
  },
  details: {
    "Food": [
      { date: "2025-01-01", item: "Groceries", amount: 120 },
      { date: "2025-01-02", item: "Restaurant", amount: 45 },
      // ...
    ],
    "Transport": [
      { date: "2025-01-01", item: "Gas", amount: 50 },
      // ...
    ]
  }
};

// User clicks "Food" slice → shows detailed breakdown
function onSliceClick(category) {
  showDetails(expenseData.details[category]);
}
```

**Pros**: Interactive, preserves detail
**Cons**: Larger code size, more complex

### Pattern 4: Statistical Embedding

**Use Case**: Analytics dashboards

**Flow**:
```
Database → AI calculates statistics → Embeds metrics → Dashboard renders
```

**Artifact JavaScript**:
```javascript
// Only statistics embedded, not raw data
const stats = {
  totalExpenses: 8000,
  avgPerDay: 266.67,
  categories: {
    "Food": { total: 4500, percentage: 56.25, trend: "up" },
    "Transport": { total: 2000, percentage: 25, trend: "stable" }
  },
  topExpense: { date: "2025-01-15", amount: 450, category: "Food" },
  monthOverMonth: { change: 12.5, direction: "increase" }
};

// Dashboard displays metrics
renderDashboard(stats);
```

**Pros**: Rich analytics, compact
**Cons**: Cannot access individual records

---

## 7. AI Orchestration Workflow

### Workflow: "Create chart from database"

**Step-by-step execution**:

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: User Request Analysis                                │
│                                                               │
│ Input: "Create a pie chart showing my expense breakdown"     │
│                                                               │
│ AI Parsing:                                                   │
│ - Intent: visualization                                       │
│ - Chart type: pie                                             │
│ - Data source: expense database                               │
│ - Aggregation: breakdown (GROUP BY category with SUM)        │
└─────────────────────┬────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Find Target Database                                 │
│                                                               │
│ Tool: read_note(current_note_id)                             │
│                                                               │
│ AI Search Logic:                                              │
│ 1. Get all blocks in current note                            │
│ 2. Filter type="database"                                    │
│ 3. Search for title matching "expense" (fuzzy match)         │
│ 4. If multiple: ask user to clarify                          │
│ 5. If none: suggest creating one first                       │
│                                                               │
│ Result: Found "Monthly Expenses" database (block-id-123)     │
└─────────────────────┬────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Read & Understand Database Schema                    │
│                                                               │
│ Database Structure:                                           │
│ {                                                             │
│   "title": "Monthly Expenses",                                │
│   "columns": [                                                │
│     { "id": "col-1", "name": "Date", "type": "date" },       │
│     { "id": "col-2", "name": "Category", "type": "select",   │
│       "options": ["Food", "Transport", ...] },               │
│     { "id": "col-3", "name": "Amount", "type": "number" },   │
│     { "id": "col-4", "name": "Description", "type": "text" } │
│   ],                                                          │
│   "rows": [ /* 150 rows of data */ ]                         │
│ }                                                             │
│                                                               │
│ AI Understanding:                                             │
│ - This is financial tracking database                         │
│ - Category column (col-2) is the grouping key                │
│ - Amount column (col-3) is the value to sum                  │
│ - Date column (col-1) can be used for filtering              │
└─────────────────────┬────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Data Transformation & Aggregation                    │
│                                                               │
│ AI Code Execution (internal reasoning):                       │
│                                                               │
│ const categoryTotals = {};                                    │
│ databaseRows.forEach(row => {                                 │
│   const category = row.data['col-2']; // Category column     │
│   const amount = row.data['col-3'];   // Amount column       │
│   categoryTotals[category] =                                  │
│     (categoryTotals[category] || 0) + amount;                 │
│ });                                                           │
│                                                               │
│ Result:                                                       │
│ {                                                             │
│   "Food": 1450.50,                                            │
│   "Transport": 620.00,                                        │
│   "Entertainment": 380.00,                                    │
│   "Utilities": 250.00,                                        │
│   "Healthcare": 180.00,                                       │
│   "Other": 95.50                                              │
│ }                                                             │
└─────────────────────┬────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Generate Artifact Code                               │
│                                                               │
│ AI generates 3 code sections:                                 │
│                                                               │
│ HTML:                                                         │
│ <div class="chart-container">                                │
│   <h2>Expense Breakdown</h2>                                 │
│   <canvas id="pieChart"></canvas>                            │
│   <div id="legend"></div>                                    │
│ </div>                                                        │
│                                                               │
│ CSS:                                                          │
│ .chart-container { padding: 20px; text-align: center; }      │
│ #pieChart { max-width: 400px; height: 400px; margin: auto; }│
│ /* ... more styling ... */                                   │
│                                                               │
│ JavaScript:                                                   │
│ // EMBEDDED DATA                                              │
│ const data = {                                                │
│   "Food": 1450.50,                                            │
│   "Transport": 620.00,                                        │
│   /* ... */                                                   │
│ };                                                            │
│                                                               │
│ // CHART DRAWING CODE                                         │
│ const canvas = document.getElementById('pieChart');           │
│ const ctx = canvas.getContext('2d');                          │
│ // ... pie chart drawing logic ...                           │
│ // (uses Canvas API or SVG)                                  │
└─────────────────────┬────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 6: Create Artifact Block                                │
│                                                               │
│ Tool: create_block({                                          │
│   note_id: current_note_id,                                   │
│   type: "artifact",                                           │
│   position: 3, // After database block                       │
│   data: {                                                     │
│     title: "Expense Breakdown Chart",                         │
│     html: /* generated HTML */,                               │
│     css: /* generated CSS */,                                 │
│     javascript: /* generated JS with embedded data */         │
│   }                                                           │
│ })                                                            │
│                                                               │
│ Backend: Saves to database, returns block ID                 │
│ Frontend: Renders artifact with chart                         │
└─────────────────────┬────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 7: User Sees Result                                     │
│                                                               │
│ ┌───────────────────────────────────────┐                    │
│ │   📊 Expense Breakdown Chart          │                    │
│ │                                       │                    │
│ │        [Pie Chart Visual]             │                    │
│ │     Food: 50.3% ($1,450.50)           │                    │
│ │     Transport: 21.5% ($620.00)        │                    │
│ │     Entertainment: 13.2% ($380.00)    │                    │
│ │     Utilities: 8.7% ($250.00)         │                    │
│ │     Healthcare: 6.2% ($180.00)        │                    │
│ │     Other: 3.3% ($95.50)              │                    │
│ └───────────────────────────────────────┘                    │
│                                                               │
│ Time elapsed: ~5-10 seconds                                   │
└──────────────────────────────────────────────────────────────┘
```

### Tool Sequence Summary

```typescript
// AI's internal tool call sequence
[
  {
    tool: "read_note",
    args: { note_id: "current-note-xyz" },
    purpose: "Find all blocks including databases"
  },
  {
    tool: "create_block",
    args: {
      note_id: "current-note-xyz",
      type: "artifact",
      data: {
        title: "Expense Breakdown Chart",
        html: "...",
        css: "...",
        javascript: "const data = { /* embedded from database */ }; ..."
      }
    },
    purpose: "Create visualization artifact with embedded database data"
  }
]
```

---

## 8. Implementation Approaches

### Approach 1: Embedded Data (Phase 1-3 MVP)

**Implementation**:
```typescript
// AI workflow when generating artifact from database

async function createChartFromDatabase(
  databaseBlockId: string,
  chartType: 'pie' | 'bar' | 'line',
  aggregation: AggregationSpec
): Promise<ArtifactBlockData> {

  // 1. Read database
  const databaseBlock = await getBlockById(databaseBlockId);
  const dbData = databaseBlock.data as DatabaseBlockData;

  // 2. Use exportForAI to get clean format
  const { schema, data, statistics } = exportForAI(dbData);

  // 3. Perform aggregation
  const aggregated = performAggregation(data, aggregation);
  // Result: { "Category1": 450, "Category2": 300, ... }

  // 4. Generate artifact code
  const artifactCode = generateChartArtifact({
    chartType,
    data: aggregated,
    schema
  });

  return {
    type: 'artifact',
    title: `${chartType} Chart - ${dbData.title}`,
    html: artifactCode.html,
    css: artifactCode.css,
    javascript: artifactCode.javascript,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function generateChartArtifact({
  chartType,
  data,
  schema
}): { html: string; css: string; javascript: string } {

  // Embed data directly in JavaScript
  const dataEmbedding = `const chartData = ${JSON.stringify(data, null, 2)};`;

  const javascript = `
${dataEmbedding}

// Chart rendering code
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');

// Draw ${chartType} chart
${getChartDrawingCode(chartType)}
`;

  return {
    html: `<canvas id="chart" width="600" height="400"></canvas>`,
    css: `body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #1a1a2e; }`,
    javascript
  };
}
```

**Pros**:
- ✅ Simple to implement (no new infrastructure)
- ✅ Works with current sandbox model
- ✅ Fast rendering (data is local)
- ✅ No security concerns

**Cons**:
- ❌ Data is snapshot (stale if database updates)
- ❌ Large code size if dataset is big
- ❌ User must manually regenerate to refresh

### Approach 2: PostMessage Communication (Phase 4+)

**Implementation**:
```typescript
// Parent window (CanvasContent component)
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data.type === 'REQUEST_DATABASE_DATA') {
      const { databaseId, artifactId } = event.data;

      // Get database block
      const dbBlock = blocks.find(b => b.id === databaseId);
      if (!dbBlock || dbBlock.type !== 'database') {
        return;
      }

      // Export for AI consumption
      const dbData = dbBlock.data as DatabaseBlockData;
      const exported = exportForAI(dbData);

      // Send to artifact iframe
      const artifactIframe = document.querySelector(`iframe[data-block-id="${artifactId}"]`) as HTMLIFrameElement;
      artifactIframe?.contentWindow?.postMessage({
        type: 'DATABASE_DATA_RESPONSE',
        databaseId,
        data: exported
      }, '*');
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [blocks]);

// Artifact iframe JavaScript
function requestDatabaseData(databaseId) {
  return new Promise((resolve) => {
    // Send request to parent
    window.parent.postMessage({
      type: 'REQUEST_DATABASE_DATA',
      databaseId,
      artifactId: '${artifactBlockId}' // Injected at creation time
    }, '*');

    // Listen for response
    const handler = (event) => {
      if (event.data.type === 'DATABASE_DATA_RESPONSE' &&
          event.data.databaseId === databaseId) {
        window.removeEventListener('message', handler);
        resolve(event.data.data);
      }
    };
    window.addEventListener('message', handler);
  });
}

// Usage in artifact
async function initChart() {
  const dbData = await requestDatabaseData('database-block-123');
  renderChart(dbData.data);
}

initChart();

// Optional: Auto-refresh every 30 seconds
setInterval(initChart, 30000);
```

**Pros**:
- ✅ Live data updates
- ✅ Artifacts stay fresh
- ✅ Can handle large datasets (fetched on demand)

**Cons**:
- ❌ Complex to implement
- ❌ Security validation needed
- ❌ Performance overhead (messaging)
- ❌ Requires sandbox="allow-same-origin" (security risk)

### Approach 3: Reactive Database Links (Phase 5+)

**Implementation**:
```typescript
// Database block tracks linked artifacts
interface DatabaseBlockData {
  // ... existing fields
  linkedArtifacts?: string[]; // Array of artifact block IDs
}

// When database updates
async function onDatabaseUpdate(databaseBlockId: string) {
  const dbBlock = await getBlockById(databaseBlockId);
  const linkedArtifactIds = dbBlock.data.linkedArtifacts || [];

  // Trigger re-generation of linked artifacts
  for (const artifactId of linkedArtifactIds) {
    await regenerateArtifact(artifactId, databaseBlockId);
  }
}

async function regenerateArtifact(artifactId: string, databaseId: string) {
  const artifactBlock = await getBlockById(artifactId);
  const databaseBlock = await getBlockById(databaseId);

  // Re-run AI generation with fresh database data
  const newArtifactData = await aiService.generateChartFromDatabase(
    databaseBlock.data,
    artifactBlock.data.chartConfig // Stored config
  );

  // Update artifact
  await updateBlock(artifactId, newArtifactData);
}
```

**Pros**:
- ✅ Fully automatic updates
- ✅ User doesn't need to manually refresh
- ✅ Preserves chart configuration

**Cons**:
- ❌ Very complex (requires metadata tracking)
- ❌ Performance concerns (regenerating on every edit)
- ❌ AI cost per update
- ❌ Not needed for Phase 1-3

---

## 9. Security & Safety Considerations

### Security Concern 1: Data Exposure

**Risk**: Artifact code contains all database data in plaintext JavaScript

**Scenario**:
```javascript
// Artifact JavaScript (visible in page source)
const userData = {
  "John Smith": { email: "john@email.com", phone: "555-1234" },
  "Jane Doe": { email: "jane@email.com", phone: "555-5678" }
};
```

**Mitigation**:
- ⚠️ **Document clearly**: Users should understand artifacts contain snapshot of data
- ✅ **Don't embed sensitive data**: AI should warn if database has personal info
- ✅ **Aggregate when possible**: Use summary stats instead of raw records
- ✅ **Export control**: Add checkbox "Include full data" vs "Summary only"

### Security Concern 2: Code Injection via Database

**Risk**: Malicious data in database could inject code into artifact

**Scenario**:
```javascript
// Database has row with Category: "</script><script>alert('XSS')</script>"
// If naively embedded:
const data = {
  "</script><script>alert('XSS')</script>": 450
};
// This executes the injected code!
```

**Mitigation**:
- ✅ **Always use JSON.stringify**: `const data = ${JSON.stringify(dbData)};`
- ✅ **Sanitize keys**: Remove/escape special characters in category names
- ✅ **Validate before embedding**: Check for script tags, event handlers
- ✅ **CSP headers**: Add Content-Security-Policy to artifact iframe

### Security Concern 3: PostMessage Vulnerabilities

**Risk**: Malicious iframe could request arbitrary database data

**Scenario**:
```javascript
// Malicious artifact tries to read other databases
window.parent.postMessage({
  type: 'REQUEST_DATABASE_DATA',
  databaseId: 'private-passwords-db'
}, '*');
```

**Mitigation**:
- ✅ **Whitelist artifact IDs**: Only respond to messages from known artifacts
- ✅ **Database-artifact linking**: Artifacts can only read databases they're linked to
- ✅ **Permission system**: Database owner must approve artifact access
- ✅ **Message validation**: Check origin, type, parameters

### Security Concern 4: Artifact Modifying Database

**Risk**: Malicious artifact tries to write back to database

**Scenario**:
```javascript
// Artifact attempts to modify database
window.parent.postMessage({
  type: 'UPDATE_DATABASE',
  databaseId: 'expenses',
  newRow: { /* malicious data */ }
}, '*');
```

**Mitigation**:
- ✅ **Read-only by default**: Artifacts cannot write to databases (Phase 1-4)
- ✅ **Explicit write permission**: Phase 5+ could add opt-in write access
- ✅ **Message handler only reads**: Parent never processes UPDATE messages from iframes

---

## 10. Phase Roadmap

### Phase 1: AI Database Understanding (Weeks 1-2)

**Goal**: AI can read and understand databases

**Deliverables**:
- ✅ `read_note(note_id)` tool returns all blocks including databases
- ✅ AI can parse database schema and data
- ✅ `exportForAI()` utility works correctly
- ✅ AI can aggregate data (SUM, COUNT, GROUP BY)

**Database-Artifact Connection**: **NOT IMPLEMENTED YET**

### Phase 2: AI Artifact Understanding (Weeks 3-4)

**Goal**: AI can generate and edit artifacts

**Deliverables**:
- ✅ Real `generateArtifact()` implementation (replaces mock)
- ✅ AI can create chart code (pie, bar, line, donut)
- ✅ Template library for common charts
- ✅ `edit_artifact` tool for fixing bugs

**Database-Artifact Connection**: **BEGINS HERE**

**Week 3 Day 1-2**: Implement chart generation with hardcoded data
```typescript
// Test: AI generates artifact with embedded array
const artifact = await generateArtifact("Create pie chart with data [10, 20, 30]");
// Result: Working chart with hardcoded [10, 20, 30]
```

**Week 3 Day 3-5**: Implement chart generation from database
```typescript
// Test: AI reads database, embeds data in chart
const artifact = await generateChartFromDatabase(databaseBlockId, 'pie', aggregation);
// Result: Working chart with database data embedded
```

**Week 4**: Refine and test various chart types

### Phase 3: Autonomous Multi-Block Workflows (Weeks 5-6)

**Goal**: AI can create complete notes with database + artifact

**Deliverables**:
- ✅ `create_note` tool
- ✅ `arrange_blocks` tool for layout
- ✅ Multi-step workflows

**Database-Artifact Connection**: **FULLY WORKING**

**Example Workflow**:
```
User: "Create expense tracker note with database and chart"

AI:
1. create_note("My Expense Tracker")
2. create_block(type="database", schema for expenses)
3. create_block(type="artifact", chart code with mock data)
4. arrange_blocks([db on left, chart on right])

Result: Complete note with database + visualization
```

**Week 5 Day 3**: Implement full database → artifact workflow
```typescript
// Integration test
const noteId = await createExpenseTrackerNote();
// Should have: database block + chart artifact with data from database
```

### Phase 4: Planning & Reflection (Weeks 7-8) - OPTIONAL

**Goal**: AI can plan complex multi-block operations

**Database-Artifact Connection**: Enhanced with live updates (OPTIONAL)

**Potential Enhancement**: PostMessage communication for live data
```typescript
// If user wants live-updating charts, implement postMessage
// Otherwise, snapshot approach from Phase 2-3 is sufficient
```

### Phase 5: Advanced Features (Weeks 9-10) - OPTIONAL

**Database-Artifact Connection**: Reactive updates (OPTIONAL)

**Potential Enhancement**: Database links trigger artifact regeneration

---

## Summary for AI Training

### What AI Must Learn About Database-Artifact Connections

**Phase 1-3 (MVP) Rules**:

1. **Artifacts CANNOT read databases at runtime** (sandboxed)
2. **AI acts as the bridge**: Reads database, embeds data in artifact
3. **Data is a snapshot**: Not live-updating (acceptable for MVP)
4. **Always aggregate**: Don't embed 1000 rows, embed summary stats
5. **Use exportForAI()**: Get clean {schema, data, statistics} format

**When user says**: "Create a chart showing [data from database]"

**AI should**:
1. Find database in current note (search by title/type)
2. Read database using `read_note()` tool
3. Identify relevant columns for chart (category + value)
4. Aggregate data: `GROUP BY category, SUM(value)`
5. Generate artifact with embedded aggregated data
6. Create artifact block

**AI should NOT**:
- ❌ Try to make artifact fetch data at runtime (won't work)
- ❌ Embed raw rows if dataset is large (code bloat)
- ❌ Expose sensitive personal data without warning user

**Future (Phase 4+)**:
- Live data updates via postMessage (if implemented)
- Reactive re-generation when database changes (if implemented)

---

**End of Connection Analysis**

This document provides complete understanding of how databases and artifacts can interact, the technical barriers, and the AI-mediated solution architecture.

Next: Phase 0 Day 4-5 - AI Understanding Patterns (training examples and workflows)
