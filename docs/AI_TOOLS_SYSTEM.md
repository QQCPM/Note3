# AI Tools System - Deep Understanding of Databases & Artifacts

## Overview

The Weave AI system now has **20 specialized tools** that enable true understanding and manipulation of databases and artifacts. The AI can:

- Query, aggregate, and analyze database data
- Create charts from databases
- Parse and understand artifact structure
- Modify HTML, CSS, and JavaScript
- Validate and optimize code

## Tool Categories

### Database Tools (10 tools)
Give AI the ability to work with tabular data like a data analyst.

### Artifact Tools (10 tools)
Give AI the ability to understand and modify code like a web developer.

---

## Phase 1: Database Tools

### 1. db_query_rows
**Purpose**: Filter and retrieve specific rows from a database

**When to use**:
- User asks "show me all expenses over $100"
- User wants to find specific records
- Need to filter data before analysis

**Example**:
```javascript
{
  "block_id": "db-123",
  "filter": {"category": "Food", "amount": ">50"},
  "limit": 10
}
```

**Returns**:
```json
{
  "rows": [...],
  "count": 5,
  "total": 100
}
```

---

### 2. db_aggregate
**Purpose**: Perform calculations on a column (sum, avg, count, min, max)

**When to use**:
- "What's the total expense?"
- "What's the average score?"
- "How many items are there?"

**Example**:
```javascript
{
  "block_id": "db-123",
  "operation": "sum",
  "column": "amount",
  "filter": {"category": "Food"}  // Optional
}
```

**Returns**:
```json
{
  "operation": "sum",
  "column": "amount",
  "result": 1250.50,
  "count": 15
}
```

---

### 3. db_group_by
**Purpose**: Group data and perform aggregations on each group

**When to use**:
- "Show total expenses by category"
- "Count students by grade"
- "Average sales per region"

**Example**:
```javascript
{
  "block_id": "db-123",
  "group_by": ["category"],
  "aggregations": [
    {"operation": "sum", "column": "amount", "alias": "total"},
    {"operation": "count", "column": "*", "alias": "count"}
  ]
}
```

**Returns**:
```json
{
  "groups": [
    {"category": "Food", "total": 450, "count": 12},
    {"category": "Transport", "total": 200, "count": 8}
  ],
  "count": 2
}
```

---

### 4. db_column_stats
**Purpose**: Get statistical analysis of a numeric column

**When to use**:
- "Analyze this column"
- "What's the distribution of ages?"
- Need mean, median, mode, std dev

**Example**:
```javascript
{
  "block_id": "db-123",
  "column": "amount"
}
```

**Returns**:
```json
{
  "column": "amount",
  "count": 100,
  "mean": 45.2,
  "median": 40.0,
  "mode": 35.0,
  "std_dev": 12.5,
  "min": 10.0,
  "max": 95.0,
  "range": 85.0
}
```

---

### 5. db_create_chart_data
**Purpose**: Transform database data into chart-ready format

**When to use**:
- "Create a pie chart of expenses by category"
- "Show sales over time as a line chart"
- "Make a bar chart comparing values"

**Example**:
```javascript
{
  "block_id": "db-123",
  "chart_type": "pie",
  "x_column": "category",
  "y_column": "amount"
}
```

**Returns**:
```json
{
  "chart_type": "pie",
  "data": [
    {"x": "Food", "y": 450},
    {"x": "Transport", "y": 200}
  ],
  "x_label": "category",
  "y_label": "amount"
}
```

---

### 6. db_sort_rows
**Purpose**: Sort database rows by one or more columns

**When to use**:
- "Show top 10 expenses"
- "List students by grade descending"
- "Sort alphabetically"

**Example**:
```javascript
{
  "block_id": "db-123",
  "sort_by": [
    {"column": "amount", "direction": "desc"},
    {"column": "date", "direction": "asc"}
  ],
  "limit": 10
}
```

---

### 7. db_get_schema
**Purpose**: Get detailed information about database structure

**When to use**:
- Need to understand column types
- Want sample values
- Building context for other operations

**Example**:
```javascript
{
  "block_id": "db-123"
}
```

**Returns**:
```json
{
  "columns": [
    {
      "name": "category",
      "type": "select",
      "samples": ["Food", "Transport", "Entertainment"]
    },
    {
      "name": "amount",
      "type": "number",
      "samples": [45.0, 30.0, 75.5]
    }
  ],
  "row_count": 100
}
```

