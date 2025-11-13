import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNotesStore, useUIStore } from '@/store';
import { getAllNotes } from '@/utils/tauri';
import Sidebar from '@/components/Sidebar/Sidebar';
import Canvas from '@/components/Canvas/Canvas';
import AISidebar from '@/components/AISidebar/AISidebar';
import ContextMenu from '@/components/ContextMenu/ContextMenu';
import { ChevronLeft } from 'lucide-react';

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
  const { aiSidebarCollapsed, toggleAISidebar } = useUIStore();

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

    loadNotes();
  }, [setNotes]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen w-full bg-[#0d1117] text-gray-300 antialiased p-2 gap-2">
        {/* Left Sidebar - Note Tree */}
        <Sidebar />

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
