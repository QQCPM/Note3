/**
 * AI Project Generator Service
 * 
 * Takes PDF content and generates a complete project structure
 * with folders and notes using AI analysis.
 */

import { sendChatMessage } from './chatService';
import { useProjectStore } from '@/store/projectStore';
import { useNotesStore } from '@/store/notesStore';
import { 
  PDFExtractResult, 
  extractPDFSummary, 
  detectPDFStructure,
  chunkPDFText,
  PDFChunk 
} from './pdfExtractor';

// ============================================================================
// TYPES
// ============================================================================

export interface GeneratedProject {
  name: string;
  icon: string;
  description: string;
  structure: GeneratedFolder[];
}

export interface GeneratedFolder {
  name: string;
  description?: string;
  notes: GeneratedNote[];
  subfolders?: GeneratedFolder[];
}

export interface GeneratedNote {
  name: string;
  content: string;
  pageReferences?: number[];
}

export interface GenerationProgress {
  stage: 'analyzing' | 'planning' | 'generating' | 'creating' | 'complete';
  message: string;
  progress: number; // 0-100
}

type ProgressCallback = (progress: GenerationProgress) => void;

// ============================================================================
// AI PROMPTS
// ============================================================================

const ANALYSIS_PROMPT = `You are an expert at analyzing documents and creating structured learning materials.

Analyze this PDF document and create a project structure for studying it.

PDF Information:
{pdfSummary}

Detected Structure:
{detectedStructure}

Based on this document, create a JSON structure for a complete study project. The structure should:
1. Have a clear project name and description
2. Organize content into logical folders (e.g., by chapter, topic, or concept)
3. Each folder should have notes that summarize and explain key concepts
4. Notes should reference specific pages from the PDF

Respond with ONLY valid JSON in this exact format:
{
  "name": "Project Name",
  "icon": "📚",
  "description": "Brief description of the project",
  "structure": [
    {
      "name": "Folder Name",
      "description": "What this section covers",
      "notes": [
        {
          "name": "Note Title",
          "outline": "Brief outline of what to cover (2-3 sentences)",
          "pageReferences": [1, 2, 3]
        }
      ],
      "subfolders": []
    }
  ]
}`;

const NOTE_GENERATION_PROMPT = `You are an expert educator creating comprehensive study notes.

Create detailed study notes for: "{noteName}"
This is part of the "{folderName}" section.

Context from the PDF (pages {pages}):
---
{context}
---

Write comprehensive study notes that:
1. Explain the key concepts clearly
2. Use markdown formatting (headers, bullet points, code blocks if relevant)
3. Include practical examples where appropriate
4. Highlight important definitions or formulas
5. Be thorough but concise (aim for 300-500 words)

Write the notes in markdown format:`;

// ============================================================================
// PROJECT GENERATOR
// ============================================================================

/**
 * Generate a complete project from a PDF file
 */
