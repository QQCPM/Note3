/**
 * LangGraph Secretary Nodes
 * 
 * Pure functions that implement each node in the Secretary StateGraph.
 * Each node takes the current state and returns state updates.
 */

import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, SystemMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import type { SecretaryStateType, SecretaryIntent } from "./secretaryState";
import { secretaryTools, secretaryToolsByName, type SecretaryToolName } from "./secretaryTools";
import { memoryService } from "../memoryService";

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================

// Model with tools bound - initialized lazily
let cachedModel: ReturnType<typeof ChatOpenAI.prototype.bindTools> | null = null;

async function getModel() {
    if (!cachedModel) {
        // Get API key from tauriAI config
        const { tauriAI } = await import("../tauriAI");
        const config = await tauriAI.loadPersistedConfig();

        if (!config?.openai_api_key) {
            throw new Error("OpenAI API key not configured");
        }

        const baseModel = new ChatOpenAI({
            apiKey: config.openai_api_key,
            model: config.openai_model || "gpt-4o",
            temperature: 0.7,
        });

        cachedModel = baseModel.bindTools(secretaryTools);
    }
    return cachedModel;
}

/**
 * Generate the system prompt with dynamic date
 * This is called at runtime to ensure correct date
 */
function getSystemPrompt(): string {
    // Import timezone utilities at function scope to avoid circular dependencies
    // Use New York timezone for consistent date handling
    const NY_TIMEZONE = 'America/New_York';

    // Get today in NY timezone as YYYY-MM-DD
    const today = new Date().toLocaleDateString('en-CA', { timeZone: NY_TIMEZONE });

    // Get tomorrow in NY timezone
    const nyNow = new Date(new Date().toLocaleString('en-US', { timeZone: NY_TIMEZONE }));
    nyNow.setDate(nyNow.getDate() + 1);
    const tomorrow = `${nyNow.getFullYear()}-${String(nyNow.getMonth() + 1).padStart(2, '0')}-${String(nyNow.getDate()).padStart(2, '0')}`;

    const dayOfWeek = new Date().toLocaleDateString('en-US', { timeZone: NY_TIMEZONE, weekday: 'long' });


    return `You are an INTELLIGENT AI SECRETARY - a proactive specialist for learning and productivity.

## YOUR ROLE
You are like a DEVELOPER with file access. You can read, modify, and write files directly.
Be helpful, friendly, and action-oriented. Use your tools to get things done.

## CORE TOOLS (Only 7!)

### Roadmap Creation
1. **create_roadmap** - Create a new learning plan (AI generates content)
2. **save_roadmap** - Save the pending roadmap to Plan.md

### File Operations (Use like a text editor!)
3. **read_memory_file** - Read any file (Plan.md, AI.md, Plans/*, etc.)
4. **write_memory_file** - Write/modify any file
5. **list_memory_files** - List files in a directory
6. **delete_memory_file** - Delete a file
7. **rename_memory_file** - Rename/move a file

## HOW TO WORK LIKE A DEVELOPER

**To view plans:** 
\`read_memory_file("Plan.md")\`

**To rename a plan:**
1. \`read_memory_file("Plan.md")\`
2. Modify the name in the content
3. \`write_memory_file("Plan.md", newContent)\`

**To edit a roadmap's content (days, tasks, resources):**
1. \`list_memory_files("Plans")\` to find the file
2. \`read_memory_file("Plans/filename.md")\`
3. Modify the content as needed
4. \`write_memory_file("Plans/filename.md", newContent)\`

**To delete a file:**
1. \`list_memory_files("Plans")\` to see files
2. \`delete_memory_file("Plans/filename.md")\`

## FILE STRUCTURE
- **Plan.md** - Index of all plans with summary info (see format below)
- **Plans/** folder - Full roadmap content files
- **AI.md** - User preferences
- **Daily.md** - Daily schedule
- **History/** folder - Archived daily plans

## PLAN.MD FORMAT (IMPORTANT!)
When writing to Plan.md, use this EXACT structure:

\`\`\`markdown
# Learning Plans

## Active Plans

ID | Name | DateRange | Schedule | W#/#
QM | Quantum Mechanics | Jan 6 - Feb 15 | MWF 2h | W2/6
→ Week 2: Angular Momentum

DL | Deep Learning | Jan 1 - Mar 30 | TuThSa 1.5h | W5/12
→ Week 5: Transformers

---

## This Week (Jan 6 - Jan 12)

**Mon:** QM - Angular momentum
**Tue:** DL - Attention mechanisms
**Tue:** QM - Practice problems
**Wed:** QM - Spin states
**Thu:** DL - Transformer architecture
**Fri:** QM - Angular addition

---

## Archived

*No archived plans yet.*
\`\`\`

### Format Rules:
- **Active Plans line**: \`ID | Name | DateRange | Schedule | W#/#\`
  - ID: Short identifier (QM, DL, AWS, etc.)
  - DateRange: \`Jan 6 - Feb 15\` or \`2026-01-06 to 2026-02-15\`
  - Schedule: Days + hours, e.g., \`MWF 2h\` or \`TuThSa 1.5h\` or \`Daily 2h\`
  - W#/#: Current week / total weeks
- **Arrow line (→)**: Shows current week's theme
- **This Week entries**: Use \`**Day:** PlanID - Topic\` format (NOT a table!)

### THIS WEEK CALCULATION (CRITICAL!)

**STEP 1: Know Today's Calendar**
Today is ${today} (${dayOfWeek}). Use this to determine week range.
Week typically runs: Saturday → Friday (or Sun → Sat).

**STEP 2: Understand Schedule Types**
- \`Daily 2h\` = study EVERY calendar day (Day 1 = start date, Day 2 = start date + 1, ...)
- \`MWF 2h\` = study ONLY on Mon, Wed, Fri (skip other days)
- \`MTu 2h\` = study ONLY on Mon, Tue (skip Wed-Sun)
- \`TuThSa 2h\` = study ONLY on Tue, Thu, Sat

**STEP 3: Calculate Study Day Numbers Correctly**

For **Daily** schedules:
\`\`\`
StudyDayNumber = (calendar_date - start_date) + 1
Example: Start Jan 5, checking Jan 8 → Day 4
\`\`\`

For **Restricted** schedules (MWF, MTu, etc.):
\`\`\`
Only count days that match the schedule!
Example: MTu schedule, start Jan 8 (Wed):
- Jan 8 (Wed) = NOT a study day (MTu only)
- Jan 9 (Thu) = NOT a study day
- Jan 10 (Fri) = NOT a study day  
- Jan 11 (Sat) = NOT a study day
- Jan 12 (Sun) = NOT a study day
- Jan 13 (Mon) = Day 1 ← First Mon on/after start
- Jan 14 (Tue) = Day 2
- Jan 20 (Mon) = Day 3
\`\`\`

**STEP 4: Build This Week - CALENDAR CHECK**
For each calendar date this week, check:
1. What day of week is this date? (Use: Jan 4 2026 = Sat, Jan 5 = Sun, Jan 6 = Mon, ...)
2. Is this date within the plan's date range?
3. Does this day of week match the plan's schedule?
4. If yes to all, calculate the study day number

**CORRECT EXAMPLE:**
Plans:
- AWS3: Jan 5 - Jan 7, Daily 2h
- AIAD: Jan 8 - Jan 19, MTu 2h (Mon/Tue only!)
- OPT: Jan 8 - Jan 18, Daily 2h

Week of Jan 4-10 (Sat-Fri):
\`\`\`
## This Week (Jan 4 - Jan 10)

**Sat (Jan 4):** (nothing - AWS3 starts tomorrow, others start later)
**Sun (Jan 5):** AWS3 - Day 1: Account safety
**Mon (Jan 6):** AWS3 - Day 2: S3 + Lambda
**Tue (Jan 7):** AWS3 - Day 3: EC2/VPC mini-capstone
**Wed (Jan 8):** OPT - Day 1: Light basics (AIAD skips - not Mon/Tue!)
**Thu (Jan 9):** OPT - Day 2: Reflection & refraction
**Fri (Jan 10):** OPT - Day 3: Lenses
\`\`\`

Note: AIAD doesn't appear because its schedule is MTu but Jan 8-10 are Wed-Fri! AIAD Day 1 would be Jan 13 (Mon).

**COMMON MISTAKES:**
- ❌ Ignoring schedule restrictions (putting MTu plan on Wed/Thu)
- ❌ Using wrong day of week for dates (Jan 5 2026 is SUNDAY, not Monday!)
- ❌ Counting every calendar day for restricted schedules

## WORKFLOW FOR NEW PLANS
1. User asks for a roadmap → CALL \`create_roadmap\`
2. Show summary, ask "Want me to save this?"
3. User confirms → CALL \`save_roadmap\` with start_date

## CRITICAL RULES
- **NEVER describe a roadmap without FIRST calling create_roadmap**
- **Use file tools to make ANY modification** - rename, edit content, change dates
- **Be proactive** - if you can do it, do it!

## DAILY PLAN WORKFLOW
When user asks "what should I study today?":
1. \`read_memory_file("Plan.md")\` - Check This Week table
2. Find today's row: \`| Wed | LP | Topic | [Day 2](Plans/lp.md#day-2) |\`
3. \`read_memory_file("Plans/lp-2026-01-06.md")\` - Get detailed plan
4. Find \`## Day 2\` section for specific tasks
5. Return the tasks for that day

## GENERATING DAILY PLANS (IMPORTANT!)
When user asks to "prepare tomorrow's plan", "generate today's tasks", or similar:

### Step 1: Gather Context
1. \`read_memory_file("Plan.md")\` → Find **This Week** table, get topic for target day
2. \`read_memory_file("AI.md")\` → Get user preferences (focus time, break frequency, hours)
3. Find the archive path from This Week table, then \`read_memory_file("Plans/<archive>.md")\` → Get detailed content

### Step 2: Generate Schedule
Create a structured daily plan with:
- **Specific times** based on user's best focus time (from AI.md)
- **Duration** for each task (15-60 min blocks)
- **Types**: 📖 Read/Learn, 💻 Practice, 🔄 Review, ☕ Break
- **AI reasoning** for why each task is scheduled

### Step 3: Write to Correct File
**IMPORTANT: Use separate files for today vs tomorrow**

For TODAY's plan:
\`write_memory_file("Today.md", content)\`

For TOMORROW's plan:
\`write_memory_file("Tomorrow.md", content)\`

### Daily Plan Format (FOLLOW EXACTLY FOR PARSING)
\`\`\`markdown
# 📅 {DayOfWeek}, {Month} {Day}, {Year}

**Date:** YYYY-MM-DD
**Focus:** {Topic from Plan.md}

## Schedule

- [ ] 09:00 (45min) 📖 {task description}
- [ ] 09:45 (15min) ☕ Break
- [ ] 10:00 (60min) 💻 {task description}
- [ ] 11:00 (15min) ☕ Break
- [ ] 11:15 (45min) 🔄 {task description}

## AI Notes

> {Brief explanation of why this schedule works}

## End of Day

- Mood: 
- Completed: /
- Struggled with: 
- What went well: 

## Tomorrow Preview

- {Tomorrow topic 1}
- {Tomorrow topic 2}
\`\`\`

**CRITICAL FORMAT RULES:**
- Task lines MUST be: \`- [ ] HH:MM (XXmin) EMOJI task\`
- Time MUST be 24-hour format: \`09:00\`, \`14:30\`
- Duration MUST be: \`(45min)\`, \`(15min)\`, \`(60min)\`
- Emojis: 📖 learn, 💻 practice, ☕ break, 🔄 review


### Scheduling Rules
- Start times based on user's "bestFocusTime" from AI.md
- Insert breaks every 45-60 min based on "breakFrequency"
- Total study time should match "weekdayHours" or "weekendHours" from AI.md
- Alternate between Learn → Practice → Review for retention

## Date Context
- Today: ${today} (${dayOfWeek})
- Tomorrow: ${tomorrow}

## Response Style
- Be conversational and friendly
- When you modify something, explain what you changed
- Suggest next steps when appropriate`;
}


