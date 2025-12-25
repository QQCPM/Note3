import { jsPDF } from 'jspdf';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import type {
  MindmapData,
  FlashcardData,
  ConceptData,
  ExerciseData,
  ResourceData,
  SlideData,
} from '@/types/recommendation';
import RichTextRenderer from '@/components/Blocks/RichTextRenderer';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: () => void;
  loading?: boolean;
}

// Helper function to render mindmap nodes recursively
const renderMindmapNodes = (nodes: any[], level: number = 0): React.ReactNode => {
  if (!nodes || nodes.length === 0) return null;

  return (
    <div className="mindmap-level">
      {nodes.map((node, idx) => (
        <div key={node.id || idx} className="mindmap-branch">
          <div className="mindmap-node">{node.label}</div>
          {node.children && node.children.length > 0 && (
            <>
              <div className="mindmap-connector"></div>
              <div className="mindmap-children">
                {renderMindmapNodes(node.children, level + 1)}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export const MindmapModal: React.FC<ModalProps & { data?: MindmapData }> = ({
  isOpen,
  onClose,
  onAction,
  data,
  loading = false,
}) => {
  if (!isOpen) return null;

  const hasData = data && data.center && data.nodes && data.nodes.length > 0;

  const modalContent = (
    <div className="modal-overlay active" onClick={onClose} style={{ zIndex: 999999 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Mindmap</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <p className="modal-description">
              Visual overview of your study guide showing key concepts and their relationships.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-gray-400" size={32} />
              <span className="ml-3 text-gray-400">Generating mindmap...</span>
            </div>
          ) : hasData ? (
            <div className="mindmap-container">
              {/* Center Node */}
              <div className="mindmap-node center">{data.center}</div>
              <div className="mindmap-connector"></div>
              {/* Render nodes recursively */}
              {renderMindmapNodes(data.nodes)}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-400">No mindmap data available. Please wait for analysis to complete.</p>
            </div>
          )}

          <div className="modal-section">
            <div className="bg-[#161b22] rounded-lg p-3 border border-[#30363d]">
              <div className="text-xs text-gray-400 mb-1 font-semibold">Interactive Mindmap</div>
              <p className="text-xs text-gray-500 leading-relaxed">
                This visualization helps you see how concepts connect and build upon each other.
              </p>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="modal-btn modal-btn-primary" onClick={onAction}>
            Add to Note
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export const ConceptsModal: React.FC<ModalProps & { data?: ConceptData[] }> = ({
  isOpen,
  onClose,
  onAction,
  data,
  loading = false,
}) => {
  if (!isOpen) return null;

  const concepts = data || [];
  const hasData = concepts.length > 0;

  const modalContent = (
    <div className="modal-overlay active" onClick={onClose} style={{ zIndex: 999999 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Advanced Concepts</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <p className="modal-description">
              Expand your knowledge with these advanced concepts. Each topic builds on your current understanding.
            </p>
          </div>

          <div className="modal-section">
            <h3 className="modal-section-title">Topics to Explore</h3>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-gray-400" size={32} />
                <span className="ml-3 text-gray-400">Generating concepts...</span>
              </div>
            ) : hasData ? (
              <div className="concept-list">
                {concepts.map((concept, idx) => (
                  <div key={idx} className="concept-item">
                    <div className="concept-item-title">
                      <span>—</span>
                      <span>{concept.title}</span>
                    </div>
                    <div className="concept-item-desc">
                      <RichTextRenderer content={concept.description} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-400">No concepts available. Please wait for analysis to complete.</p>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-btn modal-btn-primary" onClick={onAction}>
            Add to Note
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export const FlashcardsModal: React.FC<ModalProps & { data?: FlashcardData[] }> = ({
  isOpen,
  onClose,
  onAction,
  data,
  loading = false,
}) => {
  // All hooks must be declared first, before any conditional returns
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // All variable declarations must come before early returns
  const flashcardsData = data || [];
  const hasData = flashcardsData.length > 0;

  // Reset to first card when data changes
  useEffect(() => {
    if (hasData && currentCard >= flashcardsData.length) {
      setCurrentCard(0);
      setFlipped(false);
    }
  }, [hasData, flashcardsData.length, currentCard]);

  // Early return after all hooks and declarations
  if (!isOpen) return null;

  // Event handlers
  const handleFlip = () => setFlipped(!flipped);
  const handleNext = () => {
    if (currentCard < flashcardsData.length - 1) {
      setCurrentCard(currentCard + 1);
      setFlipped(false);
    }
  };
  const handlePrev = () => {
    if (currentCard > 0) {
      setCurrentCard(currentCard - 1);
      setFlipped(false);
    }
  };

  const modalContent = (
    <div className="modal-overlay active" onClick={onClose} style={{ zIndex: 999999 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Flashcards</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <p className="modal-description">
              Review key concepts with interactive flashcards. Click or tap to flip.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-gray-400" size={32} />
              <span className="ml-3 text-gray-400">Generating flashcards...</span>
            </div>
          ) : hasData ? (
            <div className="flashcard-container">
              <div className="flashcard-wrapper">
                <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={handleFlip}>
                  <div className="flashcard-face flashcard-front">
                    <div className="flashcard-label">Question</div>
                    <div className="flashcard-text">
                      <RichTextRenderer content={flashcardsData[currentCard]?.question || ''} />
                    </div>
                    <div className="flashcard-hint">Click to reveal answer</div>
                  </div>
                  <div className="flashcard-face flashcard-back">
                    <div className="flashcard-label">Answer</div>
                    <div className="flashcard-text">
                      <RichTextRenderer content={flashcardsData[currentCard]?.answer || ''} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flashcard-controls">
                <button
                  className="flashcard-btn"
                  onClick={handlePrev}
                  disabled={currentCard === 0}
                >
                  ←
                </button>
                <span className="flashcard-counter">
                  {currentCard + 1} / {flashcardsData.length}
                </span>
                <button
                  className="flashcard-btn"
                  onClick={handleNext}
                  disabled={currentCard === flashcardsData.length - 1}
                >
                  →
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-400">No flashcards available. Please wait for analysis to complete.</p>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="modal-btn modal-btn-primary" onClick={onAction}>
            Save All Flashcards
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export const ExercisesModal: React.FC<ModalProps & { data?: ExerciseData[] }> = ({
  isOpen,
  onClose,
  onAction,
  data,
  loading = false,
}) => {
  if (!isOpen) return null;

  const exercises = data || [];
  const hasData = exercises.length > 0;

  const modalContent = (
    <div className="modal-overlay active" onClick={onClose} style={{ zIndex: 999999 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Practice Problems</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <p className="modal-description">
              Hands-on Python exercises to reinforce your knowledge. Each exercise includes starter code.
            </p>
          </div>

          <div className="modal-section">
            <h3 className="modal-section-title">Available Exercises</h3>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-gray-400" size={32} />
                <span className="ml-3 text-gray-400">Generating exercises...</span>
              </div>
            ) : hasData ? (
              <div className="concept-list">
                {exercises.map((ex, idx) => (
                  <div key={idx} className="concept-item">
                    <div className="concept-item-title">
                      <span>●</span>
                      <span>{ex.title}</span>
                      {ex.difficulty && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                          {ex.difficulty}
                        </span>
                      )}
                    </div>
                    <div className="concept-item-desc">
                      <RichTextRenderer content={ex.description} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-400">No exercises available. Please wait for analysis to complete.</p>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-btn modal-btn-primary" onClick={onAction}>
            Add to Note
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export const ResourcesModal: React.FC<ModalProps & { data?: ResourceData[] }> = ({
  isOpen,
  onClose,
  onAction,
  data,
  loading = false,
}) => {
  if (!isOpen) return null;

  const resources = data || [];
  const hasData = resources.length > 0;

  const modalContent = (
    <div className="modal-overlay active" onClick={onClose} style={{ zIndex: 999999 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Resources</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <p className="modal-description">
              Handpicked resources to deepen your understanding. From research papers to video tutorials.
            </p>
          </div>

          <div className="modal-section">
            <h3 className="modal-section-title">Recommended Resources</h3>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-gray-400" size={32} />
                <span className="ml-3 text-gray-400">Generating resources...</span>
              </div>
            ) : hasData ? (
              <div className="resource-list">
                {resources.map((res, idx) => (
                  <div key={idx} className="resource-item">
                    <span className="resource-type">{res.type}</span>
                    <div className="resource-title">{res.title}</div>
                    <p className="resource-desc">{res.description}</p>
                    {res.link && (
                      <a
                        href={res.link.startsWith('http') ? res.link : `https://${res.link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="resource-link"
                        onClick={(e) => {
                          if (!res.link) e.preventDefault();
                        }}
                      >
                        {res.link} →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-400">No resources available. Please wait for analysis to complete.</p>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-btn modal-btn-primary" onClick={onAction}>
            Add Links to Note
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export const SlidesModal: React.FC<ModalProps & {
  data?: SlideData[];
  progressMessage?: string;
}> = ({
  isOpen,
  onClose,
  data,
  loading = false,
  progressMessage,
}) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const slides = data || [];
    const hasData = slides.length > 0;

    // Reset to first slide when data changes
    useEffect(() => {
      if (hasData && currentSlide >= slides.length) {
        setCurrentSlide(0);
      }
    }, [hasData, slides.length, currentSlide]);

    // Keyboard navigation - must be before early return
    useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' && currentSlide < slides.length - 1) {
          setCurrentSlide(prev => prev + 1);
        }
        if (e.key === 'ArrowLeft' && currentSlide > 0) {
          setCurrentSlide(prev => prev - 1);
        }
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentSlide, slides.length, onClose]);

    if (!isOpen) return null;

    const handleNext = () => {
      if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1);
    };

    const handlePrev = () => {
      if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
    };



    // ... (existing imports)

    const handleDownloadSlide = () => {
      if (!slides[currentSlide]) return;
      const slide = slides[currentSlide];
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${slide.imageData}`;
      link.download = `slide_${slide.slideNumber}_${slide.title.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const handleDownloadPDF = async (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (slides.length === 0) return;

      try {
        console.log(`📦 Generating PDF for ${slides.length} slides...`);

        // 16:9 aspect ratio: 297mm width (A4 landscape width)
        const pageWidth = 297;
        const pageHeight = pageWidth * (9 / 16); // ~167.06mm

        // Initialize PDF with custom format to match slide aspect ratio exactly
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: [pageWidth, pageHeight]
        });

        slides.forEach((slide, index) => {
          if (index > 0) {
            doc.addPage([pageWidth, pageHeight], 'landscape');
          }

          // Add image filling the entire page (no margins)
          doc.addImage(
            `data:image/png;base64,${slide.imageData}`,
            'PNG',
            0, // x
            0, // y
            pageWidth, // w
            pageHeight, // h
            undefined,
            'FAST'
          );
        });

        // Save the PDF
        const cleanTitle = slides[0].title.split(':')[0].substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim();
        doc.save(`${cleanTitle}_Slides.pdf`);
        console.log('✅ PDF Downloaded successfully');

      } catch (error) {
        console.error('❌ Failed to generate PDF:', error);
        alert('Failed to generate PDF. Please try again.');
      }
    };

    // Render modal using Portal to break free from parent stacking context
    const modalContent = (
      <div
        className="fixed inset-0 flex items-center justify-center"
        onClick={onClose}
        style={{
          zIndex: 999999,
        }}
      >
        {/* Backdrop with blur */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" style={{ zIndex: 1 }} />

        {/* Modal Container - Glassmorphic */}
        <div
          className="relative w-[95vw] max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
            zIndex: 10,
          }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full transition-all hover:bg-white/10"
            style={{
              backdropFilter: 'blur(10px)',
              zIndex: 20,
            }}
          >
            <X size={20} className="text-gray-400 hover:text-white" />
          </button>

          {loading ? (
            /* Loading State - Clean & Minimal */
            <div className="flex flex-col items-center justify-center py-24 px-8 h-full">
              <div className="relative mb-8">
                <div className="w-20 h-20 rounded-full bg-blue-500/10 animate-pulse" />
                <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-blue-500/30 blur-[1px]" />
                <div className="absolute inset-0 w-20 h-20 rounded-full border-t-2 border-blue-400 animate-spin" />
              </div>
              <h3 className="text-xl text-gray-200 font-medium tracking-tight">Generating Slides</h3>
              {progressMessage && (
                <p className="mt-3 text-sm text-blue-400/90 font-medium animate-pulse max-w-md text-center">
                  {progressMessage}
                </p>
              )}
              <p className="mt-4 text-xs text-gray-500 max-w-xs text-center leading-relaxed">
                Crafting visual explanations...
              </p>
            </div>
          ) : hasData ? (
            /* Slide Viewer - Clean Layout */
            <div className="flex flex-col h-full">
              {/* Main Slide Display */}
              <div className="flex-1 p-6 pb-2">
                <div
                  className="relative w-full rounded-xl overflow-hidden"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    aspectRatio: '16/9',
                    maxHeight: 'calc(90vh - 200px)',
                  }}
                >
                  <img
                    src={`data:image/png;base64,${slides[currentSlide]?.imageData}`}
                    alt={slides[currentSlide]?.title}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Bottom Bar - Glassmorphic */}
              <div
                className="px-6 py-4"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)',
                }}
              >
                {/* Slide Info */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="px-3 py-1 text-xs font-medium rounded-full"
                      style={{
                        background: 'rgba(59, 130, 246, 0.2)',
                        color: 'rgb(147, 197, 253)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                      }}
                    >
                      {slides[currentSlide]?.type}
                    </span>
                    <h3 className="text-base font-medium text-gray-200">
                      {slides[currentSlide]?.title}
                    </h3>
                  </div>
                  <span className="text-sm text-gray-500">
                    {currentSlide + 1} / {slides.length}
                  </span>
                </div>

                {/* Navigation & Thumbnails */}
                <div className="flex items-center gap-4">
                  {/* Prev Button */}
                  <button
                    onClick={handlePrev}
                    disabled={currentSlide === 0}
                    className="p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-gray-400">
                      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Thumbnail Strip */}
                  <div className="flex-1 flex gap-2 overflow-x-auto py-1 scrollbar-hide">
                    {slides.map((slide, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentSlide(idx)}
                        className={`flex-shrink-0 w-16 h-10 rounded-lg overflow-hidden transition-all ${idx === currentSlide
                          ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900'
                          : 'opacity-50 hover:opacity-80'
                          }`}
                      >
                        <img
                          src={`data:image/png;base64,${slide.imageData}`}
                          alt={`Slide ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={handleNext}
                    disabled={currentSlide === slides.length - 1}
                    className="p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-gray-400">
                      <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Download Buttons */}
                  <div className="flex gap-2 ml-2 border-l border-white/10 pl-4">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDownloadSlide();
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:bg-white/10 text-gray-400 hover:text-white"
                    >
                      Download
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDownloadPDF(e);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-blue-400 hover:text-blue-300"
                      style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        cursor: 'pointer',
                      }}
                    >
                      Download PDF (All)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20 px-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(59, 130, 246, 0.1)' }}
              >
                <span className="text-3xl">🎓</span>
              </div>
              <p className="text-gray-300 font-medium mb-2">No slides yet</p>
              <p className="text-sm text-gray-500 text-center max-w-sm">
                Generate educational slides from your notes using Gemini 3 Pro.
              </p>
            </div>
          )}
        </div>
      </div>
    );

    // Use React Portal to render at document root, breaking free from sidebar stacking context
    return ReactDOM.createPortal(modalContent, document.body);
  };
