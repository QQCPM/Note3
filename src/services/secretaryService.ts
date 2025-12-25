/**
 * Secretary Service - Conversational AI Planning
 * 
 * The brain of the AI Secretary that:
 * 1. Understands natural language planning requests
 * 2. Has tools for roadmap creation, scheduling, calendar management
 * 3. Executes tool calls in a loop until task is complete
 */

import { tauriAI, type Message, type Tool } from './tauriAI';
import { memoryService } from './memoryService';
import * as dailyPlanService from './dailyPlanService';
import type {
    SecretaryResponse,
    SecretaryAction,
    SecretaryTool,
    RoadmapData,
    CalendarEvent,
    ToolCallResult
} from '@/types/secretary';

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SECRETARY_SYSTEM_PROMPT = `You are an AI Learning Secretary that helps users plan learning roadmaps.

## CRITICAL: YOU MUST USE TOOLS
**NEVER describe, outline, or talk about a roadmap without FIRST calling the create_roadmap tool.**
**NEVER say "I'll save that" without ACTUALLY calling save_roadmap.**

When you call a tool, call it. Do not just say you will call it.

## Available Tools (YOU MUST USE THESE)
1. **create_roadmap** - CALL THIS to create a learning plan. This stores the plan.
2. **save_roadmap** - CALL THIS to save a created roadmap to a start date.
3. **mark_day_off** - CALL THIS to mark vacation/sick days.
4. **add_calendar_event** - CALL THIS for meetings/events.
5. **generate_daily_plan** - CALL THIS to create daily schedules.
6. **update_preferences** - CALL THIS to change study settings.

## Workflow for Creating/Saving Roadmaps
1. User asks for a roadmap → CALL create_roadmap with topic, duration, etc.
2. After create_roadmap succeeds → Show summary and ask "Want me to save this?"
3. User confirms → CALL save_roadmap with start_date

## Date Handling
- Today: ${new Date().toISOString().split('T')[0]}
- "after New Year 2026" = 2026-01-01
- "next Monday" = calculate the actual date
- "tomorrow" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}

## WRONG vs RIGHT
❌ WRONG: "Here's your roadmap: Week 1... Week 2..." (just text, no tool call)
✅ RIGHT: Call create_roadmap tool FIRST, then show the result

❌ WRONG: "I'll save that for you starting Jan 1" (just words)
✅ RIGHT: Call save_roadmap(start_date="2026-01-01") FIRST, then confirm

Be conversational but ALWAYS USE TOOLS for actions.`;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const SECRETARY_TOOLS: SecretaryTool[] = [
    {
        name: 'create_roadmap',
        description: 'Create a learning roadmap for a topic. Returns a structured plan but does NOT save it yet. Always show the user the plan and ask for confirmation before saving.',
        parameters: {
            type: 'object',
            properties: {
                topic: {
                    type: 'string',
                    description: 'The main topic to learn (e.g., "Deep Learning", "Web Development")'
                },
                duration_days: {
                    type: 'number',
                    description: 'Total number of days for the roadmap (e.g., 60 for 2 months)'
                },
                study_days: {
                    type: 'array',
                    description: 'Days of the week to study (e.g., ["Mon", "Tue", "Wed", "Thu", "Fri"])',
                    items: { type: 'string' }
                },
                daily_hours: {
                    type: 'number',
                    description: 'Hours per study day (e.g., 2)'
                },
                specific_topics: {
                    type: 'string',
                    description: 'Optional specific subtopics or resources to include'
                }
            },
            required: ['topic', 'duration_days']
        }
    },
    {
        name: 'save_roadmap',
        description: 'Save a previously created roadmap and activate it. Call this ONLY after user confirms they want to save.',
        parameters: {
            type: 'object',
            properties: {
                roadmap_name: {
                    type: 'string',
                    description: 'Name of the roadmap to save'
                },
                start_date: {
                    type: 'string',
                    description: 'When to start (YYYY-MM-DD format). Leave empty to start today.'
                },
                project_id: {
                    type: 'string',
                    description: 'Project ID to save to. Use "default" if not specified.'
                }
            },
            required: ['roadmap_name']
        }
    },
    {
        name: 'generate_daily_plan',
        description: 'Generate or regenerate the daily study plan for a specific date based on the active roadmap.',
        parameters: {
            type: 'object',
            properties: {
                date: {
                    type: 'string',
                    description: 'Date to generate plan for (YYYY-MM-DD). Leave empty for today.'
                }
            },
            required: []
        }
    },
    {
        name: 'mark_day_off',
        description: 'Mark a day as off (no study tasks). The roadmap day counter will pause.',
        parameters: {
            type: 'object',
            properties: {
                date: {
                    type: 'string',
                    description: 'Date to mark as off (YYYY-MM-DD)'
                },
                reason: {
                    type: 'string',
                    description: 'Reason for day off (e.g., "vacation", "holiday", "sick")'
                }
            },
            required: ['date']
        }
    },
    {
        name: 'add_calendar_event',
        description: 'Add a meeting or event that blocks study time. The daily plan will be adjusted around this event.',
        parameters: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'Event title (e.g., "Team meeting", "Doctor appointment")'
                },
                date: {
                    type: 'string',
                    description: 'Event date (YYYY-MM-DD)'
                },
                time: {
                    type: 'string',
                    description: 'Start time (HH:MM format, e.g., "10:00", "14:30")'
                },
                duration_minutes: {
                    type: 'number',
                    description: 'Duration in minutes (e.g., 60 for 1 hour)'
                }
            },
            required: ['title', 'date', 'time', 'duration_minutes']
        }
    },
    {
        name: 'update_preferences',
        description: 'Update user study preferences like available days, hours per day, focus time.',
        parameters: {
            type: 'object',
            properties: {
                study_days: {
                    type: 'array',
                    description: 'Days available for study',
                    items: { type: 'string' }
                },
                daily_hours: {
                    type: 'number',
                    description: 'Hours per study day'
                },
                focus_time: {
                    type: 'string',
                    description: 'Preferred focus time (e.g., "9am-12pm")'
                },
                break_frequency: {
                    type: 'number',
                    description: 'Break frequency in minutes'
                }
            },
            required: []
        }
    }
];

