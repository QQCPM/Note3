import React, { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { useNotesStore } from '@/store/notesStore';
import { useUIStore } from '@/store/uiStore';
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2, RotateCcw, Focus, Pause, Play } from 'lucide-react';
import type { NoteWithChildren } from '@/types';

interface GraphNode {
  id: string;
  name: string;
  val: number;
  color: string;
  depth: number;
  hasChildren: boolean;
  groupId: string; // Root note ID this node belongs to
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
  isInterGroup: boolean; // Connection between different groups
}

// Group color palette - each root note gets a distinct color family
const groupColors = [
  { primary: '#8b5cf6', light: '#a78bfa', dim: '#4c1d95' }, // Purple
  { primary: '#3b82f6', light: '#60a5fa', dim: '#1e3a8a' }, // Blue
  { primary: '#10b981', light: '#34d399', dim: '#064e3b' }, // Emerald
  { primary: '#f59e0b', light: '#fbbf24', dim: '#78350f' }, // Amber
  { primary: '#ef4444', light: '#f87171', dim: '#7f1d1d' }, // Red
  { primary: '#ec4899', light: '#f472b6', dim: '#831843' }, // Pink
  { primary: '#06b6d4', light: '#22d3ee', dim: '#164e63' }, // Cyan
  { primary: '#84cc16', light: '#a3e635', dim: '#365314' }, // Lime
];

// Cache for geometries and materials
const geometryCache = new Map<number, THREE.SphereGeometry>();
const materialCache = new Map<string, THREE.MeshBasicMaterial>();

const getGeometry = (size: number): THREE.SphereGeometry => {
  const key = Math.round(size * 10);
  if (!geometryCache.has(key)) {
    geometryCache.set(key, new THREE.SphereGeometry(size, 16, 12));
  }
  return geometryCache.get(key)!;
};

const getMaterial = (color: string, opacity: number = 0.9): THREE.MeshBasicMaterial => {
  const key = `${color}-${opacity}`;
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
    }));
  }
  return materialCache.get(key)!;
};

