import React from 'react';
import { useNotesStore, useUIStore } from '@/store';
import type { NoteWithChildren } from '@/types';

interface NoteTreeItemProps {
  note: NoteWithChildren;
  level: number;
}

const NoteTreeItem: React.FC<NoteTreeItemProps> = ({ note, level }) => {
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

  return (
    <div className="note-folder">
      <div
        className={`note-tree-item ${isActive ? 'active' : ''}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        <span
          className={`note-chevron ${isExpanded ? 'expanded' : ''}`}
          onClick={handleChevronClick}
          style={{ opacity: hasChildren ? 1 : 0 }}
        >
          ▶
        </span>
        <span className="note-icon">{note.icon}</span>
        <span className="note-title">{note.title}</span>
      </div>

      {/* Render children if expanded */}
      {hasChildren && isExpanded && (
        <div className="sub-notes expanded">
          {note.children!.map((child) => (
            <NoteTreeItem key={child.id} note={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default NoteTreeItem;
