import React from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { DailyPlan, ScheduledTask, getTaskTypeIcon, formatDuration } from '@/types/dashboard';
import { Check, Circle, Play, SkipForward } from 'lucide-react';

interface TodayPlanProps {
  plan: DailyPlan | null;
  progress: number;
}

const TodayPlan: React.FC<TodayPlanProps> = ({ plan, progress }) => {
  const { updateTaskStatus } = useDashboardStore();

  if (!plan) {
    return (
      <section className="dashboard-section">
        <div className="section-header">
          <h2 className="section-title">TODAY</h2>
        </div>
        <div className="empty-state">
          <p>No plan for today yet.</p>
        </div>
      </section>
    );
  }

  const handleTaskAction = (task: ScheduledTask, action: 'start' | 'complete' | 'skip') => {
    switch (action) {
      case 'start':
        updateTaskStatus(task.id, 'in_progress', true);
        break;
      case 'complete':
        updateTaskStatus(task.id, 'completed', true);
        break;
      case 'skip':
        updateTaskStatus(task.id, 'skipped', true);
        break;
    }
  };

  const getStatusIcon = (status: ScheduledTask['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-[#3fb950]" />;
      case 'in_progress':
        return <Play className="w-3.5 h-3.5 text-[#58a6ff] fill-[#58a6ff]" />;
      case 'skipped':
        return <SkipForward className="w-4 h-4 text-[#7d8590]" />;
      default:
        return <Circle className="w-4 h-4 text-[#30363d]" />;
    }
  };

  const completedCount = plan.tasks.filter(t => t.status === 'completed').length;
  const totalCount = plan.tasks.length;

  return (
    <section className="dashboard-section">
      <div className="section-header">
        <h2 className="section-title">TODAY</h2>
        <span className="section-meta">
          {completedCount}/{totalCount} completed
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Task list */}
      <div className="task-list">
        {plan.tasks.map((task, index) => {
          const isCurrentTask = task.status === 'in_progress' ||
            (task.status === 'pending' && plan.tasks.slice(0, index).every(t => t.status === 'completed' || t.status === 'skipped'));

          return (
            <div
              key={task.id}
              className={`task-item ${task.status} ${isCurrentTask ? 'current' : ''}`}
            >
              <div className="task-status-icon">
                {getStatusIcon(task.status)}
              </div>

              <div className="task-time">
                {task.scheduledTime}
              </div>

              <div className="task-content">
                <div className="task-title-row">
                  <span className="task-type-icon">{getTaskTypeIcon(task.type)}</span>
                  <span className="task-title">{task.title}</span>
                </div>
                {task.description && (
                  <p className="task-description">{task.description}</p>
                )}
              </div>

              <div className="task-duration">
                {formatDuration(task.durationMinutes)}
              </div>

              {/* Action buttons for current task */}
              {isCurrentTask && task.status !== 'completed' && (
                <div className="task-actions">
                  {task.status === 'pending' ? (
                    <button
                      onClick={() => handleTaskAction(task, 'start')}
                      className="task-action-btn start"
                    >
                      Start
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTaskAction(task, 'complete')}
                      className="task-action-btn complete"
                    >
                      Done
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default TodayPlan;