const KnowledgeGraph3D: React.FC = () => {
  const graphRef = useRef<any>();
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const angleRef = useRef(0);

  const { notes, setActiveNote } = useNotesStore();
  const { setCanvasMode } = useUIStore();

  const [focusedNode, setFocusedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());

  // Resize handler
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    const debouncedUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateDimensions, 100);
    };
    updateDimensions();
    window.addEventListener('resize', debouncedUpdate);
    return () => {
      window.removeEventListener('resize', debouncedUpdate);
      clearTimeout(timeoutId);
    };
  }, []);

  // Build graph data with groups
  const { graphData, groupMap } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const groupMap = new Map<string, { color: typeof groupColors[0]; nodeCount: number }>();

    let groupIndex = 0;

    const processNote = (
      note: NoteWithChildren,
      depth: number = 0,
      parentId?: string,
      rootGroupId?: string
    ) => {
      // First level notes define groups
      const groupId = rootGroupId || note.id;

      // Assign group color if new group
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          color: groupColors[groupIndex % groupColors.length],
          nodeCount: 0,
        });
        groupIndex++;
      }

      const group = groupMap.get(groupId)!;
      group.nodeCount++;

      const hasChildren = Boolean(note.children && note.children.length > 0);

      // Color based on depth within group
      const depthFactor = Math.min(depth, 3) / 3;
      const nodeColor = depth === 0
        ? group.color.primary
        : lerpColor(group.color.primary, group.color.light, depthFactor * 0.5);

      nodes.push({
        id: note.id,
        name: note.title || 'Untitled',
        val: Math.max(5, 14 - depth * 2),
        color: nodeColor,
        depth,
        hasChildren,
        groupId,
      });

      if (parentId) {
        const parentNode = nodes.find(n => n.id === parentId);
        const isInterGroup = parentNode?.groupId !== groupId;

        links.push({
          source: parentId,
          target: note.id,
          value: isInterGroup ? 0.15 : Math.max(0.4, 1 - depth * 0.2),
          isInterGroup,
        });
      }

      if (note.children) {
        note.children.forEach((child) =>
          processNote(child, depth + 1, note.id, groupId)
        );
      }
    };

    notes.forEach((note) => processNote(note, 0));

    // Add hub node if multiple groups
    if (notes.length > 1) {
      nodes.push({
        id: '__hub__',
        name: 'Knowledge Hub',
        val: 20,
        color: '#f472b6',
        depth: -1,
        hasChildren: true,
        groupId: '__hub__',
      });

      // Connect root notes to hub with very thin lines
      notes.forEach((note) => {
        links.push({
          source: '__hub__',
          target: note.id,
          value: 0.2,
          isInterGroup: true,
        });
      });
    }

    return { graphData: { nodes, links }, groupMap };
  }, [notes]);

  // Helper: lerp between two hex colors
  function lerpColor(color1: string, color2: string, t: number): string {
    const c1 = parseInt(color1.slice(1), 16);
    const c2 = parseInt(color2.slice(1), 16);

    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  // Update highlights when node is focused
  useEffect(() => {
    if (!focusedNode) {
      setHighlightLinks(new Set());
      setHighlightNodes(new Set());
      return;
    }

    const connectedLinks = new Set<string>();
    const connectedNodes = new Set<string>([focusedNode.id]);

    graphData.links.forEach((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;

      if (sourceId === focusedNode.id || targetId === focusedNode.id) {
        connectedLinks.add(`${sourceId}-${targetId}`);
        connectedNodes.add(sourceId);
        connectedNodes.add(targetId);
      }
    });

    setHighlightLinks(connectedLinks);
    setHighlightNodes(connectedNodes);
  }, [focusedNode, graphData.links]);

  // Camera animation
  useEffect(() => {
    if (!graphRef.current || !isAutoRotating) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = () => {
      angleRef.current += 0.002;
      const distance = 380;
      if (graphRef.current) {
        graphRef.current.cameraPosition({
          x: distance * Math.sin(angleRef.current),
          y: 60,
          z: distance * Math.cos(angleRef.current),
        });
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isAutoRotating]);

  // Node rendering with highlight state
  const nodeThreeObject = useCallback((node: GraphNode) => {
    const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
    const isFocused = focusedNode?.id === node.id;

    const size = isFocused ? node.val / 4 : node.val / 5;
    const opacity = isHighlighted ? 0.92 : 0.15;

    const geometry = getGeometry(size);
    const material = getMaterial(node.color, opacity);

    return new THREE.Mesh(geometry, material);
  }, [focusedNode, highlightNodes]);

  // Link styling with highlight
  const linkWidth = useCallback((link: GraphLink) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    const linkId = `${sourceId}-${targetId}`;

    const isHighlighted = highlightLinks.has(linkId);

    if (highlightLinks.size > 0) {
      // When something is focused
      return isHighlighted ? 2.5 : (link.isInterGroup ? 0.1 : 0.2);
    }

    // Normal state
    return link.isInterGroup ? 0.3 : 0.8;
  }, [highlightLinks]);

  const linkColor = useCallback((link: GraphLink) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    const linkId = `${sourceId}-${targetId}`;

    const isHighlighted = highlightLinks.has(linkId);

    if (highlightLinks.size > 0) {
      if (isHighlighted) {
        // Bright highlight color
        return 'rgba(167, 139, 250, 0.9)'; // Light purple
      }
      // Dimmed
      return link.isInterGroup
        ? 'rgba(99, 102, 241, 0.03)'
        : 'rgba(99, 102, 241, 0.06)';
    }

    // Normal state
    return link.isInterGroup
      ? 'rgba(99, 102, 241, 0.12)'
      : 'rgba(99, 102, 241, 0.35)';
  }, [highlightLinks]);

  // Focus on node
  const focusOnNode = useCallback((node: GraphNode) => {
    if (!graphRef.current) return;

    setFocusedNode(node);
    setIsAutoRotating(false);

    const distance = 100;
    const nodePos = { x: node.x || 0, y: node.y || 0, z: node.z || 0 };
    const dist = Math.hypot(nodePos.x, nodePos.y, nodePos.z) || 1;
    const ratio = 1 + distance / dist;

    graphRef.current.cameraPosition(
      { x: nodePos.x * ratio, y: nodePos.y * ratio, z: nodePos.z * ratio },
      nodePos,
      1000
    );
  }, []);

  // Handle node click
  const handleNodeClick = useCallback((node: GraphNode) => {
    if (node.id === '__hub__') {
      resetCamera();
      return;
    }
    focusOnNode(node);
  }, [focusOnNode]);

  // Reset camera
  const resetCamera = useCallback(() => {
    if (!graphRef.current) return;
    setFocusedNode(null);
    setIsAutoRotating(true);
    angleRef.current = 0;
    graphRef.current.cameraPosition({ x: 0, y: 0, z: 380 }, { x: 0, y: 0, z: 0 }, 800);
  }, []);

  // Zoom controls
  const zoomIn = useCallback(() => {
    if (!graphRef.current) return;
    const camera = graphRef.current.camera();
    const pos = camera.position;
    const ratio = 0.7;
    graphRef.current.cameraPosition(
      { x: pos.x * ratio, y: pos.y * ratio, z: pos.z * ratio },
      undefined,
      400
    );
  }, []);

  const zoomOut = useCallback(() => {
    if (!graphRef.current) return;
    const camera = graphRef.current.camera();
    const pos = camera.position;
    const ratio = 1.4;
    graphRef.current.cameraPosition(
      { x: pos.x * ratio, y: pos.y * ratio, z: pos.z * ratio },
      undefined,
      400
    );
  }, []);

  const fitToView = useCallback(() => {
    if (!graphRef.current) return;
    graphRef.current.zoomToFit(800, 60);
    setFocusedNode(null);
  }, []);

  const toggleRotation = useCallback(() => {
    setIsAutoRotating(prev => !prev);
  }, []);

  // Get unique groups for legend
  const groups = useMemo(() => {
    const result: { id: string; name: string; color: string }[] = [];
    graphData.nodes.forEach(node => {
      if (node.depth === 0 && node.id !== '__hub__') {
        const group = groupMap.get(node.groupId);
        if (group) {
          result.push({ id: node.id, name: node.name, color: group.color.primary });
        }
      }
    });
    return result;
  }, [graphData.nodes, groupMap]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#08080c] overflow-hidden">
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#08080c"
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={(node: GraphNode) => `${node.name}${node.depth === 0 ? ' (Group)' : ''}`}
        linkWidth={linkWidth}
        linkColor={linkColor}
        linkOpacity={1}
        linkCurvature={0.08}
        linkDirectionalParticles={0}
        onNodeClick={handleNodeClick}
        onNodeHover={(node) => {
          document.body.style.cursor = node ? 'pointer' : 'default';
        }}
        onBackgroundClick={() => {
          setFocusedNode(null);
        }}
        enableNodeDrag={false}
        enableNavigationControls={true}
        showNavInfo={false}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.35}
        warmupTicks={40}
        cooldownTicks={60}
      />

      {/* Back Button */}
      <div className="absolute top-4 left-4">
        <button
          onClick={() => setCanvasMode('note')}
          className="flex items-center gap-2 px-3 py-2 bg-[#12141a]/95 backdrop-blur-sm border border-[#252830] rounded-lg text-gray-300 hover:text-white hover:border-[#8b5cf6] transition-all"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">Back</span>
        </button>
      </div>

      {/* Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-1 bg-[#12141a]/95 backdrop-blur-sm border border-[#252830] rounded-lg p-1">
        <button onClick={zoomIn} className="p-2 text-gray-400 hover:text-white hover:bg-[#252830] rounded transition-all" title="Zoom In">
          <ZoomIn size={18} />
        </button>
        <button onClick={zoomOut} className="p-2 text-gray-400 hover:text-white hover:bg-[#252830] rounded transition-all" title="Zoom Out">
          <ZoomOut size={18} />
        </button>
        <div className="h-px bg-[#252830] my-1" />
        <button onClick={fitToView} className="p-2 text-gray-400 hover:text-white hover:bg-[#252830] rounded transition-all" title="Fit to View">
          <Maximize2 size={18} />
        </button>
        <button onClick={resetCamera} className="p-2 text-gray-400 hover:text-white hover:bg-[#252830] rounded transition-all" title="Reset">
          <RotateCcw size={18} />
        </button>
        <div className="h-px bg-[#252830] my-1" />
        <button
          onClick={toggleRotation}
          className={`p-2 rounded transition-all ${isAutoRotating ? 'text-[#8b5cf6] bg-[#8b5cf6]/10' : 'text-gray-400 hover:text-white hover:bg-[#252830]'}`}
          title={isAutoRotating ? 'Pause Rotation' : 'Resume Rotation'}
        >
          {isAutoRotating ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>

      {/* Focused Node Info */}
      {focusedNode && focusedNode.id !== '__hub__' && (
        <div className="absolute bottom-6 left-6 max-w-xs bg-[#12141a]/98 backdrop-blur-sm border border-[#252830] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full ring-2 ring-white/20" style={{ backgroundColor: focusedNode.color }} />
            <h3 className="text-white font-medium truncate">{focusedNode.name}</h3>
          </div>
          <p className="text-gray-500 text-xs mb-3">
            {focusedNode.depth === 0 ? 'Group Root' : `Level ${focusedNode.depth}`}
            {focusedNode.hasChildren && ' • Has children'}
          </p>
          <button
            onClick={() => {
              setActiveNote(focusedNode.id);
              setCanvasMode('note');
            }}
            className="flex items-center gap-2 w-full px-3 py-2 bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 rounded-lg text-[#a78bfa] hover:bg-[#8b5cf6]/25 transition-all text-sm"
          >
            <Focus size={14} />
            Open Note
          </button>
        </div>
      )}

      {/* Groups Legend */}
      <div className="absolute top-4 right-4 bg-[#12141a]/95 backdrop-blur-sm border border-[#252830] rounded-xl p-3 max-w-[180px]">
        <h4 className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 font-medium">Groups</h4>
        <div className="flex flex-col gap-1.5">
          {groups.slice(0, 6).map((group) => (
            <div
              key={group.id}
              className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all ${focusedNode?.groupId === group.id
                ? 'bg-white/5'
                : 'hover:bg-white/5'
                }`}
              onClick={() => {
                const node = graphData.nodes.find(n => n.id === group.id);
                if (node) focusOnNode(node);
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: group.color, boxShadow: `0 0 6px ${group.color}40` }}
              />
              <span className="text-gray-400 text-xs truncate">{group.name}</span>
            </div>
          ))}
          {groups.length > 6 && (
            <span className="text-gray-600 text-[10px] px-2">+{groups.length - 6} more</span>
          )}
        </div>
        {focusedNode && (
          <button
            onClick={resetCamera}
            className="mt-3 w-full text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            Click background to clear
          </button>
        )}
      </div>

      {/* Empty State */}
      {graphData.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#12141a] flex items-center justify-center border border-[#252830]">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-white font-medium mb-2">No Knowledge Yet</h3>
            <p className="text-gray-600 text-sm">Create notes to build your knowledge graph</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraph3D;
