import React, { useState, useCallback } from 'react';
import { ChevronRight, MoreHorizontal, Folder, FileText } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useNotesStore, useFileStore } from '@/store';
import {
  TreeItemWithChildren,
  FileType,
  ItemStatus,
  canHaveChildren,
} from '@/types/project';

// ============================================================================
// TYPES
// ============================================================================

interface TreeNodeProps {
  item: TreeItemWithChildren;
  depth?: number;
  onContextMenu?: (e: React.MouseEvent, itemId: string) => void;
}

// ============================================================================
// STATUS INDICATOR
// ============================================================================

const StatusIndicator: React.FC<{ status: ItemStatus }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <span className="text-green-500 text-xs">✓</span>;
    case 'in_progress':
      return <span className="text-blue-400 text-xs">●</span>;
    case 'skipped':
      return <span className="text-gray-500 text-xs">○</span>;
    default:
      return null;
  }
};

// ============================================================================
// PROGRESS BAR
// ============================================================================

const ProgressBar: React.FC<{ progress: number; size?: 'sm' | 'md' }> = ({
  progress,
  size = 'sm',
}) => {
  const height = size === 'sm' ? 'h-1' : 'h-1.5';
  const width = size === 'sm' ? 'w-12' : 'w-16';

  return (
    <div className={`${width} ${height} bg-gray-700 rounded-full overflow-hidden`}>
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

// ============================================================================
// FILE TYPE ICON
// ============================================================================

const FileIcon: React.FC<{ type: FileType }> = ({ type }) => {
  if (type === 'folder') {
    return <Folder size={14} className="text-yellow-500 flex-shrink-0" />;
  }
  return <FileText size={14} className="text-gray-500 flex-shrink-0" />;
};


// ============================================================================
// TREE NODE COMPONENT
// ============================================================================

const TreeNode: React.FC<TreeNodeProps> = ({
  item,
  depth = 0,
  onContextMenu,
}) => {
  const {
    selectedItemId,
    expandedIds,
    setSelectedItem,
    toggleExpanded,
    getItemProgress,
  } = useProjectStore();

  const { setActiveNote } = useNotesStore();
  const { setActiveFile } = useFileStore();

  const [isHovered, setIsHovered] = useState(false);

  const isSelected = selectedItemId === item.id;
  const isExpanded = expandedIds.has(item.id);
  const hasChildren = item.children && item.children.length > 0;
  const canExpand = canHaveChildren(item.type) || hasChildren;
  const progress = getItemProgress(item.id);
  const isFileType = ['pdf', 'video', 'audio', 'image'].includes(item.type);

  // Handle click on the item
  const handleClick = useCallback(() => {
    setSelectedItem(item.id);

    // If it's a note, set it as active in the notes store
    if (item.type === 'note' && item.noteId) {
      setActiveNote(item.noteId);
    }
    
    // If it's a file, set it as active in the file store
    if (isFileType && item.filePath) {
      setActiveFile(item.filePath); // filePath stores the file ID
    }
  }, [item.id, item.type, item.noteId, item.filePath, isFileType, setSelectedItem, setActiveNote, setActiveFile]);

  // Handle chevron click for expand/collapse
  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (canExpand) {
        toggleExpanded(item.id);
      }
    },
    [canExpand, item.id, toggleExpanded]
  );

  // Handle right-click
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.(e, item.id);
    },
    [item.id, onContextMenu]
  );

  // Calculate left padding based on depth
  const paddingLeft = 8 + depth * 16;

  return (
    <div className="select-none">
      {/* Main Row */}
      <div
        className={`
          group flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer
          transition-colors duration-150
          ${isSelected ? 'bg-[#1f2937] text-white' : 'text-gray-400 hover:bg-[#161b22] hover:text-gray-200'}
        `}
        style={{ paddingLeft }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
        <FileIcon type={item.type} />

        {/* Name */}
        <span className="flex-1 truncate text-sm">{item.name}</span>

        {/* Status Indicator */}
        {item.status !== 'not_started' && (
          <StatusIndicator status={item.status} />
        )}

        {/* Progress (for folders) */}
        {canHaveChildren(item.type) && hasChildren && progress > 0 && (
          <ProgressBar progress={progress} />
        )}

        {/* More Options (on hover) */}
        {isHovered && (
          <button
            className="flex-shrink-0 p-0.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700"
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu?.(e, item.id);
            }}
          >
            <MoreHorizontal size={14} />
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {/* Vertical line indicator */}
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-700"
            style={{ left: paddingLeft + 7 }}
          />
          {item.children.map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode;
