/**
 * CourseOutlineEditor
 * 
 * Drag-drop interface for reviewing and editing the AI-generated course outline
 * before proceeding with content generation.
 */

import React, { useState, useCallback } from 'react';
import {
    DragDropContext,
    Droppable,
    Draggable,
    type DropResult,
} from '@hello-pangea/dnd';
import {
    Brain,
    GripVertical,
    Plus,
    Trash2,
    BookOpen,
    Video,
    FileText,
    CheckSquare,
    Presentation,
    ArrowRight,
    ArrowLeft,
} from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';
import type {
    ModuleOutline,
    LessonOutline,
} from '@/services/courseGenerator/courseTypes';
// Note: approveOutlineAndContinue and rejectOutlineAndRegenerate are dynamically imported
// to avoid loading LangGraph at app startup

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const lessonTypeIcons: Record<LessonOutline['type'], React.ElementType> = {
    lecture: BookOpen,
    video: Video,
    slides: Presentation,
    practice: FileText,
    quiz: CheckSquare,
};

// ============================================================================
// COMPONENT
// ============================================================================

const CourseOutlineEditor: React.FC = () => {
    const {
        pendingOutline,
        generationSessionId,
        outlineThinkingOutput,
        updatePendingOutline,
        clearOutlineApproval,
        setViewMode,
        completeGeneration,
    } = useCourseStore();

    const [isApproving, setIsApproving] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectFeedback, setRejectFeedback] = useState('');

    // Guard: No outline to edit
    if (!pendingOutline) {
        return (
            <div className="course-outline-editor">
                <div className="course-outline-editor-header">
                    <h2>No Outline Available</h2>
                    <p>Start generating a course to see the outline editor.</p>
                </div>
                <button
                    className="course-outline-reject-btn"
                    onClick={() => setViewMode('home')}
                >
                    <ArrowLeft size={16} />
                    Back to Home
                </button>
            </div>
        );
    }

    // ========================================================================
    // DRAG & DROP HANDLERS
    // ========================================================================

    const onDragEnd = useCallback((result: DropResult) => {
        if (!result.destination || !pendingOutline) return;

        const { source, destination, type } = result;

        // Module reordering
        if (type === 'modules') {
            const newModules = Array.from(pendingOutline.modules);
            const [removed] = newModules.splice(source.index, 1);
            newModules.splice(destination.index, 0, removed);

            // Update order numbers
            const reorderedModules = newModules.map((m, idx) => ({ ...m, order: idx + 1 }));

            updatePendingOutline({ ...pendingOutline, modules: reorderedModules });
            return;
        }

        // Lesson reordering (within same module or across modules)
        if (type === 'lessons') {
            const sourceModuleId = source.droppableId.replace('lessons-', '');
            const destModuleId = destination.droppableId.replace('lessons-', '');

            const newModules = pendingOutline.modules.map(m => ({ ...m, lessons: [...m.lessons] }));
            const sourceModule = newModules.find(m => m.id === sourceModuleId);
            const destModule = newModules.find(m => m.id === destModuleId);

            if (!sourceModule || !destModule) return;

            const [removed] = sourceModule.lessons.splice(source.index, 1);
            destModule.lessons.splice(destination.index, 0, removed);

            updatePendingOutline({ ...pendingOutline, modules: newModules });
        }
    }, [pendingOutline, updatePendingOutline]);

    // ========================================================================
    // EDIT HANDLERS
    // ========================================================================

    const handleTitleChange = (value: string) => {
        if (!pendingOutline) return;
        updatePendingOutline({ ...pendingOutline, title: value });
    };

    const handleDescriptionChange = (value: string) => {
        if (!pendingOutline) return;
        updatePendingOutline({ ...pendingOutline, description: value });
    };

    const handleHoursChange = (value: string) => {
        if (!pendingOutline) return;
        const hours = parseInt(value, 10) || 0;
        updatePendingOutline({ ...pendingOutline, estimatedHours: hours });
    };

    const handleModuleTitleChange = (moduleId: string, title: string) => {
        if (!pendingOutline) return;
        const newModules = pendingOutline.modules.map(m =>
            m.id === moduleId ? { ...m, title } : m
        );
        updatePendingOutline({ ...pendingOutline, modules: newModules });
    };

    const handleLessonTitleChange = (moduleId: string, lessonId: string, title: string) => {
        if (!pendingOutline) return;
        const newModules = pendingOutline.modules.map(m =>
            m.id === moduleId
                ? {
                    ...m,
                    lessons: m.lessons.map(l =>
                        l.id === lessonId ? { ...l, title } : l
                    )
                }
                : m
        );
        updatePendingOutline({ ...pendingOutline, modules: newModules });
    };

    // ========================================================================
    // ADD/DELETE HANDLERS
    // ========================================================================

    const addModule = () => {
        if (!pendingOutline) return;
        const newModule: ModuleOutline = {
            id: `mod-${generateId()}`,
            title: `Module ${pendingOutline.modules.length + 1}: New Module`,
            description: 'Add a description for this module',
            order: pendingOutline.modules.length + 1,
            lessons: [
                {
                    id: `les-${generateId()}`,
                    title: 'New Lesson',
                    type: 'lecture',
                    estimatedMinutes: 15,
                    keyTopics: [],
                    learningObjectives: [],
                    order: 1,
                }
            ],
        };
        updatePendingOutline({
            ...pendingOutline,
            modules: [...pendingOutline.modules, newModule]
        });
    };

    const deleteModule = (moduleId: string) => {
        if (!pendingOutline || pendingOutline.modules.length <= 1) return;
        const newModules = pendingOutline.modules
            .filter(m => m.id !== moduleId)
            .map((m, idx) => ({ ...m, order: idx + 1 }));
        updatePendingOutline({ ...pendingOutline, modules: newModules });
    };

    const addLesson = (moduleId: string) => {
        if (!pendingOutline) return;
        const newLesson: LessonOutline = {
            id: `les-${generateId()}`,
            title: 'New Lesson',
            type: 'lecture',
            estimatedMinutes: 15,
            keyTopics: [],
            learningObjectives: [],
            order: 1,
        };
        const newModules = pendingOutline.modules.map(m =>
            m.id === moduleId
                ? { ...m, lessons: [...m.lessons, newLesson] }
                : m
        );
        updatePendingOutline({ ...pendingOutline, modules: newModules });
    };

    const deleteLesson = (moduleId: string, lessonId: string) => {
        if (!pendingOutline) return;
        const module = pendingOutline.modules.find(m => m.id === moduleId);
        if (!module || module.lessons.length <= 1) return;

        const newModules = pendingOutline.modules.map(m =>
            m.id === moduleId
                ? { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) }
                : m
        );
        updatePendingOutline({ ...pendingOutline, modules: newModules });
    };

    const cycleLessonType = (moduleId: string, lessonId: string) => {
        if (!pendingOutline) return;
        const types: LessonOutline['type'][] = ['lecture', 'video', 'slides', 'practice', 'quiz'];
        const newModules = pendingOutline.modules.map(m =>
            m.id === moduleId
                ? {
                    ...m,
                    lessons: m.lessons.map(l => {
                        if (l.id !== lessonId) return l;
                        const currentIdx = types.indexOf(l.type);
                        const nextType = types[(currentIdx + 1) % types.length];
                        return { ...l, type: nextType };
                    })
                }
                : m
        );
        updatePendingOutline({ ...pendingOutline, modules: newModules });
    };

    // ========================================================================
    // APPROVAL HANDLERS
    // ========================================================================

    const handleApprove = async () => {
        if (!pendingOutline || !generationSessionId) return;

        setIsApproving(true);
        try {
            // Continue generation with approved outline (dynamically imported)
            const { approveOutlineAndContinue } = await import('@/services/courseGenerator');
            const result = await approveOutlineAndContinue(generationSessionId, pendingOutline);

            if (result.status === 'complete' && result.course) {
                completeGeneration(result.course);
                clearOutlineApproval();
            } else if (result.status === 'error') {
                console.error('Generation failed:', result.error);
                // TODO: Show error toast
            } else {
                // Still generating - go back to generation view
                setViewMode('generating');
            }
        } catch (error) {
            console.error('Approval failed:', error);
        } finally {
            setIsApproving(false);
        }
    };

    const handleReject = async () => {
        if (!pendingOutline || !generationSessionId || !rejectFeedback.trim()) return;

        setIsRejecting(true);
        setShowRejectModal(false);
        try {
            // Regenerate with feedback (dynamically imported)
            const { rejectOutlineAndRegenerate } = await import('@/services/courseGenerator');
            await rejectOutlineAndRegenerate(generationSessionId, rejectFeedback);
            // Go back to generation view to wait for new outline
            setViewMode('generating');
        } catch (error) {
            console.error('Rejection failed:', error);
        } finally {
            setIsRejecting(false);
            setRejectFeedback('');
        }
    };

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
        <div className="course-outline-editor">
            {/* Header */}
            <div className="course-outline-editor-header">
                <h2>Review Your Course Outline</h2>
                <p>Topic: {pendingOutline.topic}</p>
            </div>

            {/* Thinking Output */}
            {outlineThinkingOutput && (
                <div className="course-outline-thinking">
                    <div className="course-outline-thinking-header">
                        <Brain size={14} />
                        AI Analysis
                    </div>
                    <div className="course-outline-thinking-content">
                        {outlineThinkingOutput}
                    </div>
                </div>
            )}

            {/* Course Info */}
            <div className="course-outline-info">
                <div className="course-outline-info-field full-width">
                    <label className="course-outline-info-label">Course Title</label>
                    <input
                        type="text"
                        className="course-outline-info-input"
                        value={pendingOutline.title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                    />
                </div>
                <div className="course-outline-info-field">
                    <label className="course-outline-info-label">Difficulty</label>
                    <input
                        type="text"
                        className="course-outline-info-input"
                        value={pendingOutline.difficulty}
                        disabled
                    />
                </div>
                <div className="course-outline-info-field">
                    <label className="course-outline-info-label">Estimated Hours</label>
                    <input
                        type="number"
                        className="course-outline-info-input"
                        value={pendingOutline.estimatedHours}
                        onChange={(e) => handleHoursChange(e.target.value)}
                    />
                </div>
                <div className="course-outline-info-field full-width">
                    <label className="course-outline-info-label">Description</label>
                    <input
                        type="text"
                        className="course-outline-info-input"
                        value={pendingOutline.description}
                        onChange={(e) => handleDescriptionChange(e.target.value)}
                    />
                </div>
            </div>

            {/* Modules Header */}
            <div className="course-outline-modules-header">
                <h3>Modules & Lessons</h3>
                <button 
                    className="course-outline-add-module-btn" 
                    onClick={addModule}
                    disabled={isApproving || isRejecting}
                >
                    <Plus size={14} />
                    Add Module
                </button>
            </div>

            {/* Drag & Drop Modules */}
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="modules" type="modules">
                    {(provided) => (
                        <div
                            className="course-outline-modules-list"
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                        >
                            {/* Debug: Log if modules are missing */}
                            {(!pendingOutline.modules || pendingOutline.modules.length === 0) && (
                                <div style={{ color: '#f85149', padding: '20px', textAlign: 'center' }}>
                                    ⚠️ No modules found. Debug: {JSON.stringify(Object.keys(pendingOutline))}
                                </div>
                            )}
                            {(pendingOutline.modules || []).map((module, moduleIndex) => (
                                <ModuleItem
                                    key={module.id}
                                    module={module}
                                    index={moduleIndex}
                                    canDelete={(pendingOutline.modules || []).length > 1}
                                    onTitleChange={(title) => handleModuleTitleChange(module.id, title)}
                                    onDelete={() => deleteModule(module.id)}
                                    onAddLesson={() => addLesson(module.id)}
                                    onLessonTitleChange={(lessonId, title) =>
                                        handleLessonTitleChange(module.id, lessonId, title)
                                    }
                                    onLessonDelete={(lessonId) => deleteLesson(module.id, lessonId)}
                                    onLessonTypeChange={(lessonId) => cycleLessonType(module.id, lessonId)}
                                />
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            {/* Actions */}
            <div className="course-outline-actions">
                <button
                    className="course-outline-reject-btn"
                    onClick={() => setShowRejectModal(true)}
                    disabled={isApproving || isRejecting}
                >
                    <ArrowLeft size={16} />
                    Reject & Regenerate
                </button>
                <button
                    className="course-outline-approve-btn"
                    onClick={handleApprove}
                    disabled={isApproving || isRejecting}
                >
                    {isApproving ? 'Generating...' : 'Approve & Generate Course'}
                    <ArrowRight size={16} />
                </button>
            </div>

            {/* Reject Feedback Modal */}
            {showRejectModal && (
                <div className="course-outline-feedback-overlay">
                    <div className="course-outline-feedback-modal">
                        <h3>Request Changes</h3>
                        <p>Tell us what you'd like to change about this outline:</p>
                        <textarea
                            className="course-outline-feedback-textarea"
                            value={rejectFeedback}
                            onChange={(e) => setRejectFeedback(e.target.value)}
                            placeholder="e.g., Add more practice exercises, make it more beginner-friendly..."
                            autoFocus
                        />
                        <div className="course-outline-feedback-actions">
                            <button
                                className="course-outline-feedback-cancel"
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectFeedback('');
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="course-outline-feedback-submit"
                                onClick={handleReject}
                                disabled={!rejectFeedback.trim()}
                            >
                                Regenerate Outline
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// MODULE ITEM SUBCOMPONENT
// ============================================================================

interface ModuleItemProps {
    module: ModuleOutline;
    index: number;
    canDelete: boolean;
    onTitleChange: (title: string) => void;
    onDelete: () => void;
    onAddLesson: () => void;
    onLessonTitleChange: (lessonId: string, title: string) => void;
    onLessonDelete: (lessonId: string) => void;
    onLessonTypeChange: (lessonId: string) => void;
}

const ModuleItem: React.FC<ModuleItemProps> = ({
    module,
    index,
    canDelete,
    onTitleChange,
    onDelete,
    onAddLesson,
    onLessonTitleChange,
    onLessonDelete,
    onLessonTypeChange,
}) => {
    return (
        <Draggable draggableId={module.id} index={index}>
            {(provided, snapshot) => (
                <div
                    className={`course-outline-module-item ${snapshot.isDragging ? 'is-dragging' : ''}`}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                >
                    {/* Module Header */}
                    <div className="course-outline-module-header">
                        <div
                            className="course-outline-drag-handle"
                            {...provided.dragHandleProps}
                        >
                            <GripVertical size={16} />
                        </div>
                        <input
                            className="course-outline-module-title-input"
                            value={module.title}
                            onChange={(e) => onTitleChange(e.target.value)}
                        />
                        <div className="course-outline-module-actions">
                            {canDelete && (
                                <button
                                    className="course-outline-module-action-btn delete"
                                    onClick={onDelete}
                                    title="Delete module"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Lessons List */}
                    <Droppable droppableId={`lessons-${module.id}`} type="lessons">
                        {(lessonsProvided) => (
                            <div
                                className="course-outline-lessons-list"
                                ref={lessonsProvided.innerRef}
                                {...lessonsProvided.droppableProps}
                            >
                                {module.lessons.map((lesson, lessonIndex) => (
                                    <LessonItem
                                        key={lesson.id}
                                        lesson={lesson}
                                        index={lessonIndex}
                                        canDelete={module.lessons.length > 1}
                                        onTitleChange={(title) => onLessonTitleChange(lesson.id, title)}
                                        onDelete={() => onLessonDelete(lesson.id)}
                                        onTypeChange={() => onLessonTypeChange(lesson.id)}
                                    />
                                ))}
                                {lessonsProvided.placeholder}
                                <button
                                    className="course-outline-add-lesson-btn"
                                    onClick={onAddLesson}
                                >
                                    <Plus size={14} />
                                    Add Lesson
                                </button>
                            </div>
                        )}
                    </Droppable>
                </div>
            )}
        </Draggable>
    );
};

// ============================================================================
// LESSON ITEM SUBCOMPONENT
// ============================================================================

interface LessonItemProps {
    lesson: LessonOutline;
    index: number;
    canDelete: boolean;
    onTitleChange: (title: string) => void;
    onDelete: () => void;
    onTypeChange: () => void;
}

const LessonItem: React.FC<LessonItemProps> = ({
    lesson,
    index,
    canDelete,
    onTitleChange,
    onDelete,
    onTypeChange,
}) => {
    const Icon = lessonTypeIcons[lesson.type];

    return (
        <Draggable draggableId={lesson.id} index={index}>
            {(provided, snapshot) => (
                <div
                    className={`course-outline-lesson-item ${snapshot.isDragging ? 'is-dragging' : ''}`}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                >
                    <div
                        className="course-outline-drag-handle"
                        {...provided.dragHandleProps}
                    >
                        <GripVertical size={14} />
                    </div>
                    <input
                        className="course-outline-lesson-title-input"
                        value={lesson.title}
                        onChange={(e) => onTitleChange(e.target.value)}
                    />
                    <button
                        className={`course-outline-lesson-type ${lesson.type}`}
                        onClick={onTypeChange}
                        title="Click to change type"
                    >
                        <Icon size={12} />
                        {lesson.type}
                    </button>
                    {canDelete && (
                        <button
                            className="course-outline-module-action-btn delete"
                            onClick={onDelete}
                            title="Delete lesson"
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            )}
        </Draggable>
    );
};

export default CourseOutlineEditor;
