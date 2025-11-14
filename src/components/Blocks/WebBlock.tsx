import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, RefreshCw, Maximize2, X } from 'lucide-react';
import type { Block, WebBlockData } from '@/types';
import BlockLayoutControls from '@/components/Blocks/BlockLayoutControls';
import ResizableBlock from '@/components/Blocks/ResizableBlock';

interface WebBlockProps {
  block: Block;
}

const WebBlock: React.FC<WebBlockProps> = ({ block }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
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

  const isValidUrl = (urlString: string) => {
    try {
      const parsedUrl = new URL(urlString);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Convert YouTube URLs to embeddable format
  const getEmbeddableUrl = (urlString: string): string => {
    try {
      const parsedUrl = new URL(urlString);
      
      // YouTube watch URL: youtube.com/watch?v=VIDEO_ID
      if (parsedUrl.hostname.includes('youtube.com') && parsedUrl.pathname === '/watch') {
        const videoId = parsedUrl.searchParams.get('v');
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }
      }
      
      // YouTube short URL: youtu.be/VIDEO_ID
      if (parsedUrl.hostname === 'youtu.be') {
        const videoId = parsedUrl.pathname.slice(1); // Remove leading '/'
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }
      }
      
      // Return original URL if not YouTube or already embed format
      return urlString;
    } catch {
      return urlString;
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setHasError(false);
    if (iframeRef.current) {
      iframeRef.current.src = getEmbeddableUrl(url);
    }
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank');
  };

  if (!isValidUrl(url)) {
    return (
      <div className="p-4 text-center bg-[#0d1117] rounded border border-red-500/30">
        <div className="text-red-400 mb-2">⚠️ Invalid URL</div>
        <div className="text-xs text-gray-400">{url}</div>
      </div>
    );
  }

  return (
    <>
      <ResizableBlock block={block}>
        <div className="relative h-full">
          {/* Glassmorphic floating control pill - Hidden until hover */}
          <div className="absolute top-3 right-3 z-10 opacity-0 group-hover/block:opacity-100 transition-opacity duration-200 pointer-events-none">
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full backdrop-blur-sm bg-white/[0.03] border border-white/20 shadow-xl pointer-events-auto">
              <button
                onClick={handleRefresh}
                className="p-1.5 hover:bg-white/20 rounded-full transition-all"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-gray-700" />
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 hover:bg-white/20 rounded-full transition-all"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4 text-gray-700" />
              </button>
              <button
                onClick={handleOpenExternal}
                className="p-1.5 hover:bg-white/20 rounded-full transition-all"
                title="Open in browser"
              >
                <ExternalLink className="w-4 h-4 text-gray-700" />
              </button>
              <div className="h-4 w-px bg-gray-400 mx-1"></div>
              <BlockLayoutControls block={block} />
            </div>
          </div>

          {/* iframe Container - Fills full space */}
          <div className="relative bg-[#0d1117] rounded overflow-hidden border border-[#21262d] h-full w-full">
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}

          {hasError && (
            <div className="flex flex-col items-center justify-center bg-[#0d1117] p-6 h-full">
              <div className="text-red-400 text-2xl mb-2">⚠️</div>
              <div className="text-xs text-gray-400 mb-3">{errorMessage}</div>
              <button
                onClick={handleOpenExternal}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-all flex items-center gap-1.5"
              >
                <ExternalLink className="w-3 h-3" />
                Open in Browser
              </button>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={getEmbeddableUrl(url)}
            className="w-full h-full border-0"
            style={{ display: hasError ? 'none' : 'block' }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
            onLoad={handleLoad}
            onError={handleError}
            title={title || 'Web View'}
          />
          </div>
        </div>
      </ResizableBlock>

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
            src={getEmbeddableUrl(url)}
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
