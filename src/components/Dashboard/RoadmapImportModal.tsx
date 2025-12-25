import React, { useState } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { X, Upload, Loader2, FileText } from 'lucide-react';

interface RoadmapImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
}

const RoadmapImportModal: React.FC<RoadmapImportModalProps> = ({
    isOpen,
    onClose,
    projectId,
}) => {
    const [roadmapContent, setRoadmapContent] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { importRoadmapAsync, generateTodayPlanAsync } = useDashboardStore();

    if (!isOpen) return null;

    const handleImport = async () => {
        if (!roadmapContent.trim()) {
            setError('Please paste your curriculum or roadmap content');
            return;
        }

        setIsImporting(true);
        setError(null);

        try {
            // Process roadmap
            await importRoadmapAsync(roadmapContent, projectId);

            // Generate today's plan
            await generateTodayPlanAsync(projectId);

            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import roadmap');
        } finally {
            setIsImporting(false);
        }
    };

    const sampleContent = `Example curriculum:

Week 1-2: Neural Network Fundamentals
- Day 1-2: Perceptrons and activation functions
- Day 3-4: Forward propagation
- Day 5-7: Backpropagation

Week 3-4: Convolutional Networks
- Day 8-10: CNN architecture
- Day 11-14: Building image classifiers

Week 5-8: Advanced Topics
- Transformers and attention
- Large language models
- Practical projects`;

    return (
        <div className="roadmap-modal-overlay" onClick={onClose}>
            <div className="roadmap-modal" onClick={(e) => e.stopPropagation()}>
                <div className="roadmap-modal-header">
                    <div className="roadmap-modal-title">
                        <FileText className="w-5 h-5" />
                        <h2>Import Learning Roadmap</h2>
                    </div>
                    <button className="roadmap-modal-close" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="roadmap-modal-body">
                    <p className="roadmap-modal-description">
                        Paste your course syllabus, book table of contents, or learning roadmap.
                        The AI will break it down into a daily schedule.
                    </p>

                    <textarea
                        className="roadmap-textarea"
                        placeholder={sampleContent}
                        value={roadmapContent}
                        onChange={(e) => setRoadmapContent(e.target.value)}
                        rows={12}
                        disabled={isImporting}
                    />

                    {error && (
                        <div className="roadmap-error">
                            {error}
                        </div>
                    )}
                </div>

                <div className="roadmap-modal-footer">
                    <button
                        className="roadmap-cancel-btn"
                        onClick={onClose}
                        disabled={isImporting}
                    >
                        Cancel
                    </button>
                    <button
                        className="roadmap-import-btn"
                        onClick={handleImport}
                        disabled={isImporting || !roadmapContent.trim()}
                    >
                        {isImporting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4" />
                                Import & Generate Plan
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RoadmapImportModal;
