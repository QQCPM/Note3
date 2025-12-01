import React, { useEffect, useState } from 'react';
import { useNotesStore, useBlocksStore, useUIStore } from '@/store';
import { getNoteById, getBlocksByNote } from '@/utils/tauri';
import CanvasHeader from './CanvasHeader';
import CanvasContent from './CanvasContent';
import InfiniteCanvas from './InfiniteCanvas';
import StartingPage from '../StartingPage/StartingPage';

const Canvas: React.FC = () => {
  const { activeNoteId } = useNotesStore();
  const { setBlocks, blocks } = useBlocksStore();
  const { canvasMode } = useUIStore();
  const [activeNote, setActiveNote] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeNoteId) {
      // 🔍 PERFORMANCE TRACKING START
      const startTime = performance.now();
      console.log(`📝 [PERF] Starting to load note: ${activeNoteId}`);

      // 🚀 CRITICAL FIX: Clear old blocks immediately to prevent lag
      // This prevents React from updating/unmounting all old blocks
      setBlocks([]);
      setActiveNote(null);
      setLoading(true);

      const fetchStart = performance.now();
      Promise.all([
        getNoteById(activeNoteId),
        getBlocksByNote(activeNoteId),
      ])
        .then(([note, noteBlocks]) => {
          const fetchEnd = performance.now();
          console.log(`⏱️ [PERF] Database fetch took: ${(fetchEnd - fetchStart).toFixed(2)}ms`);
          console.log(`📊 [PERF] Fetched ${noteBlocks.length} blocks`);

          const setNoteStart = performance.now();
          setActiveNote(note);
          console.log(`📄 [PERF] setActiveNote took: ${(performance.now() - setNoteStart).toFixed(2)}ms`);

          const setBlocksStart = performance.now();

          // Progressive loading: Load blocks in batches to prevent UI freeze
          if (noteBlocks.length > 10) {
            console.log(`🔄 [PERF] Using progressive loading for ${noteBlocks.length} blocks`);

            // First batch: Load first 10 blocks immediately for faster initial render
            setBlocks(noteBlocks.slice(0, 10));
            setLoading(false);

            console.log(`✅ [PERF] First 10 blocks loaded in: ${(performance.now() - setBlocksStart).toFixed(2)}ms`);
            console.log(`⏱️ [PERF] Total time to first render: ${(performance.now() - startTime).toFixed(2)}ms`);

            // Remaining batches: Load in chunks of 10 with small delays
            let currentIndex = 10;
            const batchSize = 10;
            let batchCount = 1;

            const loadNextBatch = () => {
              if (currentIndex < noteBlocks.length) {
                const batchStart = performance.now();
                const nextBatch = noteBlocks.slice(0, currentIndex + batchSize);
                setBlocks(nextBatch);
                currentIndex += batchSize;
                batchCount++;

                console.log(`🔄 [PERF] Batch ${batchCount} loaded (${currentIndex} total blocks) in: ${(performance.now() - batchStart).toFixed(2)}ms`);

                // Use requestIdleCallback for non-blocking updates
                if ('requestIdleCallback' in window) {
                  requestIdleCallback(loadNextBatch);
                } else {
                  setTimeout(loadNextBatch, 16); // ~60fps fallback
                }
              } else {
                console.log(`✅ [PERF] All blocks loaded. Total time: ${(performance.now() - startTime).toFixed(2)}ms`);
              }
            };

            // Start loading remaining batches after a short delay
            requestIdleCallback(loadNextBatch);
          } else {
            // Small notes: Load all at once
            setBlocks(noteBlocks);
            setLoading(false);
            console.log(`✅ [PERF] All ${noteBlocks.length} blocks loaded in: ${(performance.now() - setBlocksStart).toFixed(2)}ms`);
            console.log(`⏱️ [PERF] Total time: ${(performance.now() - startTime).toFixed(2)}ms`);
          }
        })
        .catch((error) => {
          console.error('❌ [PERF] Failed to load note:', error);
          console.error(`⏱️ [PERF] Failed after: ${(performance.now() - startTime).toFixed(2)}ms`);
          setLoading(false);
        });
    } else {
      setActiveNote(null);
      setBlocks([]);
    }
  }, [activeNoteId, setBlocks]);

  // Canvas mode doesn't require an active note
  if (canvasMode === 'canvas') {
    return (
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0d1117] rounded-lg">
        <InfiniteCanvas />
      </main>
    );
  }

  // Note mode requires an active note
  if (!activeNoteId) {
    return <StartingPage />;
  }

  if (loading) {
    return (
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0d1117] rounded-lg">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-600 border-t-purple-500 rounded-full animate-spin"></div>
            <div className="text-gray-400 text-sm">Loading note...</div>
          </div>
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
        <InfiniteCanvas />
      )}
    </main>
  );
};

export default Canvas;