// Convert to tauriAI Tool format
function getToolsForAI(): Tool[] {
    return SECRETARY_TOOLS.map(tool => ({
        type: 'function' as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }
    }));
}

// ============================================================================
// TOOL EXECUTORS
// ============================================================================

// Temporary storage for roadmap being created (before save)
let pendingRoadmap: RoadmapData | null = null;

async function executeCreateRoadmap(args: {
    topic: string;
    duration_days: number;
    study_days?: string[];
    daily_hours?: number;
    specific_topics?: string;
}): Promise<ToolCallResult> {
    try {
        const studyDays = args.study_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        const dailyHours = args.daily_hours || 2;

        // Calculate timeline
        const totalWeeks = Math.ceil(args.duration_days / 7);
        const totalMonths = Math.ceil(totalWeeks / 4);

        // Generate rich, structured roadmap with Month > Week > Concepts/Reading/Tasks
        const prompt = `Create a COMPREHENSIVE learning roadmap for: ${args.topic}

TIMELINE: ${totalMonths} month(s), ${totalWeeks} weeks total
SCHEDULE: ${studyDays.join(', ')}, ${dailyHours} hours per day
${args.specific_topics ? `MUST INCLUDE: ${args.specific_topics}` : ''}

Generate a DETAILED curriculum with this EXACT structure:

{
  "name": "Descriptive Roadmap Name",
  "months": [
    {
      "month": 1,
      "title": "Month 1: The Foundation Phase",
      "goal": "Clear goal statement for this month - what the learner will achieve",
      "resources": "Core books, courses, or materials for this month (be specific with titles/URLs)",
      "weeks": [
        {
          "week": 1,
          "title": "Week 1: Topic Name",
          "concepts": "Key concepts to learn this week. Be specific - not 'learn basics' but 'Learn JSX syntax, component lifecycle, props and state management'",
          "reading": "Specific chapters, documentation sections, or articles to read",
          "tasks": "Hands-on projects, exercises, or implementations. Be specific - 'Build a Todo app with useState and useEffect' not just 'Practice'"
        },
        {
          "week": 2,
          "title": "Week 2: Next Topic",
          "concepts": "...",
          "reading": "...",
          "tasks": "..."
        }
      ]
    }
  ]
}

REQUIREMENTS:
1. Generate ALL ${totalMonths} months with ALL ${totalWeeks} weeks
2. Each month MUST have a clear Goal and Core Resources
3. Each week MUST have detailed Concepts, Reading, and Tasks
4. Be SPECIFIC - name actual books, chapters, frameworks, projects
5. Week 4, 8, 12, etc. should include larger projects
6. Final month should have a capstone project

Generate the complete JSON now.`;

        const response = await tauriAI.chat([{ role: 'user', content: prompt }]);

        // Parse the roadmap
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to generate roadmap structure');
        }

        const generated = JSON.parse(jsonMatch[0]);

        // Convert to internal format for storage
        const dailyTopics: any[] = [];
        let dayCounter = 1;
        for (const month of generated.months || []) {
            for (const week of month.weeks || []) {
                dailyTopics.push({
                    day: dayCounter++,
                    week: week.week,
                    month: month.month,
                    topic: week.title,
                    concepts: week.concepts,
                    reading: week.reading,
                    tasks: week.tasks
                });
            }
        }

        // Store as pending roadmap
        pendingRoadmap = {
            name: generated.name || `${args.topic} Roadmap`,
            topic: args.topic,
            totalDays: args.duration_days,
            studyDays,
            dailyHours,
            phases: generated.months || [],
            dailyTopics
        };

        // Build RICH output in the user's desired format
        let detailMessage = `# ${pendingRoadmap.name}\n\n`;

        for (const month of generated.months || []) {
            detailMessage += `---\n\n`;
            detailMessage += `## ${month.title}\n\n`;

            if (month.goal) {
                detailMessage += `**Goal:** ${month.goal}\n\n`;
            }
            if (month.resources) {
                detailMessage += `**Core Resources:** ${month.resources}\n\n`;
            }

            for (const week of month.weeks || []) {
                detailMessage += `### ${week.title}\n\n`;

                if (week.concepts) {
                    detailMessage += `**Concepts:** ${week.concepts}\n\n`;
                }
                if (week.reading) {
                    detailMessage += `**Reading:** ${week.reading}\n\n`;
                }
                if (week.tasks) {
                    detailMessage += `**Tasks:** ${week.tasks}\n\n`;
                }
            }
        }

        detailMessage += `---\n\n`;
        detailMessage += `✅ **This roadmap is ready to save!**\n\n`;
        detailMessage += `Tell me when you want to start (e.g., "tomorrow", "next Monday", "January 2, 2026") and I'll add it to your calendar.\n\n`;
        detailMessage += `💡 You can also ask me to modify any part before saving.`;

        return {
            success: true,
            data: pendingRoadmap,
            message: detailMessage
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create roadmap'
        };
    }
}

