/**
 * Daily Plan Service - Roadmap-driven Daily Planning
 * 
 * Processes long-term learning roadmaps into structured Project.md,
 * then generates daily plans from the master roadmap.
 */

import { tauriAI } from './tauriAI';
import { memoryService } from './memoryService';
import type { DailyPlan, ScheduledTask, DailyReflection } from '@/types/dashboard';
import type { ProjectMemory, DailyMemory, DailyTask } from '@/types/memory';

// ============================================================================
// TYPES
// ============================================================================

export interface RoadmapDay {
    day: number;
    topic: string;
    type: 'learn' | 'practice' | 'project' | 'review';
    duration: string;
    resources?: string;
}

export interface ProcessedRoadmap {
    name: string;
    totalDays: number;
    phases: {
        name: string;
        weeks: string;
        topics: string[];
        days: RoadmapDay[];
    }[];
    dailySchedule: RoadmapDay[];
}

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

const ROADMAP_PROCESSING_PROMPT = `You are an expert learning coach. Analyze this learning roadmap/curriculum and break it down into a structured daily schedule.

USER'S ROADMAP:
{ROADMAP_CONTENT}

USER PREFERENCES:
- Daily study time: {DAILY_HOURS} hours
- Best focus time: {FOCUS_TIME}
- Learning style: {LEARNING_STYLE}

Break this down into:
1. Phases (major sections of the curriculum)
2. For each phase, break into weeks
3. For each week, break into daily topics

Return ONLY a JSON object:
{
  "name": "Course/Roadmap name",
  "totalDays": number,
  "phases": [
    {
      "name": "Phase name",
      "weeks": "1-4",
      "topics": ["Topic 1", "Topic 2"],
      "days": [
        { "day": 1, "topic": "Specific topic", "type": "learn|practice|project|review", "duration": "2h", "resources": "Chapter 1" }
      ]
    }
  ],
  "dailySchedule": [
    { "day": 1, "topic": "...", "type": "...", "duration": "...", "resources": "..." }
  ]
}

Ensure dailySchedule has an entry for EVERY day from 1 to totalDays.`;

const DAILY_PLAN_PROMPT = `You are an AI learning secretary. Generate today's detailed study schedule.

TODAY'S CONTEXT:
- Date: {DATE}
- Day {CURRENT_DAY} of {TOTAL_DAYS}
- Phase: {CURRENT_PHASE}
- Today's Topic: {TODAY_TOPIC}
- Topic Type: {TOPIC_TYPE}
- Allocated Duration: {TOPIC_DURATION}

USER PREFERENCES:
- Best focus time: {FOCUS_TIME}
- Break frequency: {BREAK_FREQUENCY}
- Learning style: {LEARNING_STYLE}
- Available hours: {AVAILABLE_HOURS}

{REFLECTION_CONTEXT}

Generate a detailed schedule breaking down today's topic into concrete tasks.
Include breaks and vary task types (learn, practice, review).

Return ONLY a JSON object:
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Task title",
      "description": "Brief description",
      "type": "learn|practice|review|project|break",
      "scheduledTime": "09:00",
      "durationMinutes": 45,
      "aiReason": "Why this task at this time"
    }
  ],
  "aiNotes": "Encouraging note for the user",
  "tomorrowPreview": ["Tomorrow topic 1", "Tomorrow topic 2"]
}`;

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Process a raw roadmap/curriculum into structured Project.md format
 */
