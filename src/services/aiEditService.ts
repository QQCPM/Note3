import { useAIStore, type ThinkingStepType } from '@/store/aiStore';
import { useBlocksStore } from '@/store/blocksStore';
import { searchWeb, type SearchResult } from './webSearch';
import { tauriAI, type Tool } from './tauriAI';
import { aiToolsService } from './aiTools';

/**
 * AI Edit Service
 *
 * Provides streaming AI capabilities for direct canvas editing.
 * Integrates with tauriAI for real AI backend, with mock implementation for development.
 */

// ============================================================================
// THINKING STEP HELPERS
// ============================================================================

/**
 * Map tool names to thinking step types for display
 */
function getThinkingStepType(toolName: string): ThinkingStepType {
  if (toolName === 'search_web') return 'search';
  if (toolName === 'read_block' || toolName === 'read_note') return 'read';
  if (toolName === 'edit_block') return 'write';
  if (toolName === 'create_database' || toolName === 'create_artifact') return 'create';
  if (toolName.startsWith('db_') || toolName.startsWith('artifact_')) return 'tool';
  return 'tool';
}

/**
 * Add a thought step that tracks AI processing time
 */
function addThoughtStep(aiStore: ReturnType<typeof useAIStore.getState>): string {
  aiStore.addThinkingStep({
    type: 'thought',
    status: 'running',
    description: 'Thinking...',
  });
  const steps = aiStore.currentThinkingSteps;
  return steps[steps.length - 1]?.id || '';
}

/**
 * Complete a thought step with duration
 */
function completeThoughtStep(
  aiStore: ReturnType<typeof useAIStore.getState>,
  stepId: string,
  description?: string
) {
  if (stepId) {
    aiStore.updateThinkingStep(stepId, {
      status: 'complete',
      description: description || 'Analyzed request',
    });
  }
}

/**
 * Complete all running thinking steps (called when conversation ends)
 */
function completeAllRunningSteps(aiStore: ReturnType<typeof useAIStore.getState>) {
  const runningSteps = aiStore.currentThinkingSteps.filter(s => s.status === 'running');
  for (const step of runningSteps) {
    aiStore.updateThinkingStep(step.id, {
      status: 'complete',
    });
  }
}

/**
 * Get human-readable description for a tool call (IDE-style)
 */
function getToolDescription(toolName: string, args: any): string {
  switch (toolName) {
    case 'search_web':
      const query = args.query?.substring(0, 40) || 'query';
      return `Searching: "${query}${args.query?.length > 40 ? '...' : ''}"`;
    case 'read_block':
      const blockId = args.block_id?.substring(0, 8) || 'block';
      return `Reading block ${blockId}...`;
    case 'read_note':
      const noteId = args.note_id?.substring(0, 8) || 'note';
      return `Reading note ${noteId}...`;
    case 'edit_block':
      const contentLen = args.new_content?.length || 0;
      const lineCount = args.new_content?.split('\n').length || 0;
      return `Editing block (${lineCount} lines, ${contentLen} chars)`;
    case 'create_database':
      const dbTitle = args.prompt?.substring(0, 30) || 'database';
      return `Creating table: ${dbTitle}${args.prompt?.length > 30 ? '...' : ''}`;
    case 'create_artifact':
      const artTitle = args.prompt?.substring(0, 30) || 'artifact';
      return `Creating artifact: ${artTitle}${args.prompt?.length > 30 ? '...' : ''}`;
    case 'db_add_row':
      const rowKeys = Object.keys(args.row_data || {}).length;
      return `Adding row (${rowKeys} columns)`;
    case 'db_update_rows':
      return `Updating rows in database`;
    case 'db_delete_rows':
      return `Deleting rows from database`;
    case 'db_query_rows':
      return `Querying database rows`;
    case 'db_get_schema':
      return `Reading database schema`;
    case 'artifact_modify_html':
      return `Modifying HTML structure`;
    case 'artifact_modify_css':
      return `Updating CSS styles`;
    case 'artifact_modify_js':
      return `Updating JavaScript code`;
    default:
      if (toolName.startsWith('db_')) {
        const opName = toolName.replace('db_', '').replace(/_/g, ' ');
        return `Database: ${opName}`;
      }
      if (toolName.startsWith('artifact_')) {
        const opName = toolName.replace('artifact_', '').replace(/_/g, ' ');
        return `Artifact: ${opName}`;
      }
      return `Executing: ${toolName}`;
  }
}

/**
 * Build citations from search results and add to store
 */
function buildCitationsFromSearch(results: SearchResult[]): string {
  const aiStore = useAIStore.getState();
  const citationTexts: string[] = [];
  
  results.forEach((result) => {
    const citation = aiStore.addCitation({
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      source: result.source || new URL(result.url).hostname,
      publishedDate: result.published_date,
    });
    citationTexts.push(`[${citation.id}] ${result.title}: ${result.snippet}`);
  });
  
  return citationTexts.join('\n');
}

/**
 * Trim conversation history to prevent context window overflow
 * Keeps system prompt + recent messages within character limit
 */
function trimConversationHistory(history: any[], maxChars: number): any[] {
  if (history.length === 0) return history;

  const systemPrompt = history[0]?.role === 'system' ? history[0] : null;
  const messages = systemPrompt ? history.slice(1) : history;

  let totalChars = systemPrompt ? systemPrompt.content.length : 0;
  const trimmedMessages: any[] = [];

  // Add messages from most recent, working backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgLength = JSON.stringify(msg).length;

    if (totalChars + msgLength > maxChars) {
      console.log(`⚠️ Conversation history trimmed: kept ${trimmedMessages.length} of ${messages.length} messages`);
      break;
    }

    trimmedMessages.unshift(msg);
    totalChars += msgLength;
  }

  // Always include system prompt at the beginning
  return systemPrompt ? [systemPrompt, ...trimmedMessages] : trimmedMessages;
}

