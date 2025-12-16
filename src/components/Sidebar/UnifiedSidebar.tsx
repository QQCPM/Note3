import React, { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Calendar,
  Star,
  FolderPlus,
  FileText,
  StickyNote,
} from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useNotesStore, useUIStore } from '@/store';
import { createNote } from '@/utils/tauri';
import TreeNode from './TreeNode';
import TodaySection from './TodaySection';
import PinnedSection from './PinnedSection';
import DropZone from './DropZone';
import { Project, TreeItemWithChildren } from '@/types/project';

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  rightContent?: React.ReactNode;
  count?: number;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  isExpanded,
  onToggle,
  rightContent,
  count,
}) => (
  <div
    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#161b22] rounded-md group"
    onClick={onToggle}
  >
    <span className="text-gray-500 transition-transform duration-200">
      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </span>
    {icon && <span className="text-gray-500">{icon}</span>}
    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1">
      {title}
    </span>
    {count !== undefined && count > 0 && (
      <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
        {count}
      </span>
    )}
    {rightContent && (
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        {rightContent}
      </div>
    )}
  </div>
);

// ============================================================================
// PROJECT ITEM COMPONENT
// ============================================================================

interface ProjectItemProps {
  project: Project;
  isActive: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
  tree: TreeItemWithChildren[];
  onContextMenu?: (e: React.MouseEvent, itemId: string) => void;
}

