import React, { useEffect } from 'react';
import { diffLines, Change } from 'diff';
import { Check, X, Info } from 'lucide-react';
import type { PendingEdit } from '@/store/aiStore';

interface DiffPreviewProps {
  edit: PendingEdit;
  onAccept: () => void;
  onReject: () => void;
  autoFocus?: boolean;
}

/**
 * DiffPreview Component
 *
 * IDE-style diff viewer showing proposed changes with accept/reject controls.
 * Inspired by Cursor IDE and GitHub Copilot.
 */
const DiffPreview: React.FC<DiffPreviewProps> = ({ edit, onAccept, onReject, autoFocus = true }) => {
  // Calculate diff
  const diff = diffLines(edit.originalContent, edit.proposedContent);

  // Keyboard shortcuts
  useEffect(() => {
    if (!autoFocus) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab = Accept
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onAccept();
      }
      // Alt+Delete = Reject
      if (e.key === 'Delete' && e.altKey) {
        e.preventDefault();
        onReject();
      }
      // Escape = Reject
      if (e.key === 'Escape') {
        e.preventDefault();
        onReject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onAccept, onReject, autoFocus]);

  // Count changes
  const stats = diff.reduce(
    (acc, change) => {
      if (change.added) acc.additions += change.count || 0;
      if (change.removed) acc.deletions += change.count || 0;
      return acc;
    },
    { additions: 0, deletions: 0 }
  );

  return (
    <div className="diff-preview bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden shadow-xl">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Info size={16} className="text-blue-400" />
              <span className="text-sm font-semibold text-gray-200">Proposed Changes</span>
            </div>
            <p className="text-xs text-gray-400">{edit.reason}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="text-green-400">+{stats.additions}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-red-400">-{stats.deletions}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Diff Content */}
      <div className="max-h-96 overflow-y-auto">
        <div className="diff-content font-mono text-sm">
          {diff.map((part: Change, index: number) => {
            const lines = part.value.split('\n').filter((line, idx, arr) => {
              // Keep all lines except the last empty one
              return idx < arr.length - 1 || line !== '';
            });

            return (
              <React.Fragment key={index}>
                {lines.map((line, lineIndex) => (
                  <div
                    key={`${index}-${lineIndex}`}
                    className={`diff-line flex ${
                      part.added
                        ? 'bg-green-500/10 text-green-300'
                        : part.removed
                        ? 'bg-red-500/10 text-red-300'
                        : 'text-gray-400'
                    }`}
                  >
                    <span className="diff-marker w-8 flex-shrink-0 text-center select-none opacity-60">
                      {part.added ? '+' : part.removed ? '-' : ' '}
                    </span>
                    <span className="diff-text flex-1 px-2 py-1 whitespace-pre-wrap break-words">
                      {line || '\u00A0'}
                    </span>
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Footer - Action Buttons */}
      <div className="bg-[#161b22] border-t border-[#30363d] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            <kbd className="px-1.5 py-0.5 bg-[#0d1117] border border-[#30363d] rounded text-gray-400">
              Tab
            </kbd>{' '}
            to accept •{' '}
            <kbd className="px-1.5 py-0.5 bg-[#0d1117] border border-[#30363d] rounded text-gray-400">
              Alt+Del
            </kbd>{' '}
            to reject
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onReject}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-900/20 hover:bg-red-900/30 text-red-300 border border-red-800/30 rounded transition-colors"
            >
              <X size={14} />
              Reject
            </button>
            <button
              onClick={onAccept}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors font-medium"
            >
              <Check size={14} />
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffPreview;
