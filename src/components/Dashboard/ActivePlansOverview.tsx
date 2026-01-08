import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, ChevronRight } from 'lucide-react';
import { memoryService } from '@/services/memoryService';
import { getNYDate, getNYDateString, formatNYDateRange } from '@/utils/timezone';
import type { CondensedPlan, PlanMemory, DailyTaskEntry } from '@/types/memory';

interface ActivePlansOverviewProps {
    onPlanClick?: (planId: string) => void;
}

// Calculate progress based on actual dates
interface ProgressInfo {
    percentage: number;
    status: 'not_started' | 'in_progress' | 'completed';
    label: string;
    daysRemaining?: number;
    currentDay?: number;
    totalDays?: number;
}

const getProgressInfo = (plan: CondensedPlan): ProgressInfo => {
    const start = new Date(plan.startDate + 'T12:00:00');
    const end = new Date(plan.endDate + 'T12:00:00');
    const today = getNYDate();
    const todayStr = getNYDateString();

    // Get day names for counting study days
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // PRIORITY 1: Use totalLessons from archive file (most accurate)
    // PRIORITY 2: Use schedule.dates (AI-computed lesson dates)
    // PRIORITY 3: Count study days from date range (legacy fallback)

    const totalDays = plan.totalLessons || plan.schedule?.dates?.length || 0;

    // If we have totalLessons or schedule.dates, use schedule-based logic
    if (totalDays > 0 && plan.schedule?.dates && plan.schedule.dates.length > 0) {
        // Check if plan hasn't started
        if (today < new Date(plan.schedule.dates[0] + 'T00:00:00')) {
            const firstDate = new Date(plan.schedule.dates[0]);
            const daysUntilStart = Math.ceil((firstDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return {
                percentage: 0,
                status: 'not_started',
                label: `Starts ${firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                daysRemaining: daysUntilStart,
                totalDays: totalDays,
            };
        }

        // Find current day position in schedule
        const lastStudyDate = plan.schedule.dates[plan.schedule.dates.length - 1];

        if (today > new Date(lastStudyDate + 'T23:59:59')) {

            // Completed
            return {
                percentage: 100,
                status: 'completed',
                label: 'Completed',
                totalDays: totalDays,
            };
        }

        // In progress - find which day we're on
        let currentDay = 0;
        for (let i = 0; i < plan.schedule.dates.length; i++) {
            if (plan.schedule.dates[i] <= todayStr) {
                currentDay = i + 1;
            }
        }

        const remainingDays = totalDays - currentDay;
        const percentage = Math.min(100, Math.round((currentDay / totalDays) * 100));

        return {
            percentage,
            status: 'in_progress',
            label: `Day ${currentDay} of ${totalDays}`,
            currentDay: currentDay,
            totalDays: totalDays,
            daysRemaining: remainingDays,
        };
    }

    // FALLBACK: Use studyDays calculation (legacy plans without schedule.dates)
    const studyDays = (plan.studyDays && plan.studyDays.length > 0)
        ? plan.studyDays
        : dayNames;

    const countStudyDays = (fromDate: Date, toDate: Date): number => {
        let count = 0;
        const current = new Date(fromDate);
        while (current <= toDate) {
            const dayName = dayNames[current.getDay()];
            if (studyDays.includes(dayName)) {
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    };

    const totalStudyDays = countStudyDays(start, end);

    if (today < start) {
        const daysUntilStart = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
            percentage: 0,
            status: 'not_started',
            label: `Starts ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            daysRemaining: daysUntilStart,
            totalDays: totalStudyDays,
        };
    }

    if (today > end) {
        return {
            percentage: 100,
            status: 'completed',
            label: 'Completed',
            totalDays: totalStudyDays,
        };
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const completedStudyDays = countStudyDays(start, yesterday);
    const todayDayName = dayNames[today.getDay()];
    const isTodayStudyDay = studyDays.includes(todayDayName);
    const currentStudyDay = isTodayStudyDay ? completedStudyDays + 1 : completedStudyDays;

    const remainingStudyDays = totalStudyDays - currentStudyDay;
    const percentage = Math.min(100, Math.round((currentStudyDay / totalStudyDays) * 100));

    return {
        percentage,
        status: 'in_progress',
        label: `Day ${currentStudyDay} of ${totalStudyDays}`,
        currentDay: currentStudyDay,
        totalDays: totalStudyDays,
        daysRemaining: remainingStudyDays,
    };
};


// Get status color
const getStatusColor = (status: string, progressStatus: string) => {
    if (progressStatus === 'not_started') return '#6e7681';
    if (progressStatus === 'completed') return '#8b5cf6';
    switch (status) {
        case 'active': return '#3fb950';
        case 'paused': return '#f59e0b';
        default: return '#6e7681';
    }
};

// Use formatNYDateRange from timezone utilities
const formatDateRange = formatNYDateRange;



const ActivePlansOverview: React.FC<ActivePlansOverviewProps> = ({ onPlanClick }) => {
    const [planMemory, setPlanMemory] = useState<PlanMemory | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            const memory = await memoryService.loadPlanMemory();

            // Fetch totalLessons from archive files for each active plan
            if (memory?.activePlans) {
                const plansWithLessons = await Promise.all(
                    memory.activePlans.map(async (plan) => {
                        if (plan.archivePath && !plan.totalLessons) {
                            const lessonCount = await memoryService.getTotalLessonsFromArchive(plan.archivePath);
                            return { ...plan, totalLessons: lessonCount || undefined };
                        }
                        return plan;
                    })
                );
                memory.activePlans = plansWithLessons;
            }

            setPlanMemory(memory);
        } catch (error) {
            console.error('Failed to load plans:', error);
        } finally {

            setIsLoading(false);
        }
    };

    // Get today's task for a specific plan
    const getTodayTask = (planId: string): DailyTaskEntry | undefined => {
        if (!planMemory?.thisWeek?.dailyTasks) return undefined;
        const today = new Date();
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayName = dayNames[today.getDay()];
        return planMemory.thisWeek.dailyTasks.find(
            t => t.planId === planId && t.day === todayName
        );
    };

    if (isLoading) {
        return (
            <div className="active-plans-overview loading">
                <div className="loading-pulse" />
            </div>
        );
    }

    if (!planMemory || planMemory.activePlans.length === 0) {
        return (
            <div className="active-plans-overview empty">
                <Calendar size={18} className="text-gray-600" />
                <span className="text-[13px] text-gray-500">No active plans</span>
            </div>
        );
    }

    const activePlans = planMemory.activePlans.filter(p => p.status === 'active');

    return (
        <div className="active-plans-overview">
            <div className="overview-header">
                <TrendingUp size={14} className="text-green-400" />
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                    Active Plans ({activePlans.length})
                </span>
            </div>

            <div className="plans-grid">
                {activePlans
                    .slice(0, 3) // Show max 3 plans
                    .map(plan => {
                        const progress = getProgressInfo(plan);
                        const todayTask = getTodayTask(plan.id);
                        const statusColor = getStatusColor(plan.status, progress.status);

                        return (
                            <div
                                key={plan.id}
                                className={`plan-card ${progress.status}`}
                                onClick={() => onPlanClick?.(plan.id)}
                            >
                                <div className="plan-card-header">
                                    <span className="plan-id" style={{ color: statusColor }}>
                                        {plan.id}
                                    </span>
                                    <span className="plan-name">{plan.name}</span>
                                </div>

                                <div className="plan-card-progress">
                                    <div className="progress-bar-bg">
                                        <div
                                            className="progress-bar-fill"
                                            style={{
                                                width: `${progress.percentage}%`,
                                                backgroundColor: statusColor,
                                            }}
                                        />
                                    </div>
                                    <span className="progress-text" style={{ color: statusColor }}>
                                        {progress.label}
                                    </span>
                                </div>

                                <div className="plan-card-meta">
                                    <Calendar size={10} className="text-gray-600" />
                                    <span className="text-[10px] text-gray-500">
                                        {formatDateRange(plan.startDate, plan.endDate)} • {plan.dailyHours}h/day
                                    </span>
                                    <ChevronRight size={10} className="text-gray-600 ml-auto" />
                                </div>

                                {/* Today's task if scheduled */}
                                {todayTask && (
                                    <div className="plan-today-task">
                                        <span className="text-[10px] text-green-400">
                                            → Today: {todayTask.topic}
                                        </span>
                                    </div>
                                )}

                                {/* If not started, show countdown */}
                                {progress.status === 'not_started' && progress.daysRemaining && (
                                    <div className="plan-countdown">
                                        <span className="text-[10px] text-gray-500">
                                            in {progress.daysRemaining} day{progress.daysRemaining > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                )}

                                {/* Current week theme for in-progress */}
                                {progress.status === 'in_progress' && !todayTask && (
                                    <div className="plan-current-theme">
                                        <span className="text-[10px] text-gray-400">
                                            → {plan.weeklyThemes.find(t => t.status === 'current')?.theme || 'Week ' + plan.currentWeek}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
            </div>

            {/* This Week Preview */}
            {planMemory.thisWeek && (
                <div className="this-week-preview">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                        This Week: {planMemory.thisWeek.weekRange}
                    </span>
                </div>
            )}
        </div>
    );
};

export default ActivePlansOverview;
