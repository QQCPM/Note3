import React, { useState } from 'react';
import { useNotesStore, useUIStore } from '@/store';
import { updateNote } from '@/utils/tauri';
import type { Note } from '@/types';

interface CanvasHeaderProps {
  note: Note | null;
}

const CanvasHeader: React.FC<CanvasHeaderProps> = ({ note }) => {
  const { updateNote: updateNoteInStore } = useNotesStore();
  const { canvasMode } = useUIStore();
  const [title, setTitle] = useState(note?.title || '');
  const [icon, setIcon] = useState(note?.icon || '📝');

  React.useEffect(() => {
    if (note) {
      setTitle(note.title);
      setIcon(note.icon);
    }
  }, [note]);

  const handleTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);

    if (note) {
      try {
        const updated = await updateNote(note.id, { title: newTitle });
        updateNoteInStore(note.id, updated);
      } catch (error) {
        console.error('Failed to update note:', error);
      }
    }
  };

  const handleIconClick = () => {
    const newIcon = prompt('Enter an emoji for the icon:', icon);
    if (newIcon && note) {
      setIcon(newIcon);
      updateNote(note.id, { icon: newIcon })
        .then((updated) => updateNoteInStore(note.id, updated))
        .catch((error) => console.error('Failed to update icon:', error));
    }
  };

  if (!note) return null;

  return (
    <header className="h-16 bg-[#0d1117] border-b border-[#30363d] flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <span
          className="text-2xl cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleIconClick}
          title="Click to change icon"
        >
          {icon}
        </span>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          className="text-lg font-semibold bg-transparent border-none outline-none text-white"
          placeholder="Untitled"
        />
      </div>

      {/* Mode Hint */}
      <div className="text-xs text-gray-500">
        {canvasMode === 'note'
          ? <>Type <kbd className="px-2 py-1 bg-[#161b22] rounded text-gray-400">/</kbd> for commands</>
          : 'Scroll to zoom • Drag to pan'
        }
      </div>
    </header>
  );
};

export default CanvasHeader;
