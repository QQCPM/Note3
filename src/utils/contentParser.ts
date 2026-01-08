/**
 * Content Parser for Course Lessons
 * 
 * Parses markdown content into structured chunks that can be saved as
 * appropriate block types in the Notes system.
 */

import type { BlockData, DatabaseColumn, DatabaseRowData } from '@/types/block';

// Chunk types that the parser can identify
export type ContentChunkType = 'heading1' | 'heading2' | 'text' | 'table' | 'code';

export interface ContentChunk {
    type: ContentChunkType;
    content: string;
    // For tables, parsed structure
    tableData?: {
        columns: DatabaseColumn[];
        rows: DatabaseRowData[];
    };
}

/**
 * Parse markdown content into structured chunks
 */
export function parseMarkdownContent(markdown: string): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    const lines = markdown.split('\n');

    let currentTextBuffer: string[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let inTable = false;
    let tableLines: string[] = [];

    const flushTextBuffer = () => {
        if (currentTextBuffer.length > 0) {
            const text = currentTextBuffer.join('\n').trim();
            if (text) {
                chunks.push({ type: 'text', content: text });
            }
            currentTextBuffer = [];
        }
    };

    const flushTable = () => {
        if (tableLines.length > 0) {
            const tableData = parseMarkdownTable(tableLines);
            if (tableData) {
                chunks.push({
                    type: 'table',
                    content: tableLines.join('\n'),
                    tableData
                });
            }
            tableLines = [];
            inTable = false;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Handle code blocks
        if (trimmedLine.startsWith('```')) {
            if (inCodeBlock) {
                // End of code block
                codeBlockContent.push(line);
                flushTextBuffer();
                chunks.push({ type: 'code', content: codeBlockContent.join('\n') });
                codeBlockContent = [];
                inCodeBlock = false;
            } else {
                // Start of code block
                flushTextBuffer();
                flushTable();
                inCodeBlock = true;
                codeBlockContent = [line];
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockContent.push(line);
            continue;
        }

        // Detect table rows (lines starting with |)
        if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
            if (!inTable) {
                flushTextBuffer();
                inTable = true;
            }
            tableLines.push(line);
            continue;
        } else if (inTable) {
            // End of table
            flushTable();
        }

        // Handle headings
        if (trimmedLine.startsWith('# ') && !trimmedLine.startsWith('## ')) {
            flushTextBuffer();
            chunks.push({ type: 'heading1', content: trimmedLine.slice(2).trim() });
            continue;
        }

        if (trimmedLine.startsWith('## ')) {
            flushTextBuffer();
            chunks.push({ type: 'heading2', content: trimmedLine.slice(3).trim() });
            continue;
        }

        // Handle ### and lower as regular text with the # preserved
        // Or add to text buffer
        currentTextBuffer.push(line);
    }

    // Flush remaining content
    flushTextBuffer();
    flushTable();

    return chunks;
}

/**
 * Parse a markdown table into DatabaseColumn[] and DatabaseRowData[]
 */
function parseMarkdownTable(lines: string[]): { columns: DatabaseColumn[]; rows: DatabaseRowData[] } | null {
    if (lines.length < 2) return null;

    // Parse header row
    const headerLine = lines[0];
    const headers = headerLine
        .split('|')
        .map(h => h.trim())
        .filter(h => h.length > 0);

    if (headers.length === 0) return null;

    // Check for separator row (|---|---|)
    const separatorLine = lines[1];
    if (!separatorLine.includes('-')) return null;

    // Create columns
    const columns: DatabaseColumn[] = headers.map((name, index) => ({
        id: `col-${index}`,
        name,
        type: 'text' as const,
        width: Math.floor(100 / headers.length)
    }));

    // Parse data rows
    const rows: DatabaseRowData[] = [];
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i];

        // Clean up cells (remove first and last if they're empty from leading/trailing |)
        const cleanCells = line.split('|').slice(1, -1).map(c => c.trim());

        if (cleanCells.length > 0) {
            const data: Record<string, any> = {};
            cleanCells.forEach((cell, idx) => {
                if (columns[idx]) {
                    data[columns[idx].id] = cell;
                }
            });

            rows.push({
                id: `row-${i - 2}`,
                data
            });
        }
    }

    return { columns, rows };
}

/**
 * Convert a ContentChunk to a BlockData object
 */
export function chunkToBlockData(chunk: ContentChunk): BlockData {
    switch (chunk.type) {
        case 'heading1':
            return {
                type: 'heading1',
                content: chunk.content
            };

        case 'heading2':
            return {
                type: 'heading2',
                content: chunk.content
            };

        case 'table':
            if (chunk.tableData) {
                return {
                    type: 'database',
                    title: 'Table',
                    columns: chunk.tableData.columns,
                    rows: chunk.tableData.rows,
                    view: 'table'
                };
            }
            // Fallback to text if table parsing failed
            return {
                type: 'text',
                content: chunk.content
            };

        case 'code':
        case 'text':
        default:
            return {
                type: 'text',
                content: chunk.content
            };
    }
}

/**
 * Get the block type string for creating a block
 */
export function chunkToBlockType(chunk: ContentChunk): 'text' | 'heading1' | 'heading2' | 'database' {
    switch (chunk.type) {
        case 'heading1': return 'heading1';
        case 'heading2': return 'heading2';
        case 'table': return 'database';
        default: return 'text';
    }
}
