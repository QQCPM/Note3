import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import type { CanvasElement as CanvasElementType } from '@/types/canvas';
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
    if (element && element.data.type === 'note') {
      setTitle(element.data.title || '');
      setContent(element.data.content || '');
      setColor(element.data.color || '#fef3c7');
    } else if (element && element.data.type === 'text') {
      setContent(element.data.content || '');
    }
  }, [element]);

  if (!element) return null;

  const handleSave = () => {
    if (element.data.type === 'note') {
      updateElement(element.id, {
        data: {
          ...element.data,
          title,
          content,
          color,
        },
      });
    } else if (element.data.type === 'text') {
      updateElement(element.id, {
        data: {
          ...element.data,
          content,
        },
      });
    } else if (element.data.type === 'drawing' && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL();
      updateElement(element.id, {
        data: {
          ...element.data,
          paths: [{ type: 'image', data: dataUrl }],
        },
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
    if (element.data.type === 'drawing' && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Load existing drawing if available
        if (element.data.paths && element.data.paths.length > 0) {
          const firstPath = element.data.paths[0];
          if (firstPath.type === 'image') {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0);
            };
            img.src = firstPath.data;
          }
        }
      }
    }
  }, [element]);

  const renderModalBody = () => {
    switch (element.data.type) {
      case 'note':
        return (
          <div className="h-full flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold text-gray-400 mb-2">Choose color:</div>
              <div className="flex gap-2">
                {['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f472b6'].map((c) => (
                  <button
                    key={c}
                    onClick={() => handleColorChange(c)}
                    className="w-8 h-8 rounded-lg transition-all"
                    style={{
                      background: c,
                      border: color === c ? '3px solid #fff' : '3px solid transparent',
                    }}
                  />
                ))}
              </div>
            </div>
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
            <div className="flex gap-3 items-center">
              <button
                onClick={() => setDrawingTool('pen')}
                className={`px-4 py-2 rounded-lg ${
                  drawingTool === 'pen' ? 'bg-blue-600 text-white' : 'bg-[#161b22] text-gray-400'
                }`}
              >
                Pen
              </button>
              <button
                onClick={() => setDrawingTool('eraser')}
                className={`px-4 py-2 rounded-lg ${
                  drawingTool === 'eraser' ? 'bg-blue-600 text-white' : 'bg-[#161b22] text-gray-400'
                }`}
              >
                Eraser
              </button>
              <input
                type="color"
                value={drawingColor}
                onChange={(e) => setDrawingColor(e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer"
              />
              <button
                onClick={clearCanvas}
                className="px-4 py-2 rounded-lg bg-red-600 text-white ml-auto"
              >
                Clear Canvas
              </button>
            </div>
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
              value={element.data.url || ''}
              onChange={(e) =>
                updateElement(element.id, {
                  data: { ...element.data, url: e.target.value },
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
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '90vw', width: '90vw', maxHeight: '90vh', height: '90vh' }}
      >
        <div className="modal-header">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 capitalize">
              {element.data.type} Block
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Full screen editing mode
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X size={24} />
          </button>
        </div>
        <div className="modal-body" style={{ flex: 1 }}>
          {renderModalBody()}
        </div>
        <div className="modal-footer">
          <button
            onClick={handleDelete}
            className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-medium transition-all"
          >
            Delete
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default CanvasElementModal;
