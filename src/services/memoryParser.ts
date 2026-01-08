// Memory Parser Service
// Parses and serializes AI.md, Project.md, and Daily.md files

import type {
  AIMemory,
  ProjectMemory,
  DailyMemory,
  DailyTask,
  PlanMemory,
  Roadmap,
  RoadmapPhase,
  CondensedPlan,
  WeeklyTheme,
  DailyTaskEntry,
} from '@/types/memory';

// ============================================
// AI.md Parser
// ============================================

export function parseAIMemory(content: string): AIMemory {
  const result: AIMemory = {
    preferences: {},
    availability: [],
    blockedDates: [],
  };

  // Parse preferences section
  const preferencesMatch = content.match(/## My Preferences\n([\s\S]*?)(?=\n##|$)/i);
  if (preferencesMatch) {
    const prefContent = preferencesMatch[1];

    const focusMatch = prefContent.match(/Best focus time:\s*(.+)/i);
    if (focusMatch) result.preferences.bestFocusTime = focusMatch[1].trim();

    const breakMatch = prefContent.match(/Breaks?:\s*(.+)/i);
    if (breakMatch) result.preferences.breakFrequency = breakMatch[1].trim();

    const styleMatch = prefContent.match(/Learning style:\s*(.+)/i);
    if (styleMatch) result.preferences.learningStyle = styleMatch[1].trim();

    const weekdayMatch = prefContent.match(/Weekday hours?:\s*(\d+)/i);
    if (weekdayMatch) result.preferences.weekdayHours = parseInt(weekdayMatch[1]);

    const weekendMatch = prefContent.match(/Weekend hours?:\s*(\d+)/i);
    if (weekendMatch) result.preferences.weekendHours = parseInt(weekendMatch[1]);
  }

  // Parse availability section
  const availabilityMatch = content.match(/## Availability\n([\s\S]*?)(?=\n##|$)/i);
  if (availabilityMatch) {
    const availContent = availabilityMatch[1];
    const lines = availContent.split('\n').filter(l => l.trim().startsWith('-'));

    for (const line of lines) {
      const match = line.match(/-\s*([\w\-,\s]+):\s*(.+)/);
      if (match) {
        const daysStr = match[1].trim();
        const timeRange = match[2].trim();

        // Parse days
        let days: string[] = [];
        if (daysStr.includes('-')) {
          // Range like "Mon-Fri"
          const [start, end] = daysStr.split('-').map(d => d.trim());
          const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          const startIdx = allDays.findIndex(d => d.toLowerCase().startsWith(start.toLowerCase().substring(0, 3)));
          const endIdx = allDays.findIndex(d => d.toLowerCase().startsWith(end.toLowerCase().substring(0, 3)));
          if (startIdx !== -1 && endIdx !== -1) {
            days = allDays.slice(startIdx, endIdx + 1);
          }
        } else {
          // Comma-separated or single
          days = daysStr.split(',').map(d => d.trim());
        }

        result.availability.push({ days, timeRange });
      }
    }
  }

  // Parse blocked dates
  const blockedMatch = content.match(/Blocked:\s*(.+)/i);
  if (blockedMatch) {
    result.blockedDates = blockedMatch[1].split(',').map(d => d.trim());
  }

  // Parse custom instructions (everything after ## Custom Instructions if present)
  const instructionsMatch = content.match(/## Custom Instructions\n([\s\S]*?)(?=\n##|$)/i);
  if (instructionsMatch) {
    result.customInstructions = instructionsMatch[1].trim();
  }

  return result;
}

export function serializeAIMemory(memory: AIMemory): string {
  let content = '# AI Memory\n\n';

  // Preferences
  content += '## My Preferences\n';
  if (memory.preferences.bestFocusTime) {
    content += `- Best focus time: ${memory.preferences.bestFocusTime}\n`;
  }
  if (memory.preferences.breakFrequency) {
    content += `- Breaks: ${memory.preferences.breakFrequency}\n`;
  }
  if (memory.preferences.learningStyle) {
    content += `- Learning style: ${memory.preferences.learningStyle}\n`;
  }
  if (memory.preferences.weekdayHours) {
    content += `- Weekday hours: ${memory.preferences.weekdayHours}h\n`;
  }
  if (memory.preferences.weekendHours) {
    content += `- Weekend hours: ${memory.preferences.weekendHours}h\n`;
  }
  content += '\n';

  // Availability
  content += '## Availability\n';
  for (const slot of memory.availability) {
    const daysStr = slot.days.length > 2
      ? `${slot.days[0]}-${slot.days[slot.days.length - 1]}`
      : slot.days.join(', ');
    content += `- ${daysStr}: ${slot.timeRange}\n`;
  }
  if (memory.blockedDates.length > 0) {
    content += `- Blocked: ${memory.blockedDates.join(', ')}\n`;
  }
  content += '\n';

  // Custom instructions
  if (memory.customInstructions) {
    content += '## Custom Instructions\n';
    content += memory.customInstructions + '\n';
  }

  return content;
}

// ============================================
// Project.md Parser
// ============================================

export function parseProjectMemory(content: string): ProjectMemory {
  const result: ProjectMemory = {
    name: '',
    goal: { description: '' },
    timeline: {
      startDate: '',
      endDate: '',
      currentDay: 0,
      totalDays: 0,
    },
    phases: [],
  };

  // Parse project name from title
  const titleMatch = content.match(/^#\s+(.+)/m);
  if (titleMatch) {
    result.name = titleMatch[1].trim();
  }

  // Parse goal
  const goalMatch = content.match(/## Goal\n([\s\S]*?)(?=\n##|$)/i);
  if (goalMatch) {
    result.goal.description = goalMatch[1].trim();
  }

  // Parse timeline
  const timelineMatch = content.match(/## Timeline\n([\s\S]*?)(?=\n##|$)/i);
  if (timelineMatch) {
    const timeContent = timelineMatch[1];

    const startMatch = timeContent.match(/Start:\s*(.+)/i);
    if (startMatch) result.timeline.startDate = startMatch[1].trim();

    const endMatch = timeContent.match(/End:\s*(.+)/i);
    if (endMatch) result.timeline.endDate = endMatch[1].trim();

    const dayMatch = timeContent.match(/Day:\s*(\d+)\/(\d+)/i);
    if (dayMatch) {
      result.timeline.currentDay = parseInt(dayMatch[1]);
      result.timeline.totalDays = parseInt(dayMatch[2]);
    }
  }

  // Parse current phase
  const currentPhaseMatch = content.match(/## Current Phase\n([\s\S]*?)(?=\n##|$)/i);
  if (currentPhaseMatch) {
    result.currentPhase = currentPhaseMatch[1].trim().split('\n')[0];
  }

  // Parse phases/roadmap
  const phasesMatch = content.match(/## (?:Progress|Phases|Roadmap)\n([\s\S]*?)(?=\n##|$)/i);
  if (phasesMatch) {
    const phasesContent = phasesMatch[1];
    const phaseLines = phasesContent.split('\n').filter(l => l.trim());

    for (const line of phaseLines) {
      const phaseMatch = line.match(/([✅🔄⬜])\s*Phase\s*(\d+):\s*(.+?)(?:\s*\(Weeks?\s*([\d\-]+)\))?$/i);
      if (phaseMatch) {
        const statusIcon = phaseMatch[1];
        const phaseNum = phaseMatch[2];
        const phaseName = phaseMatch[3].trim();
        const weeks = phaseMatch[4] || '';

        let status: 'completed' | 'in_progress' | 'pending' = 'pending';
        if (statusIcon === '✅') status = 'completed';
        else if (statusIcon === '🔄') status = 'in_progress';

        result.phases.push({
          id: `phase-${phaseNum}`,
          name: phaseName,
          weeks,
          status,
          topics: [],
        });
      }
    }
  }

  // Parse weekly plan
  const weeklyMatch = content.match(/## Weekly Plan\n([\s\S]*?)(?=\n##|$)/i);
  if (weeklyMatch) {
    const weeklyContent = weeklyMatch[1];
    const lines = weeklyContent.split('\n').filter(l => l.trim().startsWith('-'));

    result.weeklyPlan = {};
    for (const line of lines) {
      const match = line.match(/-\s*(\w+):\s*(.+)/);
      if (match) {
        result.weeklyPlan[match[1]] = match[2].trim();
      }
    }
  }

  // Parse blockers
  const blockersMatch = content.match(/## (?:Current )?Blockers\n([\s\S]*?)(?=\n##|$)/i);
  if (blockersMatch) {
    const blockerLines = blockersMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
    result.blockers = blockerLines.map(l => l.replace(/^-\s*/, '').trim());
  }

  return result;
}

export function serializeProjectMemory(memory: ProjectMemory): string {
  let content = `# ${memory.name}\n\n`;

  // Goal
  content += '## Goal\n';
  content += memory.goal.description + '\n\n';

  // Timeline
  content += '## Timeline\n';
  content += `Start: ${memory.timeline.startDate} | End: ${memory.timeline.endDate} | Day: ${memory.timeline.currentDay}/${memory.timeline.totalDays}\n\n`;

  // Current Phase
  if (memory.currentPhase) {
    content += '## Current Phase\n';
    content += memory.currentPhase + '\n\n';
  }

  // Progress/Phases
  content += '## Progress\n';
  for (const phase of memory.phases) {
    const icon = phase.status === 'completed' ? '✅' : phase.status === 'in_progress' ? '🔄' : '⬜';
    const weeksStr = phase.weeks ? ` (Weeks ${phase.weeks})` : '';
    content += `${icon} Phase ${phase.id.replace('phase-', '')}: ${phase.name}${weeksStr}\n`;
  }
  content += '\n';

  // Weekly Plan
  if (memory.weeklyPlan && Object.keys(memory.weeklyPlan).length > 0) {
    content += '## Weekly Plan\n';
    for (const [day, task] of Object.entries(memory.weeklyPlan)) {
      content += `- ${day}: ${task}\n`;
    }
    content += '\n';
  }

  // Blockers
  if (memory.blockers && memory.blockers.length > 0) {
    content += '## Current Blockers\n';
    for (const blocker of memory.blockers) {
      content += `- ${blocker}\n`;
    }
    content += '\n';
  }

  return content;
}

// ============================================
// Daily.md Parser
// ============================================

export function parseDailyMemory(content: string): DailyMemory {
  const result: DailyMemory = {
    date: new Date().toISOString().split('T')[0],
    context: {
      week: 1,
      phase: '',
      focus: '',
    },
    tasks: [],
    totalStudyTime: '',
  };

  // Parse date from title
  const dateMatch = content.match(/# (?:Daily Plan - )?(.+)/);
  if (dateMatch) {
    result.date = dateMatch[1].trim();
  }

  // Parse explicit date field: **Date:** 2026-01-06
  const explicitDateMatch = content.match(/\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  if (explicitDateMatch) {
    result.date = explicitDateMatch[1];
  }

  // Parse explicit focus field: **Focus:** Topic name
  const focusMatch = content.match(/\*\*Focus:\*\*\s*(.+)/);
  if (focusMatch) {
    result.context.focus = focusMatch[1].trim();
  }


  // Parse context
  const contextMatch = content.match(/## Context\n([\s\S]*?)(?=\n##|$)/i);
  if (contextMatch) {
    const ctxContent = contextMatch[1];

    const weekMatch = ctxContent.match(/Week:\s*(\d+)/i);
    if (weekMatch) result.context.week = parseInt(weekMatch[1]);

    const phaseMatch = ctxContent.match(/Phase:\s*(.+)/i);
    if (phaseMatch) result.context.phase = phaseMatch[1].trim();

    const focusMatch = ctxContent.match(/Focus:\s*(.+)/i);
    if (focusMatch) result.context.focus = focusMatch[1].trim();

    const carryMatch = ctxContent.match(/Carry-over:\s*(.+)/i);
    if (carryMatch) result.context.carryOver = carryMatch[1].trim();
  }

  // Parse tasks - supports both TABLE and CHECKLIST formats
  // Look for Schedule section (AI often uses this header)
  const scheduleMatch = content.match(/## (?:Today(?:'s Schedule|'s Plan)?|Schedule)\n([\s\S]*?)(?=\n##|$)/i);
  if (scheduleMatch) {
    const scheduleContent = scheduleMatch[1];

    // Try TABLE format first (legacy parser)
    const tableRows = scheduleContent.split('\n').filter(l => l.includes('|') && !l.includes('---'));
    if (tableRows.length > 1) {
      // Skip header row
      for (let i = 1; i < tableRows.length; i++) {
        const cells = tableRows[i].split('|').map(c => c.trim()).filter(c => c);
        if (cells.length >= 4) {
          const [time, task, _typeOrDuration, _statusOrDuration] = cells;

          // Determine status from emoji
          let status: DailyTask['status'] = 'pending';
          const statusCell = cells[cells.length - 1];
          if (statusCell.includes('✅')) status = 'completed';
          else if (statusCell.includes('🔄')) status = 'in_progress';
          else if (statusCell.includes('⏭️') || statusCell.includes('skipped')) status = 'skipped';

          result.tasks.push({
            id: `task-${i}`,
            time: time.replace(/^\d+\.\s*/, ''),
            task,
            type: 'other',
            duration: cells.length > 3 ? cells[2] : '30min',
            status,
          });
        }
      }
    }

    // Try CHECKLIST format: "- [ ] 10:00 (45min) 📖 Task description"
    // Also handles: "- [x] 10:00 (45min) Task" for completed tasks
    if (result.tasks.length === 0) {
      const checklistLines = scheduleContent.split('\n').filter(l =>
        l.trim().match(/^-\s*\[[ x]\]/i)
      );

      let taskIndex = 0;
      for (const line of checklistLines) {
        // Parse: "- [ ] 10:00 (45min) 📖+💻 Task description"
        // Or: "- [x] 14:00 (30min) 💻 Completed task"
        const match = line.match(/^-\s*\[([ xX])\]\s*(\d{1,2}:\d{2})\s*\((\d+)\s*min\)\s*(.+)/);
        if (match) {
          const [, checked, time, duration, taskText] = match;
          const status: DailyTask['status'] = checked.toLowerCase() === 'x' ? 'completed' : 'pending';

          // Clean task text: remove leading emojis but keep the rest
          const cleanedTask = taskText.replace(/^[📖💻☕🔧📝✏️🎯📊🗂️]+\s*/, '').trim();

          // Determine type from emojis
          let type: DailyTask['type'] = 'other';
          if (taskText.includes('📖') || taskText.toLowerCase().includes('read')) type = 'learn';
          else if (taskText.includes('💻') || taskText.toLowerCase().includes('practice')) type = 'practice';
          else if (taskText.includes('☕') || taskText.toLowerCase().includes('break')) type = 'break';
          else if (taskText.toLowerCase().includes('review')) type = 'review';
          else if (taskText.toLowerCase().includes('project')) type = 'project';

          result.tasks.push({
            id: `task-${taskIndex++}`,
            time,
            task: cleanedTask || taskText.trim(),
            type,
            duration: `${duration}min`,
            status,
          });
        }
      }
    }
  }

  // Parse total study time
  const totalMatch = content.match(/\*\*Total(?:\s+Study\s+Time)?[:\s]*\*?\*?\s*(.+)/i);
  if (totalMatch) {
    result.totalStudyTime = totalMatch[1].trim();
  }

  // Parse AI notes
  const aiNotesMatch = content.match(/## (?:Notes for You|AI Notes)\n([\s\S]*?)(?=\n##|$)/i);
  if (aiNotesMatch) {
    result.aiNotes = aiNotesMatch[1].trim();
  }

  // Parse reflection
  const reflectionMatch = content.match(/## (?:End of Day|Reflection)\n([\s\S]*?)(?=\n##|$)/i);
  if (reflectionMatch) {
    const refContent = reflectionMatch[1];
    result.reflection = {};

    const moodMatch = refContent.match(/Mood:\s*(.+)/i);
    if (moodMatch) {
      const moodStr = moodMatch[1].toLowerCase();
      if (moodStr.includes('great') || moodStr.includes('😄')) result.reflection.mood = 'great';
      else if (moodStr.includes('good') || moodStr.includes('😊')) result.reflection.mood = 'good';
      else if (moodStr.includes('okay') || moodStr.includes('😐')) result.reflection.mood = 'okay';
      else if (moodStr.includes('tired') || moodStr.includes('😓')) result.reflection.mood = 'tired';
      else if (moodStr.includes('frustrated') || moodStr.includes('😤')) result.reflection.mood = 'frustrated';
    }

    const completedMatch = refContent.match(/Completed:\s*(\d+)\/(\d+)/i);
    if (completedMatch) {
      result.reflection.completedCount = parseInt(completedMatch[1]);
      result.reflection.totalCount = parseInt(completedMatch[2]);
    }

    const strugglesMatch = refContent.match(/Struggled? with:\s*(.+)/i);
    if (strugglesMatch) result.reflection.struggles = strugglesMatch[1].trim();

    const winsMatch = refContent.match(/(?:Wins?|What went well):\s*(.+)/i);
    if (winsMatch) result.reflection.wins = winsMatch[1].trim();
  }

  // Parse tomorrow preview
  const tomorrowMatch = content.match(/## Tomorrow(?:'s)?(?: Preview)?\n([\s\S]*?)(?=\n##|$)/i);
  if (tomorrowMatch) {
    const lines = tomorrowMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
    result.tomorrowPreview = lines.map(l => l.replace(/^-\s*/, '').trim());
  }

  return result;
}

export function serializeDailyMemory(memory: DailyMemory): string {
  // Parse the date to get day of week
  const dateParts = memory.date.match(/(\d{4})-(\d{2})-(\d{2})/);
  let dateHeader = memory.date;
  let isoDate = memory.date;

  if (dateParts) {
    const [, year, month, day] = dateParts;
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });
    dateHeader = `${dayOfWeek}, ${monthName} ${parseInt(day)}, ${year}`;
    isoDate = `${year}-${month}-${day}`;
  }

  let content = `# 📅 ${dateHeader}\n\n`;
  content += `**Date:** ${isoDate}\n`;
  content += `**Focus:** ${memory.context.focus || 'Not specified'}\n\n`;

  // Schedule as checklist
  content += '## Schedule\n\n';
  for (const task of memory.tasks) {
    const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
    const emoji = task.type === 'learn' ? '📖' :
      task.type === 'practice' ? '💻' :
        task.type === 'review' ? '🔄' :
          task.type === 'break' ? '☕' : '📝';
    content += `- ${checkbox} ${task.time} (${task.duration}) ${emoji} ${task.task}\n`;
  }
  content += '\n';

  // AI Notes
  if (memory.aiNotes) {
    content += '## AI Notes\n\n';
    content += `> ${memory.aiNotes}\n\n`;
  }

  // End of Day Reflection
  content += '## End of Day\n\n';
  if (memory.reflection) {
    const moodEmoji = memory.reflection.mood === 'great' ? '😄' :
      memory.reflection.mood === 'good' ? '😊' :
        memory.reflection.mood === 'okay' ? '😐' :
          memory.reflection.mood === 'tired' ? '😓' :
            memory.reflection.mood === 'frustrated' ? '😤' : '';
    content += `- Mood: ${moodEmoji} ${memory.reflection.mood || ''}\n`;
    content += `- Completed: ${memory.reflection.completedCount ?? ''}/${memory.reflection.totalCount ?? ''}\n`;
    content += `- Struggled with: ${memory.reflection.struggles || ''}\n`;
    content += `- What went well: ${memory.reflection.wins || ''}\n`;
  } else {
    content += '- Mood: \n';
    content += '- Completed: /\n';
    content += '- Struggled with: \n';
    content += '- What went well: \n';
  }
  content += '\n';

  // Tomorrow Preview
  if (memory.tomorrowPreview && memory.tomorrowPreview.length > 0) {
    content += '## Tomorrow Preview\n\n';
    for (const item of memory.tomorrowPreview) {
      content += `- ${item}\n`;
    }
  }

  return content;
}


// ============================================
// Plan.md Parser (Multi-Roadmap Support)
// ============================================

/**
 * Parse a single roadmap section from markdown
 */
export function parseRoadmapSection(content: string, name: string): Roadmap {
  const roadmap: Roadmap = {
    id: `roadmap-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name,
    topic: name,
    startDate: '',
    endDate: '',
    status: 'active',
    studyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    dailyHours: 2,
    phases: [],
  };

  // CRITICAL: Preserve the full raw content between header and separator
  // This prevents loss of rich AI-generated formatting during parse-save cycles
  const lines = content.split('\n');
  const headerIndex = lines.findIndex(l => l.startsWith('###'));
  if (headerIndex !== -1) {
    // Everything from line after header until separator (---)
    const bodyLines = lines.slice(headerIndex + 1);
    const sepIndex = bodyLines.findIndex(l => l.trim() === '---');
    const endIndex = sepIndex !== -1 ? sepIndex : bodyLines.length;
    roadmap.rawContent = bodyLines.slice(0, endIndex).join('\n').trim();

    console.log(`[Parser] Parsed roadmap "${name}": hasRawContent=${!!roadmap.rawContent}, length=${roadmap.rawContent?.length || 0}`);
  }

  // Parse status and day progress: "Status: active | Day 5/90"
  const statusMatch = content.match(/Status:\s*(\w+)\s*\|\s*Day\s*(\d+)\/(\d+)/i);
  if (statusMatch) {
    roadmap.status = statusMatch[1].toLowerCase() as 'active' | 'paused' | 'completed';
    // We can calculate progress from this
  }

  // Parse started date
  const startedMatch = content.match(/Started:\s*(\d{4}-\d{2}-\d{2})/i);
  if (startedMatch) {
    roadmap.startDate = startedMatch[1];
  }

  // Parse end date
  const endMatch = content.match(/End:\s*(\d{4}-\d{2}-\d{2})/i);
  if (endMatch) {
    roadmap.endDate = endMatch[1];
  }

  // Parse study days
  const daysMatch = content.match(/Study days:\s*(.+)/i);
  if (daysMatch) {
    roadmap.studyDays = daysMatch[1].split(',').map(d => d.trim());
  }

  // Parse daily hours
  const hoursMatch = content.match(/Daily hours:\s*(\d+)/i);
  if (hoursMatch) {
    roadmap.dailyHours = parseInt(hoursMatch[1]);
  }

  // Parse phases
  const phaseMatches = content.matchAll(/####\s*Phase\s*(\d+):\s*(.+?)(?:\s*\(Weeks?\s*([^)]+)\))?$/gmi);
  for (const match of phaseMatches) {
    const phase: RoadmapPhase = {
      id: `phase-${match[1]}`,
      name: match[2].trim(),
      weeks: match[3] || '',
      status: 'pending',
      topics: [],
    };
    roadmap.phases.push(phase);
  }

  return roadmap;
}

export function parsePlanMemory(content: string): PlanMemory {
  const result: PlanMemory = {
    activePlans: [],
    archivedPlans: [],
    thisWeek: null,
  };

  // Parse active plans section
  const activeSectionMatch = content.match(/## Active Plans\n([\s\S]*?)(?=## This Week|## Archived|---|\n##\s|$)/i);
  if (activeSectionMatch) {
    const activeContent = activeSectionMatch[1].trim();
    const planLines = activeContent.split('\n').filter(line => line.trim() && !line.startsWith('*'));

    console.log('[MemoryParser] Parsing Active Plans section, lines:', planLines);

    for (const line of planLines) {
      const plan = parseCondensedPlanLine(line);
      if (plan) {
        result.activePlans.push(plan);
        console.log('[MemoryParser] ✓ Parsed plan:', plan.id);
      } else {
        console.log('[MemoryParser] ✗ Failed to parse line:', line.substring(0, 80) + '...');
      }
    }
  }


  // Parse This Week section
  const thisWeekMatch = content.match(/## This Week \(([^)]+)\)\n([\s\S]*?)(?=## Archived|---|$)/i);
  if (thisWeekMatch) {
    const weekRange = thisWeekMatch[1];
    const weekContent = thisWeekMatch[2].trim();
    const dailyTasks: DailyTaskEntry[] = [];

    // Parse day entries - handles multiple formats:
    // Format 1: "**Mon (Jan 5):** AWS3 - Day 1: Topic"
    // Format 2: "**Mon:** QM - Topic"
    // Format 3: "**Sun (Jan 4):** —" (rest day)
    const lines = weekContent.split('\n');
    for (const line of lines) {
      // Match: **Day (Date):** or **Day:**
      const dayMatch = line.match(/\*\*(\w{3})\s*(?:\([^)]+\))?:\*\*\s*(.+)/);
      if (dayMatch) {
        const dayName = dayMatch[1]; // "Mon", "Tue", etc.
        const rest = dayMatch[2].trim();

        // Skip rest days marked with — or -
        if (rest === '—' || rest === '-' || rest === '–') {
          continue;
        }

        // Parse "AWS3 - Day 1: Topic" or "QM - Topic"
        const planMatch = rest.match(/^(\w+)\s*-\s*(.+)/);
        if (planMatch) {
          dailyTasks.push({
            day: dayName, // "Mon", "Tue", etc.
            planId: planMatch[1], // "AWS3", "QM"
            topic: planMatch[2].trim(), // "Day 1: Account safety..."
          });
        }
      }
    }

    result.thisWeek = {
      weekStart: '', // Will be computed from weekRange
      weekRange,
      dailyTasks,
    };

    console.log('[MemoryParser] Parsed This Week:', { weekRange, taskCount: dailyTasks.length, dailyTasks });
  }

  // Parse archived plans section
  const archivedMatch = content.match(/## Archived\n([\s\S]*?)$/i);
  if (archivedMatch) {
    const archivedContent = archivedMatch[1].trim();
    const planLines = archivedContent.split('\n').filter(line => line.trim() && !line.startsWith('*'));

    for (const line of planLines) {
      const plan = parseCondensedPlanLine(line);
      if (plan) {
        plan.status = 'completed';
        result.archivedPlans.push(plan);
      }
    }
  }

  return result;
}

/**
 * Parse a single condensed plan line
 * Format: "ID | Name | Date Range | Schedule | W#/# "
 * Example: "QM | Quantum Mechanics | Jan 1 - Feb 15 | MWF 2h | W4/6"
 * Also supports: "AWS3 | Name | DateRange | Custom: Tue + Thu + Tue | W1/1"
 */
function parseCondensedPlanLine(line: string): CondensedPlan | null {
  // Try original format first: ID | Name | DateRange | Schedule Xh | W#/#
  let match = line.match(/^(\w+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\w+)\s+([\d.]+)h\s*\|\s*W(\d+)\/(\d+)/);

  if (match) {
    const [, id, name, dateRange, daysStr, hours, currentWeek, totalWeeks] = match;
    const dates = parseDateRange(dateRange);
    const studyDays = parseStudyDays(daysStr);

    return {
      id,
      name: name.trim(),
      topic: name.trim(),
      startDate: dates.start,
      endDate: dates.end,
      studyDays,
      dailyHours: parseFloat(hours),
      currentWeek: parseInt(currentWeek),
      totalWeeks: parseInt(totalWeeks),
      status: 'active',
      weeklyThemes: [],
      archivePath: '',
    };
  }

  // Try flexible format: ID | Name | DateRange | Any Schedule (no hours) | W#/#
  match = line.match(/^(\w+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*W(\d+)\/(\d+)/);

  if (match) {
    const [, id, name, dateRange, scheduleStr, currentWeek, totalWeeks] = match;
    const dates = parseDateRange(dateRange);

    // Try to extract days from schedule string (e.g., "Custom: Tue + Thu + Tue")
    let studyDays: string[] = [];
    const daysMatch = scheduleStr.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/gi);
    if (daysMatch) {
      // Capitalize properly and deduplicate
      studyDays = [...new Set(daysMatch.map(d => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase()))];
    }

    // Try to extract hours if present somewhere in the string
    const hoursMatch = scheduleStr.match(/([\d.]+)\s*h/i);
    const dailyHours = hoursMatch ? parseFloat(hoursMatch[1]) : 2; // Default to 2h

    const plan = {
      id,
      name: name.trim(),
      topic: name.trim(),
      startDate: dates.start,
      endDate: dates.end,
      studyDays,
      dailyHours,
      currentWeek: parseInt(currentWeek),
      totalWeeks: parseInt(totalWeeks),
      status: 'active' as const,
      weeklyThemes: [] as WeeklyTheme[],
      archivePath: '',
    };

    console.log('[MemoryParser] Parsed with flexible format:', {
      id: plan.id,
      dateRange,
      startDate: plan.startDate,
      endDate: plan.endDate,
      scheduleStr,
      studyDays: plan.studyDays,
      dailyHours: plan.dailyHours
    });

    return plan;
  }

  return null;
}



function parseDateRange(range: string): { start: string; end: string } {
  // Handle new format: "2026-01-09 to 2026-01-30"
  if (range.includes(' to ')) {
    const parts = range.split(' to ').map(p => p.trim());
    return {
      start: parts[0] || '',
      end: parts[1] || '',
    };
  }

  // Fallback for old format: "Jan 9 - Jan 30" or "2026-01-01 - 2026-02-15"
  // Try to convert human-readable dates to ISO format
  const parts = range.split(' - ').map(p => p.trim());
  const parseHumanDate = (dateStr: string): string => {
    // If already ISO format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    // Try to parse human-readable format like "Jan 9"
    const currentYear = new Date().getFullYear();
    const date = new Date(`${dateStr}, ${currentYear}`);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return dateStr; // Return original if parsing fails
  };

  return {
    start: parseHumanDate(parts[0] || ''),
    end: parseHumanDate(parts[1] || ''),
  };
}

function parseStudyDays(daysStr: string): string[] {
  const days: string[] = [];

  // Handle "Mon,Wed,Fri" format (comma-separated full names)
  if (daysStr.includes(',')) {
    return daysStr.split(',').map(d => d.trim());
  }

  // Handle abbreviated format like "SuMTuWThFSa"
  // Parse two-letter abbreviations first, then single-letter
  let i = 0;
  while (i < daysStr.length) {
    const twoChar = daysStr.substring(i, i + 2);

    // Check two-letter abbreviations first
    if (twoChar === 'Su') {
      days.push('Sun');
      i += 2;
    } else if (twoChar === 'Tu') {
      days.push('Tue');
      i += 2;
    } else if (twoChar === 'Th') {
      days.push('Thu');
      i += 2;
    } else if (twoChar === 'Sa') {
      days.push('Sat');
      i += 2;
    } else {
      // Single-letter abbreviations
      const oneChar = daysStr[i];
      if (oneChar === 'M') {
        days.push('Mon');
      } else if (oneChar === 'W') {
        days.push('Wed');
      } else if (oneChar === 'F') {
        days.push('Fri');
      } else if (oneChar === 'T') {
        // Legacy: T alone defaults to Tue (for backwards compatibility)
        days.push('Tue');
      } else if (oneChar === 'S') {
        // Legacy: S alone defaults to Sat (for backwards compatibility)
        days.push('Sat');
      }
      i++;
    }
  }

  return days;
}

export function serializePlanMemory(memory: PlanMemory): string {
  let content = '# Learning Plans\n\n';

  // Active Plans
  content += '## Active Plans\n\n';

  if (memory.activePlans.length === 0) {
    content += '*No active plans. Create one by asking the AI to plan your learning!*\n\n';
  } else {
    for (const plan of memory.activePlans) {
      content += serializeCondensedPlan(plan);
    }
    content += '\n';
  }

  // This Week section
  content += '---\n\n';
  if (memory.thisWeek) {
    content += `## This Week (${memory.thisWeek.weekRange})\n\n`;

    if (memory.thisWeek.dailyTasks.length === 0) {
      content += '*No active tasks this week.*\n\n';
    } else {
      // Table header
      content += '| Day | Plan | Topic | Details |\n';
      content += '|-----|------|-------|----------|\n';

      // Group tasks by day to avoid duplicates
      const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const tasksByDay: Record<string, typeof memory.thisWeek.dailyTasks> = {};

      for (const task of memory.thisWeek.dailyTasks) {
        if (!tasksByDay[task.day]) {
          tasksByDay[task.day] = [];
        }
        tasksByDay[task.day].push(task);
      }

      // Output in day order as table rows
      for (const day of dayOrder) {
        const tasks = tasksByDay[day];
        if (tasks && tasks.length > 0) {
          for (const task of tasks) {
            // Build details link if we have the info
            let detailsLink = '-';
            if (task.archivePath && task.dayNumber) {
              const filename = task.archivePath.split('/').pop() || '';
              detailsLink = `[Day ${task.dayNumber}](Plans/${filename}#day-${task.dayNumber})`;
            } else if (task.dayNumber) {
              detailsLink = `Day ${task.dayNumber}`;
            }

            content += `| ${day} | ${task.planId} | ${task.topic} | ${detailsLink} |\n`;
          }
        }
      }
      content += '\n';
    }
  } else {
    content += '## This Week\n\n*No weekly schedule yet.*\n\n';
  }

  // Archived Plans
  content += '---\n\n';
  content += '## Archived\n\n';

  if (memory.archivedPlans.length === 0) {
    content += '*No archived plans yet.*\n\n';
  } else {
    for (const plan of memory.archivedPlans) {
      content += serializeCondensedPlan(plan);
    }
  }

  return content;
}

/**
 * Serialize a single condensed plan to markdown block with link
 * New format: structured block that AI can easily parse
 */
function serializeCondensedPlan(plan: CondensedPlan): string {
  // Format study days nicely
  const days = plan.studyDays.join(' / ');

  // Extract filename from archivePath (e.g., "Plans/lp-2026-01-06.md" -> "lp-2026-01-06.md")
  const filename = plan.archivePath
    ? plan.archivePath.split('/').pop()
    : `${plan.id.toLowerCase()}-${plan.startDate}.md`;

  // Build weekly progress indicator
  const progressParts: string[] = [];
  if (plan.weeklyThemes.length > 0) {
    const themesStr = plan.weeklyThemes.map(t => {
      const statusMark = t.status === 'completed' ? '✓' : (t.status === 'current' ? '→' : '');
      return `W${t.week}${statusMark}`;
    }).join(' ');
    progressParts.push(themesStr);
  }
  const progressLine = progressParts.length > 0 ? ` (${progressParts.join(', ')})` : '';

  return `### ${plan.id}: ${plan.name}
- **Schedule:** ${days}, ${plan.dailyHours}h/day
- **Duration:** ${plan.startDate} to ${plan.endDate}
- **Progress:** Week ${plan.currentWeek} of ${plan.totalWeeks}${progressLine}
- **Details:** [Full Roadmap](Plans/${filename})

`;
}

export function serializeRoadmap(roadmap: Roadmap): string {
  console.log(`📄 [MemoryParser] serializeRoadmap: name="${roadmap.name}", hasRawContent=${!!roadmap.rawContent}, len=${roadmap.rawContent?.length || 0}`);

  let content = `### ${roadmap.name}\n\n`;

  // If we have rawContent (the full AI-generated markdown), use it!
  if (roadmap.rawContent && roadmap.rawContent.length > 0) {
    // Add metadata header with status and dates
    content += `**Status:** ${roadmap.status}`;
    if (roadmap.startDate) {
      content += ` | **Started:** ${roadmap.startDate}`;
    }
    if (roadmap.endDate) {
      content += ` | **End:** ${roadmap.endDate}`;
    }
    content += '\n\n';

    // Strip the duplicate # Title line from rawContent to avoid doubled headers
    // The rawContent typically starts with "# Topic Name - X Week Plan"
    let cleanedRawContent = roadmap.rawContent;
    const titleLineMatch = cleanedRawContent.match(/^#\s+.+?\n+/);
    if (titleLineMatch) {
      cleanedRawContent = cleanedRawContent.substring(titleLineMatch[0].length);
      console.log(`📄 [MemoryParser] Stripped title line from rawContent`);
    }

    content += cleanedRawContent;
    content += '\n\n---\n\n';
    return content;
  }

  // Fallback: structured output if no rawContent
  content += `**Topic:** ${roadmap.topic}\n`;
  content += `**Status:** ${roadmap.status}`;
  if (roadmap.dailyTopics && roadmap.dailyTopics.length > 0) {
    const currentDay = roadmap.dailyTopics.filter(d => d.topic).length;
    content += ` | Day ${currentDay}/${roadmap.dailyTopics.length}`;
  }
  content += '\n';

  if (roadmap.startDate) {
    content += `**Started:** ${roadmap.startDate}\n`;
  }
  if (roadmap.endDate) {
    content += `**End:** ${roadmap.endDate}\n`;
  }
  content += `**Study days:** ${roadmap.studyDays.join(', ')}\n`;
  content += `**Daily hours:** ${roadmap.dailyHours}h\n\n`;

  // Phases with full content
  if (roadmap.phases.length > 0) {
    content += `#### Phases\n\n`;
    for (const phase of roadmap.phases) {
      const statusIcon = phase.status === 'completed' ? '✅' :
        phase.status === 'in_progress' ? '🔄' : '⬜';
      const weeksStr = phase.weeks ? ` (Weeks ${phase.weeks})` : '';
      content += `${statusIcon} **Phase ${phase.id.replace('phase-', '')}: ${phase.name}**${weeksStr}\n`;

      // Include phase topics/content
      if (phase.topics && phase.topics.length > 0) {
        for (const topic of phase.topics) {
          content += `  - ${topic}\n`;
        }
      }
      content += '\n';
    }
  }

  // Daily Topics breakdown (the detailed day-by-day plan)
  if (roadmap.dailyTopics && roadmap.dailyTopics.length > 0) {
    content += `#### Daily Schedule\n\n`;

    // Group by week for better readability
    const weeks = new Map<number, typeof roadmap.dailyTopics>();
    for (const day of roadmap.dailyTopics) {
      const weekNum = day.week || Math.ceil(day.day / 7);
      if (!weeks.has(weekNum)) {
        weeks.set(weekNum, []);
      }
      weeks.get(weekNum)!.push(day);
    }

    for (const [weekNum, days] of weeks) {
      content += `**Week ${weekNum}**\n`;
      for (const day of days) {
        content += `- Day ${day.day}: ${day.topic}`;
        if (day.concepts) {
          content += ` — *${day.concepts}*`;
        }
        content += '\n';
        if (day.reading) {
          content += `  - 📖 Reading: ${day.reading}\n`;
        }
        if (day.tasks) {
          content += `  - ✅ Tasks: ${day.tasks}\n`;
        }
      }
      content += '\n';
    }
  }

  content += '---\n\n';
  return content;
}
