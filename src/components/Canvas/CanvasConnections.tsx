import React from 'react';
import type { CanvasConnection, CanvasElement } from '@/types/canvas';

interface CanvasConnectionsProps {
  connections: CanvasConnection[];
  elements: CanvasElement[];
  zoom: number;
}

const CanvasConnections: React.FC<CanvasConnectionsProps> = ({
  connections,
  elements,
  zoom,
}) => {
  // Create a map for quick element lookup
  const elementMap = new Map(elements.map((el) => [el.id, el]));

  const getConnectionPath = (connection: CanvasConnection) => {
    const fromElement = elementMap.get(connection.fromElementId);
    const toElement = elementMap.get(connection.toElementId);

    if (!fromElement || !toElement) return null;

    // Calculate connection points
    let fromX, fromY, toX, toY;

    if (connection.fromPoint) {
      const anchor = getAnchorPoint(fromElement, connection.fromPoint.side);
      fromX = anchor.x;
      fromY = anchor.y;
    } else {
      // Default to center
      fromX = fromElement.position.x + fromElement.size.width / 2;
      fromY = fromElement.position.y + fromElement.size.height / 2;
    }

    if (connection.toPoint) {
      const anchor = getAnchorPoint(toElement, connection.toPoint.side);
      toX = anchor.x;
      toY = anchor.y;
    } else {
      // Default to center
      toX = toElement.position.x + toElement.size.width / 2;
      toY = toElement.position.y + toElement.size.height / 2;
    }

    return { fromX, fromY, toX, toY };
  };

  const getAnchorPoint = (
    element: CanvasElement,
    side: 'top' | 'right' | 'bottom' | 'left'
  ) => {
    const { position, size } = element;

    switch (side) {
      case 'top':
        return { x: position.x + size.width / 2, y: position.y };
      case 'right':
        return { x: position.x + size.width, y: position.y + size.height / 2 };
      case 'bottom':
        return { x: position.x + size.width / 2, y: position.y + size.height };
      case 'left':
        return { x: position.x, y: position.y + size.height / 2 };
    }
  };

  const renderArrowMarker = (id: string, color: string) => (
    <marker
      id={id}
      markerWidth="10"
      markerHeight="10"
      refX="9"
      refY="3"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <path d="M0,0 L0,6 L9,3 z" fill={color} />
    </marker>
  );

  return (
    <svg
      className="canvas-connections-layer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <defs>
        {renderArrowMarker('arrow-default', '#58a6ff')}
        {renderArrowMarker('arrow-selected', '#1f6feb')}
      </defs>

      {connections.map((connection) => {
        const path = getConnectionPath(connection);
        if (!path) return null;

        const { fromX, fromY, toX, toY } = path;
        const color = connection.style?.strokeColor || '#58a6ff';
        const strokeWidth = (connection.style?.strokeWidth || 2) / zoom;
        const strokeDasharray = connection.style?.strokeDasharray;

        // Calculate control points for a curved line
        const dx = toX - fromX;
        const dy = toY - fromY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Bezier curve control points (make it curved)
        const curvature = 0.2;
        const controlOffset = distance * curvature;

        const controlX1 = fromX + dx * 0.5;
        const controlY1 = fromY - controlOffset;
        const controlX2 = fromX + dx * 0.5;
        const controlY2 = toY + controlOffset;

        const pathData = `M ${fromX} ${fromY} Q ${controlX1} ${controlY1}, ${
          fromX + dx * 0.5
        } ${fromY + dy * 0.5} T ${toX} ${toY}`;

        return (
          <g key={connection.id}>
            {/* Connection line */}
            <path
              d={pathData}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              fill="none"
              strokeLinecap="round"
              markerEnd={
                connection.style?.arrowType === 'none'
                  ? undefined
                  : 'url(#arrow-default)'
              }
              style={{ pointerEvents: 'stroke' }}
            />

            {/* Invisible wider path for easier selection */}
            <path
              d={pathData}
              stroke="transparent"
              strokeWidth={Math.max(10, strokeWidth * 3)}
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            />
          </g>
        );
      })}
    </svg>
  );
};

export default CanvasConnections;
