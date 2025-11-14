import React, { useState, useEffect } from 'react';
import { updateBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import type { Block, ArtifactBlockData } from '@/types';

interface ArtifactBlockProps {
  block: Block;
}

const ArtifactBlock: React.FC<ArtifactBlockProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore } = useBlocksStore();
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(400);

  // Parse block data
  useEffect(() => {
    const data = block.data as ArtifactBlockData;
    setWidth(data.width || 800);
    setHeight(data.height || 400);
  }, [block.data]);

  const handleUpdateWidth = async (newWidth: number) => {
    setWidth(newWidth);
    try {
      const data = block.data as ArtifactBlockData;
      const newData: ArtifactBlockData = { ...data, width: newWidth };
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update block width:', error);
    }
  };

  const handleUpdateHeight = async (newHeight: number) => {
    setHeight(newHeight);
    try {
      const data = block.data as ArtifactBlockData;
      const newData: ArtifactBlockData = { ...data, height: newHeight };
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update block height:', error);
    }
  };

  const iframeSrcDoc = `<!DOCTYPE html>
<html>
<head>
<style>
body {
  margin: 0;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: Arial, sans-serif;
}
.container {
  text-align: center;
  color: white;
}
.neural-net {
  margin: 30px 0;
}
.layer {
  display: inline-flex;
  flex-direction: column;
  gap: 20px;
  margin: 0 30px;
}
.neuron {
  width: 50px;
  height: 50px;
  background: rgba(255, 255, 255, 0.2);
  border: 3px solid white;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s;
}
.neuron:hover {
  background: rgba(255, 255, 255, 0.4);
  transform: scale(1.2);
}
</style>
</head>
<body>
  <div class='container'>
    <h2>Neural Network Layers</h2>
    <div class='neural-net'>
      <div class='layer'>
        <div class='neuron'></div>
        <div class='neuron'></div>
        <div class='neuron'></div>
      </div>
      <div class='layer'>
        <div class='neuron'></div>
        <div class='neuron'></div>
      </div>
      <div class='layer'>
        <div class='neuron'></div>
      </div>
    </div>
    <p>Click neurons to activate</p>
  </div>
  <script>
    document.querySelectorAll('.neuron').forEach(neuron => {
      neuron.addEventListener('click', () => {
        neuron.style.background = 'rgba(255, 255, 255, 0.6)';
        setTimeout(() => {
          neuron.style.background = 'rgba(255, 255, 255, 0.2)';
        }, 500);
      });
    });
  </script>
</body>
</html>`;

  return (
    <div className="canvas-block artifact-block" style={{ maxWidth: `${width}px` }}>
      <div className="block-handle">⋮⋮</div>
      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Live Artifact</span>
            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">Interactive</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 rounded">Edit Code</button>
            <button className="px-3 py-1 text-xs bg-purple-500/20 text-purple-300 rounded">Ask AI</button>
          </div>
        </div>
        <div className="bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden">
          <iframe
            className="w-full"
            style={{ height: `${height}px` }}
            sandbox="allow-scripts"
            srcDoc={iframeSrcDoc}
          ></iframe>
        </div>
        {/* Size Controls */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12">Width:</span>
            <input
              type="range"
              min="400"
              max="1200"
              step="50"
              value={width}
              onChange={(e) => handleUpdateWidth(parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-gray-400 font-mono w-16">
              {width}px
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12">Height:</span>
            <input
              type="range"
              min="200"
              max="800"
              step="50"
              value={height}
              onChange={(e) => handleUpdateHeight(parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-gray-400 font-mono w-16">
              {height}px
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtifactBlock;
