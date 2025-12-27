import React from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useNotesStore } from '@/store/notesStore';
import { FileText } from 'lucide-react';

interface RecentNotesGridProps {
    projectId: string;
}

const RecentNotesGrid: React.FC<RecentNotesGridProps> = ({ projectId }) => {
    const { getTreeItemsByProject } = useProjectStore();
    const { setActiveNote, getProjectNotes } = useNotesStore();

    // Get notes for this project, sorted by updatedAt
    const projectNotes = getProjectNotes(projectId);
    const recentNotes = [...projectNotes]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 4);

    // Also check tree items for notes
    const treeItems = getTreeItemsByProject(projectId);
    const noteItems = treeItems
        .filter((item) => item.type === 'note')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4);

    // Use tree items if they exist, otherwise use notes store
    const displayNotes = noteItems.length > 0 ? noteItems : recentNotes;

    const getRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return `${Math.floor(diffDays / 7)}w ago`;
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed':
                return { icon: '✓', label: 'Done', className: 'completed' };
            case 'in_progress':
                return { icon: '◐', label: 'In Progress', className: 'in-progress' };
            default:
                return { icon: '○', label: 'Not Started', className: 'not-started' };
        }
    };

    const handleNoteClick = (note: any) => {
        const noteId = note.noteId || note.id;
        setActiveNote(noteId);
    };

    return (
        <section className="recent-notes-grid">
            <div className="section-header">
                <h3 className="section-title">
                    <FileText size={14} />
                    Recent Notes
                </h3>
                {displayNotes.length > 0 && (
                    <button className="section-link">See All</button>
                )}
            </div>

            {displayNotes.length > 0 ? (
                <div className="notes-grid">
                    {displayNotes.map((note: any) => {
                        const status = getStatusLabel(note.status || 'not_started');
                        const updatedAt = note.updatedAt || note.updated_at;

                        return (
                            <div
                                key={note.id}
                                className="note-card"
                                onClick={() => handleNoteClick(note)}
                            >
                                <div className="note-card-header">
                                    <span className="note-card-icon">{note.icon || '📄'}</span>
                                    <span className="note-card-title">{note.name || note.title}</span>
                                </div>
                                <div className="note-card-footer">
                                    <span className={`note-card-status ${status.className}`}>
                                        {status.label}
                                    </span>
                                    <span className="note-card-time">
                                        {getRelativeTime(updatedAt)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="files-empty">
                    <p>No notes yet. Create your first note!</p>
                </div>
            )}
        </section>
    );
};

export default RecentNotesGrid;
