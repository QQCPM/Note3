import { DiffHunk } from '@/store/aiStore';
import { formatHunkHeader } from '@/utils/diffUtils';
import { Check, X, CheckCheck, XCircle } from 'lucide-react';

interface NoteEditorWithDiffProps {
    blockId: string;
    originalContent: string;
    proposedContent: string;
    diffHunks: DiffHunk[];
    reason?: string;
    onAcceptHunk: (hunkId: string) => void;
    onRejectHunk: (hunkId: string) => void;
    onAcceptAll: () => void;
    onRejectAll: () => void;
    onClose: () => void;
}

/**
 * Diff viewer component for AI note suggestions
 * Displays line-level diffs with green/red highlighting similar to IDE
 */
export default function NoteEditorWithDiff({
    diffHunks,
    reason,
    onAcceptHunk,
    onRejectHunk,
    onAcceptAll,
    onRejectAll,
    onClose,
}: NoteEditorWithDiffProps) {
    const pendingHunks = diffHunks.filter(h => h.status === 'pending');
    const hasChanges = pendingHunks.length > 0;

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            AI Suggestions
                        </h3>
                    </div>
                    {reason && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            {reason}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <>
                            <button
                                onClick={onRejectAll}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                                <XCircle className="w-4 h-4" />
                                Reject All
                            </button>
                            <button
                                onClick={onAcceptAll}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                            >
                                <CheckCheck className="w-4 h-4" />
                                Accept All
                            </button>
                        </>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Diff Content */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-5xl mx-auto space-y-4">
                    {diffHunks.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            No changes to display
                        </div>
                    ) : (
                        diffHunks.map((hunk, index) => (
                            <DiffHunkDisplay
                                key={hunk.id}
                                hunk={hunk}
                                hunkNumber={index + 1}
                                onAccept={() => onAcceptHunk(hunk.id)}
                                onReject={() => onRejectHunk(hunk.id)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Footer Stats */}
            <div className="px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-green-500/20 border border-green-500 rounded" />
                            {diffHunks.filter(h => h.type === 'addition').length} additions
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-red-500/20 border border-red-500 rounded" />
                            {diffHunks.filter(h => h.type === 'deletion').length} deletions
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-blue-500/20 border border-blue-500 rounded" />
                            {diffHunks.filter(h => h.type === 'modification').length} modifications
                        </span>
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                        {pendingHunks.length} of {diffHunks.length} changes pending
                    </div>
                </div>
            </div>
        </div>
    );
}

interface DiffHunkDisplayProps {
    hunk: DiffHunk;
    hunkNumber: number;
    onAccept: () => void;
    onReject: () => void;
}

function DiffHunkDisplay({ hunk, onAccept, onReject }: DiffHunkDisplayProps) {
    const isPending = hunk.status === 'pending';
    const isAccepted = hunk.status === 'accepted';
    const isRejected = hunk.status === 'rejected';

    return (
        <div
            className={`
        rounded-lg border overflow-hidden
        ${isPending ? 'border-yellow-300 dark:border-yellow-700' : ''}
        ${isAccepted ? 'border-green-300 dark:border-green-700 opacity-60' : ''}
        ${isRejected ? 'border-red-300 dark:border-red-700 opacity-40' : ''}
      `}
        >
            {/* Hunk Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                        {formatHunkHeader(hunk)}
                    </span>
                    <span className={`
            text-xs font-medium px-2 py-0.5 rounded-full
            ${hunk.type === 'addition' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : ''}
            ${hunk.type === 'deletion' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : ''}
            ${hunk.type === 'modification' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : ''}
          `}>
                        {hunk.type}
                    </span>
                    {isAccepted && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            ✓ Accepted
                        </span>
                    )}
                    {isRejected && (
                        <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                            ✗ Rejected
                        </span>
                    )}
                </div>

                {isPending && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onReject}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Reject this change"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onAccept}
                            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                            title="Accept this change"
                        >
                            <Check className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Diff Lines */}
            <div className="bg-white dark:bg-gray-900 font-mono text-sm">
                {/* Context Before */}
                {hunk.contextBefore.map((line, idx) => (
                    <div
                        key={`ctx-before-${idx}`}
                        className="flex items-start px-3 py-0.5 text-gray-500 dark:text-gray-500"
                    >
                        <span className="w-12 text-right mr-3 select-none opacity-50">
                            {hunk.startLine - hunk.contextBefore.length + idx + 1}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap break-all">{line || ' '}</span>
                    </div>
                ))}

                {/* Deleted Lines */}
                {hunk.oldLines.map((line, idx) => (
                    <div
                        key={`old-${idx}`}
                        className="flex items-start px-3 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300"
                    >
                        <span className="w-12 text-right mr-3 select-none opacity-50">
                            {hunk.startLine + idx + 1}
                        </span>
                        <span className="mr-2 text-red-600 dark:text-red-400 font-bold">-</span>
                        <span className="flex-1 whitespace-pre-wrap break-all">{line || ' '}</span>
                    </div>
                ))}

                {/* Added Lines */}
                {hunk.newLines.map((line, idx) => (
                    <div
                        key={`new-${idx}`}
                        className="flex items-start px-3 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300"
                    >
                        <span className="w-12 text-right mr-3 select-none opacity-50">
                            {hunk.startLine + idx + 1}
                        </span>
                        <span className="mr-2 text-green-600 dark:text-green-400 font-bold">+</span>
                        <span className="flex-1 whitespace-pre-wrap break-all">{line || ' '}</span>
                    </div>
                ))}

                {/* Context After */}
                {hunk.contextAfter.map((line, idx) => (
                    <div
                        key={`ctx-after-${idx}`}
                        className="flex items-start px-3 py-0.5 text-gray-700 dark:text-gray-400"
                    >
                        <span className="w-12 text-right mr-3 select-none opacity-50">
                            {hunk.startLine + hunk.oldLines.length + idx + 1}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap break-all">{line || ' '}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
