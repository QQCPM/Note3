import React, { useEffect, useRef } from 'react';
import { useNotesStore, useUIStore } from '@/store';
import { createNote, updateNote, deleteNote } from '@/utils/tauri';

const ContextMenu: React.FC = () => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { contextMenu, hideContextMenu } = useUIStore();
  const { addNote, updateNote: updateNoteInStore, deleteNote: deleteNoteInStore, getNoteById, expandNote } = useNotesStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hideContextMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideContextMenu();
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu.visible, hideContextMenu]);

  const handleAddSubPage = async () => {
    if (!contextMenu.noteId) return;

    try {
      const newNote = await createNote({
        title: 'Untitled',
        icon: '📝',
        parent_id: contextMenu.noteId,
      });
      addNote(newNote);
      expandNote(contextMenu.noteId); // Expand parent to show new child
      hideContextMenu();
    } catch (error) {
      console.error('Failed to create sub page:', error);
    }
  };

  const handleRename = async () => {
    if (!contextMenu.noteId) return;

    const note = getNoteById(contextMenu.noteId);
    if (!note) return;

    const newTitle = prompt('Enter new title:', note.title);
    if (newTitle && newTitle.trim() !== note.title) {
      try {
        const updated = await updateNote(contextMenu.noteId, { title: newTitle.trim() });
        updateNoteInStore(contextMenu.noteId, updated);
        hideContextMenu();
      } catch (error) {
        console.error('Failed to rename note:', error);
      }
    } else {
      hideContextMenu();
    }
  };

  const handleDuplicate = async () => {
    if (!contextMenu.noteId) return;

    const note = getNoteById(contextMenu.noteId);
    if (!note) return;

    try {
      const duplicated = await createNote({
        title: `${note.title} (Copy)`,
        icon: note.icon,
        parent_id: note.parent_id,
      });
      addNote(duplicated);
      hideContextMenu();
    } catch (error) {
      console.error('Failed to duplicate note:', error);
    }
  };

  const handleDelete = async () => {
    if (!contextMenu.noteId) return;

    const note = getNoteById(contextMenu.noteId);
    if (!note) return;

    if (confirm(`Are you sure you want to delete "${note.title}"?`)) {
      try {
        await deleteNote(contextMenu.noteId);
        deleteNoteInStore(contextMenu.noteId);
        hideContextMenu();
      } catch (error) {
        console.error('Failed to delete note:', error);
      }
    } else {
      hideContextMenu();
    }
  };

  if (!contextMenu.visible || !contextMenu.position) return null;

  return (
    <div
      ref={menuRef}
      className="context-menu show"
      style={{
        left: `${contextMenu.position.x}px`,
        top: `${contextMenu.position.y}px`,
      }}
    >
      <div className="context-menu-item" onClick={handleAddSubPage}>
        <span>➕</span>
        <span>Add sub page</span>
      </div>
      <div className="context-menu-item" onClick={handleRename}>
        <span>✏️</span>
        <span>Rename</span>
      </div>
      <div className="context-menu-item" onClick={handleDuplicate}>
        <span>📋</span>
        <span>Duplicate</span>
      </div>
      <div className="context-menu-divider"></div>
      <div className="context-menu-item danger" onClick={handleDelete}>
        <span>🗑️</span>
        <span>Delete</span>
      </div>
    </div>
  );
};

export default ContextMenu;
