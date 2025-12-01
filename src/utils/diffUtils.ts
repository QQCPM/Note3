import { diffLines } from 'diff';

/**
 * Diff Utilities for AI Note IDE
 * Provides functions to compute, parse, and apply diff hunks for note editing
 */

export interface DiffHunk {
    id: string;
    type: 'addition' | 'deletion' | 'modification';
    startLine: number;
    endLine: number;
    oldLines: string[];
    newLines: string[];
    contextBefore: string[];
    contextAfter: string[];
    status: 'pending' | 'accepted' | 'rejected';
}

export interface ParsedDiff {
    hunks: DiffHunk[];
    originalLines: string[];
    proposedLines: string[];
}

/**
 * Compute diff hunks between original and proposed content
 * Groups consecutive changes into hunks with context lines
 */
export function computeDiffHunks(
    originalContent: string,
    proposedContent: string,
    contextLines: number = 3
): DiffHunk[] {
    const changes = diffLines(originalContent, proposedContent);
    const hunks: DiffHunk[] = [];

    let currentHunk: Partial<DiffHunk> | null = null;
    let lineNumber = 0;
    let originalLineNumber = 0;
    let proposedLineNumber = 0;

    const finalizeHunk = () => {
        if (currentHunk && (currentHunk.oldLines!.length > 0 || currentHunk.newLines!.length > 0)) {
            hunks.push({
                id: `hunk-${hunks.length}`,
                type: determineHunkType(currentHunk.oldLines!, currentHunk.newLines!),
                startLine: currentHunk.startLine!,
                endLine: lineNumber - 1,
                oldLines: currentHunk.oldLines!,
                newLines: currentHunk.newLines!,
                contextBefore: currentHunk.contextBefore!,
                contextAfter: currentHunk.contextAfter!,
                status: 'pending',
            });
        }
        currentHunk = null;
    };

    for (let i = 0; i < changes.length; i++) {
        const change = changes[i];
        const lines = change.value.split('\n').filter((line, idx, arr) => {
            // Remove trailing empty line from split
            return idx < arr.length - 1 || line.length > 0;
        });

        if (change.added || change.removed) {
            // Start new hunk if needed
            if (!currentHunk) {
                // Collect context before (look back at previous unchanged changes)
                const contextBefore: string[] = [];
                for (let j = i - 1; j >= 0 && contextBefore.length < contextLines; j--) {
                    const prevChange = changes[j];
                    if (!prevChange.added && !prevChange.removed) {
                        const prevLines = prevChange.value.split('\n').filter((l, idx, arr) => idx < arr.length - 1 || l.length > 0);
                        contextBefore.unshift(...prevLines.slice(-contextLines + contextBefore.length));
                    } else {
                        break;
                    }
                }

                currentHunk = {
                    startLine: originalLineNumber,
                    oldLines: [],
                    newLines: [],
                    contextBefore,
                    contextAfter: [],
                };
            }

            // Add to current hunk
            if (change.removed) {
                currentHunk.oldLines!.push(...lines);
            } else if (change.added) {
                currentHunk.newLines!.push(...lines);
            }
        } else {
            // Unchanged line
            if (currentHunk) {
                // Check if this is context after or if we should finalize
                currentHunk.contextAfter!.push(...lines.slice(0, contextLines));
                if (currentHunk.contextAfter!.length >= contextLines) {
                    finalizeHunk();
                }
            }

            originalLineNumber += lines.length;
            proposedLineNumber += lines.length;
        }

        if (!change.added) originalLineNumber += lines.length;
        if (!change.removed) proposedLineNumber += lines.length;
        lineNumber++;
    }

    // Finalize any remaining hunk
    finalizeHunk();

    return hunks;
}

/**
 * Determine hunk type based on old/new lines
 */
function determineHunkType(oldLines: string[], newLines: string[]): 'addition' | 'deletion' | 'modification' {
    if (oldLines.length === 0) return 'addition';
    if (newLines.length === 0) return 'deletion';
    return 'modification';
}

/**
 * Apply accepted hunks to original content
 * Only hunks with status 'accepted' are applied
 */
