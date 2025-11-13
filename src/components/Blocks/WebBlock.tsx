import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, RefreshCw, Maximize2, X } from 'lucide-react';
import { updateBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import type { Block } from '@/types';

interface WebBlockProps {
  block: Block;
}

const WebBlock: React.FC<WebBlockProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore } = useBlocksStore();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [height, setHeight] = useState(400);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'iframe' | 'preview'>('iframe');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Parse block data
  useEffect(() => {
    try {
      const data = JSON.parse(block.data);
      const parsedUrl = data.url || '';
      setUrl(parsedUrl);
      setTitle(data.title || '');
      setHeight(data.height || 400);
      
      // Pre-detect known non-embeddable sites
      if (parsedUrl && isKnownNonEmbeddable(parsedUrl)) {
        setViewMode('preview');
        setHasError(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to parse block data:', error);
    }
  }, [block.data]);

  // Check if URL is from a site known to block embedding
  const isKnownNonEmbeddable = (urlString: string): boolean => {
    try {
      const parsedUrl = new URL(urlString);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      // Known sites that block embedding with X-Frame-Options or CSP
      const blockedDomains = [
        'facebook.com',
        'medium.com',
        'geeksforgeeks.org', // Blocks embedding on blog posts
        'twitter.com',
        'x.com',
        'instagram.com',
        'linkedin.com',
        'tiktok.com',
        'reddit.com',
        'netflix.com',
        'amazon.com',
        'apple.com',
        'microsoft.com',
      ];
      
      return blockedDomains.some(domain => hostname.includes(domain));
    } catch {
      return false;
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    setViewMode('preview'); // Switch to preview mode on error
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setHasError(false);
    if (iframeRef.current) {
      iframeRef.current.src = getEmbeddableUrl(url);
    }
  };

  const handleOpenExternal = async () => {
    try {
      // Use Tauri's shell plugin to open URL in system browser
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } catch (error) {
      // Fallback to window.open if Tauri API is not available
      console.warn('Tauri shell API not available, using fallback:', error);
      window.open(url, '_blank');
    }
  };

  const handleUpdateHeight = async (newHeight: number) => {
    setHeight(newHeight);
    try {
      const data = JSON.parse(block.data);
      const newData = JSON.stringify({ ...data, height: newHeight });
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update block height:', error);
    }
  };

  const handleUpdateTitle = async (newTitle: string) => {
    setTitle(newTitle);
    try {
      const data = JSON.parse(block.data);
      const newData = JSON.stringify({ ...data, title: newTitle });
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

  // Convert URLs to embeddable format
  const getEmbeddableUrl = (urlString: string): string => {
    try {
      const parsedUrl = new URL(urlString);
      
      // YouTube video URLs
      if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be')) {
        let videoId = '';
        
        // Handle youtube.com/watch?v=VIDEO_ID
        if (parsedUrl.hostname.includes('youtube.com') && parsedUrl.pathname === '/watch') {
          videoId = parsedUrl.searchParams.get('v') || '';
        }
        // Handle youtu.be/VIDEO_ID
        else if (parsedUrl.hostname.includes('youtu.be')) {
          videoId = parsedUrl.pathname.slice(1);
        }
        // Handle youtube.com/embed/VIDEO_ID (already embeddable)
        else if (parsedUrl.pathname.startsWith('/embed/')) {
          return urlString;
        }
        
        if (videoId) {
          // Preserve timestamp if present
          const timestamp = parsedUrl.searchParams.get('t');
          const embedUrl = `https://www.youtube.com/embed/${videoId}`;
          return timestamp ? `${embedUrl}?start=${timestamp}` : embedUrl;
        }
      }
      
      // Vimeo URLs
      if (parsedUrl.hostname.includes('vimeo.com')) {
        const videoId = parsedUrl.pathname.split('/').filter(Boolean)[0];
        if (videoId && !parsedUrl.pathname.includes('/video/')) {
          return `https://player.vimeo.com/video/${videoId}`;
        }
      }
      
      // Twitter/X URLs
      if (parsedUrl.hostname.includes('twitter.com') || parsedUrl.hostname.includes('x.com')) {
        // Twitter embeds work better with their widget
        return urlString;
      }
      
      // Default: return original URL
      return urlString;
    } catch {
      return urlString;
    }
  };

  // Detect embed type for display
  const getEmbedType = (urlString: string): string => {
    try {
      const parsedUrl = new URL(urlString);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      // Video platforms
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        return '📺 YouTube';
      }
      if (hostname.includes('vimeo.com')) {
        return '🎬 Vimeo';
      }
      
      // Social media
      if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        return '🐦 Twitter/X';
      }
      
      // Educational/Technical sites
      if (hostname.includes('geeksforgeeks.org')) {
        return '📚 GeeksforGeeks';
      }
      if (hostname.includes('stackoverflow.com') || hostname.includes('stackexchange.com')) {
        return '💡 StackOverflow';
      }
      if (hostname.includes('github.com')) {
        return '⚡ GitHub';
      }
      if (hostname.includes('wikipedia.org')) {
        return '📖 Wikipedia';
      }
      if (hostname.includes('medium.com')) {
        return '✍️ Medium';
      }
      if (hostname.includes('dev.to')) {
        return '👨‍💻 Dev.to';
      }
      
      // Documentation sites
      if (hostname.includes('docs.') || hostname.includes('documentation.')) {
        return '📄 Docs';
      }
      
      return '🌐 Web';
    } catch {
      return '🌐 Web';
    }
  };

  if (!isValidUrl(url)) {
    return (
      <div className="canvas-block">
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
      <div className="canvas-block">
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
                {getEmbedType(url)}
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

            {hasError && viewMode === 'preview' && (
              <div className="flex items-center justify-between bg-[#161b22] border border-yellow-500/20 rounded px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🔒</span>
                  <span className="text-xs text-gray-400">Cannot embed this site</span>
                </div>
                <button
                  onClick={handleOpenExternal}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-all inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open
                </button>
              </div>
            )}

            {/* Only render iframe if not in preview mode */}
            {viewMode === 'iframe' && !isKnownNonEmbeddable(url) && (
              <iframe
                ref={iframeRef}
                src={getEmbeddableUrl(url)}
                className="w-full border-0"
                style={{ height: `${height}px`, display: hasError ? 'none' : 'block' }}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
                onLoad={handleLoad}
                onError={handleError}
                title={title || 'Web View'}
              />
            )}
          </div>

          {/* Height Control */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">Height:</span>
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
