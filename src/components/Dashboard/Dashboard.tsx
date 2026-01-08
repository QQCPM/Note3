import React, { useEffect, useState } from 'react';
import { useDashboardStore, useTodayProgress } from '@/store/dashboardStore';
import { useAIStore } from '@/store/aiStore';
import { useNotesStore } from '@/store';
import { memoryService } from '@/services/memoryService';
import type { DailyTaskEntry } from '@/types/memory';
import { Calendar, Loader2 } from 'lucide-react';
import TodayPlan from './TodayPlan';
import TomorrowPlan from './TomorrowPlan';
import ReflectionSection from './ReflectionSection';
import SecretaryPanel from './SecretaryPanel';
import ActivePlansOverview from './ActivePlansOverview';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPreparingTomorrow, setIsPreparingTomorrow] = useState(false);
  const [todaysFocus, setTodaysFocus] = useState<DailyTaskEntry[]>([]);
  const [activePlanCount, setActivePlanCount] = useState(0);

  const {
    todayPlan,
    tomorrowPlan,
    showTomorrowPlan,
    showReflection,
    activeRoadmapId,
    isGeneratingPlan,
    initializeSampleData,
    hasActiveRoadmap,
    checkTimeBasedVisibility,
    transitionToNewDay,
  } = useDashboardStore();

  const { switchSession } = useAIStore();
  const { setActiveNote } = useNotesStore();
  const todayProgress = useTodayProgress();

  // Load Plan.md for Today's Focus header
  useEffect(() => {
    const loadPlanData = async () => {
      try {
        const memory = await memoryService.loadPlanMemory();
        if (memory) {
          setActivePlanCount(memory.activePlans?.filter(p => p.status === 'active').length ?? 0);

          // Find today's tasks from This Week section
          if (memory.thisWeek?.dailyTasks) {
            const today = new Date();
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const todayName = dayNames[today.getDay()];
            const todayTasks = memory.thisWeek.dailyTasks.filter(t => t.day === todayName);
            setTodaysFocus(todayTasks);
          }
        }
      } catch (error) {
        console.error('[Dashboard] Failed to load Plan.md for header:', error);
      }
    };
    loadPlanData();
  }, []);

  // Clear active note AND AI session when entering Dashboard (use global session)
  useEffect(() => {
    setActiveNote(null);   // Clear note context from AI footer
    switchSession(null);   // Use global AI session
  }, [setActiveNote, switchSession]);

  // Initialize memory files and sync with dashboard
  useEffect(() => {
    const initializeMemory = async () => {
      try {
        // CRITICAL: Clean up stale todayPlan from localStorage FIRST
        // This ensures TODAY section is empty if there's no plan for today
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const storeState = useDashboardStore.getState();
        const currentTodayPlan = storeState.todayPlan;

        if (currentTodayPlan) {
          // Check if todayPlan.date matches today (handles both YYYY-MM-DD and legacy formats)
          const storedDate = currentTodayPlan.date;
          const isForToday = storedDate === todayStr || storedDate.includes(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }));

          if (!isForToday) {
            console.log('🧹 [Dashboard] Clearing stale todayPlan (was for:', storedDate, ', today is:', todayStr, ')');
            storeState.setTodayPlan(null);
          }
        }

        // Initialize default files if they don't exist
        await memoryService.initializeDefaultFiles(activeRoadmapId || undefined);

        // Sync daily memory with dashboard (will route to correct slot based on date)
        await memoryService.syncDailyToDashboard();
      } catch (error) {
        console.error('Failed to initialize memory:', error);
      }
    };

    initializeMemory();
  }, [activeRoadmapId]);

  // Initialize plans - check if we have active plans, otherwise use sample data
  useEffect(() => {
    const initializePlans = async () => {
      if (isInitialized) return;

      try {
        // Check if we have active plans in Plan.md (new LangGraph Secretary system)
        const hasRoadmap = await hasActiveRoadmap(activeRoadmapId || '');

        if (hasRoadmap) {
          // We have active plans - initializeMemory already synced Daily.md
          // Just check the current state
          const state = useDashboardStore.getState();
          console.log('📋 [Dashboard] Plan state after sync:', {
            todayPlan: state.todayPlan?.date || 'null',
            tomorrowPlan: state.tomorrowPlan?.date || 'null',
          });

          if (!state.todayPlan && !state.tomorrowPlan) {
            console.log('📋 [Dashboard] No Daily.md content yet - rest day or pending generation');
          }
        } else {
          // No active plans - use sample data for demo
          console.log('📋 [Dashboard] No active plans in Plan.md, using sample data');
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
    isInitialized,
    hasActiveRoadmap,
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

  // Handle "Prepare Tomorrow's Plan" button click
  const handlePrepareTomorrow = async () => {
    setIsPreparingTomorrow(true);
    try {
      // Archive current Daily.md to History/
      await memoryService.archiveDailyPlan();
      console.log('📅 [Dashboard] Archived current Daily.md');

      // Import secretary and invoke directly
      const { streamSecretary } = await import('@/services/langgraph/secretaryGraph');

      // Calculate tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });

      // Send request to AI secretary
      const userMessage = `Prepare my study plan for tomorrow (${tomorrowStr}). Read my active plans from Plan.md, check what's scheduled for tomorrow in the This Week section, then generate a detailed time-blocked schedule and write it to Daily.md.`;

      console.log('🤖 [Dashboard] Requesting AI to generate tomorrow plan...');

      // Stream the response (secretary handles tool calls internally)
      await streamSecretary(
        userMessage,
        'dashboard-secretary',
        (chunk) => {
          // Chunks are streamed - we could display them if needed
          console.log('[Secretary chunk]', chunk);
        }
      );

      // Reload Daily.md and sync to dashboard
      await memoryService.syncDailyToDashboard();
      console.log('✅ [Dashboard] Tomorrow\'s plan generated and synced');

    } catch (error) {
      console.error('Failed to prepare tomorrow\'s plan:', error);
    } finally {
      setIsPreparingTomorrow(false);
    }
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <h1 className="dashboard-greeting">{getGreeting()}</h1>
          {activePlanCount > 0 ? (
            <p className="dashboard-context">
              {todaysFocus.length > 0 ? (
                <>
                  Today: <span className="dashboard-project-name">
                    {todaysFocus.map(t => `${t.planId} - ${t.topic}`).join(' • ')}
                  </span>
                </>
              ) : (
                <>No plans scheduled for today</>
              )}
            </p>
          ) : (
            <p className="dashboard-context">Get started by importing a learning roadmap</p>
          )}
        </div>
        <div className="dashboard-header-right">
          <button
            className="header-prepare-btn"
            onClick={handlePrepareTomorrow}
            disabled={isPreparingTomorrow}
          >
            {isPreparingTomorrow ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            {isPreparingTomorrow ? 'Preparing...' : 'Prepare Tomorrow'}
          </button>
          <span className="dashboard-date">{formatDate()}</span>
        </div>
      </header>

      {/* Active Plans Overview - Condensed View */}
      <ActivePlansOverview />

      {/* Main Content - Two Columns */}
      <div className="dashboard-content">
        {/* Left Column - Plans & Reflection */}
        <div className="dashboard-left">
          {/* Today's Plan */}
          <TodayPlan
            plan={todayPlan}
            progress={todayProgress}
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
    </div>
  );
};

export default Dashboard;
