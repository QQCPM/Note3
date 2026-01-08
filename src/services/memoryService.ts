// Memory Service
// Handles reading/writing memory files and syncing with the dashboard

import { invoke } from '@tauri-apps/api/core';
import type {
  AIMemory,
  ProjectMemory,
  DailyMemory,
  PlanMemory,
  SecretaryMemoryState,
} from '@/types/memory';
import {
  parseAIMemory,
  serializeAIMemory,
  parseProjectMemory,
  serializeProjectMemory,
  parseDailyMemory,
  serializeDailyMemory,
  parsePlanMemory,
  serializePlanMemory,
} from './memoryParser';

// Default file names
const AI_MEMORY_FILE = 'AI.md';
const PROJECT_MEMORY_FILE = 'Project.md';
const DAILY_MEMORY_FILE = 'Daily.md';  // Legacy - kept for backwards compatibility
const TODAY_MEMORY_FILE = 'Today.md';  // Current day's plan
const TOMORROW_MEMORY_FILE = 'Tomorrow.md';  // Next day's plan
const PLAN_MEMORY_FILE = 'Plan.md';
const PLANS_FOLDER = 'Plans';  // Folder for full roadmap archives
const HISTORY_FOLDER = 'History';  // Folder for archived daily plans

// ============================================
// File Operations (via Tauri)
// ============================================

async function readMemoryFile(path: string): Promise<string | null> {
  try {
    return await invoke<string>('read_memory_file', { path });
  } catch (error) {
    console.warn(`Memory file not found: ${path}`);
    return null;
  }
}

async function writeMemoryFile(path: string, content: string): Promise<void> {
  await invoke<void>('write_memory_file', { path, content });
}

async function getMemoryBasePath(): Promise<string> {
  return await invoke<string>('get_memory_base_path');
}

async function getProjectPath(projectId: string): Promise<string | null> {
  try {
    return await invoke<string>('get_project_path', { projectId });
  } catch {
    return null;
  }
}

// ============================================
// Memory Service Class
// ============================================

class MemoryService {
  private state: SecretaryMemoryState = {
    lastUpdated: {},
  };

  // Get current memory state
  getState(): SecretaryMemoryState {
    return this.state;
  }

  // Helper to extract YYYY-MM-DD from various date formats
  // Handles: "📅 Monday, January 5, 2026", "January 5, 2026", "2026-01-05"
  private extractDateFromString(dateStr: string): string {
    // Already in YYYY-MM-DD format?
    const isoMatch = dateStr.match(/\d{4}-\d{2}-\d{2}/);
    if (isoMatch) {
      return isoMatch[0];
    }

    // Try parsing "January 5, 2026" or "Monday, January 5, 2026"
    // Remove emojis and leading day names
    const cleaned = dateStr.replace(/^.*?,\s*/, '').replace(/[^\w\s,]/g, '').trim();

    // Match "Month Day, Year" pattern
    const monthDayYear = cleaned.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (monthDayYear) {
      const [, monthName, day, year] = monthDayYear;
      const months: Record<string, string> = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12',
      };
      const month = months[monthName.toLowerCase()];
      if (month) {
        return `${year}-${month}-${day.padStart(2, '0')}`;
      }
    }

    // Fall back to trying JavaScript's Date parser
    try {
      const parsed = new Date(cleaned);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    } catch {
      // Ignore parse errors
    }

