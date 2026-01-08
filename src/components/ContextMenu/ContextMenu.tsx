import React, { useEffect, useRef } from 'react';
import { useNotesStore, useUIStore } from '@/store';
import { createNote, updateNote, deleteNote } from '@/utils/tauri';
import { ask } from '@tauri-apps/plugin-dialog';

const ContextMenu: React.FC = () => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { contextMenu, hideContextMenu } = useUIStore();
  const {
    addNote,
    updateNote: updateNoteInStore,
    deleteNote: deleteNoteInStore,
    getNoteById,
    expandNote,
    setActiveNote,
    togglePinned
  } = useNotesStore();

  // In the new unified model, we only deal with notes
  const isNoteContext = contextMenu.noteId != null && contextMenu.noteId !== '';
  const note = isNoteContext ? getNoteById(contextMenu.noteId!) : null;

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
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      document.addEventListener('keydown', handleEscape);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu.visible, hideContextMenu]);

  // ============================================================================
  // NOTE ACTIONS (unified for all notes)
  // ============================================================================

  const handleAddSubPage = async () => {
    if (!contextMenu.noteId || !note) return;

    try {
      // Create in database (backend doesn't know new fields)
      const dbNote = await createNote({
        title: 'Untitled',
        icon: '📝',
        parent_id: contextMenu.noteId,
      });

      // Merge with new fields - inherit project from parent
      const subPage = {
        ...dbNote,
        project_id: note.project_id,
        type: 'note' as const,
        is_pinned: false,
      };

      addNote(subPage);
      expandNote(contextMenu.noteId);
      setActiveNote(subPage.id);
      hideContextMenu();
    } catch (error) {
      console.error('Failed to create sub page:', error);
    }
  };

  const handleAddFolder = async () => {
    if (!contextMenu.noteId || !note) return;

    const folderName = prompt('Enter folder name:', 'New Folder');
    if (!folderName || !folderName.trim()) {
      hideContextMenu();
      return;
    }

    try {
      // Create in database
      const dbFolder = await createNote({
        title: folderName.trim(),
        icon: '📁',
        parent_id: contextMenu.noteId,
      });

      // Merge with new fields - inherit project from parent
      const folder = {
        ...dbFolder,
        project_id: note.project_id,
        type: 'folder' as const,
        is_pinned: false,
      };

      addNote(folder);
      expandNote(contextMenu.noteId);
      hideContextMenu();
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleRename = async () => {
    if (!contextMenu.noteId || !note) return;

    const newTitle = prompt('Enter new title:', note.title);
    if (newTitle && newTitle.trim() !== note.title) {
      try {
        const trimmedTitle = newTitle.trim();
        const updated = await updateNote(contextMenu.noteId, { title: trimmedTitle });
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
    if (!contextMenu.noteId || !note) return;

    try {
      // Create in database
      const dbNote = await createNote({
        title: `${note.title} (Copy)`,
        icon: note.icon,
        parent_id: note.parent_id,
      });

      // Merge with new fields - keep same project as original
      const duplicated = {
        ...dbNote,
        project_id: note.project_id,
        type: note.type,
        is_pinned: false,
      };

      addNote(duplicated);
      hideContextMenu();
    } catch (error) {
      console.error('Failed to duplicate note:', error);
    }
  };

  const handleTogglePin = () => {
    if (!contextMenu.noteId) return;
    togglePinned(contextMenu.noteId);
    hideContextMenu();
  };

  const handleDelete = async () => {
    if (!contextMenu.noteId || !note) return;

    try {
      const confirmed = await ask(`Are you sure you want to delete "${note.title}"?`, {
        title: 'Delete Note',
        kind: 'warning',
      });

      if (confirmed) {
        await deleteNote(contextMenu.noteId);
        deleteNoteInStore(contextMenu.noteId);
        hideContextMenu();
      } else {
        hideContextMenu();
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
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
      {isNoteContext && note ? (
        <>
          <div className="context-menu-item" onClick={handleAddSubPage}>
            <span>📝</span>
            <span>Add sub page</span>
          </div>
          <div className="context-menu-item" onClick={handleAddFolder}>
            <span>📁</span>
            <span>Add folder</span>
          </div>
          <div className="context-menu-divider"></div>
          <div className="context-menu-item" onClick={handleRename}>
            <span>✏️</span>
            <span>Rename</span>
          </div>
          <div className="context-menu-item" onClick={handleDuplicate}>
            <span>📋</span>
            <span>Duplicate</span>
          </div>
          <div className="context-menu-item" onClick={handleTogglePin}>
            <span>{note.is_pinned ? '📌' : '📍'}</span>
            <span>{note.is_pinned ? 'Unpin' : 'Pin'}</span>
          </div>
          <div className="context-menu-divider"></div>
          <div className="context-menu-item danger" onClick={handleDelete}>
            <span>🗑️</span>
            <span>Delete</span>
          </div>
        </>
      ) : (
        <div className="context-menu-item text-gray-500">
          <span>No actions available</span>
        </div>
      )}
    </div>
  );
};

export default ContextMenu;
