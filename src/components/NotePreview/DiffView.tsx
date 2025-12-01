import React, { useState, useEffect } from 'react';
import './DiffView.css';

interface DiffViewProps {
  originalContent: string;
  proposedContent: string;
  reason?: string;
}

const DiffView: React.FC<DiffViewProps> = ({
  originalContent,
  proposedContent,
  reason,
}) => {
  const [visibleChunks, setVisibleChunks] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Reset state when content changes
    setVisibleChunks([]);
    setIsComplete(false);

    // Split proposed content into sentences (chunks)
    const sentences = proposedContent.match(/[^.!?]+[.!?]+/g) || [proposedContent];

    // Reveal chunks one at a time with delay
    sentences.forEach((sentence, idx) => {
      setTimeout(() => {
        setVisibleChunks((prev) => [...prev, sentence]);

        // Mark as complete when last chunk appears
        if (idx === sentences.length - 1) {
          setTimeout(() => {
            setIsComplete(true);
          }, 300);
        }
      }, idx * 200); // 200ms delay between chunks
    });

    // Cleanup timeout on unmount
    return () => {
      setVisibleChunks([]);
      setIsComplete(false);
    };
  }, [proposedContent]);

  return (
    <div className="diff-view-container">
      {/* Reason for edit */}
      {reason && (
        <div className="diff-reason">
          <span className="reason-label">Edit reason:</span>
          <span className="reason-text">{reason}</span>
        </div>
      )}

      {/* Original content (if exists) */}
      {originalContent && (
        <div className="diff-section original-section">
          <div className="section-label">Original</div>
          <div className="section-content">
            {originalContent}
          </div>
        </div>
      )}

      {/* Proposed content with animated chunks */}
      <div className="diff-section proposed-section">
        <div className="section-label">
          {originalContent ? 'Proposed Changes' : 'New Content'}
        </div>
        <div className="section-content">
          <div className="diff-chunks">
            {visibleChunks.map((chunk, idx) => (
              <span
                key={idx}
                className={`diff-chunk ${isComplete ? 'complete' : 'active'}`}
                style={{
                  animationDelay: `${idx * 0.05}s`,
                }}
              >
                {chunk}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffView;
