import React, { useState, useEffect } from 'react';
import { useNotesStore } from '@/store/notesStore';
import { Sparkles } from 'lucide-react';
import {
  MindmapModal,
  ConceptsModal,
  FlashcardsModal,
  ExercisesModal,
  ResourcesModal,
} from './RecommendModals';

interface Recommendation {
  id: string;
  icon: string;
  title: string;
  badge?: string;
  badgeType?: 'new' | 'trending';
  description: string;
  tags: string[];
  primaryAction: string;
  secondaryAction: string;
  modalType: 'mindmap' | 'concepts' | 'flashcards' | 'exercises' | 'resources';
}

const RecommendTab: React.FC = () => {
  const { activeNoteId, notes } = useNotesStore();
  const [analyzing, setAnalyzing] = useState(false);
  const [activeNote, setActiveNote] = useState<string | null>(null);

  // Get the current note content
  useEffect(() => {
    if (activeNoteId) {
      const note = notes.find(n => n.id === activeNoteId);
      setActiveNote(note?.title || null);
    }
  }, [activeNoteId, notes]);

  const recommendations: Recommendation[] = [
    {
      id: 'mindmap',
      icon: '◈',
      title: 'Generate Mindmap',
      badge: 'New',
      badgeType: 'new',
      description: 'Visualize your study guide as an interactive mindmap. See connections between concepts and understand the big picture.',
      tags: ['Visual', 'Structure', 'Overview'],
      primaryAction: 'View',
      secondaryAction: 'Dismiss',
      modalType: 'mindmap',
    },
    {
      id: 'concepts',
      icon: '▪',
      title: 'Advanced Concepts',
      description: 'Explore advanced topics and related concepts. Each concept builds on your current understanding.',
      tags: ['Deep Dive', 'Learning', 'Theory'],
      primaryAction: 'View',
      secondaryAction: 'Dismiss',
      modalType: 'concepts',
    },
    {
      id: 'flashcards',
      icon: '▭',
      title: 'Flashcards',
      description: 'Interactive flashcards to memorize key concepts and definitions from your notes.',
      tags: ['Study', 'Memory', 'Practice'],
      primaryAction: 'Try',
      secondaryAction: 'Later',
      modalType: 'flashcards',
    },
    {
      id: 'exercises',
      icon: '{ }',
      title: 'Practice Problems',
      description: 'Hands-on coding exercises and practice problems based on your note content.',
      tags: ['Code', 'Practice', 'Hands-on'],
      primaryAction: 'View',
      secondaryAction: 'Skip',
      modalType: 'exercises',
    },
    {
      id: 'resources',
      icon: '∞',
      title: 'Resources',
      description: 'Curated papers, courses, and tutorials related to your current topic.',
      tags: ['Papers', 'Courses', 'Videos'],
      primaryAction: 'Browse',
      secondaryAction: 'Dismiss',
      modalType: 'resources',
    },
  ];

  const [dismissedCards, setDismissedCards] = useState<Set<string>>(new Set());
  const [openModal, setOpenModal] = useState<string | null>(null);

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedCards(prev => new Set(prev).add(id));
  };

  const handleCardClick = (modalType: string) => {
    setOpenModal(modalType);
  };

  const handleCloseModal = () => {
    setOpenModal(null);
  };

  const handleModalAction = () => {
    console.log('Adding content to note...');
    // TODO: Add content to the current note
    handleCloseModal();
  };

  const visibleRecommendations = recommendations.filter(r => !dismissedCards.has(r.id));

  return (
    <div className="tab-content active overflow-y-auto">
      <div className="ai-conversation-flow">
        {/* Analysis Status */}
        <div className={`analysis-status ${activeNote ? 'active' : ''}`}>
          <span className={analyzing ? 'pulse' : ''}>○</span>
          <span>
            {activeNote ? (
              <>Analyzing: <strong>{activeNote}</strong></>
            ) : (
              'Select a note to get recommendations'
            )}
          </span>
        </div>

        {/* Billboard Cards */}
        {visibleRecommendations.map((rec) => (
          <div
            key={rec.id}
            className="billboard-card"
            onClick={() => handleCardClick(rec.modalType)}
          >
            <div className="billboard-header">
              <span className="billboard-icon-simple">{rec.icon}</span>
              <span className="billboard-title">{rec.title}</span>
              {rec.badge && (
                <span className={`billboard-badge ${rec.badgeType || ''}`}>
                  {rec.badge}
                </span>
              )}
            </div>
            <div className="billboard-content">{rec.description}</div>
            <div className="billboard-tags">
              {rec.tags.map((tag, idx) => (
                <span key={idx} className="billboard-tag">
                  {tag}
                </span>
              ))}
            </div>
            <div className="billboard-actions">
              <button
                className="billboard-btn billboard-btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick(rec.modalType);
                }}
              >
                {rec.primaryAction}
              </button>
              <button
                className="billboard-btn billboard-btn-secondary"
                onClick={(e) => handleDismiss(rec.id, e)}
              >
                {rec.secondaryAction}
              </button>
            </div>
          </div>
        ))}

        {/* Info Box */}
        <div className="message-group" style={{ marginTop: '8px' }}>
          <div className="bg-[#161b22] rounded-lg p-4 border border-[#30363d]">
            <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
              <Sparkles size={16} className="text-purple-400" />
              How Recommendations Work
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              The AI analyzes your note content in real-time and suggests relevant
              resources, study tools, and enhancements. Recommendations update
              automatically as you edit your notes.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <MindmapModal
        isOpen={openModal === 'mindmap'}
        onClose={handleCloseModal}
        onAction={handleModalAction}
      />
      <ConceptsModal
        isOpen={openModal === 'concepts'}
        onClose={handleCloseModal}
        onAction={handleModalAction}
      />
      <FlashcardsModal
        isOpen={openModal === 'flashcards'}
        onClose={handleCloseModal}
        onAction={handleModalAction}
      />
      <ExercisesModal
        isOpen={openModal === 'exercises'}
        onClose={handleCloseModal}
        onAction={handleModalAction}
      />
      <ResourcesModal
        isOpen={openModal === 'resources'}
        onClose={handleCloseModal}
        onAction={handleModalAction}
      />
    </div>
  );
};

export default RecommendTab;
