import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNotesStore, useUIStore } from '@/store';
import { getAllNotes } from '@/utils/tauri';
import Sidebar from '@/components/Sidebar/Sidebar';
import Canvas from '@/components/Canvas/Canvas';
import AISidebar from '@/components/AISidebar/AISidebar';
import ContextMenu from '@/components/ContextMenu/ContextMenu';
import { ChevronLeft } from 'lucide-react';
import { tauriAI, createMacM2UltraConfig } from '@/services/tauriAI';

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
  const { aiSidebarCollapsed, toggleAISidebar, sidebarCollapsed, toggleSidebar } = useUIStore();
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
      <div className="flex h-screen w-full bg-[#0d1117] text-gray-300 antialiased p-2 gap-2">
        {/* AI Status Indicator - Minimal Green Dot */}
        <div className="absolute top-4 left-4 z-50">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              aiInitialized && aiHealthy
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

        {/* Left Sidebar - Note Tree */}
        {sidebarCollapsed ? (
          <button
            onClick={toggleSidebar}
            className="absolute top-1/2 left-0 transform -translate-y-1/2 bg-gray-800 hover:bg-gray-700 text-white p-1 rounded-full z-20"
            title="Expand Sidebar"
          >
            <ChevronLeft size={16} className="rotate-180" />
          </button>
        ) : (
          <Sidebar />
        )}

        {/* Main Canvas Area */}
        <Canvas />

        {/* Right Sidebar - AI Panel */}
        {aiSidebarCollapsed ? (
          <button
            onClick={toggleAISidebar}
            className="absolute top-1/2 right-0 transform -translate-y-1/2 bg-gray-800 hover:bg-gray-700 text-white p-1 rounded-full z-20"
            title="Expand Sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        ) : (
          <AISidebar />
        )}

        {/* Context Menu (global) */}
        <ContextMenu />
      </div>
    </QueryClientProvider>
  );
}

export default App;