// ============================================================================
// INTENT CLASSIFICATION PATTERNS
// ============================================================================

const INTENT_PATTERNS: Record<SecretaryIntent, RegExp[]> = {
    create_roadmap: [
        /\b(create|make|build|design|plan|generate)\b.*\b(roadmap|plan|schedule|curriculum|learning path)/i,
        /\b(learn|study|master)\b.*\b(in|over|for)\s+\d+\s*(day|week|month)/i,
        /\b(roadmap|plan)\b.*\bfor\b.*\b(learning|studying)/i,
    ],
    save_roadmap: [
        /^(save|save it|yes|okay|ok|sure|do it|go ahead|confirm|proceed)\s*[!.]?$/i,
        /\b(save|store|keep)\b.*\b(this|the|my)\b.*\b(roadmap|plan)/i,
        /\bstart(ing)?\b.*\b(tomorrow|monday|next|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    ],
    modify_roadmap: [
        /\b(change|modify|update|adjust|edit)\b.*\b(roadmap|plan|schedule)/i,
        /\b(add|remove|extend|shorten)\b.*\b(phase|week|day|topic)/i,
    ],
    calendar: [
        /\b(meeting|event|appointment|day off|vacation|sick|holiday)/i,
        /\b(block|busy|unavailable)\b.*\b(time|day|date)/i,
    ],
    daily_plan: [
        /\b(today|tomorrow|daily)\b.*\b(plan|schedule|tasks)/i,
        /\bwhat.*(should|do|study).*today/i,
    ],
    preferences: [
        /\b(change|update|set)\b.*\b(preference|hours|days|time|focus)/i,
        /\b(study|available)\b.*\b(on|only)\b.*\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    ],
    query: [
        /\b(what|when|how|show|tell|list)\b.*\b(my|the|current)\b.*\b(roadmap|plan|schedule)/i,
        /\b(progress|status|where)\b.*\b(am i|are we)/i,
    ],
    general: [], // Fallback
};

/**
 * Classify user intent from message content
 */
function classifyUserIntent(message: string): SecretaryIntent {
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS) as [SecretaryIntent, RegExp[]][]) {
        if (patterns.some(pattern => pattern.test(message))) {
            return intent;
        }
    }
    return 'general';
}

