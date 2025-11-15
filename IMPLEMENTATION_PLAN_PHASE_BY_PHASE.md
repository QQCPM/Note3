# AI Agent Implementation Plan - Phase by Phase
## Careful Step-by-Step Integration for Autonomous Database & Artifact AI

**Date:** 2025-01-15
**Focus:** Making AI truly understand and automatically create/edit databases and artifacts
**Approach:** Incremental, tested, safe progression

---

## Core Philosophy

**The Goal:** AI should deeply understand:
1. **Database structures** - What columns mean, what data types fit, how rows relate
2. **Artifact code** - What HTML/CSS/JS does, how to modify it correctly
3. **The connection** - How databases and artifacts work together in a note
4. **Autonomy** - Create complete, working systems automatically

**The Approach:** Build understanding layer by layer, test thoroughly, then integrate.

---

## Phase 0: Foundation Analysis (Week 0 - Preparation)

### Goal
Understand exactly what we have and what we need to add.

### Tasks

#### Day 1: Deep Database Understanding

**Objective:** Map out how databases currently work in the system.

```bash
# Files to analyze deeply
src/components/Blocks/DatabaseBlock.tsx
src/components/Blocks/Database/CellEditors.tsx
src/components/Blocks/Database/DatabaseUtils.ts
src/types/block.ts (DatabaseBlockData interface)
```

**Questions to Answer:**
1. What are all the column types? (text, number, date, select, checkbox)
2. How is database data structured in the block?
3. How are rows created/updated/deleted?
4. How are columns added/removed?
5. What validations exist?
6. What are the edge cases?

**Document:**
```typescript
// Create: docs/DATABASE_STRUCTURE_ANALYSIS.md

interface DatabaseStructure {
  storage: {
    format: "JSON in block.data field",
    schema: {
      title: string,
      columns: DatabaseColumn[],
      rows: DatabaseRowData[],
      view: 'table' | 'gallery' | 'calendar'
    }
  },

  columnTypes: {
    text: { validation: "any string", editor: "TextCellEditor" },
    number: { validation: "numeric only", editor: "NumberCellEditor" },
    date: { validation: "ISO date string", editor: "DateCellEditor" },
    select: { validation: "one of options[]", editor: "SelectCellEditor" },
    checkbox: { validation: "boolean", editor: "CheckboxCellEditor" }
  },

  operations: {
    createRow: "createEmptyRow() in DatabaseUtils",
    updateCell: "updateCellValue(rowId, columnId, value)",
    deleteRow: "deleteRow(rowId)",
    addColumn: "createColumn(name, type, options?)",
    deleteColumn: "deleteColumn(columnId)",
    reorderColumns: "reorderColumns(columnOrder[])"
  },

  constraints: {
    minColumns: 1,
    maxColumns: 50, // reasonable limit
    rowIdFormat: "UUID v4",
    columnIdFormat: "UUID v4"
  }
}
```

#### Day 2: Deep Artifact Understanding

**Objective:** Map out how artifacts currently work.

```bash
# Files to analyze deeply
src/components/Blocks/ArtifactBlock.tsx
src/types/block.ts (ArtifactBlockData interface)
```

**Questions to Answer:**
1. How is artifact code stored? (separate html/css/javascript fields)
2. How is code executed? (iframe with srcdoc)
3. What security measures exist? (CSP, try-catch, sandboxing)
4. How is code edited? (combined editor or separate?)
5. What are common artifact patterns? (timers, calculators, visualizations)

**Document:**
```typescript
// Create: docs/ARTIFACT_STRUCTURE_ANALYSIS.md

interface ArtifactStructure {
  storage: {
    format: "JSON in block.data field",
    schema: {
      title: string,
      html: string,
      css: string,
      javascript: string,
      prompt?: string, // Original AI prompt
      customWidth?: number,
      customHeight?: number
    }
  },

  execution: {
    method: "iframe with srcdoc",
    security: [
      "Content-Security-Policy in iframe",
      "No external script loading",
      "Try-catch wrapper around user JS",
      "No access to parent document"
    ],
    lifecycle: "Reconstructed on every data change"
  },

  commonPatterns: {
    timers: {
      structure: "HTML: display, CSS: styling, JS: countdown logic",
      libraries: "None (vanilla JS)",
      events: "setInterval, setTimeout"
    },
    calculators: {
      structure: "HTML: inputs/buttons, CSS: layout, JS: computation",
      validation: "Input validation in JS",
      display: "Update DOM on calculation"
    },
    visualizations: {
      structure: "HTML: canvas/svg, CSS: sizing, JS: drawing logic",
      dataFlow: "Hardcoded data or user input",
      rendering: "Canvas API or SVG manipulation"
    }
  },

  editPatterns: {
    bugFixes: "Modify specific JS function",
    featureAddition: "Add new HTML elements + JS handlers",
    styleChanges: "Modify CSS properties",
    refactoring: "Restructure code while maintaining functionality"
  }
}
```

#### Day 3: Connection Point Analysis

**Objective:** Understand how databases and artifacts COULD interact.

**Potential Connections:**
1. Artifact reads data from database → Display data visually
2. Artifact writes data to database → Interactive data entry
3. Database triggers artifact → Data-driven visualizations
4. Shared state → Both update together

**Document Use Cases:**
```typescript
// Create: docs/DATABASE_ARTIFACT_CONNECTIONS.md

interface ConnectionPatterns {
  pattern1_ArtifactReadsDatabase: {
    example: "Chart artifact displaying database rows",
    flow: "Database (data source) → Artifact (visualization)",
    implementation: {
      challenge: "How does artifact access database data?",
      solution_current: "Manual copy-paste",
      solution_ai: "AI generates artifact with embedded data from database"
    }
  },

  pattern2_ArtifactWritesDatabase: {
    example: "Form artifact that adds rows to database",
    flow: "Artifact (input form) → Database (storage)",
    implementation: {
      challenge: "How does artifact update database?",
      solution_current: "Not possible (security)",
      solution_ai: "AI creates paired blocks that user manually syncs"
    }
  },

  pattern3_DataDrivenArtifact: {
    example: "Timer that logs sessions to database",
    flow: "Artifact (timer) → Database (session log)",
    implementation: {
      challenge: "Cross-block communication",
      solution_current: "Not possible",
      solution_ai: "AI creates database + artifact with instructions for manual logging"
    }
  },

  pattern4_DashboardView: {
    example: "Dashboard showing database stats",
    flow: "Database → Artifact (reads) → Visual dashboard",
    implementation: {
      challenge: "Real-time data sync",
      solution_current: "Not possible",
      solution_ai: "AI generates artifact with snapshot of database data"
    }
  }
}

// DECISION: For MVP, focus on Pattern 1 (Artifact reads Database)
// AI embeds database data into artifact at creation time
```

#### Day 4-5: AI Understanding Patterns

**Objective:** Define what "understanding" means for AI.

