import React, { useEffect, useState } from 'react';
import { useNotesStore, useBlocksStore, useUIStore } from '@/store';
import { getNoteById, getBlocksByNote, createNote } from '@/utils/tauri';
import CanvasHeader from './CanvasHeader';
import CanvasContent from './CanvasContent';
import InfinityCanvas from './InfinityCanvas';

const Canvas: React.FC = () => {
  const { activeNoteId, setActiveNote: setActiveNoteId, addNote } = useNotesStore();
  const { setBlocks, blocks } = useBlocksStore();
  const { canvasMode } = useUIStore();
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

  // Auto-create a canvas note when entering canvas mode without a note
  useEffect(() => {
    const autoCreateCanvasNote = async () => {
      if (!activeNoteId && canvasMode === 'canvas' && !loading) {
        try {
          setLoading(true);
          const newNote = await createNote({
            title: 'Infinity Canvas',
            icon: '🎨',
            parent_id: null,
          });
          addNote(newNote);
          setActiveNoteId(newNote.id);
        } catch (error) {
          console.error('Failed to create canvas note:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    autoCreateCanvasNote();
  }, [activeNoteId, canvasMode, loading, addNote, setActiveNoteId]);

  // In canvas mode, show infinity canvas even without a note selected
  if (!activeNoteId && canvasMode === 'canvas') {
    return (
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0d1117] rounded-lg">
        <InfinityCanvas />
      </main>
    );
  }

  // In note mode, show welcome screen if no note selected
  if (!activeNoteId) {
    return (
      <main className="flex-1 flex flex-col overflow-hidden bg-bg-primary rounded-lg">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-xl font-semibold text-white mb-2">Welcome</h2>
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
      {canvasMode === 'note' ? (
        <CanvasContent note={activeNote} blocks={blocks} />
      ) : (
        <InfinityCanvas />
      )}
    </main>
  );
};

export default Canvas;
