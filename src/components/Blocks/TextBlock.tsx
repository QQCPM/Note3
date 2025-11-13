import React, { useState, useRef, useEffect } from 'react';
import { updateBlock, createBlock } from '@/utils/tauri';
import { useBlocksStore, useNotesStore } from '@/store';
import type { Block } from '@/types';
import SlashCommandMenu from '@/components/Canvas/SlashCommandMenu';
import AIPromptModal from '@/components/Canvas/AIPromptModal';
import { nanoid } from 'nanoid';
import { aiService } from '@/services/ai';

interface TextBlockProps {
  block: Block;
}

const TextBlock: React.FC<TextBlockProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore, addBlock } = useBlocksStore();
  const { activeNoteId } = useNotesStore();
  const [content, setContent] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
  const [slashQuery, setSlashQuery] = useState('');
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiModalType, setAIModalType] = useState<'artifact' | 'database' | 'web' | null>(null);
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

  // Auto-focus on empty blocks (newly created)
  useEffect(() => {
    if (textareaRef.current && content === '') {
      textareaRef.current.focus();
    }
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';

    // Check for slash command trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newContent.substring(0, cursorPos);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

    if (lastSlashIndex !== -1 && lastSlashIndex === textBeforeCursor.length - 1) {
      // Just typed "/"
      showSlashMenuAtCursor(e.target);
      setSlashQuery('');
    } else if (showSlashMenu && lastSlashIndex !== -1) {
      // Update search query
      const query = textBeforeCursor.substring(lastSlashIndex + 1);
      setSlashQuery(query);
    } else if (showSlashMenu && lastSlashIndex === -1) {
      // Slash was deleted, close menu
      setShowSlashMenu(false);
      setSlashQuery('');
    }

    // Save to database (debounced in real app)
    try {
      const newData = JSON.stringify({ type: 'text', content: newContent });
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update block:', error);
    }
  };

  const showSlashMenuAtCursor = (textarea: HTMLTextAreaElement) => {
    const rect = textarea.getBoundingClientRect();

    setSlashMenuPosition({
      x: rect.left,
      y: rect.bottom + 5,
    });
    setShowSlashMenu(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && showSlashMenu) {
      e.preventDefault();
      setShowSlashMenu(false);
      setSlashQuery('');
    }
  };

  const handleSelectCommand = async (command: any) => {
    if (!activeNoteId) return;

    // Remove the slash command text from content
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = content.substring(0, cursorPos);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
    const newContent = content.substring(0, lastSlashIndex) + content.substring(cursorPos);

    setContent(newContent);
    setShowSlashMenu(false);
    setSlashQuery('');

    // Handle AI commands (artifact, database) and web command
    if (command.requiresAI || command.id === 'web') {
      setAIModalType(command.id as 'artifact' | 'database' | 'web');
      setShowAIModal(true);
      return;
    }

    // Handle direct block insertion
    try {
      let blockData: any = {};

      switch (command.id) {
        case 'heading1':
        case 'heading2':
          blockData = { type: command.id, content: '' };
          break;
        case 'text':
          blockData = { type: 'text', content: '' };
          break;
        case 'tasks':
          blockData = {
            type: 'tasks',
            tasks: [
              { id: nanoid(), text: '', completed: false },
            ],
          };
          break;
      }

      const newBlock = await createBlock({
        note_id: activeNoteId,
        type: command.id === 'tasks' ? 'task' : (command.id as any),
        position: block.position + 1,
        data: JSON.stringify(blockData),
      });

      addBlock(newBlock);
    } catch (error) {
      console.error('Failed to create block:', error);
    }
  };

  const handleAIGenerate = async (prompt: string, type: 'artifact' | 'database' | 'web') => {
    if (!activeNoteId) return;

    try {
      console.log('Generating', type, 'with prompt:', prompt);

      setShowAIModal(false);
      setAIModalType(null);

      // Call AI service to generate content
      let blockData: any = {};

      if (type === 'web') {
        // For web type, prompt is the URL
        blockData = {
          type: 'web',
          url: prompt.trim(),
          title: '',
          height: 400,
        };

        const newBlock = await createBlock({
          note_id: activeNoteId,
          type: 'web',
          position: block.position + 1,
          data: JSON.stringify(blockData),
        });

        addBlock(newBlock);
      } else if (type === 'artifact') {
        // First create placeholder block
        const placeholderData = {
          type: 'artifact',
          prompt,
          title: 'Generating...',
          html: '<div style="padding: 40px; text-align: center;"><h2>Generating artifact...</h2><p>Please wait while AI creates your artifact.</p></div>',
          css: 'body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; color: white; }',
          javascript: '',
        };

        const placeholderBlock = await createBlock({
          note_id: activeNoteId,
          type,
          position: block.position + 1,
          data: JSON.stringify(placeholderData),
        });

        addBlock(placeholderBlock);

        // Generate actual artifact in background
        try {
          const result = await aiService.generateArtifact(prompt);

          blockData = {
            type: 'artifact',
            prompt,
            title: result.title || 'AI Generated Artifact',
            html: result.html,
            css: result.css,
            javascript: result.javascript,
          };

          // Update the placeholder block with actual content
          const updated = await updateBlock(placeholderBlock.id, JSON.stringify(blockData));
          updateBlockInStore(placeholderBlock.id, updated);
        } catch (aiError) {
          console.error('AI generation failed:', aiError);

          // Update with error message
          const errorData = {
            type: 'artifact',
            prompt,
            title: 'Generation Failed',
            html: '<div style="padding: 40px; text-align: center;"><h2>⚠️ Generation Failed</h2><p>Could not generate artifact. Please check your AI configuration.</p></div>',
            css: 'body { font-family: Arial, sans-serif; background: #161b22; color: #e6edf3; min-height: 100vh; display: flex; align-items: center; justify-content: center; }',
            javascript: '',
          };

          const updated = await updateBlock(placeholderBlock.id, JSON.stringify(errorData));
          updateBlockInStore(placeholderBlock.id, updated);
        }
      } else if (type === 'database') {
        // Generate database structure
        try {
          const result = await aiService.generateDatabase(prompt);

          blockData = {
            type: 'database',
            prompt,
            title: result.title,
            columns: result.columns.map((col: any) => ({
              id: nanoid(),
              name: col.name,
              type: col.column_type,
              options: col.options,
            })),
            rows: result.rows,
            view: result.view,
          };

          const newBlock = await createBlock({
            note_id: activeNoteId,
            type,
            position: block.position + 1,
            data: JSON.stringify(blockData),
          });

          addBlock(newBlock);
        } catch (aiError) {
          console.error('Database generation failed:', aiError);

          // Create default database on failure
          blockData = {
            type: 'database',
            prompt,
            title: 'Database',
            columns: [
              { id: nanoid(), name: 'Name', type: 'text' },
              { id: nanoid(), name: 'Status', type: 'select', options: ['Todo', 'In Progress', 'Done'] },
            ],
            rows: [],
            view: 'table',
          };

          const newBlock = await createBlock({
            note_id: activeNoteId,
            type,
            position: block.position + 1,
            data: JSON.stringify(blockData),
          });

          addBlock(newBlock);
        }
      }
    } catch (error) {
      console.error('Failed to create AI block:', error);
    }
  };

  return (
    <>
      <div className="canvas-block text-block">
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

      {showSlashMenu && (
        <SlashCommandMenu
          position={slashMenuPosition}
          onClose={() => {
            setShowSlashMenu(false);
            setSlashQuery('');
          }}
          onSelectCommand={handleSelectCommand}
          searchQuery={slashQuery}
        />
      )}

      <AIPromptModal
        isOpen={showAIModal}
        type={aiModalType}
        onClose={() => {
          setShowAIModal(false);
          setAIModalType(null);
        }}
        onGenerate={handleAIGenerate}
      />
    </>
  );
};

export default TextBlock;
