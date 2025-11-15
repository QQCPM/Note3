# Database Structure - Deep Analysis
## Phase 0, Day 1: Complete Understanding of DatabaseBlock System

**Date:** 2025-01-15
**Purpose:** Document every aspect of how databases work in Weave for AI training

---

## 1. Data Storage Architecture

### 1.1 Block Data Structure

```typescript
interface DatabaseBlockData {
  type: 'database';
  title: string;                              // User-editable title
  columns: DatabaseColumn[];                  // Schema definition
  rows: DatabaseRowData[];                    // Actual data
  view: 'table' | 'gallery' | 'calendar';    // Display mode

  // Inherited from BlockLayout:
  width?: 'full' | 'half' | 'third' | 'quarter' | number;
  alignment?: 'left' | 'center' | 'right';
}
```

**Storage Location:** SQLite database, blocks table, `data` column as JSON string

**Example in Database:**
```json
{
  "type": "database",
  "title": "Project Tracker",
  "columns": [
    {
      "id": "col_abc123",
      "name": "Task",
      "type": "text",
      "width": 200
    },
    {
      "id": "col_def456",
      "name": "Status",
      "type": "select",
      "options": ["Todo", "In Progress", "Done"],
      "width": 150
    }
  ],
  "rows": [
    {
      "id": "row_xyz789",
      "data": {
        "col_abc123": "Implement feature X",
        "col_def456": "In Progress"
      }
    }
  ],
  "view": "table"
}
```

### 1.2 Row Data Structure

**Key Insight:** Rows use column IDs as keys, NOT column names!

```typescript
interface DatabaseRowData {
  id: string;                    // UUID v4 (nanoid)
  data: Record<string, any>;     // columnId -> value mapping
}
```

**Why IDs instead of names?**
- Allows column renaming without data migration
- Prevents naming conflicts
- Efficient lookups

**Example Row:**
```typescript
{
  id: "row_xyz789",
  data: {
    "col_abc123": "Task description",  // col_abc123 = "Task" column
    "col_def456": "Done",               // col_def456 = "Status" column
    "col_ghi012": 5                     // col_ghi012 = "Priority" column
  }
}
```

### 1.3 Column Definition Structure

```typescript
interface DatabaseColumn {
  id: string;                    // UUID v4 (nanoid)
  name: string;                  // User-visible column name
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  options?: string[];            // Only for select type
  width?: number;                // Column width in pixels (default: 150)
}
```

---

## 2. Column Types - Complete Specification

### 2.1 TEXT Column

**Purpose:** Free-form text input

**Data Type:** `string`

**Default Value:** `""` (empty string)

**Validation:** None (accepts any string)

**Editor:** `TextCellEditor` - Single-line input field

**Display:** Plain text, truncated if too long

**Use Cases:**
- Names, descriptions, notes
- URLs, emails
- Short text fields

**Example:**
```typescript
{
  id: "col_1",
  name: "Description",
  type: "text"
}
```

### 2.2 NUMBER Column

**Purpose:** Numeric data (integers or decimals)

**Data Type:** `number | null`

**Default Value:** `null`

**Validation:** Parsed with `parseFloat()`, `NaN` becomes `null`

**Editor:** `NumberCellEditor` - HTML number input with `step="any"`

**Display:** Formatted with `toLocaleString()` (adds commas)

**Use Cases:**
- Counts, quantities
- Prices, amounts
- Ratings, scores
- Measurements

**Example:**
```typescript
{
  id: "col_2",
  name: "Price",
  type: "number"
}
// Value: 1234.56 → Display: "1,234.56"
```

### 2.3 DATE Column

**Purpose:** Calendar dates

**Data Type:** `string | null` (ISO date format: "YYYY-MM-DD")

**Default Value:** `null`

**Validation:** Must be valid date string

**Editor:** `DateCellEditor` - HTML date picker

**Display:** Formatted with `toLocaleDateString()` (locale-specific)

**Use Cases:**
- Due dates, deadlines
- Birth dates, anniversaries
- Created/updated timestamps
- Event dates

**Example:**
```typescript
{
  id: "col_3",
  name: "Due Date",
  type: "date"
}
// Value: "2025-01-15" → Display: "1/15/2025" (US locale)
```

### 2.4 SELECT Column

**Purpose:** Choose from predefined options (dropdown)

**Data Type:** `string`

**Default Value:** `""` (empty string)

