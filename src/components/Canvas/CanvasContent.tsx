import React from 'react';
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
      case 'database':
        return <DatabaseBlock key={block.id} />;
      case 'artifact':
        return <ArtifactBlock key={block.id} />;
      case 'task':
        return <TaskBlock key={block.id} />;
      default:
        return (
          <div key={block.id} className="canvas-block">
            <div className="block-handle">⋮⋮</div>
            <div className="text-sm text-gray-500">
              Block type: {block.block_type} (not implemented yet)
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto py-12 px-8" id="canvas">
        {blocks.length === 0 ? (
          <div className="space-y-4">
            <div className="text-gray-500 text-sm text-center py-8">
              This note is empty. Add a text block to get started.
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleAddTextBlock}
                className="px-4 py-2 bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] rounded text-sm text-white transition-colors"
              >
                + Add Text Block
              </button>
            </div>
          </div>
        ) : (
          <>
            {blocks.map(renderBlock)}

            {/* Empty text block for adding more */}
            <div className="canvas-block text-block">
              <div className="block-handle">⋮⋮</div>
              <textarea
                rows={1}
                placeholder="Type '/' for commands..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddTextBlock();
                  }
                }}
              ></textarea>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CanvasContent;
