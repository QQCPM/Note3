import React, { useEffect } from 'react';
import { useDashboardStore, useTodayProgress } from '@/store/dashboardStore';
import { useProjectStore } from '@/store/projectStore';
import TodayPlan from './TodayPlan';
import TomorrowPlan from './TomorrowPlan';
import ReflectionSection from './ReflectionSection';
import SecretaryPanel from './SecretaryPanel';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const {
    todayPlan,
    tomorrowPlan,
    showTomorrowPlan,
    showReflection,
    roadmapDay,
    activeRoadmapId,
    initializeSampleData,
    checkTimeBasedVisibility,
    transitionToNewDay,
  } = useDashboardStore();

  const { getProjectById } = useProjectStore();
  const todayProgress = useTodayProgress();

  // Get active project info
  const activeProject = activeRoadmapId ? getProjectById(activeRoadmapId) : null;

  // Initialize sample data for demo (remove in production)
  useEffect(() => {
    if (!todayPlan) {
      initializeSampleData();
    }
  }, [todayPlan, initializeSampleData]);

  // Check time-based visibility and day transition on mount and every minute
  useEffect(() => {
    checkTimeBasedVisibility();
    transitionToNewDay(); // Check if we need to transition tomorrow -> today
    
    const interval = setInterval(() => {
      checkTimeBasedVisibility();
      transitionToNewDay();
    }, 60000);
    return () => clearInterval(interval);
  }, [checkTimeBasedVisibility, transitionToNewDay]);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Format today's date
  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <h1 className="dashboard-greeting">{getGreeting()}</h1>
          {activeProject && (
            <p className="dashboard-context">
              Day {roadmapDay} of <span className="dashboard-project-name">{activeProject.name}</span>
            </p>
          )}
        </div>
        <div className="dashboard-header-right">
          <span className="dashboard-date">{formatDate()}</span>
        </div>
      </header>

      {/* Main Content - Two Columns */}
      <div className="dashboard-content">
        {/* Left Column - Plans & Reflection */}
        <div className="dashboard-left">
          {/* Today's Plan */}
          <TodayPlan plan={todayPlan} progress={todayProgress} />

          {/* Divider */}
          <div className="dashboard-divider" />

          {/* Tomorrow's Plan (time-aware) */}
          <TomorrowPlan
            plan={tomorrowPlan}
            isVisible={showTomorrowPlan}
          />

          {/* Divider */}
          {showReflection && <div className="dashboard-divider" />}

          {/* Reflection (time-aware) */}
          <ReflectionSection isVisible={showReflection} />
        </div>

        {/* Right Column - Secretary Panel */}
        <div className="dashboard-right">
          <SecretaryPanel />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
