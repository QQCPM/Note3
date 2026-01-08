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
// Note: dailyPlanService was imported for future use but is currently unused
// import * as dailyPlanService from './dailyPlanService';
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
- Today: ${(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })()}
- "after New Year 2026" = 2026-01-01
- "next Monday" = calculate the actual date
- "tomorrow" = ${(() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })()}

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

// Helper to sanitize filenames (remove special chars)
function sanitizeFilename(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, '')       // Trim leading/trailing hyphens
        .substring(0, 50);              // Limit length
}

export async function executeCreateRoadmap(args: {
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

        // Generate structured roadmap - day by day with clear format
        const prompt = `Create a learning roadmap for: ${args.topic}

DURATION: ${args.duration_days} days (${totalWeeks} weeks)
SCHEDULE: ${studyDays.join(', ')}, ${dailyHours} hours per day
${args.specific_topics ? `FOCUS ON: ${args.specific_topics}` : ''}

OUTPUT FORMAT - Use this exact structure:
{
  "name": "Clear descriptive name",
  "duration": "${args.duration_days} days",
  "daily_hours": ${dailyHours},
  "goal": "What the learner will achieve by the end",
  "days": [
    {
      "day": 1,
      "title": "Day 1: Topic Name",
      "tasks": [
        "[ ] Specific actionable task 1",
        "[ ] Specific actionable task 2"
      ]
    },
    {
      "day": 2,
      "title": "Day 2: Next Topic",
      "tasks": ["[ ] Task 1", "[ ] Task 2"]
    }
  ],
  "resources": [
    "Resource 1 - https://...",
    "Resource 2 - https://..."
  ]
}

RULES:
- Generate exactly ${args.duration_days} days
- Each day has 2-4 specific, checkable tasks
- Keep tasks concise (10-15 words max)
- Use checkboxes [ ] for every task
- Group resources at the end (5-10 max)
- Day titles should be short and clear

Generate the complete JSON now.`;

        const response = await tauriAI.chat([{ role: 'user', content: prompt }]);

        // Parse the roadmap
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to generate roadmap structure');
        }

        const generated = JSON.parse(jsonMatch[0]);

        // Convert to internal format for storage (days-based)
        const dailyTopics: any[] = [];
        for (const day of generated.days || []) {
            dailyTopics.push({
                day: day.day,
                week: Math.ceil(day.day / 7),
                month: Math.ceil(day.day / 30),
                topic: day.title,
                tasks: day.tasks || []
            });
        }

        // Store as pending roadmap
        pendingRoadmap = {
            name: generated.name || `${args.topic} Roadmap`,
            topic: args.topic,
            totalDays: args.duration_days,
            studyDays,
            dailyHours,
            phases: [], // No longer used, kept for compatibility
            dailyTopics
        };

        // Build clean day-by-day output
        let detailMessage = `# ${pendingRoadmap.name}\n\n`;
        detailMessage += `**Duration:** ${args.duration_days} days | **Daily:** ${dailyHours}h\n\n`;

        if (generated.goal) {
            detailMessage += `**Goal:** ${generated.goal}\n\n`;
        }

        detailMessage += `---\n\n`;

        for (const day of generated.days || []) {
            detailMessage += `## ${day.title}\n`;
            if (day.tasks && Array.isArray(day.tasks)) {
                for (const task of day.tasks) {
                    detailMessage += `${task}\n`;
                }
            }
            detailMessage += `\n`;
        }

        // Resources at the end
        if (generated.resources && Array.isArray(generated.resources) && generated.resources.length > 0) {
            detailMessage += `---\n\n`;
            detailMessage += `## 📚 Resources\n\n`;
            for (const resource of generated.resources) {
                detailMessage += `- ${resource}\n`;
            }
            detailMessage += `\n`;
        }

        detailMessage += `---\n\n`;
        detailMessage += `✅ **This roadmap is ready to save!**\n\n`;
        detailMessage += `Tell me when you want to start (e.g., "tomorrow", "next Monday") and I'll add it to your calendar.\n\n`;
        detailMessage += `💡 You can also ask me to modify any part before saving.`;

        // Store the full content for archiving (strip the "ready to save" footer)
        const archiveContent = detailMessage.split('---\n\n✅')[0].trim() + '\n';
        pendingRoadmap.rawContent = archiveContent;

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

export async function executeSaveRoadmap(args: {
    roadmap_name: string;
    start_date?: string;
    end_date?: string;      // AI can calculate and provide this directly
    project_id?: string;
}): Promise<ToolCallResult> {
    try {
        if (!pendingRoadmap) {
            return {
                success: false,
                error: 'No roadmap to save. Create a roadmap first.'
            };
        }

        const startDate = args.start_date || new Date().toISOString().split('T')[0];

        // Use AI-provided end_date if available, otherwise calculate from totalDays
        let endDate: string;
        if (args.end_date) {
            endDate = args.end_date;
            console.log(`📅 [Secretary] Using AI-provided end date: ${endDate}`);
        } else {
            // Fallback: calculate from start + totalDays
            const endDateObj = new Date(startDate);
            endDateObj.setDate(endDateObj.getDate() + pendingRoadmap.totalDays);
            endDate = endDateObj.toISOString().split('T')[0];
        }

        // Generate short plan ID from topic (more unique than name prefix)
        // e.g., "MLE and ML Algorithms" -> "MM", "Rocket Engineering" -> "RE"
        const topicWords = pendingRoadmap.topic
            .replace(/[^a-zA-Z\s]/g, '')  // Remove non-letter chars (numbers, parentheses, etc.)
            .split(/\s+/)
            .filter(w => w.length > 2 && !/^(and|the|for|with|from|into)$/i.test(w));
        let basePlanId = topicWords
            .slice(0, 2)
            .map(w => w.charAt(0).toUpperCase())
            .join('') || 'PL';

        // Check for uniqueness against existing plans
        const existingMemory = await memoryService.loadPlanMemory();
        const existingIds = existingMemory ? existingMemory.activePlans.map(p => p.id) : [];
        let planId = basePlanId;
        let counter = 1;
        while (existingIds.includes(planId)) {
            planId = `${basePlanId}${counter}`;
            counter++;
        }

        // Calculate total weeks
        const totalWeeks = Math.ceil(pendingRoadmap.totalDays / 7);

        // Build full markdown content for archive
        const fullContent = pendingRoadmap.rawContent || buildRoadmapMarkdown(pendingRoadmap);

        // Extract weekly themes from the content
        const weeklyThemes = extractWeeklyThemes(fullContent, totalWeeks);

        // Create condensed plan entry
        const condensedPlan: import('@/types/memory').CondensedPlan = {
            id: planId,
            name: pendingRoadmap.name,
            topic: pendingRoadmap.topic,
            startDate: startDate,
            endDate: endDate,
            studyDays: pendingRoadmap.studyDays,
            dailyHours: pendingRoadmap.dailyHours,
            currentWeek: 1,
            totalWeeks: totalWeeks,
            status: 'active',
            weeklyThemes: weeklyThemes,
            archivePath: ''
        };

        // Save full content to Plans/ archive folder
        const archiveFilename = `${sanitizeFilename(pendingRoadmap.name)}-${startDate}.md`;
        try {
            const archivePath = await memoryService.saveToPlanArchive(archiveFilename, fullContent);
            condensedPlan.archivePath = archivePath;
            console.log(`📁 [Secretary] Full roadmap archived: ${archiveFilename}`);
        } catch (archiveError) {
            console.warn('Failed to save to archive, continuing:', archiveError);
        }

        // Load existing Plan.md
        let planMemory = await memoryService.loadPlanMemory();
        if (!planMemory) {
            planMemory = { activePlans: [], archivedPlans: [], thisWeek: null };
        }

        // Add the new plan
        planMemory.activePlans.push(condensedPlan);

        // Generate This Week section (uses today's date)
        planMemory.thisWeek = generateThisWeekPlan(planMemory.activePlans);

        console.log(`📋 [Secretary] Saving condensed plan: "${condensedPlan.name}" (${totalWeeks} weeks)`);

        // Save updated Plan.md
        await memoryService.savePlanMemory(planMemory);

        // Clear pending roadmap
        const savedName = pendingRoadmap.name;
        pendingRoadmap = null;

        return {
            success: true,
            data: { planId, startDate, name: savedName },
            message: `✅ Saved "${savedName}"! Plan starts ${startDate}. Full roadmap archived.`
        };
    } catch (error) {
        console.error('❌ [Secretary] Error saving roadmap:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to save roadmap'
        };
    }
}

/**
 * Delete an existing plan from Plan.md
 * AI uses this when user wants to modify/replace an existing plan
 */
export async function executeDeletePlan(args: {
    plan_id?: string;      // Short ID like "SS", "AP"
    plan_name?: string;    // Full or partial plan name
}): Promise<ToolCallResult> {
    try {
        if (!args.plan_id && !args.plan_name) {
            return {
                success: false,
                error: 'Please provide either plan_id or plan_name to delete.'
            };
        }

        // Load current plans
        const planMemory = await memoryService.loadPlanMemory();
        if (!planMemory || planMemory.activePlans.length === 0) {
            return {
                success: false,
                error: 'No active plans found to delete.'
            };
        }

        // Find the plan to delete
        const planIndex = planMemory.activePlans.findIndex(p => {
            if (args.plan_id && p.id === args.plan_id) return true;
            if (args.plan_name && p.name.toLowerCase().includes(args.plan_name.toLowerCase())) return true;
            return false;
        });

        if (planIndex === -1) {
            return {
                success: false,
                error: `Could not find plan with ID "${args.plan_id}" or name "${args.plan_name}".`
            };
        }

        const deletedPlan = planMemory.activePlans[planIndex];
        console.log(`🗑️ [Secretary] Deleting plan: ${deletedPlan.id} - ${deletedPlan.name}`);

        // Remove the plan
        planMemory.activePlans.splice(planIndex, 1);

        // Regenerate This Week section without the deleted plan
        planMemory.thisWeek = generateThisWeekPlan(planMemory.activePlans);

        // Save updated Plan.md
        await memoryService.savePlanMemory(planMemory);

        return {
            success: true,
            data: { deletedPlanId: deletedPlan.id, deletedPlanName: deletedPlan.name },
            message: `✅ Deleted plan "${deletedPlan.name}" (${deletedPlan.id})`
        };
    } catch (error) {
        console.error('❌ [Secretary] Error deleting plan:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete plan'
        };
    }
}

/**
 * Update specific fields of an existing plan without recreating it
 * AI uses this for surgical edits like changing dates, study days, etc.
 */
export async function executeUpdatePlan(args: {
    plan_id?: string;           // Short ID like "SS", "AP"
    plan_name?: string;         // Full or partial plan name
    start_date?: string;        // New start date (YYYY-MM-DD)
    end_date?: string;          // New end date (YYYY-MM-DD)
    study_days?: string[];      // New study days like ["Mon", "Wed", "Sat"]
    daily_hours?: number;       // New hours per day
    current_week?: number;      // Update current week progress
}): Promise<ToolCallResult> {
    try {
        if (!args.plan_id && !args.plan_name) {
            return {
                success: false,
                error: 'Please provide either plan_id or plan_name to update.'
            };
        }

        // Load current plans
        const planMemory = await memoryService.loadPlanMemory();
        if (!planMemory || planMemory.activePlans.length === 0) {
            return {
                success: false,
                error: 'No active plans found to update.'
            };
        }

        // Find the plan to update
        const planIndex = planMemory.activePlans.findIndex(p => {
            if (args.plan_id && p.id === args.plan_id) return true;
            if (args.plan_name && p.name.toLowerCase().includes(args.plan_name.toLowerCase())) return true;
            return false;
        });

        if (planIndex === -1) {
            return {
                success: false,
                error: `Could not find plan with ID "${args.plan_id}" or name "${args.plan_name}".`
            };
        }

        const plan = planMemory.activePlans[planIndex];
        const changes: string[] = [];

        // Apply updates
        if (args.start_date) {
            plan.startDate = args.start_date;
            changes.push(`start date → ${args.start_date}`);
        }
        if (args.end_date) {
            plan.endDate = args.end_date;
            changes.push(`end date → ${args.end_date}`);
        }
        if (args.study_days) {
            plan.studyDays = args.study_days;
            changes.push(`study days → ${args.study_days.join(', ')}`);
        }
        if (args.daily_hours !== undefined) {
            plan.dailyHours = args.daily_hours;
            changes.push(`daily hours → ${args.daily_hours}h`);
        }
        if (args.current_week !== undefined) {
            plan.currentWeek = args.current_week;
            changes.push(`current week → W${args.current_week}`);
        }

        if (changes.length === 0) {
            return {
                success: false,
                error: 'No updates provided. Specify at least one field to change.'
            };
        }

        console.log(`✏️ [Secretary] Updating plan ${plan.id}: ${changes.join(', ')}`);

        // Regenerate This Week section with updated plan
        planMemory.thisWeek = generateThisWeekPlan(planMemory.activePlans);

        // Save updated Plan.md
        await memoryService.savePlanMemory(planMemory);

        return {
            success: true,
            data: { planId: plan.id, planName: plan.name, changes },
            message: `✅ Updated "${plan.name}" (${plan.id}): ${changes.join(', ')}`
        };
    } catch (error) {
        console.error('❌ [Secretary] Error updating plan:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update plan'
        };
    }
}

/**
 * List all current plans so AI can query the state
 * Returns summary of active plans for AI decision-making
 */
export async function executeListPlans(): Promise<ToolCallResult> {
    try {
        const planMemory = await memoryService.loadPlanMemory();

        if (!planMemory || planMemory.activePlans.length === 0) {
            return {
                success: true,
                data: { plans: [], count: 0 },
                message: 'No active plans found.'
            };
        }

        const plans = planMemory.activePlans.map(p => ({
            id: p.id,
            name: p.name,
            startDate: p.startDate,
            endDate: p.endDate,
            studyDays: p.studyDays,
            currentWeek: p.currentWeek,
            totalWeeks: p.totalWeeks,
            dailyHours: p.dailyHours,
            status: p.status
        }));

        const planList = plans.map(p =>
            `• ${p.id}: "${p.name}" (${p.startDate} to ${p.endDate}, ${p.studyDays.join('/')}, W${p.currentWeek}/${p.totalWeeks})`
        ).join('\n');

        return {
            success: true,
            data: { plans, count: plans.length },
            message: `Found ${plans.length} active plan(s):\n${planList}`
        };
    } catch (error) {
        console.error('❌ [Secretary] Error listing plans:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list plans'
        };
    }
}

/**
 * Build markdown content from pending roadmap data
 */
function buildRoadmapMarkdown(roadmap: RoadmapData): string {
    let content = `# ${roadmap.name}\n\n`;
    content += `**Topic:** ${roadmap.topic}\n`;
    content += `**Duration:** ${roadmap.totalDays} days\n`;
    content += `**Study Days:** ${roadmap.studyDays.join(', ')}\n`;
    content += `**Hours/Day:** ${roadmap.dailyHours}h\n\n`;
    content += `---\n\n`;

    // Add daily topics if available
    if (roadmap.dailyTopics && roadmap.dailyTopics.length > 0) {
        content += `## Daily Schedule\n\n`;
        for (const day of roadmap.dailyTopics) {
            content += `### Day ${day.day}: ${day.topic}\n`;
            // Access tasks with type assertion since it may exist in some formats
            if ((day as any).tasks) {
                content += `${(day as any).tasks}\n`;
            }
            content += '\n';
        }
    }

    return content;
}

/**
 * Unified daily plan structure
 */
interface UnifiedDailyPlan {
    date: string;
    dayOfWeek: string;
    blocks: {
        planId: string;
        planName: string;
        topic: string;
        hours: number;
        tasks: string[];
    }[];
    totalHours: number;
    isEmpty: boolean;
}

/**
 * Generate unified daily plan from condensed Plan.md
 * Combines tasks from all active plans for the specified day
 */
async function generateUnifiedDailyPlan(date?: string): Promise<UnifiedDailyPlan> {
    const targetDate = date ? new Date(date) : new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = dayNames[targetDate.getDay()];
    const dateStr = targetDate.toISOString().split('T')[0];

    // Load condensed Plan.md
    const planMemory = await memoryService.loadPlanMemory();

    if (!planMemory || !planMemory.thisWeek || planMemory.thisWeek.dailyTasks.length === 0) {
        return {
            date: dateStr,
            dayOfWeek,
            blocks: [],
            totalHours: 0,
            isEmpty: true,
        };
    }

    // Filter tasks for today's day of week
    const todaysTasks = planMemory.thisWeek.dailyTasks.filter(
        task => task.day === dayOfWeek
    );

    if (todaysTasks.length === 0) {
        return {
            date: dateStr,
            dayOfWeek,
            blocks: [],
            totalHours: 0,
            isEmpty: true,
        };
    }

    // Build blocks from tasks, looking up plan details
    const blocks: UnifiedDailyPlan['blocks'] = [];
    let totalHours = 0;

    for (const task of todaysTasks) {
        // Find the plan details
        const plan = planMemory.activePlans.find(p => p.id === task.planId);
        if (!plan) continue;

        const hours = plan.dailyHours || 2;
        totalHours += hours;

        blocks.push({
            planId: plan.id,
            planName: plan.name,
            topic: task.topic,
            hours: hours,
            tasks: task.subtasks || [`Study: ${task.topic}`],
        });
    }

    return {
        date: dateStr,
        dayOfWeek,
        blocks,
        totalHours,
        isEmpty: blocks.length === 0,
    };
}

export async function executeGenerateDailyPlan(args: { date?: string }): Promise<ToolCallResult> {
    try {
        // Generate unified plan from condensed Plan.md
        const plan = await generateUnifiedDailyPlan(args.date);

        if (plan.isEmpty) {
            // Check if it's a rest day or no plans
            const planMemory = await memoryService.loadPlanMemory();
            if (!planMemory || planMemory.activePlans.length === 0) {
                return {
                    success: true,
                    data: plan,
                    message: `📅 **${plan.dayOfWeek}, ${plan.date}**\n\nNo active learning plans found. Create a roadmap first!`
                };
            }

            return {
                success: true,
                data: plan,
                message: `📅 **${plan.dayOfWeek}, ${plan.date}**\n\n🎉 **Rest day!** No study sessions scheduled for ${plan.dayOfWeek}.`
            };
        }

        // Format the response
        let message = `📅 **${plan.dayOfWeek}, ${plan.date}**\n\n`;
        message += `**Total Study Time:** ${plan.totalHours} hours\n\n---\n\n`;

        for (const block of plan.blocks) {
            message += `## ${block.planName} (${block.hours}h)\n`;
            message += `**Topic:** ${block.topic}\n\n`;
            for (const task of block.tasks) {
                message += `- ${task}\n`;
            }
            message += '\n';
        }

        return {
            success: true,
            data: plan,
            message: message
        };
    } catch (error) {
        console.error('❌ [Secretary] Error generating daily plan:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate daily plan'
        };
    }
}

export async function executeMarkDayOff(args: { date: string; reason?: string }): Promise<ToolCallResult> {
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

export async function executeAddCalendarEvent(args: {
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

export async function executeUpdatePreferences(args: {
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
// GENERIC MEMORY FILE EXECUTORS
// AI uses these like a text editor to read/modify any memory file
// ============================================================================

/**
 * Read any file from the Memory folder
 */
export async function executeReadMemoryFile(args: {
    path: string;
}): Promise<ToolCallResult> {
    try {
        const { invoke } = await import('@tauri-apps/api/core');

        // Get memory directory
        const memoryDir = await memoryService.getMemoryDirectory();
        const fullPath = `${memoryDir}/${args.path}`;

        // Read file content
        const content = await invoke<string>('read_memory_file', { path: fullPath });

        return {
            success: true,
            data: { content, path: args.path },
            message: `Read "${args.path}" (${content.length} chars)`
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : `Failed to read: ${args.path}`
        };
    }
}

/**
 * Write content to any file in the Memory folder
 */
export async function executeWriteMemoryFile(args: {
    path: string;
    content: string;
}): Promise<ToolCallResult> {
    try {
        const { invoke } = await import('@tauri-apps/api/core');

        // Get memory directory
        const memoryDir = await memoryService.getMemoryDirectory();
        const fullPath = `${memoryDir}/${args.path}`;

        // Write file content
        await invoke('write_memory_file', { path: fullPath, content: args.content });

        console.log(`📝 [Secretary] Wrote to: ${args.path} (${args.content.length} chars)`);

        // ============================================
        // REFRESH UI AFTER WRITING PLAN/DAILY FILES
        // ============================================
        const fileName = args.path.toLowerCase();

        if (fileName === 'plan.md' || fileName.endsWith('/plan.md')) {
            // Reload Plan.md and trigger UI refresh
            console.log('🔄 [Secretary] Refreshing plan memory after Plan.md write');
            await memoryService.loadPlanMemory();
        }

        // Today.md - sync to todayPlan
        if (fileName === 'today.md' || fileName.endsWith('/today.md')) {
            console.log('🔄 [Secretary] Refreshing Today.md and syncing to dashboard');
            await memoryService.syncDailyToDashboard();
        }

        // Tomorrow.md - sync to tomorrowPlan
        if (fileName === 'tomorrow.md' || fileName.endsWith('/tomorrow.md')) {
            console.log('🔄 [Secretary] Refreshing Tomorrow.md and syncing to dashboard');
            await memoryService.syncDailyToDashboard();
        }

        // Legacy Daily.md - still sync for backwards compatibility
        if (fileName === 'daily.md' || fileName.endsWith('/daily.md')) {
            console.log('🔄 [Secretary] Refreshing legacy Daily.md and syncing to dashboard');
            await memoryService.syncDailyToDashboard();
        }

        return {
            success: true,
            data: { path: args.path, length: args.content.length },
            message: `✅ Wrote to "${args.path}"`
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : `Failed to write: ${args.path}`
        };
    }
}

/**
 * List files in the Memory folder or a subdirectory
 */
export async function executeListMemoryFiles(args: {
    directory?: string;
}): Promise<ToolCallResult> {
    try {
        const { invoke } = await import('@tauri-apps/api/core');

        // Get memory directory
        const memoryDir = await memoryService.getMemoryDirectory();
        const targetDir = args.directory ? `${memoryDir}/${args.directory}` : memoryDir;

        // List files
        const files = await invoke<string[]>('list_memory_files', { directory: targetDir });

        if (files.length === 0) {
            return {
                success: true,
                data: { files: [], directory: args.directory || '.' },
                message: `No files found in ${args.directory || 'Memory folder'}`
            };
        }

        const fileList = files.map(f => `- ${f}`).join('\n');

        return {
            success: true,
            data: { files, count: files.length, directory: args.directory || '.' },
            message: `Found ${files.length} file(s):\n${fileList}`
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : `Failed to list: ${args.directory || '.'}`
        };
    }
}

/**
 * Delete a file from the Memory folder
 */
export async function executeDeleteMemoryFile(args: {
    path: string;
}): Promise<ToolCallResult> {
    try {
        const { invoke } = await import('@tauri-apps/api/core');

        // Get memory directory
        const memoryDir = await memoryService.getMemoryDirectory();
        const fullPath = `${memoryDir}/${args.path}`;

        // Delete file
        await invoke('delete_memory_file', { path: fullPath });

        console.log(`🗑️ [Secretary] Deleted: ${args.path}`);

        return {
            success: true,
            data: { path: args.path },
            message: `✅ Deleted "${args.path}"`
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : `Failed to delete: ${args.path}`
        };
    }
}

/**
 * Rename/move a file in the Memory folder
 */
export async function executeRenameMemoryFile(args: {
    old_path: string;
    new_path: string;
}): Promise<ToolCallResult> {
    try {
        const { invoke } = await import('@tauri-apps/api/core');

        // Get memory directory
        const memoryDir = await memoryService.getMemoryDirectory();
        const oldFullPath = `${memoryDir}/${args.old_path}`;
        const newFullPath = `${memoryDir}/${args.new_path}`;

        // Rename file
        await invoke('rename_memory_file', { oldPath: oldFullPath, newPath: newFullPath });

        console.log(`✏️ [Secretary] Renamed: ${args.old_path} → ${args.new_path}`);

        return {
            success: true,
            data: { old_path: args.old_path, new_path: args.new_path },
            message: `✅ Renamed "${args.old_path}" to "${args.new_path}"`
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : `Failed to rename: ${args.old_path}`
        };
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
        /\b\d+\s*(month|week|hour|day)\b/i,

        // Plan modification patterns (change/update/switch + weekday)
        /\b(change|update|switch|move)\b.*\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
        /\b(change|modify|update|adjust|edit)\b.*\b(my|the|this)?\s*(plan|roadmap|schedule)/i,
        /\b(delete|remove|cancel)\b.*\b(my|the|this)?\s*(plan|roadmap)/i,
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

// ============================================================================
// CONDENSED PLAN HELPERS
// ============================================================================

/**
 * Extract weekly themes from full roadmap content
 */
function extractWeeklyThemes(content: string, totalWeeks: number): import('@/types/memory').WeeklyTheme[] {
    const themes: import('@/types/memory').WeeklyTheme[] = [];

    // Try to find week headers like "## Week 1: Topic" or "### Week 1 - Topic"
    const weekMatches = content.matchAll(/##\s*Week\s*(\d+)[:\s-]*([^\n]+)/gi);

    for (const match of weekMatches) {
        const weekNum = parseInt(match[1]);
        const theme = match[2].trim();
        themes.push({
            week: weekNum,
            theme: theme,
            status: weekNum === 1 ? 'current' : 'upcoming',
        });
    }

    // If no weeks found, generate placeholder themes
    if (themes.length === 0) {
        for (let i = 1; i <= totalWeeks; i++) {
            themes.push({
                week: i,
                theme: `Week ${i}`,
                status: i === 1 ? 'current' : 'upcoming',
            });
        }
    }

    return themes;
}

/**
 * Generate This Week section from active plans
 * For each day of the week, check if each plan is active on that specific day
 * Supports both legacy studyDays and new flexible schedule.dates
 */
function generateThisWeekPlan(
    activePlans: import('@/types/memory').CondensedPlan[]
): import('@/types/memory').ThisWeekPlan {
    const dailyTasks: import('@/types/memory').DailyTaskEntry[] = [];

    // Calculate the current week based on TODAY
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(today);
    weekStart.setDate(diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // For each day of the week (Mon to Sun)
    for (let i = 0; i < 7; i++) {
        const currentDayDate = new Date(weekStart);
        currentDayDate.setDate(weekStart.getDate() + i);
        currentDayDate.setHours(0, 0, 0, 0);
        const currentDayStr = currentDayDate.toISOString().split('T')[0];
        const dayName = dayNames[i];

        // For each active plan, check if it should appear on this specific day
        for (const plan of activePlans) {
            if (plan.status !== 'active') continue;

            // Parse plan start date as LOCAL time (not UTC)
            const [year, month, day] = plan.startDate.split('-').map(Number);
            const planStartDate = new Date(year, month - 1, day);

            // Skip if plan hasn't started by this day
            if (currentDayDate < planStartDate) {
                continue;
            }

            // Check if this day is a study day - use flexible schedule if available
            let isStudyDay = false;

            if (plan.schedule?.dates && plan.schedule.dates.length > 0) {
                // NEW: Use AI-computed schedule dates
                isStudyDay = plan.schedule.dates.includes(currentDayStr);
            } else {
                // LEGACY: Fall back to studyDays array
                isStudyDay = plan.studyDays.includes(dayName);
            }

            if (!isStudyDay) {
                continue;
            }

            // This plan is active on this day - add the task
            const currentTheme = plan.weeklyThemes.find(t => t.status === 'current')?.theme ||
                plan.weeklyThemes[plan.currentWeek - 1]?.theme ||
                `Week ${plan.currentWeek}`;

            // Calculate day number and total sessions
            // PRIORITY 1: Use schedule.dates (AI-computed actual lesson dates)
            // PRIORITY 2: Fall back to counting study days from date range
            let totalSessions = 0;
            let dayNumber = 0;

            if (plan.schedule?.dates && plan.schedule.dates.length > 0) {
                // Use schedule.dates - this contains the actual lesson dates
                totalSessions = plan.schedule.dates.length;
                const dateIndex = plan.schedule.dates.indexOf(currentDayStr);
                if (dateIndex >= 0) {
                    dayNumber = dateIndex + 1;
                }
            } else {
                // Fallback: count study days in date range (legacy plans)
                const start = new Date(plan.startDate + 'T00:00:00');
                const end = new Date(plan.endDate + 'T23:59:59');
                const studyDaysArray = (plan.studyDays && plan.studyDays.length > 0)
                    ? plan.studyDays
                    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

                const tempDate = new Date(start);
                while (tempDate <= end) {
                    const tempDayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][tempDate.getDay()];
                    if (studyDaysArray.includes(tempDayName)) {
                        totalSessions++;
                        if (tempDate <= currentDayDate) {
                            dayNumber = totalSessions;
                        }
                    }
                    tempDate.setDate(tempDate.getDate() + 1);
                }
            }

            dailyTasks.push({
                day: dayName,
                planId: plan.id,
                topic: currentTheme,
                dayNumber: dayNumber,
                totalSessions: totalSessions,
            });
        }


    }

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekRange = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
    const weekStartStr = weekStart.toISOString().split('T')[0];

    return {
        weekStart: weekStartStr,
        weekRange: weekRange,
        dailyTasks: dailyTasks,
    };
}
