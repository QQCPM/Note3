import React from 'react';
import type { Block, ArtifactBlockData } from '@/types';
import BlockLayoutControls from '@/components/Blocks/BlockLayoutControls';
import ResizableBlock from '@/components/Blocks/ResizableBlock';

interface ArtifactBlockProps {
  block: Block;
}

const ArtifactBlock: React.FC<ArtifactBlockProps> = ({ block }) => {
  const artifactData = block.data as ArtifactBlockData;

  // Build complete HTML document from block data
  const iframeSrcDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
    }
    ${artifactData.css || ''}
  </style>
</head>
<body>
  ${artifactData.html || '<div style="padding: 20px; color: #999;">No artifact content</div>'}
  <script>
    try {
      ${artifactData.javascript || ''}
    } catch (error) {
      document.body.innerHTML = '<div style="color: red; padding: 20px;">Error: ' + error.message + '</div>';
    }
  </script>
</body>
</html>`;

  return (
    <ResizableBlock block={block}>
      <div className="relative h-full">
        {/* Glassmorphic floating control pill - Hidden until hover */}
        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover/block:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full backdrop-blur-sm bg-white/[0.03] border border-white/20 shadow-xl pointer-events-auto">
            <button className="px-2.5 py-1 text-xs hover:bg-white/20 rounded-full transition-all text-gray-700">
              Edit
            </button>
            <div className="h-4 w-px bg-gray-400 mx-1"></div>
            <BlockLayoutControls block={block} />
          </div>
        </div>

        {/* Artifact Container - Fills full space */}
        <div className="bg-[#0d1117] rounded overflow-hidden border border-[#21262d] h-full w-full">
          <iframe
            className="w-full h-full"
            sandbox="allow-scripts"
            srcDoc={iframeSrcDoc}
            title={artifactData.title || 'Artifact'}
          />
        </div>
      </div>
    </ResizableBlock>
  );
};

export default ArtifactBlock;
