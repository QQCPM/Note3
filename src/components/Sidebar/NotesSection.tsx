import React, { useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useNotesStore } from '@/store/notesStore';
import { createNote } from '@/utils/tauri';
import SidebarSection from './SidebarSection';
import SidebarItem from './SidebarItem';

interface NotesSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
}

const NotesSection: React.FC<NotesSectionProps> = ({ isExpanded, onToggle }) => {
  const { buildStandaloneTree, addNote, setActiveNote } = useNotesStore();

  const standaloneTree = buildStandaloneTree();

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
        project_id: null,  // Standalone note - no project
        type: 'note' as const,
        is_pinned: false,
      };

      addNote(standaloneNote);
      setActiveNote(standaloneNote.id);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  }, [addNote, setActiveNote]);

  return (
    <SidebarSection
      title="Notes"
      isExpanded={isExpanded}
      onToggle={onToggle}
      count={standaloneTree.length}
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
    >
      <div className="space-y-0.5">
        {standaloneTree.length > 0 ? (
          standaloneTree.map((note) => (
            <SidebarItem key={note.id} note={note} depth={0} />
          ))
        ) : (
          <div className="px-4 py-3 text-sm text-gray-600 italic">
            No notes yet
          </div>
        )}
      </div>
    </SidebarSection>
  );
};

export default NotesSection;
