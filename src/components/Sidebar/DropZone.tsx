import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileText, Video, Music, Image, FileCode } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useFileStore } from '@/store/fileStore';
import { getFileTypeFromExtension, FileType } from '@/types/project';

// ============================================================================
// TYPES
// ============================================================================

interface DropZoneProps {
  onFilesDropped?: (files: File[]) => void;
}

// ============================================================================
// FILE TYPE ICONS
// ============================================================================

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

// ============================================================================
// DROP ZONE COMPONENT
// ============================================================================

const DropZone: React.FC<DropZoneProps> = ({ onFilesDropped }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { activeProjectId, addTreeItem, projects } = useProjectStore();
  const { addFile } = useFileStore();

  // Handle drag events
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

  // Process dropped files
  const processFiles = useCallback(
    async (files: File[]) => {
      const targetProjectId = activeProjectId || projects[0]?.id;
      if (!targetProjectId) {
        console.error('No project to add files to');
        return;
      }

      for (const file of files) {
        const fileType = getFileTypeFromExtension(file.name);
        if (fileType) {
          // Store file in fileStore for preview (now async)
          const uploadedFile = await addFile(file, fileType);
          
          // Add to project tree with reference to stored file
          addTreeItem({
            projectId: targetProjectId,
            name: file.name,
            type: fileType,
            origin: 'imported',
            filePath: uploadedFile.id, // Reference to file in fileStore
            fileSize: file.size,
          });
          
          console.log(`📁 Uploaded: ${file.name} (${fileType}) - ID: ${uploadedFile.id}`);
        }
      }

      onFilesDropped?.(files);
    },
    [activeProjectId, projects, addTreeItem, addFile, onFilesDropped]
  );

  // Handle drop
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

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
  );

  // Handle click to open file dialog
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
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.mp4,.mov,.webm,.mp3,.m4a,.wav,.md,.markdown,.png,.jpg,.jpeg,.gif,.svg"
          onChange={handleFileInputChange}
        />

        {/* Icon */}
        <div className="flex justify-center mb-2">
          <Upload
            size={20}
            className={`transition-colors ${isDragOver ? 'text-blue-400' : 'text-gray-500'}`}
          />
        </div>

        {/* Text */}
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

        {/* Supported formats */}
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
