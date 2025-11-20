import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNotesStore } from '@/store';
import { getAllNotes } from '@/utils/tauri';
import Sidebar from '@/components/Sidebar/Sidebar';
import Canvas from '@/components/Canvas/Canvas';
import AISidebar from '@/components/AISidebar/AISidebar';
import ContextMenu from '@/components/ContextMenu/ContextMenu';
import GlobalDragLayer from '@/components/GlobalDragLayer/GlobalDragLayer';
import { tauriAI, createMacM2UltraConfig } from '@/services/tauriAI';


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
  const { setNotes } = useNotesStore();
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

    // Initialize AI system
    const initializeAI = async () => {
      try {
        let openaiKey = '';

        // Try to load persisted config first
        const persistedConfig = await tauriAI.loadPersistedConfig();

        if (persistedConfig && persistedConfig.openai_api_key) {
          console.log('📂 Loading persisted AI configuration');
          openaiKey = persistedConfig.openai_api_key;
        } else {
          console.log('📝 No persisted config found, using .env defaults');
          openaiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
        }

        if (!openaiKey) {
          console.warn('⚠️ No OpenAI API key found. Please set it in Settings.');
        }

        // Create Mac M2 Ultra config (all 3 local models)
        const config = createMacM2UltraConfig(openaiKey);

        console.log('🚀 Initializing AI system with config:', config);
        await tauriAI.initialize(config);
        setAiInitialized(true);
        console.log('✅ AI system initialized successfully');

        // Check health of all services
        const health = await tauriAI.healthCheck();
        console.log('🏥 AI Health Check:', health);

        const allHealthy = health.embedding_service &&
          health.local_code_service &&
          health.reranker_service;
        setAiHealthy(allHealthy);

        if (!allHealthy) {
          console.warn('⚠️ Some AI services are not healthy:', health);
        }
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
      <div className="flex h-screen w-full bg-[#0d1117] text-gray-300 antialiased p-2 gap-2 relative">
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
        <Canvas />

        {/* Right Sidebar - AI Panel */}
        <AISidebar />

        {/* Context Menu (global) */}
        <ContextMenu />

        {/* Global Drag Layer - Renders drag preview */}
        <GlobalDragLayer />
      </div>
    </QueryClientProvider>
  );
}

export default App;