export async function processRoadmap(
    rawRoadmap: string,
    projectId: string
): Promise<ProjectMemory> {
    // Get user preferences
    const aiMemory = await memoryService.loadAIMemory();
    const preferences = aiMemory?.preferences || {};

    const prompt = ROADMAP_PROCESSING_PROMPT
        .replace('{ROADMAP_CONTENT}', rawRoadmap.substring(0, 15000))
        .replace('{DAILY_HOURS}', String(preferences.weekdayHours || 2))
        .replace('{FOCUS_TIME}', preferences.bestFocusTime || '9am-12pm')
        .replace('{LEARNING_STYLE}', preferences.learningStyle || 'balanced');

    try {
        const response = await tauriAI.chat([{ role: 'user', content: prompt }]);

        // Parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse roadmap structure from AI response');
        }

        const processed: ProcessedRoadmap = JSON.parse(jsonMatch[0]);

        // Convert to ProjectMemory format
        const today = new Date().toISOString().split('T')[0];
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + processed.totalDays);

        const projectMemory: ProjectMemory = {
            name: processed.name,
            goal: {
                description: `Complete ${processed.name}`,
                deadline: endDate.toISOString().split('T')[0],
            },
            timeline: {
                startDate: today,
                endDate: endDate.toISOString().split('T')[0],
                currentDay: 1,
                totalDays: processed.totalDays,
            },
            currentPhase: processed.phases[0]?.name || 'Getting Started',
            phases: processed.phases.map((phase, idx) => ({
                id: `phase-${idx + 1}`,
                name: phase.name,
                weeks: phase.weeks,
                status: idx === 0 ? 'in_progress' as const : 'pending' as const,
                topics: phase.topics,
            })),
            // Store the daily schedule in a custom field (extend type if needed)
            weeklyPlan: {
                dailySchedule: JSON.stringify(processed.dailySchedule),
            },
        };

        // Save to memory
        await memoryService.saveProjectMemory(projectId, projectMemory);

        console.log(`✅ [DailyPlanService] Processed roadmap: ${processed.totalDays} days, ${processed.phases.length} phases`);

        return projectMemory;
    } catch (error) {
        console.error('❌ [DailyPlanService] Failed to process roadmap:', error);
        throw error;
    }
}

/**
 * Get the current day's topic from the roadmap
 */
export async function getCurrentDayTopic(projectId: string): Promise<{
    day: number;
    topic: string;
    type: string;
    duration: string;
    phase: string;
    totalDays: number;
} | null> {
    const projectMemory = await memoryService.loadProjectMemory(projectId);
    if (!projectMemory) return null;

    const currentDay = projectMemory.timeline.currentDay;
    const totalDays = projectMemory.timeline.totalDays;

    // Get daily schedule from stored JSON
    const dailyScheduleStr = projectMemory.weeklyPlan?.dailySchedule;
    if (!dailyScheduleStr) return null;

    try {
        const dailySchedule: RoadmapDay[] = JSON.parse(dailyScheduleStr as string);
        const todayTopic = dailySchedule.find(d => d.day === currentDay);

        if (!todayTopic) return null;

        return {
            day: currentDay,
            topic: todayTopic.topic,
            type: todayTopic.type,
            duration: todayTopic.duration,
            phase: projectMemory.currentPhase || '',
            totalDays,
        };
    } catch {
        return null;
    }
}

/**
 * Generate a daily plan from the roadmap context
 */
