import React, { useState, useEffect, useRef } from 'react';
import { Target, Plus, Trash2, ChevronDown, Calendar } from 'lucide-react';

type GoalStatus = 'not_started' | 'in_progress' | 'done';
type GoalPriority = 'low' | 'medium' | 'high';

interface ProjectGoal {
    id: string;
    title: string;
    status: GoalStatus;
    priority: GoalPriority;
    dueDate?: string;
    description?: string;
}

interface GoalsTableProps {
    projectId: string;
}

const STATUS_CONFIG = {
    not_started: { label: 'Not Started', color: 'rgba(255, 255, 255, 0.3)', bg: 'rgba(255, 255, 255, 0.05)' },
    in_progress: { label: 'In Progress', color: '#58a6ff', bg: 'rgba(88, 166, 255, 0.15)' },
    done: { label: 'Done', color: '#3fb950', bg: 'rgba(63, 185, 80, 0.15)' },
};

const PRIORITY_CONFIG = {
    low: { label: 'Low', color: 'rgba(255, 255, 255, 0.4)' },
    medium: { label: 'Medium', color: '#f0883e' },
    high: { label: 'High', color: '#f85149' },
};

const GoalsTable: React.FC<GoalsTableProps> = ({ projectId }) => {
    const storageKey = `project-goals-${projectId}`;

    const [goals, setGoals] = useState<ProjectGoal[]>(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try { return JSON.parse(saved); } catch { return []; }
        }
        return [];
    });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);
    const [showPriorityMenu, setShowPriorityMenu] = useState<string | null>(null);
    const statusRef = useRef<HTMLDivElement>(null);
    const priorityRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(goals));
    }, [goals, storageKey]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
                setShowStatusMenu(null);
            }
            if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) {
                setShowPriorityMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const addGoal = () => {
        const newGoal: ProjectGoal = {
            id: Date.now().toString(),
            title: '',
            status: 'not_started',
            priority: 'medium',
        };
        setGoals([...goals, newGoal]);
        setEditingId(newGoal.id);
    };

    const updateGoal = (id: string, updates: Partial<ProjectGoal>) => {
        setGoals(goals.map(g => g.id === id ? { ...g, ...updates } : g));
    };

    const deleteGoal = (id: string) => {
        setGoals(goals.filter(g => g.id !== id));
    };

    const toggleDone = (id: string) => {
        const goal = goals.find(g => g.id === id);
        if (goal) {
            updateGoal(id, { status: goal.status === 'done' ? 'not_started' : 'done' });
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="goals-table">
            {/* Header */}
            <div className="goals-table-header">
                <h3 className="section-title">
                    <Target size={14} />
                    Goals
                </h3>
                <button className="add-goal-btn" onClick={addGoal}>
                    <Plus size={12} /> New
                </button>
            </div>

            {/* Table */}
            <div className="goals-list">
                {goals.length > 0 ? (
                    goals.map((goal) => (
                        <div key={goal.id} className="goal-row">
                            {/* Checkbox */}
                            <button
                                className={`goal-checkbox ${goal.status === 'done' ? 'checked' : ''}`}
                                onClick={() => toggleDone(goal.id)}
                            >
                                {goal.status === 'done' && <span>✓</span>}
                            </button>

                            {/* Title */}
                            {editingId === goal.id ? (
                                <input
                                    type="text"
                                    className="goal-title-input"
                                    value={goal.title}
                                    onChange={(e) => updateGoal(goal.id, { title: e.target.value })}
                                    onBlur={() => setEditingId(null)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === 'Escape') setEditingId(null);
                                    }}
                                    placeholder="Goal title..."
                                    autoFocus
                                />
                            ) : (
                                <span
                                    className={`goal-title ${goal.status === 'done' ? 'done' : ''}`}
                                    onClick={() => setEditingId(goal.id)}
                                >
                                    {goal.title || 'Untitled goal'}
                                </span>
                            )}

                            {/* Status Dropdown */}
                            <div className="goal-dropdown-container" ref={showStatusMenu === goal.id ? statusRef : undefined}>
                                <button
                                    className="goal-status-btn"
                                    style={{
                                        color: STATUS_CONFIG[goal.status].color,
                                        background: STATUS_CONFIG[goal.status].bg,
                                    }}
                                    onClick={() => setShowStatusMenu(showStatusMenu === goal.id ? null : goal.id)}
                                >
                                    {STATUS_CONFIG[goal.status].label}
                                    <ChevronDown size={12} />
                                </button>
                                {showStatusMenu === goal.id && (
                                    <div className="goal-dropdown">
                                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                            <button
                                                key={key}
                                                className="goal-dropdown-item"
                                                style={{ color: config.color }}
                                                onClick={() => {
                                                    updateGoal(goal.id, { status: key as GoalStatus });
                                                    setShowStatusMenu(null);
                                                }}
                                            >
                                                {config.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Priority */}
                            <div className="goal-dropdown-container" ref={showPriorityMenu === goal.id ? priorityRef : undefined}>
                                <button
                                    className="goal-priority-btn"
                                    style={{ color: PRIORITY_CONFIG[goal.priority].color }}
                                    onClick={() => setShowPriorityMenu(showPriorityMenu === goal.id ? null : goal.id)}
                                >
                                    {PRIORITY_CONFIG[goal.priority].label}
                                    <ChevronDown size={12} />
                                </button>
                                {showPriorityMenu === goal.id && (
                                    <div className="goal-dropdown">
                                        {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                                            <button
                                                key={key}
                                                className="goal-dropdown-item"
                                                style={{ color: config.color }}
                                                onClick={() => {
                                                    updateGoal(goal.id, { priority: key as GoalPriority });
                                                    setShowPriorityMenu(null);
                                                }}
                                            >
                                                {config.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Due Date */}
                            <div className="goal-date">
                                <Calendar size={12} />
                                <input
                                    type="date"
                                    className="goal-date-input"
                                    value={goal.dueDate || ''}
                                    onChange={(e) => updateGoal(goal.id, { dueDate: e.target.value })}
                                />
                                <span className="goal-date-display">
                                    {goal.dueDate ? formatDate(goal.dueDate) : '—'}
                                </span>
                            </div>

                            {/* Delete */}
                            <button
                                className="goal-delete-btn"
                                onClick={() => deleteGoal(goal.id)}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="goals-empty">
                        <p>No goals yet</p>
                        <button className="add-goal-btn" onClick={addGoal}>
                            <Plus size={12} /> Add your first goal
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GoalsTable;
