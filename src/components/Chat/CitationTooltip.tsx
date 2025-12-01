import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Citation } from '@/store/aiStore';

interface CitationTooltipProps {
  citation: Citation;
  children: React.ReactNode;
}

const CitationTooltip: React.FC<CitationTooltipProps> = ({ citation, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipHeight = tooltipRef.current.offsetHeight;
      const spaceAbove = triggerRect.top;
      const spaceBelow = window.innerHeight - triggerRect.bottom;

      // Position tooltip above or below based on available space
      if (spaceAbove < tooltipHeight + 10 && spaceBelow > tooltipHeight + 10) {
        setPosition('bottom');
      } else {
        setPosition('top');
      }
    }
  }, [isVisible]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open(citation.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <span
      ref={triggerRef}
      className="citation-trigger relative inline"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <span
        onClick={handleClick}
        className="cursor-pointer text-blue-400 hover:text-blue-300 transition-colors"
      >
        {children}
      </span>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={`citation-tooltip absolute z-50 w-72 p-3 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-150 ${
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } left-1/2 -translate-x-1/2`}
        >
          {/* Source badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
              [{citation.id}]
            </span>
            <span className="text-xs text-[#6e7681] truncate">
              {citation.source}
            </span>
            {citation.publishedDate && (
              <span className="text-xs text-[#6e7681]">
                • {citation.publishedDate}
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="text-sm font-medium text-[#e6edf3] mb-1.5 line-clamp-2">
            {citation.title}
          </h4>

          {/* Snippet */}
          <p className="text-xs text-[#8b949e] line-clamp-3 mb-2">
            {citation.snippet}
          </p>

          {/* Link */}
          <a
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />
            <span className="truncate">{new URL(citation.url).hostname}</span>
          </a>

          {/* Arrow */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-[#161b22] border-[#30363d] rotate-45 ${
              position === 'top'
                ? 'bottom-[-5px] border-r border-b'
                : 'top-[-5px] border-l border-t'
            }`}
          />
        </div>
      )}
    </span>
  );
};

export default CitationTooltip;