export function applyAcceptedHunks(
    originalContent: string,
    hunks: DiffHunk[]
): string {
    const acceptedHunks = hunks.filter(h => h.status === 'accepted');
    if (acceptedHunks.length === 0) return originalContent;

    const originalLines = originalContent.split('\n');
    let result = [...originalLines];

    // Sort hunks by start line in reverse order to maintain line indices
    const sortedHunks = [...acceptedHunks].sort((a, b) => b.startLine - a.startLine);

    for (const hunk of sortedHunks) {
        const deleteCount = hunk.oldLines.length;
        result.splice(hunk.startLine, deleteCount, ...hunk.newLines);
    }

    return result.join('\n');
}

/**
 * Format hunk for display (like git diff)
 */
export function formatHunkHeader(hunk: DiffHunk): string {
    const oldStart = hunk.startLine + 1;
    const oldCount = hunk.oldLines.length;
    const newStart = hunk.startLine + 1;
    const newCount = hunk.newLines.length;

    return `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
}

/**
 * Merge all accepted hunks and return final content
 */
export function mergeDiffHunks(
    originalContent: string,
    proposedContent: string,
    hunks: DiffHunk[]
): string {
    const allAccepted = hunks.every(h => h.status === 'accepted');
    const allRejected = hunks.every(h => h.status === 'rejected');

    if (allAccepted) return proposedContent;
    if (allRejected) return originalContent;

    return applyAcceptedHunks(originalContent, hunks);
}

/**
 * Parse unified diff format (for backend compatibility)
 */
export function parseUnifiedDiff(unifiedDiff: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const lines = unifiedDiff.split('\n');

    let currentHunk: Partial<DiffHunk> | null = null;
    let hunkIndex = 0;

    for (const line of lines) {
        // Hunk header: @@ -1,3 +1,4 @@
        if (line.startsWith('@@')) {
            if (currentHunk) {
                hunks.push({
                    id: `hunk-${hunkIndex++}`,
                    type: determineHunkType(currentHunk.oldLines!, currentHunk.newLines!),
                    startLine: currentHunk.startLine!,
                    endLine: currentHunk.endLine!,
                    oldLines: currentHunk.oldLines!,
                    newLines: currentHunk.newLines!,
                    contextBefore: currentHunk.contextBefore || [],
                    contextAfter: currentHunk.contextAfter || [],
                    status: 'pending',
                });
            }

            const match = line.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
            if (match) {
                currentHunk = {
                    startLine: parseInt(match[1]) - 1,
                    endLine: 0,
                    oldLines: [],
                    newLines: [],
                    contextBefore: [],
                    contextAfter: [],
                };
            }
        } else if (currentHunk) {
            if (line.startsWith('-')) {
                currentHunk.oldLines!.push(line.substring(1));
            } else if (line.startsWith('+')) {
                currentHunk.newLines!.push(line.substring(1));
            } else if (line.startsWith(' ')) {
                // Context line
                if (currentHunk.oldLines!.length === 0 && currentHunk.newLines!.length === 0) {
                    currentHunk.contextBefore!.push(line.substring(1));
                } else {
                    currentHunk.contextAfter!.push(line.substring(1));
                }
            }
        }
    }

    // Add last hunk
    if (currentHunk) {
        hunks.push({
            id: `hunk-${hunkIndex}`,
            type: determineHunkType(currentHunk.oldLines!, currentHunk.newLines!),
            startLine: currentHunk.startLine!,
            endLine: currentHunk.startLine! + (currentHunk.oldLines?.length || 0),
            oldLines: currentHunk.oldLines!,
            newLines: currentHunk.newLines!,
            contextBefore: currentHunk.contextBefore || [],
            contextAfter: currentHunk.contextAfter || [],
            status: 'pending',
        });
    }

    return hunks;
}

/**
 * Get statistics about diff hunks
 */
export function getDiffStats(hunks: DiffHunk[]): {
    additions: number;
    deletions: number;
    modifications: number;
    total: number;
} {
    return hunks.reduce(
        (stats, hunk) => {
            if (hunk.type === 'addition') stats.additions++;
            else if (hunk.type === 'deletion') stats.deletions++;
            else if (hunk.type === 'modification') stats.modifications++;
            stats.total++;
            return stats;
        },
        { additions: 0, deletions: 0, modifications: 0, total: 0 }
    );
}
