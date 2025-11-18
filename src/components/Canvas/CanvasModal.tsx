import React, { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { getBlocksByNote } from '@/utils/tauri';
import type { Block } from '@/types';

const CanvasModal: React.FC = () => {
  const { editingElement, setEditingElement, updateElement, deleteElement } = useCanvasStore();

  const [content, setContent] = useState('');
  const [color, setColor] = useState('#a78bfa');
  const [url, setUrl] = useState('');
  const [noteBlocks, setNoteBlocks] = useState<Block[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  // Drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingTool, setDrawingTool] = useState<'pen' | 'eraser'>('pen');
  const [drawingColor, setDrawingColor] = useState('#000000');

  // Initialize modal content
  useEffect(() => {
    if (editingElement) {
      setContent(editingElement.content);
      setColor(editingElement.color);
      setUrl(editingElement.content);
      setNoteBlocks([]);

      // Fetch note blocks if this is a note element with a linked note
      if (editingElement.type === 'note' && editingElement.noteId) {
        setLoadingBlocks(true);
        getBlocksByNote(editingElement.noteId)
          .then((blocks) => {
            setNoteBlocks(blocks);
          })
          .catch((error) => {
            console.error('Failed to load note blocks:', error);
          })
          .finally(() => {
            setLoadingBlocks(false);
          });
      }

      // Initialize drawing canvas
      if (editingElement.type === 'drawing' && canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Load existing drawing
          if (editingElement.drawing) {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0);
            };
            img.src = editingElement.drawing;
          }
        }
      }
    }
  }, [editingElement]);

  if (!editingElement) return null;

  const handleClose = () => {
    // Save changes
    if (editingElement.type === 'note' || editingElement.type === 'text' || editingElement.type === 'mindmap') {
      updateElement(editingElement.id, { content, color });
    } else if (editingElement.type === 'website') {
      updateElement(editingElement.id, { content: url });
    } else if (editingElement.type === 'drawing' && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL();
      updateElement(editingElement.id, { drawing: dataUrl });
    }

    setEditingElement(null);
  };

  const handleDelete = () => {
    deleteElement(editingElement.id);
    setEditingElement(null);
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
  };

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Render modal body based on element type
  const renderModalBody = () => {
    switch (editingElement.type) {
      case 'note':
        const colors = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f472b6'];

        // If this is a linked note, show full note editor
        if (editingElement.noteId) {
          return (
            <div className="flex flex-col h-full">
              <div className="mb-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">Linked Note</div>
                <div className="text-xs text-gray-500 mb-4">
                  This note is linked to your note library. Changes here are reflected in the original note.
                </div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Choose color:</div>
                <div className="flex gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleColorChange(c)}
                      className="w-8 h-8 rounded-lg transition-all"
                      style={{
                        backgroundColor: c,
                        border: color === c ? '2px solid #000' : '2px solid transparent',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Note blocks display */}
              <div className="flex-1 overflow-y-auto border-2 border-gray-300 rounded-2xl p-6">
                {loadingBlocks ? (
                  <div className="text-center text-gray-500">Loading note content...</div>
                ) : noteBlocks.length === 0 ? (
                  <div className="text-center text-gray-400">This note is empty</div>
                ) : (
                  <div className="space-y-4">
                    {noteBlocks.map((block) => {
                      const blockData = block.data as any;
                      return (
                        <div key={block.id} className="border-b border-gray-200 pb-4 last:border-0">
                          {block.type === 'heading1' && (
                            <h1 className="text-3xl font-bold text-gray-800">{blockData.content}</h1>
                          )}
                          {block.type === 'heading2' && (
                            <h2 className="text-2xl font-semibold text-gray-800">{blockData.content}</h2>
                          )}
                          {block.type === 'text' && (
                            <p className="text-base text-gray-700 whitespace-pre-wrap">{blockData.content}</p>
                          )}
                          {block.type === 'task' && (
                            <div className="space-y-2">
                              <div className="font-semibold text-gray-800">{blockData.title}</div>
                              {blockData.tasks?.map((task: any) => (
                                <div key={task.id} className="flex items-center gap-2">
                                  <input type="checkbox" checked={task.completed} readOnly />
                                  <span className={task.completed ? 'line-through text-gray-500' : 'text-gray-700'}>
                                    {task.text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {!['heading1', 'heading2', 'text', 'task'].includes(block.type) && (
                            <div className="text-gray-500 text-sm italic">
                              [{block.type} block - preview not available]
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                💡 Tip: To edit this note's content, click on it in the sidebar and switch to Note mode.
              </div>
            </div>
          );
        }

        // Regular note element (not linked)
        return (
          <div className="flex flex-col h-full">
            <div className="mb-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">Choose color:</div>
              <div className="flex gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => handleColorChange(c)}
                    className="w-8 h-8 rounded-lg transition-all"
                    style={{
                      backgroundColor: c,
                      border: color === c ? '2px solid #000' : '2px solid transparent',
                    }}
                  />
                ))}
              </div>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 p-6 border-2 border-gray-300 rounded-2xl text-lg resize-none focus:outline-none focus:border-blue-500"
              placeholder="Start typing your notes..."
            />
          </div>
        );

      case 'drawing':
        return (
          <div className="flex flex-col h-full">
            <div className="flex gap-3 mb-4 items-center">
              <button
                onClick={() => setDrawingTool('pen')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  drawingTool === 'pen'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                </svg>
                Pen
              </button>
              <button
                onClick={() => setDrawingTool('eraser')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  drawingTool === 'eraser'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
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
                className="px-4 py-2 rounded-lg bg-red-100 text-red-700 ml-auto"
              >
                Clear Canvas
              </button>
            </div>
            <canvas
              ref={canvasRef}
              className="flex-1 border-2 border-gray-300 rounded-2xl bg-white cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>
        );

      case 'text':
        return (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full p-6 border-2 border-gray-300 rounded-2xl text-base resize-none focus:outline-none focus:border-blue-500"
            placeholder="Type your text content here..."
          />
        );

      case 'website':
        return (
          <div className="flex flex-col h-full">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="p-4 border-2 border-gray-300 rounded-xl text-base mb-4 focus:outline-none focus:border-blue-500"
            />
            <div className="flex-1 bg-gray-100 rounded-2xl flex items-center justify-center">
              <div className="text-center text-gray-500">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-3">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <div>Enter a valid URL to preview the website</div>
                <div className="text-xs mt-2">(Preview feature coming soon)</div>
              </div>
            </div>
          </div>
        );

      case 'mindmap':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-xl">
              <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-6">
                <circle cx="12" cy="12" r="3"></circle>
                <circle cx="19" cy="6" r="2"></circle>
                <circle cx="19" cy="18" r="2"></circle>
                <circle cx="5" cy="6" r="2"></circle>
                <circle cx="5" cy="18" r="2"></circle>
                <line x1="14" y1="11" x2="17.5" y2="7.5"></line>
                <line x1="14" y1="13" x2="17.5" y2="16.5"></line>
                <line x1="10" y1="11" x2="6.5" y2="7.5"></line>
                <line x1="10" y1="13" x2="6.5" y2="16.5"></line>
              </svg>
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Central Idea..."
                className="w-full p-6 border-2 border-purple-300 rounded-2xl text-center text-3xl font-bold focus:outline-none focus:border-purple-500"
              />
              <p className="text-gray-500 mt-4">Use the arrow tool (connector) to link to other blocks</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getModalTitle = () => {
    switch (editingElement.type) {
      case 'note':
        return 'Note Block';
      case 'drawing':
        return 'Drawing Block';
      case 'text':
        return 'Text Block';
      case 'website':
        return 'Website Block';
      case 'mindmap':
        return 'Mind Map Block';
      default:
        return 'Edit';
    }
  };

  const getModalSubtitle = () => {
    switch (editingElement.type) {
      case 'note':
        return 'Full notepad for your ideas';
      case 'drawing':
        return 'Full canvas for drawing and sketching';
      case 'text':
        return 'Large text area for paragraphs';
      case 'website':
        return 'Embed and preview websites';
      case 'mindmap':
        return 'Central idea and connections';
      default:
        return '';
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="bg-white rounded-3xl flex flex-col shadow-2xl" style={{ width: '90vw', height: '90vh' }}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">{getModalTitle()}</h2>
            <p className="text-sm text-gray-600 mt-1">{getModalSubtitle()}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-8 overflow-y-auto">
          {renderModalBody()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-3xl flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-medium transition-colors"
          >
            Delete
          </button>
          <button
            onClick={handleClose}
            className="px-8 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default CanvasModal;
