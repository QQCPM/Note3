import React, { useEffect, useRef } from 'react';
import type { Note, Block } from '@/types';
import { createBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import TextBlock from '@/components/Blocks/TextBlock';
import HeadingBlock from '@/components/Blocks/HeadingBlock';
import DatabaseBlock from '@/components/Blocks/DatabaseBlock';
import ArtifactBlock from '@/components/Blocks/ArtifactBlock';
import TaskBlock from '@/components/Blocks/TaskBlock';

interface CanvasContentProps {
  note: Note | null;
  blocks: Block[];
}

const CanvasContent: React.FC<CanvasContentProps> = ({ note, blocks }) => {
  const { addBlock } = useBlocksStore();
  const creatingInitialBlock = useRef(false);

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

  const renderBlock = (block: Block) => {
    switch (block.type) {
      case 'text':
        return <TextBlock key={block.id} block={block} />;
      case 'heading1':
      case 'heading2':
        return <HeadingBlock key={block.id} block={block} />;
      case 'database':
        return <DatabaseBlock key={block.id} block={block} />;
      case 'artifact':
        return <ArtifactBlock key={block.id} block={block} />;
      case 'task':
        return <TaskBlock key={block.id} block={block} />;
      default:
        return (
          <div key={block.id} className="canvas-block">
            <div className="block-handle">⋮⋮</div>
            <div className="text-sm text-gray-500">
              Block type: {block.type} (not implemented yet)
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto py-12 px-8" id="canvas">
        {blocks.map(renderBlock)}
      </div>
    </div>
  );
};

export default CanvasContent;
