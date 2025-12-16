import React from 'react';
import { Clock, Play, CheckCircle } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { TodayTask } from '@/types/project';

// ============================================================================
// TYPES
// ============================================================================

interface TodaySectionProps {
  tasks: TodayTask[];
}

// ============================================================================
// TASK ITEM COMPONENT
// ============================================================================

interface TaskItemProps {
  task: TodayTask;
  onStart: () => void;
  onComplete: () => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onStart, onComplete }) => {
  const isInProgress = task.status === 'in_progress';
  const isCompleted = task.status === 'completed';

  // Get task type icon
  const getTaskTypeIcon = () => {
    switch (task.taskType) {
      case 'learn':
        return '📖';
      case 'practice':
        return '🧪';
      case 'review':
        return '🔄';
      case 'project':
        return '💻';
      default:
        return '📋';
    }
  };

  // Format time
  const formatTime = (time?: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
        transition-colors duration-150
        ${isInProgress ? 'bg-blue-500/10 border border-blue-500/30' : 'hover:bg-[#161b22]'}
        ${isCompleted ? 'opacity-50' : ''}
      `}
    >
      {/* Status Button */}
      <button
        onClick={isCompleted ? undefined : onComplete}
        className={`
          flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center
          transition-colors duration-150
          ${isCompleted
            ? 'bg-green-500 border-green-500 text-white'
            : isInProgress
              ? 'border-blue-500 text-blue-500 hover:bg-blue-500/20'
              : 'border-gray-600 hover:border-gray-400'
          }
        `}
      >
        {isCompleted && <CheckCircle size={12} />}
        {isInProgress && <Play size={10} className="ml-0.5" />}
      </button>

      {/* Task Icon */}
      <span className="flex-shrink-0 text-sm">{getTaskTypeIcon()}</span>

      {/* Task Info */}
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm truncate ${isCompleted ? 'line-through text-gray-500' : 'text-gray-300'}`}
        >
          {task.title}
        </div>
        {task.scheduledTime && (
          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
            <Clock size={10} />
            <span>{formatTime(task.scheduledTime)}</span>
            <span className="text-gray-600">·</span>
            <span>{task.durationMinutes}m</span>
          </div>
        )}
      </div>

      {/* Start Button (for planned tasks) */}
      {task.status === 'planned' && (
        <button
          onClick={onStart}
          className="flex-shrink-0 px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
        >
          Start
        </button>
      )}

      {/* In Progress Indicator */}
      {isInProgress && (
        <span className="flex-shrink-0 text-xs text-blue-400 animate-pulse">
          In progress
        </span>
      )}
    </div>
  );
};

// ============================================================================
// TODAY SECTION COMPONENT
// ============================================================================

const TodaySection: React.FC<TodaySectionProps> = ({ tasks }) => {
  const { updateTaskStatus } = useProjectStore();

  const handleStartTask = (taskId: string) => {
    updateTaskStatus(taskId, 'in_progress');
  };

  const handleCompleteTask = (taskId: string) => {
    updateTaskStatus(taskId, 'completed');
  };

  if (tasks.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-gray-600 italic">
        No tasks scheduled for today.
      </div>
    );
  }

  // Sort tasks: in_progress first, then by scheduled time
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    if (a.scheduledTime && b.scheduledTime) {
      return a.scheduledTime.localeCompare(b.scheduledTime);
    }
    return 0;
  });

  return (
    <div className="px-2 py-1 space-y-1">
      {sortedTasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onStart={() => handleStartTask(task.id)}
          onComplete={() => handleCompleteTask(task.id)}
        />
      ))}
    </div>
  );
};

export default TodaySection;
