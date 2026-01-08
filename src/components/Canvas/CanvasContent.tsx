import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import type { Note, Block } from '@/types';
import { createBlock, deleteBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import TextBlock from '@/components/Blocks/TextBlock';
import HeadingBlock from '@/components/Blocks/HeadingBlock';
import TaskBlock from '@/components/Blocks/TaskBlock';
import QuizBlock from '@/components/Blocks/QuizBlock';
import WebBlock from '@/components/Blocks/WebBlock';
import ErrorBoundary from '@/components/ErrorBoundary';

// Lazy load heavy components to improve initial render performance
const DatabaseBlock = lazy(() => import('@/components/Blocks/DatabaseBlock'));
const ArtifactBlock = lazy(() => import('@/components/Blocks/ArtifactBlock'));
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CanvasContentProps {
  note: Note | null;
  blocks: Block[];
}

// Sortable Block Wrapper Component - Memoized to prevent unnecessary re-renders
interface SortableBlockProps {
  block: Block;
  children: React.ReactNode;
}

const SortableBlock: React.FC<SortableBlockProps> = React.memo(({ block, children }) => {
  const { deleteBlock: deleteBlockFromStore } = useBlocksStore();
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  // Close menu when clicking outside
  useEffect(() => {
    if (showDeleteMenu) {
      const handleClickOutside = () => setShowDeleteMenu(false);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDeleteMenu]);

  // Calculate width based on block layout settings
  const getBlockWidth = () => {
    const blockData = block.data;
    if (!blockData.width || blockData.width === 'full') return '100%';
    if (blockData.width === 'half') return 'calc(50% - 8px)';
    if (blockData.width === 'third') return 'calc(33.333% - 8px)';
    if (blockData.width === 'quarter') return 'calc(25% - 8px)';
    if (typeof blockData.width === 'number') return `${blockData.width}%`;
    return '100%';
  };

  // Get alignment justification
  const getAlignment = () => {
    const blockData = block.data;
    if (blockData.alignment === 'center') return 'center';
    if (blockData.alignment === 'right') return 'flex-end';
    return 'flex-start'; // left is default
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: getBlockWidth(),
    display: 'flex',
    justifyContent: getAlignment(),
  };

  const handleDelete = async () => {
    try {
      await deleteBlock(block.id);
      deleteBlockFromStore(block.id);
      setShowDeleteMenu(false);
    } catch (error) {
      console.error('Failed to delete block:', error);
    }
  };

  const handleDragHandleClick = (e: React.MouseEvent) => {
    // Only handle click if not dragging
    if (!isDragging) {
      e.stopPropagation();
      setShowDeleteMenu(!showDeleteMenu);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="block-wrapper mb-4">
      <div className="relative group w-full">
        {/* Drag Handle with Click Menu */}
        <div className="absolute left-[-28px] top-1 z-20">
          <div
            {...attributes}
            {...listeners}
            onClick={handleDragHandleClick}
            className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ width: '20px', height: '20px' }}
          >
            <div className="text-gray-500 hover:text-gray-300 flex items-center justify-center w-full h-full text-xs">
              ⋮⋮
            </div>
          </div>

          {/* Delete Menu */}
          {showDeleteMenu && (
            <div className="absolute left-0 top-6 bg-[#161b22] border border-[#30363d] rounded shadow-lg py-1 min-w-[120px] z-30">
              <button
                onClick={handleDelete}
                className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-[#21262d] transition-colors flex items-center gap-2"
              >
                <span>🗑️</span>
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if block data actually changed
  return prevProps.block.id === nextProps.block.id &&
    prevProps.block.data === nextProps.block.data &&
    prevProps.block.position === nextProps.block.position;
});

const CanvasContent: React.FC<CanvasContentProps> = ({ note, blocks }) => {
  const { addBlock, setBlocks } = useBlocksStore();
  const creatingInitialBlock = useRef(false);
  const initializedNotes = useRef<Set<string>>(new Set()); // Track which notes have been loaded

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Auto-create first text block ONLY if note is truly empty (not during loading)
  useEffect(() => {
    if (!note) return;

    // Mark this note as initialized once we have blocks
    if (blocks.length > 0) {
      initializedNotes.current.add(note.id);
      return;
    }

    // Only auto-create if:
    // 1. Note has never been loaded before (not in initializedNotes)
    // 2. Blocks are still empty after a delay (meaning it's truly empty, not just loading)
    // 3. Not already creating
    const hasBeenInitialized = initializedNotes.current.has(note.id);

    if (!hasBeenInitialized && blocks.length === 0 && !creatingInitialBlock.current) {
      // Wait a bit to ensure blocks have finished loading
      const timer = setTimeout(() => {
        // Double-check blocks are still empty after waiting
        if (blocks.length === 0 && !creatingInitialBlock.current) {
          console.log('📝 [INIT] Creating initial empty block for new note');
          creatingInitialBlock.current = true;
          createBlock({
            note_id: note.id,
            type: 'text',
            position: 0,
            data: { type: 'text', content: '' },
          })
            .then((newBlock) => {
              addBlock(newBlock);
              initializedNotes.current.add(note.id);
            })
            .catch((error) => {
              console.error('Failed to create initial block:', error);
            })
            .finally(() => {
              creatingInitialBlock.current = false;
            });
        }
      }, 200); // 200ms delay to let blocks load

      return () => clearTimeout(timer);
    }
  }, [note?.id, blocks.length, addBlock]);

  // Early return AFTER all hooks
  if (!note) return null;

  const handleDragStart = (_event: DragStartEvent) => {
    // Could track active drag state here if needed
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // Find indexes
    const oldIndex = blocks.findIndex((block) => block.id === active.id);
    const newIndex = blocks.findIndex((block) => block.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Reorder blocks array
    const reorderedBlocks = arrayMove(blocks, oldIndex, newIndex);

    // Update local state immediately (optimistic update)
    setBlocks(reorderedBlocks);

    // Update positions in database
    try {
      // Note: Position updates would require a separate Tauri command
      // For now, we just update the local state
      console.log('Block positions updated in UI (backend update pending)');
    } catch (error) {
      console.error('Failed to update block positions:', error);
      // Revert to original order on error
      setBlocks(blocks);
    }
  };

  // Loading placeholder for heavy blocks
  const BlockLoadingPlaceholder = ({ type }: { type: string }) => (
    <div className="canvas-block p-4 bg-[#161b22] rounded border border-[#30363d] animate-pulse">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-4 h-4 border-2 border-gray-600 border-t-purple-500 rounded-full animate-spin"></div>
        <span>Loading {type}...</span>
      </div>
    </div>
  );

  const renderBlock = (block: Block) => {
    switch (block.type) {
      case 'text':
        return <TextBlock block={block} />;
      case 'heading1':
      case 'heading2':
        return <HeadingBlock block={block} />;
      case 'database':
        // Wrap heavy database block in Suspense
        return (
          <Suspense fallback={<BlockLoadingPlaceholder type="database" />}>
            <DatabaseBlock block={block} />
          </Suspense>
        );
      case 'artifact':
        // Wrap heavy artifact block in Suspense
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
          <div className="canvas-block">
            <div className="block-handle">⋮⋮</div>
            <div className="text-sm text-gray-500">
              Block type: {block.type} (not implemented yet)
            </div>
          </div>
        );
    }
  };

  // Sort blocks by position
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[90%] mx-auto py-12 px-8 pl-20" id="canvas">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedBlocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col">
              {sortedBlocks.map((block) => (
                <SortableBlock key={block.id} block={block}>
                  <ErrorBoundary>
                    {renderBlock(block)}
                  </ErrorBoundary>
                </SortableBlock>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};

export default CanvasContent;
