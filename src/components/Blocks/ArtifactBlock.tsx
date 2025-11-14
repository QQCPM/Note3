import React from 'react';
import type { Block } from '@/types';
import BlockLayoutControls from '@/components/Blocks/BlockLayoutControls';
import ResizableBlock from '@/components/Blocks/ResizableBlock';

interface ArtifactBlockProps {
  block: Block;
}

const ArtifactBlock: React.FC<ArtifactBlockProps> = ({ block }) => {

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
    <ResizableBlock block={block}>
      <div className="relative h-full">
        {/* Glassmorphic floating control pill - Hidden until hover */}
        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover/block:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full backdrop-blur-sm bg-white/[0.03] border border-white/20 shadow-xl pointer-events-auto">
            <button className="px-2.5 py-1 text-xs hover:bg-white/20 rounded-full transition-all text-gray-700">Edit</button>
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
        ></iframe>
        </div>
      </div>
    </ResizableBlock>
  );
};

export default ArtifactBlock;
