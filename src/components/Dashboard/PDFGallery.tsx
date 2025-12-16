import React from 'react';
import { useProjectStore } from '@/store/projectStore';
import { FileText, ExternalLink } from 'lucide-react';

interface PDFGalleryProps {
  onSelectPDF?: (pdfId: string, filePath?: string) => void;
}

const PDFGallery: React.FC<PDFGalleryProps> = ({ onSelectPDF }) => {
  const treeItems = useProjectStore((s) => s.treeItems);
  const projects = useProjectStore((s) => s.projects);
  const setSelectedItem = useProjectStore((s) => s.setSelectedItem);

  // Get all PDFs from all projects
  const pdfItems = treeItems.filter((item) => item.type === 'pdf');

  // Get project name for a PDF
  const getProjectName = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    return project?.name || 'Unknown Project';
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePDFClick = (pdfId: string, filePath?: string) => {
    setSelectedItem(pdfId);
    onSelectPDF?.(pdfId, filePath);
  };

  if (pdfItems.length === 0) {
    return (
      <section className="secretary-section pdf-gallery">
        <h3 className="section-label">YOUR PDFS</h3>
        <div className="pdf-gallery-empty">
          <FileText className="w-8 h-8" />
          <p>No PDFs yet</p>
          <span>Drop PDF files in the sidebar to add them</span>
        </div>
      </section>
    );
  }

  return (
    <section className="secretary-section pdf-gallery">
      <h3 className="section-label">YOUR PDFS</h3>
      <div className="pdf-gallery-grid">
        {pdfItems.map((pdf) => (
          <button
            key={pdf.id}
            className="pdf-card"
            onClick={() => handlePDFClick(pdf.id, pdf.filePath)}
          >
            <div className="pdf-card-thumbnail">
              <FileText className="w-6 h-6" />
            </div>
            <div className="pdf-card-info">
              <span className="pdf-card-name" title={pdf.name}>
                {pdf.name}
              </span>
              <span className="pdf-card-meta">
                {pdf.pageCount && `${pdf.pageCount} pages`}
                {pdf.pageCount && pdf.fileSize && ' • '}
                {formatFileSize(pdf.fileSize)}
              </span>
              <span className="pdf-card-project">
                {getProjectName(pdf.projectId)}
              </span>
            </div>
            <div className="pdf-card-action">
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default PDFGallery;
