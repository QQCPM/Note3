// Memory Parser Service
// Parses and serializes AI.md, Project.md, and Daily.md files

import type {
  AIMemory,
  ProjectMemory,
  DailyMemory,
  DailyTask,
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

  // Parse tasks table
  const tasksMatch = content.match(/## Today(?:'s Schedule|'s Plan)?\n([\s\S]*?)(?=\n##|$)/i);
  if (tasksMatch) {
    const tableContent = tasksMatch[1];
    const rows = tableContent.split('\n').filter(l => l.includes('|') && !l.includes('---'));
    
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split('|').map(c => c.trim()).filter(c => c);
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
  let content = `# Daily Plan - ${memory.date}\n\n`;

  // Context
  content += '## Context\n';
  content += `- **Week**: ${memory.context.week}\n`;
  content += `- **Phase**: ${memory.context.phase}\n`;
  content += `- **Focus**: ${memory.context.focus}\n`;
  if (memory.context.carryOver) {
    content += `- **Carry-over**: ${memory.context.carryOver}\n`;
  }
  content += '\n';

  // Today's Schedule
  content += "## Today's Schedule\n\n";
  content += '| Time | Task | Duration | Status |\n';
  content += '|------|------|----------|--------|\n';
  for (const task of memory.tasks) {
    const statusIcon = task.status === 'completed' ? '✅' : 
                       task.status === 'in_progress' ? '🔄' : 
                       task.status === 'skipped' ? '⏭️' : '⬜';
    content += `| ${task.time} | ${task.task} | ${task.duration} | ${statusIcon} |\n`;
  }
  content += `\n**Total Study Time**: ${memory.totalStudyTime}\n\n`;

  // AI Notes
  if (memory.aiNotes) {
    content += '## Notes for You\n';
    content += `> ${memory.aiNotes}\n\n`;
  }

  // Reflection
  content += '## End of Day\n';
  if (memory.reflection) {
    const moodEmoji = memory.reflection.mood === 'great' ? '😄' :
                      memory.reflection.mood === 'good' ? '😊' :
                      memory.reflection.mood === 'okay' ? '😐' :
                      memory.reflection.mood === 'tired' ? '😓' :
                      memory.reflection.mood === 'frustrated' ? '😤' : '';
    if (memory.reflection.mood) {
      content += `- Mood: ${moodEmoji} ${memory.reflection.mood}\n`;
    }
    if (memory.reflection.completedCount !== undefined) {
      content += `- Completed: ${memory.reflection.completedCount}/${memory.reflection.totalCount}\n`;
    }
    if (memory.reflection.struggles) {
      content += `- Struggled with: ${memory.reflection.struggles}\n`;
    }
    if (memory.reflection.wins) {
      content += `- What went well: ${memory.reflection.wins}\n`;
    }
  } else {
    content += '<!-- Fill this out after studying -->\n';
    content += '- Mood: \n';
    content += '- Completed: /\n';
    content += '- Struggled with: \n';
    content += '- What went well: \n';
  }
  content += '\n';

  // Tomorrow Preview
  if (memory.tomorrowPreview && memory.tomorrowPreview.length > 0) {
    content += '## Tomorrow Preview\n';
    for (const item of memory.tomorrowPreview) {
      content += `- ${item}\n`;
    }
  }

  return content;
}