/**
 * Get last element from array (ES2022 Array.at polyfill)
 */
function getLastMessage(messages: BaseMessage[]): BaseMessage | undefined {
    return messages[messages.length - 1];
}

// ============================================================================
// NODE IMPLEMENTATIONS
// ============================================================================

/**
 * Load Memory Node
 * 
 * Loads context from memory files (AI.md, Plan.md) at the start of processing.
 * Also checks if weekly expansion is needed and updates Plan.md accordingly.
 */
export async function loadMemory(_state: SecretaryStateType): Promise<Partial<SecretaryStateType>> {
    try {
        // Check and expand week if needed (auto-updates This Week section)
        await checkAndExpandWeek();

        // Then load the (potentially updated) context
        const context = await memoryService.getFullContext();
        return { memoryContext: context };
    } catch (error) {
        console.warn("[LangGraph] Failed to load memory:", error);
        return { memoryContext: null };
    }
}

/**
 * Classify Intent Node
 * 
 * Analyzes the user's message to determine intent for routing.
 */
export async function classifyIntent(state: SecretaryStateType): Promise<Partial<SecretaryStateType>> {
    const lastMessage = getLastMessage(state.messages);
    if (!lastMessage || lastMessage.getType() !== "human") {
        return { currentIntent: "general" };
    }

    const content = typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const intent = classifyUserIntent(content);
    console.log(`[LangGraph] Classified intent: ${intent}`);

    return { currentIntent: intent };
}

