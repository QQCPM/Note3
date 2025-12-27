import React, { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { Settings } from 'lucide-react';
import FilesShelf from './FilesShelf';
import RecentNotesGrid from './RecentNotesGrid';
import ProjectGraph from './ProjectGraph';
import GoalsTable from './GoalsTable';
import './ProjectDashboard.css';

interface ProjectDashboardProps {
    projectId: string;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ projectId }) => {
    const { getProjectById, updateProject } = useProjectStore();
    const project = getProjectById(projectId);

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [editTitle, setEditTitle] = useState(project?.name || '');
    const [editDesc, setEditDesc] = useState(project?.description || '');

    if (!project) {
        return (
            <div className="project-dashboard-empty">
                <p>Project not found</p>
            </div>
        );
    }

    const handleSaveTitle = () => {
        if (editTitle.trim()) {
            updateProject(projectId, { name: editTitle.trim() });
        }
        setIsEditingTitle(false);
    };

    const handleSaveDesc = () => {
        updateProject(projectId, { description: editDesc.trim() || undefined });
        setIsEditingDesc(false);
    };

    return (
        <div className="project-dashboard">
            {/* Header - Simplified */}
            <header className="project-dashboard-header">
                <div className="project-header-content">
                    <div className="project-title-row">
                        <span className="project-icon">{project.icon}</span>

                        {isEditingTitle ? (
                            <input
                                type="text"
                                className="project-title-input"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={handleSaveTitle}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveTitle();
                                    if (e.key === 'Escape') {
                                        setEditTitle(project.name);
                                        setIsEditingTitle(false);
                                    }
                                }}
                                autoFocus
                            />
                        ) : (
                            <h1
                                className="project-title"
                                onClick={() => {
                                    setEditTitle(project.name);
                                    setIsEditingTitle(true);
                                }}
                            >
                                {project.name}
                            </h1>
                        )}

                        <button className="project-settings-btn" title="Settings">
                            <Settings size={16} />
                        </button>
                    </div>

                    {/* Editable Description */}
                    {isEditingDesc ? (
                        <textarea
                            className="project-desc-input"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            onBlur={handleSaveDesc}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    setEditDesc(project.description || '');
                                    setIsEditingDesc(false);
                                }
                            }}
                            placeholder="Add a description..."
                            autoFocus
                            rows={2}
                        />
                    ) : (
                        <p
                            className="project-description"
                            onClick={() => {
                                setEditDesc(project.description || '');
                                setIsEditingDesc(true);
                            }}
                        >
                            {project.description || 'Click to add description...'}
                        </p>
                    )}
                </div>
            </header>

            {/* Content */}
            <div className="project-dashboard-content">
                {/* Files Shelf */}
                <FilesShelf projectId={projectId} />

                {/* Recent Notes */}
                <RecentNotesGrid projectId={projectId} />

                {/* Bottom Row: Graph + Goals */}
                <div className="project-bottom-row">
                    <ProjectGraph projectId={projectId} />
                    <GoalsTable projectId={projectId} />
                </div>
            </div>
        </div>
    );
};

export default ProjectDashboard;
