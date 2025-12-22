import React from 'react';
import { Star } from 'lucide-react';
import { useNotesStore } from '@/store/notesStore';
import SidebarSection from './SidebarSection';
import SidebarItem from './SidebarItem';

interface PinnedSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
}

const PinnedSection: React.FC<PinnedSectionProps> = ({ isExpanded, onToggle }) => {
  const { getPinnedNotes } = useNotesStore();
  
  const pinnedNotes = getPinnedNotes();
  
  // Don't render if no pinned notes
  if (pinnedNotes.length === 0) {
    return null;
  }

  return (
    <SidebarSection
      title="Pinned"
      icon={<Star size={14} />}
      isExpanded={isExpanded}
      onToggle={onToggle}
      count={pinnedNotes.length}
    >
      <div className="space-y-0.5">
        {pinnedNotes.map((note) => (
          <SidebarItem key={note.id} note={note} depth={0} />
        ))}
      </div>
    </SidebarSection>
  );
};

export default PinnedSection;