/**
 * Call Model Node
 * 
 * Invokes the LLM with tools bound. Handles the main AI reasoning.
 */
export async function callModel(state: SecretaryStateType): Promise<Partial<SecretaryStateType>> {
    try {
        const model = await getModel();

        // Build context sections for system prompt
        let contextSections = "";

        // Add memory context if available
        if (state.memoryContext) {
            contextSections += `\n\n## Current Memory Context\n${state.memoryContext}`;
        }

        // CRITICAL: Tell AI about pending roadmap so it knows when to call save_roadmap
        if (state.pendingRoadmap) {
            contextSections += `\n\n## PENDING ROADMAP (AWAITING SAVE)
**IMPORTANT**: There is a roadmap ready to be saved!
- Name: "${state.pendingRoadmap.name}"
- Topic: ${state.pendingRoadmap.topic}
- Duration: ${state.pendingRoadmap.totalDays} days
- Study days: ${state.pendingRoadmap.studyDays.join(', ')}

If user confirms (says "yes", "save", "go ahead", mentions a start date, etc.), you MUST call the save_roadmap tool with:
- roadmap_name: "${state.pendingRoadmap.name}"
- start_date: the date user specified (or today if not specified)
- save_mode: "add" (unless user says replace/merge)`;
        }

        // Build messages with system prompt and context
        const systemMessage = new SystemMessage(getSystemPrompt() + contextSections);

        const messages = [systemMessage, ...state.messages];

        console.log(`[LangGraph] Calling model with ${messages.length} messages, pendingRoadmap: ${!!state.pendingRoadmap}`);

        const response = await model.invoke(messages);

        return { messages: [response] };
    } catch (error) {
        console.error("[LangGraph] callModel error:", error);
        const errorMessage = error instanceof Error ? error.message : "Model invocation failed";
        return {
            error: errorMessage,
            messages: [new AIMessage(`I'm sorry, I encountered an error: ${errorMessage}. Please try again.`)]
        };
    }
}

