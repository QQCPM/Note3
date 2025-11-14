import React, { useEffect, useRef } from 'react';
import type { Note, Block } from '@/types';
import { createBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import TextBlock from '@/components/Blocks/TextBlock';
import HeadingBlock from '@/components/Blocks/HeadingBlock';
import DatabaseBlock from '@/components/Blocks/DatabaseBlock';
import ArtifactBlock from '@/components/Blocks/ArtifactBlock';
import TaskBlock from '@/components/Blocks/TaskBlock';
import WebBlock from '@/components/Blocks/WebBlock';
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

// Sortable Block Wrapper Component
interface SortableBlockProps {
  block: Block;
  children: React.ReactNode;
}

const SortableBlock: React.FC<SortableBlockProps> = ({ block, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

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

  return (
    <div ref={setNodeRef} style={style} className="block-wrapper">
      <div className="relative group w-full">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute left-[-32px] top-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
          style={{ width: '24px', height: '24px' }}
        >
          <div className="text-gray-500 hover:text-gray-300 flex items-center justify-center w-full h-full">
            ⋮⋮
          </div>
        </div>
        {children}
      </div>
    </div>
  );
};

const CanvasContent: React.FC<CanvasContentProps> = ({ note, blocks }) => {
  const { addBlock, setBlocks } = useBlocksStore();
  const creatingInitialBlock = useRef(false);

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

  if (!note) return null;

  // Auto-create first text block if note is empty
  useEffect(() => {
    if (note && blocks.length === 0 && !creatingInitialBlock.current) {
      creatingInitialBlock.current = true;
      createBlock({
        note_id: note.id,
        type: 'text',
        position: 0,
        data: { type: 'text', content: '' },
      })
        .then((newBlock) => {
          addBlock(newBlock);
        })
        .catch((error) => {
          console.error('Failed to create initial block:', error);
        })
        .finally(() => {
          creatingInitialBlock.current = false;
        });
    }
  }, [note?.id, blocks.length, addBlock]);

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

  const renderBlock = (block: Block) => {
    switch (block.type) {
      case 'text':
        return <TextBlock block={block} />;
      case 'heading1':
      case 'heading2':
        return <HeadingBlock block={block} />;
      case 'database':
        return <DatabaseBlock block={block} />;
      case 'artifact':
        return <ArtifactBlock block={block} />;
      case 'task':
        return <TaskBlock block={block} />;
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
      <div className="max-w-4xl mx-auto py-12 px-8 pl-16" id="canvas">
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
            <div className="flex flex-wrap gap-4">
              {sortedBlocks.map((block) => (
                <SortableBlock key={block.id} block={block}>
                  {renderBlock(block)}
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
