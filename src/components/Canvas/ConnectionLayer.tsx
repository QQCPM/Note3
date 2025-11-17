import React from 'react';
import { useCanvasStore } from '@/store/canvasStore';

const ConnectionLayer: React.FC = () => {
  const { connections, elements, zoom } = useCanvasStore();

  // Calculate intersection point of line with rectangle edge
  const getBoxEdgePoint = (
    box: { x: number; y: number; width: number; height: number },
    targetX: number,
    targetY: number
  ): { x: number; y: number } => {
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Calculate angle from box center to target
    const dx = targetX - centerX;
    const dy = targetY - centerY;

    // Handle edge cases
    if (dx === 0 && dy === 0) {
      return { x: centerX, y: centerY };
    }

    const halfWidth = box.width / 2;
    const halfHeight = box.height / 2;

    // Calculate intersection with each edge and find the closest valid one
    let x: number, y: number;

    if (Math.abs(dx) / halfWidth > Math.abs(dy) / halfHeight) {
      // Intersection with left or right edge
      x = centerX + (dx > 0 ? halfWidth : -halfWidth);
      y = centerY + (dy / dx) * (x - centerX);
    } else {
      // Intersection with top or bottom edge
      y = centerY + (dy > 0 ? halfHeight : -halfHeight);
      x = centerX + (dx / dy) * (y - centerY);
    }

    return { x, y };
  };

  return (
    <svg
      id="connectionSvg"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      {/* Arrowhead marker definition - scales with zoom */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth={10 * zoom}
          markerHeight={10 * zoom}
          refX={9 * zoom}
          refY={3 * zoom}
          orient="auto"
        >
          <polygon points={`0 0, ${10 * zoom} ${3 * zoom}, 0 ${6 * zoom}`} fill="#58a6ff" />
        </marker>
      </defs>

      {/* Render all connections */}
      {connections.map((conn, index) => {
        const fromElement = elements.find((el) => el.id === conn.from);
        const toElement = elements.find((el) => el.id === conn.to);

        if (!fromElement || !toElement) return null;

        // Calculate centers
        const fromCenterX = fromElement.x + fromElement.width / 2;
        const fromCenterY = fromElement.y + fromElement.height / 2;
        const toCenterX = toElement.x + toElement.width / 2;
        const toCenterY = toElement.y + toElement.height / 2;

        // Calculate edge points (line goes from edge to edge)
        const fromEdge = getBoxEdgePoint(fromElement, toCenterX, toCenterY);
        const toEdge = getBoxEdgePoint(toElement, fromCenterX, fromCenterY);

        return (
          <line
            key={`${conn.from}-${conn.to}-${index}`}
            x1={fromEdge.x * zoom}
            y1={fromEdge.y * zoom}
            x2={toEdge.x * zoom}
            y2={toEdge.y * zoom}
            stroke="#58a6ff"
            strokeWidth={2 * zoom}
            markerEnd="url(#arrowhead)"
          />
        );
      })}
    </svg>
  );
};

export default ConnectionLayer;
