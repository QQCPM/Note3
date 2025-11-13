import React, { useState, useRef, useEffect } from 'react';
import { updateBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import type { Block } from '@/types';

interface TextBlockProps {
  block: Block;
}

const TextBlock: React.FC<TextBlockProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore } = useBlocksStore();
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  const handleChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';

    // Save to database (debounced in real app)
    try {
      const newData = JSON.stringify({ type: 'text', content: newContent });
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update block:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle slash command
    if (e.key === '/' && content.endsWith('/')) {
      // TODO: Show slash menu
      console.log('Show slash menu');
    }
  };

  return (
    <div className="canvas-block text-block">
      <div className="block-handle">⋮⋮</div>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type '/' for commands..."
        rows={1}
        className="w-full"
      />
    </div>
  );
};

export default TextBlock;
