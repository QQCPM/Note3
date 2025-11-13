import React, { useEffect, useRef, useState } from 'react';
import type { Note, Block } from '@/types';
import { createBlock, updateBlock } from '@/utils/tauri';
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
  DragOverlay,
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="relative group">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute left-[-32px] top-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
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
  const { addBlock, updateBlock: updateBlockInStore, setBlocks } = useBlocksStore();
  const creatingInitialBlock = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);

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
        data: JSON.stringify({ type: 'text', content: '' }),
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);

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
      // Update all affected blocks' positions
      const updatePromises = reorderedBlocks.map((block, index) => {
        if (block.position !== index) {
          // Update position in database
          return updateBlock(block.id, block.data).then((updated) => {
            // Update the block with new position
            return {
              ...updated,
              position: index,
            };
          });
        }
        return Promise.resolve(block);
      });

      await Promise.all(updatePromises);
      console.log('Block positions updated successfully');
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
            {sortedBlocks.map((block) => (
              <SortableBlock key={block.id} block={block}>
                {renderBlock(block)}
              </SortableBlock>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};

export default CanvasContent;