/**
 * Tool Execution Node
 * 
 * Executes tool calls from the model's response.
 */
export async function executeTools(state: SecretaryStateType): Promise<Partial<SecretaryStateType>> {
    const lastMessage = getLastMessage(state.messages);

    if (!lastMessage || !(lastMessage instanceof AIMessage) || !lastMessage.tool_calls?.length) {
        return { messages: [] };
    }

    const toolResults: ToolMessage[] = [];
    let updatedPendingRoadmap = state.pendingRoadmap;
    let updatedAwaitingConfirmation = state.awaitingConfirmation;
    const newCalendarEvents = [...state.calendarEvents];

    for (const toolCall of lastMessage.tool_calls) {
        const toolName = toolCall.name as SecretaryToolName;

        if (!secretaryToolsByName[toolName]) {
            toolResults.push(new ToolMessage({
                tool_call_id: toolCall.id!,
                content: JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` }),
            }));
            continue;
        }

        console.log(`[LangGraph] Executing tool: ${toolName}`, toolCall.args);

        try {
            // Import core executors
            const {
                executeCreateRoadmap,
                executeSaveRoadmap,
                executeReadMemoryFile,
                executeWriteMemoryFile,
                executeListMemoryFiles,
                executeDeleteMemoryFile,
                executeRenameMemoryFile,
            } = await import("../secretaryService");

            let result: { success: boolean; data?: unknown; error?: string; message?: string };

            // Simplified 7-tool switch
            switch (toolName) {
                case "create_roadmap":
                    result = await executeCreateRoadmap(toolCall.args as Parameters<typeof executeCreateRoadmap>[0]);
                    break;
                case "save_roadmap":
                    result = await executeSaveRoadmap(toolCall.args as Parameters<typeof executeSaveRoadmap>[0]);
                    break;
                case "read_memory_file":
                    result = await executeReadMemoryFile(toolCall.args as Parameters<typeof executeReadMemoryFile>[0]);
                    break;
                case "write_memory_file":
                    result = await executeWriteMemoryFile(toolCall.args as Parameters<typeof executeWriteMemoryFile>[0]);
                    break;
                case "list_memory_files":
                    result = await executeListMemoryFiles(toolCall.args as Parameters<typeof executeListMemoryFiles>[0]);
                    break;
                case "delete_memory_file":
                    result = await executeDeleteMemoryFile(toolCall.args as Parameters<typeof executeDeleteMemoryFile>[0]);
                    break;
                case "rename_memory_file":
                    result = await executeRenameMemoryFile(toolCall.args as Parameters<typeof executeRenameMemoryFile>[0]);
                    break;
                default:
                    result = { success: false, error: `Unhandled tool: ${toolName}` };
            }

            // Update state based on tool results
            if (toolName === "create_roadmap" && result.success) {
                updatedPendingRoadmap = result.data as typeof updatedPendingRoadmap;
                updatedAwaitingConfirmation = true;
            } else if (toolName === "save_roadmap" && result.success) {
                updatedPendingRoadmap = null;
                updatedAwaitingConfirmation = false;
            }

            toolResults.push(new ToolMessage({
                tool_call_id: toolCall.id!,
                content: JSON.stringify(result),
            }));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Tool execution failed";
            toolResults.push(new ToolMessage({
                tool_call_id: toolCall.id!,
                content: JSON.stringify({ success: false, error: errorMessage }),
            }));
        }
    }

    return {
        messages: toolResults,
        pendingRoadmap: updatedPendingRoadmap,
        awaitingConfirmation: updatedAwaitingConfirmation,
        calendarEvents: newCalendarEvents.length > state.calendarEvents.length
            ? newCalendarEvents.slice(state.calendarEvents.length)
            : [],
    };
}

/**
 * Route from callModel
 * 
 * Determines whether to execute tools or end the graph.
 */
export function shouldContinue(state: SecretaryStateType): "executeTools" | "__end__" {
    const lastMessage = getLastMessage(state.messages);

    if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
        return "executeTools";
    }

    return "__end__";
}

// ============================================================================
// WEEKLY AUTO-EXPANSION HELPERS
// ============================================================================

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Check if weekly expansion is needed based on current date
 */
function needsWeeklyExpansion(
    planMemory: import('@/types/memory').PlanMemory
): boolean {
    if (!planMemory.thisWeek || !planMemory.thisWeek.weekStart) {
        return false; // No This Week section to expand
    }

    const today = new Date();
    const currentWeekStart = getWeekStart(today);
    const storedWeekStart = new Date(planMemory.thisWeek.weekStart);

    // If current week start is after stored week start, we need to expand
    return currentWeekStart.getTime() > storedWeekStart.getTime();
}

/**
 * Regenerate This Week section with updated plan weeks
 */
function regenerateThisWeek(
    activePlans: import('@/types/memory').CondensedPlan[]
): import('@/types/memory').ThisWeekPlan {
    const today = new Date();
    const weekStart = getWeekStart(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekRange = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;

    const dailyTasks: import('@/types/memory').DailyTaskEntry[] = [];

    for (const plan of activePlans) {
        if (plan.status !== 'active') continue;

        // Get the current week's theme
        const currentTheme = plan.weeklyThemes.find(t => t.status === 'current')?.theme ||
            plan.weeklyThemes[plan.currentWeek - 1]?.theme ||
            `Week ${plan.currentWeek}`;

        // Add tasks for each study day
        for (const day of plan.studyDays) {
            dailyTasks.push({
                day: day,
                planId: plan.id,
                topic: currentTheme,
            });
        }
    }

    return {
        weekStart: weekStart.toISOString().split('T')[0],
        weekRange: weekRange,
        dailyTasks: dailyTasks,
    };
}

/**
 * Check and expand week if needed
 * Called at the start of each secretary invocation
 */
export async function checkAndExpandWeek(): Promise<void> {
    try {
        const planMemory = await memoryService.loadPlanMemory();
        if (!planMemory || planMemory.activePlans.length === 0) {
            return; // No plans to expand
        }

        if (!needsWeeklyExpansion(planMemory)) {
            return; // Not time to expand yet
        }

        console.log('📅 [Secretary] Week boundary detected, expanding plans...');

        // Update each active plan's current week
        for (const plan of planMemory.activePlans) {
            if (plan.status !== 'active') continue;

            // Increment week (cap at total weeks)
            if (plan.currentWeek < plan.totalWeeks) {
                // Mark previous week as completed
                const prevTheme = plan.weeklyThemes.find(t => t.week === plan.currentWeek);
                if (prevTheme) {
                    prevTheme.status = 'completed';
                }

                // Move to next week
                plan.currentWeek++;

                // Mark new week as current
                const newTheme = plan.weeklyThemes.find(t => t.week === plan.currentWeek);
                if (newTheme) {
                    newTheme.status = 'current';
                }

                console.log(`  📈 ${plan.name}: Week ${plan.currentWeek - 1} → Week ${plan.currentWeek}`);
            } else if (plan.currentWeek >= plan.totalWeeks) {
                // Plan is complete
                plan.status = 'completed';
                console.log(`  ✅ ${plan.name}: Completed!`);
            }
        }

        // Regenerate This Week section
        planMemory.thisWeek = regenerateThisWeek(planMemory.activePlans);

        // Save updated Plan.md
        await memoryService.savePlanMemory(planMemory);
        console.log('📅 [Secretary] Week expansion complete');
    } catch (error) {
        console.warn('[Secretary] Week expansion failed:', error);
    }
}
