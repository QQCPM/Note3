import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useNotesStore } from '@/store/notesStore';
import { useFileStore } from '@/store/fileStore';
import { useAIStore } from '@/store/aiStore';
import { createNote, deleteNote as deleteNoteDb } from '@/utils/tauri';
import { NoteWithChildren } from '@/types';

interface SidebarItemProps {
  note: NoteWithChildren;
  depth?: number;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ note, depth = 0 }) => {
  const { activeNoteId, setActiveNote, expandedIds, toggleExpanded, addNote, deleteNote } = useNotesStore();
  const { setActiveFile } = useFileStore();
  const { switchSession } = useAIStore();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = activeNoteId === note.id;
  const isExpanded = expandedIds.has(note.id);
  const hasChildren = note.children && note.children.length > 0;

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleClick = () => {
    setActiveFile(null);   // Close any open file (PDF/video/etc.)
    setActiveNote(note.id);
    switchSession(note.id); // Switch AI session to this note
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpanded(note.id);
  };

  const handleAddSubNote = useCallback(async () => {
    setShowMenu(false);
    try {
      const dbNote = await createNote({
        title: 'Untitled',
        icon: '📄',
        parent_id: note.id,
      });
      addNote({
        ...dbNote,
        project_id: note.project_id,
        type: 'note' as const,
        is_pinned: false,
      });
      setActiveNote(dbNote.id);
      if (!isExpanded) toggleExpanded(note.id);
    } catch (error) {
      console.error('Failed to create sub-note:', error);
    }
  }, [note.id, note.project_id, addNote, setActiveNote, toggleExpanded, isExpanded]);

  const handleDuplicate = useCallback(async () => {
    setShowMenu(false);
    try {
      const dbNote = await createNote({
        title: `${note.title} (copy)`,
        icon: note.icon || '📄',
        parent_id: note.parent_id,
      });
      addNote({
        ...dbNote,
        project_id: note.project_id,
        type: note.type,
        is_pinned: false,
      });
      setActiveNote(dbNote.id);
    } catch (error) {
      console.error('Failed to duplicate:', error);
    }
  }, [note, addNote, setActiveNote]);

  const handleDelete = useCallback(async () => {
    setShowMenu(false);
    if (!confirm(`Delete "${note.title || 'Untitled'}"?`)) return;
    try {
      await deleteNoteDb(note.id);
      deleteNote(note.id);
      if (activeNoteId === note.id) setActiveNote(null);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }, [note.id, note.title, deleteNote, activeNoteId, setActiveNote]);

  const paddingLeft = 8 + depth * 16;

  return (
    <div className="select-none">
      <div
        className={`
          group flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer
          transition-colors duration-150 text-sm relative
          ${isActive ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}
        `}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        {/* Chevron */}
        {hasChildren ? (
          <button
            className={`flex-shrink-0 w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            onClick={handleChevronClick}
          >
            <ChevronRight size={14} />
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Title */}
        <span className="flex-1 truncate">{note.title || 'Untitled'}</span>

        {/* 3-dot menu button */}
        <div ref={menuRef} className="relative">
          <button
            className="p-0.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          >
            ⋯
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[#1c2128] border border-gray-700 rounded-lg shadow-xl z-50 min-w-[120px] py-1">
              <button
                className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700"
                onClick={(e) => { e.stopPropagation(); handleAddSubNote(); }}
              >
                + Add sub-note
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700"
                onClick={(e) => { e.stopPropagation(); handleDuplicate(); }}
              >
                Duplicate
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-gray-700"
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {note.children!.map((child) => (
            <SidebarItem key={child.id} note={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SidebarItem;