**Validation:** Should be one of `options[]`, but not enforced

**Editor:** `SelectCellEditor` - HTML select dropdown

**Display:** Styled tag/chip with color coding

**Special Feature:** Auto-color mapping for common values
- "Todo" → Gray
- "In Progress" → Yellow
- "Done"/"Complete" → Green
- "High" → Red
- "Medium" → Yellow
- "Low" → Blue

**Use Cases:**
- Status (Todo, In Progress, Done)
- Priority (Low, Medium, High)
- Category, Type, Genre
- Any enum/categorical data

**Example:**
```typescript
{
  id: "col_4",
  name: "Status",
  type: "select",
  options: ["Todo", "In Progress", "Done", "Cancelled"]
}
```

**Important:** Options can be updated, added, or removed without data migration

### 2.5 CHECKBOX Column

**Purpose:** Boolean true/false toggle

**Data Type:** `boolean`

**Default Value:** `false`

**Validation:** Coerced to boolean (falsy → false, truthy → true)

**Editor:** `CheckboxCellEditor` - HTML checkbox, always editable (no edit mode)

**Display:** Checked or unchecked checkbox

**Use Cases:**
- Completion status (Done / Not Done)
- Yes/No questions
- Flags, toggles
- Boolean properties

**Example:**
```typescript
{
  id: "col_5",
  name: "Completed",
  type: "checkbox"
}
```

**UI Behavior:** Unlike other types, checkbox doesn't require clicking to enter "edit mode" - it's always interactive.

---

## 3. Operations - Complete Specification

### 3.1 Row Operations

#### createEmptyRow(columns: DatabaseColumn[]): DatabaseRowData

**Purpose:** Create new row with default values for all columns

**Logic:**
```typescript
For each column:
  - text: "" (empty string)
  - number: null
  - date: null
  - select: "" (empty string)
  - checkbox: false

Generate nanoid() for row.id
```

**Example:**
```typescript
const newRow = createEmptyRow(columns);
// Result:
{
  id: "V1StGXR8_Z5jdHi6B-myT",
  data: {
    "col_text_1": "",
    "col_number_1": null,
    "col_date_1": null,
    "col_select_1": "",
    "col_checkbox_1": false
  }
}
```

#### updateCellValue(row, columnId, value): DatabaseRowData

**Purpose:** Update single cell, returns new row (immutable)

**Logic:**
```typescript
{
  ...row,
  data: {
    ...row.data,
    [columnId]: value  // Override specific column
  }
}
```

**Example:**
```typescript
const updated = updateCellValue(row, "col_abc123", "New value");
```

#### deleteRow(rows, rowId): DatabaseRowData[]

**Purpose:** Remove row from array

**Logic:** `rows.filter(row => row.id !== rowId)`

**Example:**
```typescript
const newRows = deleteRow(data.rows, "row_xyz789");
```

### 3.2 Column Operations

#### createColumn(name, type, options?): DatabaseColumn

**Purpose:** Create new column definition

**Logic:**
```typescript
{
  id: nanoid(),
  name,
  type,
  options,   // Only for select type
  width: undefined  // Will default to 150px in UI
}
```

**Example:**
```typescript
const statusCol = createColumn("Status", "select", ["Todo", "Done"]);
```

**Important:** When adding column to existing database, must also:
1. Add column to `columns` array
2. Initialize column value in ALL existing rows

```typescript
// Example: Adding "Priority" column
const newColumn = createColumn("Priority", "select", ["Low", "High"]);

const updatedRows = data.rows.map(row => ({
  ...row,
  data: {
    ...row.data,
    [newColumn.id]: ""  // Default value for select
  }
}));

await saveDatabase({
  columns: [...data.columns, newColumn],
  rows: updatedRows
});
```

#### deleteColumn(columns, rows, columnId)

**Purpose:** Remove column AND its data from all rows

**Logic:**
```typescript
1. Remove from columns array
2. For each row, delete data[columnId]
```

**Returns:** `{ columns: DatabaseColumn[], rows: DatabaseRowData[] }`

**Example:**
```typescript
const { columns: newCols, rows: newRows } = deleteColumn(
  data.columns,
  data.rows,
  "col_to_delete"
);
```

**Warning:** This is destructive! Data is permanently lost.

#### updateColumn(columns, columnId, updates)

**Purpose:** Update column metadata (name, type, options)

