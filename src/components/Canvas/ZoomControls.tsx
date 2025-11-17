import React from 'react';
import { useCanvasStore } from '@/store/canvasStore';

const ZoomControls: React.FC = () => {
  const { zoom, setZoom } = useCanvasStore();

  const zoomIn = () => {
    setZoom(Math.min(2.0, zoom + 0.1));
  };

  const zoomOut = () => {
    setZoom(Math.max(0.5, zoom - 0.1));
  };

  const resetZoom = () => {
    setZoom(1.0);
  };

  return (
    <div className="absolute bottom-6 right-6 z-20">
      <div
        className="flex flex-col gap-1 p-2 rounded-xl shadow-lg"
        style={{
          background: 'rgba(22, 27, 34, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #30363d',
        }}
      >
        {/* Zoom In */}
        <button
          onClick={zoomIn}
          title="Zoom In"
          className="p-2 rounded-lg transition-all bg-transparent text-gray-400 hover:bg-gray-800 hover:text-white"
          disabled={zoom >= 2.0}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>

        {/* Zoom Reset */}
        <button
          onClick={resetZoom}
          title="Reset Zoom"
          className="py-1 px-2 rounded-lg transition-all bg-transparent text-gray-400 hover:bg-gray-800 hover:text-white text-xs font-semibold"
        >
          {Math.round(zoom * 100)}%
        </button>

        {/* Zoom Out */}
        <button
          onClick={zoomOut}
          title="Zoom Out"
          className="p-2 rounded-lg transition-all bg-transparent text-gray-400 hover:bg-gray-800 hover:text-white"
          disabled={zoom <= 0.5}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ZoomControls;
