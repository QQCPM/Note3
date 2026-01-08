import React, { useState, useCallback } from 'react';
import { FileText, FolderPlus, ArrowLeft, ChevronRight, Plus, Bot } from 'lucide-react';
import { useUIStore } from '@/store';
import { useNotesStore } from '@/store/notesStore';
import { useProjectStore } from '@/store/projectStore';
import { createNote, deleteNote as deleteNoteDb } from '@/utils/tauri';
import SidebarSearch from './SidebarSearch';
import PinnedSection from './PinnedSection';
import NotesSection from './NotesSection';
import ProjectsSection from './ProjectsSection';
import DropZone from './DropZone';

// ============================================================================
// AI GUIDANCE SECTION (for project mode)
// ============================================================================
const AIGuidanceSection: React.FC<{ projectId: string }> = ({ projectId }) => {
  const guidanceFiles = [
    { id: `${projectId}-instructions`, name: 'instructions.md' },
    { id: `${projectId}-context`, name: 'context.md' },
  ];

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-header flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          🤖 AI Guidance
        </span>
        <button className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300">
          <Plus size={14} />
        </button>
      </div>
      <div className="space-y-1 px-2">
        {guidanceFiles.map((file) => (
          <button
            key={file.id}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors"
          >
            <Bot size={14} className="text-blue-400" />
            <span>{file.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// PROJECT NOTES TREE (for project mode)
// ============================================================================
interface TreeItemProps {
  item: any;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onClick: () => void;
  onAddSubNote: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const TreeItem: React.FC<TreeItemProps> = ({
  item,
  depth,
  isExpanded,
  hasChildren,
  onToggle,
  onClick,
  onAddSubNote,
  onDuplicate,
  onDelete,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  return (
    <div
      className={`group flex items-center gap-1 py-1.5 px-2 text-sm cursor-pointer hover:bg-gray-800/50 rounded-lg transition-colors relative ${item.type === 'folder' ? 'text-gray-500' : 'text-gray-300'
        }`}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      onClick={item.type === 'folder' ? onToggle : onClick}
    >
      {hasChildren ? (
        <button
          className={`flex-shrink-0 w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''
            }`}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          <ChevronRight size={14} />
        </button>
      ) : (
        <span className="w-4 flex-shrink-0" />
      )}
      <span className="flex-1 truncate">{item.name}</span>

      {/* 3-dot menu */}
      <div ref={menuRef} className="relative">
        <button
          className="p-0.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        >
          ⋯
        </button>
        {showMenu && (
          <div
            className="fixed bg-[#1c2128] border border-gray-700 rounded-lg shadow-xl min-w-[120px] py-1"
            style={{
              zIndex: 9999,
              top: menuRef.current ? menuRef.current.getBoundingClientRect().bottom + 4 : 0,
              left: menuRef.current ? Math.min(menuRef.current.getBoundingClientRect().right - 120, window.innerWidth - 130) : 0,
            }}
          >
            <button
              className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700"
              onClick={(e) => { e.stopPropagation(); onAddSubNote(); setShowMenu(false); }}
            >
              + Add sub-note
            </button>
            <button
              className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700"
              onClick={(e) => { e.stopPropagation(); onDuplicate(); setShowMenu(false); }}
            >
              Duplicate
            </button>
            <button
              className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-gray-700"
              onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const ProjectNotesSection: React.FC<{ projectId: string }> = ({ projectId }) => {
  // Use notesStore.buildTreeForProject instead of projectStore.buildTree
  // This ensures notes are synced with the main notes store
  const { buildTreeForProject, setActiveNote, addNote, deleteNote, activeNoteId, toggleExpanded: toggleNoteExpanded, expandedIds: noteExpandedIds } = useNotesStore();

  const tree = buildTreeForProject(projectId);

  const handleAddSubNote = async (parentNote: any) => {
    try {
      const dbNote = await createNote({
        title: 'Untitled',
        icon: '📄',
        parent_id: parentNote.id, // Use note's id as parent_id
      });
      const subNote = {
        ...dbNote,
        project_id: projectId,
        type: 'note' as const,
        is_pinned: false,
      };
      addNote(subNote);
      // Expand parent to show new child
      if (!noteExpandedIds.has(parentNote.id)) {
        toggleNoteExpanded(parentNote.id);
      }
      setActiveNote(dbNote.id);
    } catch (error) {
      console.error('Failed to create sub-note:', error);
    }
  };

  const handleDuplicate = async (note: any) => {
    try {
      const dbNote = await createNote({
        title: `${note.title} (copy)`,
        icon: note.icon || '📄',
        parent_id: note.parent_id, // Keep same parent
      });
      const duplicatedNote = {
        ...dbNote,
        project_id: projectId,
        type: 'note' as const,
        is_pinned: false,
      };
      addNote(duplicatedNote);
      setActiveNote(dbNote.id);
    } catch (error) {
      console.error('Failed to duplicate:', error);
    }
  };

  const handleDelete = async (note: any) => {
    if (!confirm(`Delete "${note.title || 'Untitled'}"?`)) return;
    try {
      await deleteNoteDb(note.id);
      deleteNote(note.id);
      if (activeNoteId === note.id) {
        setActiveNote(null);
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const renderTree = (notes: any[], depth = 0): React.ReactNode =>
    notes.map((note) => {
      const hasChildren = note.children?.length > 0;
      const isExpanded = noteExpandedIds.has(note.id);
      // Adapt note to TreeItem interface expected by TreeItem component
      const item = {
        id: note.id,
        name: note.title || 'Untitled',
        type: 'note',
        noteId: note.id,
        children: note.children,
      };
      return (
        <React.Fragment key={note.id}>
          <TreeItem
            item={item}
            depth={depth}
            isExpanded={isExpanded}
            hasChildren={hasChildren}
            onToggle={() => toggleNoteExpanded(note.id)}
            onClick={() => setActiveNote(note.id)}
            onAddSubNote={() => handleAddSubNote(note)}
            onDuplicate={() => handleDuplicate(note)}
            onDelete={() => handleDelete(note)}
          />
          {hasChildren && isExpanded && renderTree(note.children, depth + 1)}
        </React.Fragment>
      );
    });

  const handleAddRootNote = async () => {
    try {
      const dbNote = await createNote({
        title: 'Untitled',
        icon: '📄',
        parent_id: null,
      });
      const newNote = {
        ...dbNote,
        project_id: projectId,
        type: 'note' as const,
        is_pinned: false,
      };
      addNote(newNote);
      setActiveNote(dbNote.id);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  return (
    <div className="sidebar-section flex-1 overflow-hidden flex flex-col">
      <div className="sidebar-section-header flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          📝 Project Notes
        </span>
        <button
          className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300"
          onClick={handleAddRootNote}
          title="Add note"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1">
        {tree.length > 0 ? (
          renderTree(tree)
        ) : (
          <p className="px-4 py-3 text-sm text-gray-600">No notes yet</p>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// PROJECT MODE SIDEBAR CONTENT
// ============================================================================
const ProjectModeSidebar: React.FC<{ projectId: string; onBack: () => void }> = ({
  projectId,
  onBack,
}) => {
  const { getProjectById } = useProjectStore();
  const project = getProjectById(projectId);

  if (!project) return null;

  return (
    <>
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors border-b border-gray-800"
      >
        <ArrowLeft size={16} />
        <span>Back to Overview</span>
      </button>

      {/* Project Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{project.icon}</span>
          <div>
            <h2 className="text-sm font-medium text-white">{project.name}</h2>
            {project.progress !== undefined && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{project.progress}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <AIGuidanceSection projectId={projectId} />
        <div className="h-px bg-gray-800 mx-3" />
        <ProjectNotesSection projectId={projectId} />
      </div>
    </>
  );
};

// ============================================================================
// GLOBAL MODE SIDEBAR CONTENT
// ============================================================================

const GlobalModeSidebar: React.FC<{
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  expandedSections: { pinned: boolean; notes: boolean; projects: boolean };
  toggleSection: (s: 'pinned' | 'notes' | 'projects') => void;
}> = ({ searchQuery, setSearchQuery, expandedSections, toggleSection }) => (
  <>
    {/* Search Bar */}
    <div className="p-3 pt-14">
      <SidebarSearch
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search..."
      />
    </div>

    {/* Scrollable Content */}
    <div className="flex-1 overflow-y-auto px-2 space-y-2">
      <PinnedSection
        isExpanded={expandedSections.pinned}
        onToggle={() => toggleSection('pinned')}
      />
      <div className="h-px bg-gray-800 mx-2" />
      <NotesSection
        isExpanded={expandedSections.notes}
        onToggle={() => toggleSection('notes')}
      />
      <div className="h-px bg-gray-800 mx-2" />
      <ProjectsSection
        isExpanded={expandedSections.projects}
        onToggle={() => toggleSection('projects')}
      />
    </div>
  </>
);

// ============================================================================
// MAIN SIDEBAR COMPONENT
// ============================================================================
const NoteSidebar: React.FC = () => {
  const { sidebarCollapsed } = useUIStore();
  const { addNote, setActiveNote } = useNotesStore();
  const { addProject, setActiveProject, activeProjectId } = useProjectStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    pinned: true,
    notes: true,
    projects: true,
  });

  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleNewNote = useCallback(async () => {
    try {
      const dbNote = await createNote({
        title: 'Untitled',
        icon: '📄',
        parent_id: null,
      });
      const standaloneNote = {
        ...dbNote,
        project_id: null,
        type: 'note' as const,
        is_pinned: false,
      };
      addNote(standaloneNote);
      setActiveNote(standaloneNote.id);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  }, [addNote, setActiveNote]);

  const handleNewProject = useCallback(() => {
    const project = addProject({
      name: 'New Project',
      type: 'general',
      icon: '📁',
    });
    setActiveProject(project.id);
  }, [addProject, setActiveProject]);

  const handleBackToOverview = useCallback(() => {
    setActiveProject(null);
  }, [setActiveProject]);

  if (sidebarCollapsed) return null;

  // Determine mode based on activeProjectId
  const isProjectMode = !!activeProjectId;

  return (
    <nav
      className="sidebar bg-[#010409] flex flex-col flex-shrink-0 rounded-2xl"
      style={{
        width: '260px',
        minWidth: '260px',
        margin: '8px',
        height: 'calc(100vh - 16px)',
        overflow: 'hidden',
      }}
    >
      {isProjectMode ? (
        <ProjectModeSidebar
          projectId={activeProjectId}
          onBack={handleBackToOverview}
        />
      ) : (
        <GlobalModeSidebar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
        />
      )}

      {/* Drop Zone (only in global mode) */}
      {!isProjectMode && <DropZone />}

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
          {!isProjectMode && (
            <button
              onClick={handleNewProject}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#161b22] hover:bg-[#1f2937] text-gray-400 hover:text-white text-xs rounded-lg transition-colors border border-gray-800"
            >
              <FolderPlus size={14} />
              <span>New Project</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NoteSidebar;