    return ''; // Return empty if can't parse
  }

  // ============================================
  // AI Memory (Global)
  // ============================================

  async loadAIMemory(): Promise<AIMemory | null> {
    try {
      const basePath = await getMemoryBasePath();
      const filePath = `${basePath}/${AI_MEMORY_FILE}`;
      const content = await readMemoryFile(filePath);

      if (!content) {
        return null;
      }

      const memory = parseAIMemory(content);
      this.state.ai = memory;
      this.state.lastUpdated.ai = new Date().toISOString();
      return memory;
    } catch (error) {
      console.error('Failed to load AI memory:', error);
      return null;
    }
  }

  async saveAIMemory(memory: AIMemory): Promise<void> {
    try {
      const basePath = await getMemoryBasePath();
      const filePath = `${basePath}/${AI_MEMORY_FILE}`;
      const content = serializeAIMemory(memory);
      await writeMemoryFile(filePath, content);

      this.state.ai = memory;
      this.state.lastUpdated.ai = new Date().toISOString();
    } catch (error) {
      console.error('Failed to save AI memory:', error);
      throw error;
    }
  }

  async createDefaultAIMemory(): Promise<AIMemory> {
    const defaultMemory: AIMemory = {
      preferences: {
        bestFocusTime: '9am-12pm',
        breakFrequency: 'Every 45 minutes',
        learningStyle: 'Visual + hands-on',
        weekdayHours: 2,
        weekendHours: 4,
      },
      availability: [
        { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], timeRange: '9am-12pm, 2pm-5pm' },
        { days: ['Sat', 'Sun'], timeRange: '10am-2pm' },
      ],
      blockedDates: [],
    };

    await this.saveAIMemory(defaultMemory);
    return defaultMemory;
  }

  // ============================================
  // Plan Memory (Multi-Roadmap Support)
  // ============================================

  async loadPlanMemory(): Promise<PlanMemory | null> {
    try {
      const basePath = await getMemoryBasePath();
      const filePath = `${basePath}/${PLAN_MEMORY_FILE}`;
      const content = await readMemoryFile(filePath);

      if (!content) {
        // Return empty structure if file doesn't exist
        return { activePlans: [], archivedPlans: [], thisWeek: null };
      }

      const result = parsePlanMemory(content);
      console.log('[MemoryService] Loaded Plan.md:', {
        activePlans: result.activePlans.map(p => ({ id: p.id, name: p.name, status: p.status })),
        thisWeekTasks: result.thisWeek?.dailyTasks?.length || 0,
      });
      return result;
    } catch (error) {
      console.error('Failed to load plan memory:', error);
      return { activePlans: [], archivedPlans: [], thisWeek: null };
    }
  }


  async savePlanMemory(memory: PlanMemory): Promise<void> {
    try {
      const basePath = await getMemoryBasePath();
      const filePath = `${basePath}/${PLAN_MEMORY_FILE}`;
      const content = serializePlanMemory(memory);
      await writeMemoryFile(filePath, content);
      console.log('📝 [Memory] Plan.md saved successfully');
    } catch (error) {
      console.error('Failed to save plan memory:', error);
      throw error;
    }
  }

  // ============================================
  // Project Memory (Per-Project)
  // ============================================

  async loadProjectMemory(projectId: string): Promise<ProjectMemory | null> {
    try {
      let filePath: string;

      // Try project path first, fall back to global memory folder
      const projectPath = await getProjectPath(projectId);
      if (projectPath) {
        filePath = `${projectPath}/${PROJECT_MEMORY_FILE}`;
      } else {
        // Use global memory folder
        const basePath = await getMemoryBasePath();
        filePath = `${basePath}/${PROJECT_MEMORY_FILE}`;
      }

      const content = await readMemoryFile(filePath);

      if (!content) {
        return null;
      }

      const memory = parseProjectMemory(content);
      this.state.project = memory;
      this.state.lastUpdated.project = new Date().toISOString();
      return memory;
    } catch (error) {
      console.error('Failed to load project memory:', error);
      return null;
    }
  }

  async saveProjectMemory(projectId: string, memory: ProjectMemory): Promise<void> {
    try {
      let filePath: string;

      // Try project path first, fall back to global memory folder
      const projectPath = await getProjectPath(projectId);
      if (projectPath) {
        filePath = `${projectPath}/${PROJECT_MEMORY_FILE}`;
      } else {
        // Use global memory folder
        const basePath = await getMemoryBasePath();
        filePath = `${basePath}/${PROJECT_MEMORY_FILE}`;
      }

      const content = serializeProjectMemory(memory);
      await writeMemoryFile(filePath, content);

      this.state.project = memory;
      this.state.lastUpdated.project = new Date().toISOString();
    } catch (error) {
      console.error('Failed to save project memory:', error);
      throw error;
    }
  }

  // ============================================
  // Daily Memory
  // ============================================

  async loadDailyMemory(projectId?: string): Promise<DailyMemory | null> {
    try {
      let filePath: string;

      if (projectId) {
        const projectPath = await getProjectPath(projectId);
        if (projectPath) {
          filePath = `${projectPath}/${DAILY_MEMORY_FILE}`;
        } else {
          // Fall back to global folder if project path not found
          const basePath = await getMemoryBasePath();
          filePath = `${basePath}/${DAILY_MEMORY_FILE}`;
        }
      } else {
        const basePath = await getMemoryBasePath();
        filePath = `${basePath}/${DAILY_MEMORY_FILE}`;
      }

      const content = await readMemoryFile(filePath);

      if (!content) {
        return null;
      }

      const memory = parseDailyMemory(content);
      this.state.daily = memory;
      this.state.lastUpdated.daily = new Date().toISOString();
      return memory;
    } catch (error) {
      console.error('Failed to load daily memory:', error);
      return null;
    }
  }

  async saveDailyMemory(memory: DailyMemory, projectId?: string): Promise<void> {
    try {
      let filePath: string;

      if (projectId) {
        const projectPath = await getProjectPath(projectId);
        if (projectPath) {
          filePath = `${projectPath}/${DAILY_MEMORY_FILE}`;
        } else {
          // Fall back to global folder if project path not found
          const basePath = await getMemoryBasePath();
          filePath = `${basePath}/${DAILY_MEMORY_FILE}`;
        }
      } else {
        const basePath = await getMemoryBasePath();
        filePath = `${basePath}/${DAILY_MEMORY_FILE}`;
      }

      const content = serializeDailyMemory(memory);
      await writeMemoryFile(filePath, content);

      this.state.daily = memory;
      this.state.lastUpdated.daily = new Date().toISOString();
    } catch (error) {
      console.error('Failed to save daily memory:', error);
      throw error;
    }
  }

  // ============================================
  // Today.md Operations (Current Day's Plan)
  // ============================================

  async loadTodayMemory(): Promise<DailyMemory | null> {
    try {
      const basePath = await getMemoryBasePath();
      const filePath = `${basePath}/${TODAY_MEMORY_FILE}`;
      const content = await readMemoryFile(filePath);

      if (!content) {
        // Fall back to legacy Daily.md if Today.md doesn't exist
        return this.loadDailyMemory();
      }

      const memory = parseDailyMemory(content);
      this.state.daily = memory;
      this.state.lastUpdated.daily = new Date().toISOString();
      return memory;
    } catch (error) {
      console.error('Failed to load today memory:', error);
      return null;
    }
  }

  async saveTodayMemory(memory: DailyMemory): Promise<void> {
    try {
      const basePath = await getMemoryBasePath();
      const filePath = `${basePath}/${TODAY_MEMORY_FILE}`;
      const content = serializeDailyMemory(memory);
      await writeMemoryFile(filePath, content);

      this.state.daily = memory;
      this.state.lastUpdated.daily = new Date().toISOString();
    } catch (error) {
      console.error('Failed to save today memory:', error);
      throw error;
    }
  }

  // ============================================
  // Tomorrow.md Operations (Next Day's Plan)
  // ============================================

  async loadTomorrowMemory(): Promise<DailyMemory | null> {
    try {
      const basePath = await getMemoryBasePath();
      const filePath = `${basePath}/${TOMORROW_MEMORY_FILE}`;
      const content = await readMemoryFile(filePath);

      if (!content) {
        return null;
      }

      const memory = parseDailyMemory(content);
      this.state.tomorrow = memory;
      return memory;
    } catch (error) {
      console.error('Failed to load tomorrow memory:', error);
      return null;
    }
  }

  async saveTomorrowMemory(memory: DailyMemory): Promise<void> {
    try {
      const basePath = await getMemoryBasePath();
      const filePath = `${basePath}/${TOMORROW_MEMORY_FILE}`;
      const content = serializeDailyMemory(memory);
      await writeMemoryFile(filePath, content);

      this.state.tomorrow = memory;
    } catch (error) {
      console.error('Failed to save tomorrow memory:', error);
      throw error;
    }
  }

  // ============================================
  // Dashboard Sync
  // ============================================

  async syncDailyToDashboard(): Promise<void> {
    const { useDashboardStore } = await import('@/store/dashboardStore');
    const store = useDashboardStore.getState();
    const now = new Date().toISOString();

    // Helper to convert DailyMemory to DailyPlan format
    const toPlanData = (daily: DailyMemory, isApproved: boolean) => {
      const todayDate = new Date();
      const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
      const planDateStr = this.extractDateFromString(daily.date) || todayStr;

      const scheduledTasks = daily.tasks.map((task) => ({
        id: task.id,
        title: task.task,
        description: task.reason || '',
        scheduledTime: task.time,
        durationMinutes: parseInt(task.duration) || 30,
        type: task.type as 'learn' | 'practice' | 'review' | 'project' | 'break',
        status: task.status,
        aiGenerated: true,
        aiReason: task.reason,
      }));

      const totalMinutes = scheduledTasks.reduce((sum, t) => sum + t.durationMinutes, 0);
      const completedMinutes = scheduledTasks
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + t.durationMinutes, 0);

      return {
        id: `plan-${planDateStr}`,
        date: planDateStr,
        tasks: scheduledTasks,
        totalMinutes,
        completedMinutes,
        isApproved,
        userModified: false,
        createdAt: now,
        updatedAt: now,
        aiGeneratedAt: now,
      };
    };

    // ============================================
    // LOAD TODAY'S PLAN from Today.md
    // ============================================
    const todayMemory = await this.loadTodayMemory();
    if (todayMemory) {
      console.log('[MemoryService] Syncing Today.md to todayPlan:', todayMemory.date);
      store.setTodayPlan(toPlanData(todayMemory, true));
    }

    // ============================================
    // LOAD TOMORROW'S PLAN from Tomorrow.md
    // ============================================
    const tomorrowMemory = await this.loadTomorrowMemory();
    if (tomorrowMemory) {
      console.log('[MemoryService] Syncing Tomorrow.md to tomorrowPlan:', tomorrowMemory.date);
      store.setTomorrowPlan(toPlanData(tomorrowMemory, false));
    }

    // Legacy fallback: If Today.md doesn't exist, try Daily.md
    if (!todayMemory) {
      const legacyDaily = await this.loadDailyMemory();
      if (legacyDaily) {
        console.log('[MemoryService] Using legacy Daily.md for today:', legacyDaily.date);
        store.setTodayPlan(toPlanData(legacyDaily, true));
      }
    }

    // Update reflection if present (from today's plan)
    const reflectionSource = todayMemory || this.state.daily;
    if (reflectionSource?.reflection) {
      // Map memory mood to dashboard mood
      const moodMap: Record<string, 'great' | 'good' | 'okay' | 'struggling' | 'overwhelmed'> = {
        'great': 'great',
        'good': 'good',
        'okay': 'okay',
        'tired': 'struggling',
        'frustrated': 'overwhelmed',
      };

      store.setTodayReflection({
        id: `reflection-${reflectionSource.date}`,
        date: reflectionSource.date,
        content: reflectionSource.reflection.notes || '',
        mood: moodMap[reflectionSource.reflection.mood || 'okay'] || 'okay',
        whatWentWell: reflectionSource.reflection.wins,
        whatWasHard: reflectionSource.reflection.struggles,
        aiProcessed: false,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  async syncDashboardToDaily(projectId?: string): Promise<void> {
    const { useDashboardStore } = await import('@/store/dashboardStore');
    const store = useDashboardStore.getState();

    const todayPlan = store.todayPlan;
    const todayReflection = store.todayReflection;

    if (!todayPlan) {
      return;
    }

    // Map dashboard mood to memory mood
    const moodMap: Record<string, 'great' | 'good' | 'okay' | 'tired' | 'frustrated'> = {
      'great': 'great',
      'good': 'good',
      'okay': 'okay',
      'struggling': 'tired',
      'overwhelmed': 'frustrated',
    };

    // Convert dashboard to daily memory
    const daily: DailyMemory = {
      date: todayPlan.date,
      context: this.state.daily?.context || {
        week: 1,
        phase: '',
        focus: '',
      },
      tasks: todayPlan.tasks.map(task => ({
        id: task.id,
        time: task.scheduledTime || '',
        task: task.title,
        type: task.type as any || 'other',
        duration: `${task.durationMinutes}min`,
        status: task.status,
        reason: task.aiReason,
      })),
      totalStudyTime: `${todayPlan.totalMinutes}min`,
      aiNotes: this.state.daily?.aiNotes,
      tomorrowPreview: this.state.daily?.tomorrowPreview,
    };

    // Add reflection if present
    if (todayReflection) {
      daily.reflection = {
        mood: moodMap[todayReflection.mood || 'okay'] || 'okay',
        struggles: todayReflection.whatWasHard,
        wins: todayReflection.whatWentWell,
        notes: todayReflection.content,
      };
    }

    await this.saveDailyMemory(daily, projectId);
  }

  /**
   * Sync tomorrow's plan from dashboard store to Tomorrow.md
   * Called after any edit to tomorrow's plan (add/edit/remove task)
   */
  async syncTomorrowPlanToFile(): Promise<void> {
    const { useDashboardStore } = await import('@/store/dashboardStore');
    const tomorrowPlan = useDashboardStore.getState().tomorrowPlan;

    if (!tomorrowPlan) {
      console.log('[MemoryService] No tomorrow plan to sync');
      return;
    }

    // Convert DailyPlan to DailyMemory format
    const tomorrowMemory: DailyMemory = {
      date: tomorrowPlan.date,
      context: {
        week: 1,
        phase: '',
        focus: this.state.tomorrow?.context?.focus || '',
      },
      tasks: tomorrowPlan.tasks.map(task => ({
        id: task.id,
        time: task.scheduledTime || '',
        task: task.title,
        type: task.type as 'learn' | 'practice' | 'review' | 'project' | 'break' | 'other',
        duration: `${task.durationMinutes}min`,
        status: task.status,
        reason: task.aiReason,
      })),
      totalStudyTime: `${tomorrowPlan.totalMinutes}min`,
      aiNotes: this.state.tomorrow?.aiNotes,
    };

    // Save to Tomorrow.md
    await this.saveTomorrowMemory(tomorrowMemory);
    console.log('[MemoryService] Synced tomorrow plan to Tomorrow.md');
  }

  /**
   * Sync today's plan and reflection from dashboard store to Today.md
   * Called after task updates or reflection submission
   */
  async syncTodayPlanToFile(): Promise<void> {
    const { useDashboardStore } = await import('@/store/dashboardStore');
    const store = useDashboardStore.getState();
    const todayPlan = store.todayPlan;
    const todayReflection = store.todayReflection;

    if (!todayPlan) {
      console.log('[MemoryService] No today plan to sync');
      return;
    }

    // Map dashboard mood to memory mood
    const moodMap: Record<string, 'great' | 'good' | 'okay' | 'tired' | 'frustrated'> = {
      'great': 'great',
      'good': 'good',
      'okay': 'okay',
      'struggling': 'tired',
      'overwhelmed': 'frustrated',
    };

    // Convert DailyPlan to DailyMemory format
    const todayMemory: DailyMemory = {
      date: todayPlan.date,
      context: {
        week: 1,
        phase: '',
        focus: this.state.daily?.context?.focus || '',
      },
      tasks: todayPlan.tasks.map(task => ({
        id: task.id,
        time: task.scheduledTime || '',
        task: task.title,
        type: task.type as 'learn' | 'practice' | 'review' | 'project' | 'break' | 'other',
        duration: `${task.durationMinutes}min`,
        status: task.status,
        reason: task.aiReason,
      })),
      totalStudyTime: `${todayPlan.totalMinutes}min`,
      aiNotes: this.state.daily?.aiNotes,
    };

    // Add reflection if present
    if (todayReflection) {
      todayMemory.reflection = {
        mood: moodMap[todayReflection.mood || 'okay'] || 'okay',
        struggles: todayReflection.whatWasHard,
        wins: todayReflection.whatWentWell,
        notes: todayReflection.content,
        completedCount: todayPlan.tasks.filter(t => t.status === 'completed').length,
        totalCount: todayPlan.tasks.length,
      };
    }

    // Save to Today.md
    await this.saveTodayMemory(todayMemory);
    console.log('[MemoryService] Synced today plan to Today.md');
  }

  // ============================================
  // Auto-generate Sample Files
  // ============================================



  async initializeDefaultFiles(projectId?: string): Promise<void> {
    // Check and create AI.md if it doesn't exist
    const aiMemory = await this.loadAIMemory();
    if (!aiMemory) {
      await this.createDefaultAIMemory();
      console.log('Created default AI.md');
    }

    // Check and create Daily.md if it doesn't exist
    const dailyMemory = await this.loadDailyMemory(projectId);
    if (!dailyMemory) {
      await this.createDefaultDailyMemory(projectId);
      console.log('Created default Daily.md');
    }

    // If project is specified, create Project.md if it doesn't exist
    if (projectId) {
      const projectMemory = await this.loadProjectMemory(projectId);
      if (!projectMemory) {
        await this.createDefaultProjectMemory(projectId);
        console.log('Created default Project.md');
      }
    }
  }

  async createDefaultDailyMemory(projectId?: string): Promise<DailyMemory> {
    // IMPORTANT: Use local date formatting to avoid timezone issues
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const defaultMemory: DailyMemory = {
      date: today,
      context: {
        week: 1,
        phase: 'Getting Started',
        focus: 'Initial Setup',
      },
      tasks: [
        {
          id: 'task-1',
          time: '09:00',
          task: 'Review learning goals',
          type: 'review',
          duration: '30min',
          status: 'pending',
          reason: 'Start with clarity on what you want to achieve',
        },
        {
          id: 'task-2',
          time: '09:30',
          task: 'Core study session',
          type: 'learn',
          duration: '60min',
          status: 'pending',
          reason: 'Morning focus for deep learning',
        },
        {
          id: 'task-3',
          time: '10:30',
          task: 'Break',
          type: 'break',
          duration: '15min',
          status: 'pending',
        },
        {
          id: 'task-4',
          time: '10:45',
          task: 'Practice exercises',
          type: 'practice',
          duration: '45min',
          status: 'pending',
          reason: 'Apply what you learned',
        },
      ],
      totalStudyTime: '135min',
      aiNotes: 'Welcome! This is your first day. Take it easy and focus on building good habits.',
    };

    await this.saveDailyMemory(defaultMemory, projectId);
    return defaultMemory;
  }

  async createDefaultProjectMemory(projectId: string, projectName?: string): Promise<ProjectMemory> {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 30); // 30-day default project

    const defaultMemory: ProjectMemory = {
      name: projectName || 'My Learning Project',
      goal: {
        description: 'Complete this learning project with understanding and practical skills',
        deadline: endDate.toISOString().split('T')[0],
      },
      timeline: {
        startDate: today.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        currentDay: 1,
        totalDays: 30,
      },
      currentPhase: 'Foundations',
      phases: [
        {
          id: 'phase-1',
          name: 'Foundations',
          weeks: '1-2',
          status: 'in_progress',
          topics: ['Core concepts', 'Basic terminology', 'Setup & tools'],
        },
        {
          id: 'phase-2',
          name: 'Core Skills',
          weeks: '2-3',
          status: 'pending',
          topics: ['Main techniques', 'Practice exercises', 'Common patterns'],
        },
        {
          id: 'phase-3',
          name: 'Application',
          weeks: '3-4',
          status: 'pending',
          topics: ['Real projects', 'Problem solving', 'Review & refine'],
        },
      ],
      weeklyPlan: {
        Mon: 'Theory & reading',
        Tue: 'Practice exercises',
        Wed: 'Theory & reading',
        Thu: 'Practice exercises',
        Fri: 'Project work',
        Sat: 'Review & catch up',
        Sun: 'Rest or light review',
      },
      blockers: [],
    };

    await this.saveProjectMemory(projectId, defaultMemory);
    return defaultMemory;
  }

  // ============================================
  // Full Context for AI
  // ============================================

  async getFullContext(projectId?: string): Promise<string> {
    let context = '';

    // Load all memory files
    const aiMemory = await this.loadAIMemory();
    const projectMemory = projectId ? await this.loadProjectMemory(projectId) : null;
    const dailyMemory = await this.loadDailyMemory(projectId);

    if (aiMemory) {
      context += '=== AI MEMORY (Global Preferences) ===\n';
      context += serializeAIMemory(aiMemory);
      context += '\n';
    }

    if (projectMemory) {
      context += '=== PROJECT MEMORY (Current Project) ===\n';
      context += serializeProjectMemory(projectMemory);
      context += '\n';
    }

    if (dailyMemory) {
      context += '=== DAILY MEMORY (Today) ===\n';
      context += serializeDailyMemory(dailyMemory);
      context += '\n';
    }

    return context;
  }

  // ============================================
  // Plans Archive Folder Operations
  // ============================================

  /**
   * Get the Memory base directory path
   */
  async getMemoryDirectory(): Promise<string> {
    return await getMemoryBasePath();
  }

  /**
   * Get the Plans/ directory path
   */
  async getPlansDirectory(): Promise<string> {
    const basePath = await getMemoryBasePath();
    return `${basePath}/${PLANS_FOLDER}`;
  }

  /**
   * Ensure Plans/ directory exists
   */
  async ensurePlansDirectory(): Promise<void> {
    try {
      const plansDir = await this.getPlansDirectory();
      await invoke('ensure_directory', { path: plansDir });
    } catch (error) {
      console.warn('Failed to create Plans directory:', error);
      // Fallback: try to create via writing a placeholder
    }
  }

  /**
   * Save full roadmap to Plans/ archive folder
   * @param filename - e.g., "quantum-mechanics-2026-01.md"
   * @param content - Full markdown content
   */
  async saveToPlanArchive(filename: string, content: string): Promise<string> {
    try {
      await this.ensurePlansDirectory();
      const plansDir = await this.getPlansDirectory();
      const filePath = `${plansDir}/${filename}`;
      await writeMemoryFile(filePath, content);
      console.log(`📁 [Memory] Saved to archive: ${filename}`);
      return filePath;
    } catch (error) {
      console.error('Failed to save to plan archive:', error);
      throw error;
    }
  }

  /**
   * Load full roadmap from Plans/ archive
   * @param filename - e.g., "quantum-mechanics-2026-01.md"
   */
  async loadFromPlanArchive(filename: string): Promise<string | null> {
    try {
      const plansDir = await this.getPlansDirectory();
      const filePath = `${plansDir}/${filename}`;
      return await readMemoryFile(filePath);
    } catch (error) {
      console.error('Failed to load from plan archive:', error);
      return null;
    }
  }

  /**
   * Count total lessons from plan's archive file
   * Counts "### Day X" headings in the detailed roadmap
   * @param archivePath - e.g., "Plans/aws-fundamentals.md" or just "aws-fundamentals.md"
   * @returns number of lessons found, or 0 if file not found
   */
  async getTotalLessonsFromArchive(archivePath: string): Promise<number> {
    try {
      // Extract filename from path
      const filename = archivePath.split('/').pop() || archivePath;
      const content = await this.loadFromPlanArchive(filename);

      if (!content) {
        console.log(`[Memory] No archive found for: ${filename}`);
        return 0;
      }

      // Count "### Day X" patterns (matches "### Day 1", "### Day 2 | Title", etc.)
      const dayMatches = content.match(/^###\s*Day\s+\d+/gim);
      const lessonCount = dayMatches?.length || 0;

      console.log(`[Memory] Found ${lessonCount} lessons in: ${filename}`);
      return lessonCount;
    } catch (error) {
      console.error('Failed to count lessons from archive:', error);
      return 0;
    }
  }

  /**
   * List all archived plans in Plans/ folder
   */
  async listPlanArchives(): Promise<string[]> {
    try {
      const plansDir = await this.getPlansDirectory();
      // Use list_memory_files (correct Tauri command, not list_directory)
      const files = await invoke<string[]>('list_memory_files', { directory: plansDir });
      // Extract just the filenames from full paths
      return files.map(f => f.split('/').pop() || f).filter(f => f.endsWith('.md'));
    } catch (error) {
      console.warn('Failed to list plan archives:', error);
      return [];
    }
  }


  // ============================================
  // History Folder Operations (Daily.md Archives)
  // ============================================

  /**
   * Get the History/ directory path
   */
  async getHistoryDirectory(): Promise<string> {
    const basePath = await getMemoryBasePath();
    return `${basePath}/${HISTORY_FOLDER}`;
  }

  /**
   * Ensure History/ directory exists
   */
  async ensureHistoryDirectory(): Promise<void> {
    try {
      const historyDir = await this.getHistoryDirectory();
      await invoke('ensure_directory', { path: historyDir });
    } catch (error) {
      console.warn('Failed to create History directory:', error);
    }
  }

  /**
   * Archive current Daily.md to History/ folder before generating new plan
   * @param date - Date string for the archive (YYYY-MM-DD). If omitted, uses today's date.
   * @returns true if archived successfully, false if no Daily.md to archive
   */
  async archiveDailyPlan(date?: string): Promise<boolean> {
    try {
      // Load current Daily.md
      const dailyMemory = await this.loadDailyMemory();
      if (!dailyMemory) {
        console.log('📁 [Memory] No Daily.md to archive');
        return false;
      }

      // Use the date from Daily.md or provided date or today
      const archiveDate = date || dailyMemory.date || new Date().toISOString().split('T')[0];

      // Ensure History/ exists
      await this.ensureHistoryDirectory();

      // Serialize and save to History/
      const { serializeDailyMemory } = await import('./memoryParser');
      const content = serializeDailyMemory(dailyMemory);
      const historyDir = await this.getHistoryDirectory();
      const filePath = `${historyDir}/${archiveDate}.md`;

      await writeMemoryFile(filePath, content);
      console.log(`📁 [Memory] Archived Daily.md to History/${archiveDate}.md`);

      return true;
    } catch (error) {
      console.error('Failed to archive Daily.md:', error);
      return false;
    }
  }

  /**
   * List all archived daily plans in History/ folder
   */
  async listDailyHistory(): Promise<string[]> {
    try {
      const historyDir = await this.getHistoryDirectory();
      const files = await invoke<string[]>('list_memory_files', { directory: historyDir });
      // Extract just the date strings (filenames without .md)
      return files
        .map(f => f.split('/').pop() || f)
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''))
        .sort()
        .reverse(); // Most recent first
    } catch (error) {
      console.warn('Failed to list daily history:', error);
      return [];
    }
  }

  /**
   * Load a specific day from History/
   * @param date - Date string (YYYY-MM-DD)
   */
  async loadFromHistory(date: string): Promise<DailyMemory | null> {
    try {
      const historyDir = await this.getHistoryDirectory();
      const filePath = `${historyDir}/${date}.md`;
      const content = await readMemoryFile(filePath);

      if (!content) {
        return null;
      }

      const { parseDailyMemory } = await import('./memoryParser');
      return parseDailyMemory(content);
    } catch (error) {
      console.error(`Failed to load history for ${date}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const memoryService = new MemoryService();
