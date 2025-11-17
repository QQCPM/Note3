import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import type {
  MindmapData,
  FlashcardData,
  ConceptData,
  ExerciseData,
  ResourceData,
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

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">◈</span>
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

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">▪</span>
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
            ✓ Add to Note
          </button>
        </div>
      </div>
    </div>
  );
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

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">▭</span>
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
            💾 Save All Flashcards
          </button>
        </div>
      </div>
    </div>
  );
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

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">{'{ }'}</span>
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
            ✓ Add to Note
          </button>
        </div>
      </div>
    </div>
  );
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

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">∞</span>
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
            📎 Add Links to Note
          </button>
        </div>
      </div>
    </div>
  );
};
