import React from 'react';
import { useNotesStore, useUIStore } from '@/store';
import { createNote } from '@/utils/tauri';
import NoteTree from './NoteTree';

const Sidebar: React.FC = () => {
  const { notes, setActiveNote, addNote } = useNotesStore();
  const { sidebarCollapsed } = useUIStore();

  const handleNewPage = async () => {
    try {
      const newNote = await createNote({
        title: 'Untitled',
        icon: '📝',
        parent_id: null,
      });
      addNote(newNote);
      setActiveNote(newNote.id);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  return (
    <nav
      className={`sidebar bg-[#010409] flex flex-col flex-shrink-0 rounded-lg ${sidebarCollapsed ? 'collapsed' : ''}`}
      style={{
        width: sidebarCollapsed ? '0' : '240px',
        minWidth: sidebarCollapsed ? '0' : '240px',
        overflowX: sidebarCollapsed ? 'hidden' : 'visible',
        overflowY: 'auto',
        visibility: sidebarCollapsed ? 'hidden' : 'visible',
        position: 'relative',
        zIndex: 1,
        transition: 'width 0.3s ease, min-width 0.3s ease',
      }}
    >

      {/* Note Tree - Added top padding for HeaderDock */}
      <div className="flex-1 p-3 pt-14 space-y-1 overflow-y-auto overflow-x-visible" id="noteTree" style={{ position: 'relative', zIndex: 1 }}>
        <NoteTree notes={notes} />
      </div>

      {/* New Page Button */}
      <div className="p-4">
        <button
          onClick={handleNewPage}
          className="w-full px-3 py-2 bg-transparent text-gray-400 hover:text-white text-sm transition-all text-left"
        >
          + New Page
        </button>
      </div>
    </nav>
  );
};

export default Sidebar;