---

### 8-10. Modification Tools

- **db_update_rows**: Update rows matching a filter
- **db_add_row**: Add a new row to database
- **db_delete_rows**: Delete rows matching a filter

*(Simplified implementations - use with caution)*

---

## Phase 2: Artifact Tools

### 1. artifact_parse_structure
**Purpose**: Analyze HTML structure of an artifact

**When to use**:
- "What elements are in this artifact?"
- Understanding artifact structure
- Finding specific components

**Example**:
```javascript
{
  "block_id": "artifact-123"
}
```

**Returns**:
```json
{
  "html_length": 1500,
  "tag_counts": {
    "div": 12,
    "button": 3,
    "input": 2
  },
  "has_forms": true,
  "has_scripts": false
}
```

---

### 2. artifact_get_css_rules
**Purpose**: Extract CSS rules and selectors

**When to use**:
- "What styles are applied?"
- "Show me all color definitions"
- Understanding styling

**Example**:
```javascript
{
  "block_id": "artifact-123",
  "selector": ".button"  // Optional filter
}
```

**Returns**:
```json
{
  "css_length": 800,
  "rule_count": 15,
  "selectors": [".container", ".button", "#header"]
}
```

---

### 3. artifact_get_js_functions
**Purpose**: Extract JavaScript function names and signatures

**When to use**:
- "What functions are defined?"
- Understanding artifact behavior
- Finding event handlers

**Example**:
```javascript
{
  "block_id": "artifact-123"
}
```

**Returns**:
```json
{
  "js_length": 1200,
  "function_count": 5,
  "functions": ["handleClick", "updateCounter", "resetState"],
  "has_event_listeners": true
}
```

---

### 4-6. Modification Tools

- **artifact_modify_html**: Modify HTML elements by selector
- **artifact_modify_css**: Add/update/delete CSS rules
- **artifact_modify_js**: Modify JavaScript code

*(Use carefully - modifies actual artifact code)*

---

### 7. artifact_validate
**Purpose**: Check artifact code for errors

**When to use**:
- "Is this artifact valid?"
- "Check for syntax errors"
- Before deploying changes

**Example**:
```javascript
{
  "block_id": "artifact-123"
}
```

**Returns**:
```json
{
  "valid": true,
  "issues": []
}
```

---

### 8. artifact_extract_dependencies
**Purpose**: Find external dependencies (CDN links, scripts, fonts)

**When to use**:
- "What libraries does this use?"
- Understanding dependencies
- Security audit

**Returns**:
```json
{
  "dependencies": [
    "<script src='https://cdn.jsdelivr.net/npm/chart.js'></script>"
  ],
  "count": 1
}
```

---

### 9. artifact_optimize
**Purpose**: Analyze and suggest optimizations

**Types**:
- `size`: Reduce file size
- `performance`: Improve speed
- `accessibility`: Better a11y
- `best_practices`: Code quality

*(Not fully implemented - returns suggestions)*

---

### 10. artifact_get_colors
**Purpose**: Extract all colors used in artifact

**When to use**:
- "What colors are used?"
- Creating color palette
- Design analysis

**Returns**:
```json
{
  "colors": ["#ff0000", "#00ff00", "#0000ff"],
  "count": 3
}
```

---

## Using Tools in AI Chat

### Automatic Tool Calling

When using `ai_chat_with_auto_tools`, the AI automatically:

1. Analyzes user request
2. Determines which tools to use
3. Executes tools
4. Interprets results
5. Provides natural language response

**Example Flow**:

```
User: "What's the total of all expenses in the Food category?"

AI thinks:
1. Need to query database
2. Use db_aggregate with filter

AI calls:
- db_aggregate(block_id, "sum", "amount", {"category": "Food"})

AI receives:
- Result: 450.50

AI responds:
"The total of all Food expenses is $450.50 based on 12 transactions."
```

### Tool Chaining

AI can chain multiple tools:

```
User: "Create a pie chart showing expenses by category"

AI calls:
1. db_get_schema(block_id) → understand structure
2. db_group_by(block_id, ["category"], [sum(amount)]) → get data
3. db_create_chart_data(block_id, "pie", "category", "amount") → format for chart

AI responds:
"I've analyzed the expenses. Here's the breakdown by category: [chart data]"
```

