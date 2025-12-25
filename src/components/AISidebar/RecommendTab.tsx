import React, { useState, useEffect, useRef } from 'react';
import { useNotesStore } from '@/store/notesStore';
import { AlertCircle } from 'lucide-react';
import {
  MindmapModal,
  ConceptsModal,
  FlashcardsModal,
  ExercisesModal,
  ResourcesModal,
  SlidesModal,
} from './RecommendModals';
import {
  analyzeNoteForRecommendations,
  generateRecommendation,
  generateSlides,
  isGeminiServiceReady,
} from '@/services/recommendationService';
import { useBlocksStore } from '@/store/blocksStore';
import { useAIStore } from '@/store/aiStore';
import type { RecommendationData } from '@/types/recommendation';

interface Recommendation {
  id: string;

  title: string;
  badge?: string;
  badgeType?: 'new' | 'trending';
  description: string;
  tags: string[];
  primaryAction: string;
  secondaryAction: string;
  modalType: 'mindmap' | 'concepts' | 'flashcards' | 'exercises' | 'resources' | 'slides';
}

const RecommendTab: React.FC = () => {

  const { activeNoteId, notes } = useNotesStore();
  const { slideProgress } = useAIStore();
  const { getBlocksByNoteId } = useBlocksStore();
  const [analyzing, setAnalyzing] = useState(false);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [recommendationData, setRecommendationData] = useState<RecommendationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState<string | null>(null);
  const [thinkingMessage, setThinkingMessage] = useState<string>('');
  const [thinkingMessageForType, setThinkingMessageForType] = useState<Record<string, string>>({});
  const [thinkingMessageKey, setThinkingMessageKey] = useState<number>(0);
  const thinkingIntervalRef = useRef<number | null>(null);
  /* const [slideProgressMessage, setSlideProgressMessage] = useState<string>(''); // Moved to global store */

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
      title: 'Advanced Concepts',
      description: 'Explore advanced topics and related concepts. Each concept builds on your current understanding.',
      tags: ['Deep Dive', 'Learning', 'Theory'],
      primaryAction: 'View',
      secondaryAction: 'Dismiss',
      modalType: 'concepts',
    },
    {
      id: 'flashcards',
      title: 'Flashcards',
      description: 'Interactive flashcards to memorize key concepts and definitions from your notes.',
      tags: ['Study', 'Memory', 'Practice'],
      primaryAction: 'Try',
      secondaryAction: 'Later',
      modalType: 'flashcards',
    },
    {
      id: 'exercises',
      title: 'Practice Problems',
      description: 'Hands-on coding exercises and practice problems based on your note content.',
      tags: ['Code', 'Practice', 'Hands-on'],
      primaryAction: 'View',
      secondaryAction: 'Skip',
      modalType: 'exercises',
    },
    {
      id: 'resources',
      title: 'Resources',
      description: 'Curated papers, courses, and tutorials related to your current topic.',
      tags: ['Papers', 'Courses', 'Videos'],
      primaryAction: 'Browse',
      secondaryAction: 'Dismiss',
      modalType: 'resources',
    },
    {
      id: 'slides',
      title: 'Educational Slides',
      badge: 'Update',
      badgeType: 'new',
      description: 'Generate detailed visual slides with diagrams, charts, and explanations using Gemini 3 Pro.',
      tags: ['Visual', 'Diagrams', 'Pedagogy'],
      primaryAction: 'Generate',
      secondaryAction: 'Dismiss',
      modalType: 'slides',
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

  // Helper function to extract note content from blocks
  const extractNoteContent = (): string => {
    const note = notes.find(n => n.id === activeNoteId);
    const blocks = getBlocksByNoteId(activeNoteId || '');

    let content = note?.title ? `# ${note.title}\n\n` : '';

    for (const block of blocks) {
      const data = block.data;
      if (block.type === 'text' && data.type === 'text') {
        content += `${data.content}\n\n`;
      } else if (block.type === 'heading1' && data.type === 'heading1') {
        content += `# ${data.content}\n\n`;
      } else if (block.type === 'heading2' && data.type === 'heading2') {
        content += `## ${data.content}\n\n`;
      } else if (block.type === 'database' && data.type === 'database') {
        content += `## Database: ${data.title}\n\n`;
      }
    }

    return content;
  };

  const handleManualAnalysis = async () => {
    if (!activeNoteId || analyzing) return;

    setAnalyzing(true);
    setError(null);
    setRecommendationData(null);
    startThinkingAnimation();

    try {
      // Extract note content from frontend blocks
      const noteContent = extractNoteContent();

      if (!noteContent || noteContent.trim().length < 10) {
        throw new Error('Note content is too short or empty. Please add more content.');
      }

      console.log('🔍 [RecommendTab] Starting analysis for note:', activeNoteId);
      console.log('📝 Note content length:', noteContent.length, 'characters');

      const data = await analyzeNoteForRecommendations(activeNoteId, noteContent);
      console.log('✅ [RecommendTab] Analysis complete:', data);
      setRecommendationData(data);
      setError(null);
    } catch (err) {
      console.error('❌ [RecommendTab] Failed to analyze note:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze note';
      setError(errorMessage);
      setRecommendationData(null);
    } finally {
      setAnalyzing(false);
      stopThinkingAnimation();
    }
  };

  const handleCardClick = async (modalType: string) => {
    if (!activeNoteId) return;

    // Special handling for slides - uses Gemini service
    if (modalType === 'slides') {
      // Check if slides already exist - just open modal
      if (recommendationData?.slides && recommendationData.slides.length > 0) {
        setOpenModal(modalType);
        return;
      }

      // Check if Gemini service is ready
      if (!isGeminiServiceReady()) {
        setError('Gemini service not configured. Please add your Google AI API key to .env file (VITE_GEMINI_API_KEY)');
        return;
      }

      // Use helper to extract note content
      const noteContent = extractNoteContent();

      if (!noteContent || noteContent.trim().length < 10) {
        setError('Note content is too short or empty. Please add more content to generate slides.');
        return;
      }

      // Start background generation
      const { startSlideGeneration, updateSlideProgress, finishSlideGeneration, setSlideError } = useAIStore.getState();

      startSlideGeneration();

      // Fire and forget - don't await this
      console.log('🎓 Starting background slide generation for note:', activeNoteId);

      generateSlides(activeNoteId, 8, (progress) => {
        updateSlideProgress(progress);
      }, noteContent)
        .then((slides) => {
          console.log('✅ Background generation complete');
          finishSlideGeneration(slides);
          // Also update local data so the modal has it when opened
          setRecommendationData(prev => ({
            ...prev,
            slides,
          }));
        })
        .catch((err) => {
          console.error('❌ Background generation failed:', err);
          setSlideError(err instanceof Error ? err.message : 'Failed to generate slides');
        });

      return;
    }

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
    // If closing slides modal, we don't necessarily want to reset background state 
    // because user might want to check progress again. 
    // BUT if the modal was just for viewing results and we want to clear "Generating..." status if it was stuck
    // we can do it here. For now, let's keep background state alive so the "Generating..." card stays.
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
        {visibleRecommendations.map((rec) => {
          // Special UI for slides when generating in background
          const isSlides = rec.modalType === 'slides';
          const { isGeneratingSlides, slideProgress } = useAIStore();
          const isGeneratingThis = isSlides && isGeneratingSlides;

          return (
            <div
              key={rec.id}
              className={`billboard-card ${isGeneratingThis ? 'border-blue-500/50 bg-blue-900/10' : ''}`}
              onClick={() => handleCardClick(rec.modalType)}
            >
              <div className="billboard-header">
                <span className="billboard-title flex items-center gap-2">
                  {rec.title}
                  {isGeneratingThis && <span className="animate-pulse text-blue-400">●</span>}
                </span>
                {rec.badge && !isGeneratingThis && (
                  <span className={`billboard-badge ${rec.badgeType || ''}`}>
                    {rec.badge}
                  </span>
                )}
              </div>
              <div className="billboard-content">
                {isGeneratingThis ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-blue-300 font-medium text-sm animate-pulse">
                      {slideProgress.message || 'Generating slides in background...'}
                    </span>
                    <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{
                          width: `${slideProgress.total > 0 ? (slideProgress.current / slideProgress.total) * 100 : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">
                      You can continue utilizing other features.
                    </span>
                  </div>
                ) : (
                  loadingRecommendation === rec.modalType && thinkingMessageForType[rec.modalType] ? (
                    <span className="thinking-text-card" key={`${rec.modalType}-${thinkingMessageForType[rec.modalType]}`}>
                      {thinkingMessageForType[rec.modalType]}
                    </span>
                  ) : (
                    rec.description
                  )
                )}
              </div>
              <div className="billboard-tags">
                {!isGeneratingThis && rec.tags.map((tag, idx) => (
                  <span key={idx} className="billboard-tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="billboard-actions">
                {isGeneratingThis ? (
                  <button className="billboard-btn billboard-btn-primary opacity-50 cursor-not-allowed">
                    Generating...
                  </button>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          );
        })}
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
      <SlidesModal
        isOpen={openModal === 'slides'}
        onClose={handleCloseModal}
        onAction={handleModalAction}
        data={recommendationData?.slides}
        loading={loadingRecommendation === 'slides'}
        progressMessage={slideProgress.message}
      />
    </div>
  );
};

export default RecommendTab;
