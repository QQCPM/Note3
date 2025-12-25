import React, { useState, useEffect } from 'react';
import { Brain, Target, Calendar, Plus } from 'lucide-react';
import { useUIStore } from '@/store';
import { useProjectStore } from '@/store/projectStore';
import { memoryService } from '@/services/memoryService';

interface MemoryFile {
  id: string;
  name: string;
  icon: React.ReactNode;
  type: 'ai' | 'project' | 'daily';
  exists: boolean;
  color: string;
}

interface MemorySidebarProps {
  activeFileId: string | null;
  onSelectFile: (fileId: string | null) => void;
}

const MemorySidebar: React.FC<MemorySidebarProps> = ({ activeFileId, onSelectFile }) => {
  const { sidebarCollapsed } = useUIStore();
  const { activeProjectId } = useProjectStore();
  const [memoryFiles, setMemoryFiles] = useState<MemoryFile[]>([]);

  // Load memory file status
  useEffect(() => {
    loadMemoryFiles();
  }, [activeProjectId]);

  const loadMemoryFiles = async () => {
    try {
      const aiMemory = await memoryService.loadAIMemory();
      const projectMemory = activeProjectId 
        ? await memoryService.loadProjectMemory(activeProjectId)
        : null;
      const dailyMemory = await memoryService.loadDailyMemory(activeProjectId || undefined);

      const files: MemoryFile[] = [
        {
          id: 'ai',
          name: 'AI.md',
          icon: <Brain size={14} />,
          type: 'ai',
          exists: !!aiMemory,
          color: '#a855f7',
        },
        {
          id: 'project',
          name: 'Project.md',
          icon: <Target size={14} />,
          type: 'project',
          exists: !!projectMemory,
          color: '#3fb950',
        },
        {
          id: 'daily',
          name: 'Daily.md',
          icon: <Calendar size={14} />,
          type: 'daily',
          exists: !!dailyMemory,
          color: '#58a6ff',
        },
      ];

      setMemoryFiles(files);
    } catch (error) {
      console.error('Failed to load memory files:', error);
    }
  };

  const handleFileClick = async (file: MemoryFile) => {
    // Always select the file - editor will handle creation if needed
    onSelectFile(file.id);
  };

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <nav
      className="sidebar bg-[#010409] flex flex-col flex-shrink-0 rounded-2xl"
      style={{
        width: '240px',
        minWidth: '240px',
        margin: '8px',
        height: 'calc(100vh - 16px)',
        overflow: 'hidden',
      }}
    >
      {/* Header - Simple */}
      <div className="px-4 pt-14 pb-3">
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          Memory Files
        </span>
      </div>

      {/* File List - Clean & Simple */}
      <div className="flex-1 overflow-y-auto px-2">
        {memoryFiles.map((file) => (
          <button
            key={file.id}
            onClick={() => handleFileClick(file)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-left mb-0.5 ${
              activeFileId === file.id
                ? 'bg-[#1f6feb]/15 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#161b22]'
            }`}
          >
            <span style={{ color: file.color }}>{file.icon}</span>
            <span className="text-[13px] flex-1">{file.name}</span>
            {!file.exists && (
              <Plus size={12} className="text-gray-600" />
            )}
          </button>
        ))}
      </div>

      {/* Bottom hint */}
      <div className="px-4 py-3 border-t border-gray-800/50">
        <p className="text-[11px] text-gray-600 leading-relaxed">
          Click to edit • ⌘S to save
        </p>
      </div>
    </nav>
  );
};

export default MemorySidebar;