---

## Best Practices

### For Database Tools

1. **Always use db_get_schema first** when working with unfamiliar database
2. **Filter before aggregating** for better performance
3. **Use db_query_rows** before modifications to verify affected rows
4. **Chain tools** for complex analysis

### For Artifact Tools

1. **Parse structure first** to understand artifact
2. **Validate before and after** modifications
3. **Extract functions** to understand behavior
4. **Check dependencies** for security

### Error Handling

Tools return `ToolResult` with:
```typescript
{
  success: boolean,
  data: any,
  error?: string
}
```

Always check `success` before using `data`.

---

## Integration Examples

### Frontend Usage

```typescript
import { aiToolsService } from '@/services/aiTools';

// Query database
const result = await aiToolsService.dbQueryRows(
  'db-123',
  { category: 'Food' },
  10
);

// Get statistics
const stats = await aiToolsService.dbColumnStats('db-123', 'amount');
console.log('Average:', stats.data.mean);

// Parse artifact
const structure = await aiToolsService.artifactParseStructure('artifact-123');
console.log('Has forms:', structure.data.has_forms);

// Chat with auto tools
const response = await aiToolsService.chatWithAutoTools([
  { role: 'user', content: 'Analyze the expenses database' }
], 'note-123');
```

### System Prompt for AI

When AI has access to these tools, include this in system prompt:

```
You have access to 20 specialized tools for working with databases and artifacts:

**Database Tools (10)**:
- db_query_rows, db_aggregate, db_group_by, db_column_stats
- db_create_chart_data, db_sort_rows, db_get_schema
- db_update_rows, db_add_row, db_delete_rows

**Artifact Tools (10)**:
- artifact_parse_structure, artifact_get_css_rules, artifact_get_js_functions
- artifact_modify_html, artifact_modify_css, artifact_modify_js
- artifact_validate, artifact_extract_dependencies, artifact_optimize
- artifact_get_colors

Use these tools to:
1. Deeply understand database structure and content
2. Perform sophisticated data analysis
3. Parse and understand artifact code
4. Make precise modifications
5. Provide insightful answers

Always think step-by-step:
- What information do I need?
- Which tools can provide it?
- How should I chain them?
- What insights can I derive?
```

---

## Performance Tips

1. **Use filters** to reduce data processing
2. **Limit results** when not all data is needed
3. **Cache schema info** - don't call db_get_schema repeatedly
4. **Batch operations** when possible
5. **Validate once** before multiple modifications

---

## Security Considerations

- Modification tools (update, delete, modify) should require user confirmation
- Validate all inputs before execution
- Limit query result sizes to prevent memory issues
- Sandbox artifact execution (already done)
- Check dependencies for security issues

---

## Future Enhancements

### Planned Features

1. **Database**:
   - Join operations across databases
   - Time-series analysis
   - Advanced filtering (regex, ranges)

2. **Artifacts**:
   - Full code formatting
   - Automated testing
   - Performance profiling
   - Security scanning

3. **Cross-tool**:
   - Database → Artifact (generate UI from data)
   - Artifact → Database (extract data to DB)
   - Multi-step workflows

---

## Troubleshooting

### Common Issues

**Q: Tool returns success=false**
A: Check the `error` field for details. Common causes:
- Block not found
- Invalid block type
- Missing parameters

**Q: Empty results from db_query_rows**
A: Verify:
- Filter conditions are correct
- Column names match exactly
- Data exists in database

**Q: artifact_parse_structure returns generic results**
A: HTML parsing is simplified. For detailed parsing:
- Use browser DevTools
- Export to proper HTML parser

---

## API Reference

See `src/services/aiTools.ts` for complete TypeScript API.
See `src-tauri/src/ai/tools.rs` for Rust implementation.

---

## Summary

With these 20 tools, the AI can:

✅ Query and filter database data
✅ Perform aggregations and statistics
✅ Group data and create summaries
✅ Generate chart-ready data
✅ Understand artifact structure
✅ Extract CSS and JavaScript
✅ Validate and optimize code
✅ Analyze dependencies and colors
✅ Make targeted modifications
✅ Provide deep, insightful answers

The AI truly **understands** databases and artifacts now, not just reads them as text.