**Common Use Cases:**
- Rename column: `{ name: "New Name" }`
- Add options: `{ options: ["Opt1", "Opt2", "Opt3"] }`
- Change width: `{ width: 250 }`

**Example:**
```typescript
const newColumns = updateColumn(data.columns, "col_abc", { name: "Task Name" });
```

**Note:** Changing column type is NOT implemented (would require data migration)

#### reorderColumns(columns, fromIndex, toIndex)

**Purpose:** Change column order (drag-and-drop)

**Logic:** Array splice - remove from fromIndex, insert at toIndex

**Example:**
```typescript
// Move column from position 0 to position 2
const reordered = reorderColumns(columns, 0, 2);
```

---

## 4. Advanced Features

### 4.1 Sorting

**State:** `sortColumn: string | null`, `sortDirection: 'asc' | 'desc'`

**Logic:** Sort rows by column value, type-aware

**Type-Specific Sorting:**
- **text/select:** Lexicographic (localeCompare)
- **number:** Numeric comparison (handles null as -Infinity)
- **date:** Timestamp comparison (Date.getTime())
- **checkbox:** Boolean comparison (false < true)

**Example:**
```typescript
// Sorting by number column, ascending
rows.sort((a, b) => {
  const aValue = a.data[columnId] ?? 0;
  const bValue = b.data[columnId] ?? 0;
  return aValue - bValue;  // Ascending
});
```

### 4.2 Filtering

**State:** `filterText: string`

**Logic:** Full-text search across ALL text columns

**Implementation:**
```typescript
if (filterText.trim()) {
  const lowerQuery = filterText.toLowerCase();
  rows = rows.filter(row => {
    return columns.some(col => {
      const value = row.data[col.id];
      return value?.toString().toLowerCase().includes(lowerQuery);
    });
  });
}
```

**UI Feedback:** Shows "X of Y rows" when filter active

### 4.3 Drag-and-Drop Columns

**Library:** `@dnd-kit/core` and `@dnd-kit/sortable`

**Behavior:** User can drag column headers to reorder

**Constraints:**
- Cannot drag into "Add Column" slot
- Visual feedback: opacity 0.5 while dragging
- Minimum distance: 8px to prevent accidental drags

### 4.4 Views

**Three Views:**

1. **Table View** (default)
   - Traditional spreadsheet layout
   - All columns visible
   - Supports sorting, filtering, inline editing
   - Best for: Dense data, many columns

2. **Gallery View**
   - Card-based layout
   - First column as title, others as properties
   - Visual, spatial organization
   - Best for: Items with images, visual content

3. **Calendar View**
   - Calendar grid (month view)
   - Requires at least one date column
   - Shows items on their dates
   - Best for: Events, deadlines, schedules

**View Persistence:** Saved in `block.data.view`

---

## 5. AI-Ready Utilities

**These functions in DatabaseUtils.ts are specifically designed for AI analysis:**

### 5.1 calculateColumnStats(rows, columnId)

**Purpose:** Statistical analysis of number columns

**Returns:**
```typescript
{
  count: number;      // Non-null values
  sum: number;        // Total
  avg: number;        // Mean
  min: number;        // Minimum value
  max: number;        // Maximum value
  nullCount: number;  // Number of null values
}
```

**Use Case:** AI can analyze "What's my average rating?" or "Total spent?"

### 5.2 getValueDistribution(rows, columnId)

**Purpose:** Frequency distribution for categorical data

**Returns:**
```typescript
Record<string, number>  // value -> count mapping
```

**Example:**
```typescript
{
  "Todo": 5,
  "In Progress": 3,
  "Done": 12,
  "(empty)": 2
}
```

**Use Case:** AI can answer "How many tasks are done?" or "What's the most common genre?"

### 5.3 getDateRange(rows, columnId)

**Purpose:** Temporal analysis of date columns

**Returns:**
```typescript
{
  earliest: Date | null;
  latest: Date | null;
  span: number;  // Days between earliest and latest
}
```

**Use Case:** AI can determine "What's the date range of events?" or "How long is this project?"

### 5.4 countMatchingRows(rows, columnId, condition)

**Purpose:** Count rows matching custom condition

**Example:**
```typescript
// Count completed tasks
const completedCount = countMatchingRows(
  rows,
  checkboxColId,
  value => value === true
);

// Count high priority items
const highPriorityCount = countMatchingRows(
  rows,
  priorityColId,
  value => value === "High"
);
```

