/**
 * ResearchPanel
 * 
 * Displays real-time progress of Gemini Deep Research.
 * Shows: progress bar, thinking stream, sources discovered, and research notes.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    Search,
    Brain,
    FileText,
    CheckCircle,
    Circle,
    Loader2,
    AlertCircle,
    ExternalLink,
    SkipForward,
    X,
} from 'lucide-react';
import type { ResearchProgress, ResearchSource } from '@/services/deepResearchService';
import { startDeepResearch, isDeepResearchAvailable } from '@/services/deepResearchService';
import './ResearchPanel.css';

// ============================================================================
// TYPES
// ============================================================================

interface ResearchPanelProps {
    topic: string;
    focusAreas?: string[];
    onComplete: (report: string) => void;
    onCancel: () => void;
    onSkip: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ResearchPanel: React.FC<ResearchPanelProps> = ({
    topic,
    focusAreas = [],
    onComplete,
    onCancel,
    onSkip,
}) => {
    const [progress, setProgress] = useState<ResearchProgress>({
        status: 'starting',
        progress: 0,
        thinking: 'Initializing research...',
        sources: [],
        notes: {},
        report: null,
        error: null,
        interactionId: null,
    });

    // Start research on mount
    useEffect(() => {
        if (!isDeepResearchAvailable()) {
            setProgress(prev => ({
                ...prev,
                status: 'failed',
                error: 'Deep Research service not initialized. Check API key.',
            }));
            return;
        }

        let cancelled = false;

        const runResearch = async () => {
            try {
                const report = await startDeepResearch(
                    { topic, focusAreas },
                    (update) => {
                        if (!cancelled) {
                            setProgress(update);
                        }
                    }
                );

                if (!cancelled) {
                    onComplete(report);
                }
            } catch (error) {
                if (!cancelled) {
                    setProgress(prev => ({
                        ...prev,
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Research failed',
                    }));
                }
            } finally {
                // Cleanup on completion
            }
        };

        runResearch();

        return () => {
            cancelled = true;
        };
    }, [topic, focusAreas, onComplete]);

    // Handle cancel
    const handleCancel = useCallback(() => {
        onCancel();
    }, [onCancel]);

    // Handle skip (use partial results)
    const handleSkip = useCallback(() => {
        if (progress.report) {
            onComplete(progress.report);
        } else {
            onSkip();
        }
    }, [onSkip, onComplete, progress.report]);

    // Status icon
    const StatusIcon = () => {
        switch (progress.status) {
            case 'starting':
            case 'researching':
            case 'writing':
                return <Loader2 className="research-panel-status-icon spinning" size={20} />;
            case 'complete':
                return <CheckCircle className="research-panel-status-icon complete" size={20} />;
            case 'failed':
                return <AlertCircle className="research-panel-status-icon failed" size={20} />;
            default:
                return <Search size={20} />;
        }
    };

    // Status text
    const getStatusText = (): string => {
        switch (progress.status) {
            case 'starting':
                return 'Initializing research...';
            case 'researching':
                return `Researching topic (${progress.sources.length} sources found)`;
            case 'writing':
                return 'Writing research report...';
            case 'complete':
                return 'Research complete!';
            case 'failed':
                return 'Research failed';
            default:
                return 'Unknown status';
        }
    };

    return (
        <div className="research-panel">
            {/* Header */}
            <div className="research-panel-header">
                <div className="research-panel-title">
                    <Search size={18} />
                    <span>Deep Research</span>
                </div>
                <div className="research-panel-topic">"{topic}"</div>
            </div>

            {/* Progress Bar */}
            <div className="research-panel-progress">
                <div
                    className="research-panel-progress-bar"
                    style={{ width: `${progress.progress}%` }}
                />
                <div className="research-panel-progress-text">
                    <StatusIcon />
                    <span>{getStatusText()}</span>
                    <span className="research-panel-progress-percent">{progress.progress}%</span>
                </div>
            </div>

            {/* Error State */}
            {progress.status === 'failed' && progress.error && (
                <div className="research-panel-error">
                    <AlertCircle size={16} />
                    <span>{progress.error}</span>
                </div>
            )}

            {/* Thinking Panel */}
            {progress.thinking && progress.status !== 'failed' && (
                <div className="research-panel-section">
                    <div className="research-panel-section-header">
                        <Brain size={14} />
                        <span>Thinking</span>
                    </div>
                    <div className="research-panel-thinking">
                        {progress.thinking}
                    </div>
                </div>
            )}

            {/* Sources List */}
            {progress.sources.length > 0 && (
                <div className="research-panel-section">
                    <div className="research-panel-section-header">
                        <FileText size={14} />
                        <span>Sources Discovered ({progress.sources.length})</span>
                    </div>
                    <div className="research-panel-sources">
                        {progress.sources.slice(0, 10).map((source, i) => (
                            <SourceItem key={i} source={source} />
                        ))}
                        {progress.sources.length > 10 && (
                            <div className="research-panel-sources-more">
                                +{progress.sources.length - 10} more sources...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="research-panel-actions">
                <button
                    className="research-panel-btn cancel"
                    onClick={handleCancel}
                    disabled={progress.status === 'complete'}
                >
                    <X size={14} />
                    Cancel
                </button>
                <button
                    className="research-panel-btn skip"
                    onClick={handleSkip}
                    disabled={progress.status === 'complete' || progress.status === 'starting'}
                >
                    <SkipForward size={14} />
                    Skip to Outline
                </button>
            </div>
        </div>
    );
};

// ============================================================================
// SOURCE ITEM SUB-COMPONENT
// ============================================================================

interface SourceItemProps {
    source: ResearchSource;
}

const SourceItem: React.FC<SourceItemProps> = ({ source }) => {
    const StatusIcon = () => {
        switch (source.status) {
            case 'done':
                return <CheckCircle className="source-status done" size={12} />;
            case 'reading':
                return <Loader2 className="source-status reading spinning" size={12} />;
            case 'queued':
                return <Circle className="source-status queued" size={12} />;
            case 'failed':
                return <AlertCircle className="source-status failed" size={12} />;
            default:
                return <Circle size={12} />;
        }
    };

    return (
        <div className="research-panel-source-item">
            <StatusIcon />
            <span className="source-title">{source.title}</span>
            <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="source-link"
            >
                <ExternalLink size={10} />
            </a>
        </div>
    );
};

export default ResearchPanel;
