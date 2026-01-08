import React from 'react';
import type { PlanMemory, DailyTaskEntry } from '@/types/memory';
import { X, Calendar } from 'lucide-react';

interface ThisWeekModalProps {
    isOpen: boolean;
    onClose: () => void;
    planMemory: PlanMemory | null;
}

const ThisWeekModal: React.FC<ThisWeekModalProps> = ({ isOpen, onClose, planMemory }) => {
    if (!isOpen) return null;

    const weekDays = [
        { abbrev: 'Sun', full: 'Sunday' },
        { abbrev: 'Mon', full: 'Monday' },
        { abbrev: 'Tue', full: 'Tuesday' },
        { abbrev: 'Wed', full: 'Wednesday' },
        { abbrev: 'Thu', full: 'Thursday' },
        { abbrev: 'Fri', full: 'Friday' },
        { abbrev: 'Sat', full: 'Saturday' },
    ];

    // Get today's day name
    const today = new Date();
    const todayAbbrev = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()];

    // Group tasks by day
    const tasksByDay: Record<string, DailyTaskEntry[]> = {};
    if (planMemory?.thisWeek?.dailyTasks) {
        planMemory.thisWeek.dailyTasks.forEach(task => {
            if (!tasksByDay[task.day]) {
                tasksByDay[task.day] = [];
            }
            tasksByDay[task.day].push(task);
        });
    }

    // Generate date labels for each day of this week
    const getDateLabel = (dayIndex: number): string => {
        const startOfWeek = new Date(today);
        // Find Sunday of this week
        startOfWeek.setDate(today.getDate() - today.getDay());
        // Add dayIndex to get the target day
        const targetDate = new Date(startOfWeek);
        targetDate.setDate(startOfWeek.getDate() + dayIndex);
        return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="this-week-modal-overlay" onClick={onClose}>
            <div className="this-week-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="this-week-modal-header">
                    <div className="this-week-modal-title">
                        <Calendar className="w-5 h-5 text-blue-400" />
                        <span>THIS WEEK</span>
                        {planMemory?.thisWeek?.weekRange && (
                            <span className="this-week-modal-range">{planMemory.thisWeek.weekRange}</span>
                        )}
                    </div>
                    <button className="this-week-modal-close" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Days List */}
                <div className="this-week-modal-content">
                    {weekDays.map((day, index) => {
                        const dayTasks = tasksByDay[day.abbrev] || [];
                        const isToday = day.abbrev === todayAbbrev;
                        const isRestDay = dayTasks.length === 0;
                        const dateLabel = getDateLabel(index);

                        return (
                            <div
                                key={day.abbrev}
                                className={`this-week-day-row ${isToday ? 'today' : ''} ${isRestDay ? 'rest-day' : ''}`}
                            >
                                <div className="this-week-day-header">
                                    <span className="this-week-day-name">
                                        {day.full.toUpperCase()}
                                    </span>
                                    <span className="this-week-day-date">{dateLabel}</span>
                                    {isToday && <span className="today-badge">★ TODAY</span>}
                                </div>

                                <div className="this-week-day-tasks">
                                    {isRestDay ? (
                                        <span className="rest-day-label">Rest Day</span>
                                    ) : (
                                        dayTasks.map((task, taskIdx) => (
                                            <div key={taskIdx} className="this-week-task-item">
                                                <span className="task-plan-id">{task.planId}</span>
                                                <span className="task-topic">{task.topic}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ThisWeekModal;