### 5.5 exportForAI(dbData): AI-Consumable Format

**Purpose:** Convert database to clean format for AI processing

**Output Structure:**
```typescript
{
  schema: {
    title: "Project Tracker",
    columns: [
      { name: "Task", type: "text" },
      { name: "Status", type: "select", options: ["..."] },
      { name: "Priority", type: "select", options: ["..."] }
    ]
  },

  data: [
    { Task: "Implement feature", Status: "Done", Priority: "High" },
    { Task: "Fix bug", Status: "Todo", Priority: "Low" }
  ],

  statistics: {
    Task: {
      distribution: { "Implement feature": 1, "Fix bug": 1 }
    },
    Status: {
      distribution: { "Done": 1, "Todo": 1 }
    },
    Priority: {
      distribution: { "High": 1, "Low": 1 }
    }
  }
}
```

**Key Transform:** Uses column **names** instead of IDs (AI-friendly)

---

## 6. Constraints & Edge Cases

### 6.1 Data Integrity Constraints

**Enforced:**
- ✅ Each row must have unique ID
- ✅ Each column must have unique ID
- ✅ Each row.data must be an object
- ✅ Row data must have entry for each column (initialized on column add)

**Not Enforced (but should be):**
- ⚠️ Select values should match options[] (currently not validated)
- ⚠️ Number values could be Infinity or NaN (handled but not prevented)
- ⚠️ Date strings could be invalid (not validated at input)

### 6.2 Edge Cases

**Empty Database:**
```typescript
{
  title: "Untitled Database",
  columns: [],
  rows: [],
  view: "table"
}
```
**Behavior:** Shows "No columns yet" and "Add Column" button

**Database with Columns but No Rows:**
```typescript
{
  title: "My Database",
  columns: [{ id: "col_1", name: "Name", type: "text" }],
  rows: [],
  view: "table"
}
```
**Behavior:** Shows table header with "No rows yet" message and "Add Row" button

**Row with Missing Column Data:**
```typescript
// If column "col_new" added but old row not updated
{
  id: "row_old",
  data: {
    "col_old": "value"
    // Missing "col_new"!
  }
}
```
**Behavior:** Row validation catches this, initializes missing columns

