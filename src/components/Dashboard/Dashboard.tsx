import React, { useEffect, useState } from 'react';
import { useDashboardStore, useTodayProgress } from '@/store/dashboardStore';
import { useProjectStore } from '@/store/projectStore';
import { memoryService } from '@/services/memoryService';
import { Upload } from 'lucide-react';
import TodayPlan from './TodayPlan';
import TomorrowPlan from './TomorrowPlan';
import ReflectionSection from './ReflectionSection';
import SecretaryPanel from './SecretaryPanel';
import RoadmapImportModal from './RoadmapImportModal';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const {
    todayPlan,
    tomorrowPlan,
    showTomorrowPlan,
    showReflection,
    roadmapDay,
    activeRoadmapId,
    isGeneratingPlan,
    initializeSampleData,
    generateTodayPlanAsync,
    generateTomorrowPlanAsync,
    hasActiveRoadmap,
    checkTimeBasedVisibility,
    transitionToNewDay,
  } = useDashboardStore();

  const { getProjectById } = useProjectStore();
  const todayProgress = useTodayProgress();

  // Get active project info
  const activeProject = activeRoadmapId ? getProjectById(activeRoadmapId) : null;

  // Initialize memory files and sync with dashboard
  useEffect(() => {
    const initializeMemory = async () => {
      try {
        // Initialize default files if they don't exist
        await memoryService.initializeDefaultFiles(activeRoadmapId || undefined);

        // Sync daily memory with dashboard
        await memoryService.syncDailyToDashboard();
      } catch (error) {
        console.error('Failed to initialize memory:', error);
      }
    };

    initializeMemory();
  }, [activeRoadmapId]);

  // Initialize plans - use AI if roadmap exists, otherwise sample data
  useEffect(() => {
    const initializePlans = async () => {
      if (isInitialized || todayPlan) return;

      try {
        // Check if we have an active roadmap for AI generation
        if (activeRoadmapId) {
          const hasRoadmap = await hasActiveRoadmap(activeRoadmapId);

          if (hasRoadmap) {
            // Generate today's plan from roadmap
            console.log('🚀 [Dashboard] Generating AI-powered daily plan...');
            await generateTodayPlanAsync(activeRoadmapId);

            // Generate tomorrow's plan if visible
            if (showTomorrowPlan && !tomorrowPlan) {
              await generateTomorrowPlanAsync(activeRoadmapId);
            }
          } else {
            // No roadmap yet - use sample data for demo
            console.log('📋 [Dashboard] No roadmap found, using sample data');
            initializeSampleData();
          }
        } else {
          // No project selected - use sample data
          initializeSampleData();
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize plans:', error);
        initializeSampleData();
        setIsInitialized(true);
      }
    };

    initializePlans();
  }, [
    activeRoadmapId,
    todayPlan,
    tomorrowPlan,
    showTomorrowPlan,
    isInitialized,
    hasActiveRoadmap,
    generateTodayPlanAsync,
    generateTomorrowPlanAsync,
    initializeSampleData,
  ]);

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
          <button
            className="header-import-btn"
            onClick={() => setShowImportModal(true)}
          >
            <Upload className="w-4 h-4" />
            Import Roadmap
          </button>
          <span className="dashboard-date">{formatDate()}</span>
        </div>
      </header>

      {/* Main Content - Two Columns */}
      <div className="dashboard-content">
        {/* Left Column - Plans & Reflection */}
        <div className="dashboard-left">
          {/* Today's Plan */}
          <TodayPlan
            plan={todayPlan}
            progress={todayProgress}
            onImportClick={() => setShowImportModal(true)}
            isGenerating={isGeneratingPlan}
          />

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

      {/* Roadmap Import Modal */}
      <RoadmapImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        projectId={activeRoadmapId || 'default-project'}
      />
    </div>
  );
};

export default Dashboard;