const ProjectItem: React.FC<ProjectItemProps> = ({
  project,
  isActive,
  isExpanded,
  onSelect,
  onToggle,
  tree,
  onContextMenu,
}) => {
  // Calculate progress bar color
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
          transition-colors duration-150
          ${isActive ? 'bg-[#1f2937]' : 'hover:bg-[#161b22]'}
        `}
        onClick={onSelect}
      >
        <button
          className="text-gray-500 hover:text-gray-300 transition-transform duration-200"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
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
            <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getProgressColor(project.progress)}`}
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{project.progress}%</span>
          </div>
        )}
      </div>

      {/* Project Tree */}
      {isExpanded && (
        <div className="ml-2 mt-1">
          {tree.length > 0 ? (
            tree.map((item) => (
              <TreeNode
                key={item.id}
                item={item}
                depth={0}
                onContextMenu={onContextMenu}
              />
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-600 italic">
              No items yet. Add files or create notes.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN UNIFIED SIDEBAR COMPONENT
// ============================================================================

const UnifiedSidebar: React.FC = () => {
  // Stores
  const {
    projects,
    activeProjectId,
    setActiveProject,
    buildTree,
    todayTasks,
    getPinnedItems,
    addProject,
    addTreeItem,
    initializeDefaults,
  } = useProjectStore();

  const { notes, addNote, setActiveNote, activeNoteId } = useNotesStore();
  const { sidebarCollapsed, showContextMenu } = useUIStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    today: true,
    pinned: true,
    notes: true,
    projects: true,
  });
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );

  // Initialize defaults on mount
  useEffect(() => {
    initializeDefaults();
  }, [initializeDefaults]);

  // Auto-expand active project
  useEffect(() => {
    if (activeProjectId) {
      setExpandedProjects((prev) => new Set([...prev, activeProjectId]));
    }
  }, [activeProjectId]);

  // Toggle section expansion
  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  // Toggle project expansion
  const toggleProject = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  // Handle creating a new project
  const handleNewProject = useCallback(() => {
    const project = addProject({
      name: 'New Project',
      type: 'general',
      icon: '📁',
    });
    setActiveProject(project.id);
    setExpandedProjects((prev) => new Set([...prev, project.id]));
  }, [addProject, setActiveProject]);

  // Handle creating a new note in active project
  const handleNewNote = useCallback(async () => {
    if (!activeProjectId) {
      // Create in default project or first available
      const targetProject = projects[0];
      if (!targetProject) return;
    }

    try {
      // Create note in database
      const newNote = await createNote({
        title: 'Untitled',
        icon: '📄',
        parent_id: null,
      });

      // Add to notes store
      addNote(newNote);

      // Add to project tree
      addTreeItem({
        projectId: activeProjectId || projects[0]?.id || 'default-notes',
        name: newNote.title,
        type: 'note',
        noteId: newNote.id,
      });

      // Set as active
      setActiveNote(newNote.id);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  }, [activeProjectId, projects, addNote, addTreeItem, setActiveNote]);

  // Handle context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, itemId: string) => {
      showContextMenu(e.pageX, e.pageY, itemId);
    },
    [showContextMenu]
  );

  // Get pinned items
  const pinnedItems = getPinnedItems();

  // Filter today's tasks
  const todayTasksFiltered = todayTasks.filter(
    (task) => task.status !== 'completed'
  );

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <nav
      className="sidebar bg-[#010409] flex flex-col flex-shrink-0 rounded-2xl"
      style={{
        width: '280px',
        minWidth: '280px',
        margin: '8px',
        height: 'calc(100vh - 16px)',
        overflow: 'hidden',
      }}
    >
      {/* Search Bar */}
      <div className="p-3 pt-14">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d1117] border border-gray-800 rounded-lg py-2 pl-9 pr-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600">
            ⌘K
          </span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-2 space-y-2">
        {/* Today Section */}
        {todayTasksFiltered.length > 0 && (
          <div>
            <SectionHeader
              title="Today"
              icon={<Calendar size={14} />}
              isExpanded={expandedSections.today}
              onToggle={() => toggleSection('today')}
              count={todayTasksFiltered.length}
            />
            {expandedSections.today && (
              <TodaySection tasks={todayTasksFiltered} />
            )}
          </div>
        )}

        {/* Pinned Section */}
        {pinnedItems.length > 0 && (
          <div>
            <SectionHeader
              title="Pinned"
              icon={<Star size={14} />}
              isExpanded={expandedSections.pinned}
              onToggle={() => toggleSection('pinned')}
              count={pinnedItems.length}
            />
            {expandedSections.pinned && <PinnedSection items={pinnedItems} />}
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-gray-800 mx-2" />

        {/* Notes Section - All notes from database */}
        <div>
          <SectionHeader
            title="Notes"
            icon={<StickyNote size={14} />}
            isExpanded={expandedSections.notes}
            onToggle={() => toggleSection('notes')}
            count={notes.length}
            rightContent={
              <button
                className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNewNote();
                }}
                title="New Note"
              >
                <Plus size={14} />
              </button>
            }
          />

          {expandedSections.notes && (
            <div className="ml-2 space-y-0.5">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer
                      transition-colors duration-150
                      ${activeNoteId === note.id
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'hover:bg-[#161b22] text-gray-400 hover:text-gray-300'
                      }
                    `}
                    onClick={() => setActiveNote(note.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      showContextMenu(e.pageX, e.pageY, note.id);
                    }}
                  >
                    <span className="text-sm">{note.icon || '📄'}</span>
                    <span className="text-sm truncate flex-1">{note.title || 'Untitled'}</span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-gray-600 italic">
                  No notes yet
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-800 mx-2" />

        {/* Projects Section */}
        <div>
          <SectionHeader
            title="Projects"
            isExpanded={expandedSections.projects}
            onToggle={() => toggleSection('projects')}
            rightContent={
              <button
                className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNewProject();
                }}
                title="New Project"
              >
                <Plus size={14} />
              </button>
            }
          />

          {expandedSections.projects && (
            <div className="space-y-1">
              {projects.map((project) => (
                <ProjectItem
                  key={project.id}
                  project={project}
                  isActive={activeProjectId === project.id}
                  isExpanded={expandedProjects.has(project.id)}
                  onSelect={() => setActiveProject(project.id)}
                  onToggle={() => toggleProject(project.id)}
                  tree={buildTree(project.id)}
                  onContextMenu={handleContextMenu}
                />
              ))}

              {projects.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-gray-500 mb-3">
                    No projects yet
                  </p>
                  <button
                    onClick={handleNewProject}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Create your first project
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Drop Zone */}
      <DropZone />

      {/* Bottom Actions */}
      <div className="p-3 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewNote}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#161b22] hover:bg-[#1f2937] text-gray-400 hover:text-white text-xs rounded-lg transition-colors border border-gray-800"
          >
            <FileText size={14} />
            <span>New Note</span>
          </button>
          <button
            onClick={handleNewProject}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#161b22] hover:bg-[#1f2937] text-gray-400 hover:text-white text-xs rounded-lg transition-colors border border-gray-800"
          >
            <FolderPlus size={14} />
            <span>New Project</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default UnifiedSidebar;
