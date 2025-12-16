import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, useRef } from 'react';
import { useNotesStore, useFileStore } from '@/store';
import { useLayoutStore } from '@/store/layoutStore';
import { useProjectStore } from '@/store/projectStore';
import { getAllNotes } from '@/utils/tauri';
import UnifiedSidebar from '@/components/Sidebar/UnifiedSidebar';
import Canvas from '@/components/Canvas/Canvas';
import AISidebar from '@/components/AISidebar/AISidebar';
import NotePreviewPanel from '@/components/NotePreview/NotePreviewPanel';
import ContextMenu from '@/components/ContextMenu/ContextMenu';
import GlobalDragLayer from '@/components/GlobalDragLayer/GlobalDragLayer';
import { AISystem } from '@/services/AISystem';

import HeaderDock from '@/components/CommandDock/HeaderDock';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function App() {
  const { setNotes, addNote } = useNotesStore();
  const { initializeFromStorage } = useFileStore();
  const { notePanelVisible } = useLayoutStore();
  const { addTreeItem } = useProjectStore();
  const [aiInitialized, setAiInitialized] = useState(false);
  const [aiHealthy, setAiHealthy] = useState(false);
  const hasLoadedNotes = useRef(false);

  useEffect(() => {
    // Load files from IndexedDB on mount
    const loadFiles = async () => {
      try {
        await initializeFromStorage();
        console.log('📁 Files loaded from IndexedDB');
      } catch (error) {
        console.error('Failed to load files:', error);
      }
    };
    loadFiles();
  }, [initializeFromStorage]);

  // Separate effect for notes - runs only once
  useEffect(() => {
    if (hasLoadedNotes.current) return;
    hasLoadedNotes.current = true;

    // Load notes on mount - merge with existing persisted notes and sync to project tree
    const loadNotes = async () => {
      try {
        const dbNotes = await getAllNotes();
        const currentNotes = useNotesStore.getState().notes;
        const currentTreeItems = useProjectStore.getState().treeItems;
        const currentProjects = useProjectStore.getState().projects;

        // Get IDs of notes already in store (from localStorage persistence)
        const existingIds = new Set<string>();
        const collectIds = (notes: typeof currentNotes) => {
          notes.forEach(note => {
            existingIds.add(note.id);
            if (note.children) collectIds(note.children);
          });
        };
        collectIds(currentNotes);

        if (existingIds.size === 0) {
          // No persisted notes, just set from database
          setNotes(dbNotes);
        } else {
          // Merge: add only database notes that don't exist in localStorage
          const newDbNotes = dbNotes.filter(note => !existingIds.has(note.id));
          newDbNotes.forEach(note => addNote(note));
          console.log(`📝 Merged ${newDbNotes.length} DB notes with ${existingIds.size} persisted notes`);
        }

        // Sync notes to project tree - add any notes not already in tree
        const allNotes = existingIds.size === 0 ? dbNotes : [...dbNotes];
        const existingNoteIds = new Set(currentTreeItems.filter(item => item.noteId).map(item => item.noteId));
        const targetProjectId = currentProjects[0]?.id || 'default-notes';

        allNotes.forEach(note => {
          if (!existingNoteIds.has(note.id)) {
            addTreeItem({
              projectId: targetProjectId,
              name: note.title || 'Untitled',
              type: 'note',
              noteId: note.id,
            });
          }
        });
      } catch (error) {
        console.error('Failed to load notes:', error);
      }
    };

    // Initialize AI system using unified AISystem
    const initializeAI = async () => {
      try {
        // Get API keys from environment
        const openaiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
        const ollamaKey = import.meta.env.VITE_OLLAMA_API_KEY || '';

        if (!openaiKey) {
          console.warn('⚠️ No OpenAI API key in env. AISystem will check persisted config.');
        }

        // Initialize unified AI system with GLM-4.6 (Ollama Cloud)
        console.log('🚀 Initializing unified AI system with GLM-4.6...');
        const health = await AISystem.initialize({ 
          openaiApiKey: openaiKey,
          ollamaApiKey: ollamaKey,
          useGlm46: true,  // Use GLM-4.6 for code generation
        });
        
        setAiInitialized(AISystem.isReady);
        console.log('✅ AI system initialized - Status:', AISystem.status);

        // Check health of all services
        console.log('🏥 AI Health Check:', health);

        const allHealthy = health.services.embedding &&
          health.services.localCode &&
          health.services.reranker;
        setAiHealthy(allHealthy);

        if (!allHealthy) {
          console.warn('⚠️ Some AI services are not healthy:', health.services);
        }

        // Subscribe to AI status changes
        AISystem.on('status-change', ({ oldStatus, newStatus }) => {
          console.log(`📊 AI Status changed: ${oldStatus} → ${newStatus}`);
          setAiInitialized(AISystem.isReady);
        });

      } catch (error) {
        console.error('❌ Failed to initialize AI:', error);
        setAiInitialized(false);
        setAiHealthy(false);
      }
    };

    loadNotes();
    initializeAI();
  }, [setNotes, addNote, addTreeItem]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen w-full bg-[#0d1117] text-gray-300 antialiased gap-2 relative overflow-visible">
        {/* AI Status Indicator - Minimal Green Dot (Top Left) */}
        <div className="fixed top-4 left-4 z-50">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${aiInitialized && aiHealthy
              ? 'bg-green-500 shadow-lg shadow-green-500/50'
              : aiInitialized
                ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50'
                : 'bg-gray-600'
              }`}
            title={
              aiInitialized && aiHealthy
                ? 'AI Ready'
                : aiInitialized
                  ? 'AI Partial'
                  : 'AI Offline'
            }
          />
        </div>

        {/* Header Dock - Persistent Top Left */}
        <HeaderDock />

        {/* Left Sidebar - Unified Project Tree */}
        <UnifiedSidebar />

        {/* Main Canvas Area */}
        <Canvas />

        {/* Right Side - AI Sidebar (always visible) */}
        <AISidebar />

        {/* Note Preview Panel (overlay when visible) */}
        {notePanelVisible && <NotePreviewPanel />}

        {/* Context Menu (global) */}
        <ContextMenu />

        {/* Global Drag Layer - Renders drag preview */}
        <GlobalDragLayer />
      </div>
    </QueryClientProvider>
  );
}

export default App;