export async function generateProjectFromPDF(
  pdfResult: PDFExtractResult,
  userPrompt: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const projectStore = useProjectStore.getState();
  
  // Stage 1: Analyze PDF structure
  onProgress?.({
    stage: 'analyzing',
    message: 'Analyzing PDF structure...',
    progress: 10,
  });

  const pdfSummary = extractPDFSummary(pdfResult, 10);
  const detectedStructure = detectPDFStructure(pdfResult);
  const chunks = chunkPDFText(pdfResult, 3000);

  console.log(`📄 PDF Analysis:`, {
    pages: pdfResult.totalPages,
    words: pdfResult.wordCount,
    chapters: detectedStructure.chapters.length,
    chunks: chunks.length,
  });

  // Stage 2: Generate project plan with AI
  onProgress?.({
    stage: 'planning',
    message: 'Creating project structure with AI...',
    progress: 25,
  });

  const analysisPrompt = ANALYSIS_PROMPT
    .replace('{pdfSummary}', pdfSummary)
    .replace('{detectedStructure}', JSON.stringify(detectedStructure, null, 2));

  const fullPrompt = `${analysisPrompt}\n\nUser request: ${userPrompt}`;
  
  let projectPlan: GeneratedProject;
  try {
    const planResponse = await sendChatMessage([], fullPrompt);
    
    // Extract JSON from response
    const jsonMatch = planResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI did not return valid JSON structure');
    }
    projectPlan = JSON.parse(jsonMatch[0]);
    console.log('📋 Project plan:', projectPlan);
  } catch (error) {
    console.error('Failed to parse project plan:', error);
    throw new Error('Failed to generate project structure. Please try again.');
  }

  // Stage 3: Create project in store
  onProgress?.({
    stage: 'creating',
    message: `Creating project: ${projectPlan.name}`,
    progress: 40,
  });

  const project = projectStore.addProject({
    name: projectPlan.name,
    icon: projectPlan.icon || '📚',
    type: 'study',
    description: projectPlan.description,
  });

  // Stage 4: Generate folders and notes
  const totalItems = countItems(projectPlan.structure);
  let createdItems = 0;

  async function createFolder(
    folder: GeneratedFolder, 
    parentId: string | null,
    chunks: PDFChunk[]
  ): Promise<void> {
    // Create folder
    const folderItem = projectStore.addTreeItem({
      projectId: project.id,
      parentId,
      name: folder.name,
      type: 'folder',
      origin: 'ai_generated',
    });

    // Expand folder
    projectStore.expandItem(folderItem.id);

    // Create notes in this folder
    for (const note of folder.notes) {
      createdItems++;
      const progress = 40 + Math.floor((createdItems / totalItems) * 50);
      
      onProgress?.({
        stage: 'generating',
        message: `Generating: ${note.name}`,
        progress,
      });

      // Find relevant chunks for this note
      const relevantChunks = findRelevantChunks(chunks, note.pageReferences || []);
      const context = relevantChunks.map(c => c.text).join('\n\n').substring(0, 4000);

      // Generate note content with AI
      let generatedContent = `# ${note.name}\n\n*Loading content...*`;
      try {
        const notePrompt = NOTE_GENERATION_PROMPT
          .replace('{noteName}', note.name)
          .replace('{folderName}', folder.name)
          .replace('{pages}', (note.pageReferences || []).join(', ') || 'various')
          .replace('{context}', context || 'No specific context available');

        generatedContent = await sendChatMessage([], notePrompt);
      } catch (error) {
        console.error(`Failed to generate content for ${note.name}:`, error);
        generatedContent = `# ${note.name}\n\n*Content generation failed. Please add content manually.*`;
      }

      // Create actual note in notesStore
      const notesStore = useNotesStore.getState();
      const noteId = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      notesStore.addNote({
        id: noteId,
        parent_id: null,
        title: note.name,
        icon: '📝',
        position: createdItems,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      });

      // Store content (we'll need to handle this with the content system)
      // For now, store in localStorage as a simple solution
      try {
        const contentKey = `note-content-${noteId}`;
        localStorage.setItem(contentKey, generatedContent);
      } catch (e) {
        console.error('Failed to store note content:', e);
      }

      // Create note in tree with noteId link
      projectStore.addTreeItem({
        projectId: project.id,
        parentId: folderItem.id,
        name: note.name,
        type: 'note',
        origin: 'ai_generated',
        noteId: noteId,
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Process subfolders recursively
    if (folder.subfolders) {
      for (const subfolder of folder.subfolders) {
        await createFolder(subfolder, folderItem.id, chunks);
      }
    }
  }

  // Create all folders and notes
  for (const folder of projectPlan.structure) {
    await createFolder(folder, null, chunks);
  }

  // Stage 5: Complete
  onProgress?.({
    stage: 'complete',
    message: `Project "${projectPlan.name}" created with ${createdItems} items`,
    progress: 100,
  });

  // Set this as the active project
  projectStore.setActiveProject(project.id);

  return `✅ Created project **"${projectPlan.name}"** with ${projectPlan.structure.length} folders and ${createdItems} notes.\n\nYou can now explore the project in the sidebar and start learning!`;
}

// ============================================================================
// HELPERS
// ============================================================================

function countItems(structure: GeneratedFolder[]): number {
  let count = 0;
  for (const folder of structure) {
    count += folder.notes.length;
    if (folder.subfolders) {
      count += countItems(folder.subfolders);
    }
  }
  return count;
}

function findRelevantChunks(chunks: PDFChunk[], pageRefs: number[]): PDFChunk[] {
  if (pageRefs.length === 0) {
    // Return first chunk as default context
    return chunks.slice(0, 1);
  }
  
  return chunks.filter(chunk => {
    return pageRefs.some(page => page >= chunk.pageStart && page <= chunk.pageEnd);
  });
}

/**
 * Quick analysis of PDF to show user what will be generated
 */
export async function analyzePDFForPreview(pdfResult: PDFExtractResult): Promise<string> {
  const structure = detectPDFStructure(pdfResult);
  
  let preview = `📄 **${pdfResult.fileName}**\n\n`;
  preview += `- **Pages:** ${pdfResult.totalPages}\n`;
  preview += `- **Words:** ~${pdfResult.wordCount.toLocaleString()}\n`;
  
  if (pdfResult.metadata?.title) {
    preview += `- **Title:** ${pdfResult.metadata.title}\n`;
  }
  if (pdfResult.metadata?.author) {
    preview += `- **Author:** ${pdfResult.metadata.author}\n`;
  }
  
  if (structure.chapters.length > 0) {
    preview += `\n**Detected ${structure.chapters.length} sections:**\n`;
    for (const chapter of structure.chapters.slice(0, 10)) {
      preview += `- ${chapter.title} (p.${chapter.pageNumber})\n`;
    }
    if (structure.chapters.length > 10) {
      preview += `- ...and ${structure.chapters.length - 10} more\n`;
    }
  }
  
  preview += `\n💡 Tell me what kind of project you want to create from this PDF!`;
  
  return preview;
}