async function executeSaveRoadmap(args: {
    roadmap_name: string;
    start_date?: string;
    project_id?: string;
}): Promise<ToolCallResult> {
    try {
        if (!pendingRoadmap) {
            return {
                success: false,
                error: 'No roadmap to save. Create a roadmap first.'
            };
        }

        const projectId = args.project_id || 'default-project';
        const startDate = args.start_date || new Date().toISOString().split('T')[0];

        // Convert to the format expected by dailyPlanService
        const roadmapContent = `
# ${pendingRoadmap.name}

## Overview
- Topic: ${pendingRoadmap.topic}
- Duration: ${pendingRoadmap.totalDays} days
- Study Days: ${pendingRoadmap.studyDays.join(', ')}
- Hours per Day: ${pendingRoadmap.dailyHours}
- Start Date: ${startDate}

## Phases
${pendingRoadmap.phases.map(p => `### ${p.name} (Weeks ${p.weeks})\n${p.topics.map(t => `- ${t}`).join('\n')}`).join('\n\n')}

## Daily Schedule
${pendingRoadmap.dailyTopics.map(d => `Day ${d.day}: ${d.topic} (${d.type}, ${d.duration})`).join('\n')}
`;

        // Process through dailyPlanService
        await dailyPlanService.processRoadmap(roadmapContent, projectId);

        // Update the start date in memory
        const projectMemory = await memoryService.loadProjectMemory(projectId);
        if (projectMemory) {
            projectMemory.timeline.startDate = startDate;
            await memoryService.saveProjectMemory(projectId, projectMemory);
        }

        // Clear pending roadmap
        const savedName = pendingRoadmap.name;
        pendingRoadmap = null;

        return {
            success: true,
            data: { projectId, startDate, name: savedName },
            message: `Saved "${savedName}"! First study day: ${startDate}`
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to save roadmap'
        };
    }
}

async function executeGenerateDailyPlan(args: { date?: string }): Promise<ToolCallResult> {
    try {
        // Get active project from dashboard store
        const { useDashboardStore } = await import('@/store/dashboardStore');
        const projectId = useDashboardStore.getState().activeRoadmapId || 'default-project';

        const plan = await dailyPlanService.generateDailyPlan(projectId, args.date);

        return {
            success: true,
            data: plan,
            message: `Generated plan for ${args.date || 'today'} with ${plan.tasks.length} tasks.`
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate daily plan'
        };
    }
}

async function executeMarkDayOff(args: { date: string; reason?: string }): Promise<ToolCallResult> {
    try {
        // Load AI memory and add blocked date
        const aiMemory = await memoryService.loadAIMemory();
        if (aiMemory) {
            if (!aiMemory.blockedDates) {
                aiMemory.blockedDates = [];
            }
            aiMemory.blockedDates.push(args.date);
            await memoryService.saveAIMemory(aiMemory);
        }

        return {
            success: true,
            data: { date: args.date, reason: args.reason },
            message: `Marked ${args.date} as day off${args.reason ? ` (${args.reason})` : ''}.`
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to mark day off'
        };
    }
}

async function executeAddCalendarEvent(args: {
    title: string;
    date: string;
    time: string;
    duration_minutes: number;
}): Promise<ToolCallResult> {
    try {
        const event: CalendarEvent = {
            id: `event-${Date.now()}`,
            title: args.title,
            date: args.date,
            time: args.time,
            durationMinutes: args.duration_minutes,
            type: 'meeting'
        };

        // For now, store in daily memory as a blocked time
        // In production, would have a proper calendar store
        console.log('📅 [Secretary] Adding calendar event:', event);

        return {
            success: true,
            data: event,
            message: `Added "${args.title}" on ${args.date} at ${args.time} (${args.duration_minutes} min).`
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to add event'
        };
    }
}

async function executeUpdatePreferences(args: {
    study_days?: string[];
    daily_hours?: number;
    focus_time?: string;
    break_frequency?: number;
}): Promise<ToolCallResult> {
    try {
        const aiMemory = await memoryService.loadAIMemory();
        if (aiMemory) {
            if (args.study_days) {
                // Update availability
                aiMemory.availability = [{
                    days: args.study_days,
                    timeRange: args.focus_time || aiMemory.preferences?.bestFocusTime || '9am-12pm'
                }];
            }
            if (args.daily_hours !== undefined) {
                aiMemory.preferences = {
                    ...aiMemory.preferences,
                    weekdayHours: args.daily_hours
                };
            }
            if (args.focus_time) {
                aiMemory.preferences = {
                    ...aiMemory.preferences,
                    bestFocusTime: args.focus_time
                };
            }
            if (args.break_frequency !== undefined) {
                aiMemory.preferences = {
                    ...aiMemory.preferences,
                    breakFrequencyMinutes: args.break_frequency
                };
            }

            await memoryService.saveAIMemory(aiMemory);
        }

        return {
            success: true,
            data: args,
            message: 'Preferences updated!'
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update preferences'
        };
    }
}

// Main tool executor
async function executeTool(name: string, args: any): Promise<ToolCallResult> {
    console.log(`🔧 [Secretary] Executing tool: ${name}`, args);

    switch (name) {
        case 'create_roadmap':
            return executeCreateRoadmap(args);
        case 'save_roadmap':
            return executeSaveRoadmap(args);
        case 'generate_daily_plan':
            return executeGenerateDailyPlan(args);
        case 'mark_day_off':
            return executeMarkDayOff(args);
        case 'add_calendar_event':
            return executeAddCalendarEvent(args);
        case 'update_preferences':
            return executeUpdatePreferences(args);
        default:
            return { success: false, error: `Unknown tool: ${name}` };
    }
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

/**
 * Process a user message through the secretary AI
 * Handles the full tool-calling loop
 */
export async function processSecretaryMessage(
    userMessage: string,
    conversationHistory: Message[] = []
): Promise<SecretaryResponse> {
    const actions: SecretaryAction[] = [];

    // Refresh session to keep it active
    refreshSecretarySession();
    console.log('📅 [Secretary] Processing message, session active');

    try {
        // Build messages with system prompt
        const messages: Message[] = [
            { role: 'system', content: SECRETARY_SYSTEM_PROMPT },
            ...conversationHistory,
            { role: 'user', content: userMessage }
        ];

        // Call AI with tools
        const response = await tauriAI.chatWithTools(messages, getToolsForAI());
        console.log('🔧 [Secretary] AI response:', JSON.stringify(response, null, 2));

        // Check if AI wants to call tools
        if (response.tool_calls && response.tool_calls.length > 0) {
            // Execute all tool calls
            const toolResults: string[] = [];

            for (const toolCall of response.tool_calls) {
                // Handle both formats:
                // Format 1 (direct): { name: "create_roadmap", arguments: {...} }
                // Format 2 (OpenAI): { function: { name: "create_roadmap", arguments: "{...}" } }
                const toolName = toolCall.name || (toolCall as any).function?.name;
                let toolArgs = toolCall.arguments || (toolCall as any).function?.arguments;

                // Parse arguments if they're a string (OpenAI returns stringified JSON)
                if (typeof toolArgs === 'string') {
                    try {
                        toolArgs = JSON.parse(toolArgs);
                    } catch {
                        console.error('Failed to parse tool arguments:', toolArgs);
                        toolArgs = {};
                    }
                }

                console.log(`🔧 [Secretary] Executing tool: ${toolName}`, toolArgs);

                if (!toolName) {
                    console.error('❌ [Secretary] Tool call has no name:', toolCall);
                    toolResults.push('❌ Tool call failed: no tool name');
                    continue;
                }

                const result = await executeTool(toolName, toolArgs);

                // Record action
                actions.push({
                    type: toolName as SecretaryAction['type'],
                    details: { args: toolArgs, result },
                    timestamp: new Date().toISOString()
                });

                toolResults.push(
                    result.success
                        ? `✅ ${result.message}`
                        : `❌ ${result.error}`
                );
            }

            // For create_roadmap, the tool result contains the full detailed plan
            // We want to display it directly, NOT ask the AI to summarize it
            const createRoadmapResult = actions.find(a => (a.type as string) === 'create_roadmap');

            if (createRoadmapResult && createRoadmapResult.details?.result?.success) {
                // Return the detailed roadmap directly without having AI rewrite it
                return {
                    message: createRoadmapResult.details.result.message,
                    actions,
                    pendingApproval: pendingRoadmap !== null,
                    proposedRoadmap: pendingRoadmap || undefined
                };
            }

            // For other tools, get AI's final response incorporating tool results
            const followUpMessages: Message[] = [
                ...messages,
                { role: 'assistant', content: response.content || '' },
                {
                    role: 'user',
                    content: `Tool results:\n${toolResults.join('\n')}\n\nBriefly confirm what was done and ask for any next steps.`
                }
            ];

            const finalResponse = await tauriAI.chat(followUpMessages);

            return {
                message: finalResponse,
                actions,
                pendingApproval: pendingRoadmap !== null,
                proposedRoadmap: pendingRoadmap || undefined
            };
        }

        // No tool calls - just return the response
        return {
            message: response.content || "I'm here to help with your learning schedule. What would you like to do?",
            actions,
            pendingApproval: pendingRoadmap !== null,
            proposedRoadmap: pendingRoadmap || undefined
        };

    } catch (error) {
        console.error('❌ [Secretary] Error processing message:', error);
        return {
            message: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
            actions
        };
    }
}

// ============================================================================
// SESSION TRACKING
// ============================================================================

// Track if we're in a secretary conversation (for follow-up routing)
let inSecretarySession = false;
let lastSecretaryMessageTime = 0;
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if in active secretary session
 */
export function isInSecretarySession(): boolean {
    if (!inSecretarySession) return false;

    // Check if session has expired
    const timeSinceLastMessage = Date.now() - lastSecretaryMessageTime;
    if (timeSinceLastMessage > SESSION_TIMEOUT_MS) {
        inSecretarySession = false;
        return false;
    }

    return true;
}

/**
 * Start or refresh secretary session
 */
export function refreshSecretarySession(): void {
    inSecretarySession = true;
    lastSecretaryMessageTime = Date.now();
}

/**
 * End secretary session
 */
export function endSecretarySession(): void {
    inSecretarySession = false;
    pendingRoadmap = null;
}

/**
 * Check if a message is a planning-related request
 * Also returns true if we're in an active secretary session (for follow-ups)
 */
export function isPlanningRequest(message: string): boolean {
    // If we're in an active secretary session, route ALL messages to secretary
    // This handles "save it", "yes", "ok", answers to questions, etc.
    if (isInSecretarySession()) {
        console.log('📅 [Secretary] In active session, routing message to secretary');
        return true;
    }

    // If there's a pending roadmap, route to secretary
    if (pendingRoadmap !== null) {
        console.log('📅 [Secretary] Pending roadmap exists, routing to secretary');
        return true;
    }

    // Initial planning request patterns
    const patterns = [
        // Roadmap/curriculum keywords
        /\b(roadmap|curriculum|syllabus|course|lesson plan)\b/i,

        // Learning + duration
        /\b(learn|study|practice|teach me)\b.*\b(month|week|day|hour)\b/i,

        // Schedule/plan keywords
        /\b(schedule|daily plan|study plan)\b/i,
        /\b(create|make|build)\b.*\b(plan|schedule|roadmap)\b/i,

        // Day off / vacation
        /\b(day off|vacation|holiday|sick day)\b/i,
        /\b(tomorrow|today)\b.*\b(off|free|busy|skip)\b/i,

        // Meeting/event with time
        /\b(meeting|appointment|event)\b.*\b(at|on|for)\b/i,

        // Start date mentions
        /\b(start|begin)\b.*\b(after|from|on|next|tomorrow)\b/i,
        /\bafter\b.*\b(new year|christmas|holiday)\b/i,

        // Availability
        /\b(available|free)\b.*\b(day|time|hour|on)\b/i,

        // Weekday mentions with context
        /\b(only|on)\b.*\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
        /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*\b(and|or|to)\b.*\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,

        // Confirmation patterns (when there's implied context)
        /^(save|save it|yes|ok|okay|sure|do it|go ahead|confirm|proceed)\s*[!.]?$/i,

        // Duration patterns
        /\b\d+\s*(month|week|hour|day)\b/i
    ];

    return patterns.some(pattern => pattern.test(message));
}

/**
 * Get the pending roadmap (for preview)
 */
export function getPendingRoadmap(): RoadmapData | null {
    return pendingRoadmap;
}

/**
 * Clear the pending roadmap (if user cancels)
 */
export function clearPendingRoadmap(): void {
    pendingRoadmap = null;
}

/**
 * Check if there's a pending roadmap waiting for save confirmation
 */
export function hasPendingRoadmap(): boolean {
    return pendingRoadmap !== null;
}