// Tool definitions for AI function calling
export const AI_EDIT_TOOLS: Tool[] = [
  {
    type: 'function' as const,
    function: {
      name: 'read_block',
      description: 'Read the content of ANY block by its ID. Use this to read other blocks (not the current one shown in context).',
      parameters: {
        type: 'object',
        properties: {
          block_id: {
            type: 'string',
            description: 'The ID of the block to read',
          },
        },
        required: ['block_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_note',
      description: 'Read the ENTIRE note with ALL blocks (text, headings, databases, artifacts, etc). Use this when you need to understand the full context of a note.',
      parameters: {
        type: 'object',
        properties: {
          note_id: {
            type: 'string',
            description: 'The ID of the note to read',
          },
        },
        required: ['note_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'edit_block',
      description: 'Edit the content of a text block on the canvas. Use this when the user asks you to add, modify, or improve TEXT content (explanations, articles, notes). Keywords: "write about", "make a note about", "explain", "describe", "tell me about". Do NOT use this for structured tables - use create_database instead.',
      parameters: {
        type: 'object',
        properties: {
          block_id: {
            type: 'string',
            description: 'The ID of the block to edit',
          },
          new_content: {
            type: 'string',
            description: 'The new markdown content for the block (supports markdown formatting)',
          },
          reason: {
            type: 'string',
            description: 'Brief explanation of why you made these changes',
          },
        },
        required: ['block_id', 'new_content', 'reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_web',
      description: 'Search the web for current information. Use this when you need up-to-date facts, research, or information not in your training data.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_artifact',
      description: 'Create a new interactive HTML/CSS/JavaScript artifact block. Use this ONLY when user wants to create INTERACTIVE visualizations, simulations, timers, calculators, games, animations. Keywords: "simulation", "timer", "calculator", "game", "interactive", "animate". Do NOT use this for simple text notes or data tables.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed description of what interactive artifact to create (e.g., "pomodoro timer with sound", "black hole simulation with gravity")',
          },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_database',
      description: 'Create a new database/table block with columns for STRUCTURED data. Use this ONLY when user wants to create tables, databases, spreadsheets, lists with multiple columns. Keywords: "create table", "make a database", "top 10 X", "comparison table", "list with columns". Returns a block_id that you can use with db_add_row to populate the table. Do NOT use this for simple text notes.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Description of what database to create (e.g., "top 10 largest black holes", "expense tracker")',
          },
        },
        required: ['prompt'],
      },
    },
  },
];

interface StreamChatOptions {
  blockId: string;
  userMessage: string;
  onStream?: (chunk: string) => void;
  onToolCall?: (toolName: string, args: any) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Stream AI chat with editing capabilities
 * Integrates with tauriAI when available, falls back to mock
 */
export async function streamAIEditChat(options: StreamChatOptions): Promise<void> {
  const { userMessage, onComplete, onError } = options;
  const aiStore = useAIStore.getState();

  try {
    console.log('🚀 streamAIEditChat called with:', userMessage);
    aiStore.setLoading(true);
    aiStore.setCurrentRequest(userMessage);

    // NOTE: User message should be added by the caller (StartingPage/AIInput)
    // to avoid duplicate messages in the chat

    // Check if tauriAI is initialized
    const useTauriAI = tauriAI.isInitialized();
    console.log('🔍 TauriAI initialized:', useTauriAI);

    if (useTauriAI) {
      // Use real tauriAI service
      console.log('✅ Using real TauriAI backend');
      await streamWithTauriAI(options);
    } else {
      // Use mock implementation for development
      console.log('⚠️ Using mock implementation');
      await streamWithMock(options);
    }

    console.log('✅ Stream completed successfully');
    onComplete?.();
  } catch (error) {
    console.error('❌ AI edit stream error:', error);
    onError?.(error as Error);
    aiStore.addMessage({
      role: 'assistant',
      content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  } finally {
    // Ensure all running steps are marked complete before finishing
    completeAllRunningSteps(aiStore);
    aiStore.setLoading(false);
    aiStore.setCurrentRequest(null);
  }
}

/**
 * Get all available tools (4 core editing tools + 20 advanced tools)
 */
async function getAllAvailableTools(): Promise<Tool[]> {
  try {
    // Get advanced database and artifact tools from backend
    const advancedTools = await aiToolsService.getAllTools();

    // Convert to Tool format
    const convertedAdvancedTools: Tool[] = advancedTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    // Combine with core editing tools
    return [...AI_EDIT_TOOLS, ...convertedAdvancedTools];
  } catch (error) {
    console.warn('⚠️ Failed to load advanced tools, using core tools only:', error);
    return AI_EDIT_TOOLS;
  }
}

/**
 * Stream with real Tauri AI backend
 */
async function streamWithTauriAI(options: StreamChatOptions): Promise<void> {
  const { blockId, userMessage, onStream, onToolCall } = options;
  const aiStore = useAIStore.getState();
  const blocksStore = useBlocksStore.getState();

  console.log('🎯 streamWithTauriAI: blockId =', blockId);
  onStream?.('Using AI backend...\n');

  // Get current block and its note_id
  const currentBlock = blocksStore.blocks.find((b) => b.id === blockId);
  const noteId = currentBlock?.note_id || 'unknown';

  // Get current block content first
  let currentBlockContent = '[Empty block]';
  try {
    console.log('📖 Reading current block content:', blockId);
    currentBlockContent = await tauriAI.readBlock(blockId);
    console.log('📄 Current block content:', currentBlockContent);
  } catch (error) {
    console.error('⚠️ Failed to read current block:', error);
    // Try to get from store as fallback
    if (currentBlock && currentBlock.data) {
      currentBlockContent = (currentBlock.data as any).content || (currentBlock.data as any).text || '[Could not read block content]';
    }
  }

  // System prompt that instructs AI to use tools
  const systemPrompt = `You are an INTELLIGENT AI assistant that understands context and chooses the RIGHT tool for the job.

CURRENT CONTEXT:
- Current Block ID: ${blockId}
- Current Note ID: ${noteId}

CURRENT BLOCK CONTENT:
\`\`\`
${currentBlockContent}
\`\`\`

===========================================
OUTPUT STYLE - BE CONCISE:
===========================================

**IMPORTANT: Keep your responses brief and clean.**

✅ DO:
- Work silently using tools
- Output only: "Working..." or "Creating table..." while processing
- When done, give a brief 1-2 sentence summary
- Let the UI show the results (table appears automatically)

❌ DO NOT:
- Output lengthy explanations of what you're doing
- List every row you're adding
- Describe all the details you found
- Ask if the user wants more

**Example of GOOD output:**
User: "make table of 3 planets"
AI: "Creating table..." → [uses tools silently] → "Created table with 3 planets."

**Example of BAD output (too verbose):**
User: "make table of 3 planets"  
AI: "I've filled your table with three rows: Jupiter – Gas giant, Mean Radius ≈ 69,911 km, Mass ≈ 317.8 Earths..." ❌

**Remember: Less talk, more action. The UI shows the results - you don't need to describe them.**


===========================================
GPT-5.2 REASONING INSTRUCTIONS:
===========================================

You are using GPT-5.2 with ADVANCED REASONING capabilities. Use step-by-step thinking:

**FOR TABLE CREATION & FILLING:**
1. ANALYZE: Identify ALL columns needed (not just 2-3, think of ALL relevant data points)
2. PLAN: For each column, determine what search queries will find that information
3. SEARCH: Execute searches to gather comprehensive data for ALL columns
4. VERIFY: Ensure you have data for EVERY column before adding a row
5. ADD ROW: Only call db_add_row when ALL column values are ready
6. REPEAT: Do this for EVERY row the user requested

**CRITICAL: FILL ALL COLUMNS**
- If table has 6 columns, provide data for ALL 6 columns in each row
- Don't leave columns empty unless data is truly unavailable
- Search multiple times if needed to find all information
- Example: For planets, search for "planet diameter", "planet mass", "planet distance", etc.

**STEP-BY-STEP EXECUTION:**
When user says "create table of top 5 X":
   Step 1: Think about what columns make sense (name, mass, size, distance, type, etc.)
   Step 2: Create database with ALL relevant columns
   Step 3: Search for "top 5 X" to get general info
   Step 4: For EACH column, search specifically: "X mass", "X diameter", "X distance"
   Step 5: Combine all data for row 1, then call db_add_row
   Step 6: Repeat for rows 2, 3, 4, 5
   Step 7: Verify ALL 5 rows have ALL column values filled


**CRITICAL RULES - READ FIRST:**

1. **"LIST OF X" = TABLE, NOT TEXT**
   - "make a list of 5 tallest buildings" → create_database (NOT edit_block!)
   - "complete list of X" → create_database
   - "I want a list of X" → create_database
   - Exception: Only use edit_block if user specifically says "write a paragraph about X"

2. **MAINTAIN CONTEXT**
   - Remember what the user just asked for
   - If user says "list of buildings" then "table", create table of BUILDINGS (not something else!)
   - Keep conversation history in mind

3. **IMMEDIATE ACTION**
   - Don't give text responses when user wants a table
   - If user asks for "list of X", immediately create_database
   - Don't explain what you'll do - just do it

===========================================
DECISION TREE - CHOOSE THE RIGHT TOOL:
===========================================

**STEP 1: Understand what the user wants**

🔹 USER WANTS TEXT/EXPLANATION/ARTICLE?
   Keywords: "write about", "explain", "make a note about", "tell me about", "describe"
   → Use: edit_block (add rich text content to current block)
   Example: "make a note about the sun" → edit_block with detailed text about the sun

🔹 USER WANTS STRUCTURED DATA/TABLE?
   Keywords: "create table", "make a database", "list of X", "complete list of X", "top 10 X", "top 5 X", "tallest X", "largest X", "comparison table"
   → Use: create_database (structured data with rows/columns)
   Example: "create table of planets" → create_database with planet columns

🔹 USER WANTS INTERACTIVE HTML/JS ARTIFACT?
   Keywords: "create timer", "make a simulation", "build a calculator", "interactive", "game", "animation"
   → Use: create_artifact (HTML/CSS/JS)
   Example: "create a pomodoro timer" → create_artifact

🔹 USER WANTS TO FILL EXISTING TABLE?
   Keywords: "fill the table", "populate with data", "add X to database"
   → Use: search_web + db_add_row (multiple times)
   Example: "fill the table with black holes" → search + add each row

🔹 USER WANTS MULTIPLE THINGS (TEXT + TABLE + ARTIFACT)?
   Keywords: "complete note about X with a table of Y", "note with table and simulation"
   → Do them IN ORDER:
   1. First: edit_block (add text explanation)
   2. Then: create_database (structured data)
   3. Then: search_web + db_add_row (populate)
   4. Finally: create_artifact (if requested)
   Example: "complete note about black holes with top 5 table and simulation"
   Step 1: edit_block with text about black holes
   Step 2: create_database for top 5
   Step 3: search_web + db_add_row (5 times)
   Step 4: create_artifact for simulation

===========================================
AVAILABLE TOOLS (26 total):
===========================================

**Core Editing Tools:**
1. edit_block(block_id, new_content, reason)
   - Use for: Text content, explanations, articles, notes
   - Example: "make a note about the sun" → edit_block with detailed info

2. read_block(block_id)
   - Use for: Reading specific blocks

3. read_note(note_id) [Current: ${noteId}]
   - Use for: Understanding full note context, finding database blocks

4. search_web(query)
   - Use for: Getting real, up-to-date information
   - ALWAYS use this for facts, data, research

**Creation Tools:**
5. create_database(prompt)
   - Use for: Creating NEW tables with structured data
   - Returns: block_id (use this with db_add_row)
   - Example: "create table of planets with name, size, distance"

6. create_artifact(prompt)
   - Use for: Interactive HTML/CSS/JS visualizations
   - Example: "create a timer", "black hole simulation"

**Database Tools (use AFTER database exists):**
7. db_add_row(block_id, row_data)
   - Use for: Adding ONE row to existing database
   - CRITICAL: row_data must be object with column names as keys
   - CRITICAL: Provide values for ALL columns, not just 1-2! Fill every column!
   - Example: db_add_row("db123", {
       "Name": "Sun",
       "Mass": "1.989 × 10^30 kg",
       "Diameter": "1.3927 million km",
       "Distance": "150 million km",
       "Type": "G-type main sequence star",
       "Temperature": "5,778 K"
     })
   - Call this MULTIPLE TIMES to add multiple rows!

8. db_update_rows, db_delete_rows, db_query_rows, db_aggregate
9. db_group_by, db_column_stats, db_sort_rows, db_get_schema, db_create_chart_data

**Artifact Tools (use AFTER artifact exists):**
10. artifact_modify_html, artifact_modify_css, artifact_modify_js
11. artifact_parse_structure, artifact_get_css_rules, artifact_validate, etc.

===========================================
CRITICAL RULES:
===========================================

**Rule 1: CHOOSE THE RIGHT TOOL**
❌ Don't create databases for text requests
✅ "make a note about X" → edit_block (text)
✅ "create table of X" → create_database (structured data)
✅ "make a timer" → create_artifact (interactive)

**Rule 2: FORMAT db_add_row CORRECTLY**
❌ WRONG: db_add_row(block_id, "some data")
✅ CORRECT: db_add_row("block123", {"Name": "Sun", "Mass": "1.989e30 kg"})

The row_data MUST be an object where:
- Keys = EXACT column names from database
- Values = data for that column

**Rule 3: COMPLETE MULTI-STEP WORKFLOWS**
If user says "fill table with 10 items":
1. read_note to find database block_id
2. search_web to get real data
3. db_add_row for item 1
4. db_add_row for item 2
5. ... db_add_row for item 10
6. Confirm completion

DON'T STOP after searching - ADD ALL ROWS!

**Rule 4: BE PROACTIVE BUT SMART**
- "yes" = proceed with last offered action
- "fill" = search_web + db_add_row (multiple calls)
- Don't ask permission - just execute

**Rule 5: LaTeX FORMATTING (CRITICAL)**
When writing mathematical formulas or equations:
- ✅ USE: Single dollar signs for inline math: $x^2 + y^2 = r^2$
- ✅ USE: Double dollar signs for display/block math ON A SINGLE LINE:
  $$E = mc^2$$
  $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$

CRITICAL RULES:
- ❌ NEVER use: \\[ ... \\] or [ ... ] for display math
- ❌ NEVER use: \\( ... \\) or ( ... ) for inline math
- ❌ NEVER use: Plain brackets like [ V = \\frac{1}{3} B h ]
- ❌ NEVER split a formula across multiple lines - keep $$ on SAME line as formula
- ❌ NEVER put text immediately after closing $$

CORRECT (single line):
$$ds^2 = -c^2 dt^2 + dr^2 + r^2 d\\Omega^2$$

WRONG (split across lines - will break rendering):
$$ds^2 = -c^2 dt^2 
+ dr^2 + r^2 d\\Omega^2$$

WRONG (text immediately after):
$$V = \\frac{1}{3} B h$$ where B is...

CORRECT (text on new line):
$$V = \\frac{1}{3} B h$$

where B is the base area.

- For fractions use \\frac{a}{b}, for integrals use \\int, for sums use \\sum

**Rule 6: CITATIONS**
When using information from web search results:
- ✅ DO: Cite sources inline using [1], [2], [3] format
- ✅ DO: Place citations immediately after the relevant fact
- ✅ DO: Use the citation numbers provided in search results
Example: "Black holes can have masses billions of times that of our Sun [1]. The largest known black hole, TON 618, has a mass of 66 billion solar masses [2]."

===========================================
EXAMPLES - STUDY CAREFULLY:
===========================================

**Example 1: Text Note (use edit_block)**
User: "make a note about the sun pls"
Analysis: User wants TEXT explanation, not a table
Action:
1. search_web("sun facts and information")
2. edit_block(${blockId}, "# The Sun\n\nThe Sun is a G-type main sequence star...", "Added comprehensive information about the sun")
Result: ✅ Text content added to current block

**Example 2: Create and Fill Table**
User: "create table of top 5 largest black holes"
Analysis: User wants STRUCTURED DATA with rows
Actions:
1. create_database("table of top 5 largest black holes with name, mass, distance")
   → Returns block_id: "db456"
2. search_web("top 5 largest black holes by mass")
3. db_add_row("db456", {"Name": "TON 618", "Mass": "66 billion solar masses", "Distance": "10.4 billion light years"})
4. db_add_row("db456", {"Name": "Phoenix A", "Mass": "100 billion solar masses", "Distance": "5.8 billion light years"})
5. db_add_row("db456", {"Name": "Holmberg 15A", "Mass": "40 billion solar masses", "Distance": "700 million light years"})
6. db_add_row("db456", {"Name": "IC 1101", "Mass": "40-100 billion solar masses", "Distance": "1.04 billion light years"})
7. db_add_row("db456", {"Name": "NGC 6166", "Mass": "30 billion solar masses", "Distance": "490 million light years"})
Result: ✅ Database created and populated with 5 rows

**Example 3: Fill Existing Table**
User: "fill the table"
Context: Note has empty database
Actions:
1. read_note(${noteId}) → Find database block_id and columns
2. search_web based on database title/context
3. db_add_row for each item
Result: ✅ Database populated

**Example 4: Create Artifact**
User: "make a black hole simulation"
Analysis: User wants INTERACTIVE visualization
Action:
1. create_artifact("interactive black hole simulation with gravity visualization")
Result: ✅ HTML/CSS/JS artifact created

**Example 5: MULTI-PART REQUEST (Text + Table + Artifact)**
User: "Create a complete note about black holes with a table of the top 5 largest ones and a simulation"
Analysis: User wants THREE things - text, table, AND artifact
Actions IN ORDER:
1. search_web("black holes comprehensive information")
2. edit_block(${blockId}, "# Black Holes\n\nBlack holes are regions of spacetime...", "Added comprehensive info about black holes")
3. create_database("top 5 largest black holes with name, mass, distance")
   → Returns block_id: "db789"
4. search_web("top 5 largest black holes by mass")
5. db_add_row("db789", {"Name": "TON 618", "Mass": "66 billion solar masses", "Distance": "10.4 billion light years"})
6. db_add_row("db789", {"Name": "Phoenix A", "Mass": "100 billion solar masses", "Distance": "5.8 billion light years"})
7. db_add_row("db789", {"Name": "Holmberg 15A", "Mass": "40 billion solar masses", "Distance": "700 million light years"})
8. db_add_row("db789", {"Name": "IC 1101", "Mass": "40-100 billion solar masses", "Distance": "1.04 billion light years"})
9. db_add_row("db789", {"Name": "NGC 6166", "Mass": "30 billion solar masses", "Distance": "490 million light years"})
10. create_artifact("interactive black hole simulation with gravity visualization and event horizon")
Result: ✅ Text content + Populated database + Interactive simulation - ALL COMPLETE!

===========================================
REMEMBER:
===========================================
✅ Text/explanation → edit_block
✅ Table/structured data → create_database
✅ Interactive/simulation → create_artifact
✅ Fill table → search_web + db_add_row (multiple)
✅ db_add_row requires: {"ColumnName": "value"} format
✅ Complete all steps in multi-step workflows!
✅ Multi-part requests: Do text FIRST, then table, then artifact!

NOW USE YOUR INTELLIGENCE TO CHOOSE THE RIGHT TOOL! 🧠`;

  // Multi-turn conversation with tools
  try {
    // Get all available tools (4 core + 20 advanced)
    const allTools = await getAllAvailableTools();
    console.log(`🛠️ Loaded ${allTools.length} tools (4 core + ${allTools.length - 4} advanced)`);

    // Initialize conversation history
    const conversationHistory: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    let maxTurns = 15; // Allow enough turns for multi-step workflows (search + add 10 rows)
    let currentTurn = 0;

    while (currentTurn < maxTurns) {
      currentTurn++;
      console.log(`📞 Turn ${currentTurn}: Calling tauriAI.chatWithTools...`);

      // Add thought step to track AI processing time
      const thoughtStepId = addThoughtStep(aiStore);

      // Trim conversation history if it gets too long
      // Conservative estimate: 1 char ≈ 0.25 tokens, limit to ~50K tokens
      const trimmedHistory = trimConversationHistory(conversationHistory, 200000); // 200K chars ≈ 50K tokens

      const result = await tauriAI.chatWithTools(trimmedHistory, allTools);
      
      // Complete the thought step
      completeThoughtStep(aiStore, thoughtStepId, 'Analyzed request');

      console.log('📥 Got result:', result);
      console.log('🔧 Tool calls:', result.tool_calls);

      // Add assistant's response to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: result.content,
      });

      // Show assistant message to user
      aiStore.addMessage({
        role: 'assistant',
        content: result.content,
        toolCalls: result.tool_calls?.map((tc) => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        })),
      });

      // Handle tool calls
      if (result.tool_calls && result.tool_calls.length > 0) {
        console.log(`🛠️ Processing ${result.tool_calls.length} tool calls`);

        let shouldContinue = false;

        for (const toolCall of result.tool_calls) {
          // OpenAI returns: { function: { name: "...", arguments: "..." } }
          const functionName = (toolCall as any).function?.name || toolCall.name;
          const functionArgs = (toolCall as any).function?.arguments || toolCall.arguments;

          // Parse arguments if it's a JSON string
          const parsedArgs = typeof functionArgs === 'string'
            ? JSON.parse(functionArgs)
            : functionArgs;

          console.log(`🔨 Tool call: ${functionName}`, parsedArgs);
          onToolCall?.(functionName, parsedArgs);

          // Add thinking step for this tool call
          const stepDescription = getToolDescription(functionName, parsedArgs);
          aiStore.addThinkingStep({
            type: getThinkingStepType(functionName),
            status: 'running',
            description: stepDescription,
          });
          const currentSteps = aiStore.currentThinkingSteps;
          const currentStepId = currentSteps[currentSteps.length - 1]?.id;

          if (functionName === 'read_block') {
            console.log('📖 Reading block:', parsedArgs.block_id);
            try {
              const blockContent = await tauriAI.readBlock(parsedArgs.block_id);
              console.log('📄 Block content:', blockContent);

              // Add tool result to conversation
              conversationHistory.push({
                role: 'user',
                content: `[Block ${parsedArgs.block_id} content]:\n${blockContent}`,
              });

              // Update thinking step
              if (currentStepId) {
                aiStore.updateThinkingStep(currentStepId, {
                  status: 'complete',
                  details: `Read ${blockContent.length} characters`,
                });
              }

              shouldContinue = true;
              onStream?.(`\n📖 Read block content (${blockContent.length} chars)\n`);
            } catch (error) {
              console.error('❌ Failed to read block:', error);
              if (currentStepId) {
                aiStore.updateThinkingStep(currentStepId, {
                  status: 'error',
                  details: `Error: ${error}`,
                });
              }
              conversationHistory.push({
                role: 'user',
                content: `[Error reading block]: ${error}`,
              });
            }
          } else if (functionName === 'read_note') {
            console.log('📚 Reading entire note:', parsedArgs.note_id);
            try {
              const noteContent = await tauriAI.getNoteContext(parsedArgs.note_id);
              console.log('📝 Note content:', noteContent);

              // Add tool result to conversation
              conversationHistory.push({
                role: 'user',
                content: `[Full note content]:\n${noteContent}`,
              });

              // Update thinking step
              if (currentStepId) {
                aiStore.updateThinkingStep(currentStepId, {
                  status: 'complete',
                  details: `Read ${noteContent.length} characters`,
                });
              }

              shouldContinue = true;
              onStream?.(`\n📚 Read full note (${noteContent.length} chars)\n`);
            } catch (error) {
              console.error('❌ Failed to read note:', error);
              if (currentStepId) {
                aiStore.updateThinkingStep(currentStepId, {
                  status: 'error',
                  details: `Error: ${error}`,
                });
              }
              conversationHistory.push({
                role: 'user',
                content: `[Error reading note]: ${error}`,
              });
            }
          } else if (functionName === 'edit_block') {
            const block = blocksStore.blocks.find((b) => b.id === blockId);
            console.log('📝 Found block:', block);
            if (block) {
              console.log('✏️ Adding pending edit');
              aiStore.addPendingEdit({
                blockId,
                originalContent: (block.data as any).content || '',
                proposedContent: parsedArgs.new_content,
                diffHunks: [], // Simplified - no granular diff for now
                reason: parsedArgs.reason || 'AI-generated content',
              });
              // Update thinking step
              if (currentStepId) {
                aiStore.updateThinkingStep(currentStepId, {
                  status: 'complete',
                  details: 'Content changes prepared for review',
                });
              }
            } else {
              console.error('❌ Block not found:', blockId);
              if (currentStepId) {
                aiStore.updateThinkingStep(currentStepId, {
                  status: 'error',
                  details: 'Block not found',
                });
              }
            }
          } else if (functionName === 'search_web') {
            const results = await searchWeb(parsedArgs.query);
            onStream?.(`\n✅ Found ${results.length} results\n`);

            // Build citations from search results
            const citationSummary = buildCitationsFromSearch(results);

            // Add search results to conversation with citation IDs
            conversationHistory.push({
              role: 'user',
              content: `[Search results for "${parsedArgs.query}"]: \n${citationSummary}\n\nIMPORTANT: Use these citations inline in your response with [1], [2], etc. format.`,
            });

            // Update thinking step
            if (currentStepId) {
              aiStore.updateThinkingStep(currentStepId, {
                status: 'complete',
                details: `Found ${results.length} sources`,
              });
            }

            shouldContinue = true;
          } else if (functionName === 'create_artifact') {
            console.log('🎨 Creating artifact:', parsedArgs.prompt);
            try {
              onStream?.(`\n🎨 Generating interactive artifact...\n`);

              const result = await tauriAI.generateArtifact(parsedArgs.prompt);

              // Create new artifact block
              const noteBlocks = blocksStore.blocks.filter((b) => b.note_id === noteId);
              const { createBlock } = await import('@/utils/tauri');

              const artifactData: import('@/types').ArtifactBlockData = {
                type: 'artifact' as const,
                prompt: parsedArgs.prompt,
                title: result.title,
                html: result.html,
                css: result.css,
                javascript: result.javascript,
              };

              const newBlock = await createBlock({
                note_id: noteId,
                type: 'artifact',
                position: noteBlocks.length,
                data: artifactData,
              });

              blocksStore.addBlock(newBlock);

              onStream?.(`\n✅ Created artifact: ${result.title}\n`);

              // Update thinking step
              if (currentStepId) {
                aiStore.updateThinkingStep(currentStepId, {
                  status: 'complete',
                  details: `Created "${result.title}"`,
                });
              }

              conversationHistory.push({
                role: 'user',
                content: `[Artifact created successfully]: "${result.title}" has been added to the note`,
              });

              shouldContinue = true;
            } catch (error) {
              console.error('❌ Failed to create artifact:', error);
              if (currentStepId) {
                aiStore.updateThinkingStep(currentStepId, {
                  status: 'error',
                  details: `Error: ${error}`,
                });
              }
              conversationHistory.push({
                role: 'user',
                content: `[Error creating artifact]: ${error}`,
              });
            }
          } else if (functionName === 'create_database') {
            console.log('🗄️ Creating database:', parsedArgs.prompt);
            try {
              onStream?.(`\n🗄️ Generating database...\n`);

              const result = await tauriAI.generateDatabase(parsedArgs.prompt);

              // Create new database block
              const noteBlocks = blocksStore.blocks.filter((b) => b.note_id === noteId);
              const { createBlock } = await import('@/utils/tauri');
              const { nanoid } = await import('nanoid');

              const columns = result.columns.map((col: any) => ({
                id: col.id || nanoid(), // Use backend ID if provided, generate fallback
                name: col.name,
                type: (col.type || col.column_type) as 'text' | 'number' | 'date' | 'select' | 'checkbox',
                options: col.options,
              }));

              const dbData: import('@/types').DatabaseBlockData = {
                type: 'database' as const,
                title: result.title,
                columns,
                rows: [],
                view: 'table',
              };

              const newBlock = await createBlock({
                note_id: noteId,
                type: 'database',
                position: noteBlocks.length,
                data: dbData,
              });

              blocksStore.addBlock(newBlock);

              onStream?.(`\n✅ Created database: ${result.title} (${columns.length} columns)\n`);

              // Update thinking step
              if (currentStepId) {
                aiStore.updateThinkingStep(currentStepId, {
                  status: 'complete',
                  details: `Created "${result.title}" with ${columns.length} columns`,
                });
              }

              // Return the block ID so AI can populate it
              conversationHistory.push({
                role: 'user',
                content: `[Database created successfully]: "${result.title}" has been added to the note with block_id: ${newBlock.id}. You can now use db_add_row with this block_id to populate it with data.`,
              });

              shouldContinue = true;
            } catch (error) {
              console.error('❌ Failed to create database:', error);
              if (currentStepId) {
                aiStore.updateThinkingStep(currentStepId, {
                  status: 'error',
                  details: `Error: ${error}`,
                });
              }
              conversationHistory.push({
                role: 'user',
                content: `[Error creating database]: ${error}`,
              });
            }
          } else if (functionName.startsWith('db_')) {
            // Database tool execution
            console.log(`🗄️ Executing database tool: ${functionName}`, parsedArgs);
            try {
              const result = await aiToolsService.executeTool(functionName, parsedArgs);

              if (result.success) {
                onStream?.(`\n✅ ${functionName} completed\n`);

                // If db_add_row or other mutation, refresh the block from database
                if (['db_add_row', 'db_update_rows', 'db_delete_rows'].includes(functionName)) {
                  const blockId = parsedArgs.block_id;
                  if (blockId) {
                    try {
                      // Reload the block from database
                      const { getBlock } = await import('@/utils/tauri');
                      const updatedBlock = await getBlock(blockId);

                      // Update the block in the store - FIX: pass blockId and updates separately
                      blocksStore.updateBlock(blockId, updatedBlock);

                      console.log(`🔄 Refreshed block ${blockId} after ${functionName}`);
                      console.log(`📊 Updated block data:`, updatedBlock.data);
                    } catch (refreshError) {
                      console.warn(`⚠️ Failed to refresh block after ${functionName}:`, refreshError);
                    }
                  }
                }

                // Update thinking step
                if (currentStepId) {
                  aiStore.updateThinkingStep(currentStepId, {
                    status: 'complete',
                    details: functionName === 'db_add_row' ? 'Row added successfully' : 'Operation completed',
                  });
                }

                // Add tool result to conversation
                conversationHistory.push({
                  role: 'user',
                  content: `[${functionName} result]: ${JSON.stringify(result.data, null, 2)}`,
                });

                shouldContinue = true;
              } else {
                console.error(`❌ Database tool failed:`, result.error);
                if (currentStepId) {
                  aiStore.updateThinkingStep(currentStepId, {
                    status: 'error',
                    details: `Error: ${result.error}`,
                  });
                }
                conversationHistory.push({
                  role: 'user',
                  content: `[Error in ${functionName}]: ${result.error}`,
                });
              }
            } catch (error) {
              console.error(`❌ Failed to execute ${functionName}:`, error);
              if (currentStepId) {
                aiStore.updateThinkingStep(currentStepId, {
                  status: 'error',
                  details: `Error: ${error}`,
                });
              }
              conversationHistory.push({
                role: 'user',
                content: `[Error executing ${functionName}]: ${error}`,
              });
            }
          } else if (functionName.startsWith('artifact_')) {
            // Artifact tool execution
            console.log(`🎨 Executing artifact tool: ${functionName}`, parsedArgs);
            try {
              const result = await aiToolsService.executeTool(functionName, parsedArgs);

              if (result.success) {
                onStream?.(`\n✅ ${functionName} completed\n`);

                // Update thinking step
                if (currentStepId) {
                  aiStore.updateThinkingStep(currentStepId, {
                    status: 'complete',
                    details: 'Artifact operation completed',
                  });
                }

                // Add tool result to conversation
                conversationHistory.push({
                  role: 'user',
                  content: `[${functionName} result]: ${JSON.stringify(result.data, null, 2)}`,
                });

                shouldContinue = true;
              } else {
                console.error(`❌ Artifact tool failed:`, result.error);
                if (currentStepId) {
                  aiStore.updateThinkingStep(currentStepId, {
                    status: 'error',
                    details: `Error: ${result.error}`,
                  });
                }
                conversationHistory.push({
                  role: 'user',
                  content: `[Error in ${functionName}]: ${result.error}`,
                });
              }
            } catch (error) {
              console.error(`❌ Failed to execute ${functionName}:`, error);
              if (currentStepId) {
                aiStore.updateThinkingStep(currentStepId, {
                  status: 'error',
                  details: `Error: ${error}`,
                });
              }
              conversationHistory.push({
                role: 'user',
                content: `[Error executing ${functionName}]: ${error}`,
              });
            }
          }
        }

        // If we executed a tool that needs follow-up, continue the conversation
        if (shouldContinue) {
          continue;
        } else {
          // If edit_block was called, we're done
          break;
        }
      } else {
        // No tool calls, we're done
        console.log('✅ No more tool calls, conversation complete');
        break;
      }
    }

    if (currentTurn >= maxTurns) {
      console.warn('⚠️ Max turns reached, ending conversation');
    }

    // Complete any remaining running steps before finishing
    completeAllRunningSteps(aiStore);
  } catch (error) {
    console.error('❌ TauriAI error:', error);
    // Complete any running steps even on error
    completeAllRunningSteps(aiStore);
    throw error;
  }
}

/**
 * Mock streaming implementation for development
 */
async function streamWithMock(options: StreamChatOptions): Promise<void> {
  const { blockId, userMessage, onStream, onToolCall } = options;
  const aiStore = useAIStore.getState();
  const blocksStore = useBlocksStore.getState();

  // Simulate streaming thinking process
  const thinkingSteps = [
    'Analyzing your request...',
    'Understanding the context...',
    'Preparing response...',
  ];

  for (const step of thinkingSteps) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    onStream?.(step + '\n');
  }

  // Detect intent and call appropriate function
  const lowerMessage = userMessage.toLowerCase();

  // Check if web search is needed
  if (
    lowerMessage.includes('search') ||
    lowerMessage.includes('latest') ||
    lowerMessage.includes('current') ||
    lowerMessage.includes('what is') ||
    lowerMessage.includes('tell me about')
  ) {
    // Extract search query
    const searchQuery = extractSearchQuery(userMessage);

    onStream?.(`\n🔍 Searching web for: "${searchQuery}"\n`);
    onToolCall?.('search_web', { query: searchQuery });

    // Perform web search
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const searchResults = await searchWeb(searchQuery);

    onStream?.(`\n✅ Found ${searchResults.length} results\n`);
    onStream?.(`\n📝 Generating content from sources...\n`);

    // Generate content based on search results
    const generatedContent = await generateContentFromSearch(searchQuery, searchResults);

    // Get current block
    const block = blocksStore.blocks.find((b) => b.id === blockId);
    if (!block) {
      throw new Error('Block not found');
    }

    // Call edit_block tool
    onToolCall?.('edit_block', {
      block_id: blockId,
      new_content: generatedContent,
      reason: `Added comprehensive information about "${searchQuery}" based on web research`,
    });

    // Add to pending edits
    aiStore.addPendingEdit({
      blockId,
      originalContent: (block.data as any).content || '',
      proposedContent: generatedContent,
      diffHunks: [], // Simplified - no granular diff for now
      reason: `Added information about "${searchQuery}"`,
    });

    // Add assistant message
    aiStore.addMessage({
      role: 'assistant',
      content: `I've researched "${searchQuery}" and prepared an edit with the latest information. Review the changes and accept or reject them.`,
      toolCalls: [
        {
          id: `call-${Date.now()}`,
          name: 'edit_block',
          arguments: {
            block_id: blockId,
            new_content: generatedContent,
            reason: `Research on ${searchQuery}`,
          },
        },
      ],
    });
  } else if (
    lowerMessage.includes('add') ||
    lowerMessage.includes('write') ||
    lowerMessage.includes('create') ||
    lowerMessage.includes('make')
  ) {
    // Direct edit request
    const content = generateContentFromPrompt(userMessage);

    const block = blocksStore.blocks.find((b) => b.id === blockId);
    if (!block) {
      throw new Error('Block not found');
    }

    onToolCall?.('edit_block', {
      block_id: blockId,
      new_content: content,
      reason: 'Generated content based on user request',
    });

    aiStore.addPendingEdit({
      blockId,
      originalContent: (block.data as any).content || '',
      proposedContent: content,
      diffHunks: [], // Simplified - no granular diff for now
      reason: 'AI-generated content',
    });

    aiStore.addMessage({
      role: 'assistant',
      content: `I've created the content you requested. Review and accept if it looks good.`,
    });
  } else {
    // General conversation
    aiStore.addMessage({
      role: 'assistant',
      content: `I can help you edit this block. Try asking me to:\n• Research and add information about a topic\n• Write specific content\n• Improve or expand existing text\n\nWhat would you like me to do?`,
    });
  }
}

