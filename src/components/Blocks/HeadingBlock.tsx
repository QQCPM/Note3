import React, { useState, useEffect } from 'react';
import { updateBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import type { Block } from '@/types';

interface HeadingBlockProps {
  block: Block;
}

const HeadingBlock: React.FC<HeadingBlockProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore } = useBlocksStore();
  const [content, setContent] = useState('');
  const isH1 = block.type === 'heading1';

  // Parse block data
  useEffect(() => {
    try {
      const data = JSON.parse(block.data);
      setContent(data.content || '');
    } catch (error) {
      console.error('Failed to parse block data:', error);
      setContent('');
    }
  }, [block.data]);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Save to database
    try {
      const newData = JSON.stringify({
        type: block.type,
        content: newContent
      });
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update block:', error);
    }
  };

  return (
    <div className={`canvas-block text-block ${isH1 ? 'heading-1' : 'heading-2'}`}>
      <div className="block-handle">⋮⋮</div>
      <input
        type="text"
        value={content}
        onChange={handleChange}
        placeholder={isH1 ? 'Heading 1' : 'Heading 2'}
      />
    </div>
  );
};

export default HeadingBlock;
