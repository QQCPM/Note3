import React, { useEffect, useState, lazy, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useLayoutStore } from '@/store/layoutStore';
import { useAIStore } from '@/store/aiStore';
import { useBlocksStore } from '@/store/blocksStore';
import { useNotesStore } from '@/store/notesStore';
import { useProjectStore } from '@/store/projectStore';
import { applyEdit, rejectEdit } from '@/services/aiEditService';
import { getBlocksByNote } from '@/utils/tauri';
import type { Block } from '@/types';
import { X, Check, XCircle, Loader2 } from 'lucide-react';
import './NotePreviewPanel.css';

// Helper to get generated note content from localStorage
const getGeneratedNoteContent = (noteId: string): string | null => {
  return localStorage.getItem(`note-content-${noteId}`);
};

// Markdown renderer component with LaTeX support
const MarkdownContent: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => (
  <div className={`markdown-rendered ${className}`}>
    <ReactMarkdown
      remarkPlugins={[
        remarkGfm,
        [remarkMath, { singleDollarTextMath: true }]
      ]}
      rehypePlugins={[
        [rehypeKatex, {
          throwOnError: false,
          errorColor: '#ff6b6b',
          strict: false,
          trust: true,
          output: 'html'
        }]
      ]}
      components={{
        p: ({ children, ...props }) => (
          <p className="mb-3 last:mb-0 leading-relaxed text-gray-300" {...props}>{children}</p>
        ),
        h1: ({ children, ...props }) => (
          <h1 className="text-xl font-bold mb-3 mt-4 text-white border-b border-[#30363d] pb-2" {...props}>{children}</h1>
        ),
        h2: ({ children, ...props }) => (
          <h2 className="text-lg font-semibold mb-2 mt-4 text-white" {...props}>{children}</h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 className="text-base font-semibold mb-2 mt-3 text-white" {...props}>{children}</h3>
        ),
        ul: ({ children, ...props }) => (
          <ul className="list-disc pl-6 mb-3 space-y-1 text-gray-300" {...props}>{children}</ul>
        ),
        ol: ({ children, ...props }) => (
          <ol className="list-decimal pl-6 mb-3 space-y-1 text-gray-300" {...props}>{children}</ol>
        ),
        li: ({ children, ...props }) => (
          <li className="pl-1" {...props}>{children}</li>
        ),
        code: ({ className, children }: any) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <pre className="bg-[#0d1117] p-3 rounded-md overflow-x-auto my-2">
                <code className="text-sm text-gray-300 font-mono">{children}</code>
              </pre>
            );
          }
          return <code className="bg-[#161b22] px-1.5 py-0.5 rounded text-sm font-mono text-[#e6edf3]">{children}</code>;
        },
        pre: ({ children }) => <>{children}</>,
        blockquote: ({ children, ...props }) => (
          <blockquote className="border-l-4 border-[#30363d] pl-4 my-3 text-gray-400 italic" {...props}>{children}</blockquote>
        ),
        hr: () => <hr className="border-[#30363d] my-4" />,
        strong: ({ children, ...props }) => (
          <strong className="font-semibold text-white" {...props}>{children}</strong>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

// Import block components (same as CanvasContent)
import TextBlock from '@/components/Blocks/TextBlock';
import HeadingBlock from '@/components/Blocks/HeadingBlock';
import TaskBlock from '@/components/Blocks/TaskBlock';
import QuizBlock from '@/components/Blocks/QuizBlock';
import WebBlock from '@/components/Blocks/WebBlock';

// Lazy load heavy components
const DatabaseBlock = lazy(() => import('@/components/Blocks/DatabaseBlock'));
const ArtifactBlock = lazy(() => import('@/components/Blocks/ArtifactBlock'));

const NotePreviewPanel: React.FC = () => {
  const { currentEditingNoteId, hideNotePanel } = useLayoutStore();
  const { pendingEdits, isLoading } = useAIStore();
  // Subscribe to blocks array to trigger re-renders when blocks change
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { blocks: _blocks, getBlocksByNoteId, setBlocks } = useBlocksStore();
  const { getNoteById } = useNotesStore();
  const { treeItems } = useProjectStore();
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  // State for generated notes (localStorage-based)
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [isGeneratedNote, setIsGeneratedNote] = useState(false);

  // Get the note from notesStore or find title from treeItems
  const currentNote = currentEditingNoteId ? getNoteById(currentEditingNoteId) : null;
  const treeItem = currentEditingNoteId
    ? treeItems.find(t => t.noteId === currentEditingNoteId || t.id === currentEditingNoteId)
    : null;
  const noteTitle = currentNote?.title || treeItem?.name || 'Note Preview';

  // Check if this is a generated note and load content
  useEffect(() => {
    if (!currentEditingNoteId) {
      setIsGeneratedNote(false);
      setGeneratedContent(null);
      return;
    }

    const content = getGeneratedNoteContent(currentEditingNoteId);
    if (content) {
      console.log('📝 Found generated note content:', content.length, 'chars');
      setIsGeneratedNote(true);
      setGeneratedContent(content);
    } else {
      setIsGeneratedNote(false);
      setGeneratedContent(null);
    }
  }, [currentEditingNoteId]);

  // Poll for content updates when AI is loading (for generated notes)
  useEffect(() => {
    if (!currentEditingNoteId || !isLoading) return;

    const intervalId = window.setInterval(() => {
      const content = getGeneratedNoteContent(currentEditingNoteId);
      if (content && content !== generatedContent) {
        console.log('📝 Content updated:', content.length, 'chars');
        setGeneratedContent(content);
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [currentEditingNoteId, isLoading, generatedContent]);

  // Fetch blocks when note changes (for database notes)
  useEffect(() => {
    if (!currentEditingNoteId || isGeneratedNote) return;

    const fetchBlocks = async () => {
      try {
        setLoadingBlocks(true);
        console.log('📝 Fetching blocks for note:', currentEditingNoteId);

        const blocks = await getBlocksByNote(currentEditingNoteId);
        console.log('✅ Fetched blocks:', blocks);

        // Update blocksStore with fetched blocks
        setBlocks(blocks);
        setLoadingBlocks(false);
      } catch (error) {
        console.error('❌ Failed to fetch blocks:', error);
        setLoadingBlocks(false);
      }
    };

    fetchBlocks();
  }, [currentEditingNoteId, setBlocks, isGeneratedNote]);

  // Subscribe to blocks changes - refetch when blocks are added/updated
  useEffect(() => {
    if (!currentEditingNoteId) return;

    // Set up interval to check for new blocks every 500ms when AI is editing
    let intervalId: number | null = null;

    if (isLoading) {
      intervalId = window.setInterval(async () => {
        try {
          const blocks = await getBlocksByNote(currentEditingNoteId);
          setBlocks(blocks);
        } catch (error) {
          console.error('Failed to refresh blocks:', error);
        }
      }, 500);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentEditingNoteId, isLoading, setBlocks]);

  // Get blocks from store (after they've been loaded)
  const noteBlocks = currentEditingNoteId ? getBlocksByNoteId(currentEditingNoteId) : [];

  // Find pending edit for generated notes first
  const generatedNoteEdit = pendingEdits.find((edit) => {
    if (edit.status !== 'pending') return false;
    return edit.isGeneratedNote && edit.noteId === currentEditingNoteId;
  });

  // Find the current edit for database notes (filter by currentEditingNoteId's blocks)
  const currentEdit = pendingEdits.find((edit) => {
    if (edit.status !== 'pending') return false;
    if (edit.isGeneratedNote) return false; // Skip generated note edits

    // Check if this edit is for a block in the current note
    const block = noteBlocks.find(b => b.id === edit.blockId);
    return !!block;
  });

  // Also check for ANY pending edit if we don't find one for current note's blocks
  // This handles the case where a block was just created and might not be in noteBlocks yet
  const latestPendingEdit = !currentEdit ?
    pendingEdits.find((edit) => edit.status === 'pending' && !edit.isGeneratedNote) :
    currentEdit;

  // Prioritize generated note edit, then database note edit
  const editToShow = generatedNoteEdit || latestPendingEdit;

  // Loading placeholder for heavy blocks
  const BlockLoadingPlaceholder = ({ type }: { type: string }) => (
    <div className="p-4 bg-[#161b22] rounded border border-[#30363d] animate-pulse">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-4 h-4 border-2 border-gray-600 border-t-purple-500 rounded-full animate-spin"></div>
        <span>Loading {type}...</span>
      </div>
    </div>
  );

  // Render block component based on type (same as CanvasContent)
  const renderBlock = (block: Block) => {
    switch (block.type) {
      case 'text':
        return <TextBlock block={block} />;
      case 'heading1':
      case 'heading2':
        return <HeadingBlock block={block} />;
      case 'database':
        return (
          <Suspense fallback={<BlockLoadingPlaceholder type="database" />}>
            <DatabaseBlock block={block} />
          </Suspense>
        );
      case 'artifact':
        return (
          <Suspense fallback={<BlockLoadingPlaceholder type="artifact" />}>
            <ArtifactBlock block={block} />
          </Suspense>
        );
      case 'task':
        return <TaskBlock block={block} />;
      case 'quiz':
        return <QuizBlock block={block} />;
      case 'web':
        return <WebBlock block={block} />;
      default:
        return (
          <div className="text-sm text-gray-500">
            Block type: {block.type} (not implemented)
          </div>
        );
    }
  };

  const handleAccept = async () => {
    if (!editToShow) return;

    try {
      // Handle generated note edits differently
      if (editToShow.isGeneratedNote && editToShow.noteId) {
        console.log('✅ Accepting generated note edit, saving to localStorage');
        // Save the proposed content to localStorage
        localStorage.setItem(`note-content-${editToShow.noteId}`, editToShow.proposedContent);
        // Update the local state
        setGeneratedContent(editToShow.proposedContent);
        // Remove the pending edit
        rejectEdit(editToShow.id); // This just removes it from the store
        console.log('💾 Content saved successfully');
      } else {
        // Database note - use original flow
        await applyEdit(editToShow.id);

        // Refresh blocks immediately to show applied changes
        if (currentEditingNoteId) {
          const blocks = await getBlocksByNote(currentEditingNoteId);
          setBlocks(blocks);
        }
      }

      // Panel stays open - user can see the applied changes
      // The green highlight will disappear since pending edit is removed
    } catch (error) {
      console.error('Failed to apply edit:', error);
    }
  };

  const handleReject = () => {
    if (!editToShow) return;

    rejectEdit(editToShow.id);
    // Panel stays open - green highlight will disappear
    // For generated notes, content reverts to original (no change to localStorage)
  };

  // Note: Diff highlighting is now handled via generatedNoteEdit in the render

  return (
    <div className="note-preview-panel">
      {/* Header */}
      <div className="preview-header">
        <div className="header-content">
          <h3 className="header-title">{noteTitle}</h3>
          <p className="header-subtitle">
            {isLoading ? 'AI is adding content...' : editToShow ? 'AI is editing your note' : 'Current content'}
          </p>
        </div>
        <button
          className="close-button"
          onClick={hideNotePanel}
          aria-label="Close preview"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content Area */}
      <div className="preview-content">
        {isGeneratedNote || generatedNoteEdit ? (
          // Generated note - show markdown content with pending edit diff
          <div className="note-preview-blocks">
            {isLoading && !generatedContent && !generatedNoteEdit && (
              <div className="preview-loading">
                <Loader2 size={32} className="spinner" />
                <p className="loading-text">AI is generating content...</p>
              </div>
            )}

            {/* Show pending edit with diff view */}
            {generatedNoteEdit ? (
              <div className="generated-note-content">
                {/* Edit reason banner */}
                <div className="edit-reason-banner mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <span className="text-xs text-blue-400 uppercase tracking-wide font-semibold">Proposed Changes:</span>
                  <p className="text-sm text-gray-300 mt-1">{generatedNoteEdit.reason}</p>
                </div>

                {/* Original content */}
                <div className="original-content mb-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Current Content</div>
                  <div className="border border-[#30363d] rounded-lg p-4 bg-[#0d1117]">
                    <MarkdownContent content={generatedNoteEdit.originalContent} />
                  </div>
                </div>

                {/* New content with green highlight */}
                <div className="new-content-section">
                  <div className="new-content-label text-xs text-green-400 uppercase tracking-wide font-semibold mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    New Content to Add
                  </div>
                  <div className="new-content-wrapper border-l-4 border-green-500 bg-green-500/10 pl-4 py-3 rounded-r">
                    <MarkdownContent
                      content={generatedNoteEdit.proposedContent.slice(generatedNoteEdit.originalContent.length).trim()}
                    />
                  </div>
                </div>
              </div>
            ) : generatedContent ? (
              <div className="generated-note-content">
                {/* Render the full content with markdown */}
                <MarkdownContent content={generatedContent} />

                {/* Loading indicator when AI is still working */}
                {isLoading && (
                  <div className="ai-working-indicator mt-4 flex items-center gap-2 text-purple-400">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">AI is adding more content...</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : loadingBlocks ? (
          // Loading blocks from database
          <div className="preview-loading">
            <Loader2 size={32} className="spinner" />
            <p className="loading-text">Loading note content...</p>
          </div>
        ) : isLoading && noteBlocks.length === 0 ? (
          // Loading state - AI is thinking (no blocks yet)
          <div className="preview-loading">
            <Loader2 size={32} className="spinner" />
            <p className="loading-text">AI is thinking...</p>
          </div>
        ) : noteBlocks.length > 0 ? (
          // Show note blocks with green highlights for pending edits
          <div className="note-preview-blocks">
            {editToShow && editToShow.reason && (
              <div className="edit-reason-banner">
                <span className="text-xs text-blue-400 uppercase tracking-wide font-semibold">Edit Reason:</span>
                <p className="text-sm text-gray-300 mt-1">{editToShow.reason}</p>
              </div>
            )}
            <div className="blocks-preview">
              {noteBlocks.map((block) => {
                // Check if this block has a pending edit
                const hasPendingEdit = editToShow?.blockId === block.id;

                // If block has pending edit, show the PROPOSED content
                let blockToRender = block;
                if (hasPendingEdit && editToShow) {
                  // Only apply for blocks with 'content' field (text, heading)
                  if (block.type === 'text' || block.type === 'heading1' || block.type === 'heading2') {
                    blockToRender = {
                      ...block,
                      data: {
                        ...block.data,
                        content: editToShow.proposedContent,
                      } as typeof block.data,
                    };
                  }
                }

                return (
                  <div
                    key={block.id}
                    className={`block-preview-wrapper ${hasPendingEdit ? 'has-pending-edit' : ''}`}
                  >
                    {renderBlock(blockToRender)}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Empty note
          <div className="preview-empty">
            <p className="text-gray-400">This note is empty</p>
            <p className="text-xs text-gray-500 mt-2">AI will add content based on your message</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {editToShow && (
        <div className="preview-actions">
          <button
            className="action-button reject-button"
            onClick={handleReject}
            disabled={isLoading}
          >
            <XCircle size={18} />
            <span>Reject</span>
          </button>
          <button
            className="action-button accept-button"
            onClick={handleAccept}
            disabled={isLoading}
          >
            <Check size={18} />
            <span>Accept Changes</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default NotePreviewPanel;
