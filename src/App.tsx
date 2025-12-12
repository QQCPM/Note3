import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNotesStore } from '@/store';
import { useLayoutStore } from '@/store/layoutStore';
import { getAllNotes } from '@/utils/tauri';
import Sidebar from '@/components/Sidebar/Sidebar';
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
  const { setNotes, activeNoteId } = useNotesStore();
  const { notePanelVisible } = useLayoutStore();
  const [aiInitialized, setAiInitialized] = useState(false);
  const [aiHealthy, setAiHealthy] = useState(false);

  useEffect(() => {
    // Load notes on mount
    const loadNotes = async () => {
      try {
        const notes = await getAllNotes();
        setNotes(notes);
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
  }, [setNotes]);

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

        {/* Left Sidebar - Note Tree */}
        <Sidebar />

        {/* Main Canvas Area */}
        {activeNoteId ? (
          // User clicked a note from sidebar - show normal Canvas editor + AISidebar
          <>
            <Canvas />
            <AISidebar />
          </>
        ) : (
          // Default: StartingPage mode (chat interface)
          <>
            <Canvas /> {/* Canvas will show StartingPage when activeNoteId is null */}
            {notePanelVisible && <NotePreviewPanel />}
          </>
        )}

        {/* Context Menu (global) */}
        <ContextMenu />

        {/* Global Drag Layer - Renders drag preview */}
        <GlobalDragLayer />
      </div>
    </QueryClientProvider>
  );
}

export default App;
