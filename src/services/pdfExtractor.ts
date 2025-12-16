/**
 * PDF Text Extraction Service
 * 
 * Extracts text content from PDF files for AI processing.
 * Uses pdf.js to parse PDF documents and extract structured text.
 */

import { pdfjs } from 'react-pdf';

// Ensure worker is set up
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ============================================================================
// TYPES
// ============================================================================

export interface PDFPage {
  pageNumber: number;
  text: string;
  wordCount: number;
}

export interface PDFExtractResult {
  fileName: string;
  totalPages: number;
  pages: PDFPage[];
  fullText: string;
  wordCount: number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
  };
}

export interface PDFChunk {
  index: number;
  pageStart: number;
  pageEnd: number;
  text: string;
  wordCount: number;
}

// ============================================================================
// PDF EXTRACTION
// ============================================================================

/**
 * Extract all text from a PDF file
 */
export async function extractPDFText(file: File): Promise<PDFExtractResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  const pages: PDFPage[] = [];
  let fullText = '';
  let totalWordCount = 0;

  // Extract text from each page
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Combine text items into a single string
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const wordCount = pageText.split(/\s+/).filter(w => w.length > 0).length;
    
    pages.push({
      pageNumber: i,
      text: pageText,
      wordCount,
    });
    
    fullText += pageText + '\n\n';
    totalWordCount += wordCount;
  }

  // Try to extract metadata
  let metadata: PDFExtractResult['metadata'] = {};
  try {
    const pdfMetadata = await pdf.getMetadata();
    if (pdfMetadata?.info) {
      const info = pdfMetadata.info as any;
      metadata = {
        title: info.Title,
        author: info.Author,
        subject: info.Subject,
        keywords: info.Keywords,
      };
    }
  } catch (e) {
    console.warn('Could not extract PDF metadata:', e);
  }

  return {
    fileName: file.name,
    totalPages: pdf.numPages,
    pages,
    fullText: fullText.trim(),
    wordCount: totalWordCount,
    metadata,
  };
}

/**
 * Split extracted PDF text into chunks for AI processing
 * Each chunk is roughly maxWordsPerChunk words
 */
export function chunkPDFText(
  result: PDFExtractResult, 
  maxWordsPerChunk: number = 2000
): PDFChunk[] {
  const chunks: PDFChunk[] = [];
  let currentChunk: PDFPage[] = [];
  let currentWordCount = 0;
  let chunkIndex = 0;

  for (const page of result.pages) {
    // If adding this page would exceed the limit, finalize current chunk
    if (currentWordCount + page.wordCount > maxWordsPerChunk && currentChunk.length > 0) {
      chunks.push({
        index: chunkIndex++,
        pageStart: currentChunk[0].pageNumber,
        pageEnd: currentChunk[currentChunk.length - 1].pageNumber,
        text: currentChunk.map(p => p.text).join('\n\n'),
        wordCount: currentWordCount,
      });
      currentChunk = [];
      currentWordCount = 0;
    }

    currentChunk.push(page);
    currentWordCount += page.wordCount;
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push({
      index: chunkIndex,
      pageStart: currentChunk[0].pageNumber,
      pageEnd: currentChunk[currentChunk.length - 1].pageNumber,
      text: currentChunk.map(p => p.text).join('\n\n'),
      wordCount: currentWordCount,
    });
  }

  return chunks;
}

/**
 * Extract a summary of the PDF structure (first few pages + headings)
 * This is useful for AI to understand the document before processing
 */
export function extractPDFSummary(result: PDFExtractResult, maxPages: number = 5): string {
  const summaryPages = result.pages.slice(0, maxPages);
  
  let summary = `# PDF: ${result.fileName}\n`;
  summary += `Total Pages: ${result.totalPages}\n`;
  summary += `Total Words: ~${result.wordCount.toLocaleString()}\n`;
  
  if (result.metadata?.title) {
    summary += `Title: ${result.metadata.title}\n`;
  }
  if (result.metadata?.author) {
    summary += `Author: ${result.metadata.author}\n`;
  }
  
  summary += `\n## First ${maxPages} Pages Content:\n\n`;
  
  for (const page of summaryPages) {
    summary += `### Page ${page.pageNumber}\n`;
    // Limit each page preview to first 500 chars
    const preview = page.text.substring(0, 500);
    summary += preview + (page.text.length > 500 ? '...' : '') + '\n\n';
  }
  
  return summary;
}

/**
 * Detect potential chapter/section structure from PDF text
 */
export function detectPDFStructure(result: PDFExtractResult): {
  chapters: { title: string; pageNumber: number }[];
  hasTableOfContents: boolean;
} {
  const chapters: { title: string; pageNumber: number }[] = [];
  let hasTableOfContents = false;

  // Common chapter patterns
  const chapterPatterns = [
    /^(Chapter|CHAPTER)\s+(\d+|[IVX]+)[\s:.-]+(.+?)$/gmi,
    /^(\d+)\.\s+([A-Z][^.]+)$/gm,
    /^(Part|PART)\s+(\d+|[IVX]+)[\s:.-]+(.+?)$/gmi,
    /^(Section|SECTION)\s+(\d+)[\s:.-]+(.+?)$/gmi,
  ];

  for (const page of result.pages) {
    // Check for table of contents
    if (page.pageNumber <= 5 && /table\s+of\s+contents|contents/i.test(page.text)) {
      hasTableOfContents = true;
    }

    // Look for chapter headings
    for (const pattern of chapterPatterns) {
      const matches = page.text.matchAll(pattern);
      for (const match of matches) {
        const title = match[0].trim();
        if (title.length < 100) { // Sanity check
          chapters.push({
            title,
            pageNumber: page.pageNumber,
          });
        }
      }
    }
  }

  // Deduplicate chapters
  const uniqueChapters = chapters.filter((chapter, index, self) =>
    index === self.findIndex(c => c.title === chapter.title)
  );

  return {
    chapters: uniqueChapters,
    hasTableOfContents,
  };
}
