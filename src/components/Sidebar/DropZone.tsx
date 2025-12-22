import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileText, Video, Music, Image, FileCode } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useFileStore } from '@/store/fileStore';
import { useNotesStore } from '@/store/notesStore';
import { createNote } from '@/utils/tauri';

type FileType = 'pdf' | 'video' | 'audio' | 'image' | 'markdown';

const getFileTypeFromExtension = (filename: string): FileType | null => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  
  const typeMap: Record<string, FileType> = {
    '.pdf': 'pdf',
    '.mp4': 'video',
    '.mov': 'video',
    '.webm': 'video',
    '.avi': 'video',
    '.mp3': 'audio',
    '.m4a': 'audio',
    '.wav': 'audio',
    '.ogg': 'audio',
    '.png': 'image',
    '.jpg': 'image',
    '.jpeg': 'image',
    '.gif': 'image',
    '.svg': 'image',
    '.webp': 'image',
    '.md': 'markdown',
    '.markdown': 'markdown',
  };
  
  return typeMap[ext] || null;
};

const FileTypeIcon: React.FC<{ type: FileType }> = ({ type }) => {
  const iconProps = { size: 14, className: 'text-gray-500' };

  switch (type) {
    case 'pdf':
      return <FileText {...iconProps} className="text-red-400" />;
    case 'video':
      return <Video {...iconProps} className="text-purple-400" />;
    case 'audio':
      return <Music {...iconProps} className="text-green-400" />;
    case 'image':
      return <Image {...iconProps} className="text-blue-400" />;
    case 'markdown':
      return <FileCode {...iconProps} className="text-yellow-400" />;
    default:
      return <FileText {...iconProps} />;
  }
};

interface DropZoneProps {
  onFilesDropped?: (files: File[]) => void;
}

const DropZone: React.FC<DropZoneProps> = ({ onFilesDropped }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { activeProjectId, projects } = useProjectStore();
  const { addFile } = useFileStore();
  const { addNote, setActiveNote } = useNotesStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const processFiles = useCallback(
    async (files: File[]) => {
      const targetProjectId = activeProjectId || projects[0]?.id || null;

      for (const file of files) {
        const fileType = getFileTypeFromExtension(file.name);
        if (fileType) {
          try {
            // Store file in fileStore
            await addFile(file, fileType);
            
            // Create note in database (backend doesn't know new fields)
            const dbNote = await createNote({
              title: file.name,
              icon: fileType === 'pdf' ? '📕' : 
                    fileType === 'video' ? '🎥' : 
                    fileType === 'audio' ? '🎵' : 
                    fileType === 'image' ? '🖼️' : '📝',
              parent_id: null,
            });
            
            // Merge with new fields for the store
            const noteWithProject = {
              ...dbNote,
              project_id: targetProjectId,
              type: 'note' as const,
              is_pinned: false,
            };
            
            addNote(noteWithProject);
            setActiveNote(noteWithProject.id);
            
            console.log(`📁 Uploaded: ${file.name} (${fileType}) - Note ID: ${noteWithProject.id}`);
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
          }
        }
      }

      onFilesDropped?.(files);
    },
    [activeProjectId, projects, addFile, addNote, setActiveNote, onFilesDropped]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="px-3 py-2">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
          transition-all duration-200
          ${isDragOver
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-700 hover:border-gray-600 hover:bg-[#0d1117]'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.mp4,.mov,.webm,.mp3,.m4a,.wav,.md,.markdown,.png,.jpg,.jpeg,.gif,.svg"
          onChange={handleFileInputChange}
        />

        <div className="flex justify-center mb-2">
          <Upload
            size={20}
            className={`transition-colors ${isDragOver ? 'text-blue-400' : 'text-gray-500'}`}
          />
        </div>

        <p className="text-xs text-gray-500">
          {isDragOver ? (
            <span className="text-blue-400">Drop files here</span>
          ) : (
            <>
              <span className="text-gray-400">Drop files</span> or{' '}
              <span className="text-blue-400">browse</span>
            </>
          )}
        </p>

        <div className="flex items-center justify-center gap-2 mt-2">
          <FileTypeIcon type="pdf" />
          <FileTypeIcon type="video" />
          <FileTypeIcon type="audio" />
          <FileTypeIcon type="markdown" />
          <FileTypeIcon type="image" />
        </div>
      </div>
    </div>
  );
};

export default DropZone;
