import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useLayoutStore } from '@/store/layoutStore';
import { useAIStore } from '@/store/aiStore';
import { useBlocksStore } from '@/store/blocksStore';
import { useNotesStore } from '@/store/notesStore';
import { applyEdit, rejectEdit } from '@/services/aiEditService';
import { getBlocksByNote } from '@/utils/tauri';
import type { Block } from '@/types';
import { X, Check, XCircle, Loader2 } from 'lucide-react';
import './NotePreviewPanel.css';

// Import block components (same as CanvasContent)
import TextBlock from '@/components/Blocks/TextBlock';
import HeadingBlock from '@/components/Blocks/HeadingBlock';
import TaskBlock from '@/components/Blocks/TaskBlock';
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
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  // Get the note
  const currentNote = currentEditingNoteId ? getNoteById(currentEditingNoteId) : null;

  // Fetch blocks when note changes
  useEffect(() => {
    if (!currentEditingNoteId) return;

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
  }, [currentEditingNoteId, setBlocks]);

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

  // Find the current edit for this note (filter by currentEditingNoteId's blocks)
  const currentEdit = pendingEdits.find((edit) => {
    if (edit.status !== 'pending') return false;

    // Check if this edit is for a block in the current note
    const block = noteBlocks.find(b => b.id === edit.blockId);
    return !!block;
  });

  // Also check for ANY pending edit if we don't find one for current note's blocks
  // This handles the case where a block was just created and might not be in noteBlocks yet
  const latestPendingEdit = !currentEdit ?
    pendingEdits.find((edit) => edit.status === 'pending') :
    currentEdit;

  const editToShow = latestPendingEdit;

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
      await applyEdit(editToShow.id);

      // Refresh blocks immediately to show applied changes
      if (currentEditingNoteId) {
        const blocks = await getBlocksByNote(currentEditingNoteId);
        setBlocks(blocks);
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
    // Block will revert to original content (empty in this case)
  };

  return (
    <div className="note-preview-panel">
      {/* Header */}
      <div className="preview-header">
        <div className="header-content">
          <h3 className="header-title">{currentNote?.title || 'Note Preview'}</h3>
          <p className="header-subtitle">
            {editToShow ? 'AI is editing your note' : 'Current content'}
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
        {loadingBlocks ? (
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
