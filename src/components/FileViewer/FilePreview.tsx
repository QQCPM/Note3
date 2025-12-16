import React, { useState, useEffect } from 'react';
import { FileText, Film, Image, Music, File } from 'lucide-react';
import PDFViewer from './PDFViewer';

interface FilePreviewProps {
  file: File | null;
  fileUrl?: string;
  fileType: 'pdf' | 'video' | 'audio' | 'image' | 'note' | 'markdown' | 'folder' | 'link';
  fileName?: string;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  fileUrl,
  fileType,
  fileName,
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Create object URL for File objects
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    return undefined;
  }, [file]);

  const displayUrl = fileUrl || objectUrl;

  // Render based on file type
  switch (fileType) {
    case 'pdf':
      if (!displayUrl && !file) {
        return <EmptyState icon={<FileText size={48} />} message="No PDF selected" />;
      }
      return <PDFViewer file={file || displayUrl!} />;

    case 'video':
      if (!displayUrl) {
        return <EmptyState icon={<Film size={48} />} message="No video selected" />;
      }
      return (
        <div className="flex items-center justify-center h-full bg-[#0d1117] p-4">
          <video
            src={displayUrl}
            controls
            className="max-w-full max-h-full rounded-lg shadow-xl"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );

    case 'audio':
      if (!displayUrl) {
        return <EmptyState icon={<Music size={48} />} message="No audio selected" />;
      }
      return (
        <div className="flex flex-col items-center justify-center h-full bg-[#0d1117] p-8">
          <div className="w-full max-w-md bg-[#161b22] rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-center mb-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Music size={40} className="text-white" />
              </div>
            </div>
            {fileName && (
              <p className="text-center text-gray-300 mb-4 truncate">{fileName}</p>
            )}
            <audio src={displayUrl} controls className="w-full">
              Your browser does not support the audio tag.
            </audio>
          </div>
        </div>
      );

    case 'image':
      if (!displayUrl) {
        return <EmptyState icon={<Image size={48} />} message="No image selected" />;
      }
      return (
        <div className="flex items-center justify-center h-full bg-[#0d1117] p-4 overflow-auto">
          <img
            src={displayUrl}
            alt={fileName || 'Preview'}
            className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
          />
        </div>
      );

    default:
      return (
        <EmptyState
          icon={<File size={48} />}
          message={`Preview not available for ${fileType} files`}
        />
      );
  }
};

// Empty state component
const EmptyState: React.FC<{ icon: React.ReactNode; message: string }> = ({
  icon,
  message,
}) => (
  <div className="flex flex-col items-center justify-center h-full bg-[#0d1117] text-gray-500">
    <div className="mb-4 opacity-50">{icon}</div>
    <p className="text-sm">{message}</p>
  </div>
);

export default FilePreview;
