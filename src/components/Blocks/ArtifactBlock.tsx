import React, { useState } from 'react';
import type { Block } from '@/types';
import BlockLayoutControls from '@/components/Blocks/BlockLayoutControls';
import ResizableBlock from '@/components/Blocks/ResizableBlock';
import { Code2 } from 'lucide-react';

interface ArtifactBlockProps {
  block: Block;
}

const ArtifactBlock: React.FC<ArtifactBlockProps> = ({ block }) => {
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [fullCode, setFullCode] = useState('');

  // Extract artifact data from block
  const artifactData = block.data as any;
  const html = artifactData.html || '';
  const css = artifactData.css || '';
  const javascript = artifactData.javascript || '';
  const title = artifactData.title || 'Artifact';

  // Initialize edited values when modal opens - combine all code
  const openCodeEditor = () => {
    const combined = `<!-- HTML -->\n${html}\n\n/* CSS */\n${css}\n\n// JavaScript\n${javascript}`;
    setFullCode(combined);
    setShowCodeEditor(true);
  };

  // Parse the combined code back into sections
  const parseFullCode = (code: string) => {
    // Simple parser - split by section markers
    const htmlMatch = code.match(/<!-- HTML -->\n([\s\S]*?)(?=\n\n\/\* CSS \*\/|$)/);
    const cssMatch = code.match(/\/\* CSS \*\/\n([\s\S]*?)(?=\n\n\/\/ JavaScript|$)/);
    const jsMatch = code.match(/\/\/ JavaScript\n([\s\S]*?)$/);

    return {
      html: htmlMatch ? htmlMatch[1].trim() : html,
      css: cssMatch ? cssMatch[1].trim() : css,
      javascript: jsMatch ? jsMatch[1].trim() : javascript,
    };
  };

  // Save edited code
  const handleSaveCode = async () => {
    try {
      const { updateBlock } = await import('@/utils/tauri');
      const { useBlocksStore } = await import('@/store');

      const parsed = parseFullCode(fullCode);

      const updatedData = {
        ...artifactData,
        html: parsed.html,
        css: parsed.css,
        javascript: parsed.javascript,
      };

      await updateBlock(block.id, updatedData);
      useBlocksStore.getState().updateBlock(block.id, { data: updatedData });

      setShowCodeEditor(false);
      console.log('✅ Artifact code updated successfully');
    } catch (error) {
      console.error('❌ Failed to update artifact code:', error);
      alert('Failed to save changes: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Construct complete HTML document with injected CSS and JS
  const iframeSrcDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Reset and base styles */
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
    }
    /* User's custom CSS */
    ${css}
  </style>
</head>
<body>
  ${html}
  <script>
    // Wrap in try-catch for safety
    try {
      ${javascript}
    } catch (error) {
      console.error('Artifact script error:', error);
    }
  </script>
</body>
</html>`;

  // Handle Escape key to close modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCodeEditor) {
        setShowCodeEditor(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCodeEditor]);

  return (
    <>
    <ResizableBlock block={block}>
      <div className="relative h-full">
        {/* Glassmorphic floating control pill - Hidden until hover */}
        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover/block:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full backdrop-blur-sm bg-white/[0.03] border border-white/20 shadow-xl pointer-events-auto">
            <button
              onClick={openCodeEditor}
              className="px-2.5 py-1 text-xs hover:bg-white/20 rounded-full transition-all text-gray-300 flex items-center gap-1.5"
              title="View/Edit Code"
            >
              <Code2 size={14} />
              <span>Code</span>
            </button>
            <div className="h-4 w-px bg-gray-400 mx-1"></div>
            <BlockLayoutControls block={block} />
          </div>
        </div>

        {/* Artifact Container - Clean design without title bar */}
        <div className="bg-[#0d1117] rounded overflow-hidden border border-[#21262d] h-full w-full">
          <iframe
            className="w-full h-full"
            sandbox="allow-scripts"
            srcDoc={iframeSrcDoc}
          ></iframe>
        </div>
      </div>
    </ResizableBlock>

      {/* Code Editor Modal - ONE Simple Box */}
      {showCodeEditor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d]">
              <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2">
                <Code2 size={18} className="text-purple-400" />
                {title}
              </h2>
              <button
                onClick={() => setShowCodeEditor(false)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Single Code Editor */}
            <div className="flex-1 p-6">
              <textarea
                value={fullCode}
                onChange={(e) => setFullCode(e.target.value)}
                className="w-full h-full bg-[#161b22] text-gray-300 font-mono text-sm p-4 rounded border border-[#30363d] focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none"
                placeholder="<!-- HTML -->\n<div>Your code here...</div>\n\n/* CSS */\n.container { }\n\n// JavaScript\nconsole.log('Hello!');"
                spellCheck={false}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#30363d]">
              <button
                onClick={() => setShowCodeEditor(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCode}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ArtifactBlock;
