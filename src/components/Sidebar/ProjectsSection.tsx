import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, FolderPlus } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useNotesStore } from '@/store/notesStore';
import { useFileStore } from '@/store/fileStore';
import { createNote } from '@/utils/tauri';
import SidebarSection from './SidebarSection';
import SidebarItem from './SidebarItem';

interface ProjectsSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
}

interface ProjectItemProps {
  project: {
    id: string;
    name: string;
    icon: string;
    progress: number;
  };
  isActive: boolean;
  onSelect: () => void;
}

const ProjectItem: React.FC<ProjectItemProps> = ({ project, isActive, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const { buildTreeForProject, addNote, setActiveNote } = useNotesStore();
  const { deleteProject, setActiveProject, activeProjectId, getTreeItemsByProject } = useProjectStore();
  const { setActiveFile } = useFileStore();

  const projectNotes = buildTreeForProject(project.id);

  // Get files for this project
  const projectFiles = getTreeItemsByProject(project.id).filter((item) =>
    ['pdf', 'video', 'audio', 'image'].includes(item.type)
  );

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return '📕';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      case 'image': return '🖼️';
      default: return '📄';
    }
  };

  // Close menu on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleAddNote = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    try {
      const dbNote = await createNote({
        title: 'Untitled',
        icon: '📄',
        parent_id: null,
      });
      const noteWithProject = {
        ...dbNote,
        project_id: project.id,
        type: 'note' as const,
        is_pinned: false,
      };
      addNote(noteWithProject);
      setActiveNote(noteWithProject.id);
      setIsExpanded(true);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  }, [project.id, addNote, setActiveNote]);

  const handleDelete = useCallback(() => {
    setShowMenu(false);
    if (!confirm(`Delete project "${project.name}"? All notes in this project will be deleted.`)) return;
    deleteProject(project.id);
    if (activeProjectId === project.id) {
      setActiveProject(null);
    }
  }, [project.id, project.name, deleteProject, activeProjectId, setActiveProject]);

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 40) return 'bg-blue-500';
    return 'bg-gray-600';
  };

  return (
    <div className="mb-1">
      {/* Project Header */}
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
          transition-colors duration-150 group relative
          ${isActive ? 'bg-[#1f2937]' : 'hover:bg-[#161b22]'}
        `}
        onClick={onSelect}
      >
        <button
          className="text-gray-500 hover:text-gray-300 transition-transform duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <span className="text-base">{project.icon}</span>

        <span className="flex-1 text-sm text-gray-300 truncate">
          {project.name}
        </span>

        {/* Progress indicator */}
        {project.progress > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getProgressColor(project.progress)}`}
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{project.progress}%</span>
          </div>
        )}

        {/* 3-dot menu */}
        <div ref={menuRef} className="relative">
          <button
            className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          >
            ⋯
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[#1c2128] border border-gray-700 rounded-lg shadow-xl z-50 min-w-[120px] py-1">
              <button
                className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700"
                onClick={(e) => { e.stopPropagation(); handleAddNote(e); }}
              >
                + Add note
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-gray-700"
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              >
                Delete project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Project Files & Notes */}
      {isExpanded && (
        <div className="ml-2 mt-1">
          {/* Files first */}
          {projectFiles.length > 0 && (
            <div className="mb-1">
              {projectFiles.map((item) => (
                <button
                  key={item.id}
                  onClick={() => item.filePath && setActiveFile(item.filePath)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-md transition-colors text-left"
                >
                  <span>{getFileIcon(item.type)}</span>
                  <span className="truncate">{item.name}</span>
                </button>
              ))}
            </div>
          )}
          {/* Then notes */}
          {projectNotes.length > 0 ? (
            projectNotes.map((note) => (
              <SidebarItem key={note.id} note={note} depth={0} />
            ))
          ) : projectFiles.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-600 italic">
              No content yet
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ProjectsSection: React.FC<ProjectsSectionProps> = ({ isExpanded, onToggle }) => {
  const { projects, activeProjectId, setActiveProject, addProject } = useProjectStore();
  const { setActiveNote } = useNotesStore();

  // Handle selecting a project - clears active note to show dashboard
  const handleSelectProject = useCallback((projectId: string) => {
    setActiveNote(null); // Clear any active note
    setActiveProject(projectId); // Set the active project
  }, [setActiveNote, setActiveProject]);

  const handleNewProject = useCallback(() => {
    const project = addProject({
      name: 'New Project',
      type: 'general',
      icon: '📁',
    });
    setActiveNote(null); // Clear any active note
    setActiveProject(project.id);
  }, [addProject, setActiveProject, setActiveNote]);

  return (
    <SidebarSection
      title="Projects"
      isExpanded={isExpanded}
      onToggle={onToggle}
      rightContent={
        <button
          className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300"
          onClick={(e) => {
            e.stopPropagation();
            handleNewProject();
          }}
          title="New Project"
        >
          <FolderPlus size={14} />
        </button>
      }
    >
      <div className="space-y-1">
        {projects.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            isActive={activeProjectId === project.id}
            onSelect={() => handleSelectProject(project.id)}
          />
        ))}

        {projects.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-gray-500 mb-3">No projects yet</p>
            <button
              onClick={handleNewProject}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Create your first project
            </button>
          </div>
        )}
      </div>
    </SidebarSection>
  );
};

export default ProjectsSection;
