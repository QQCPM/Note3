import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, BookOpen } from 'lucide-react';
import type { Citation } from '@/store/aiStore';

interface SourcesPanelProps {
  citations: Citation[];
  defaultExpanded?: boolean;
}

const SourcesPanel: React.FC<SourcesPanelProps> = ({ 
  citations, 
  defaultExpanded = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!citations || citations.length === 0) return null;

  return (
    <div className="sources-panel mt-4 border-t border-[#30363d]/50 pt-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="sources-header w-full flex items-center gap-2 text-left group"
      >
        <span className="text-[#8b949e] group-hover:text-[#c9d1d9] transition-colors">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
        <BookOpen className="w-4 h-4 text-[#8b949e]" />
        <span className="text-sm font-medium text-[#8b949e] group-hover:text-[#c9d1d9] transition-colors">
          Sources
        </span>
        <span className="text-xs text-[#6e7681] bg-[#21262d] px-2 py-0.5 rounded">
          {citations.length}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="sources-list mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {citations.map((citation) => (
            <a
              key={citation.id}
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="source-item flex items-start gap-3 p-3 bg-[#161b22]/60 hover:bg-[#1c2128] border border-[#30363d]/30 hover:border-[#30363d]/60 rounded-lg transition-all duration-200 group"
            >
              {/* Citation number */}
              <span className="shrink-0 w-6 h-6 flex items-center justify-center text-xs font-semibold text-blue-400 bg-blue-500/10 rounded">
                {citation.id}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Title */}
                <h4 className="text-sm font-medium text-[#e6edf3] group-hover:text-blue-400 transition-colors line-clamp-1">
                  {citation.title}
                </h4>

                {/* Snippet */}
                <p className="text-xs text-[#8b949e] mt-1 line-clamp-2">
                  {citation.snippet}
                </p>

                {/* URL and date */}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-[#6e7681] truncate">
                    {citation.source || new URL(citation.url).hostname}
                  </span>
                  {citation.publishedDate && (
                    <>
                      <span className="text-[#6e7681]">•</span>
                      <span className="text-xs text-[#6e7681]">
                        {citation.publishedDate}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* External link icon */}
              <ExternalLink className="w-4 h-4 text-[#6e7681] group-hover:text-blue-400 shrink-0 transition-colors" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default SourcesPanel;







