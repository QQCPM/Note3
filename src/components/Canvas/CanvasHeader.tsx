import React, { useState } from 'react';
import { useNotesStore } from '@/store';
import { updateNote } from '@/utils/tauri';
import type { Note } from '@/types';

interface CanvasHeaderProps {
  note: Note | null;
}

const CanvasHeader: React.FC<CanvasHeaderProps> = ({ note }) => {
  const { updateNote: updateNoteInStore } = useNotesStore();
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
    <header className="h-16 bg-bg-primary border-b border-border flex items-center justify-between px-6 flex-shrink-0">
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
      <div className="text-xs text-text-tertiary">
        Type <kbd className="px-2 py-1 bg-bg-tertiary rounded text-text-secondary">/</kbd> for commands
      </div>
    </header>
  );
};

export default CanvasHeader;