**Deleted Column Data Still in Row:**
```typescript
// After deleting column "col_deleted"
{
  id: "row_1",
  data: {
    "col_deleted": "orphaned data",  // Will never be displayed
    "col_active": "visible data"
  }
}
```
**Behavior:** Ignored by UI (columns array determines what's displayed)

### 6.3 Limits

**Practical Limits (not enforced in code):**
- Max columns: ~50 (UI becomes unwieldy beyond this)
- Max rows: ~10,000 (performance degrades with sorting/filtering)
- Max cell value length: ~5,000 characters (UI truncates display)
- Max column name length: ~50 characters

**ID Format:**
- Column IDs: nanoid() → 21 characters, URL-safe
- Row IDs: nanoid() → 21 characters, URL-safe

---

## 7. Database Use Case Patterns

### 7.1 Common Patterns (AI Training Data)

#### Pattern: **Task/Project Tracker**
```typescript
{
  title: "Project Tasks",
  columns: [
    { name: "Task", type: "text" },                        // What needs to be done
    { name: "Status", type: "select", options: ["Todo", "In Progress", "Done"] },
    { name: "Priority", type: "select", options: ["Low", "Medium", "High"] },
    { name: "Due Date", type: "date" },
    { name: "Assignee", type: "text" },
    { name: "Completed", type: "checkbox" }
  ]
}
```

**Recognition Signals:** Task, Status, Priority, Due Date, Assignee, Done, Complete

#### Pattern: **Book/Movie Library**
```typescript
{
  title: "Book Collection",
  columns: [
    { name: "Title", type: "text" },
    { name: "Author", type: "text" },
    { name: "Genre", type: "select", options: ["Fiction", "Non-Fiction", "Mystery", "Sci-Fi"] },
    { name: "Year Published", type: "number" },
    { name: "Rating", type: "number" },          // 1-5 stars
    { name: "Read", type: "checkbox" },
    { name: "Notes", type: "text" }
  ]
}
```

**Recognition Signals:** Title, Author, Genre, Rating, Read, Watched, Year

#### Pattern: **Habit Tracker**
```typescript
{
  title: "Daily Habits",
  columns: [
    { name: "Habit", type: "text" },
    { name: "Date", type: "date" },
    { name: "Completed", type: "checkbox" },
    { name: "Notes", type: "text" }
  ]
}
```

**Recognition Signals:** Habit, Daily, Date, Completed, Streak

#### Pattern: **Contact List**
```typescript
{
  title: "Contacts",
  columns: [
    { name: "Name", type: "text" },
    { name: "Email", type: "text" },
    { name: "Phone", type: "text" },
    { name: "Company", type: "text" },
    { name: "Category", type: "select", options: ["Friend", "Family", "Work", "Other"] },
    { name: "Birthday", type: "date" }
  ]
}
```

**Recognition Signals:** Name, Email, Phone, Contact, Birthday

#### Pattern: **Workout/Exercise Log**
```typescript
{
  title: "Workout Log",
  columns: [
    { name: "Exercise", type: "text" },
    { name: "Date", type: "date" },
    { name: "Sets", type: "number" },
    { name: "Reps", type: "number" },
    { name: "Weight (lbs)", type: "number" },
    { name: "Notes", type: "text" }
  ]
}
```

**Recognition Signals:** Exercise, Workout, Sets, Reps, Weight, Distance, Duration

#### Pattern: **Expense Tracker**
```typescript
{
  title: "Expenses",
  columns: [
    { name: "Description", type: "text" },
    { name: "Date", type: "date" },
    { name: "Amount", type: "number" },
    { name: "Category", type: "select", options: ["Food", "Transport", "Entertainment", "Bills"] },
    { name: "Payment Method", type: "select", options: ["Cash", "Credit Card", "Debit Card"] }
  ]
}
```

**Recognition Signals:** Expense, Amount, Cost, Price, Category, Date, Payment

#### Pattern: **Course/Learning Tracker**
```typescript
{
  title: "Courses",
  columns: [
    { name: "Course Name", type: "text" },
    { name: "Platform", type: "select", options: ["Coursera", "Udemy", "edX", "Other"] },
    { name: "Status", type: "select", options: ["Not Started", "In Progress", "Completed"] },
    { name: "Progress %", type: "number" },
    { name: "Start Date", type: "date" },
    { name: "Completion Date", type: "date" },
    { name: "Rating", type: "number" }
  ]
}
```

**Recognition Signals:** Course, Class, Learning, Progress, Completion, Platform

---

## 8. Type Inference Rules (For AI Schema Analysis)

**When AI sees data, it should infer types:**

### 8.1 Inference from Column Names

**Date Indicators:**
- Contains: "date", "when", "deadline", "due", "birthday", "start", "end", "created", "updated"
- → Suggest `type: "date"`

**Number Indicators:**
- Contains: "number", "amount", "quantity", "count", "price", "cost", "rating", "score", "age", "year", "total", "sum"
- Or: "#", "$", "qty"
- → Suggest `type: "number"`

**Boolean/Checkbox Indicators:**
- Contains: "is", "has", "done", "complete", "completed", "finished", "active", "enabled"
- Or: Ends with "?"
- → Suggest `type: "checkbox"`

**Select Indicators:**
- Contains: "status", "priority", "category", "type", "genre", "level"
- → Suggest `type: "select"` with common options

**Default:**
- → `type: "text"`

### 8.2 Inference from Data Values

**If sample values are:**
- All numbers → `type: "number"`
- All valid dates → `type: "date"`
- All true/false → `type: "checkbox"`
- Limited set (< 10 unique values) → `type: "select"` with values as options
- Everything else → `type: "text"`

### 8.3 Inference from Context

**User says "book collection":**
- Expect: Title (text), Author (text), Genre (select), Year (number), Rating (number), Read (checkbox)

**User says "project tracker":**
- Expect: Task (text), Status (select), Priority (select), Due Date (date), Assignee (text)

**User says "habit tracker":**
- Expect: Habit (text), Date (date), Completed (checkbox)

---

## 9. Validation Rules (For AI Database Generation)

**AI should follow these rules when generating schemas:**

### 9.1 Column Name Rules

✅ **Good Column Names:**
- Clear, descriptive (e.g., "Task Name" not "Task")
- Proper capitalization
- No special characters except spaces, parentheses, numbers
- Examples: "Description", "Due Date", "Rating (1-5)", "Status"

❌ **Bad Column Names:**
- Too short: "T", "D", "S"
- Technical: "col_1", "task_id", "value"
- Symbols: "Task!", "Date#", "Status*"

### 9.2 Column Type Selection

**Use TEXT when:**
- Freeform input (descriptions, names, notes)
- URLs, emails, phone numbers
- IDs, codes (if not numeric)

**Use NUMBER when:**
- Quantities, counts
- Prices, amounts
- Ratings, scores (but consider select for 1-5 scale)
- Years (but consider date for full dates)
- Measurements

**Use DATE when:**
- Calendar dates
- Deadlines, due dates
- Birthdays, anniversaries
- Created/modified timestamps

**Use SELECT when:**
- Limited, predefined options (< 20 options)
- Status fields (Todo/Done)
- Priority fields (Low/Medium/High)
- Categories, genres
- Yes/No questions (but consider checkbox)

**Use CHECKBOX when:**
- True/False, Yes/No
- Completion status
- Flags, toggles
- Binary properties

### 9.3 Options for SELECT Type

**For Status:** ["Todo", "In Progress", "Done"]
- Alternative: ["Not Started", "In Progress", "Complete"]
- Alternative: ["Backlog", "Todo", "Doing", "Done"]

**For Priority:** ["Low", "Medium", "High"]
- Alternative: ["P1", "P2", "P3", "P4"]
- Alternative: ["🔴 High", "🟡 Medium", "🟢 Low"] (with emojis!)

**For Common Categories:**
- Books: ["Fiction", "Non-Fiction", "Mystery", "Sci-Fi", "Biography", "Other"]
- Movies: ["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "Documentary"]
- Expenses: ["Food", "Transport", "Entertainment", "Bills", "Health", "Other"]

### 9.4 Column Order Rules

**Best Practice Order:**
1. Primary identifier (Title, Name, Task)
2. Status/Category (if applicable)
3. Important metadata (Priority, Due Date)
4. Descriptive fields (Notes, Description)
5. Completion indicator (Done checkbox)

**Example Good Order:**
1. Task Name (text)
2. Status (select)
3. Priority (select)
4. Due Date (date)
5. Assignee (text)
6. Notes (text)
7. Completed (checkbox)

### 9.5 Row Count for Examples

**AI should always include 1-3 example rows when generating database**

**Good Examples:**
- Show variety in column values
- Demonstrate different statuses/priorities
- Use realistic data

**Example Rows for Project Tracker:**
```typescript
rows: [
  {
    "Task": "Design mockups",
    "Status": "Done",
    "Priority": "High",
    "Due Date": "2025-01-10",
    "Assignee": "Alice"
  },
  {
    "Task": "Implement API",
    "Status": "In Progress",
    "Priority": "High",
    "Due Date": "2025-01-20",
    "Assignee": "Bob"
  },
  {
    "Task": "Write tests",
    "Status": "Todo",
    "Priority": "Medium",
    "Due Date": "2025-01-25",
    "Assignee": "Alice"
  }
]
```

---

## 10. Summary for AI Training

### What AI Needs to Understand

1. **Structure:** Databases have title, columns (schema), rows (data), view mode
2. **Column Types:** 5 types with different validators, editors, displays
3. **Data Storage:** Column IDs map to values in each row
4. **Operations:** Can add/remove/edit rows and columns
5. **Features:** Sorting, filtering, multiple views
6. **Patterns:** Recognize common use cases (tracker, library, log, list)
7. **Inference:** Suggest appropriate types based on names and context
8. **Validation:** Follow rules for good schema design

### Key Insights for AI Editing

**When user asks to edit database:**
1. Read current schema first (analyze_database_schema)
2. Understand column types and relationships
3. Infer use case from column names and data
4. Make appropriate changes (right type for new column, sensible options)
5. Preserve data integrity (don't accidentally delete columns)

**When user asks to create database:**
1. Infer use case from request
2. Choose appropriate column names and types
3. Add sensible options for select columns
4. Order columns logically
5. Include 1-3 example rows
6. Choose appropriate default view

### Common Mistakes to Avoid

❌ Using column names instead of column IDs in row data
❌ Forgetting to initialize new column in existing rows
❌ Making everything text type
❌ Not providing options for select columns
❌ Creating databases with no example rows
❌ Using technical names instead of user-friendly names

---

**End of Database Deep Analysis**
**Total Lines of Code Analyzed:** ~1,100
**Total Functions Documented:** 15+
**Ready for:** Phase 1 implementation (AI database intelligence)
