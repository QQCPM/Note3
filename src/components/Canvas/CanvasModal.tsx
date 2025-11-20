import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { getBlocksByNote } from '@/utils/tauri';
import type { Block } from '@/types';
import TextBlock from '@/components/Blocks/TextBlock';
import HeadingBlock from '@/components/Blocks/HeadingBlock';
import TaskBlock from '@/components/Blocks/TaskBlock';
import WebBlock from '@/components/Blocks/WebBlock';
import ErrorBoundary from '@/components/ErrorBoundary';

// Lazy load heavy components
const DatabaseBlock = lazy(() => import('@/components/Blocks/DatabaseBlock'));
const ArtifactBlock = lazy(() => import('@/components/Blocks/ArtifactBlock'));

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
        // If this is a linked note, show full note view
        if (editingElement.noteId) {
          return (
            <div className="flex flex-col h-full">
              {/* Note blocks display - Full note view like note mode */}
              <div className="flex-1 overflow-y-auto bg-[#0d1117] rounded-xl">
                {loadingBlocks ? (
                  <div className="flex-1 flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-gray-600 border-t-purple-500 rounded-full animate-spin"></div>
                      <div className="text-gray-400 text-sm">Loading...</div>
                    </div>
                  </div>
                ) : noteBlocks.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center py-12">
                    <div className="text-center text-gray-400">This note is empty</div>
                  </div>
                ) : (
                  <div className="max-w-[90%] mx-auto py-8 px-8">
                    <div className="flex flex-col gap-4">
                      {noteBlocks.map((block) => (
                        <div key={block.id} className="w-full">
                          <ErrorBoundary>
                            {block.type === 'text' && <TextBlock block={block} />}
                            {(block.type === 'heading1' || block.type === 'heading2') && <HeadingBlock block={block} />}
                            {block.type === 'database' && (
                              <Suspense fallback={
                                <div className="canvas-block p-4 bg-[#161b22] rounded border border-[#30363d] animate-pulse">
                                  <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <div className="w-4 h-4 border-2 border-gray-600 border-t-purple-500 rounded-full animate-spin"></div>
                                    <span>Loading...</span>
                                  </div>
                                </div>
                              }>
                                <DatabaseBlock block={block} />
                              </Suspense>
                            )}
                            {block.type === 'artifact' && (
                              <Suspense fallback={
                                <div className="canvas-block p-4 bg-[#161b22] rounded border border-[#30363d] animate-pulse">
                                  <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <div className="w-4 h-4 border-2 border-gray-600 border-t-purple-500 rounded-full animate-spin"></div>
                                    <span>Loading...</span>
                                  </div>
                                </div>
                              }>
                                <ArtifactBlock block={block} />
                              </Suspense>
                            )}
                            {block.type === 'task' && <TaskBlock block={block} />}
                            {block.type === 'web' && <WebBlock block={block} />}
                          </ErrorBoundary>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }

        // Regular note element (not linked)
        return (
          <div className="flex flex-col h-full">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 p-6 bg-[#0d1117] border-2 border-[#30363d] rounded-xl text-lg text-gray-300 resize-none focus:outline-none focus:border-blue-500"
              placeholder="Start typing your notes..."
            />
          </div>
        );

      case 'drawing':
        return (
          <div className="flex flex-col h-full">
            <canvas
              ref={canvasRef}
              className="flex-1 border-2 border-[#30363d] rounded-xl bg-white cursor-crosshair"
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
            className="w-full h-full p-6 bg-[#0d1117] border-2 border-[#30363d] rounded-xl text-base text-gray-300 resize-none focus:outline-none focus:border-blue-500"
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
              className="p-4 bg-[#0d1117] border-2 border-[#30363d] rounded-xl text-base text-gray-300 mb-4 focus:outline-none focus:border-blue-500"
            />
            <div className="flex-1 bg-[#0d1117] border-2 border-[#30363d] rounded-xl flex items-center justify-center">
              <div className="text-center text-gray-400">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-3 opacity-50">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <div className="text-base">Enter a URL to preview</div>
                <div className="text-xs mt-2 text-gray-500">(Preview coming soon)</div>
              </div>
            </div>
          </div>
        );

      case 'mindmap':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-xl">
              <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-6 text-purple-400">
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
                className="w-full p-6 bg-[#0d1117] border-2 border-purple-500 rounded-xl text-center text-3xl font-bold text-gray-200 focus:outline-none focus:border-purple-400"
              />
              <p className="text-gray-400 mt-4 text-sm">Use the arrow tool to connect to other blocks</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getModalTitle = () => {
    // Show the label if it exists, otherwise show a generic title
    if (editingElement.label) {
      return editingElement.label;
    }
    switch (editingElement.type) {
      case 'note':
        return 'Note';
      case 'drawing':
        return 'Drawing';
      case 'text':
        return 'Text';
      case 'website':
        return 'Website';
      case 'mindmap':
        return 'Mind Map';
      default:
        return 'View';
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Main Container - Immersive */}
      <div className="relative w-[95vw] h-[95vh] bg-[#010409] rounded-3xl shadow-2xl border border-[#30363d] overflow-hidden flex flex-col group">

        {/* Floating Header Controls - Glassmorphic */}
        <div className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center pointer-events-none">
          {/* Title/Type Badge */}
          <div className="pointer-events-auto">
            <div className="flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-md bg-[#161b22]/80 border border-white/10 shadow-lg">
              <span className="text-sm font-medium text-gray-400 uppercase tracking-wider text-xs">
                {editingElement.type}
              </span>
              <div className="w-px h-4 bg-white/10"></div>
              <span className="font-semibold text-gray-200">
                {getModalTitle()}
              </span>
            </div>
          </div>

          {/* Central Tools Section (Colors, Drawing Tools, etc.) */}
          <div className="pointer-events-auto flex items-center gap-3">
            {/* Note Colors */}
            {editingElement.type === 'note' && !editingElement.noteId && (
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
            {editingElement.type === 'drawing' && (
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
              onClick={handleClose}
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
              onClick={handleClose}
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

export default CanvasModal;
