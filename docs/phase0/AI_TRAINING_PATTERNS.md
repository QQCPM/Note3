# Phase 0 Day 4-5: AI Understanding Patterns & Training Examples

**Date**: 2025-01-15
**Purpose**: Define how AI should understand and manipulate databases and artifacts
**Status**: Foundation Analysis - Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Database Understanding Patterns](#2-database-understanding-patterns)
3. [Artifact Understanding Patterns](#3-artifact-understanding-patterns)
4. [Database-Artifact Integration Patterns](#4-database-artifact-integration-patterns)
5. [Error Handling Patterns](#5-error-handling-patterns)
6. [Edge Cases & Solutions](#6-edge-cases--solutions)
7. [Complete Workflow Examples](#7-complete-workflow-examples)
8. [Testing Scenarios](#8-testing-scenarios)

---

## 1. Executive Summary

### Purpose of This Document

This document defines **exactly how the AI agent should behave** when working with databases and artifacts. It serves as:

- **Training examples** for AI prompt engineering
- **Behavior specifications** for testing
- **Reference guide** for developers implementing Phase 1-3
- **Quality assurance** checklist for validation

### How to Use This Document

**For AI Prompt Engineering**:
- Copy example patterns into system prompts
- Use step-by-step workflows as few-shot examples
- Reference error handling for robustness

**For Developers**:
- Implement tools that match expected behavior
- Write tests based on example scenarios
- Validate AI responses against patterns

**For QA**:
- Test all example scenarios
- Verify edge cases are handled
- Check error messages match expectations

---

## 2. Database Understanding Patterns

### Pattern 2.1: Database Schema Recognition

**User Prompt**: *"What columns does my expenses database have?"*

**AI Expected Behavior**:

**Step 1**: Find database
```typescript
// AI calls read_note(current_note_id)
// Searches for database blocks with title containing "expense"
```

**Step 2**: Parse schema
```typescript
// From database block data:
{
  "columns": [
    { "id": "col-1", "name": "Date", "type": "date" },
    { "id": "col-2", "name": "Category", "type": "select", "options": ["Food", "Transport", ...] },
    { "id": "col-3", "name": "Amount", "type": "number" },
    { "id": "col-4", "name": "Description", "type": "text" }
  ]
}
```

**Step 3**: Respond in natural language
```
AI Response:
"Your expenses database has 4 columns:
1. Date (date type) - when the expense occurred
2. Category (select type) - categorizes expenses as Food, Transport, Entertainment, etc.
3. Amount (number type) - the cost in dollars
4. Description (text type) - notes about the expense

The database currently has 47 entries."
```

**Key Rules**:
- ✅ Always describe column types in plain English
- ✅ Mention select options if present
- ✅ Include row count
- ✅ Infer purpose from column names and data

---

### Pattern 2.2: Database Data Analysis

**User Prompt**: *"How much did I spend on food last month?"*

**AI Expected Behavior**:

**Step 1**: Parse query requirements
- Filter: Category = "Food"
- Time range: Last 30 days
- Aggregation: SUM(Amount)

**Step 2**: Read database
```typescript
const noteData = await read_note(current_note_id);
const expenseDb = noteData.blocks.find(b =>
  b.type === 'database' && b.data.title.toLowerCase().includes('expense')
);
```

**Step 3**: Filter and aggregate
```typescript
const foodExpenses = expenseDb.data.rows.filter(row => {
  const category = row.data['col-2']; // Category column
  const date = new Date(row.data['col-1']); // Date column
  const isFood = category === 'Food';
  const isLastMonth = (Date.now() - date.getTime()) < 30 * 24 * 60 * 60 * 1000;
  return isFood && isLastMonth;
});

const total = foodExpenses.reduce((sum, row) =>
  sum + row.data['col-3'], 0 // Amount column
);
```

**Step 4**: Respond with insight
```
AI Response:
"You spent $1,247.50 on food in the last 30 days.

Breakdown:
- 23 food-related expenses
- Average per expense: $54.24
- Daily average: $41.58

This is 15% higher than the previous month. Would you like me to create a visualization showing your food spending trend?"
```

**Key Rules**:
- ✅ Answer the specific question first
- ✅ Provide contextual insights (averages, comparisons)
- ✅ Offer next steps (visualization, deeper analysis)
- ✅ Use appropriate precision ($1,247.50 not $1247.5034)

---

### Pattern 2.3: Database Creation from Description

**User Prompt**: *"Create a book reading log database"*

**AI Expected Behavior**:

**Step 1**: Infer schema from domain knowledge
```typescript
// AI reasoning:
// A book reading log typically tracks:
// - Title (text)
// - Author (text)
// - Rating (number or select)
// - Date Finished (date)
// - Genre (select - common categories)
// - Notes (text - optional)
```

**Step 2**: Design appropriate column types
```typescript
const schema = {
  title: "Book Reading Log",
  columns: [
    {
      name: "Title",
      type: "text",
      // Reasoning: Book titles vary greatly, need flexible text field
    },
    {
      name: "Author",
      type: "text",
      // Reasoning: Author names also vary
    },
    {
      name: "Rating",
      type: "select",
      options: ["★☆☆☆☆", "★★☆☆☆", "★★★☆☆", "★★★★☆", "★★★★★"],
      // Reasoning: Select with star emojis is more visual than number
    },
    {
      name: "Date Finished",
      type: "date",
      // Reasoning: Track when book was completed
    },
    {
      name: "Genre",
      type: "select",
      options: ["Fiction", "Non-Fiction", "Mystery", "Sci-Fi", "Biography", "Other"],
      // Reasoning: Categorize for filtering
    },
    {
      name: "Notes",
      type: "text",
      // Reasoning: Optional thoughts/quotes
    }
  ],
  rows: [], // Start empty
  view: "table"
};
```

**Step 3**: Create block
```typescript
await create_block({
  note_id: current_note_id,
  type: "database",
  position: next_position,
  data: schema
});
```

**Step 4**: Confirm and guide
```
AI Response:
"I've created a Book Reading Log database with these columns:

📚 Title - the book's name
✍️ Author - who wrote it
⭐ Rating - 1-5 stars (select from dropdown)
📅 Date Finished - when you completed it
📖 Genre - Fiction, Non-Fiction, Mystery, etc.
📝 Notes - your thoughts or favorite quotes

The database is ready! Would you like me to add some sample entries, or would you prefer to start adding your books manually?"
```

**Key Rules**:
- ✅ Choose column types that match use case (select for categories, date for timestamps)
- ✅ Use emojis/symbols for select options when appropriate (★ for ratings)
- ✅ Include reasonable default options for select columns
- ✅ Explain the purpose of each column
- ✅ Offer to populate with examples

---

### Pattern 2.4: Database Modification

**User Prompt**: *"Add a 'Page Count' column to my book log"*

**AI Expected Behavior**:

**Step 1**: Find database
```typescript
const bookDb = blocks.find(b =>
  b.type === 'database' &&
  b.data.title.toLowerCase().includes('book')
);
```

**Step 2**: Determine column type
```typescript
// AI reasoning:
// Page count is always a positive integer
// Type: number
```

**Step 3**: Create new column
```typescript
const newColumn = {
  id: generateColumnId(),
  name: "Page Count",
  type: "number",
  width: 100
};

const updatedColumns = [...bookDb.data.columns, newColumn];
```

**Step 4**: Update all existing rows
```typescript
const updatedRows = bookDb.data.rows.map(row => ({
  ...row,
  data: {
    ...row.data,
    [newColumn.id]: null // Initialize with null for existing rows
  }
}));
```

**Step 5**: Update block
```typescript
await update_block(bookDb.id, {
  ...bookDb.data,
  columns: updatedColumns,
  rows: updatedRows
});
```

**Step 6**: Confirm
```
AI Response:
"I've added a 'Page Count' column (number type) to your Book Reading Log.

All existing entries now have this column (currently empty). You can fill them in manually, or if you'd like, I can look up page counts for your books online and populate them automatically."
```

**Key Rules**:
- ✅ Automatically infer correct column type
- ✅ Initialize new column in ALL existing rows (null by default)
- ✅ Offer to populate with data if possible

---

## 3. Artifact Understanding Patterns

### Pattern 3.1: Artifact Code Analysis

**User Prompt**: *"What does this timer artifact do?"*

**AI Expected Behavior**:

**Step 1**: Read artifact code
```typescript
const artifact = blocks.find(b =>
  b.type === 'artifact' &&
  b.data.title.toLowerCase().includes('timer')
);

const { html, css, javascript } = artifact.data;
```

**Step 2**: Analyze HTML structure
```html
<!-- AI identifies key elements -->
<div class="pomodoro">
  <h1 id="time">25:00</h1>  <!-- Display -->
  <button id="start">Start</button>  <!-- Control -->
  <button id="pause">Pause</button>  <!-- Control -->
  <button id="reset">Reset</button>  <!-- Control -->
</div>
```

**Step 3**: Analyze JavaScript behavior
```javascript
// AI identifies:
// - Initial state: 25 minutes
// - setInterval for countdown
// - Button event listeners
// - Alert on completion
```

**Step 4**: Explain in user-friendly language
```
AI Response:
"This is a Pomodoro Timer artifact. Here's what it does:

🕐 Functionality:
- Starts at 25 minutes (standard Pomodoro duration)
- Counts down by seconds
- Has Start, Pause, and Reset controls
- Shows an alert when time is up

🎨 Design:
- Purple gradient background
- Large, easy-to-read time display
- Smooth button hover effects
- Clean, minimal interface

💡 How to use:
1. Click 'Start' to begin the countdown
2. Click 'Pause' to temporarily stop
3. Click 'Reset' to go back to 25:00

This is great for productivity - work focused for 25 minutes, then take a 5-minute break!"
```

**Key Rules**:
- ✅ Explain functionality first (what it does)
- ✅ Describe design/aesthetics
- ✅ Provide usage instructions
- ✅ Add context (why Pomodoro technique, etc.)

---

### Pattern 3.2: Artifact Bug Fixing

**User Prompt**: *"My timer isn't counting down when I click start"*

**AI Expected Behavior**:

**Step 1**: Read current code
```typescript
const artifact = await read_block(artifact_id);
const { javascript } = artifact.data;
```

**Step 2**: Analyze for common bugs
```javascript
// Current code (buggy):
startBtn.addEventListener('click', () => {
  setInterval(tick, 1000); // ❌ Bug: not storing interval
  isRunning = true;
});

pauseBtn.addEventListener('click', () => {
  clearInterval(interval); // ❌ Bug: 'interval' is undefined
  isRunning = false;
});
```

**Step 3**: Identify root cause
```
AI Analysis:
Bug: The setInterval result is not being stored in a variable, so it can't be paused/cleared later.
Fix: Store the interval ID: `interval = setInterval(tick, 1000);`
```

**Step 4**: Generate fix
```javascript
// Fixed code:
let interval = null; // ✅ Declare variable

startBtn.addEventListener('click', () => {
  if (!isRunning && interval === null) { // ✅ Check if already running
    interval = setInterval(tick, 1000); // ✅ Store interval ID
    isRunning = true;
  }
});

pauseBtn.addEventListener('click', () => {
  clearInterval(interval); // ✅ Now works
  interval = null; // ✅ Reset variable
  isRunning = false;
});
```

**Step 5**: Update artifact
```typescript
await update_block(artifact_id, {
  ...artifact.data,
  javascript: fixedCode
});
```

**Step 6**: Explain what was wrong
```
AI Response:
"I found the bug! The timer's setInterval wasn't being stored in a variable, so the pause button couldn't stop it.

What I fixed:
✅ Added interval variable to store the timer ID
✅ Added check to prevent multiple timers running simultaneously
✅ Reset interval to null when paused

The timer should now work correctly:
- Click Start → countdown begins
- Click Pause → countdown stops
- Click Start again → countdown resumes

Try it out!"
```

**Key Rules**:
- ✅ Identify specific bug (not just "something's wrong")
- ✅ Explain what causes the problem
- ✅ Show what changed (before/after)
- ✅ Provide testing instructions

---

### Pattern 3.3: Artifact Customization

**User Prompt**: *"Make the timer 30 minutes instead of 25"*

**AI Expected Behavior**:

**Step 1**: Find affected code
```javascript
// Current:
let minutes = 25;
let seconds = 0;

// Also in reset:
resetBtn.addEventListener('click', () => {
  minutes = 25; // ← Also needs changing
  seconds = 0;
  // ...
});
```

**Step 2**: Make targeted changes
```javascript
// Updated:
let minutes = 30; // ✅ Changed
let seconds = 0;

resetBtn.addEventListener('click', () => {
  minutes = 30; // ✅ Changed
  seconds = 0;
  // ...
});
```

**Step 3**: Update artifact
```typescript
await update_block(artifact_id, {
  ...artifact.data,
  javascript: updatedCode,
  title: "30-Minute Timer" // ✅ Also update title
});
```

**Step 4**: Confirm
```
AI Response:
"Done! I've updated your timer to 30 minutes.

Changes made:
✅ Initial time: 25:00 → 30:00
✅ Reset button: now resets to 30:00
✅ Title: updated to '30-Minute Timer'

Everything else (pause, styling, alert) works the same way."
```

**Key Rules**:
- ✅ Change ALL occurrences of the value
- ✅ Update related fields (title, comments)
- ✅ Preserve all other functionality
- ✅ List exactly what changed

---

## 4. Database-Artifact Integration Patterns

### Pattern 4.1: Chart Generation from Database

**User Prompt**: *"Create a pie chart showing my expense breakdown by category"*

**AI Expected Behavior**:

**Step 1**: Find database
```typescript
const expenseDb = blocks.find(b =>
  b.type === 'database' &&
  b.data.title.toLowerCase().includes('expense')
);
```

**Step 2**: Identify relevant columns
```typescript
// AI analyzes schema:
// - Category column (select type) → chart categories
// - Amount column (number type) → values to sum
```

**Step 3**: Aggregate data
```typescript
const categoryColumn = expenseDb.data.columns.find(c => c.name === 'Category');
const amountColumn = expenseDb.data.columns.find(c => c.name === 'Amount');

const aggregated = {};
expenseDb.data.rows.forEach(row => {
  const category = row.data[categoryColumn.id];
  const amount = row.data[amountColumn.id];
  aggregated[category] = (aggregated[category] || 0) + amount;
});

// Result: { "Food": 1450.50, "Transport": 620, ... }
```

**Step 4**: Generate artifact code
```javascript
// Generated JavaScript (embedded data):
const expenseData = {
  "Food": 1450.50,
  "Transport": 620.00,
  "Entertainment": 380.00,
  "Utilities": 250.00,
  "Healthcare": 180.00,
  "Other": 95.50
};

const total = Object.values(expenseData).reduce((a,b) => a+b, 0);

// Draw pie chart
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');
const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];

let currentAngle = 0;
Object.entries(expenseData).forEach(([category, amount], i) => {
  const sliceAngle = (amount / total) * 2 * Math.PI;

  // Draw slice
  ctx.beginPath();
  ctx.arc(300, 300, 200, currentAngle, currentAngle + sliceAngle);
  ctx.lineTo(300, 300);
  ctx.fillStyle = colors[i % colors.length];
  ctx.fill();

  // Draw label
  const labelAngle = currentAngle + sliceAngle / 2;
  const labelX = 300 + Math.cos(labelAngle) * 250;
  const labelY = 300 + Math.sin(labelAngle) * 250;
  ctx.fillStyle = '#e6edf3';
  ctx.font = '14px Arial';
  ctx.fillText(
    `${category}: $${amount.toFixed(2)} (${((amount/total)*100).toFixed(1)}%)`,
    labelX, labelY
  );

  currentAngle += sliceAngle;
});
```

**Step 5**: Create artifact
```typescript
await create_block({
  note_id: current_note_id,
  type: "artifact",
  data: {
    title: "Expense Breakdown - Pie Chart",
    html: "<canvas id='chart' width='600' height='600'></canvas>",
    css: "body { background: #1a1a2e; display: flex; justify-content: center; align-items: center; min-height: 100vh; }",
    javascript: generatedCode
  }
});
```

**Step 6**: Confirm and explain
```
AI Response:
"I've created a pie chart showing your expense breakdown:

📊 Categories:
• Food: $1,450.50 (50.3%)
• Transport: $620.00 (21.5%)
• Entertainment: $380.00 (13.2%)
• Utilities: $250.00 (8.7%)
• Healthcare: $180.00 (6.2%)
• Other: $95.50 (0.3%)

Total spending: $2,976.00

The chart uses data from your 'Monthly Expenses' database (47 entries). Note: This is a snapshot - if you add more expenses, you can regenerate the chart to see updated numbers.

Would you like me to create additional visualizations, like a trend over time?"
```

**Key Rules**:
- ✅ Aggregate data before embedding (don't embed 1000 raw rows)
- ✅ Use appropriate chart type for data (categorical → pie/bar)
- ✅ Include percentages and totals in labels
- ✅ Explain that it's a snapshot (not live-updating)
- ✅ Offer related visualizations

---

### Pattern 4.2: Multi-Block Note Creation

**User Prompt**: *"Create a workout tracker note with a database and progress chart"*

**AI Expected Behavior**:

**Step 1**: Plan the workflow
```
AI Planning:
1. Create new note "Workout Tracker"
2. Add heading block
3. Create database with workout columns
4. Create artifact with progress chart (initially empty, will show trend when data is added)
5. Arrange blocks in logical layout
```

**Step 2**: Execute step-by-step

**2a. Create note**:
```typescript
const note = await create_note({
  title: "Workout Tracker",
  parent_id: null
});
```

**2b. Add heading**:
```typescript
const headingBlock = await create_block({
  note_id: note.id,
  type: "heading1",
  position: 0,
  data: {
    content: "💪 My Workout Progress"
  }
});
```

**2c. Create database**:
```typescript
const databaseBlock = await create_block({
  note_id: note.id,
  type: "database",
  position: 1,
  data: {
    title: "Workout Log",
    columns: [
      { name: "Date", type: "date" },
      { name: "Exercise", type: "select", options: ["Bench Press", "Squat", "Deadlift", "Pull-ups", "Rows"] },
      { name: "Weight (lbs)", type: "number" },
      { name: "Reps", type: "number" },
      { name: "Sets", type: "number" },
      { name: "Notes", type: "text" }
    ],
    rows: [
      // Add sample row to demonstrate
      {
        id: generateRowId(),
        data: {
          "col-1": new Date().toISOString(),
          "col-2": "Bench Press",
          "col-3": 135,
          "col-4": 10,
          "col-5": 3,
          "col-6": "Felt strong today!"
        }
      }
    ],
    view: "table",
    width: "full"
  }
});
```

**2d. Create progress chart**:
```typescript
const chartBlock = await create_block({
  note_id: note.id,
  type: "artifact",
  position: 2,
  data: {
    title: "Bench Press Progress Chart",
    html: `
      <div class="progress-container">
        <h2>Bench Press Progress</h2>
        <canvas id="chart" width="600" height="400"></canvas>
        <p class="hint">Add more workout entries to see your progress over time!</p>
      </div>
    `,
    css: `
      body {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-family: Arial, sans-serif;
        padding: 20px;
      }
      .progress-container {
        text-align: center;
      }
      .hint {
        margin-top: 20px;
        font-size: 14px;
        opacity: 0.8;
      }
    `,
    javascript: `
      // Sample data (will be replaced when user adds more entries)
      const workoutData = [
        { date: new Date().toISOString(), weight: 135 }
      ];

      const canvas = document.getElementById('chart');
      const ctx = canvas.getContext('2d');

      // Draw line chart
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.font = '12px Arial';

      // Simple visualization
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(50, 50, 500, 300);

      ctx.fillStyle = 'white';
      ctx.fillText('Weight Progress will appear here as you add entries', 150, 200);
      ctx.fillText('Current best: 135 lbs', 220, 220);
    `,
    width: "full"
  }
});
```

**Step 3**: Confirm completion
```
AI Response:
"I've created your Workout Tracker note! Here's what I set up:

📋 Workout Log Database:
• Date - when you worked out
• Exercise - Bench Press, Squat, Deadlift, Pull-ups, Rows
• Weight, Reps, Sets - your performance
• Notes - how you felt, any observations

📈 Progress Chart:
• Currently shows a sample entry (135 lbs bench press)
• Will automatically update when you add more workouts
• Tracks your strength progression over time

🎯 Next Steps:
1. Add your workout entries to the database
2. Watch your progress chart grow!
3. I can create additional charts for other exercises if you'd like

The note is ready - start logging your workouts!"
```

**Key Rules**:
- ✅ Create blocks in logical order (heading → database → visualizations)
- ✅ Include sample data to demonstrate functionality
- ✅ Add helpful hints/instructions in the UI
- ✅ Offer next steps and related features
- ✅ Use emoji for visual organization

---

## 5. Error Handling Patterns

### Pattern 5.1: Database Not Found

**User Prompt**: *"Show me a chart of my expenses"*

**Scenario**: No expense database exists in note

**AI Expected Behavior**:

**Step 1**: Search for database
```typescript
const expenseDb = blocks.find(b =>
  b.type === 'database' &&
  b.data.title.toLowerCase().includes('expense')
);
// Result: undefined
```

**Step 2**: Handle gracefully
```
AI Response:
"I couldn't find an expenses database in this note.

Would you like me to:
1. ✅ Create a new expense tracker database
2. 🔍 Search other notes for an expense database
3. 📊 Create a general spending tracker from scratch

Which would you prefer?"
```

**Key Rules**:
- ✅ Explain what's missing clearly
- ✅ Offer solutions, don't just say "error"
- ✅ Give user options
- ❌ Don't assume - ask for clarification

---

### Pattern 5.2: Missing Column

**User Prompt**: *"Show my expenses by category"*

**Scenario**: Expense database exists but has no "Category" column

**AI Expected Behavior**:

**Step 1**: Analyze database
```typescript
const hasCategory = expenseDb.data.columns.some(c =>
  c.name.toLowerCase() === 'category'
);
// Result: false
```

**Step 2**: Diagnose issue
```
AI Response:
"Your expense database doesn't have a 'Category' column yet, so I can't break down spending by category.

Current columns:
• Date
• Amount
• Description

I can help by:
1. ✅ Adding a 'Category' column (Food, Transport, Entertainment, etc.)
2. 📝 Helping you categorize existing entries
3. 📊 Creating a different chart (total spending over time?)

Would you like me to add the Category column?"
```

**Key Rules**:
- ✅ Show what columns DO exist
- ✅ Explain why the request can't be completed
- ✅ Offer to fix the issue
- ✅ Suggest alternatives

---

### Pattern 5.3: Empty Database

**User Prompt**: *"Create a chart of my workout progress"*

**Scenario**: Workout database exists but has 0 rows

**AI Expected Behavior**:

**Step 1**: Check row count
```typescript
const rowCount = workoutDb.data.rows.length;
// Result: 0
```

**Step 2**: Handle empty state
```
AI Response:
"Your Workout Log database is empty - no entries yet!

I can still create the progress chart, but it won't show any data until you add workout entries.

Options:
1. 📊 Create the chart now (it'll show 'No data yet' message)
2. 📝 Add some sample workout entries first
3. ⏸️ Wait until you've logged a few workouts

I recommend option 2 - I can add a few sample entries to demonstrate how it works, then you can replace them with real data. Sound good?"
```

**Key Rules**:
- ✅ Acknowledge the empty state
- ✅ Explain consequences (chart will be empty)
- ✅ Offer to add sample data
- ✅ Set expectations clearly

---

### Pattern 5.4: Type Mismatch

**User Prompt**: *"Sum up the totals in my database"*

**Scenario**: User wants to sum a text column

**AI Expected Behavior**:

**Step 1**: Identify target column
```typescript
// User says "totals" - ambiguous
// AI searches for number columns
const numberColumns = db.data.columns.filter(c => c.type === 'number');
// Result: found "Amount" column
```

**Step 2**: If ambiguous or wrong type:
```
AI Response:
"I found a 'Name' column, but that's text - I can't sum text values.

Did you mean:
• Amount ($) - sum of all monetary values?
• Quantity (#) - sum of all item counts?

Or perhaps you wanted to:
• Count how many entries you have? (Currently 23)
• Group by category and sum amounts?

Please clarify which operation you'd like!"
```

**Key Rules**:
- ✅ Explain type constraints (can't sum text)
- ✅ Suggest likely alternatives
- ✅ Provide current count as helpful info
- ❌ Don't make assumptions - ask

---

## 6. Edge Cases & Solutions

### Edge Case 6.1: Very Large Database

**Scenario**: Database with 10,000+ rows

**User Prompt**: *"Create a chart from my transaction history"*

**AI Solution**:

```
AI Response:
"Your transaction history has 10,247 entries - that's a lot of data!

To keep the chart readable and fast, I recommend:

1. 📅 Filter by time range (e.g., last 3 months)
2. 📊 Aggregate by category or month
3. 🔝 Show top 10 categories only

Would you like me to create a chart showing your top 10 spending categories for the last 3 months?"
```

**Implementation**:
```typescript
// Don't embed 10K rows - aggregate first
const last3Months = rows.filter(r => {
  const date = new Date(r.data[dateColumnId]);
  return (Date.now() - date.getTime()) < 90 * 24 * 60 * 60 * 1000;
});

const categoryTotals = aggregateByCategory(last3Months);
const top10 = Object.entries(categoryTotals)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10);

// Embed only top10, not all 10K rows
```

---

### Edge Case 6.2: Unicode/Emoji in Data

**Scenario**: Database has emoji in category names

**User Prompt**: Database with categories: "🍕 Food", "🚗 Transport"

**AI Solution**:

```javascript
// ✅ Preserve emoji in chart labels
const chartData = {
  "🍕 Food": 1450,
  "🚗 Transport": 620,
  "🎬 Entertainment": 380
};

// Ensure proper font supports emoji
ctx.font = '14px Arial, "Apple Color Emoji", "Segoe UI Emoji"';
ctx.fillText(`🍕 Food: $1,450`, x, y);
```

**Key Rules**:
- ✅ Preserve emoji/unicode characters
- ✅ Use emoji-compatible fonts
- ✅ Don't strip or replace special characters

---

### Edge Case 6.3: Null/Missing Values

**Scenario**: Database has rows with null amounts

**AI Solution**:

```typescript
// Filter out null values before aggregating
const validRows = rows.filter(row => {
  const amount = row.data[amountColumnId];
  return amount !== null && amount !== undefined && !isNaN(amount);
});

const total = validRows.reduce((sum, row) =>
  sum + row.data[amountColumnId], 0
);
```

```
AI Note in Chart:
"Chart shows 42 of 47 entries (5 entries had missing amounts)"
```

**Key Rules**:
- ✅ Filter out null/invalid values
- ✅ Inform user about excluded data
- ✅ Don't fail silently

---

## 7. Complete Workflow Examples

### Workflow 7.1: Student Creating Study Dashboard

**User**: *"Create a complete study dashboard with session tracking and analytics"*

**AI Execution**:

```
AI Planning Phase:
1. Create note "Study Dashboard"
2. Add title heading
3. Create database for study sessions
4. Create artifact: time by subject (pie chart)
5. Create artifact: study hours over time (line chart)
6. Create artifact: productivity stats (dashboard)
7. Arrange in grid layout

Estimated time: 15 seconds
Proceed? (yes/no)
```

**User**: *"yes"*

**AI Execution**:

```typescript
// Step 1: Create note
const note = await create_note({ title: "📚 Study Dashboard" });

// Step 2: Heading
await create_block({
  note_id: note.id,
  type: "heading1",
  position: 0,
  data: { content: "My Study Analytics", width: "full" }
});

// Step 3: Database
const dbBlock = await create_block({
  note_id: note.id,
  type: "database",
  position: 1,
  data: {
    title: "Study Sessions",
    columns: [
      { name: "Date", type: "date" },
      { name: "Subject", type: "select", options: ["Math", "Physics", "CS", "History", "Biology"] },
      { name: "Duration (hrs)", type: "number" },
      { name: "Quality", type: "select", options: ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"] },
      { name: "Notes", type: "text" }
    ],
    rows: [
      // Sample entry
      {
        id: generateRowId(),
        data: {
          "col-1": new Date().toISOString(),
          "col-2": "Math",
          "col-3": 2.5,
          "col-4": "⭐⭐⭐⭐",
          "col-5": "Worked on calculus - derivatives"
        }
      }
    ],
    view: "table",
    width: "full"
  }
});

// Step 4: Pie chart (time by subject)
await create_block({
  note_id: note.id,
  type: "artifact",
  position: 2,
  data: {
    title: "Time by Subject",
    html: "<canvas id='subjectChart' width='400' height='400'></canvas>",
    css: pieChartStyles,
    javascript: generatePieChartCode({
      data: { "Math": 2.5 }, // Sample data
      title: "Study Time by Subject"
    }),
    width: "half",
    alignment: "left"
  }
});

// Step 5: Line chart (hours over time)
await create_block({
  note_id: note.id,
  type: "artifact",
  position: 3,
  data: {
    title: "Study Hours Trend",
    html: "<canvas id='trendChart' width='400' height='400'></canvas>",
    css: lineChartStyles,
    javascript: generateLineChartCode({
      data: [{ date: new Date().toISOString(), hours: 2.5 }],
      title: "Study Hours Over Time"
    }),
    width: "half",
    alignment: "right"
  }
});

// Step 6: Stats dashboard
await create_block({
  note_id: note.id,
  type: "artifact",
  position: 4,
  data: {
    title: "Study Statistics",
    html: `
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Hours</h3>
          <p class="stat-value">2.5</p>
        </div>
        <div class="stat-card">
          <h3>Sessions</h3>
          <p class="stat-value">1</p>
        </div>
        <div class="stat-card">
          <h3>Avg Quality</h3>
          <p class="stat-value">⭐⭐⭐⭐</p>
        </div>
        <div class="stat-card">
          <h3>Streak</h3>
          <p class="stat-value">1 day</p>
        </div>
      </div>
    `,
    css: statsStyles,
    javascript: "// Stats update when database changes",
    width: "full"
  }
});
```

**AI Completion**:
```
✅ Study Dashboard created!

What I built:
📊 Study Sessions Database - log your study time
📈 3 Visualizations:
   • Pie chart: Time by subject
   • Line chart: Hours trend
   • Stats cards: Totals, averages, streaks

🎯 Next Steps:
1. Add your study sessions to the database
2. Watch your visualizations update
3. Track your progress over time

Pro tip: Set a daily study goal (e.g., 3 hours) and try to maintain a streak!
```

**Total Time**: ~8 seconds
**Blocks Created**: 6 (1 heading, 1 database, 4 artifacts)

---

### Workflow 7.2: Professional Creating Project Tracker

**User**: *"I need a project management dashboard for my team's tasks"*

**AI Execution**:

[Similar multi-step workflow with]
- Task database (Name, Assignee, Status, Priority, Due Date)
- Kanban board artifact (Todo/In Progress/Done columns)
- Burndown chart artifact
- Team workload pie chart

---

## 8. Testing Scenarios

### Test Suite 8.1: Database Operations

```typescript
describe('AI Database Understanding', () => {

  test('Should identify database schema correctly', async () => {
    const prompt = "What columns does my expense database have?";
    const response = await aiAgent.process(prompt);

    expect(response).toContain('Date');
    expect(response).toContain('Category');
    expect(response).toContain('Amount');
    expect(response).toContain('4 columns');
  });

  test('Should aggregate data correctly', async () => {
    const prompt = "How much did I spend on food?";
    const response = await aiAgent.process(prompt);

    expect(response).toMatch(/\$\d+\.\d{2}/); // Contains dollar amount
    expect(response).toContain('food'); // Mentions category
  });

  test('Should handle empty database', async () => {
    // Setup: Create empty database
    const emptyDb = await createTestDatabase({ rows: [] });

    const prompt = "Show my spending by category";
    const response = await aiAgent.process(prompt);

    expect(response).toContain('empty');
    expect(response).toContain('add entries'); // Suggests adding data
  });

  test('Should handle missing column', async () => {
    // Setup: Database without Category column
    const dbNoCat = await createTestDatabase({
      columns: [
        { name: 'Date', type: 'date' },
        { name: 'Amount', type: 'number' }
      ]
    });

    const prompt = "Break down by category";
    const response = await aiAgent.process(prompt);

    expect(response).toContain("doesn't have");
    expect(response).toContain('Category');
    expect(response).toContain('add'); // Offers to add column
  });
});
```

### Test Suite 8.2: Artifact Operations

```typescript
describe('AI Artifact Understanding', () => {

  test('Should generate working timer', async () => {
    const prompt = "Create a 25-minute timer";
    const artifactBlock = await aiAgent.process(prompt);

    expect(artifactBlock.type).toBe('artifact');
    expect(artifactBlock.data.javascript).toContain('setInterval');
    expect(artifactBlock.data.javascript).toContain('25');

    // Test execution
    const works = await testArtifactExecution(artifactBlock);
    expect(works).toBe(true);
  });

  test('Should fix timer bug', async () => {
    // Setup: Buggy timer
    const buggyTimer = await createBuggyTimer();

    const prompt = "Fix the timer, pause button doesn't work";
    const fixed = await aiAgent.process(prompt);

    expect(fixed.data.javascript).toContain('interval ='); // Stores interval
    expect(fixed.data.javascript).toContain('clearInterval');
  });

  test('Should customize timer duration', async () => {
    const timer25 = await createTimer(25);

    const prompt = "Change timer to 30 minutes";
    const timer30 = await aiAgent.process(prompt);

    expect(timer30.data.javascript).toContain('30');
    expect(timer30.data.javascript).not.toContain('25');
    expect(timer30.data.title).toContain('30');
  });
});
```

### Test Suite 8.3: Database-Artifact Integration

```typescript
describe('AI Database-Artifact Integration', () => {

  test('Should create chart from database', async () => {
    // Setup: Expense database with data
    const expenseDb = await createTestDatabase({
      title: 'Expenses',
      columns: [
        { name: 'Category', type: 'select', options: ['Food', 'Transport'] },
        { name: 'Amount', type: 'number' }
      ],
      rows: [
        { data: { 'col-1': 'Food', 'col-2': 100 } },
        { data: { 'col-1': 'Transport', 'col-2': 50 } }
      ]
    });

    const prompt = "Create pie chart of expenses by category";
    const chartBlock = await aiAgent.process(prompt);

    expect(chartBlock.type).toBe('artifact');
    expect(chartBlock.data.javascript).toContain('Food');
    expect(chartBlock.data.javascript).toContain('100');
    expect(chartBlock.data.javascript).toContain('Transport');
    expect(chartBlock.data.javascript).toContain('50');
  });

  test('Should create multi-block workflow', async () => {
    const prompt = "Create workout tracker with database and progress chart";
    const result = await aiAgent.process(prompt);

    expect(result.note).toBeDefined();
    expect(result.blocks).toHaveLength(4); // Heading, DB, Chart, Instructions

    const dbBlock = result.blocks.find(b => b.type === 'database');
    const chartBlock = result.blocks.find(b => b.type === 'artifact');

    expect(dbBlock.data.title).toContain('Workout');
    expect(chartBlock.data.title).toContain('Progress');
  });

  test('Should handle database update in chart', async () => {
    // Setup: Chart linked to database
    const db = await createTestDatabase({ /* ... */ });
    const chart = await createChartFromDatabase(db.id);

    // User adds row to database
    await addRowToDatabase(db.id, { category: 'New Category', amount: 200 });

    // Regenerate chart
    const prompt = "Update chart with new data";
    const updatedChart = await aiAgent.process(prompt);

    expect(updatedChart.data.javascript).toContain('New Category');
    expect(updatedChart.data.javascript).toContain('200');
  });
});
```

---

## Conclusion

This document provides comprehensive patterns for how AI should understand and manipulate databases and artifacts. Key takeaways:

### For Phase 1 (AI Database Understanding):
- AI must parse schemas correctly
- AI must aggregate data intelligently
- AI must handle errors gracefully (missing columns, empty data)
- AI must infer user intent from natural language

### For Phase 2 (AI Artifact Understanding):
- AI must generate working code from templates
- AI must debug and fix errors systematically
- AI must make targeted changes without breaking functionality
- AI must explain changes clearly

### For Phase 3 (Database-Artifact Integration):
- AI acts as bridge between databases and artifacts
- Data is embedded as snapshots (not live-updating in MVP)
- AI aggregates before embedding (performance + readability)
- AI creates complete multi-block workflows autonomously

### For Testing:
- Every pattern should have a test case
- Test both happy path and edge cases
- Validate AI explanations, not just code output
- Ensure error handling is user-friendly

---

**Status**: Phase 0 Complete ✅

**Next**: Begin Phase 1 Implementation (AI Database Understanding)

**Estimated Timeline**: 2 weeks for Phase 1, 6 weeks total for MVP (Phases 1-3)

---

**Document Version**: 1.0
**Last Updated**: 2025-01-15
**Total Patterns Documented**: 23
**Test Scenarios**: 11
