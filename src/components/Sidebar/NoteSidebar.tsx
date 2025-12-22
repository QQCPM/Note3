import React, { useState, useCallback } from 'react';
import { FileText, FolderPlus } from 'lucide-react';
import { useUIStore } from '@/store';
import { useNotesStore } from '@/store/notesStore';
import { createNote } from '@/utils/tauri';
import SidebarSearch from './SidebarSearch';
import PinnedSection from './PinnedSection';
import NotesSection from './NotesSection';
import ProjectsSection from './ProjectsSection';
import DropZone from './DropZone';
import { useProjectStore } from '@/store/projectStore';

const NoteSidebar: React.FC = () => {
  const { sidebarCollapsed } = useUIStore();
  const { addNote, setActiveNote } = useNotesStore();
  const { addProject, setActiveProject } = useProjectStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    pinned: true,
    notes: true,
    projects: true,
  });

  // Toggle section expansion
  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  // Create new standalone note
  const handleNewNote = useCallback(async () => {
    try {
      // Create note in database (backend doesn't know about new fields)
      const dbNote = await createNote({
        title: 'Untitled',
        icon: '📄',
        parent_id: null,
      });

      // Merge with new fields for the store
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

  // Create new project
  const handleNewProject = useCallback(() => {
    const project = addProject({
      name: 'New Project',
      type: 'general',
      icon: '📁',
    });
    setActiveProject(project.id);
  }, [addProject, setActiveProject]);

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
        <SidebarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search..."
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-2 space-y-2">
        {/* Pinned Section */}
        <PinnedSection
          isExpanded={expandedSections.pinned}
          onToggle={() => toggleSection('pinned')}
        />

        {/* Divider (only if pinned has content) */}
        <div className="h-px bg-gray-800 mx-2" />

        {/* Notes Section */}
        <NotesSection
          isExpanded={expandedSections.notes}
          onToggle={() => toggleSection('notes')}
        />

        {/* Divider */}
        <div className="h-px bg-gray-800 mx-2" />

        {/* Projects Section */}
        <ProjectsSection
          isExpanded={expandedSections.projects}
          onToggle={() => toggleSection('projects')}
        />
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

export default NoteSidebar;
