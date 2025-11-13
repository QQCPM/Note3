import React, { useEffect, useState } from 'react';
import { useNotesStore, useBlocksStore } from '@/store';
import { getNoteById, getBlocksByNote } from '@/utils/tauri';
import CanvasHeader from './CanvasHeader';
import CanvasContent from './CanvasContent';

const Canvas: React.FC = () => {
  const { activeNoteId } = useNotesStore();
  const { setBlocks, blocks } = useBlocksStore();
  const [activeNote, setActiveNote] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeNoteId) {
      setLoading(true);
      Promise.all([
        getNoteById(activeNoteId),
        getBlocksByNote(activeNoteId),
      ])
        .then(([note, noteBlocks]) => {
          setActiveNote(note);
          setBlocks(noteBlocks);
        })
        .catch((error) => {
          console.error('Failed to load note:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setActiveNote(null);
      setBlocks([]);
    }
  }, [activeNoteId, setBlocks]);

  if (!activeNoteId) {
    return (
      <main className="flex-1 flex flex-col overflow-hidden bg-bg-primary rounded-lg">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-xl font-semibold text-white mb-2">Welcome to Weave</h2>
            <p className="text-text-secondary">
              Select a note from the sidebar or create a new one to get started
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex-1 flex flex-col overflow-hidden bg-bg-primary rounded-lg">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-text-secondary">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-[#0d1117] rounded-lg">
      <CanvasHeader note={activeNote} />
      <CanvasContent note={activeNote} blocks={blocks} />
    </main>
  );
};

export default Canvas;
