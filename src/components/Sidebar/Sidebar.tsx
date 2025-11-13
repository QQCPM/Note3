import React from 'react';
import { useNotesStore } from '@/store';
import { createNote } from '@/utils/tauri';
import NoteTree from './NoteTree';

const Sidebar: React.FC = () => {
  const { notes, setActiveNote, addNote } = useNotesStore();

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
    <nav className="w-60 bg-[#010409] flex flex-col flex-shrink-0 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 h-16 flex items-center border-b border-[#30363d]">
        <h1 className="text-lg font-semibold text-white">Weave</h1>
      </div>

      {/* Note Tree */}
      <div className="flex-1 p-3 space-y-1 overflow-y-auto" id="noteTree">
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
