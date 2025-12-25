// Memory Service
// Handles reading/writing memory files and syncing with the dashboard

import { invoke } from '@tauri-apps/api/core';
import type {
  AIMemory,
  ProjectMemory,
  DailyMemory,
  SecretaryMemoryState,
} from '@/types/memory';
import {
  parseAIMemory,
  serializeAIMemory,
  parseProjectMemory,
  serializeProjectMemory,
  parseDailyMemory,
  serializeDailyMemory,
} from './memoryParser';

// Default file names
const AI_MEMORY_FILE = 'AI.md';
const PROJECT_MEMORY_FILE = 'Project.md';
const DAILY_MEMORY_FILE = 'Daily.md';

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
  // Dashboard Sync
  // ============================================

  async syncDailyToDashboard(): Promise<void> {
    const { useDashboardStore } = await import('@/store/dashboardStore');
    const daily = this.state.daily;
    
    if (!daily) {
      return;
    }

    const store = useDashboardStore.getState();
    const now = new Date().toISOString();
    
    // Convert daily tasks to dashboard format
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

    // Update today's plan
    store.setTodayPlan({
      id: `plan-${daily.date}`,
      date: daily.date,
      tasks: scheduledTasks,
      totalMinutes,
      completedMinutes,
      isApproved: true,
      userModified: false,
      createdAt: now,
      updatedAt: now,
    });

    // Update reflection if present
    if (daily.reflection) {
      // Map memory mood to dashboard mood
      const moodMap: Record<string, 'great' | 'good' | 'okay' | 'struggling' | 'overwhelmed'> = {
        'great': 'great',
        'good': 'good',
        'okay': 'okay',
        'tired': 'struggling',
        'frustrated': 'overwhelmed',
      };
      
      store.setTodayReflection({
        id: `reflection-${daily.date}`,
        date: daily.date,
        content: daily.reflection.notes || '',
        mood: moodMap[daily.reflection.mood || 'okay'] || 'okay',
        whatWentWell: daily.reflection.wins,
        whatWasHard: daily.reflection.struggles,
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
    const today = new Date().toISOString().split('T')[0];
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
}

// Export singleton instance
export const memoryService = new MemoryService();