export async function generateDailyPlan(
    projectId: string,
    date?: string
): Promise<DailyPlan> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const aiMemory = await memoryService.loadAIMemory();
    // Note: projectMemory loaded for future use when we need phase info
    await memoryService.loadProjectMemory(projectId);
    const dailyMemory = await memoryService.loadDailyMemory(projectId);

    const preferences = aiMemory?.preferences || {};

    // Get today's topic from roadmap
    const todayContext = await getCurrentDayTopic(projectId);

    if (!todayContext) {
        throw new Error('No roadmap found. Please import a learning roadmap first.');
    }

    // Build reflection context if previous day exists
    let reflectionContext = '';
    if (dailyMemory?.reflection) {
        reflectionContext = `
YESTERDAY'S REFLECTION:
- Mood: ${dailyMemory.reflection.mood}
- Struggles: ${dailyMemory.reflection.struggles || 'None mentioned'}
- Wins: ${dailyMemory.reflection.wins || 'None mentioned'}
- Notes: ${dailyMemory.reflection.notes || ''}

Adjust today's pace and difficulty based on this feedback.`;
    }

    const prompt = DAILY_PLAN_PROMPT
        .replace('{DATE}', targetDate)
        .replace('{CURRENT_DAY}', String(todayContext.day))
        .replace('{TOTAL_DAYS}', String(todayContext.totalDays))
        .replace('{CURRENT_PHASE}', todayContext.phase)
        .replace('{TODAY_TOPIC}', todayContext.topic)
        .replace('{TOPIC_TYPE}', todayContext.type)
        .replace('{TOPIC_DURATION}', todayContext.duration)
        .replace('{FOCUS_TIME}', preferences.bestFocusTime || '9am-12pm')
        .replace('{BREAK_FREQUENCY}', preferences.breakFrequency || 'Every 45 minutes')
        .replace('{LEARNING_STYLE}', preferences.learningStyle || 'balanced')
        .replace('{AVAILABLE_HOURS}', String(preferences.weekdayHours || 2))
        .replace('{REFLECTION_CONTEXT}', reflectionContext);

    try {
        const response = await tauriAI.chat([{ role: 'user', content: prompt }]);

        // Parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse daily plan from AI response');
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Convert to DailyPlan format
        const tasks: ScheduledTask[] = parsed.tasks.map((task: any, idx: number) => ({
            id: task.id || `task-${Date.now()}-${idx}`,
            title: task.title,
            description: task.description,
            type: task.type || 'learn',
            status: 'pending' as const,
            scheduledTime: task.scheduledTime,
            durationMinutes: task.durationMinutes || 30,
            projectId,
            aiGenerated: true,
            aiReason: task.aiReason,
        }));

        const totalMinutes = tasks.reduce((sum, t) => sum + t.durationMinutes, 0);

        const dailyPlan: DailyPlan = {
            id: `plan-${targetDate}`,
            date: targetDate,
            tasks,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isApproved: false,
            userModified: false,
            totalMinutes,
            completedMinutes: 0,
            aiGeneratedAt: new Date().toISOString(),
        };

        // Also save to Daily.md
        const dailyMemoryData: DailyMemory = {
            date: targetDate,
            context: {
                week: Math.ceil(todayContext.day / 7),
                phase: todayContext.phase,
                focus: todayContext.topic,
            },
            tasks: tasks.map(t => ({
                id: t.id,
                time: t.scheduledTime,
                task: t.title,
                type: t.type as DailyTask['type'],
                duration: `${t.durationMinutes}min`,
                status: t.status,
                reason: t.aiReason,
            })),
            totalStudyTime: `${totalMinutes}min`,
            aiNotes: parsed.aiNotes,
            tomorrowPreview: parsed.tomorrowPreview,
        };

        await memoryService.saveDailyMemory(dailyMemoryData, projectId);

        console.log(`✅ [DailyPlanService] Generated daily plan: ${tasks.length} tasks, ${totalMinutes} minutes`);

        return dailyPlan;
    } catch (error) {
        console.error('❌ [DailyPlanService] Failed to generate daily plan:', error);
        throw error;
    }
}

/**
 * Complete the day and advance roadmap progress
 */
export async function completeDay(
    projectId: string,
    reflection?: DailyReflection
): Promise<void> {
    const projectMemory = await memoryService.loadProjectMemory(projectId);
    if (!projectMemory) return;

    // Advance the day counter
    const newDay = projectMemory.timeline.currentDay + 1;

    // Check if we're entering a new phase (simplified for now)\n    // TODO: In production, implement phase-to-day mapping and update currentPhase

    // Update project memory
    const updatedProject: ProjectMemory = {
        ...projectMemory,
        timeline: {
            ...projectMemory.timeline,
            currentDay: newDay,
        },
    };

    await memoryService.saveProjectMemory(projectId, updatedProject);

    // Store reflection in daily memory
    if (reflection) {
        const dailyMemory = await memoryService.loadDailyMemory(projectId);
        if (dailyMemory) {
            dailyMemory.reflection = {
                mood: reflection.mood === 'great' ? 'great' :
                    reflection.mood === 'good' ? 'good' :
                        reflection.mood === 'okay' ? 'okay' :
                            reflection.mood === 'struggling' ? 'tired' : 'frustrated',
                struggles: reflection.whatWasHard,
                wins: reflection.whatWentWell,
                notes: reflection.content,
            };
            await memoryService.saveDailyMemory(dailyMemory, projectId);
        }
    }

    console.log(`✅ [DailyPlanService] Advanced to day ${newDay}`);
}

/**
 * Regenerate daily plan with user feedback
 */
export async function regenerateDailyPlan(
    projectId: string,
    feedback: string
): Promise<DailyPlan> {
    // For now, just regenerate with feedback as context
    const date = new Date().toISOString().split('T')[0];

    // Add feedback to the prompt by storing it temporarily
    // In production, would modify the prompt to include feedback
    console.log(`🔄 [DailyPlanService] Regenerating with feedback: ${feedback}`);

    return generateDailyPlan(projectId, date);
}

/**
 * Check if a roadmap exists for a project
 */
export async function hasRoadmap(projectId: string): Promise<boolean> {
    const projectMemory = await memoryService.loadProjectMemory(projectId);
    return projectMemory?.weeklyPlan?.dailySchedule !== undefined;
}
