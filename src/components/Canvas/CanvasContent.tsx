import React from 'react';
import type { Note, Block } from '@/types';
import { createBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import TextBlock from '@/components/Blocks/TextBlock';
import HeadingBlock from '@/components/Blocks/HeadingBlock';

interface CanvasContentProps {
  note: Note | null;
  blocks: Block[];
}

const CanvasContent: React.FC<CanvasContentProps> = ({ note, blocks }) => {
  const { addBlock } = useBlocksStore();

  if (!note) return null;

  const handleAddTextBlock = async () => {
    if (!note) return;

    try {
      const newBlock = await createBlock({
        note_id: note.id,
        block_type: 'text',
        data: JSON.stringify({ type: 'text', content: '' }),
      });
      addBlock(newBlock);
    } catch (error) {
      console.error('Failed to create block:', error);
    }
  };

  const renderBlock = (block: Block) => {
    switch (block.block_type) {
      case 'text':
        return <TextBlock key={block.id} block={block} />;
      case 'heading1':
      case 'heading2':
        return <HeadingBlock key={block.id} block={block} />;
      default:
        return (
          <div key={block.id} className="canvas-block">
            <div className="block-handle">⋮⋮</div>
            <div className="text-sm text-text-secondary">
              Block type: {block.block_type} (not implemented yet)
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto py-12 px-8">
        {blocks.length === 0 ? (
          <div className="space-y-4">
            <div className="text-text-tertiary text-sm text-center py-8">
              This note is empty. Add a text block to get started.
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleAddTextBlock}
                className="px-4 py-2 bg-bg-tertiary hover:bg-bg-elevated border border-border rounded text-sm text-text-primary transition-colors"
              >
                + Add Text Block
              </button>
            </div>
          </div>
        ) : (
          <>
            {blocks.map(renderBlock)}

            {/* Add block button at the end */}
            <div className="mt-4 flex justify-start">
              <button
                onClick={handleAddTextBlock}
                className="px-3 py-1.5 text-sm text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
              >
                + Add block
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CanvasContent;
