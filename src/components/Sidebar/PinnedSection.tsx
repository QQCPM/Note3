import React, { useCallback } from 'react';
import { X } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useNotesStore } from '@/store';
import { TreeItem, FILE_TYPE_CONFIG } from '@/types/project';

// ============================================================================
// TYPES
// ============================================================================

interface PinnedSectionProps {
  items: TreeItem[];
}

// ============================================================================
// PINNED ITEM COMPONENT
// ============================================================================

interface PinnedItemProps {
  item: TreeItem;
  onSelect: () => void;
  onUnpin: () => void;
}

const PinnedItem: React.FC<PinnedItemProps> = ({ item, onSelect, onUnpin }) => {
  const icon = FILE_TYPE_CONFIG[item.type]?.icon || '📄';

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#161b22] transition-colors"
      onClick={onSelect}
    >
      {/* Icon */}
      <span className="flex-shrink-0 text-sm">{icon}</span>

      {/* Name */}
      <span className="flex-1 text-sm text-gray-300 truncate">{item.name}</span>

      {/* Unpin Button (on hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onUnpin();
        }}
        className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-all"
        title="Unpin"
      >
        <X size={12} />
      </button>
    </div>
  );
};

// ============================================================================
// PINNED SECTION COMPONENT
// ============================================================================

const PinnedSection: React.FC<PinnedSectionProps> = ({ items }) => {
  const { togglePinned, setSelectedItem } = useProjectStore();
  const { setActiveNote } = useNotesStore();

  const handleSelect = useCallback(
    (item: TreeItem) => {
      setSelectedItem(item.id);
      if (item.type === 'note' && item.noteId) {
        setActiveNote(item.noteId);
      }
    },
    [setSelectedItem, setActiveNote]
  );

  const handleUnpin = useCallback(
    (itemId: string) => {
      togglePinned(itemId);
    },
    [togglePinned]
  );

  if (items.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-gray-600 italic">
        Pin items for quick access.
      </div>
    );
  }

  return (
    <div className="px-2 py-1 space-y-0.5">
      {items.map((item) => (
        <PinnedItem
          key={item.id}
          item={item}
          onSelect={() => handleSelect(item)}
          onUnpin={() => handleUnpin(item.id)}
        />
      ))}
    </div>
  );
};

export default PinnedSection;
