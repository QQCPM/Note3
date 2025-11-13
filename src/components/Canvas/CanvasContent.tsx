import React from 'react';
import type { Note, Block } from '@/types';

interface CanvasContentProps {
  note: Note | null;
  blocks: Block[];
}

const CanvasContent: React.FC<CanvasContentProps> = ({ note, blocks }) => {
  if (!note) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto py-12 px-8">
        {blocks.length === 0 ? (
          <div className="canvas-block text-block">
            <div className="block-handle">⋮⋮</div>
            <textarea
              rows={1}
              placeholder="Type '/' for commands..."
              className="w-full"
            />
          </div>
        ) : (
          blocks.map((block) => (
            <div key={block.id} className="canvas-block">
              <div className="block-handle">⋮⋮</div>
              <div className="text-sm text-text-secondary">
                Block: {block.block_type}
              </div>
              {/* TODO: Render different block types */}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CanvasContent;
