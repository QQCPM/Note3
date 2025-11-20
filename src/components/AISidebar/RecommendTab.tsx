import React, { useState, useEffect, useRef } from 'react';
import { useNotesStore } from '@/store/notesStore';
import { Sparkles, AlertCircle } from 'lucide-react';
import {
  MindmapModal,
  ConceptsModal,
  FlashcardsModal,
  ExercisesModal,
  ResourcesModal,
} from './RecommendModals';
import { analyzeNoteForRecommendations, generateRecommendation } from '@/services/recommendationService';
import type { RecommendationData } from '@/types/recommendation';

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
  const [recommendationData, setRecommendationData] = useState<RecommendationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState<string | null>(null);
  const [thinkingMessage, setThinkingMessage] = useState<string>('');
  const [thinkingMessageForType, setThinkingMessageForType] = useState<Record<string, string>>({});
  const [thinkingMessageKey, setThinkingMessageKey] = useState<number>(0);
  const thinkingIntervalRef = useRef<number | null>(null);

  // Get the current note content
  useEffect(() => {
    if (activeNoteId) {
      const note = notes.find(n => n.id === activeNoteId);
      setActiveNote(note?.title || null);
    } else {
      setActiveNote(null);
      setRecommendationData(null);
      setError(null);
      setAnalyzing(false);
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

  // Thinking messages that cycle during analysis
  const thinkingMessages = [
    'Reading your note content...',
    'Understanding key concepts...',
    'Analyzing relationships...',
    'Generating recommendations...',
    'Almost done...',
  ];

  // Start thinking animation
  const startThinkingAnimation = () => {
    let messageIndex = 0;
    setThinkingMessage(thinkingMessages[0]);
    setThinkingMessageKey(0);
    
    thinkingIntervalRef.current = setInterval(() => {
      messageIndex = (messageIndex + 1) % thinkingMessages.length;
      setThinkingMessage(thinkingMessages[messageIndex]);
      setThinkingMessageKey(prev => prev + 1); // Force re-render for smooth transition
    }, 1500); // Change message every 1.5 seconds
  };

  // Stop thinking animation
  const stopThinkingAnimation = () => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
    setThinkingMessage('');
  };

  const handleManualAnalysis = async () => {
    if (!activeNoteId || analyzing) return;

    setAnalyzing(true);
    setError(null);
    setRecommendationData(null);
    startThinkingAnimation();

    try {
      const data = await analyzeNoteForRecommendations(activeNoteId);
      setRecommendationData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to analyze note:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze note');
      setRecommendationData(null);
    } finally {
      setAnalyzing(false);
      stopThinkingAnimation();
    }
  };

  const handleCardClick = async (modalType: string) => {
    if (!activeNoteId) return;

    // If recommendation data doesn't exist for this type, generate it on demand
    const needsGeneration = 
      (modalType === 'mindmap' && !recommendationData?.mindmap) ||
      (modalType === 'flashcards' && !recommendationData?.flashcards) ||
      (modalType === 'concepts' && !recommendationData?.concepts) ||
      (modalType === 'exercises' && !recommendationData?.exercises) ||
      (modalType === 'resources' && !recommendationData?.resources);

    if (needsGeneration) {
      setLoadingRecommendation(modalType);
      // Start thinking animation for this specific type
      const typeMessages: Record<string, string[]> = {
        mindmap: ['Mapping concepts...', 'Connecting ideas...', 'Building structure...'],
        flashcards: ['Extracting key points...', 'Creating questions...', 'Formulating answers...'],
        concepts: ['Identifying topics...', 'Exploring connections...', 'Refining concepts...'],
        exercises: ['Designing problems...', 'Creating challenges...', 'Preparing exercises...'],
        resources: ['Searching resources...', 'Curating content...', 'Selecting materials...'],
      };
      
      const messages = typeMessages[modalType] || thinkingMessages;
      let msgIndex = 0;
      setThinkingMessageForType(prev => ({ ...prev, [modalType]: messages[0] }));
      
      const msgInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % messages.length;
        setThinkingMessageForType(prev => ({ ...prev, [modalType]: messages[msgIndex] }));
      }, 1200);

      try {
        await generateRecommendation(activeNoteId, modalType as any);
        // Refresh recommendation data
        const updated = await analyzeNoteForRecommendations(activeNoteId);
        setRecommendationData(updated);
      } catch (err) {
        console.error(`Failed to generate ${modalType}:`, err);
        setError(err instanceof Error ? err.message : `Failed to generate ${modalType}`);
      } finally {
        clearInterval(msgInterval);
        setLoadingRecommendation(null);
        setThinkingMessageForType(prev => {
          const updated = { ...prev };
          delete updated[modalType];
          return updated;
        });
      }
    }

    setOpenModal(modalType);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
      }
    };
  }, []);

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
          <span 
            className={`${analyzing ? 'pulse' : ''} ${activeNoteId ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={activeNoteId ? handleManualAnalysis : undefined}
            title={activeNoteId ? 'Click to analyze note and generate recommendations' : ''}
          >
            ○
          </span>
          <span>
            {activeNote ? (
              <>
                {analyzing ? (
                  <span className="thinking-text" key={thinkingMessageKey}>
                    {thinkingMessage || 'Analyzing...'} <strong>{activeNote}</strong>
                  </span>
                ) : recommendationData ? (
                  <>Ready: <strong>{activeNote}</strong></>
                ) : error ? (
                  <>Error analyzing <strong>{activeNote}</strong></>
                ) : (
                  <>Click ○ to analyze <strong>{activeNote}</strong></>
                )}
              </>
            ) : (
              'Select a note to get recommendations'
            )}
          </span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="message-group" style={{ marginTop: '8px' }}>
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
              <div className="text-sm text-red-400 mb-2 flex items-center gap-2">
                <AlertCircle size={16} />
                Analysis Error
              </div>
              <p className="text-xs text-red-300 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

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
            <div className="billboard-content">
              {loadingRecommendation === rec.modalType && thinkingMessageForType[rec.modalType] ? (
                <span className="thinking-text-card" key={`${rec.modalType}-${thinkingMessageForType[rec.modalType]}`}>
                  {thinkingMessageForType[rec.modalType]}
                </span>
              ) : (
                rec.description
              )}
            </div>
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
        data={recommendationData?.mindmap}
        loading={loadingRecommendation === 'mindmap'}
      />
      <ConceptsModal
        isOpen={openModal === 'concepts'}
        onClose={handleCloseModal}
        onAction={handleModalAction}
        data={recommendationData?.concepts}
        loading={loadingRecommendation === 'concepts'}
      />
      <FlashcardsModal
        isOpen={openModal === 'flashcards'}
        onClose={handleCloseModal}
        onAction={handleModalAction}
        data={recommendationData?.flashcards}
        loading={loadingRecommendation === 'flashcards'}
      />
      <ExercisesModal
        isOpen={openModal === 'exercises'}
        onClose={handleCloseModal}
        onAction={handleModalAction}
        data={recommendationData?.exercises}
        loading={loadingRecommendation === 'exercises'}
      />
      <ResourcesModal
        isOpen={openModal === 'resources'}
        onClose={handleCloseModal}
        onAction={handleModalAction}
        data={recommendationData?.resources}
        loading={loadingRecommendation === 'resources'}
      />
    </div>
  );
};

export default RecommendTab;
