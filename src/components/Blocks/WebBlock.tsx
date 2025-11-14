import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, RefreshCw, Maximize2, X } from 'lucide-react';
import { updateBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import type { Block, WebBlockData } from '@/types';

interface WebBlockProps {
  block: Block;
}

const WebBlock: React.FC<WebBlockProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore } = useBlocksStore();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(400);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Parse block data
  useEffect(() => {
    const data = block.data as WebBlockData;
    setUrl(data.url || '');
    setTitle(data.title || '');
    setWidth(data.width || 800);
    setHeight(data.height || 400);
  }, [block.data]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    setErrorMessage(
      'This website cannot be embedded. It may have security restrictions (X-Frame-Options).'
    );
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setHasError(false);
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank');
  };

  const handleUpdateHeight = async (newHeight: number) => {
    setHeight(newHeight);
    try {
      const data = block.data as WebBlockData;
      const newData: WebBlockData = { ...data, height: newHeight };
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update block height:', error);
    }
  };

  const handleUpdateWidth = async (newWidth: number) => {
    setWidth(newWidth);
    try {
      const data = block.data as WebBlockData;
      const newData: WebBlockData = { ...data, width: newWidth };
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update block width:', error);
    }
  };

  const handleUpdateTitle = async (newTitle: string) => {
    setTitle(newTitle);
    try {
      const data = block.data as WebBlockData;
      const newData: WebBlockData = { ...data, title: newTitle };
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update block title:', error);
    }
  };

  const isValidUrl = (urlString: string) => {
    try {
      const parsedUrl = new URL(urlString);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  };

  if (!isValidUrl(url)) {
    return (
      <div className="canvas-block">
        <div className="block-handle">⋮⋮</div>
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 text-center">
          <div className="text-red-400 mb-2">⚠️ Invalid URL</div>
          <div className="text-sm text-gray-400">
            Please provide a valid HTTP or HTTPS URL
          </div>
          <div className="text-xs text-gray-500 mt-2 font-mono break-all">
            {url}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="canvas-block" style={{ maxWidth: `${width}px` }}>
        <div className="block-handle">⋮⋮</div>
        <div
          className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-4"
          style={{ marginTop: '16px', marginBottom: '16px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={title || 'Web View'}
                onChange={(e) => handleUpdateTitle(e.target.value)}
                className="text-sm font-semibold bg-transparent border-none outline-none text-white"
                placeholder="Enter title..."
              />
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                Web
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="p-1.5 text-xs bg-white/5 hover:bg-white/10 rounded transition-all"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 text-xs bg-white/5 hover:bg-white/10 rounded transition-all"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleOpenExternal}
                className="p-1.5 text-xs bg-white/5 hover:bg-white/10 rounded transition-all"
                title="Open in browser"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* URL Bar */}
          <div className="mb-3 flex items-center gap-2 text-xs text-gray-400 bg-[#0d1117] rounded px-3 py-2 border border-[#30363d]">
            <span>🔗</span>
            <span className="flex-1 truncate font-mono">{url}</span>
          </div>

          {/* iframe Container */}
          <div className="relative bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden">
            {isLoading && !hasError && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-[#0d1117]"
                style={{ height: `${height}px` }}
              >
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <div className="text-sm text-gray-400">Loading...</div>
                </div>
              </div>
            )}

            {hasError && (
              <div
                className="flex flex-col items-center justify-center bg-[#0d1117] p-8"
                style={{ height: `${height}px` }}
              >
                <div className="text-red-400 text-4xl mb-4">⚠️</div>
                <div className="text-sm font-semibold text-white mb-2">
                  Cannot Display Website
                </div>
                <div className="text-xs text-gray-400 text-center max-w-md mb-4">
                  {errorMessage}
                </div>
                <button
                  onClick={handleOpenExternal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-all flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in External Browser
                </button>
              </div>
            )}

            <iframe
              ref={iframeRef}
              src={url}
              className="w-full border-0"
              style={{ height: `${height}px`, display: hasError ? 'none' : 'block' }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
              onLoad={handleLoad}
              onError={handleError}
              title={title || 'Web View'}
            />
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

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col"
          onClick={() => setIsFullscreen(false)}
        >
          <div className="flex items-center justify-between p-4 bg-[#161b22] border-b border-[#30363d]">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-white">
                {title || 'Web View'}
              </span>
              <span className="text-xs text-gray-400 font-mono">{url}</span>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2 hover:bg-white/10 rounded transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <iframe
            src={url}
            className="flex-1 w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
            title={title || 'Web View'}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default WebBlock;
