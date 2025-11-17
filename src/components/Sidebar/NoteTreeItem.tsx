import React from 'react';
import { useNotesStore, useUIStore } from '@/store';
import type { NoteWithChildren } from '@/types';

interface NoteTreeItemProps {
  note: NoteWithChildren;
}

const NoteTreeItem: React.FC<NoteTreeItemProps> = ({ note }) => {
  const { activeNoteId, setActiveNote, expandedNoteIds, toggleExpanded } = useNotesStore();
  const { showContextMenu } = useUIStore();

  const isActive = activeNoteId === note.id;
  const isExpanded = expandedNoteIds.has(note.id);
  const hasChildren = note.children && note.children.length > 0;

  const handleClick = () => {
    setActiveNote(note.id);
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      toggleExpanded(note.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.pageX, e.pageY, note.id);
  };

  const handleDragStart = (e: React.DragEvent) => {
    // Store note data for dropping on canvas
    e.dataTransfer.setData('application/json', JSON.stringify({
      noteId: note.id,
      title: note.title,
      icon: note.icon,
    }));
    e.dataTransfer.effectAllowed = 'copy';

    // Visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Reset visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  return (
    <div>
      <div
        className={`note-tree-item ${isActive ? 'active' : ''}`}
        draggable={true}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <span
          className={`note-chevron ${isExpanded ? 'expanded' : ''}`}
          onClick={handleChevronClick}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          ▶
        </span>
        <span className="note-icon">{note.icon || '📝'}</span>
        <span className="note-title">{note.title}</span>
      </div>

      {hasChildren && isExpanded && (
        <div className="sub-notes expanded">
          {note.children?.map((child) => (
            <NoteTreeItem key={child.id} note={child} />
          ))}
        </div>
      )}
    </div>
  );
};

export default NoteTreeItem;