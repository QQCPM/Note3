import React from 'react';
import type { NoteWithChildren } from '@/types';
import NoteTreeItem from './NoteTreeItem';

interface NoteTreeProps {
  notes: NoteWithChildren[];
}

const NoteTree: React.FC<NoteTreeProps> = ({ notes }) => {
  if (notes.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-8">
        No notes yet. Click "+ New Page" to create one.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {notes.map((note) => (
        <NoteTreeItem key={note.id} note={note} />
      ))}
    </div>
  );
};

export default NoteTree;