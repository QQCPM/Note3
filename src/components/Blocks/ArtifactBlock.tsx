import React from 'react';

const ArtifactBlock: React.FC = () => {
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
    <div className="canvas-block artifact-block">
      <div className="block-handle">⋮⋮</div>
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
      <iframe
        className="artifact-preview w-full"
        sandbox="allow-scripts"
        srcDoc={iframeSrcDoc}
      ></iframe>
    </div>
  );
};

export default ArtifactBlock;
