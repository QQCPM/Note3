import React, { useState } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { DailyPlan, ScheduledTask, getTaskTypeIcon, formatDuration } from '@/types/dashboard';
import {
  Circle,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  Pencil,
  X,
  Plus,
  GripVertical,
  Trash2,
} from 'lucide-react';

interface TomorrowPlanProps {
  plan: DailyPlan | null;
  isVisible: boolean;
}

const TASK_TYPES: { value: ScheduledTask['type']; label: string }[] = [
  { value: 'learn', label: 'Learn' },
  { value: 'practice', label: 'Practice' },
  { value: 'review', label: 'Review' },
  { value: 'project', label: 'Project' },
];

const TomorrowPlan: React.FC<TomorrowPlanProps> = ({ plan, isVisible }) => {
  const {
    approveTomorrowPlan,
    editTomorrowTask,
    isEditingTomorrow,
    setIsEditingTomorrow,
    addTomorrowTask,
    removeTomorrowTask,
  } = useDashboardStore();

  const [isExpanded, setIsExpanded] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    type: 'learn' as ScheduledTask['type'],
    scheduledTime: '09:00',
    durationMinutes: 30,
  });

  if (!isVisible) {
    return (
      <section className="dashboard-section collapsed">
        <div className="section-header muted">
          <h2 className="section-title">TOMORROW</h2>
          <span className="section-badge time-badge">
            <Clock className="w-3 h-3" />
            Ready at 9:00 PM
          </span>
        </div>
      </section>
    );
  }

  if (!plan) {
    return (
      <section className="dashboard-section">
        <div className="section-header">
          <h2 className="section-title">TOMORROW</h2>
          <span className="section-badge generating">Generating...</span>
        </div>
        <div className="empty-state">
          <div className="loading-shimmer" />
        </div>
      </section>
    );
  }

  const totalMinutes = plan.tasks.reduce((sum, t) => sum + t.durationMinutes, 0);

  const handleAddTask = () => {
    if (!newTask.title.trim()) return;

    addTomorrowTask({
      title: newTask.title,
      type: newTask.type,
      scheduledTime: newTask.scheduledTime,
      durationMinutes: newTask.durationMinutes,
      status: 'pending',
      aiGenerated: false,
    });

    setNewTask({
      title: '',
      type: 'learn',
      scheduledTime: '09:00',
      durationMinutes: 30,
    });
    setShowAddTask(false);
  };

  const handleStartEditing = () => {
    setIsEditingTomorrow(true);
  };

  const handleStopEditing = () => {
    setIsEditingTomorrow(false);
    setEditingTaskId(null);
    setShowAddTask(false);
  };

  return (
    <section className={`dashboard-section tomorrow ${plan.isApproved ? 'approved' : 'pending-approval'} ${isEditingTomorrow ? 'editing' : ''}`}>
      <div
        className="section-header clickable"
        onClick={() => !isEditingTomorrow && setIsExpanded(!isExpanded)}
      >
        <div className="section-header-left">
          <h2 className="section-title">TOMORROW</h2>
          {plan.isApproved ? (
            <span className="section-badge approved">
              <Check className="w-3 h-3" />
              Approved
            </span>
          ) : isEditingTomorrow ? (
            <span className="section-badge editing-badge">
              <Pencil className="w-3 h-3" />
              Editing
            </span>
          ) : (
            <span className="section-badge pending">
              Pending review
            </span>
          )}
        </div>
        <div className="section-header-right">
          <span className="section-meta">{formatDuration(totalMinutes)}</span>
          {!isEditingTomorrow && (
            isExpanded ? (
              <ChevronUp className="w-4 h-4 text-[#7d8590]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#7d8590]" />
            )
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Task list */}
          <div className="task-list tomorrow-tasks">
            {plan.tasks.map((task) => (
              <div
                key={task.id}
                className={`task-item tomorrow ${editingTaskId === task.id ? 'task-editing' : ''}`}
              >
                {isEditingTomorrow && (
                  <div className="task-drag-handle">
                    <GripVertical className="w-4 h-4 text-[#30363d]" />
                  </div>
                )}

                <div className="task-status-icon">
                  <Circle className="w-4 h-4 text-[#30363d]" />
                </div>

                {editingTaskId === task.id ? (
                  // Full edit mode for this task
                  <div className="task-edit-form">
                    <input
                      type="time"
                      className="task-edit-time"
                      value={task.scheduledTime}
                      onChange={(e) => editTomorrowTask(task.id, { scheduledTime: e.target.value })}
                    />
                    <input
                      type="text"
                      className="task-edit-input"
                      value={task.title}
                      onChange={(e) => editTomorrowTask(task.id, { title: e.target.value })}
                      autoFocus
                    />
                    <select
                      className="task-edit-type"
                      value={task.type}
                      onChange={(e) => editTomorrowTask(task.id, { type: e.target.value as ScheduledTask['type'] })}
                    >
                      {TASK_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="task-edit-duration"
                      value={task.durationMinutes}
                      onChange={(e) => editTomorrowTask(task.id, { durationMinutes: parseInt(e.target.value) || 15 })}
                      min={5}
                      step={5}
                    />
                    <span className="task-edit-duration-label">min</span>
                    <button
                      className="task-edit-done"
                      onClick={() => setEditingTaskId(null)}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  // Normal display mode
                  <>
                    <div className="task-time">
                      {task.scheduledTime}
                    </div>

                    <div className="task-content">
                      <div className="task-title-row">
                        <span className="task-type-icon">{getTaskTypeIcon(task.type)}</span>
                        <span className="task-title">{task.title}</span>
                      </div>
                      {task.aiReason && !isEditingTomorrow && (
                        <p className="task-ai-reason">{task.aiReason}</p>
                      )}
                    </div>

                    <div className="task-duration">
                      {formatDuration(task.durationMinutes)}
                    </div>

                    {isEditingTomorrow && (
                      <div className="task-edit-actions">
                        <button
                          className="task-edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTaskId(task.id);
                          }}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          className="task-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTomorrowTask(task.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {!isEditingTomorrow && !plan.isApproved && (
                      <button
                        className="task-edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditing();
                          setEditingTaskId(task.id);
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}

            {/* Add Task Form */}
            {showAddTask && (
              <div className="task-item add-task-form">
                <div className="task-drag-handle invisible">
                  <GripVertical className="w-4 h-4" />
                </div>
                <div className="task-status-icon">
                  <Plus className="w-4 h-4 text-[#58a6ff]" />
                </div>
                <div className="task-edit-form">
                  <input
                    type="time"
                    className="task-edit-time"
                    value={newTask.scheduledTime}
                    onChange={(e) => setNewTask({ ...newTask, scheduledTime: e.target.value })}
                  />
                  <input
                    type="text"
                    className="task-edit-input"
                    placeholder="Task title..."
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTask();
                      if (e.key === 'Escape') setShowAddTask(false);
                    }}
                  />
                  <select
                    className="task-edit-type"
                    value={newTask.type}
                    onChange={(e) => setNewTask({ ...newTask, type: e.target.value as ScheduledTask['type'] })}
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="task-edit-duration"
                    value={newTask.durationMinutes}
                    onChange={(e) => setNewTask({ ...newTask, durationMinutes: parseInt(e.target.value) || 15 })}
                    min={5}
                    step={5}
                  />
                  <span className="task-edit-duration-label">min</span>
                  <button
                    className="task-edit-done"
                    onClick={handleAddTask}
                    disabled={!newTask.title.trim()}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    className="task-edit-cancel"
                    onClick={() => setShowAddTask(false)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Add Task Button */}
            {isEditingTomorrow && !showAddTask && (
              <button
                className="add-task-btn"
                onClick={() => setShowAddTask(true)}
              >
                <Plus className="w-4 h-4" />
                Add task
              </button>
            )}
          </div>

          {/* Actions */}
          {!plan.isApproved && (
            <div className="tomorrow-actions">
              {isEditingTomorrow ? (
                <>
                  <button
                    className="tomorrow-approve-btn"
                    onClick={() => {
                      handleStopEditing();
                      approveTomorrowPlan();
                    }}
                  >
                    <Check className="w-4 h-4" />
                    Save & Approve
                  </button>
                  <button
                    className="tomorrow-edit-btn"
                    onClick={handleStopEditing}
                  >
                    Done editing
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="tomorrow-approve-btn"
                    onClick={approveTomorrowPlan}
                  >
                    <Check className="w-4 h-4" />
                    Looks good
                  </button>
                  <button
                    className="tomorrow-edit-btn"
                    onClick={handleStartEditing}
                  >
                    Edit plan
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default TomorrowPlan;
