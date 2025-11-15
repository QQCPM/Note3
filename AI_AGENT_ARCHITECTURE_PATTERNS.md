# AI Agent Architecture Patterns & Implementation Guide
## Advanced Techniques for Autonomous Note Creation

**Companion Document to:** AI_AGENT_ENHANCEMENT_RESEARCH.md
**Focus:** Specific architectural patterns, code examples, and design decisions

---

## Table of Contents
1. [Multi-Tool Orchestration Patterns](#multi-tool-orchestration-patterns)
2. [Context Management Strategies](#context-management-strategies)
3. [Planning & Reflection Architecture](#planning--reflection-architecture)
4. [Real-Time Data Integration](#real-time-data-integration)
5. [Security & Validation Patterns](#security--validation-patterns)
6. [Error Recovery Strategies](#error-recovery-strategies)
7. [Performance Optimization](#performance-optimization)

---

## Multi-Tool Orchestration Patterns

### Pattern 1: Sequential Tool Chaining

**Use Case:** Operations that must happen in order (create note → add blocks → arrange)

```typescript
// BAD: All in one turn, no dependency management
async function createCompleteNote(request: string) {
  const tools = [
    { name: 'create_note', params: {...} },
    { name: 'create_block', params: {...} }, // Needs note_id from create_note!
    { name: 'create_block', params: {...} }
  ];
  // Won't work - create_block doesn't have note_id yet
}

// GOOD: Tool chaining with dependency tracking
async function createCompleteNoteChained(request: string) {
  // Turn 1: Create note
  const noteId = await callTool('create_note', {
    title: extractTitle(request),
    reason: 'User requested new note'
  });

  // Turn 2-N: Create blocks sequentially
  const blockIds = [];
  for (const blockSpec of parseBlockRequests(request)) {
    const blockId = await callTool('create_block', {
      note_id: noteId,  // Now we have it!
      block_type: blockSpec.type,
      data: blockSpec.data,
      reason: blockSpec.reason
    });
    blockIds.push(blockId);
  }

  // Final turn: Arrange
  await callTool('arrange_blocks', {
    note_id: noteId,
    block_positions: blockIds.map((id, idx) => ({ block_id: id, position: idx }))
  });
}
```

**Implementation in Agent:**

```typescript
// System prompt includes chain awareness
const CHAIN_AWARE_PROMPT = `
When user requests multi-step operations:
1. Identify dependencies (what needs what)
2. Execute in order, waiting for results
3. Use results from previous tools in next calls

EXAMPLE CHAIN:
User: "Create note about AI with timer"

Turn 1:
  → create_note(title="AI Overview")
  ← note_id="note-123"

Turn 2:
  → create_block(note_id="note-123", type="heading1", data={content: "AI Overview"})
  ← block_id="block-1"

Turn 3:
  → create_block(note_id="note-123", type="artifact", data={title: "Timer", prompt: "Pomodoro"})
  ← block_id="block-2"

Turn 4:
  → arrange_blocks(note_id="note-123", positions=[{block_id: "block-1", position: 0}, ...])
  ← success

IMPORTANT: Wait for each result before using it in next call.
`;
```

### Pattern 2: Parallel Tool Execution

**Use Case:** Independent operations that can happen simultaneously

```typescript
// When tools don't depend on each other, execute in parallel
interface ParallelToolGroup {
  tools: ToolCall[];
  waitForAll: boolean;
}

// Example: Search multiple topics at once
const parallelSearches = {
  tools: [
    { name: 'search_web_real', params: { query: 'AI trends 2025' } },
    { name: 'search_web_real', params: { query: 'machine learning latest' } },
    { name: 'search_web_real', params: { query: 'neural networks research' } }
  ],
  waitForAll: true
};

// Agent executes all simultaneously, waits for all results
const results = await Promise.all(parallelSearches.tools.map(t => executeTool(t)));

// Conversation history includes all results:
conversationHistory.push({
  role: 'user',
  content: `
[Search results]:
1. AI trends 2025: ${results[0]}
2. Machine learning latest: ${results[1]}
3. Neural networks research: ${results[2]}
  `
});
```

**System Prompt Pattern:**

```typescript
const PARALLEL_AWARE_PROMPT = `
When gathering information from multiple independent sources:
- Call search_web_real multiple times in ONE response
- I will execute them in parallel
- You will receive all results together
- Then synthesize information

EXAMPLE:
User: "Create note comparing Python vs JavaScript"

Turn 1 (parallel searches):
  → search_web_real("Python advantages 2025")
  → search_web_real("JavaScript advantages 2025")
  → search_web_real("Python vs JavaScript performance")
  ← [All results returned together]

Turn 2 (synthesize):
  → create_note(...)
  → create_block with synthesized comparison
`;
```

### Pattern 3: Conditional Tool Execution

**Use Case:** Tool selection based on context or previous results

```typescript
interface ConditionalToolFlow {
  condition: (context: Context) => boolean;
  ifTrue: ToolCall[];
  ifFalse: ToolCall[];
}

// Example: Search web only if information is time-sensitive
function shouldSearchWeb(request: string, context: Context): boolean {
  const timeSensitiveKeywords = ['latest', 'current', 'today', 'recent', 'now', '2025'];
  const hasTimeSensitive = timeSensitiveKeywords.some(kw => request.toLowerCase().includes(kw));

  const hasRecentDate = /202[3-5]|this (year|month|week)/.test(request.toLowerCase());

  return hasTimeSensitive || hasRecentDate;
}

// Agent decision flow:
if (shouldSearchWeb(userRequest, context)) {
  // Use search_web_real
  const searchResults = await callTool('search_web_real', {
    query: extractSearchQuery(userRequest)
  });
  content = synthesizeFromSearch(searchResults);
} else {
  // Use knowledge directly
  content = generateFromKnowledge(userRequest);
}
```

**System Prompt Pattern:**

```typescript
const CONDITIONAL_PROMPT = `
Decide whether to search web based on:

SEARCH WEB if request contains:
- Time-sensitive words: "latest", "current", "today", "recent", "2025"
- Specific recent dates: "2024", "2025", "this year"
- Current events: "news", "breaking", "announced"
- Uncertain facts: "I'm not sure about recent developments"

DON'T SEARCH if:
- Request is about timeless concepts ("explain gravity")
- You have high confidence in answer
- No time sensitivity indicated

EXAMPLES:

"Create note about photosynthesis"
→ Don't search (timeless concept)
→ Use knowledge directly

"Create note about AI developments in 2025"
→ Search web (time-sensitive, specific year)
→ Use search_web_real

"Create note about latest OpenAI models"
→ Search web (time-sensitive: "latest")
→ Use search_web_real
`;
```

---

## Context Management Strategies

### Strategy 1: Hierarchical Context Structure

Instead of flat conversation history, organize as hierarchy:

```typescript
interface HierarchicalContext {
  systemPrompt: string;
  userGoal: UserGoal;
  subtasks: Subtask[];
  currentFocus: string;
}

interface UserGoal {
  original: string;
  interpreted: string;
  estimated_complexity: 'simple' | 'moderate' | 'complex';
  estimated_steps: number;
}

interface Subtask {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  tool_calls: ToolExecution[];
  result_summary?: string;  // Compressed result after completion
}

interface ToolExecution {
  tool: string;
  params: any;
  result: any;
  timestamp: number;
}

// Example structure:
const context: HierarchicalContext = {
  systemPrompt: "You are an AI agent...",

  userGoal: {
    original: "Create a comprehensive note about black holes with a study timer",
    interpreted: "Create note with: (1) research content about black holes, (2) Pomodoro timer artifact",
    estimated_complexity: 'moderate',
    estimated_steps: 6
  },

  subtasks: [
    {
      id: 'subtask-1',
      description: 'Research black holes',
      status: 'completed',
      tool_calls: [
        {
          tool: 'search_web_real',
          params: { query: 'black holes 2025' },
          result: { /* 5KB of results */ },
          timestamp: 1234567890
        }
      ],
      result_summary: 'Found 5 sources on black holes, including recent NASA discoveries'
    },

    {
      id: 'subtask-2',
      description: 'Create note structure',
      status: 'completed',
      tool_calls: [
        {
          tool: 'create_note',
          params: { title: 'Black Holes - Cosmic Mysteries' },
          result: { note_id: 'note-123' },
          timestamp: 1234567891
        },
        {
          tool: 'create_block',
          params: { type: 'heading1', ... },
          result: { block_id: 'block-1' },
          timestamp: 1234567892
        }
      ],
      result_summary: 'Created note-123 with title block'
    },

    {
      id: 'subtask-3',
      description: 'Add research content',
      status: 'in_progress',
      tool_calls: [
        {
          tool: 'create_block',
          params: { type: 'text', data: { content: '...' } },
          result: null, // Still executing
          timestamp: 1234567893
        }
      ]
    }
  ],

  currentFocus: 'subtask-3'
};
```

**Context Compression Algorithm:**

```typescript
function compressContext(context: HierarchicalContext, maxTokens: number): string {
  let compressed = context.systemPrompt; // Always keep full
  let tokens = estimateTokens(compressed);

  // Add current user goal (always keep)
  compressed += `\n\nCURRENT GOAL: ${context.userGoal.interpreted}`;
  tokens += estimateTokens(context.userGoal.interpreted);

  // Add completed subtasks (summarized)
  const completed = context.subtasks.filter(st => st.status === 'completed');
  for (const subtask of completed) {
    const summary = `✓ ${subtask.description}: ${subtask.result_summary}`;
    if (tokens + estimateTokens(summary) < maxTokens * 0.3) { // Use 30% for completed
      compressed += `\n${summary}`;
      tokens += estimateTokens(summary);
    }
  }

  // Add current/in-progress subtasks (full detail)
  const active = context.subtasks.filter(st => st.status === 'in_progress' || st.status === 'pending');
  for (const subtask of active) {
    const detail = formatSubtaskDetail(subtask);
    if (tokens + estimateTokens(detail) < maxTokens * 0.7) { // Use 70% for active
      compressed += `\n${detail}`;
      tokens += estimateTokens(detail);
    } else {
      // If not enough space, just add summary
      compressed += `\n⚠ ${subtask.description} (in progress)`;
    }
  }

  return compressed;
}
```

### Strategy 2: Sliding Window with Anchors

Keep certain messages as "anchors" that never get trimmed:

```typescript
interface AnchoredMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  isAnchor: boolean;
  priority: number;
  timestamp: number;
}

function trimConversationWithAnchors(
  history: AnchoredMessage[],
  maxTokens: number
): AnchoredMessage[] {
  // Anchors always kept
  const anchors = history.filter(m => m.isAnchor);
  let tokens = anchors.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  // Non-anchors sorted by priority
  const nonAnchors = history
    .filter(m => !m.isAnchor)
    .sort((a, b) => b.priority - a.priority);

  const result = [...anchors];

  // Add non-anchors by priority until limit
  for (const msg of nonAnchors) {
    const msgTokens = estimateTokens(msg.content);
    if (tokens + msgTokens < maxTokens) {
      result.push(msg);
      tokens += msgTokens;
    }
  }

  // Sort back to chronological order
  return result.sort((a, b) => a.timestamp - b.timestamp);
}

// Priority rules:
const PRIORITY_RULES = {
  system_prompt: 100,        // Always keep
  user_latest_request: 95,   // Always keep
  tool_result_recent: 80,    // Keep if within last 3 turns
  tool_result_old: 40,       // Summarize or drop
  assistant_response: 60,    // Keep unless very old
  user_old_request: 30       // Drop if context full
};
```

### Strategy 3: Smart Summarization

When trimming, don't just drop messages - summarize them:

```typescript
async function summarizeOldContext(
  messages: Message[],
  model: 'fast' | 'quality' = 'fast'
): Promise<string> {
  const messagesToSummarize = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');

  const summaryPrompt = `Summarize this conversation history concisely, preserving key decisions and results:

${messagesToSummarize}

Provide a bullet-point summary covering:
- What user requested
- What tools were called
- What results were achieved
- Any important context for continuing

Keep summary under 200 words.`;

  if (model === 'fast') {
    // Use GPT-4o-mini for fast, cheap summarization
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: summaryPrompt }],
      temperature: 0.3,
      max_tokens: 300
    });
    return response.choices[0].message.content;
  } else {
    // Use same model as agent
    return await summarizeWithMainModel(summaryPrompt);
  }
}

// Use in context management:
async function manageContextWithSummarization(
  history: Message[],
  maxTokens: number
): Promise<Message[]> {
  const tokens = history.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  if (tokens < maxTokens) {
    return history; // No trimming needed
  }

  // Keep system prompt + last 5 messages
  const systemPrompt = history[0];
  const recent = history.slice(-5);
  const toSummarize = history.slice(1, -5);

  if (toSummarize.length > 0) {
    const summary = await summarizeOldContext(toSummarize, 'fast');

    return [
      systemPrompt,
      { role: 'system', content: `[Previous conversation summary]:\n${summary}` },
      ...recent
    ];
  }

  return [systemPrompt, ...recent];
}
```

---

## Planning & Reflection Architecture

### Planning Phase Implementation

```typescript
interface ExecutionPlan {
  id: string;
  userRequest: string;
  goal: string;
  steps: PlannedStep[];
  estimatedTokens: number;
  estimatedCost: number;
  requiresApproval: boolean;
  created: Date;
}

interface PlannedStep {
  id: string;
  stepNumber: number;
  description: string;
  tool: string;
  params: any;
  dependencies: string[];  // IDs of steps that must complete first
  estimatedTime: number;   // seconds
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
}

// Planning prompt
const PLANNING_PROMPT = `Before executing the user's request, create a detailed plan.

USER REQUEST: ${userRequest}

Create a plan with these sections:

1. GOAL: What are we trying to achieve?

2. PREREQUISITES: What information do we need first?
   - Search web? For what?
   - Read existing notes? Which ones?
   - Get current date/time?

3. STEPS: Numbered list of actions
   Each step should have:
   - Tool to use
   - Parameters for tool
   - Why this step is needed
   - What it depends on (previous steps)

4. VERIFICATION: How will we know we succeeded?

5. ESTIMATED EFFORT:
   - Number of steps
   - Estimated time
   - Estimated token usage

Format as JSON:
{
  "goal": "...",
  "prerequisites": [...],
  "steps": [
    {
      "step": 1,
      "description": "...",
      "tool": "...",
      "params": {...},
      "depends_on": [],
      "reason": "..."
    }
  ],
  "verification": "...",
  "estimated_steps": 5,
  "estimated_time_seconds": 30,
  "estimated_tokens": 5000
}

EXAMPLE:

User: "Create note about black holes with timer"

Plan:
{
  "goal": "Create comprehensive note with black hole info and Pomodoro timer",
  "prerequisites": [
    "Search web for latest black hole information",
    "Get current date for citation"
  ],
  "steps": [
    {
      "step": 1,
      "description": "Get current date",
      "tool": "get_current_datetime",
      "params": {},
      "depends_on": [],
      "reason": "Need current date for citing sources"
    },
    {
      "step": 2,
      "description": "Search black hole research",
      "tool": "search_web_real",
      "params": {"query": "black holes latest discoveries 2025"},
      "depends_on": [],
      "reason": "Get current, accurate information"
    },
    {
      "step": 3,
      "description": "Create note",
      "tool": "create_note",
      "params": {"title": "Black Holes - Cosmic Mysteries"},
      "depends_on": [],
      "reason": "Initialize note structure"
    },
    {
      "step": 4,
      "description": "Add title heading",
      "tool": "create_block",
      "params": {"note_id": "FROM_STEP_3", "type": "heading1", ...},
      "depends_on": [3],
      "reason": "Note needs title"
    },
    {
      "step": 5,
      "description": "Add research content",
      "tool": "create_block",
      "params": {"note_id": "FROM_STEP_3", "type": "text", "data": "FROM_STEP_2"},
      "depends_on": [2, 3],
      "reason": "Main content from web research"
    },
    {
      "step": 6,
      "description": "Add Pomodoro timer",
      "tool": "create_block",
      "params": {"note_id": "FROM_STEP_3", "type": "artifact", ...},
      "depends_on": [3],
      "reason": "User requested study timer"
    }
  ],
  "verification": "Note contains heading, research content with citations, and working Pomodoro timer",
  "estimated_steps": 6,
  "estimated_time_seconds": 45,
  "estimated_tokens": 8000
}
`;

// Generate plan
async function generatePlan(userRequest: string): Promise<ExecutionPlan> {
  const response = await callAgent({
    messages: [
      { role: 'system', content: PLANNING_PROMPT },
      { role: 'user', content: userRequest }
    ],
    tools: [], // No tools during planning, just thinking
    temperature: 0.3, // Lower temp for more structured planning
    response_format: { type: 'json_object' } // Request JSON
  });

  const planData = JSON.parse(response.content);

  return {
    id: generateId(),
    userRequest,
    goal: planData.goal,
    steps: planData.steps.map((s, idx) => ({
      id: `step-${idx}`,
      stepNumber: s.step,
      description: s.description,
      tool: s.tool,
      params: s.params,
      dependencies: s.depends_on.map(d => `step-${d - 1}`),
      estimatedTime: planData.estimated_time_seconds / planData.steps.length,
      status: 'pending'
    })),
    estimatedTokens: planData.estimated_tokens,
    estimatedCost: estimateCost(planData.estimated_tokens),
    requiresApproval: planData.estimated_steps > 5 || planData.estimated_tokens > 10000,
    created: new Date()
  };
}
```

### Reflection Implementation

```typescript
interface ReflectionCheckpoint {
  stepId: string;
  stepNumber: number;
  timestamp: Date;
  reflection: {
    completedSteps: number;
    totalSteps: number;
    progress: number; // percentage
    successfulSteps: string[];
    failedSteps: string[];
    currentStep: string;
    remainingSteps: string[];
    issuesEncountered: Issue[];
    adjustmentsMade: Adjustment[];
    nextAction: string;
    onTrack: boolean;
    estimatedCompletion: number; // seconds remaining
  };
}

interface Issue {
  step: string;
  problem: string;
  severity: 'low' | 'medium' | 'high';
  resolution?: string;
}

interface Adjustment {
  reason: string;
  change: string;
  impact: string;
}

const REFLECTION_PROMPT = `Reflect on progress executing the plan.

ORIGINAL PLAN:
${formatPlan(plan)}

COMPLETED STEPS:
${formatCompletedSteps(completedSteps)}

CURRENT STEP: ${currentStep.description}

Analyze:
1. Are we on track to achieve the goal?
2. Have any steps failed? Why?
3. Do we need to adjust the plan?
4. What's the next action?

Format as JSON:
{
  "on_track": true/false,
  "issues_encountered": [
    {"step": "...", "problem": "...", "severity": "...", "resolution": "..."}
  ],
  "adjustments_needed": [
    {"reason": "...", "change": "...", "impact": "..."}
  ],
  "next_action": "...",
  "estimated_completion_seconds": 30
}
`;

async function reflect(
  plan: ExecutionPlan,
  completedSteps: PlannedStep[],
  currentStep: PlannedStep
): Promise<ReflectionCheckpoint> {
  const response = await callAgent({
    messages: [
      { role: 'system', content: REFLECTION_PROMPT },
      { role: 'user', content: 'Reflect on current progress.' }
    ],
    temperature: 0.3
  });

  const reflectionData = JSON.parse(response.content);

  return {
    stepId: currentStep.id,
    stepNumber: currentStep.stepNumber,
    timestamp: new Date(),
    reflection: {
      completedSteps: completedSteps.length,
      totalSteps: plan.steps.length,
      progress: (completedSteps.length / plan.steps.length) * 100,
      successfulSteps: completedSteps.filter(s => s.status === 'completed').map(s => s.id),
      failedSteps: completedSteps.filter(s => s.status === 'failed').map(s => s.id),
      currentStep: currentStep.id,
      remainingSteps: plan.steps.filter(s => s.status === 'pending').map(s => s.id),
      issuesEncountered: reflectionData.issues_encountered || [],
      adjustmentsMade: reflectionData.adjustments_needed || [],
      nextAction: reflectionData.next_action,
      onTrack: reflectionData.on_track,
      estimatedCompletion: reflectionData.estimated_completion_seconds
    }
  };
}

// When to reflect?
// 1. After every N steps (e.g., every 3 steps)
// 2. When a step fails
// 3. When a step takes much longer than estimated
// 4. When user pauses execution

async function executePlanWithReflection(plan: ExecutionPlan): Promise<ExecutionResult> {
  const REFLECTION_INTERVAL = 3; // Reflect every 3 steps
  const checkpoints: ReflectionCheckpoint[] = [];
  let stepCount = 0;

  for (const step of plan.steps) {
    try {
      // Execute step
      step.status = 'executing';
      const result = await executeStep(step, plan);
      step.status = 'completed';
      step.result = result;
      stepCount++;

      // Reflect at intervals or on failure
      if (stepCount % REFLECTION_INTERVAL === 0 || step.status === 'failed') {
        const checkpoint = await reflect(
          plan,
          plan.steps.filter(s => s.status === 'completed'),
          step
        );

        checkpoints.push(checkpoint);

        // If off track, pause and ask user
        if (!checkpoint.reflection.onTrack) {
          const userDecision = await askUser({
            message: `Reflection: Not on track. Issues: ${checkpoint.reflection.issuesEncountered}. Continue?`,
            options: ['Continue', 'Adjust Plan', 'Stop']
          });

          if (userDecision === 'Stop') {
            break;
          } else if (userDecision === 'Adjust Plan') {
            // Let user modify plan
            plan = await adjustPlanWithUser(plan, checkpoint);
          }
        }
      }

    } catch (error) {
      step.status = 'failed';
      step.error = error.message;

      // Reflect on failure
      const checkpoint = await reflect(
        plan,
        plan.steps.filter(s => s.status === 'completed' || s.status === 'failed'),
        step
      );

      checkpoints.push(checkpoint);

      // Try to recover
      const recovered = await attemptRecovery(step, error, checkpoint);
      if (!recovered) {
        break; // Can't recover, stop execution
      }
    }
  }

  return {
    plan,
    checkpoints,
    finalStatus: plan.steps.every(s => s.status === 'completed') ? 'success' : 'partial'
  };
}
```

---

## Real-Time Data Integration

### Pattern 1: Web Search with Caching

```typescript
interface SearchCache {
  query: string;
  results: SearchResult[];
  timestamp: number;
  expiresAt: number;
}

class WebSearchService {
  private cache: Map<string, SearchCache> = new Map();
  private CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Check cache first
    const cached = this.getFromCache(query);
    if (cached) {
      console.log('✅ Cache hit for:', query);
      return cached.results;
    }

    // Call real API
    console.log('🌐 Fetching from API:', query);
    const results = await this.searchBrave(query, options);

    // Cache results
    this.addToCache(query, results);

    return results;
  }

  private getFromCache(query: string): SearchCache | null {
    const normalized = this.normalizeQuery(query);
    const cached = this.cache.get(normalized);

    if (!cached) return null;

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(normalized);
      return null;
    }

    return cached;
  }

  private addToCache(query: string, results: SearchResult[]): void {
    const normalized = this.normalizeQuery(query);
    this.cache.set(normalized, {
      query: normalized,
      results,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.CACHE_DURATION
    });

    // Limit cache size
    if (this.cache.size > 100) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this.cache.delete(oldest[0]);
    }
  }

  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private async searchBrave(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const apiKey = await getSecureConfig('BRAVE_API_KEY');

    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?` +
      `q=${encodeURIComponent(query)}&` +
      `count=${options.maxResults || 5}` +
      (options.freshness ? `&freshness=${options.freshness}` : ''),
      {
        headers: {
          'X-Subscription-Token': apiKey,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();

    return data.web.results.map(r => ({
      title: r.title,
      snippet: r.description,
      url: r.url,
      source: new URL(r.url).hostname,
      publishedDate: r.page_age || r.published_date
    }));
  }
}
```

### Pattern 2: Rate Limiting & Fallbacks

```typescript
class RateLimitedSearchService {
  private requestCount = 0;
  private requestWindowStart = Date.now();
  private readonly MAX_REQUESTS_PER_MINUTE = 30;
  private readonly WINDOW_MS = 60000;

  async search(query: string): Promise<SearchResult[]> {
    // Check rate limit
    if (!this.checkRateLimit()) {
      console.warn('⚠️ Rate limit reached, using cached/fallback results');
      return this.getFallbackResults(query);
    }

    try {
      const results = await this.realSearch(query);
      this.recordRequest();
      return results;

    } catch (error) {
      console.error('Search failed:', error);

      // Fallback strategy
      return this.getFallbackResults(query);
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();

    // Reset window if needed
    if (now - this.requestWindowStart > this.WINDOW_MS) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    return this.requestCount < this.MAX_REQUESTS_PER_MINUTE;
  }

  private recordRequest(): void {
    this.requestCount++;
  }

  private async getFallbackResults(query: string): Promise<SearchResult[]> {
    // Fallback 1: Check cache
    const cached = await this.getCachedResults(query);
    if (cached) {
      return cached;
    }

    // Fallback 2: Use alternative search API
    try {
      return await this.searchAlternativeAPI(query);
    } catch (error) {
      console.error('Alternative API also failed');
    }

    // Fallback 3: Return mock results with disclaimer
    return [
      {
        title: `⚠️ Limited results for: ${query}`,
        snippet: 'Search API temporarily unavailable. Showing cached or general information.',
        url: '#',
        source: 'System',
        publishedDate: new Date().toISOString()
      }
    ];
  }
}
```

---

## Security & Validation Patterns

### Pattern 1: Input Sanitization for Artifacts

```typescript
interface ArtifactSecurityPolicy {
  allowExternalScripts: boolean;
  allowExternalStyles: boolean;
  allowForms: boolean;
  allowIframes: boolean;
  maxScriptSize: number;
  blockedDomains: string[];
}

const DEFAULT_POLICY: ArtifactSecurityPolicy = {
  allowExternalScripts: false,
  allowExternalStyles: true,
  allowForms: false,
  allowIframes: false,
  maxScriptSize: 50000, // 50KB
  blockedDomains: []
};

function sanitizeArtifact(
  html: string,
  css: string,
  javascript: string,
  policy: ArtifactSecurityPolicy = DEFAULT_POLICY
): { html: string; css: string; javascript: string; warnings: string[] } {
  const warnings: string[] = [];

  // 1. Sanitize HTML
  const sanitizedHtml = sanitizeHtml(html, {
    allowedTags: [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'img', 'table', 'tr', 'td', 'th',
      'input', 'button', 'label', 'canvas', 'svg'
    ],
    allowedAttributes: {
      'a': ['href', 'title'],
      'img': ['src', 'alt', 'width', 'height'],
      'div': ['class', 'id', 'style'],
      'span': ['class', 'id', 'style'],
      'input': ['type', 'value', 'placeholder', 'class', 'id'],
      'button': ['type', 'class', 'id']
    },
    allowedSchemes: ['http', 'https', 'data'],
    disallowedTagsMode: 'discard'
  });

  if (sanitizedHtml !== html) {
    warnings.push('HTML contained disallowed tags or attributes');
  }

  // 2. Check for external scripts in HTML
  if (!policy.allowExternalScripts && html.includes('<script src=')) {
    warnings.push('External script tags removed');
    html = html.replace(/<script\s+src=["'][^"']*["'][^>]*>.*?<\/script>/gi, '');
  }

  // 3. Sanitize CSS (remove dangerous properties)
  const dangerousCSSPatterns = [
    /url\s*\(\s*["']?javascript:/gi,
    /behavior\s*:/gi,
    /-moz-binding\s*:/gi
  ];

  let sanitizedCss = css;
  for (const pattern of dangerousCSSPatterns) {
    if (pattern.test(sanitizedCss)) {
      warnings.push('Dangerous CSS properties removed');
      sanitizedCss = sanitizedCss.replace(pattern, '');
    }
  }

  // 4. Validate JavaScript
  const jsIssues = validateJavaScript(javascript, policy);
  warnings.push(...jsIssues.warnings);

  return {
    html: sanitizedHtml,
    css: sanitizedCss,
    javascript: jsIssues.sanitized,
    warnings
  };
}

function validateJavaScript(
  code: string,
  policy: ArtifactSecurityPolicy
): { sanitized: string; warnings: string[] } {
  const warnings: string[] = [];
  let sanitized = code;

  // Check size
  if (code.length > policy.maxScriptSize) {
    warnings.push(`JavaScript exceeds max size (${policy.maxScriptSize} bytes)`);
    sanitized = code.substring(0, policy.maxScriptSize);
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    { pattern: /eval\s*\(/gi, name: 'eval()' },
    { pattern: /Function\s*\(/gi, name: 'Function constructor' },
    { pattern: /document\.write/gi, name: 'document.write' },
    { pattern: /innerHTML\s*=/gi, name: 'innerHTML assignment' },
    { pattern: /window\.location/gi, name: 'window.location manipulation' },
    { pattern: /<script/gi, name: 'script tag creation' }
  ];

  for (const { pattern, name } of dangerousPatterns) {
    if (pattern.test(code)) {
      warnings.push(`Potentially dangerous pattern detected: ${name}`);
    }
  }

  // Check for external fetch/xhr to blocked domains
  if (policy.blockedDomains.length > 0) {
    const fetchPattern = /fetch\s*\(\s*["'`]([^"'`]+)["'`]/gi;
    const matches = [...code.matchAll(fetchPattern)];

    for (const match of matches) {
      const url = match[1];
      const domain = new URL(url, 'http://example.com').hostname;

      if (policy.blockedDomains.includes(domain)) {
        warnings.push(`Blocked external fetch to: ${domain}`);
        sanitized = sanitized.replace(match[0], '// Blocked fetch');
      }
    }
  }

  return { sanitized, warnings };
}
```

### Pattern 2: Tool Output Validation

```typescript
interface ToolOutputValidator {
  tool: string;
  validate: (output: any) => ValidationResult;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: any;
}

const TOOL_VALIDATORS: ToolOutputValidator[] = [
  {
    tool: 'create_block',
    validate: (output) => {
      const errors = [];
      const warnings = [];

      // Validate block_id format
      if (!output.block_id || typeof output.block_id !== 'string') {
        errors.push('Invalid block_id');
      }

      // Validate block_id is UUID format
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(output.block_id)) {
        errors.push('block_id must be valid UUID');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    }
  },

  {
    tool: 'search_web_real',
    validate: (output) => {
      const errors = [];
      const warnings = [];

      if (!Array.isArray(output)) {
        errors.push('Search results must be array');
        return { valid: false, errors, warnings };
      }

      for (let i = 0; i < output.length; i++) {
        const result = output[i];

        if (!result.title || !result.snippet || !result.url) {
          warnings.push(`Result ${i} missing required fields`);
        }

        // Validate URL
        try {
          new URL(result.url);
        } catch (e) {
          errors.push(`Result ${i} has invalid URL: ${result.url}`);
        }
      }

      return { valid: errors.length === 0, errors, warnings };
    }
  },

  {
    tool: 'edit_artifact',
    validate: (output) => {
      // Artifact edits should be sanitized before applying
      // This validator checks if sanitization flags any issues

      const warnings = [];

      if (output.warnings && output.warnings.length > 0) {
        warnings.push(...output.warnings.map(w => `Security: ${w}`));
      }

      return {
        valid: true, // Always valid after sanitization
        errors: [],
        warnings
      };
    }
  }
];

async function validateToolOutput(tool: string, output: any): Promise<ValidationResult> {
  const validator = TOOL_VALIDATORS.find(v => v.tool === tool);

  if (!validator) {
    // No validator defined, assume valid
    return { valid: true, errors: [], warnings: [] };
  }

  const result = validator.validate(output);

  // Log validation results
  if (result.errors.length > 0) {
    console.error(`❌ Tool output validation failed for ${tool}:`, result.errors);
  }

  if (result.warnings.length > 0) {
    console.warn(`⚠️ Tool output warnings for ${tool}:`, result.warnings);
  }

  return result;
}
```

---

## Error Recovery Strategies

### Strategy 1: Automatic Retry with Exponential Backoff

```typescript
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT',
    'RATE_LIMIT',
    'SERVICE_UNAVAILABLE'
  ]
};

async function executeToolWithRetry<T>(
  tool: string,
  params: any,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt + 1}/${config.maxRetries + 1} for ${tool}`);

      const result = await executeTool<T>(tool, params);

      if (attempt > 0) {
        console.log(`✅ Succeeded on retry ${attempt}`);
      }

      return result;

    } catch (error) {
      lastError = error as Error;
      const errorType = classifyError(error);

      // Check if error is retryable
      if (!config.retryableErrors.includes(errorType)) {
        console.error(`❌ Non-retryable error: ${errorType}`);
        throw error;
      }

      // Last attempt, don't wait
      if (attempt === config.maxRetries) {
        console.error(`❌ Max retries (${config.maxRetries}) exceeded`);
        break;
      }

      // Wait before retry
      console.warn(`⚠️ ${errorType}, retrying in ${delay}ms...`);
      await sleep(delay);

      // Exponential backoff
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError;
}

function classifyError(error: any): string {
  const message = error.message?.toLowerCase() || '';

  if (message.includes('network') || message.includes('fetch')) {
    return 'NETWORK_ERROR';
  }

  if (message.includes('timeout')) {
    return 'TIMEOUT';
  }

  if (message.includes('rate limit') || message.includes('429')) {
    return 'RATE_LIMIT';
  }

  if (message.includes('503') || message.includes('unavailable')) {
    return 'SERVICE_UNAVAILABLE';
  }

  return 'UNKNOWN_ERROR';
}
```

### Strategy 2: Alternative Tool Execution

```typescript
interface ToolAlternative {
  primary: string;
  fallbacks: string[];
  paramTransform?: (params: any, targetTool: string) => any;
}

const TOOL_ALTERNATIVES: ToolAlternative[] = [
  {
    primary: 'search_web_brave',
    fallbacks: ['search_web_tavily', 'search_web_google'],
    paramTransform: (params, target) => {
      // Different search APIs may have different param formats
      if (target === 'search_web_tavily') {
        return {
          query: params.query,
          max_results: params.maxResults
          // Tavily has different param names
        };
      }
      return params;
    }
  },

  {
    primary: 'edit_artifact',
    fallbacks: ['edit_text_block'], // If artifact edit fails, fall back to text edit
    paramTransform: (params, target) => {
      if (target === 'edit_text_block') {
        // Convert artifact params to text params
        return {
          block_id: params.block_id,
          new_content: `<!-- HTML -->\n${params.html}\n\n/* CSS */\n${params.css}\n\n// JS\n${params.javascript}`,
          reason: params.reason
        };
      }
      return params;
    }
  }
];

async function executeToolWithFallback<T>(
  tool: string,
  params: any
): Promise<T> {
  const alternative = TOOL_ALTERNATIVES.find(alt => alt.primary === tool);

  if (!alternative) {
    // No fallback, just execute normally
    return await executeTool<T>(tool, params);
  }

  // Try primary
  try {
    return await executeTool<T>(tool, params);
  } catch (primaryError) {
    console.warn(`⚠️ Primary tool ${tool} failed:`, primaryError);

    // Try fallbacks in order
    for (const fallback of alternative.fallbacks) {
      try {
        console.log(`🔄 Trying fallback: ${fallback}`);

        const fallbackParams = alternative.paramTransform
          ? alternative.paramTransform(params, fallback)
          : params;

        const result = await executeTool<T>(fallback, fallbackParams);

        console.log(`✅ Fallback ${fallback} succeeded`);
        return result;

      } catch (fallbackError) {
        console.warn(`⚠️ Fallback ${fallback} also failed:`, fallbackError);
        continue;
      }
    }

    // All fallbacks failed
    throw new Error(`Primary and all fallbacks failed for ${tool}`);
  }
}
```

---

## Performance Optimization

### Optimization 1: Parallel Tool Execution

```typescript
interface ToolCallGroup {
  parallel: ToolCall[];
  sequential: ToolCall[][];
}

function groupToolCalls(toolCalls: ToolCall[]): ToolCallGroup {
  const dependencyGraph = buildDependencyGraph(toolCalls);
  const parallel: ToolCall[] = [];
  const sequential: ToolCall[][] = [];

  // Tools with no dependencies can run in parallel
  const independent = toolCalls.filter(tc =>
    !dependencyGraph.has(tc.id) || dependencyGraph.get(tc.id).length === 0
  );

  parallel.push(...independent);

  // Group dependent tools into sequential batches
  const remaining = toolCalls.filter(tc => !independent.includes(tc));

  while (remaining.length > 0) {
    const batch = remaining.filter(tc => {
      const deps = dependencyGraph.get(tc.id) || [];
      return deps.every(depId =>
        parallel.some(p => p.id === depId) ||
        sequential.flat().some(s => s.id === depId)
      );
    });

    if (batch.length === 0) {
      console.error('Circular dependency detected in tool calls');
      break;
    }

    sequential.push(batch);
    remaining.splice(0, batch.length);
  }

  return { parallel, sequential };
}

async function executeToolCallsOptimized(toolCalls: ToolCall[]): Promise<Map<string, any>> {
  const grouped = groupToolCalls(toolCalls);
  const results = new Map<string, any>();

  // Execute independent tools in parallel
  if (grouped.parallel.length > 0) {
    console.log(`⚡ Executing ${grouped.parallel.length} tools in parallel`);

    const parallelResults = await Promise.all(
      grouped.parallel.map(tc => executeTool(tc.tool, tc.params))
    );

    grouped.parallel.forEach((tc, idx) => {
      results.set(tc.id, parallelResults[idx]);
    });
  }

  // Execute sequential batches
  for (let i = 0; i < grouped.sequential.length; i++) {
    const batch = grouped.sequential[i];
    console.log(`⚡ Executing batch ${i + 1} (${batch.length} tools) in parallel`);

    const batchResults = await Promise.all(
      batch.map(tc => executeTool(tc.tool, tc.params))
    );

    batch.forEach((tc, idx) => {
      results.set(tc.id, batchResults[idx]);
    });
  }

  return results;
}
```

### Optimization 2: Streaming Responses

```typescript
// Instead of waiting for full response, stream partial results

interface StreamingToolExecution {
  toolId: string;
  tool: string;
  status: 'pending' | 'streaming' | 'completed' | 'failed';
  partialResult: any;
  finalResult?: any;
  onProgress?: (partial: any) => void;
}

async function executeToolStreaming(
  tool: string,
  params: any,
  onProgress: (partial: any) => void
): Promise<any> {
  // Example: Streaming search results as they arrive

  if (tool === 'search_web_real') {
    const results: SearchResult[] = [];

    await streamingSearch(params.query, (result) => {
      results.push(result);
      onProgress({ results: [...results], complete: false });
    });

    onProgress({ results, complete: true });
    return results;
  }

  // Example: Streaming artifact generation

  if (tool === 'create_artifact') {
    const artifact = { html: '', css: '', javascript: '' };

    const stream = await streamingGenerate(params.prompt);

    for await (const chunk of stream) {
      // Parse chunk and update artifact
      if (chunk.type === 'html') artifact.html += chunk.content;
      if (chunk.type === 'css') artifact.css += chunk.content;
      if (chunk.type === 'js') artifact.javascript += chunk.content;

      onProgress({ ...artifact, complete: false });
    }

    onProgress({ ...artifact, complete: true });
    return artifact;
  }

  // For non-streaming tools, just execute normally
  return await executeTool(tool, params);
}

// Use in UI to show progressive updates
function AIEditPanel() {
  const [partialResults, setPartialResults] = useState<Map<string, any>>(new Map());

  async function handleToolCall(tool: string, params: any) {
    await executeToolStreaming(tool, params, (partial) => {
      setPartialResults(prev => new Map(prev).set(tool, partial));
    });
  }

  // Render partial results as they arrive
  return (
    <div>
      {Array.from(partialResults.entries()).map(([tool, result]) => (
        <div key={tool}>
          <h4>{tool}</h4>
          {result.complete ? (
            <div>✅ Complete</div>
          ) : (
            <div>
              ⏳ In progress...
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## Conclusion

These architectural patterns provide the foundation for building a sophisticated AI agent system. Key takeaways:

1. **Orchestration is key:** Smart tool chaining (sequential, parallel, conditional) dramatically improves efficiency
2. **Context is precious:** Use hierarchical structures, compression, and smart trimming to maximize effective context window
3. **Plan before executing:** Planning phase prevents wasted tokens and enables user review
4. **Reflect often:** Reflection checkpoints catch errors early and enable recovery
5. **Security first:** Sanitize all inputs, validate all outputs, especially for user-generated code
6. **Fail gracefully:** Retry with backoff, use fallbacks, always have a plan B
7. **Optimize aggressively:** Parallel execution, streaming, caching - every millisecond counts

Use these patterns as building blocks for the implementation roadmap in the main research document.

---

**Document Version:** 1.0
**Last Updated:** 2025-01-15
**Companion To:** AI_AGENT_ENHANCEMENT_RESEARCH.md