**For Databases:**
```typescript
interface DatabaseUnderstanding {
  schemaAnalysis: {
    inferColumnTypes: "Given data, suggest appropriate column types",
    inferRelationships: "Understand which columns relate to each other",
    suggestColumns: "For a given topic, suggest relevant columns"
  },

  dataPatterns: {
    detectDataType: "Is this column dates? numbers? categories?",
    suggestValidation: "What validation rules make sense?",
    proposeDefaults: "What default values are appropriate?"
  },

  useCaseRecognition: {
    projectTracker: {
      columns: ["Task Name", "Status", "Priority", "Due Date", "Assignee"],
      types: ["text", "select", "select", "date", "text"],
      options: {
        Status: ["Todo", "In Progress", "Done"],
        Priority: ["Low", "Medium", "High"]
      }
    },

    habitTracker: {
      columns: ["Habit", "Date", "Completed", "Notes"],
      types: ["text", "date", "checkbox", "text"]
    },

    bookLibrary: {
      columns: ["Title", "Author", "Genre", "Year", "Rating", "Read"],
      types: ["text", "text", "select", "number", "number", "checkbox"]
    }
  }
}

// AI Training Examples
const trainingExamples = [
  {
    userRequest: "Create a database for tracking my workouts",
    aiAnalysis: {
      recognized_use_case: "fitness_tracker",
      suggested_schema: {
        columns: [
          { name: "Exercise", type: "text" },
          { name: "Date", type: "date" },
          { name: "Sets", type: "number" },
          { name: "Reps", type: "number" },
          { name: "Weight (lbs)", type: "number" },
          { name: "Completed", type: "checkbox" }
        ]
      }
    }
  }
];
```

**For Artifacts:**
```typescript
interface ArtifactUnderstanding {
  codePatternRecognition: {
    timer: {
      htmlPattern: "Display element (shows countdown)",
      cssPattern: "Centered text, large font",
      jsPattern: "setInterval, countdown logic, time formatting"
    },

    calculator: {
      htmlPattern: "Input fields, buttons, result display",
      cssPattern: "Grid/flex layout, button styling",
      jsPattern: "Event listeners, calculation functions, validation"
    },

    chart: {
      htmlPattern: "Canvas or SVG container",
      cssPattern: "Fixed dimensions, responsive wrapper",
      jsPattern: "Drawing logic, data processing, rendering"
    }
  },

  bugFixing: {
    syntaxErrors: "Detect and fix JS syntax errors",
    logicErrors: "Understand incorrect calculations or logic",
    cssIssues: "Fix layout problems, styling bugs",
    htmlStructure: "Correct malformed HTML"
  },

  featureAddition: {
    addButton: "Insert HTML button + JS handler",
    addInput: "Insert HTML input + validation + JS processing",
    addStyling: "Add CSS classes/rules for new elements",
    addFunctionality: "Write new JS functions"
  }
}

// AI Training Examples
const artifactTrainingExamples = [
  {
    userRequest: "Create a Pomodoro timer (25 minutes)",
    aiGeneration: {
      html: `
<div class="timer">
  <h2 id="display">25:00</h2>
  <button id="start">Start</button>
  <button id="pause">Pause</button>
  <button id="reset">Reset</button>
</div>`,
      css: `
.timer { text-align: center; padding: 20px; }
#display { font-size: 48px; font-weight: bold; margin: 20px 0; }
button { margin: 0 10px; padding: 10px 20px; font-size: 16px; }`,
      javascript: `
let timeLeft = 25 * 60;
let timerId = null;

function updateDisplay() {
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  document.getElementById('display').textContent =
    mins + ':' + (secs < 10 ? '0' : '') + secs;
}

