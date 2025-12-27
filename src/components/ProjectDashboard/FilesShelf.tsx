import React, { useRef } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useFileStore } from '@/store/fileStore';
import { ChevronLeft, ChevronRight, FolderOpen, Plus } from 'lucide-react';
import { FileType } from '@/types/project';

interface FilesShelfProps {
    projectId: string;
}

const FilesShelf: React.FC<FilesShelfProps> = ({ projectId }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { getTreeItemsByProject, addTreeItem } = useProjectStore();
    const { setActiveFile, addFile, getFile } = useFileStore();

    // Get all file items (pdf, video, audio, image, plus slides if any)
    const treeItems = getTreeItemsByProject(projectId);
    const fileItems = treeItems.filter((item) =>
        ['pdf', 'video', 'audio', 'image', 'markdown'].includes(item.type)
    );

    const getFileIcon = (type: string) => {
        switch (type) {
            case 'pdf': return '📕';
            case 'video': return '🎥';
            case 'audio': return '🎵';
            case 'image': return '🖼️';
            case 'markdown': return '📊';
            default: return '📄';
        }
    };

    const getFileTypeName = (type: string) => {
        switch (type) {
            case 'pdf': return 'PDF';
            case 'video': return 'Video';
            case 'audio': return 'Audio';
            case 'image': return 'Image';
            case 'markdown': return 'Slides';
            default: return 'File';
        }
    };

    const getFileType = (mimeType: string, extension: string): FileType => {
        if (mimeType.includes('pdf') || extension === '.pdf') return 'pdf';
        if (mimeType.includes('video')) return 'video';
        if (mimeType.includes('audio')) return 'audio';
        if (mimeType.includes('image')) return 'image';
        if (mimeType.includes('markdown') || extension === '.md') return 'markdown';
        return 'markdown'; // Default to markdown for unknown types
    };

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = 224;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth',
            });
        }
    };

    const handleAddClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const extension = '.' + file.name.split('.').pop()?.toLowerCase();
        const fileType = getFileType(file.type, extension);

        try {
            // Add to file store (persists to IndexedDB)
            const uploadedFile = await addFile(file, fileType);

            // Add to tree items for this project
            addTreeItem({
                projectId,
                parentId: null,
                name: file.name.replace(extension, ''),
                type: fileType,
                origin: 'imported',
                filePath: uploadedFile.id, // Use file ID as reference
            });

            console.log(`✅ Added file: ${file.name}`);
        } catch (error) {
            console.error('Failed to add file:', error);
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFileClick = async (item: any) => {
        const fileId = item.filePath || item.id;

        // Check if file exists in store
        const existingFile = getFile(fileId);
        if (existingFile) {
            setActiveFile(fileId);
        } else {
            // Try to load from IndexedDB
            setActiveFile(fileId);
        }
    };

    return (
        <section className="files-shelf">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.mp4,.mov,.webm,.mp3,.m4a,.wav,.jpg,.jpeg,.png,.gif"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />

            <div className="section-header">
                <h3 className="section-title">
                    <FolderOpen size={14} />
                    Files
                </h3>
                <button className="add-file-btn" onClick={handleAddClick}>
                    <Plus size={12} /> Add File
                </button>
            </div>

            {fileItems.length > 0 ? (
                <div className="files-shelf-container">
                    {fileItems.length > 5 && (
                        <button
                            className="shelf-scroll-btn left"
                            onClick={() => scroll('left')}
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                zIndex: 10,
                                background: '#21262d',
                                border: '1px solid #30363d',
                                borderRadius: '50%',
                                padding: '4px',
                                cursor: 'pointer',
                                color: '#7d8590',
                            }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                    )}

                    <div ref={scrollRef} className="files-shelf-scroll">
                        {fileItems.map((item) => {
                            const file = item.filePath ? getFile(item.filePath) : undefined;
                            return (
                                <div
                                    key={item.id}
                                    className="file-card"
                                    onClick={() => handleFileClick(item)}
                                >
                                    {/* Full-bleed Preview */}
                                    {item.type === 'pdf' && file?.thumbnailUrl ? (
                                        <img src={file.thumbnailUrl} alt={item.name} className="file-card-preview" />
                                    ) : item.type === 'pdf' ? (
                                        <div className="file-card-placeholder">
                                            <span className="file-icon-large">📕</span>
                                        </div>
                                    ) : item.type === 'image' && file?.objectUrl ? (
                                        <img src={file.objectUrl} alt={item.name} className="file-card-preview" />
                                    ) : (
                                        <div className="file-card-placeholder">
                                            <span className="file-icon-large">{getFileIcon(item.type)}</span>
                                        </div>
                                    )}
                                    {/* Glass Title Overlay */}
                                    <div className="file-card-overlay">
                                        <span className="file-card-name">{item.name}</span>
                                        <span className="file-card-type">{getFileTypeName(item.type)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {fileItems.length > 5 && (
                        <button
                            className="shelf-scroll-btn right"
                            onClick={() => scroll('right')}
                            style={{
                                position: 'absolute',
                                right: 0,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                zIndex: 10,
                                background: '#21262d',
                                border: '1px solid #30363d',
                                borderRadius: '50%',
                                padding: '4px',
                                cursor: 'pointer',
                                color: '#7d8590',
                            }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    )}
                </div>
            ) : (
                <div className="files-empty" onClick={handleAddClick} style={{ cursor: 'pointer' }}>
                    <p>No files imported yet. Click to add PDFs, videos, or audio files.</p>
                </div>
            )}
        </section>
    );
};

export default FilesShelf;
