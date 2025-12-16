import React, { useRef, useMemo, useEffect, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { useNotesStore } from '@/store/notesStore';
import { useUIStore } from '@/store/uiStore';
import { Network, Maximize2 } from 'lucide-react';
import type { NoteWithChildren } from '@/types';

interface GraphNode {
  id: string;
  name: string;
  val: number;
  color: string;
}

interface GraphLink {
  source: string;
  target: string;
}

const KnowledgeGraphWidget: React.FC = () => {
  const graphRef = useRef<any>();
  const containerRef = useRef<HTMLDivElement>(null);
  const { notes } = useNotesStore();
  const { setCanvasMode } = useUIStore();
  const [isHovered, setIsHovered] = useState(false);

  // Build simplified graph data
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    const depthColors = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6'];

    const processNote = (note: NoteWithChildren, depth: number = 0, parentId?: string) => {
      // Limit depth for preview
      if (depth > 2) return;

      nodes.push({
        id: note.id,
        name: note.title || 'Untitled',
        val: Math.max(4, 10 - depth * 2),
        color: depthColors[Math.min(depth, depthColors.length - 1)],
      });

      if (parentId) {
        links.push({ source: parentId, target: note.id });
      }

      if (note.children) {
        note.children.slice(0, 3).forEach((child) => processNote(child, depth + 1, note.id));
      }
    };

    // Only process first 5 root notes for preview
    notes.slice(0, 5).forEach((note) => processNote(note, 0));

    return { nodes, links };
  }, [notes]);

  // Slow auto-rotate for preview
  useEffect(() => {
    if (!graphRef.current) return;

    let angle = 0;
    const interval = setInterval(() => {
      if (!isHovered) {
        angle += 0.003;
        graphRef.current?.cameraPosition({
          x: 200 * Math.sin(angle),
          y: 50,
          z: 200 * Math.cos(angle),
        });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isHovered]);

  const handleClick = () => {
    setCanvasMode('graph');
  };

  if (graphData.nodes.length === 0) {
    return (
      <section className="secretary-section knowledge-graph-widget">
        <h3 className="section-label">KNOWLEDGE MAP</h3>
        <div
          className="graph-widget-container graph-widget-empty"
          onClick={handleClick}
        >
          <Network className="w-8 h-8 text-gray-600" />
          <p className="text-gray-500 text-xs mt-2">Create notes to visualize</p>
        </div>
      </section>
    );
  }

  return (
    <section className="secretary-section knowledge-graph-widget">
      <div className="graph-widget-header">
        <h3 className="section-label">KNOWLEDGE MAP</h3>
        <button
          onClick={handleClick}
          className="graph-expand-btn"
          title="Open full view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div
        ref={containerRef}
        className="graph-widget-container"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData}
          width={260}
          height={160}
          backgroundColor="rgba(0,0,0,0)"
          nodeColor={(node: any) => node.color}
          nodeVal={(node: any) => node.val}
          nodeOpacity={0.9}
          linkColor={() => 'rgba(99, 102, 241, 0.3)'}
          linkWidth={0.5}
          linkOpacity={0.4}
          enableNodeDrag={false}
          enableNavigationControls={false}
          showNavInfo={false}
          d3AlphaDecay={0.05}
          d3VelocityDecay={0.4}
          warmupTicks={50}
          cooldownTicks={50}
        />
        <div className="graph-widget-overlay">
          <span className="graph-widget-hint">Click to explore</span>
        </div>
      </div>
    </section>
  );
};

export default KnowledgeGraphWidget;
