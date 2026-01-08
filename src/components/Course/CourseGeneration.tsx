/**
 * CourseGeneration
 * 
 * Displays the AI course generation progress.
 * Uses LangGraph for multi-phase generation with human-in-the-loop approval.
 * 
 * Flow:
 * 1. Shows progress through analysis and planning stages
 * 2. When outline is ready → transitions to outline_approval view
 * 3. User can approve/reject outline via drag-drop editor
 * 4. On approval → continues content generation → completes
 */

import React, { useEffect, useRef, useState } from 'react';
import { Brain, Layout, FileText, Video, CheckSquare, AlertCircle } from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';
import type { GenerationStageType } from '@/types/course';
// Note: startCourseGeneration is dynamically imported to avoid loading LangGraph at startup

// ============================================================================
// CONSTANTS
// ============================================================================

const stageIcons: Record<GenerationStageType, React.ElementType> = {
  analysis: Brain,
  planning: Layout,
  content: FileText,
  multimedia: Video,
  review: CheckSquare,
};

// ============================================================================
// COMPONENT
// ============================================================================

const CourseGeneration: React.FC = () => {
  const {
    generationTopic,
    generationStages,
    currentStageIndex,
    updateGenerationStage,
    setPendingOutline,
    setViewMode,
    cancelGeneration,
  } = useCourseStore();

  const [error, setError] = useState<string | null>(null);
  const [thinkingOutput, setThinkingOutput] = useState<string>('');
  const generationStarted = useRef(false);
  const sessionIdRef = useRef<string>(`course-${Date.now()}`);

  // ========================================================================
  // GENERATION EFFECT
  // ========================================================================

  useEffect(() => {
    // Guard: Only run once
    if (generationStarted.current) return;
    if (!generationTopic || currentStageIndex < 0) return;

    generationStarted.current = true;

    const runGeneration = async () => {
      let unsubscribeProgress: (() => void) | null = null;
      
      try {
        // Phase 1: Analysis stage
        updateGenerationStage(0, { status: 'active', progress: 0 });
        setThinkingOutput('🔍 Starting course generation...\n');

        // Import course generator service
        const { startCourseGeneration, courseGeneratorService } = await import('@/services/courseGenerator');
        const sessionId = sessionIdRef.current;

        // Subscribe to REAL progress updates from worker
        const stageIndexMap: Record<string, number> = {
          'analysis': 0,
          'planning': 1,
          'content': 2,
          'multimedia': 3,
          'review': 4,
        };

        unsubscribeProgress = courseGeneratorService.onProgress(sessionId, (progress) => {
          // Update thinking output
          setThinkingOutput(progress.thinkingOutput);
          
          // Update stage progress
          const stageIdx = stageIndexMap[progress.stage] ?? 0;
          
          // Mark previous stages as complete
          for (let i = 0; i < stageIdx; i++) {
            updateGenerationStage(i, { status: 'complete', progress: 100 });
          }
          
          // Update current stage
          updateGenerationStage(stageIdx, { 
            status: 'active', 
            progress: progress.stageProgress 
          });
        });

        // Start generation
        const result = await startCourseGeneration(generationTopic, sessionId, {
          difficulty: 'intermediate',
          settings: {
            includeVideos: true,
            includeSlides: true,
            includePractice: true,
            includeQuizzes: true,
          },
        });

        // Update thinking output from result
        if (result.thinkingOutput) {
          setThinkingOutput(result.thinkingOutput);
        }

        // Handle result
        if (result.status === 'error') {
          throw new Error(result.error || 'Generation failed');
        }

        if (result.status === 'awaiting_approval' && result.outline) {
          // Mark stages as complete up to planning
          updateGenerationStage(0, { status: 'complete', progress: 100 });
          updateGenerationStage(1, { status: 'complete', progress: 100 });

          // Store outline and transition to approval view
          setPendingOutline(result.outline, sessionId, result.thinkingOutput);
          setViewMode('outline_approval');
          return;
        }

        if (result.status === 'complete' && result.course) {
          // Full course generated (shouldn't happen on first call)
          updateGenerationStage(0, { status: 'complete', progress: 100 });
          updateGenerationStage(1, { status: 'complete', progress: 100 });
          updateGenerationStage(2, { status: 'complete', progress: 100 });
          updateGenerationStage(3, { status: 'complete', progress: 100 });
          updateGenerationStage(4, { status: 'complete', progress: 100 });

          // Save and navigate
          useCourseStore.getState().completeGeneration(result.course);
          return;
        }

        // Default: still generating (shouldn't happen)
        console.warn('[CourseGeneration] Unexpected result status:', result.status);

      } catch (err) {
        console.error('[CourseGeneration] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate course');
      } finally {
        // Clean up progress subscription
        if (unsubscribeProgress) {
          unsubscribeProgress();
        }
      }
    };

    runGeneration();
  }, [generationTopic, currentStageIndex]);

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleCancel = () => {
    cancelGeneration();
    setViewMode('home');
  };

  const handleRetry = () => {
    setError(null);
    generationStarted.current = false;
    useCourseStore.getState().startGeneration({ topic: generationTopic });
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="course-generation">
      <div className="course-generation-content">
        {/* Header */}
        <div className="course-generation-header">
          <h2>Generating Your Course</h2>
          <p>Topic: {generationTopic}</p>
        </div>

        {/* Error State */}
        {error && (
          <div className="course-generation-error">
            <AlertCircle size={20} />
            <span>{error}</span>
            <div className="course-generation-error-actions">
              <button onClick={handleRetry}>Retry</button>
              <button onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        )}

        {/* Stages */}
        <div className="course-generation-stages">
          {generationStages.map((stage) => {
            const Icon = stageIcons[stage.id];
            const isActive = stage.status === 'active';
            const isComplete = stage.status === 'complete';

            return (
              <div
                key={stage.id}
                className={`course-generation-stage ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
              >
                <div className="course-generation-stage-content">
                  <div className="course-generation-stage-icon">
                    <Icon />
                  </div>
                  <div className="course-generation-stage-info">
                    <h3>{stage.title}</h3>
                    <p>{stage.description}</p>
                    {isActive && (
                      <div className="course-generation-progress">
                        <div
                          className="course-generation-progress-bar"
                          style={{ width: `${stage.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Thinking Output (optional display) */}
        {thinkingOutput && !error && (
          <div className="course-generation-thinking">
            <pre>{thinkingOutput}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseGeneration;
