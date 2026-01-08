import React, { useEffect, useState } from 'react';
import { useDashboardStore, useCurrentTask } from '@/store/dashboardStore';
import { memoryService } from '@/services/memoryService';
import type { PlanMemory, DailyTaskEntry } from '@/types/memory';
import PDFGallery from './PDFGallery';
import ThisWeekModal from './ThisWeekModal';
import {
  Play,
  Lightbulb,
  ChevronRight,
  BookOpen,
  Calendar,
} from 'lucide-react';

const SecretaryPanel: React.FC = () => {
  const { currentInsight, updateTaskStatus } = useDashboardStore();
  const currentTask = useCurrentTask();

  const [planMemory, setPlanMemory] = useState<PlanMemory | null>(null);
  const [todaysFocus, setTodaysFocus] = useState<DailyTaskEntry[]>([]);
  const [showThisWeekModal, setShowThisWeekModal] = useState(false);

  // Load Plan.md data on mount
  useEffect(() => {
    const loadPlanData = async () => {
      try {
        const memory = await memoryService.loadPlanMemory();
        setPlanMemory(memory);

        // Find today's tasks from This Week section
        if (memory?.thisWeek?.dailyTasks) {
          const today = new Date();
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const todayName = dayNames[today.getDay()];

          let todayTasks = memory.thisWeek.dailyTasks.filter(
            t => t.day === todayName
          );

          // Fetch totalLessons from archive for each task if not already set
          if (memory.activePlans) {
            todayTasks = await Promise.all(
              todayTasks.map(async (task) => {
                // Find the plan for this task
                const plan = memory.activePlans.find(p => p.id === task.planId);
                if (plan?.archivePath && !task.totalSessions) {
                  const lessonCount = await memoryService.getTotalLessonsFromArchive(plan.archivePath);
                  return { ...task, totalSessions: lessonCount || undefined };
                }
                return task;
              })
            );
          }

          setTodaysFocus(todayTasks);
        }
      } catch (error) {
        console.error('[SecretaryPanel] Failed to load Plan.md:', error);
      }
    };

    loadPlanData();
  }, []);


  // Get week days for calendar
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Group daily tasks by day
  const tasksByDay: Record<string, DailyTaskEntry[]> = {};
  planMemory?.thisWeek?.dailyTasks?.forEach(task => {
    if (!tasksByDay[task.day]) {
      tasksByDay[task.day] = [];
    }
    tasksByDay[task.day].push(task);
  });

  // Get today's day name
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayName = dayNames[today.getDay()];

  return (
    <div className="secretary-panel">
      {/* FOR YOU Header */}
      <div className="for-you-header">
        <div>
          <h2 className="for-you-title">FOR YOU</h2>
          <span className="for-you-subtitle">Personalized learning assistant</span>
        </div>
      </div>

      {/* Today's Focus - from Plan.md This Week */}
      <section className="secretary-section today-focus">
        <div className="today-focus-header">
          <BookOpen className="w-4 h-4 text-green-400" />
          <span className="section-label">TODAY'S FOCUS</span>
        </div>

        {todaysFocus.length > 0 ? (
          <div className="today-focus-list">
            {todaysFocus.map((task, idx) => (
              <div key={idx} className="today-focus-item">
                <span className="focus-plan-id">{task.planId}</span>
                <span className="focus-topic">
                  {task.dayNumber && task.totalSessions
                    ? `Day ${task.dayNumber} of ${task.totalSessions}: ${task.topic}`
                    : task.topic}
                </span>
              </div>
            ))}
          </div>

        ) : (
          <div className="today-focus-empty">
            <span className="text-[#6e7681] text-sm">
              {todayName === 'Sat' || todayName === 'Sun'
                ? '🎉 Weekend - No study scheduled'
                : 'No tasks scheduled for today'}
            </span>
          </div>
        )}
      </section>

      {/* Weekly Calendar - from This Week section - CLICKABLE */}
      <section
        className="secretary-section weekly-calendar clickable"
        onClick={() => setShowThisWeekModal(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setShowThisWeekModal(true)}
      >
        <div className="weekly-calendar-header">
          <Calendar className="w-4 h-4 text-blue-400" />
          <span className="section-label">THIS WEEK</span>
          {planMemory?.thisWeek && (
            <span className="week-range">{planMemory.thisWeek.weekRange}</span>
          )}
        </div>

        <div className="week-grid">
          {weekDays.map(day => {
            const dayTasks = tasksByDay[day] || [];
            const isToday = day === todayName;
            const hasStudy = dayTasks.length > 0;

            return (
              <div
                key={day}
                className={`week-day ${isToday ? 'today' : ''} ${hasStudy ? 'has-study' : ''}`}
              >
                <span className="week-day-name">{day}</span>
                <div className="week-day-content">
                  {dayTasks.length > 0 ? (
                    dayTasks.map((task, i) => (
                      <span key={i} className="week-day-plan" title={task.topic}>
                        {task.planId}
                      </span>
                    ))
                  ) : (
                    <span className="week-day-empty">-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="week-click-hint">Click to expand</div>
      </section>

      {/* Quick Actions */}
      <section className="secretary-section quick-actions">
        <h3 className="section-label">QUICK ACTIONS</h3>
        <div className="quick-actions-list">
          {currentTask && (
            <button
              className="quick-action-btn primary"
              onClick={() => {
                if (currentTask.status === 'pending') {
                  updateTaskStatus(currentTask.id, 'in_progress', true);
                } else if (currentTask.status === 'in_progress') {
                  updateTaskStatus(currentTask.id, 'completed', true);
                }
              }}
            >
              <Play className="w-4 h-4" />
              <span>
                {currentTask.status === 'in_progress' ? 'Complete Current' : 'Start Next Task'}
              </span>
              <ChevronRight className="w-4 h-4 action-arrow" />
            </button>
          )}
        </div>
      </section>

      {/* PDF Gallery */}
      <PDFGallery />

      {/* AI Insight */}
      {currentInsight && !currentInsight.dismissed && (
        <section className="secretary-section ai-insight-section">
          <div className="ai-insight-card">
            <div className="ai-insight-header">
              <Lightbulb className="w-4 h-4" />
              <span>AI Insight</span>
            </div>
            <p className="ai-insight-content">{currentInsight.content}</p>
          </div>
        </section>
      )}

      {/* This Week Modal */}
      <ThisWeekModal
        isOpen={showThisWeekModal}
        onClose={() => setShowThisWeekModal(false)}
        planMemory={planMemory}
      />
    </div>
  );
};

export default SecretaryPanel;

