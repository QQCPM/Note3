import React, { useState, useRef, useEffect } from 'react';
import { BookMarked } from 'lucide-react';
import type { RootNode } from '@/types/rootNode';
import { navigateToRootNode } from '@/utils/rootNodeNavigation';
import { useRootNodeStore } from '@/store/rootNodeStore';

interface RootNodeMentionProps {
  term: string;
  projectId?: string | null;
}

const RootNodeMention: React.FC<RootNodeMentionProps> = ({ term, projectId }) => {
  const [rootNode, setRootNode] = useState<RootNode | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const mentionRef = useRef<HTMLSpanElement>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const { getRootNodeByTerm } = useRootNodeStore();

  // Fetch root node data on mount
  useEffect(() => {
    const fetchRootNode = async () => {
      const node = await getRootNodeByTerm(term, projectId);
      setRootNode(node);
    };
    fetchRootNode();
  }, [term, projectId, getRootNodeByTerm]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (rootNode) {
      await navigateToRootNode(rootNode);
    }
  };

  const handleMouseEnter = () => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }
    
    tooltipTimeout.current = setTimeout(() => {
      if (mentionRef.current) {
        const rect = mentionRef.current.getBoundingClientRect();
        setTooltipPosition({
          x: rect.left,
          y: rect.bottom + 8,
        });
        setShowTooltip(true);
      }
    }, 500); // Delay before showing tooltip
  };

  const handleMouseLeave = () => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }
    setShowTooltip(false);
  };

  // If root node not found, render as plain text
  if (!rootNode) {
    return <span className="text-gray-400">@{term}</span>;
  }

  return (
    <>
      <span
        ref={mentionRef}
        className="root-node-mention"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick(e as any);
          }
        }}
      >
        <BookMarked className="root-node-mention-icon" size={12} />
        <span>{term}</span>
      </span>

      {/* Tooltip with definition preview */}
      {showTooltip && rootNode && (
        <div
          className="root-node-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPosition.x,
            top: tooltipPosition.y,
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div className="root-node-tooltip-term">{rootNode.term}</div>
          <div className="root-node-tooltip-text">
            {rootNode.highlighted_text.length > 150
              ? rootNode.highlighted_text.substring(0, 150) + '...'
              : rootNode.highlighted_text}
          </div>
          <div className="root-node-tooltip-source">
            Click to jump to definition
          </div>
        </div>
      )}
    </>
  );
};

export default RootNodeMention;
