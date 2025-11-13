import React, { useState, useEffect } from 'react';
import { updateBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import type { Block } from '@/types';

interface ArtifactBlockProps {
  block: Block;
}

interface ArtifactData {
  title?: string;
  prompt?: string;
  html: string;
  css: string;
  javascript: string;
}

const ArtifactBlock: React.FC<ArtifactBlockProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore } = useBlocksStore();
  const [data, setData] = useState<ArtifactData>({
    html: '',
    css: '',
    javascript: '',
  });
  const [showCodeEditor, setShowCodeEditor] = useState(false);

  // Parse block data
  useEffect(() => {
    try {
      const parsed = JSON.parse(block.data);
      setData(parsed);
    } catch (error) {
      console.error('Failed to parse artifact block data:', error);
    }
  }, [block.data]);

  // Build iframe srcdoc
  const buildSrcDoc = () => {
    return `<!DOCTYPE html>
<html>
<head>
<style>
${data.css}
</style>
</head>
<body>
${data.html}
<script>
${data.javascript}
</script>
</body>
</html>`;
  };

  const handleEditCode = () => {
    // TODO: Open code editor modal
    console.log('Edit code for artifact:', block.id);
    alert('Code editor will open here. This will allow you to edit HTML, CSS, and JavaScript.');
  };

  const handleAskAI = () => {
    // TODO: Open AI prompt to regenerate
    console.log('Ask AI to regenerate artifact:', block.id);
    alert('AI will help regenerate this artifact based on a new prompt.');
  };

  return (
    <div className="canvas-block artifact-block">
      <div className="block-handle">⋮⋮</div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">
            {data.title || 'Live Artifact'}
          </span>
          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
            Interactive
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEditCode}
            className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 rounded transition-colors"
          >
            Edit Code
          </button>
          <button
            onClick={handleAskAI}
            className="px-3 py-1 text-xs bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded transition-colors"
          >
            Ask AI
          </button>
        </div>
      </div>
      <iframe
        className="artifact-preview w-full"
        sandbox="allow-scripts"
        srcDoc={buildSrcDoc()}
        title="Artifact Preview"
      ></iframe>
      {data.prompt && (
        <div className="mt-2 text-xs text-gray-500 italic">
          Generated from: "{data.prompt}"
        </div>
      )}
    </div>
  );
};

export default ArtifactBlock;
