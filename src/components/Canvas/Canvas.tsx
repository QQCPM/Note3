import React, { useEffect, useState } from 'react';
import { useNotesStore, useBlocksStore, useUIStore, useFileStore, useProjectStore } from '@/store';
import { getNoteById, getBlocksByNote } from '@/utils/tauri';
import CanvasHeader from './CanvasHeader';
import CanvasContent from './CanvasContent';
import InfiniteCanvas from './InfiniteCanvas';
import KnowledgeGraph3D from './KnowledgeGraph3D';
import StartingPage from '../StartingPage/StartingPage';
import { FilePreview } from '../FileViewer';
import { Dashboard, MemoryFileEditor } from '../Dashboard';

interface CanvasProps {
  activeMemoryFile?: string | null;
  onCloseMemoryFile?: () => void;
}

const Canvas: React.FC<CanvasProps> = ({ activeMemoryFile, onCloseMemoryFile }) => {
  // Single source of truth: activeNoteId determines what note is displayed
  const { activeNoteId } = useNotesStore();
  const { setBlocks, blocks } = useBlocksStore();
  const { canvasMode } = useUIStore();
  const { getActiveFile } = useFileStore();
  const { selectedItemId, getTreeItemById } = useProjectStore();
  const [activeNote, setActiveNote] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Get selected item info for file preview
  const selectedItem = selectedItemId ? getTreeItemById(selectedItemId) : null;
  const isFileSelected = selectedItem && ['pdf', 'video', 'audio', 'image'].includes(selectedItem.type);
  const activeFile = getActiveFile();

  // Load note when activeNoteId changes
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/035c0fba-b1bf-4c61-a637-d95f11522c3b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Canvas.tsx:useEffect',message:'activeNoteId changed',data:{activeNoteId,selectedItemId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (activeNoteId) {
      const startTime = performance.now();
      console.log(`📝 Loading note: ${activeNoteId}`);

      setBlocks([]);
      setActiveNote(null);
      setLoading(true);

      // Check if this is a generated note (stored in localStorage)
      const generatedNoteContent = localStorage.getItem(`note-content-${activeNoteId}`);
      if (generatedNoteContent) {
        const notesStore = useNotesStore.getState();
        const storeNote = notesStore.getNoteById(activeNoteId);
        
        if (storeNote) {
          setActiveNote({
            id: storeNote.id,
            title: storeNote.title,
            icon: storeNote.icon,
            content: generatedNoteContent,
          });
          setBlocks([{
            id: `block-${activeNoteId}`,
            note_id: activeNoteId,
            type: 'text',
            data: { type: 'text', content: generatedNoteContent },
            position: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);
          setLoading(false);
          console.log(`✅ Generated note loaded in: ${(performance.now() - startTime).toFixed(2)}ms`);
          return;
        }
      }

      // Fetch from database
      Promise.all([
        getNoteById(activeNoteId),
        getBlocksByNote(activeNoteId),
      ])
        .then(([note, noteBlocks]) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/035c0fba-b1bf-4c61-a637-d95f11522c3b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Canvas.tsx:fetchNote',message:'Note fetched from DB',data:{noteId:activeNoteId,fetchedNoteTitle:note?.title,fetchedNoteId:note?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H'})}).catch(()=>{});
          // #endregion
          console.log(`📊 Fetched note and ${noteBlocks.length} blocks`);
          setActiveNote(note);
          setBlocks(noteBlocks);
          setLoading(false);
        })
        .catch((error) => {
          console.error('❌ Failed to load note:', error);
          setLoading(false);
        });
    } else {
      setActiveNote(null);
      setBlocks([]);
    }
  }, [activeNoteId, setBlocks]);

  // Dashboard mode - show MemoryFileEditor if a file is selected, otherwise Dashboard
  if (canvasMode === 'dashboard') {
    return (
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0d1117] rounded-lg">
        {activeMemoryFile ? (
          <MemoryFileEditor 
            fileType={activeMemoryFile as 'ai' | 'project' | 'daily'} 
            onClose={() => onCloseMemoryFile?.()}
          />
        ) : (
          <Dashboard />
        )}
      </main>
    );
  }

  // 3D Knowledge Graph mode
  if (canvasMode === 'graph') {
    return (
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0f] rounded-lg">
        <KnowledgeGraph3D />
      </main>
    );
  }

  // Canvas mode
  if (canvasMode === 'canvas') {
    return (
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0d1117] rounded-lg">
        <InfiniteCanvas />
      </main>
    );
  }

  // File preview mode
  if (isFileSelected && activeFile) {
    return (
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0d1117] rounded-lg">
        <FilePreview
          file={activeFile.file}
          fileUrl={activeFile.objectUrl}
          fileType={activeFile.type as 'pdf' | 'video' | 'audio' | 'image'}
          fileName={activeFile.name}
        />
      </main>
    );
  }

  // No active note - show starting page
  if (!activeNoteId) {
    return <StartingPage />;
  }

  // Loading state
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

  // Display note
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