/**
 * Extract search query from user message
 */
function extractSearchQuery(message: string): string {
  const cleaned = message
    .toLowerCase()
    .replace(/^(search for|tell me about|what is|what are|explain|describe)\s+/i, '')
    .replace(/\?$/g, '')
    .trim();

  return cleaned || message;
}

/**
 * Generate content from search results
 */
async function generateContentFromSearch(query: string, results: SearchResult[]): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const title = `# ${query.charAt(0).toUpperCase() + query.slice(1)}\n\n`;
  const intro = `Based on the latest research and information from ${results.length} sources:\n\n`;

  const mainContent = results
    .map((result, idx) => {
      const sectionTitle = result.title
        .replace(new RegExp(query, 'gi'), '')
        .replace(/^[\s\-:|]+/, '')
        .replace(/[\s\-:|]+$/, '')
        .trim() || `Source ${idx + 1}`;

      return `## ${sectionTitle}\n\n${result.snippet}\n\n*Source: ${result.source || new URL(result.url).hostname}${result.published_date ? ` | ${result.published_date}` : ''}*\n`;
    })
    .join('\n');

  const keyTakeaways = generateKeyTakeaways(results);
  const footer = `\n## Summary\n\n${keyTakeaways}\n\n---\n*Information compiled from ${results.length} authoritative sources | Generated on ${new Date().toLocaleDateString()}*`;

  return title + intro + mainContent + footer;
}

