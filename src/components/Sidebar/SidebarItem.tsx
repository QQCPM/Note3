import React from 'react';
import { ChevronRight, MoreHorizontal, Folder, Pin } from 'lucide-react';
import { useNotesStore } from '@/store/notesStore';
import { useUIStore } from '@/store';
import { NoteWithChildren } from '@/types';

interface SidebarItemProps {
  note: NoteWithChildren;
  depth?: number;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ note, depth = 0 }) => {
  const { activeNoteId, setActiveNote, expandedIds, toggleExpanded } = useNotesStore();
  const { showContextMenu } = useUIStore();

  const isActive = activeNoteId === note.id;
  const isExpanded = expandedIds.has(note.id);
  const hasChildren = note.children && note.children.length > 0;
  const isFolder = note.type === 'folder';
  const canExpand = isFolder || hasChildren;

  const handleClick = () => {
    setActiveNote(note.id);
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canExpand) {
      toggleExpanded(note.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.pageX, e.pageY, note.id, null);
  };

  const paddingLeft = 12 + depth * 16;

  return (
    <div className="select-none">
      {/* Main Row */}
      <div
        className={`
          group flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer
          transition-colors duration-150
          ${isActive 
            ? 'bg-blue-500/20 text-blue-300' 
            : 'text-gray-400 hover:bg-[#161b22] hover:text-gray-200'
          }
        `}
        style={{ paddingLeft }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/Collapse Chevron */}
        <button
          className={`
            flex-shrink-0 w-4 h-4 flex items-center justify-center
            text-gray-500 hover:text-gray-300 transition-transform duration-200
            ${isExpanded ? 'rotate-90' : ''}
            ${!canExpand ? 'invisible' : ''}
          `}
          onClick={handleChevronClick}
        >
          <ChevronRight size={14} />
        </button>

        {/* Icon */}
        {isFolder ? (
          <Folder size={14} className="text-yellow-500 flex-shrink-0" />
        ) : (
          <span className="text-sm flex-shrink-0">{note.icon || '📄'}</span>
        )}

        {/* Title */}
        <span className="flex-1 truncate text-sm">{note.title || 'Untitled'}</span>

        {/* Pinned indicator */}
        {note.is_pinned && (
          <Pin size={10} className="text-yellow-500 flex-shrink-0" />
        )}

        {/* More Options (on hover) */}
        <button
          className="flex-shrink-0 p-0.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            handleContextMenu(e);
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {/* Vertical line indicator */}
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-700/50"
            style={{ left: paddingLeft + 7 }}
          />
          {note.children!.map((child) => (
            <SidebarItem
              key={child.id}
              note={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SidebarItem;
