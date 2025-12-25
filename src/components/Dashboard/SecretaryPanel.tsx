import React from 'react';
import { useDashboardStore, useCurrentTask } from '@/store/dashboardStore';
import PDFGallery from './PDFGallery';
import KnowledgeGraphWidget from './KnowledgeGraphWidget';
import {
  Flame,
  Clock,
  Target,
  TrendingUp,
  Play,
  RotateCcw,
  Lightbulb,
  Calendar,
  ChevronRight,
} from 'lucide-react';

const SecretaryPanel: React.FC = () => {
  const {
    streak,
    totalHoursLearned,
    weeklyProgress,
    roadmapDay,
    roadmapTotalDays,
    roadmapProgress,
    currentInsight,
    updateTaskStatus,
  } = useDashboardStore();

  const currentTask = useCurrentTask();

  // Calculate circular progress path
  const getCircleProgress = (progress: number) => {
    const circumference = 2 * Math.PI * 40; // radius = 40
    const offset = circumference - (progress / 100) * circumference;
    return { circumference, offset };
  };

  const { circumference, offset } = getCircleProgress(roadmapProgress);

  return (
    <div className="secretary-panel">
      {/* FOR YOU Header */}
      <div className="for-you-header">
        <div>
          <h2 className="for-you-title">FOR YOU</h2>
          <span className="for-you-subtitle">Personalized learning assistant</span>
        </div>
      </div>

      {/* Progress Overview */}
      <section className="secretary-section progress-overview">
        <div className="progress-circle-container">
          <svg className="progress-circle" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#21262d"
              strokeWidth="8"
            />
            {/* Progress arc */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="url(#progressGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3fb950" />
                <stop offset="100%" stopColor="#58a6ff" />
              </linearGradient>
            </defs>
          </svg>
          <div className="progress-circle-content">
            <span className="progress-percent">{roadmapProgress}%</span>
            <span className="progress-label">Complete</span>
          </div>
        </div>

        <div className="progress-stats">
          <div className="stat-item">
            <div className="stat-icon streak">
              <Flame className="w-4 h-4" />
            </div>
            <div className="stat-content">
              <span className="stat-value">{streak}</span>
              <span className="stat-label">Day Streak</span>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon hours">
              <Clock className="w-4 h-4" />
            </div>
            <div className="stat-content">
              <span className="stat-value">{totalHoursLearned}h</span>
              <span className="stat-label">Total Hours</span>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon days">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="stat-content">
              <span className="stat-value">{roadmapDay}/{roadmapTotalDays}</span>
              <span className="stat-label">Days</span>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon weekly">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="stat-content">
              <span className="stat-value">{weeklyProgress}%</span>
              <span className="stat-label">This Week</span>
            </div>
          </div>
        </div>
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

          <button className="quick-action-btn">
            <RotateCcw className="w-4 h-4" />
            <span>Review Yesterday</span>
            <ChevronRight className="w-4 h-4 action-arrow" />
          </button>

          <button className="quick-action-btn">
            <Target className="w-4 h-4" />
            <span>View Roadmap</span>
            <ChevronRight className="w-4 h-4 action-arrow" />
          </button>
        </div>
      </section>

      {/* Knowledge Graph Widget */}
      <KnowledgeGraphWidget />

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
    </div>
  );
};

export default SecretaryPanel;