/**
 * Generate key takeaways from search results
 */
function generateKeyTakeaways(_results: SearchResult[]): string {
  const takeaways = [
    'Multiple authoritative sources confirm the fundamental concepts',
    'Recent research continues to expand our understanding of this topic',
    'Current scientific consensus is based on extensive observation and study',
  ];

  return takeaways.map((point) => `• ${point}`).join('\n');
}

/**
 * Generate content from direct prompt
 */
function generateContentFromPrompt(prompt: string): string {
  return `# AI-Generated Content\n\nBased on your request: "${prompt}"\n\n${prompt}\n\nThis content was generated by AI. Feel free to edit or modify as needed.`;
}

/**
 * Apply accepted edit to block
 */
export async function applyEdit(editId: string): Promise<void> {
  const aiStore = useAIStore.getState();
  const blocksStore = useBlocksStore.getState();

  const edit = aiStore.pendingEdits.find((e) => e.id === editId);
  if (!edit) {
    throw new Error('Edit not found');
  }

  const block = blocksStore.blocks.find((b) => b.id === edit.blockId);
  if (!block) {
    throw new Error('Block not found');
  }

  // Update block content
  const updatedData = {
    ...block.data,
    content: edit.proposedContent,
  };

  // Update in store
  blocksStore.updateBlock(edit.blockId, { data: updatedData });

  // Update in database
  const { updateBlock } = await import('@/utils/tauri');
  await updateBlock(edit.blockId, updatedData);

  // Mark edit as accepted
  aiStore.acceptEdit(editId);

  console.log('✅ Edit applied successfully');
}

/**
 * Reject edit
 */
export function rejectEdit(editId: string): void {
  const aiStore = useAIStore.getState();
  aiStore.rejectEdit(editId);
  console.log('❌ Edit rejected');
}
