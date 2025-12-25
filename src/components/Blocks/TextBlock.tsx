import React, { useState, useRef, useEffect, useMemo } from 'react';
import { updateBlock, createBlock } from '@/utils/tauri';
import { useBlocksStore, useNotesStore, useAIStore } from '@/store';
import type { Block, TextBlockData } from '@/types';
import SlashCommandMenu from '@/components/Canvas/SlashCommandMenu';
import AIPromptModal from '@/components/Canvas/AIPromptModal';
import AIEditPanel from '@/components/AI/AIEditPanel';
import RichTextRenderer from './RichTextRenderer';
import { SelectionToolbar } from '@/components/RootNode';
import { nanoid } from 'nanoid';
import { Sparkles } from 'lucide-react';

interface TextBlockProps {
  block: Block;
}

const TextBlock: React.FC<TextBlockProps> = React.memo(({ block }) => {
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
  const [showAIEditPanel, setShowAIEditPanel] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const blockContainerRef = useRef<HTMLDivElement>(null);

  const { enterEditMode } = useAIStore();

  // Check if content has markdown or LaTeX (memoized to avoid recalculation)
  const hasMarkdownOrLatex = useMemo(() =>
    content.includes('$') ||
    content.includes('#') ||
    content.includes('**') ||
    content.includes('- ') ||
    content.includes('```') ||
    content.length > 100, // Long content likely needs markdown rendering
  [content]);

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

  // Auto-focus ONLY on newly created empty blocks (not all empty blocks on load)
  // This prevents lag when loading notes with many blocks
  const isNewBlock = useRef(content === '' && (block.data as TextBlockData).content === '');
  useEffect(() => {
    if (isNewBlock.current && content === '') {
      setIsEditing(true);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
      isNewBlock.current = false;
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

  const handleOpenAIEdit = () => {
    enterEditMode(block.id);
    setShowAIEditPanel(true);
  };

  const handleCloseAIEdit = () => {
    setShowAIEditPanel(false);
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
          customHeight: 400,
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

        // Generate actual artifact with AI
        try {
          const { tauriAI } = await import('@/services/tauriAI');
          const result = await tauriAI.generateArtifact(prompt);

          // Update block with generated artifact
          const artifactData: import('@/types').ArtifactBlockData = {
            type: 'artifact',
            prompt,
            title: result.title,
            html: result.html,
            css: result.css,
            javascript: result.javascript,
          };

          // Update the placeholder block
          const { updateBlock } = await import('@/utils/tauri');
          await updateBlock(placeholderBlock.id, artifactData);

          // Update local store
          const { useBlocksStore } = await import('@/store');
          useBlocksStore.getState().updateBlock(placeholderBlock.id, { data: artifactData });

          console.log('✅ Artifact generated successfully:', result.title);
        } catch (error) {
          console.error('❌ Failed to generate artifact:', error);

          // Update with error message
          const errorData: import('@/types').ArtifactBlockData = {
            type: 'artifact',
            prompt,
            title: 'Generation Failed',
            html: `<div style="padding: 40px; text-align: center;">
                     <h2>❌ Failed to Generate</h2>
                     <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
                     <p style="margin-top: 20px; font-size: 14px; opacity: 0.7;">Try again with a different prompt</p>
                   </div>`,
            css: 'body { font-family: Arial, sans-serif; background: #2d1b2e; min-height: 100vh; display: flex; align-items: center; justify-content: center; color: white; }',
            javascript: '',
          };

          const { updateBlock } = await import('@/utils/tauri');
          await updateBlock(placeholderBlock.id, errorData);

          const { useBlocksStore } = await import('@/store');
          useBlocksStore.getState().updateBlock(placeholderBlock.id, { data: errorData });
        }
      } else if (type === 'database') {
        // First create placeholder block
        const placeholderData: import('@/types').DatabaseBlockData = {
          type: 'database',
          title: 'Generating...',
          columns: [
            { id: nanoid(), name: 'Loading', type: 'text' },
          ],
          rows: [],
          view: 'table' as const,
        };

        const placeholderBlock = await createBlock({
          note_id: activeNoteId,
          type: 'database',
          position: block.position + 1,
          data: placeholderData,
        });

        addBlock(placeholderBlock);

        // Generate actual database with AI
        try {
          const { tauriAI } = await import('@/services/tauriAI');
          const result = await tauriAI.generateDatabase(prompt);

          // Convert AI result to our format with IDs
          const columns = result.columns.map(col => ({
            id: nanoid(),
            name: col.name,
            type: col.column_type as any,
            options: col.options,
          }));

          const databaseData: import('@/types').DatabaseBlockData = {
            type: 'database',
            title: result.title,
            columns,
            rows: result.rows || [],
            view: 'table' as const,
          };

          // Update the placeholder block
          const { updateBlock } = await import('@/utils/tauri');
          await updateBlock(placeholderBlock.id, databaseData);

          // Update local store
          const { useBlocksStore } = await import('@/store');
          useBlocksStore.getState().updateBlock(placeholderBlock.id, { data: databaseData });

          console.log('✅ Database generated successfully:', result.title);
        } catch (error) {
          console.error('❌ Failed to generate database:', error);

          // Update with error message
          const errorColId = nanoid();
          const errorData: import('@/types').DatabaseBlockData = {
            type: 'database',
            title: 'Generation Failed',
            columns: [
              { id: errorColId, name: 'Error', type: 'text' },
            ],
            rows: [
              {
                id: nanoid(),
                data: {
                  [errorColId]: error instanceof Error ? error.message : 'Unknown error'
                }
              },
            ],
            view: 'table' as const,
          };

          const { updateBlock } = await import('@/utils/tauri');
          await updateBlock(placeholderBlock.id, errorData);

          const { useBlocksStore } = await import('@/store');
          useBlocksStore.getState().updateBlock(placeholderBlock.id, { data: errorData });
        }
      }
    } catch (error) {
      console.error('Failed to create AI block:', error);
    }
  };

  return (
    <>
      <div
        ref={blockContainerRef}
        data-block-id={block.id}
        className="canvas-block text-block relative group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* AI Edit Button - Appears on hover */}
        {isHovered && !isEditing && (
          <button
            onClick={handleOpenAIEdit}
            className="absolute -right-2 -top-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-medium rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100"
            title="Ask AI to Edit"
          >
            <Sparkles size={12} />
            <span>AI Edit</span>
          </button>
        )}

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
            {content && hasMarkdownOrLatex ? (
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

      {/* AI Edit Panel */}
      {showAIEditPanel && (
        <AIEditPanel blockId={block.id} onClose={handleCloseAIEdit} />
      )}

      {/* Selection Toolbar for creating Root Node definitions - works in both modes */}
      {activeNoteId && (
        <SelectionToolbar
          containerRef={blockContainerRef}
          noteId={activeNoteId}
          blockId={block.id}
        />
      )}
    </>
  );
}, (prevProps, nextProps) => {
  // Only re-render if block data actually changed
  return prevProps.block.id === nextProps.block.id &&
         prevProps.block.data === nextProps.block.data;
});

export default TextBlock;
