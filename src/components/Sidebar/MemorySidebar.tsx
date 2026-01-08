import React, { useState, useEffect } from 'react';
import { Brain, Target, Calendar, Plus, FolderArchive, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { useUIStore } from '@/store';
import { useProjectStore } from '@/store/projectStore';
import { memoryService } from '@/services/memoryService';

interface MemoryFile {
  id: string;
  name: string;
  icon: React.ReactNode;
  type: 'ai' | 'plan' | 'daily';
  exists: boolean;
  color: string;
}

interface ArchiveFile {
  name: string;
  path: string;
}

interface MemorySidebarProps {
  activeFileId: string | null;
  onSelectFile: (fileId: string | null) => void;
}

const MemorySidebar: React.FC<MemorySidebarProps> = ({ activeFileId, onSelectFile }) => {
  const { sidebarCollapsed } = useUIStore();
  const { activeProjectId } = useProjectStore();
  const [memoryFiles, setMemoryFiles] = useState<MemoryFile[]>([]);
  const [archiveFiles, setArchiveFiles] = useState<ArchiveFile[]>([]);
  const [archiveExpanded, setArchiveExpanded] = useState(false);

  // Load memory file status
  useEffect(() => {
    loadMemoryFiles();
    loadArchiveFiles();
  }, [activeProjectId]);

  // Auto-refresh archive files every 5 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(loadArchiveFiles, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadMemoryFiles = async () => {
    try {
      const aiMemory = await memoryService.loadAIMemory();
      // Load Plan.md (roadmaps) - this is where the secretary saves roadmaps
      const planMemory = await memoryService.loadPlanMemory();
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
          id: 'plan',
          name: 'Plan.md',
          icon: <Target size={14} />,
          type: 'plan',
          exists: !!(planMemory && planMemory.activePlans.length > 0),
          color: '#3fb950',
        },
        {
          id: 'today',
          name: 'Today.md',
          icon: <Calendar size={14} />,
          type: 'daily',
          exists: !!dailyMemory,  // Will update once we load Today.md
          color: '#58a6ff',
        },
        {
          id: 'tomorrow',
          name: 'Tomorrow.md',
          icon: <Calendar size={14} />,
          type: 'daily',
          exists: true,  // Show even if doesn't exist yet
          color: '#a371f7',
        },
      ];

      setMemoryFiles(files);
    } catch (error) {
      console.error('Failed to load memory files:', error);
    }
  };

  const loadArchiveFiles = async () => {
    try {
      const archives = await memoryService.listPlanArchives();
      setArchiveFiles(archives.map(name => ({ name, path: name })));
    } catch (error) {
      console.error('Failed to load archive files:', error);
      setArchiveFiles([]);
    }
  };

  const handleFileClick = async (file: MemoryFile) => {
    // Always select the file - editor will handle creation if needed
    onSelectFile(file.id);
  };

  const handleArchiveClick = async (archive: ArchiveFile) => {
    // Open an archive file (could extend to show in editor)
    onSelectFile(`archive:${archive.name}`);
  };

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <nav
      className="sidebar bg-[#010409] flex flex-col flex-shrink-0 rounded-2xl"
      style={{
        width: '260px',
        minWidth: '260px',
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
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-left mb-0.5 ${activeFileId === file.id
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

        {/* Plans/ Archive Section */}
        {archiveFiles.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-800/50">
            <button
              onClick={() => setArchiveExpanded(!archiveExpanded)}
              className="w-full flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {archiveExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <FolderArchive size={14} className="text-amber-500/70" />
              <span className="text-[11px] font-medium uppercase tracking-wider flex-1 text-left">
                Plans/ Archive
              </span>
              <span className="text-[10px] text-gray-600">{archiveFiles.length}</span>
            </button>

            {archiveExpanded && (
              <div className="mt-1 space-y-0.5">
                {archiveFiles.map((archive) => (
                  <button
                    key={archive.name}
                    onClick={() => handleArchiveClick(archive)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-all ${activeFileId === `archive:${archive.name}`
                      ? 'bg-[#1f6feb]/15 text-white'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-[#161b22]'
                      }`}
                  >
                    <FileText size={12} className="text-amber-500/50 ml-4" />
                    <span className="text-[12px] truncate" title={archive.name}>
                      {archive.name.replace('.md', '')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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

