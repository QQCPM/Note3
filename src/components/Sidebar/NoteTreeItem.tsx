import React, { useState, useRef } from 'react';
import { useNotesStore, useUIStore } from '@/store';
import { useDragStore } from '@/store/dragStore';
import type { NoteWithChildren } from '@/types';

interface NoteTreeItemProps {
  note: NoteWithChildren;
}

const NoteTreeItem: React.FC<NoteTreeItemProps> = ({ note }) => {
  const { activeNoteId, setActiveNote, expandedNoteIds, toggleExpanded } = useNotesStore();
  const { showContextMenu, canvasMode } = useUIStore();
  const { startDrag, updateDragPosition, endDrag } = useDragStore();

  const [isMouseDown, setIsMouseDown] = useState(false);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasDragStartedRef = useRef(false);

  const isActive = activeNoteId === note.id;
  const isExpanded = expandedNoteIds.has(note.id);
  const hasChildren = note.children && note.children.length > 0;
  const isDraggable = canvasMode === 'canvas';

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

  // Custom drag implementation for canvas mode
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDraggable) return;

    // Ignore if clicking on chevron
    if ((e.target as HTMLElement).classList.contains('note-chevron')) {
      return;
    }

    setIsMouseDown(true);
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasDragStartedRef.current = false;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isMouseDown || !dragStartPosRef.current || !isDraggable) return;

    const dx = e.clientX - dragStartPosRef.current.x;
    const dy = e.clientY - dragStartPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Start drag after moving 5px (prevents accidental drags on clicks)
    if (distance > 5 && !hasDragStartedRef.current) {
      hasDragStartedRef.current = true;
      startDrag(
        {
          noteId: note.id,
          title: note.title,
          icon: note.icon || '📝',
        },
        { x: e.clientX, y: e.clientY }
      );
    }

    // Update drag position
    if (hasDragStartedRef.current) {
      updateDragPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (hasDragStartedRef.current) {
      endDrag();
    } else if (isMouseDown && !hasDragStartedRef.current) {
      // If we didn't drag, treat it as a click
      handleClick();
    }

    setIsMouseDown(false);
    dragStartPosRef.current = null;
    hasDragStartedRef.current = false;
  };

  // Attach global mouse event listeners when mouse is down
  React.useEffect(() => {
    if (isMouseDown) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isMouseDown, isDraggable]);

  return (
    <div>
      <div
        className={`note-tree-item ${isActive ? 'active' : ''}`}
        onClick={isDraggable ? undefined : handleClick}
        onMouseDown={isDraggable ? handleMouseDown : undefined}
        onContextMenu={handleContextMenu}
        style={{
          cursor: isDraggable ? 'grab' : 'pointer',
          userSelect: isDraggable ? 'none' : 'auto',
        }}
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