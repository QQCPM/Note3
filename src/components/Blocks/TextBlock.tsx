import React, { useState, useRef, useEffect } from 'react';
import { updateBlock, createBlock } from '@/utils/tauri';
import { useBlocksStore, useNotesStore } from '@/store';
import type { Block, TextBlockData } from '@/types';
import SlashCommandMenu from '@/components/Canvas/SlashCommandMenu';
import AIPromptModal from '@/components/Canvas/AIPromptModal';
import RichTextRenderer from './RichTextRenderer';
import { nanoid } from 'nanoid';

interface TextBlockProps {
  block: Block;
}

const TextBlock: React.FC<TextBlockProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore, addBlock } = useBlocksStore();
  const { activeNoteId } = useNotesStore();

  const data = block.data as TextBlockData;
  const [content, setContent] = useState(data.content || '');
  const [isEditing, setIsEditing] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
  const [slashQuery, setSlashQuery] = useState('');
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiModalType, setAIModalType] = useState<'artifact' | 'database' | 'web' | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  // Check if content has LaTeX formulas
  const hasLatex = content.includes('$');

  // Sync content with block data
  useEffect(() => {
    const blockData = block.data as TextBlockData;
    setContent(blockData.content || '');
  }, [block.data]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && isEditing) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content, isEditing]);

  // Auto-focus on empty blocks (newly created)
  useEffect(() => {
    if (content === '') {
      setIsEditing(true);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  }, []);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

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
      const newData: TextBlockData = { type: 'text', content: newContent };
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
    if (e.key === 'Escape') {
      if (showSlashMenu) {
        e.preventDefault();
        setShowSlashMenu(false);
        setSlashQuery('');
      } else {
        // Exit edit mode on Escape
        setIsEditing(false);
      }
    }
  };

  const handleBlur = () => {
    // Exit edit mode when clicking outside (after a delay to allow slash menu interaction)
    setTimeout(() => {
      if (!showSlashMenu) {
        setIsEditing(false);
      }
    }, 150);
  };

  const handleViewClick = () => {
    setIsEditing(true);
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
            type: 'task',
            title: '',
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
        data: blockData,
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

      if (type === 'web') {
        // For web type, prompt is the URL
        const blockData: import('@/types').WebBlockData = {
          type: 'web',
          url: prompt.trim(),
          title: '',
          height: 400,
        };

        const newBlock = await createBlock({
          note_id: activeNoteId,
          type: 'web',
          position: block.position + 1,
          data: blockData,
        });

        addBlock(newBlock);
      } else if (type === 'artifact') {
        // First create placeholder block
        const placeholderData: import('@/types').ArtifactBlockData = {
          type: 'artifact',
          prompt,
          title: 'Generating...',
          html: '<div style="padding: 40px; text-align: center;"><h2>Generating artifact...</h2><p>Please wait while AI creates your artifact.</p></div>',
          css: 'body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; color: white; }',
          javascript: '',
        };

        const placeholderBlock = await createBlock({
          note_id: activeNoteId,
          type: 'artifact',
          position: block.position + 1,
          data: placeholderData,
        });

        addBlock(placeholderBlock);

        // TODO: Generate actual artifact with AI
        console.log('AI artifact generation not yet connected');
      } else if (type === 'database') {
        // Generate database structure
        const blockData: import('@/types').DatabaseBlockData = {
          type: 'database',
          title: 'Database',
          columns: [
            { id: nanoid(), name: 'Name', type: 'text' },
            { id: nanoid(), name: 'Status', type: 'select', options: ['Todo', 'In Progress', 'Done'] },
          ],
          rows: [], // Start with empty rows
          view: 'table' as const,
        };

        const newBlock = await createBlock({
          note_id: activeNoteId,
          type: 'database',
          position: block.position + 1,
          data: blockData,
        });

        addBlock(newBlock);
      }
    } catch (error) {
      console.error('Failed to create AI block:', error);
    }
  };

  return (
    <>
      <div className="canvas-block text-block">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="Type '/' for commands..."
            rows={1}
            className="w-full"
          />
        ) : (
          <div
            ref={viewRef}
            onClick={handleViewClick}
            className="cursor-text min-h-[32px] px-2 py-1 rounded hover:bg-[#161b22] transition-colors"
          >
            {content && hasLatex ? (
              <RichTextRenderer content={content} />
            ) : (
              <div className="text-gray-400 whitespace-pre-wrap">
                {content || "Click to edit..."}
              </div>
            )}
          </div>
        )}
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
