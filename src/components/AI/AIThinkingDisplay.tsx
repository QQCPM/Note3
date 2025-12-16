import { CheckCircle2, Loader2, FileText, Plus, Minus } from 'lucide-react';

interface AIThinkingDisplayProps {
    message?: string;
    isLoading?: boolean;
    summary?: {
        action: string;
        linesAdded?: number;
        linesDeleted?: number;
        linesModified?: number;
        reason?: string;
    };
}

/**
 * Modern IDE-style AI thinking display
 * Shows what AI is doing with line counts and summaries
 */
export default function AIThinkingDisplay({
    message,
    isLoading = false,
    summary
}: AIThinkingDisplayProps) {
    if (!message && !isLoading && !summary) return null;

    return (
        <div className="px-4 mb-3">
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-[#0d1117] border-b border-[#30363d]">
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                            <span className="text-xs font-semibold text-blue-400">AI Processing...</span>
                        </>
                    ) : summary ? (
                        <>
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                            <span className="text-xs font-semibold text-green-400">Action Complete</span>
                        </>
                    ) : (
                        <>
                            <FileText className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-semibold text-purple-400">AI Thinking</span>
                        </>
                    )}
                </div>

                {/* Content */}
                <div className="px-3 py-2 space-y-2">
                    {/* Loading message */}
                    {isLoading && message && (
                        <div className="text-sm text-gray-400 animate-pulse">
                            {message}
                        </div>
                    )}

                    {/* Summary */}
                    {summary && (
                        <div className="space-y-2">
                            {/* Action description */}
                            <div className="flex items-start gap-2">
                                <span className="text-xs font-mono text-gray-500 mt-0.5">→</span>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-200">{summary.action}</div>
                                    {summary.reason && (
                                        <div className="text-xs text-gray-500 mt-1">{summary.reason}</div>
                                    )}
                                </div>
                            </div>

                            {/* Line stats */}
                            {(summary.linesAdded !== undefined || summary.linesDeleted !== undefined || summary.linesModified !== undefined) && (
                                <div className="flex items-center gap-3 pt-2 border-t border-[#30363d]">
                                    {summary.linesAdded !== undefined && summary.linesAdded > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <Plus className="w-3 h-3 text-green-400" />
                                            <span className="text-xs font-mono text-green-400">
                                                {summary.linesAdded} {summary.linesAdded === 1 ? 'line' : 'lines'}
                                            </span>
                                        </div>
                                    )}
                                    {summary.linesDeleted !== undefined && summary.linesDeleted > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <Minus className="w-3 h-3 text-red-400" />
                                            <span className="text-xs font-mono text-red-400">
                                                {summary.linesDeleted} {summary.linesDeleted === 1 ? 'line' : 'lines'}
                                            </span>
                                        </div>
                                    )}
                                    {summary.linesModified !== undefined && summary.linesModified > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <FileText className="w-3 h-3 text-blue-400" />
                                            <span className="text-xs font-mono text-blue-400">
                                                {summary.linesModified} {summary.linesModified === 1 ? 'line' : 'lines'} modified
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Regular message (not loading, not summary) */}
                    {!isLoading && !summary && message && (
                        <div className="text-sm text-gray-300">{message}</div>
                    )}
                </div>
            </div>
        </div>
    );
}
