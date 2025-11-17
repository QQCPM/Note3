import React from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import type { CanvasToolType } from '@/types/canvas';
import {
  Hand,
  MousePointer,
  ArrowRight,
  StickyNote,
  Pencil,
  Type,
  Network,
  Globe,
} from 'lucide-react';

interface Tool {
  type: CanvasToolType;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}

const tools: Tool[] = [
  { type: 'hand', icon: <Hand size={18} />, label: 'Hand Tool', shortcut: 'H' },
  { type: 'cursor', icon: <MousePointer size={18} />, label: 'Select', shortcut: 'V' },
  { type: 'arrow', icon: <ArrowRight size={18} />, label: 'Arrow', shortcut: 'A' },
  { type: 'note', icon: <StickyNote size={18} />, label: 'Note', shortcut: 'N' },
  { type: 'drawing', icon: <Pencil size={18} />, label: 'Draw', shortcut: 'D' },
  { type: 'text', icon: <Type size={18} />, label: 'Text', shortcut: 'T' },
  { type: 'mindmap', icon: <Network size={18} />, label: 'Mindmap', shortcut: 'M' },
  { type: 'website', icon: <Globe size={18} />, label: 'Website', shortcut: 'W' },
];

const CanvasToolbar: React.FC = () => {
  const { activeTool, setActiveTool } = useCanvasStore();

  const handleToolClick = (tool: CanvasToolType) => {
    setActiveTool(tool);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toUpperCase();
      const tool = tools.find(t => t.shortcut === key);
      if (tool) {
        e.preventDefault();
        setActiveTool(tool.type);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool]);

  return (
    <div className="canvas-toolbar">
      <div className="canvas-toolbar-inner">
        {tools.map((tool) => (
          <button
            key={tool.type}
            className={`canvas-tool-btn ${activeTool === tool.type ? 'active' : ''}`}
            onClick={() => handleToolClick(tool.type)}
            title={`${tool.label} (${tool.shortcut})`}
            aria-label={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CanvasToolbar;
