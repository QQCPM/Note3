import React, { useState, useRef, useEffect } from 'react';
import type { CanvasElement as CanvasElementType } from '@/store/canvasStore';
import { useCanvasStore } from '@/store/canvasStore';

interface CanvasElementModalProps {
  element: CanvasElementType | null;
  onClose: () => void;
}

const CanvasElementModal: React.FC<CanvasElementModalProps> = ({ element, onClose }) => {
  const { updateElement, deleteElement } = useCanvasStore();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#fef3c7');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingTool, setDrawingTool] = useState<'pen' | 'eraser'>('pen');
  const [drawingColor, setDrawingColor] = useState('#000000');

  useEffect(() => {
    if (element && element.type === 'note') {
      setTitle(element.label || '');
      setContent(element.content || '');
      setColor(element.color || '#fef3c7');
    } else if (element && element.type === 'text') {
      setContent(element.content || '');
    }
  }, [element]);

  if (!element) return null;

  const handleSave = () => {
    if (element.type === 'note') {
      updateElement(element.id, {
        label: title,
        content,
        color,
      });
    } else if (element.type === 'text') {
      updateElement(element.id, {
        content,
      });
    } else if (element.type === 'drawing' && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL();
      updateElement(element.id, {
        drawing: dataUrl,
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this element?')) {
      deleteElement(element.id);
      onClose();
    }
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
  };

  // Drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      if (drawingTool === 'pen') {
        ctx.strokeStyle = drawingColor;
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 20;
      }
      ctx.lineCap = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.closePath();
      }
    }
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  useEffect(() => {
    if (element.type === 'drawing' && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Load existing drawing if available
        if (element.drawing) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
          img.src = element.drawing;
        }
      }
    }
  }, [element]);

  const renderModalBody = () => {
    switch (element.type) {
      case 'note':
        return (
          <div className="h-full flex flex-col gap-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-white outline-none focus:border-[#58a6ff]"
              placeholder="Title"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-white outline-none focus:border-[#58a6ff] resize-none"
              placeholder="Start typing your notes..."
            />
          </div>
        );

      case 'drawing':
        return (
          <div className="h-full flex flex-col gap-4">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className="flex-1 border-2 border-[#30363d] rounded-lg bg-white cursor-crosshair"
            />
          </div>
        );

      case 'text':
        return (
          <div className="h-full flex flex-col">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-6 py-4 text-white text-lg outline-none focus:border-[#58a6ff] resize-none"
              placeholder="Type your text content here..."
            />
          </div>
        );

      case 'mindmap':
        return (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-6xl mb-4">🗺️</div>
              <p>Mindmap editing coming soon!</p>
              <p className="text-sm mt-2">Use the canvas to create connections between elements</p>
            </div>
          </div>
        );

      case 'website':
        return (
          <div className="h-full flex flex-col gap-4">
            <input
              type="url"
              value={element.content || ''}
              onChange={(e) =>
                updateElement(element.id, {
                  content: e.target.value,
                })
              }
              className="bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-white outline-none focus:border-[#58a6ff]"
              placeholder="https://example.com"
            />
            <div className="flex-1 bg-[#f3f4f6] rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-600">
                <div className="text-6xl mb-4">🌐</div>
                <p>Website preview</p>
                <p className="text-sm mt-2">(Preview feature coming soon)</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      {/* Main Container - Immersive */}
      <div
        className="relative w-[95vw] h-[95vh] bg-[#010409] rounded-3xl shadow-2xl border border-[#30363d] overflow-hidden flex flex-col group"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Floating Header Controls - Glassmorphic */}
        <div className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center pointer-events-none">
          {/* Title/Type Badge */}
          <div className="pointer-events-auto">
            <div className="flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-md bg-[#161b22]/80 border border-white/10 shadow-lg">
              <span className="text-sm font-medium text-gray-400 uppercase tracking-wider text-xs">
                {element.type}
              </span>
              <div className="w-px h-4 bg-white/10"></div>
              <span className="font-semibold text-gray-200">
                {element.label || 'Untitled'}
              </span>
            </div>
          </div>

          {/* Central Tools Section (Colors, Drawing Tools, etc.) */}
          <div className="pointer-events-auto flex items-center gap-3">
            {/* Note Colors */}
            {element.type === 'note' && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-md bg-[#161b22]/80 border border-white/10 shadow-lg">
                {['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f472b6'].map((c) => (
                  <button
                    key={c}
                    onClick={() => handleColorChange(c)}
                    className="w-6 h-6 rounded-full transition-all hover:scale-110"
                    style={{
                      background: c,
                      border: color === c ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: color === c ? '0 0 0 1px rgba(0,0,0,0.2)' : 'none',
                    }}
                    title="Change color"
                  />
                ))}
              </div>
            )}

            {/* Drawing Tools */}
            {element.type === 'drawing' && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-md bg-[#161b22]/80 border border-white/10 shadow-lg">
                <button
                  onClick={() => setDrawingTool('pen')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${drawingTool === 'pen' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                >
                  Pen
                </button>
                <button
                  onClick={() => setDrawingTool('eraser')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${drawingTool === 'eraser' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                >
                  Eraser
                </button>
                <div className="w-px h-4 bg-white/10 mx-1"></div>
                <input
                  type="color"
                  value={drawingColor}
                  onChange={(e) => setDrawingColor(e.target.value)}
                  className="w-6 h-6 rounded-full cursor-pointer bg-transparent border-none p-0"
                  title="Drawing Color"
                />
                <div className="w-px h-4 bg-white/10 mx-1"></div>
                <button
                  onClick={clearCanvas}
                  className="px-3 py-1.5 rounded-full text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Close Button */}
          <div className="pointer-events-auto">
            <button
              onClick={onClose}
              className="flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-md bg-[#161b22]/80 border border-white/10 shadow-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              title="Close (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {/* Add padding to account for floating controls */}
          <div className="h-full w-full p-6 pt-20 pb-24 overflow-y-auto custom-scrollbar">
            {renderModalBody()}
          </div>
        </div>

        {/* Floating Footer Controls - Glassmorphic */}
        <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-4 px-2 py-2 rounded-full backdrop-blur-md bg-[#161b22]/90 border border-white/10 shadow-2xl transform transition-all hover:scale-105">

            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Delete
            </button>

            <div className="w-px h-6 bg-white/10"></div>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-full hover:bg-gray-200 transition-all font-semibold text-sm shadow-lg shadow-white/5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanvasElementModal;
