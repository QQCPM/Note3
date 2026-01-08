import React, { useState, useRef, useEffect } from 'react';
import { X, FileText, ExternalLink, Check, Folder, FileStack } from 'lucide-react';
import { createNote, createBlock } from '@/utils/tauri';
import { useNotesStore } from '@/store/notesStore';
import { useUIStore } from '@/store/uiStore';
import { useProjectStore } from '@/store/projectStore';
import type { PracticeProblem } from '@/types/course';

interface SaveToNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    lessonTitle: string;
    lessonContent: string;
    courseTitle: string;
    practiceProblems?: PracticeProblem[];
}

const SaveToNotesModal: React.FC<SaveToNotesModalProps> = ({
    isOpen,
    onClose,
    lessonTitle,
    lessonContent,
    courseTitle,
    practiceProblems,
}) => {
    const { addNote, setActiveNote } = useNotesStore();
    const { setCanvasMode } = useUIStore();
    const { projects } = useProjectStore();

    const [noteTitle, setNoteTitle] = useState(`${lessonTitle}`);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [openAfterSave, setOpenAfterSave] = useState(true);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [showPopover, setShowPopover] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setShowPopover(false);
            }
        };
        if (showPopover) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPopover]);

    if (!isOpen) return null;

    const selectedProject = selectedProjectId
        ? projects.find(p => p.id === selectedProjectId)
        : null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Import parser dynamically to avoid circular deps
            const { parseMarkdownContent, chunkToBlockData, chunkToBlockType } = await import('@/utils/contentParser');

            const dbNote = await createNote({
                title: noteTitle,
                icon: '📖',
                parent_id: null,
            });

            const newNote = {
                ...dbNote,
                project_id: selectedProjectId,
                type: 'note' as const,
                is_pinned: false,
            };
            addNote(newNote);

            // First, create a source attribution block
            await createBlock({
                note_id: dbNote.id,
                type: 'text',
                data: {
                    type: 'text' as const,
                    content: `> 📚 **Source:** ${courseTitle} → ${lessonTitle}`
                },
                position: 0,
            });

            // Parse the lesson content into chunks
            const chunks = parseMarkdownContent(lessonContent);

            // Create a block for each chunk
            let position = 1;
            for (const chunk of chunks) {
                const blockType = chunkToBlockType(chunk);
                const blockData = chunkToBlockData(chunk);

                await createBlock({
                    note_id: dbNote.id,
                    type: blockType,
                    data: blockData,
                    position: position++,
                });
            }

            // If there are practice problems (quizzes), add them as a quiz block
            if (practiceProblems && practiceProblems.length > 0) {
                // Create a quiz block with all questions
                const problems = practiceProblems.map((problem, idx) => ({
                    id: `quiz-${idx}`,
                    question: problem.question,
                    options: problem.options,
                    correctIndex: problem.correctIndex,
                    explanation: problem.explanation,
                    selectedIndex: undefined,
                    revealed: false,
                }));

                await createBlock({
                    note_id: dbNote.id,
                    type: 'quiz',
                    data: {
                        type: 'quiz' as const,
                        title: 'Quick Check',
                        problems
                    },
                    position: position++,
                });
            }

            setSaved(true);

            if (openAfterSave) {
                setTimeout(() => {
                    setActiveNote(dbNote.id);
                    setCanvasMode('note');
                    onClose();
                }, 500);
            } else {
                setTimeout(onClose, 1000);
            }
        } catch (error) {
            console.error('Failed to save to notes:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="save-notes-modal-overlay" onClick={onClose}>
            <div className="save-notes-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="save-notes-modal-header">
                    <div className="save-notes-modal-title">
                        <FileText size={18} style={{ color: '#58a6ff' }} />
                        <h2>Save to Notes</h2>
                    </div>
                    <button className="save-notes-modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="save-notes-modal-content">
                    {saved ? (
                        <div className="save-notes-success">
                            <div className="save-notes-success-icon">
                                <Check size={24} />
                            </div>
                            <p>Note saved successfully!</p>
                            {selectedProject && (
                                <p style={{ fontSize: '12px', color: '#7d8590' }}>Added to {selectedProject.name}</p>
                            )}
                            {openAfterSave && <p style={{ fontSize: '12px', color: '#7d8590' }}>Opening note...</p>}
                        </div>
                    ) : (
                        <>
                            {/* Source Info - Clickable lesson title */}
                            <div className="save-notes-source">
                                <span style={{ color: '#7d8590' }}>From:</span>
                                <span style={{ color: '#c9d1d9' }}>{courseTitle}</span>
                                <span style={{ color: '#484f58' }}>→</span>
                                <div className="save-notes-source-lesson" ref={popoverRef}>
                                    <button
                                        className="save-notes-lesson-btn"
                                        onClick={() => setShowPopover(!showPopover)}
                                    >
                                        {lessonTitle}
                                        {selectedProject && (
                                            <span className="save-notes-dest-badge">
                                                → {selectedProject.name}
                                            </span>
                                        )}
                                    </button>

                                    {/* Floating Popover */}
                                    {showPopover && (
                                        <div className="save-notes-popover">
                                            <div className="save-notes-popover-header">
                                                Save to...
                                            </div>
                                            <button
                                                className={`save-notes-popover-item ${!selectedProjectId ? 'active' : ''}`}
                                                onClick={() => {
                                                    setSelectedProjectId(null);
                                                    setShowPopover(false);
                                                }}
                                            >
                                                <FileStack size={14} style={{ color: '#58a6ff' }} />
                                                <span>General Notes</span>
                                                {!selectedProjectId && <Check size={12} style={{ color: '#3fb950', marginLeft: 'auto' }} />}
                                            </button>

                                            {projects.length > 0 && <div className="save-notes-popover-divider" />}

                                            {projects.map(project => (
                                                <button
                                                    key={project.id}
                                                    className={`save-notes-popover-item ${selectedProjectId === project.id ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setSelectedProjectId(project.id);
                                                        setShowPopover(false);
                                                    }}
                                                >
                                                    <Folder size={14} style={{ color: '#d29922' }} />
                                                    <span>{project.name}</span>
                                                    {selectedProjectId === project.id && <Check size={12} style={{ color: '#3fb950', marginLeft: 'auto' }} />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Note Title Input */}
                            <div className="save-notes-field">
                                <label>Note Title</label>
                                <input
                                    type="text"
                                    value={noteTitle}
                                    onChange={(e) => setNoteTitle(e.target.value)}
                                    placeholder="Enter note title..."
                                />
                            </div>

                            {/* Preview */}
                            <div className="save-notes-preview">
                                <label>Content Preview</label>
                                <div className="save-notes-preview-content">
                                    {lessonContent.slice(0, 300)}
                                    {lessonContent.length > 300 && '...'}
                                </div>
                            </div>

                            {/* Options */}
                            <label className="save-notes-checkbox">
                                <input
                                    type="checkbox"
                                    checked={openAfterSave}
                                    onChange={(e) => setOpenAfterSave(e.target.checked)}
                                />
                                <span>Open note after saving</span>
                                <ExternalLink size={12} style={{ color: '#7d8590' }} />
                            </label>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!saved && (
                    <div className="save-notes-modal-footer">
                        <button className="save-notes-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            className="save-notes-confirm"
                            onClick={handleSave}
                            disabled={isSaving || !noteTitle.trim()}
                        >
                            {isSaving ? 'Saving...' : 'Save to Notes'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SaveToNotesModal;
