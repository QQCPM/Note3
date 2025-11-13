import { useEffect } from 'react';
import { useNotesStore } from '@/store';
import { getAllNotes } from '@/utils/tauri';
import Sidebar from '@/components/Sidebar/Sidebar';
import Canvas from '@/components/Canvas/Canvas';
import AISidebar from '@/components/AISidebar/AISidebar';

function App() {
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

  // Hide context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      // Context menu hiding handled by ContextMenu component
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="flex h-screen w-full bg-bg-primary text-text-primary">
      {/* Left Sidebar - Note Tree */}
      <Sidebar />

      {/* Main Canvas Area */}
      <Canvas />

      {/* Right Sidebar - AI Panel */}
      <AISidebar />
    </div>
  );
}

export default App;
