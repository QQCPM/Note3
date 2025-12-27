import React, { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useNotesStore } from '@/store/notesStore';
import { ChevronRight, Plus, Bot } from 'lucide-react';

interface ProjectSidebarProps {
    projectId: string;
}

// AI Guidance files for this project
const AIGuidanceSection: React.FC<{ projectId: string }> = ({ projectId }) => {
    // TODO: Integrate with actual file storage using projectId
    // Files will be stored as: {projectId}_instructions.md, {projectId}_context.md
    const guidanceFiles = [
        { id: `${projectId}-instructions`, name: 'instructions.md' },
        { id: `${projectId}-context`, name: 'context.md' },
    ];

    return (
        <div className="sidebar-section">
            <div className="sidebar-section-header">
                <span className="sidebar-section-title">🤖 AI Guidance</span>
                <button className="sidebar-section-btn" title="Add guidance file">
                    <Plus size={14} />
                </button>
            </div>
            <div className="guidance-files-list">
                {guidanceFiles.map((file) => (
                    <button key={file.id} className="guidance-file-item">
                        <Bot size={14} className="guidance-file-icon" />
                        <span>{file.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

// Tree item component
interface TreeItemComponentProps {
    item: {
        id: string;
        name: string;
        type: string;
        status: string;
        icon?: string;
    };
    depth: number;
    isExpanded: boolean;
    hasChildren: boolean;
    onToggle: () => void;
    onClick: () => void;
}

const TreeItemComponent: React.FC<TreeItemComponentProps> = ({
    item,
    depth,
    isExpanded,
    hasChildren,
    onToggle,
    onClick,
}) => {
    return (
        <div
            className={`tree-item ${item.type === 'folder' ? 'folder' : ''}`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={item.type === 'folder' ? onToggle : onClick}
        >
            {hasChildren && (
                <ChevronRight
                    size={14}
                    className={`tree-item-chevron ${isExpanded ? 'expanded' : ''}`}
                />
            )}
            {!hasChildren && <span className="tree-item-indent" />}
            <span className="tree-item-name">{item.name}</span>
        </div>
    );
};

// Project Notes Tree
const ProjectNotesTree: React.FC<{ projectId: string }> = ({ projectId }) => {
    const { buildTree } = useProjectStore();
    const { setActiveNote } = useNotesStore();
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const tree = buildTree(projectId);

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleNoteClick = (noteId: string) => {
        setActiveNote(noteId);
    };

    const renderTree = (items: any[], depth = 0): React.ReactNode => {
        return items.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedIds.has(item.id);

            return (
                <React.Fragment key={item.id}>
                    <TreeItemComponent
                        item={item}
                        depth={depth}
                        isExpanded={isExpanded}
                        hasChildren={hasChildren}
                        onToggle={() => toggleExpand(item.id)}
                        onClick={() => item.noteId && handleNoteClick(item.noteId)}
                    />
                    {hasChildren && isExpanded && renderTree(item.children, depth + 1)}
                </React.Fragment>
            );
        });
    };

    return (
        <div className="sidebar-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="sidebar-section-header">
                <span className="sidebar-section-title">📝 Project Notes</span>
                <button className="sidebar-section-btn" title="Add note">
                    <Plus size={14} />
                </button>
            </div>
            <div className="project-notes-tree">
                {tree.length > 0 ? (
                    renderTree(tree)
                ) : (
                    <div style={{ padding: '16px', color: '#7d8590', fontSize: '13px' }}>
                        No notes yet
                    </div>
                )}
            </div>
        </div>
    );
};

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({ projectId }) => {
    return (
        <aside className="project-sidebar">
            <AIGuidanceSection projectId={projectId} />
            <ProjectNotesTree projectId={projectId} />
        </aside>
    );
};

export default ProjectSidebar;
