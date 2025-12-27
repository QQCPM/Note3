import React, { useRef, useMemo, useEffect, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { Network, Maximize2 } from 'lucide-react';

interface ProjectGraphProps {
    projectId: string;
}

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

const ProjectGraph: React.FC<ProjectGraphProps> = ({ projectId }) => {
    const graphRef = useRef<any>();
    const { buildTree } = useProjectStore();
    const { setCanvasMode } = useUIStore();
    const [isHovered, setIsHovered] = useState(false);

    const tree = buildTree(projectId);

    // Build graph data from project tree
    const graphData = useMemo(() => {
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];
        const depthColors = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6'];

        const processItem = (item: any, depth: number = 0, parentId?: string) => {
            if (depth > 3) return;

            nodes.push({
                id: item.id,
                name: item.name || 'Untitled',
                val: Math.max(4, 10 - depth * 2),
                color: depthColors[Math.min(depth, depthColors.length - 1)],
            });

            if (parentId) {
                links.push({ source: parentId, target: item.id });
            }

            if (item.children) {
                item.children.slice(0, 5).forEach((child: any) =>
                    processItem(child, depth + 1, item.id)
                );
            }
        };

        tree.slice(0, 8).forEach((item) => processItem(item, 0));

        return { nodes, links };
    }, [tree]);

    // Auto-rotate
    useEffect(() => {
        if (!graphRef.current) return;

        let angle = 0;
        const interval = setInterval(() => {
            if (!isHovered) {
                angle += 0.003;
                graphRef.current?.cameraPosition({
                    x: 150 * Math.sin(angle),
                    y: 30,
                    z: 150 * Math.cos(angle),
                });
            }
        }, 50);

        return () => clearInterval(interval);
    }, [isHovered]);

    const handleExpand = () => {
        setCanvasMode('graph');
    };

    if (graphData.nodes.length === 0) {
        return (
            <div className="project-graph">
                <div className="project-graph-header">
                    <h3 className="section-title">
                        <Network size={14} />
                        Knowledge Graph
                    </h3>
                </div>
                <div className="project-graph-empty">
                    <Network size={32} />
                    <p>Create notes to visualize connections</p>
                </div>
            </div>
        );
    }

    return (
        <div className="project-graph">
            <div className="project-graph-header">
                <h3 className="section-title">
                    <Network size={14} />
                    Knowledge Graph
                </h3>
                <button className="graph-expand-btn" onClick={handleExpand}>
                    <Maximize2 size={12} /> Expand
                </button>
            </div>
            <div
                className="project-graph-container"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <ForceGraph3D
                    ref={graphRef}
                    graphData={graphData}
                    width={320}
                    height={200}
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
            </div>
        </div>
    );
};

export default ProjectGraph;
