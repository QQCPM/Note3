import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, FolderPlus } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useNotesStore } from '@/store/notesStore';
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
  const { buildTreeForProject, addNote, setActiveNote } = useNotesStore();
  
  const projectNotes = buildTreeForProject(project.id);

  const handleAddNote = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Create note in database (backend doesn't know about new fields)
      const dbNote = await createNote({
        title: 'Untitled',
        icon: '📄',
        parent_id: null,
      });

      // Merge with new fields for the store (project_id is the key!)
      const noteWithProject = {
        ...dbNote,
        project_id: project.id,  // This is what makes it appear in Projects
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
          transition-colors duration-150 group
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

        {/* Add note button */}
        <button
          className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleAddNote}
          title="Add note to project"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Project Notes */}
      {isExpanded && (
        <div className="ml-2 mt-1">
          {projectNotes.length > 0 ? (
            projectNotes.map((note) => (
              <SidebarItem key={note.id} note={note} depth={0} />
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-600 italic">
              No notes in this project
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ProjectsSection: React.FC<ProjectsSectionProps> = ({ isExpanded, onToggle }) => {
  const { projects, activeProjectId, setActiveProject, addProject } = useProjectStore();

  const handleNewProject = useCallback(() => {
    const project = addProject({
      name: 'New Project',
      type: 'general',
      icon: '📁',
    });
    setActiveProject(project.id);
  }, [addProject, setActiveProject]);

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
            onSelect={() => setActiveProject(project.id)}
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
