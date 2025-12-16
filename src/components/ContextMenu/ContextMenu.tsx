import React, { useEffect, useRef } from 'react';
import { useNotesStore, useUIStore } from '@/store';
import { useProjectStore } from '@/store/projectStore';
import { createNote, updateNote, deleteNote } from '@/utils/tauri';
import { ask } from '@tauri-apps/plugin-dialog';

const ContextMenu: React.FC = () => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { contextMenu, hideContextMenu } = useUIStore();
  const { addNote, updateNote: updateNoteInStore, deleteNote: deleteNoteInStore, getNoteById, expandNote } = useNotesStore();
  const { projects, activeProjectId, addTreeItem, deleteTreeItem, treeItems } = useProjectStore();

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
      
      // Also add to project tree
      const parentTreeItem = treeItems.find(item => item.noteId === contextMenu.noteId);
      addTreeItem({
        projectId: parentTreeItem?.projectId || activeProjectId || projects[0]?.id || 'default-notes',
        parentId: parentTreeItem?.id || null,
        name: newNote.title,
        type: 'note',
        noteId: newNote.id,
      });
      
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
      
      // Also add to project tree
      const originalTreeItem = treeItems.find(item => item.noteId === contextMenu.noteId);
      addTreeItem({
        projectId: originalTreeItem?.projectId || activeProjectId || projects[0]?.id || 'default-notes',
        parentId: originalTreeItem?.parentId || null,
        name: duplicated.title,
        type: 'note',
        noteId: duplicated.id,
      });
      
      hideContextMenu();
    } catch (error) {
      console.error('Failed to duplicate note:', error);
    }
  };

  const handleDelete = async () => {
    if (!contextMenu.noteId) return;

    const note = getNoteById(contextMenu.noteId);
    if (!note) return;

    try {
      const confirmed = await ask(`Are you sure you want to delete "${note.title}"?`, {
        title: 'Delete Note',
        kind: 'warning',
      });

      if (confirmed) {
        await deleteNote(contextMenu.noteId);
        deleteNoteInStore(contextMenu.noteId);
        
        // Also remove from project tree
        const treeItem = treeItems.find(item => item.noteId === contextMenu.noteId);
        if (treeItem) {
          deleteTreeItem(treeItem.id);
        }
        
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
