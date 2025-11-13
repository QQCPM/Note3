import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNotesStore } from '@/store';
import { getAllNotes } from '@/utils/tauri';
import Sidebar from '@/components/Sidebar/Sidebar';
import Canvas from '@/components/Canvas/Canvas';
import AISidebar from '@/components/AISidebar/AISidebar';
import ContextMenu from '@/components/ContextMenu/ContextMenu';

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

function AppContent() {
  const { setNotes } = useNotesStore();

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
    <div className="flex h-screen w-full bg-bg-primary text-text-primary">
      {/* Left Sidebar - Note Tree */}
      <Sidebar />

      {/* Main Canvas Area */}
      <Canvas />

      {/* Right Sidebar - AI Panel */}
      <AISidebar />

      {/* Context Menu (global) */}
      <ContextMenu />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
