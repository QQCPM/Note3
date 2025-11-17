import React, { useState, useEffect } from 'react';
import { updateBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import type { Block, HeadingBlockData } from '@/types';

interface HeadingBlockProps {
  block: Block;
}

const HeadingBlock: React.FC<HeadingBlockProps> = React.memo(({ block }) => {
  const { updateBlock: updateBlockInStore } = useBlocksStore();
  const data = block.data as HeadingBlockData;
  const [content, setContent] = useState(data.content || '');
  const isH1 = block.type === 'heading1';

  // Sync content with block data
  useEffect(() => {
    const blockData = block.data as HeadingBlockData;
    setContent(blockData.content || '');
  }, [block.data]);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Save to database
    try {
      const newData: HeadingBlockData = {
        type: block.type as 'heading1' | 'heading2',
        content: newContent
      };
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update block:', error);
    }
  };

  return (
    <div className={`canvas-block text-block ${isH1 ? 'heading-1' : 'heading-2'}`}>
      <input
        type="text"
        value={content}
        onChange={handleChange}
        placeholder={isH1 ? 'Heading 1' : 'Heading 2'}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.block.id === nextProps.block.id &&
         prevProps.block.data === nextProps.block.data;
});

export default HeadingBlock;