document.getElementById('start').onclick = () => {
  if (!timerId) {
    timerId = setInterval(() => {
      timeLeft--;
      updateDisplay();
      if (timeLeft === 0) {
        clearInterval(timerId);
        alert('Time\\'s up!');
      }
    }, 1000);
  }
};

document.getElementById('pause').onclick = () => {
  clearInterval(timerId);
  timerId = null;
};

document.getElementById('reset').onclick = () => {
  clearInterval(timerId);
  timerId = null;
  timeLeft = 25 * 60;
  updateDisplay();
};
`
    }
  }
];
```

---

## Phase 1: AI Database Understanding (Week 1-2)

### Goal
Make AI truly understand database structures and generate perfect schemas.

### Week 1: Database Schema Intelligence

#### Day 1-2: Implement Database Schema Analysis Tool

**New Backend Tool:**
```rust
// src-tauri/src/commands/ai.rs

#[tauri::command]
pub async fn ai_analyze_database_schema(
    block_id: String,
    app_handle: AppHandle,
) -> Result<DatabaseSchemaAnalysis, String> {
    // Get database block
    let db = get_db_connection(&app_handle)?;

    let data_json: String = db.query_row(
        "SELECT data FROM blocks WHERE id = ? AND type = 'database'",
        params![block_id],
        |row| row.get(0)
    ).map_err(|e| format!("Database block not found: {}", e))?;

    let data: serde_json::Value = serde_json::from_str(&data_json)
        .map_err(|e| format!("Invalid database data: {}", e))?;

    // Analyze schema
    let columns = data["columns"].as_array()
        .ok_or("No columns found")?;

    let rows = data["rows"].as_array()
        .ok_or("No rows found")?;

    // Infer patterns
    let mut analysis = DatabaseSchemaAnalysis {
        column_count: columns.len(),
        row_count: rows.len(),
        column_analysis: vec![],
        inferred_use_case: None,
        suggestions: vec![]
    };

    for column in columns {
        let col_name = column["name"].as_str().unwrap_or("");
        let col_type = column["column_type"].as_str().unwrap_or("");

        // Analyze data in this column across all rows
        let col_id = column["id"].as_str().unwrap_or("");
        let mut values = vec![];

        for row in rows {
            if let Some(val) = row.get(col_id) {
                values.push(val.clone());
            }
        }

        analysis.column_analysis.push(ColumnAnalysis {
            name: col_name.to_string(),
            declared_type: col_type.to_string(),
            sample_values: values.iter().take(5).cloned().collect(),
            inferred_type: infer_type_from_values(&values),
            is_unique: is_unique(&values),
            has_nulls: has_nulls(&values),
            value_distribution: calculate_distribution(&values)
        });
    }

    // Infer use case from column names and types
    analysis.inferred_use_case = infer_use_case(&analysis.column_analysis);

    // Generate suggestions
    analysis.suggestions = generate_suggestions(&analysis);

    Ok(analysis)
}

#[derive(Debug, Serialize)]
struct DatabaseSchemaAnalysis {
    column_count: usize,
    row_count: usize,
    column_analysis: Vec<ColumnAnalysis>,
    inferred_use_case: Option<String>,
    suggestions: Vec<String>
}

#[derive(Debug, Serialize)]
struct ColumnAnalysis {
    name: String,
    declared_type: String,
    sample_values: Vec<serde_json::Value>,
    inferred_type: String,
    is_unique: bool,
    has_nulls: bool,
    value_distribution: ValueDistribution
}
```

**Frontend Integration:**
```typescript
// src/services/tauriAI.ts

async analyzeDatabaseSchema(blockId: string): Promise<DatabaseSchemaAnalysis> {
  const result = await invoke('ai_analyze_database_schema', { blockId });
  return result;
}

// Add to AI tools
const DATABASE_ANALYSIS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'analyze_database_schema',
    description: 'Analyze a database block to understand its structure, data patterns, and purpose. Use this before editing or suggesting changes to a database.',
    parameters: {
      type: 'object',
      properties: {
        block_id: {
          type: 'string',
          description: 'The ID of the database block to analyze'
        }
      },
      required: ['block_id']
    }
  }
};
```

#### Day 3-4: Enhanced Database Generation with Deep Understanding

**Improve System Prompt for Database Generation:**
```typescript
const DATABASE_GENERATION_PROMPT = `You are an expert database designer. When creating a database, you must think deeply about:

1. **Use Case Recognition**
   - What is the user trying to track/organize?
   - What are common patterns for this use case?
   - What columns are essential vs optional?

2. **Column Design**
   - What data type best fits each column?
   - Should columns have predefined options (select type)?
   - What validations make sense?
   - What are good default values?

3. **Data Relationships**
   - How do columns relate to each other?
   - Are there any dependencies?
   - What's the primary identifier?

4. **User Experience**
   - What column order makes sense?
   - What view (table/gallery/calendar) fits best?
   - What columns should be sortable?

EXAMPLE ANALYSIS:

User: "Create a database for my book collection"

Your Thinking:
→ Use Case: Personal book library/tracker
→ Essential Columns: Title, Author, Genre, Year, Rating, Read Status
→ Optional Columns: Pages, Publisher, Date Read, Notes
→ Column Types:
  - Title: text (required, primary identifier)
  - Author: text (required)
  - Genre: select (predefined options: Fiction, Non-Fiction, etc.)
  - Year: number (publication year, 1900-2025)
  - Rating: number (1-5 stars)
  - Read: checkbox (have I read this?)
  - Notes: text (optional thoughts)
→ Default View: table (best for lists)
→ Initial Sort: By title (alphabetical)

Your Generation:
{
  "title": "Book Collection",
  "columns": [
    {
      "name": "Title",
      "column_type": "text",
      "required": true
    },
    {
      "name": "Author",
      "column_type": "text",
      "required": true
    },
    {
      "name": "Genre",
      "column_type": "select",
      "options": ["Fiction", "Non-Fiction", "Mystery", "Sci-Fi", "Biography", "Other"]
    },
    {
      "name": "Year Published",
      "column_type": "number"
    },
    {
      "name": "Rating",
      "column_type": "number",
      "options": ["1", "2", "3", "4", "5"]
    },
    {
      "name": "Read",
      "column_type": "checkbox"
    },
    {
      "name": "Notes",
      "column_type": "text"
    }
  ],
  "rows": [
    // Include 1-2 example rows to show structure
  ],
  "view": "table"
}

IMPORTANT:
- Always include 1-2 example rows to demonstrate the structure
- Choose appropriate column types (don't make everything text!)
- Use select type for categorical data with known options
- Use number type for quantities, ratings, years
- Use date type for dates/timestamps
- Use checkbox for yes/no, true/false, done/not done
- Order columns logically (most important first)
`;
```

#### Day 5-7: Test Database Understanding

**Create Test Suite:**
```typescript
// test/ai/database-understanding.test.ts

describe('AI Database Understanding', () => {
  describe('Schema Analysis', () => {
    it('should correctly analyze a project tracker database', async () => {
      const blockId = await createTestDatabase({
        columns: [
          { name: 'Task', type: 'text' },
          { name: 'Status', type: 'select', options: ['Todo', 'Done'] },
          { name: 'Priority', type: 'select', options: ['Low', 'High'] }
        ],
        rows: [
          { Task: 'Write docs', Status: 'Done', Priority: 'High' },
          { Task: 'Fix bug', Status: 'Todo', Priority: 'Low' }
        ]
      });

      const analysis = await aiAnalyzeDatabaseSchema(blockId);

      expect(analysis.inferred_use_case).toBe('project_tracker');
      expect(analysis.column_count).toBe(3);
      expect(analysis.row_count).toBe(2);
    });

    it('should infer column types from data', async () => {
      // Test type inference
    });

    it('should detect data quality issues', async () => {
      // Test validation
    });
  });

  describe('Schema Generation', () => {
    it('should generate appropriate schema for book collection', async () => {
      const result = await generateDatabase('Create a database for my book collection');

      expect(result.columns).toContainEqual(
        expect.objectContaining({ name: 'Title', column_type: 'text' })
      );
      expect(result.columns).toContainEqual(
        expect.objectContaining({ name: 'Author', column_type: 'text' })
      );
      expect(result.columns.find(c => c.name === 'Genre')).toHaveProperty('options');
      expect(result.rows.length).toBeGreaterThan(0); // Should include examples
    });

    it('should generate appropriate schema for habit tracker', async () => {
      const result = await generateDatabase('Create a habit tracker');

      expect(result.columns.find(c => c.name === 'Date')).toHaveProperty('column_type', 'date');
      expect(result.columns.find(c => c.name === 'Completed')).toHaveProperty('column_type', 'checkbox');
    });
  });
});
```

### Week 2: Database Editing Intelligence

#### Day 1-3: Implement Smart Database Editing

**New Tool: `edit_database`**
```typescript
// Frontend tool definition
{
  type: 'function' as const,
  function: {
    name: 'edit_database',
    description: `Edit a database block structure or data. You can:
    - Add new columns with appropriate types
    - Remove columns (data will be lost!)
    - Add new rows with data
    - Update existing rows
    - Delete rows
    - Change column properties (type, options, name)

    IMPORTANT: Always use analyze_database_schema first to understand the current structure before editing.`,
    parameters: {
      type: 'object',
      properties: {
        block_id: {
          type: 'string',
          description: 'ID of the database block to edit'
        },
        action: {
          type: 'string',
          enum: ['add_column', 'remove_column', 'rename_column', 'add_row', 'update_row', 'delete_row', 'change_view'],
          description: 'The type of edit to perform'
        },
        data: {
          type: 'object',
          description: 'Edit-specific data (column definition, row data, etc.)'
        },
        reason: {
          type: 'string',
          description: 'Explanation of why this edit is needed'
        }
      },
      required: ['block_id', 'action', 'data', 'reason']
    }
  }
}

// Handler
if (functionName === 'edit_database') {
  // First, get current database structure
  const block = blocksStore.blocks.find(b => b.id === parsedArgs.block_id);

  if (!block || block.type !== 'database') {
    conversationHistory.push({
      role: 'user',
      content: `[Error]: Block ${parsedArgs.block_id} is not a database block`
    });
    continue;
  }

  const currentData = block.data as DatabaseBlockData;

  // Apply edit based on action
  let proposedData = { ...currentData };

  switch (parsedArgs.action) {
    case 'add_column':
      proposedData.columns.push({
        id: generateId(),
        name: parsedArgs.data.name,
        column_type: parsedArgs.data.type,
        options: parsedArgs.data.options,
        width: 150
      });
      // Add default values to existing rows
      for (const row of proposedData.rows) {
        row[proposedData.columns[proposedData.columns.length - 1].id] =
          getDefaultValueForType(parsedArgs.data.type);
      }
      break;

    case 'add_row':
      const newRow: any = { id: generateId() };
      for (const column of proposedData.columns) {
        newRow[column.id] = parsedArgs.data[column.name] ||
                            getDefaultValueForType(column.column_type);
      }
      proposedData.rows.push(newRow);
      break;

    case 'update_row':
      const rowIndex = proposedData.rows.findIndex(r => r.id === parsedArgs.data.row_id);
      if (rowIndex >= 0) {
        // Update specific cells
        for (const [columnName, value] of Object.entries(parsedArgs.data.updates)) {
          const column = proposedData.columns.find(c => c.name === columnName);
          if (column) {
            proposedData.rows[rowIndex][column.id] = value;
          }
        }
      }
      break;

    // ... other actions
  }

  // Add to pending edits for user review
  aiStore.addPendingEdit({
    blockId: parsedArgs.block_id,
    editType: 'database',
    originalContent: currentData,
    proposedContent: proposedData,
    reason: parsedArgs.reason
  });
}
```

#### Day 4-5: Create Database Diff Viewer

**New Component:**
```tsx
// src/components/AI/DatabaseDiffPreview.tsx

interface DatabaseDiffPreviewProps {
  original: DatabaseBlockData;
  proposed: DatabaseBlockData;
  onAccept: () => void;
  onReject: () => void;
}

export function DatabaseDiffPreview({ original, proposed, onAccept, onReject }: DatabaseDiffPreviewProps) {
  const columnChanges = detectColumnChanges(original.columns, proposed.columns);
  const rowChanges = detectRowChanges(original.rows, proposed.rows);

  return (
    <div className="database-diff">
      <h3>Database Changes</h3>

      {columnChanges.added.length > 0 && (
        <div className="changes-section">
          <h4>✅ Columns Added ({columnChanges.added.length})</h4>
          {columnChanges.added.map(col => (
            <div key={col.id} className="change-item added">
              <strong>{col.name}</strong> ({col.column_type})
              {col.options && <span> Options: {col.options.join(', ')}</span>}
            </div>
          ))}
        </div>
      )}

      {columnChanges.removed.length > 0 && (
        <div className="changes-section">
          <h4>❌ Columns Removed ({columnChanges.removed.length})</h4>
          {columnChanges.removed.map(col => (
            <div key={col.id} className="change-item removed">
              <strong>{col.name}</strong> ({col.column_type})
              <span className="warning">⚠️ Data in this column will be lost!</span>
            </div>
          ))}
        </div>
      )}

      {columnChanges.modified.length > 0 && (
        <div className="changes-section">
          <h4>📝 Columns Modified ({columnChanges.modified.length})</h4>
          {columnChanges.modified.map(({ original: orig, proposed: prop }) => (
            <div key={prop.id} className="change-item modified">
              <strong>{orig.name}</strong>
              {orig.name !== prop.name && <span> → <strong>{prop.name}</strong></span>}
              {orig.column_type !== prop.column_type && (
                <span> Type: {orig.column_type} → {prop.column_type}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {rowChanges.added.length > 0 && (
        <div className="changes-section">
          <h4>➕ Rows Added ({rowChanges.added.length})</h4>
          <div className="row-preview">
            {rowChanges.added.slice(0, 3).map((row, idx) => (
              <div key={idx} className="row-item">
                {Object.entries(row).filter(([k]) => k !== 'id').map(([k, v]) => (
                  <span key={k}>{k}: <strong>{String(v)}</strong></span>
                ))}
              </div>
            ))}
            {rowChanges.added.length > 3 && (
              <div className="more-indicator">
                ... and {rowChanges.added.length - 3} more rows
              </div>
            )}
          </div>
        </div>
      )}

      <div className="diff-actions">
        <button onClick={onAccept} className="accept-button">
          ✅ Accept Changes (Tab)
        </button>
        <button onClick={onReject} className="reject-button">
          ❌ Reject (Esc)
        </button>
      </div>
    </div>
  );
}

function detectColumnChanges(original: DatabaseColumn[], proposed: DatabaseColumn[]) {
  const added = proposed.filter(p => !original.find(o => o.id === p.id));
  const removed = original.filter(o => !proposed.find(p => p.id === o.id));
  const modified = proposed
    .filter(p => original.find(o => o.id === p.id))
    .map(p => ({
      original: original.find(o => o.id === p.id)!,
      proposed: p
    }))
    .filter(({ original: o, proposed: p }) =>
      o.name !== p.name ||
      o.column_type !== p.column_type ||
      JSON.stringify(o.options) !== JSON.stringify(p.options)
    );

  return { added, removed, modified };
}
```

#### Day 6-7: Test Database Editing

**Test Scenarios:**
```typescript
describe('AI Database Editing', () => {
  it('should add appropriate column to existing database', async () => {
    const dbId = await createTestDatabase({
      title: 'Task List',
      columns: [
        { name: 'Task', type: 'text' },
        { name: 'Status', type: 'select', options: ['Todo', 'Done'] }
      ]
    });

    await agent.chat('Add a priority column to this task database');

    const updated = await getDatabase(dbId);
    expect(updated.columns).toContainEqual(
      expect.objectContaining({
        name: 'Priority',
        column_type: 'select',
        options: expect.arrayContaining(['Low', 'Medium', 'High'])
      })
    );
  });

  it('should add rows with correct data types', async () => {
    // Test row addition with type validation
  });

  it('should update existing rows correctly', async () => {
    // Test row updates
  });
});
```

---

## Phase 2: AI Artifact Understanding (Week 3-4)

### Goal
Make AI deeply understand artifact code and edit it intelligently.

### Week 3: Artifact Code Analysis

#### Day 1-2: Implement Code Analysis Tool

**New Backend Tool:**
```rust
// src-tauri/src/commands/ai.rs

#[tauri::command]
pub async fn ai_analyze_artifact_code(
    block_id: String,
    app_handle: AppHandle,
) -> Result<ArtifactCodeAnalysis, String> {
    // Get artifact block
    let db = get_db_connection(&app_handle)?;

    let data_json: String = db.query_row(
        "SELECT data FROM blocks WHERE id = ? AND type = 'artifact'",
        params![block_id],
        |row| row.get(0)
    ).map_err(|e| format!("Artifact block not found: {}", e))?;

    let data: serde_json::Value = serde_json::from_str(&data_json)
        .map_err(|e| format!("Invalid artifact data: {}", e))?;

    let html = data["html"].as_str().unwrap_or("");
    let css = data["css"].as_str().unwrap_or("");
    let javascript = data["javascript"].as_str().unwrap_or("");

    // Analyze code structure
    let analysis = ArtifactCodeAnalysis {
        artifact_type: detect_artifact_type(html, css, javascript),
        html_analysis: analyze_html(html),
        css_analysis: analyze_css(css),
        js_analysis: analyze_javascript(javascript),
        detected_patterns: detect_patterns(html, css, javascript),
        potential_issues: detect_issues(html, css, javascript),
        suggestions: generate_code_suggestions(html, css, javascript)
    };

    Ok(analysis)
}

fn detect_artifact_type(html: &str, css: &str, js: &str) -> String {
    // Pattern matching to detect type
    if js.contains("setInterval") || js.contains("setTimeout") {
        if html.contains("timer") || html.contains("countdown") {
            return "timer".to_string();
        }
    }

    if html.contains("input") && html.contains("button") {
        if js.contains("onclick") || js.contains("addEventListener") {
            return "calculator".to_string();
        }
    }

    if html.contains("canvas") || html.contains("svg") {
        return "visualization".to_string();
    }

    "interactive_component".to_string()
}

fn analyze_html(html: &str) -> HtmlAnalysis {
    HtmlAnalysis {
        element_count: count_elements(html),
        has_forms: html.contains("<form") || html.contains("<input"),
        has_buttons: html.contains("<button"),
        has_canvas: html.contains("<canvas"),
        has_svg: html.contains("<svg"),
        id_elements: extract_ids(html),
        class_elements: extract_classes(html)
    }
}

fn analyze_javascript(js: &str) -> JavaScriptAnalysis {
    JavaScriptAnalysis {
        has_event_listeners: js.contains("addEventListener") || js.contains("onclick"),
        has_timers: js.contains("setInterval") || js.contains("setTimeout"),
        has_dom_manipulation: js.contains("getElementById") || js.contains("querySelector"),
        function_count: count_functions(js),
        variable_count: count_variables(js),
        dependencies: extract_dependencies(js),
        complexity_score: calculate_complexity(js)
    }
}

#[derive(Debug, Serialize)]
struct ArtifactCodeAnalysis {
    artifact_type: String,
    html_analysis: HtmlAnalysis,
    css_analysis: CssAnalysis,
    js_analysis: JavaScriptAnalysis,
    detected_patterns: Vec<CodePattern>,
    potential_issues: Vec<CodeIssue>,
    suggestions: Vec<String>
}
```

**Frontend Integration:**
```typescript
// Add to AI tools
const ARTIFACT_ANALYSIS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'analyze_artifact_code',
    description: 'Analyze an artifact block to understand its code structure, functionality, and detect issues. Use this before editing artifact code.',
    parameters: {
      type: 'object',
      properties: {
        block_id: {
          type: 'string',
          description: 'The ID of the artifact block to analyze'
        }
      },
      required: ['block_id']
    }
  }
};
```

#### Day 3-4: Enhanced Artifact Generation with Patterns

**Artifact Pattern Library:**
```typescript
// src/services/artifactPatterns.ts

export const ARTIFACT_PATTERNS = {
  pomodoro_timer: {
    description: "25-minute Pomodoro timer with start/pause/reset",
    template: {
      html: `
<div class="pomodoro-timer">
  <div class="timer-display">
    <h1 id="time-display">25:00</h1>
    <p id="timer-status">Ready to focus</p>
  </div>
  <div class="timer-controls">
    <button id="start-btn" class="btn btn-primary">Start</button>
    <button id="pause-btn" class="btn btn-secondary" disabled>Pause</button>
    <button id="reset-btn" class="btn btn-secondary">Reset</button>
  </div>
  <div class="timer-stats">
    <p>Sessions: <span id="session-count">0</span></p>
  </div>
</div>`,
      css: `
.pomodoro-timer {
  max-width: 400px;
  margin: 0 auto;
  padding: 30px;
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.timer-display h1 {
  font-size: 72px;
  margin: 20px 0 10px 0;
  font-weight: bold;
  letter-spacing: 2px;
}

.timer-status {
  font-size: 18px;
  opacity: 0.9;
  margin-bottom: 30px;
}

.timer-controls {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 20px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: white;
  color: #667eea;
}

.btn-primary:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.btn-secondary {
  background: rgba(255,255,255,0.2);
  color: white;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.timer-stats {
  margin-top: 20px;
  font-size: 14px;
  opacity: 0.8;
}`,
      javascript: `
const WORK_TIME = 25 * 60; // 25 minutes in seconds
let timeLeft = WORK_TIME;
let timerInterval = null;
let isRunning = false;
let sessionCount = 0;

const timeDisplay = document.getElementById('time-display');
const statusDisplay = document.getElementById('timer-status');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const sessionCountDisplay = document.getElementById('session-count');

function updateDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timeDisplay.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

function startTimer() {
  if (!isRunning) {
    isRunning = true;
    statusDisplay.textContent = 'Focus time! 🎯';
    startBtn.disabled = true;
    pauseBtn.disabled = false;

    timerInterval = setInterval(() => {
      timeLeft--;
      updateDisplay();

      if (timeLeft === 0) {
        clearInterval(timerInterval);
        isRunning = false;
        sessionCount++;
        sessionCountDisplay.textContent = sessionCount;
        statusDisplay.textContent = 'Session complete! Take a break 🎉';
        startBtn.disabled = false;
        pauseBtn.disabled = true;

        // Play sound (simple beep using AudioContext)
        try {
          const audioCtx = new AudioContext();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.frequency.value = 800;
          gainNode.gain.value = 0.3;
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.3);
        } catch (e) {
          console.log('Audio not supported');
        }

        timeLeft = WORK_TIME;
        updateDisplay();
      }
    }, 1000);
  }
}

function pauseTimer() {
  clearInterval(timerInterval);
  isRunning = false;
  statusDisplay.textContent = 'Paused';
  startBtn.disabled = false;
  pauseBtn.disabled = true;
}

function resetTimer() {
  clearInterval(timerInterval);
  isRunning = false;
  timeLeft = WORK_TIME;
  updateDisplay();
  statusDisplay.textContent = 'Ready to focus';
  startBtn.disabled = false;
  pauseBtn.disabled = true;
}

startBtn.onclick = startTimer;
pauseBtn.onclick = pauseTimer;
resetBtn.onclick = resetTimer;

updateDisplay();`
    }
  },

  simple_calculator: {
    description: "Basic calculator with arithmetic operations",
    template: {
      // ... calculator template
    }
  },

  countdown_timer: {
    description: "Customizable countdown timer",
    template: {
      // ... countdown template
    }
  },

  // More patterns...
};

export function getPatternByType(type: string) {
  return ARTIFACT_PATTERNS[type] || null;
}

export function suggestPatternFromPrompt(prompt: string): string | null {
  const lower = prompt.toLowerCase();

  if (lower.includes('pomodoro') || (lower.includes('timer') && lower.includes('25'))) {
    return 'pomodoro_timer';
  }

  if (lower.includes('calculator') && !lower.includes('advanced')) {
    return 'simple_calculator';
  }

  if (lower.includes('countdown')) {
    return 'countdown_timer';
  }

  return null;
}
```

**Enhanced Artifact Generation:**
```typescript
const ARTIFACT_GENERATION_PROMPT = `You are an expert web developer creating interactive artifacts (HTML/CSS/JS).

IMPORTANT PRINCIPLES:

1. **Code Quality**
   - Clean, readable code with comments
   - Proper indentation and formatting
   - Semantic HTML elements
   - Modern CSS (flexbox, grid, variables)
   - Vanilla JavaScript (no external libraries)

2. **User Experience**
   - Responsive design
   - Clear visual feedback
   - Accessible (ARIA labels, keyboard support)
   - Error handling
   - Loading states

3. **Functionality**
   - All features working correctly
   - Edge cases handled
   - Input validation
   - Helpful error messages

4. **Pattern Recognition**
   When you see common patterns, use proven templates:
   - "Pomodoro timer" → Use POMODORO_TIMER pattern
   - "Calculator" → Use CALCULATOR pattern
   - "Countdown" → Use COUNTDOWN_TIMER pattern

   Customize the template for specific requirements.

5. **Code Structure**
   HTML:
   - Container div with semantic class name
   - Logical element hierarchy
   - IDs for elements that JS needs to access

   CSS:
   - Mobile-first approach
   - CSS variables for colors/spacing
   - Smooth transitions
   - Modern, clean design

   JavaScript:
   - Clear variable names
   - Separate concerns (data, UI, events)
   - Comments explaining complex logic
   - Error handling with try-catch

EXAMPLE GENERATION:

User: "Create a Pomodoro timer"

Your Analysis:
→ Pattern Match: POMODORO_TIMER
→ Requirements: 25min timer, start/pause/reset, session counter
→ Customize: Add modern gradient design, sound on completion

Your Generation:
[Use pomodoro_timer template with customizations]

EXAMPLE CUSTOMIZATION:

User: "Make the timer 30 minutes instead of 25"

Your Analysis:
→ Artifact Type: Timer
→ Current Code: Uses WORK_TIME = 25 * 60
→ Required Change: Modify JavaScript constant
→ Impact: Only JS change, HTML/CSS unchanged

Your Edit:
{
  "javascript": "const WORK_TIME = 30 * 60; // 30 minutes in seconds\n[rest of code...]"
}
`;
```

#### Day 5-7: Test Artifact Understanding

**Test Suite:**
```typescript
describe('AI Artifact Understanding', () => {
  describe('Code Analysis', () => {
    it('should correctly identify timer artifact type', async () => {
      const artifactId = await createTestArtifact(ARTIFACT_PATTERNS.pomodoro_timer.template);

      const analysis = await aiAnalyzeArtifactCode(artifactId);

      expect(analysis.artifact_type).toBe('timer');
      expect(analysis.js_analysis.has_timers).toBe(true);
      expect(analysis.js_analysis.has_event_listeners).toBe(true);
    });

    it('should detect code issues', async () => {
      const buggyCode = {
        html: '<div id="display"></div>',
        css: '',
        javascript: 'document.getElementById("wrong-id").textContent = "test";' // Bug: wrong ID
      };

      const artifactId = await createTestArtifact(buggyCode);
      const analysis = await aiAnalyzeArtifactCode(artifactId);

      expect(analysis.potential_issues.length).toBeGreaterThan(0);
      expect(analysis.potential_issues[0]).toContain('getElementById');
    });
  });

  describe('Artifact Generation', () => {
    it('should generate working Pomodoro timer', async () => {
      const result = await generateArtifact('Create a Pomodoro timer');

      expect(result.html).toContain('timer');
      expect(result.javascript).toContain('setInterval');
      expect(result.javascript).toContain('25'); // 25 minutes

      // Test execution
      const works = await testArtifactExecution(result);
      expect(works).toBe(true);
    });

    it('should customize template based on requirements', async () => {
      const result = await generateArtifact('Create a 30-minute timer');

      expect(result.javascript).toContain('30 * 60'); // 30 minutes
    });
  });
});
```

### Week 4: Artifact Editing Intelligence

#### Day 1-3: Implement Smart Artifact Editing

**Enhanced `edit_artifact` Tool:**
```typescript
{
  type: 'function' as const,
  function: {
    name: 'edit_artifact',
    description: `Edit an artifact's HTML, CSS, or JavaScript code. You can modify one or all parts.

IMPORTANT:
- Always use analyze_artifact_code first to understand current code
- Only modify what's necessary (don't rewrite entire code if changing one thing)
- Preserve working code, only change what's broken or requested
- Test logic in your head before suggesting changes
- Explain what you're changing and why

COMMON EDIT TYPES:
- Bug fixes: Fix JavaScript errors, CSS issues, HTML problems
- Feature additions: Add new buttons, inputs, functionality
- Styling changes: Modify colors, layout, animations
- Logic changes: Update calculations, timers, event handlers`,

    parameters: {
      type: 'object',
      properties: {
        block_id: {
          type: 'string',
          description: 'ID of the artifact block'
        },
        html: {
          type: 'string',
          description: 'New HTML (provide COMPLETE html, not partial). Only include if changing HTML.'
        },
        css: {
          type: 'string',
          description: 'New CSS (provide COMPLETE css, not partial). Only include if changing CSS.'
        },
        javascript: {
          type: 'string',
          description: 'New JavaScript (provide COMPLETE code, not partial). Only include if changing JS.'
        },
        reason: {
          type: 'string',
          description: 'Detailed explanation: what you changed and why'
        }
      },
      required: ['block_id', 'reason']
    }
  }
}

// Enhanced handler with analysis
if (functionName === 'edit_artifact') {
  // First analyze current code
  const analysis = await tauriAI.analyzeArtifactCode(parsedArgs.block_id);

  console.log('📊 Artifact analysis:', analysis);

  const block = blocksStore.blocks.find(b => b.id === parsedArgs.block_id);

  if (!block || block.type !== 'artifact') {
    conversationHistory.push({
      role: 'user',
      content: `[Error]: Block ${parsedArgs.block_id} is not an artifact`
    });
    continue;
  }

  const currentData = block.data as ArtifactBlockData;

  // Validate proposed changes
  const validationResult = validateArtifactCode({
    html: parsedArgs.html || currentData.html,
    css: parsedArgs.css || currentData.css,
    javascript: parsedArgs.javascript || currentData.javascript
  });

  if (!validationResult.valid) {
    conversationHistory.push({
      role: 'user',
      content: `[Validation Error]: ${validationResult.errors.join(', ')}\n\nPlease fix these issues and try again.`
    });
    continue;
  }

  // Create proposed changes
  const proposed = {
    ...currentData,
    html: parsedArgs.html || currentData.html,
    css: parsedArgs.css || currentData.css,
    javascript: parsedArgs.javascript || currentData.javascript
  };

  // Add to pending edits
  aiStore.addPendingEdit({
    blockId: parsedArgs.block_id,
    editType: 'artifact',
    originalContent: currentData,
    proposedContent: proposed,
    reason: parsedArgs.reason,
    analysis: analysis, // Include analysis in edit
    validation: validationResult
  });

  conversationHistory.push({
    role: 'user',
    content: `[Artifact edit proposed]: ${parsedArgs.reason}\nValidation: ${validationResult.warnings.length} warnings`
  });
}
```

#### Day 4-5: Create Artifact Code Diff Viewer

**New Component:**
```tsx
// src/components/AI/ArtifactDiffPreview.tsx

import { diffLines } from 'diff'; // npm install diff

interface ArtifactDiffPreviewProps {
  original: ArtifactBlockData;
  proposed: ArtifactBlockData;
  onAccept: () => void;
  onReject: () => void;
}

export function ArtifactDiffPreview({ original, proposed, onAccept, onReject }: ArtifactDiffPreviewProps) {
  const htmlDiff = diffLines(original.html, proposed.html);
  const cssDiff = diffLines(original.css, proposed.css);
  const jsDiff = diffLines(original.javascript, proposed.javascript);

  const hasHtmlChanges = htmlDiff.some(part => part.added || part.removed);
  const hasCssChanges = cssDiff.some(part => part.added || part.removed);
  const hasJsChanges = jsDiff.some(part => part.added || part.removed);

  return (
    <div className="artifact-diff">
      <h3>Artifact Code Changes</h3>

      <div className="diff-tabs">
        {hasHtmlChanges && <Tab>HTML ({countChanges(htmlDiff)} changes)</Tab>}
        {hasCssChanges && <Tab>CSS ({countChanges(cssDiff)} changes)</Tab>}
        {hasJsChanges && <Tab>JavaScript ({countChanges(jsDiff)} changes)</Tab>}
      </div>

      {hasHtmlChanges && (
        <div className="diff-section">
          <h4>HTML Changes</h4>
          <pre className="diff-view">
            {htmlDiff.map((part, idx) => (
              <span
                key={idx}
                className={
                  part.added ? 'diff-added' :
                  part.removed ? 'diff-removed' :
                  'diff-unchanged'
                }
              >
                {part.value}
              </span>
            ))}
          </pre>
        </div>
      )}

      {hasJsChanges && (
        <div className="diff-section">
          <h4>JavaScript Changes</h4>
          <pre className="diff-view">
            {jsDiff.map((part, idx) => (
              <span
                key={idx}
                className={
                  part.added ? 'diff-added' :
                  part.removed ? 'diff-removed' :
                  'diff-unchanged'
                }
              >
                {part.value}
              </span>
            ))}
          </pre>
        </div>
      )}

      {hasCssChanges && (
        <div className="diff-section">
          <h4>CSS Changes</h4>
          <pre className="diff-view">
            {cssDiff.map((part, idx) => (
              <span
                key={idx}
                className={
                  part.added ? 'diff-added' :
                  part.removed ? 'diff-removed' :
                  'diff-unchanged'
                }
              >
                {part.value}
              </span>
            ))}
          </pre>
        </div>
      )}

      <div className="preview-section">
        <h4>Preview of Changes</h4>
        <div className="side-by-side">
          <div className="before">
            <h5>Before</h5>
            <iframe srcDoc={constructSrcDoc(original)} />
          </div>
          <div className="after">
            <h5>After</h5>
            <iframe srcDoc={constructSrcDoc(proposed)} />
          </div>
        </div>
      </div>

      <div className="diff-actions">
        <button onClick={onAccept} className="accept-button">
          ✅ Accept Changes (Tab)
        </button>
        <button onClick={onReject} className="reject-button">
          ❌ Reject (Esc)
        </button>
      </div>
    </div>
  );
}

function countChanges(diff: any[]): number {
  return diff.filter(part => part.added || part.removed).length;
}

function constructSrcDoc(data: ArtifactBlockData): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>${data.css}</style>
</head>
<body>
  ${data.html}
  <script>
    try {
      ${data.javascript}
    } catch (error) {
      console.error('Error:', error);
    }
  </script>
</body>
</html>`;
}
```

#### Day 6-7: Test Artifact Editing

**Test Scenarios:**
```typescript
describe('AI Artifact Editing', () => {
  it('should fix bug in timer code', async () => {
    const buggyTimer = {
      ...ARTIFACT_PATTERNS.pomodoro_timer.template,
      javascript: ARTIFACT_PATTERNS.pomodoro_timer.template.javascript.replace('25 * 60', '25') // Bug: wrong time
    };

    const artifactId = await createTestArtifact(buggyTimer);

    await agent.chat('Fix the timer - it should be 25 minutes not 25 seconds');

    const fixed = await getArtifact(artifactId);
    expect(fixed.javascript).toContain('25 * 60');
  });

  it('should add new feature to calculator', async () => {
    const calcId = await createTestArtifact(ARTIFACT_PATTERNS.simple_calculator.template);

    await agent.chat('Add a square root button to the calculator');

    const updated = await getArtifact(calcId);
    expect(updated.html).toContain('sqrt');
    expect(updated.javascript).toContain('Math.sqrt');
  });

  it('should change styling without breaking functionality', async () => {
    const timerId = await createTestArtifact(ARTIFACT_PATTERNS.pomodoro_timer.template);

    await agent.chat('Change the timer colors to blue and green');

    const updated = await getArtifact(timerId);
    expect(updated.css).toMatch(/blue|#[0-9a-f]{3,6}/i);
    expect(updated.css).toMatch(/green|#[0-9a-f]{3,6}/i);

    // Functionality should still work
    const works = await testArtifactExecution(updated);
    expect(works).toBe(true);
  });
});
```

---

## Phase 3: Database ↔ Artifact Connection (Week 5-6)

### Goal
Enable AI to create databases and artifacts that work together.

### Week 5: Data Flow Understanding

#### Day 1-2: Implement Data Embedding Pattern

**Concept:** When creating artifacts that use database data, embed the data directly into the artifact code at generation time.

**Example:**
```typescript
// User request: "Create a chart showing my book ratings"

// AI Workflow:
// 1. Find database with book data
// 2. Extract relevant data (titles, ratings)
// 3. Generate artifact with embedded data
// 4. User can manually update if database changes

const DATA_EMBEDDING_PROMPT = `When creating artifacts that display data from databases:

1. **Identify Data Source**
   - Use read_note to find databases in current note
   - Use analyze_database_schema to understand structure
   - Extract relevant columns

2. **Embed Data**
   - Convert database rows to JavaScript array/object
   - Embed directly in artifact JavaScript
   - Include data as constant at top of code

3. **Generate Visualization**
   - Create appropriate chart/table/list
   - Use embedded data for rendering
   - Add interactive features if needed

4. **Document Data Source**
   - Add comment showing where data came from
   - Include timestamp of data snapshot
   - Note that updates require regeneration

EXAMPLE:

User: "Create a bar chart of my book ratings"

Step 1: Find database
→ read_note() finds "Book Collection" database
→ analyze_database_schema() shows columns: Title, Rating

Step 2: Extract data
→ Books: [
  {title: "1984", rating: 5},
  {title: "Dune", rating: 4},
  ...
]

Step 3: Generate artifact
→ HTML: Canvas element
→ CSS: Sizing and layout
→ JavaScript:
  // Data from "Book Collection" database (snapshot: 2025-01-15)
  const bookData = [
    {title: "1984", rating: 5},
    {title: "Dune", rating: 4}
  ];

  // Draw chart using canvas API
  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  // ... drawing logic ...
`;
```

**Implementation:**
```typescript
// Add to AI workflow
if (userRequest.includes('chart') || userRequest.includes('graph') || userRequest.includes('visualize')) {
  // Check if there's a database in the note
  const noteContent = await tauriAI.getNoteContext(noteId);
  const hasDatabases = noteContent.includes('"type":"database"');

  if (hasDatabases) {
    // Analyze databases to find relevant one
    const databases = extractDatabases(noteContent);

    // Add context to AI about available data
    systemPrompt += `\n\nAVAILABLE DATABASES IN THIS NOTE:\n${formatDatabasesForAI(databases)}`;
  }
}

function extractDatabases(noteContent: string) {
  // Parse note blocks and find databases
  const blocks = JSON.parse(noteContent);
  return blocks
    .filter(b => b.type === 'database')
    .map(b => ({
      id: b.id,
      title: b.data.title,
      columns: b.data.columns.map(c => ({ name: c.name, type: c.column_type })),
      rowCount: b.data.rows.length,
      sampleRows: b.data.rows.slice(0, 3)
    }));
}

function formatDatabasesForAI(databases: any[]) {
  return databases.map(db => `
Database: "${db.title}" (${db.rowCount} rows)
Columns: ${db.columns.map(c => `${c.name} (${c.type})`).join(', ')}
Sample Data:
${JSON.stringify(db.sampleRows, null, 2)}
  `).join('\n\n');
}
```

#### Day 3-5: Implement Complete Note Creation with Connected Blocks

**Enhanced `create_block` with Intelligence:**
```typescript
// System prompt for note creation with connections
const CONNECTED_NOTE_CREATION_PROMPT = `You can create notes with multiple interconnected blocks.

PATTERNS FOR CONNECTED BLOCKS:

Pattern: Data Collection + Visualization
→ Create database for data
→ Create artifact that visualizes the database
→ Embed database data in artifact

Example:
User: "Create a habit tracker with visual progress"

Your Plan:
1. create_block(type='heading1', content='Habit Tracker')
2. create_block(type='database', prompt='Daily habits with dates and completion status')
3. create_block(type='artifact', prompt='Progress chart showing completion rate', data_source='database from step 2')

Pattern: Study Material + Tools
→ Create text blocks with content
→ Create artifact tools (timers, calculators)
→ Create database for tracking

Example:
User: "Create a math study note with practice problems and timer"

Your Plan:
1. create_block(type='heading1', content='Algebra Practice')
2. create_block(type='text', content='Key formulas and concepts')
3. create_block(type='database', prompt='Practice problems with difficulty and status')
4. create_block(type='artifact', prompt='Study timer (Pomodoro 25min)')
5. arrange_blocks for optimal layout

IMPORTANT:
- When creating artifact after database, reference the database
- Embed database data in artifact if it needs to display it
- Create blocks in logical order (heading → content → tools)
- Arrange blocks for good UX (related blocks near each other)
`;
```

**Example Workflow:**
```typescript
// User: "Create a workout tracker with progress chart"

// AI Execution:
async function createWorkoutTrackerNote() {
  // Step 1: Create note
  const noteId = await createNote({
    title: "Workout Tracker",
    reason: "User requested workout tracking system"
  });

  // Step 2: Create heading
  await createBlock({
    note_id: noteId,
    type: 'heading1',
    data: { content: 'My Workout Tracker' },
    reason: 'Note title'
  });

  // Step 3: Create database
  const dbBlockId = await createBlock({
    note_id: noteId,
    type: 'database',
    data: {
      title: 'Workout Log',
      columns: [
        { name: 'Exercise', type: 'text' },
        { name: 'Date', type: 'date' },
        { name: 'Sets', type: 'number' },
        { name: 'Reps', type: 'number' },
        { name: 'Weight (lbs)', type: 'number' }
      ],
      rows: [
        // Example rows
        { Exercise: 'Bench Press', Date: '2025-01-15', Sets: 3, Reps: 10, 'Weight (lbs)': 135 },
        { Exercise: 'Squats', Date: '2025-01-15', Sets: 3, Reps: 8, 'Weight (lbs)': 185 }
      ],
      view: 'table'
    },
    reason: 'Track workout exercises and progress'
  });

  // Step 4: Read database data for embedding
  const dbData = await readBlock(dbBlockId);
  const workoutData = extractWorkoutData(dbData);

  // Step 5: Create progress chart artifact with embedded data
  await createBlock({
    note_id: noteId,
    type: 'artifact',
    data: {
      title: 'Progress Chart',
      html: generateChartHTML(),
      css: generateChartCSS(),
      javascript: generateChartJS(workoutData) // Embed data here!
    },
    reason: 'Visualize workout progress over time'
  });

  // Step 6: Arrange blocks
  await arrangeBlocks({
    note_id: noteId,
    layouts: [
      { block_position: 0, width: 'full' }, // Heading
      { block_position: 1, width: 'full' }, // Database
      { block_position: 2, width: 'full' }  // Chart
    ]
  });
}

function generateChartJS(workoutData: any[]) {
  return `
// Workout data from database (snapshot: ${new Date().toISOString()})
const workoutData = ${JSON.stringify(workoutData, null, 2)};

// Group by exercise
const exerciseData = {};
workoutData.forEach(workout => {
  if (!exerciseData[workout.Exercise]) {
    exerciseData[workout.Exercise] = [];
  }
  exerciseData[workout.Exercise].push({
    date: workout.Date,
    weight: workout['Weight (lbs)'],
    volume: workout.Sets * workout.Reps * workout['Weight (lbs)']
  });
});

// Draw chart
const canvas = document.getElementById('progress-chart');
const ctx = canvas.getContext('2d');

// ... chart drawing logic using exerciseData ...
`;
}
```

#### Day 6-7: Test Connected Block Creation

```typescript
describe('Connected Block Creation', () => {
  it('should create habit tracker with progress chart', async () => {
    await agent.chat('Create a habit tracker with visual progress chart');

    const note = await getCurrentNote();
    const blocks = await getBlocksByNoteId(note.id);

    // Should have heading
    expect(blocks.find(b => b.type === 'heading1')).toBeDefined();

    // Should have database
    const database = blocks.find(b => b.type === 'database');
    expect(database).toBeDefined();
    expect(database.data.columns).toContainEqual(
      expect.objectContaining({ name: 'Date', column_type: 'date' })
    );

    // Should have artifact chart
    const chart = blocks.find(b => b.type === 'artifact');
    expect(chart).toBeDefined();
    expect(chart.data.javascript).toContain('const'); // Has embedded data
    expect(chart.data.html).toContain('canvas'); // Is a chart
  });

  it('should create study note with timer and problem database', async () => {
    // Test study material pattern
  });
});
```

---

## Phase 4: Autonomous Multi-Block Workflows (Week 7-8)

### Goal
Make AI create complete, complex notes autonomously from start to finish.

### Week 7: Planning Intelligence

*(Continue with planning implementation from main research doc...)*

---

## Careful Testing Strategy

After each phase:

### Unit Tests
- Test each tool individually
- Test with various inputs
- Test error cases

### Integration Tests
- Test tool combinations
- Test realistic user scenarios
- Test error recovery

### User Acceptance Tests
- Real user requests
- Complex multi-step workflows
- Edge cases

### Performance Tests
- Response time <2s per tool
- Context window usage
- Token consumption

---

## Implementation Checklist

### Phase 1: Database Understanding
- [ ] Database schema analysis tool (backend)
- [ ] Database schema analysis tool (frontend)
- [ ] Enhanced database generation prompt
- [ ] Training examples for common database types
- [ ] edit_database tool (backend)
- [ ] edit_database tool (frontend)
- [ ] Database diff viewer component
- [ ] Unit tests for database tools
- [ ] Integration tests for database workflows

### Phase 2: Artifact Understanding
- [ ] Artifact code analysis tool (backend)
- [ ] Artifact code analysis tool (frontend)
- [ ] Artifact pattern library
- [ ] Enhanced artifact generation prompt
- [ ] edit_artifact tool with validation
- [ ] Artifact code diff viewer with preview
- [ ] Unit tests for artifact tools
- [ ] Integration tests for artifact editing

### Phase 3: Database ↔ Artifact Connection
- [ ] Data embedding pattern implementation
- [ ] Connected block creation logic
- [ ] Smart data extraction from databases
- [ ] Artifact generation with embedded data
- [ ] Unit tests for data embedding
- [ ] Integration tests for connected blocks

### Phase 4: Autonomous Workflows
- [ ] Planning phase implementation
- [ ] Reflection checkpoints
- [ ] Error recovery system
- [ ] Progress tracking UI
- [ ] End-to-end workflow tests

---

**This is a careful, incremental approach that builds AI understanding layer by layer.**

Each phase adds capability while maintaining stability. Let me know when you're ready to start Phase 1, and I'll provide detailed implementation code!
