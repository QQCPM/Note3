// Canvas element types
export type CanvasElementType = 'note' | 'text' | 'drawing' | 'mindmap' | 'website';

export type CanvasToolType = 'hand' | 'cursor' | 'arrow' | 'note' | 'drawing' | 'text' | 'mindmap' | 'website';

// Canvas element position and size
export interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

// Base canvas element
export interface CanvasElement {
  id: string;
  type: CanvasElementType;
  position: CanvasPosition;
  size: CanvasSize;
  rotation?: number;
  zIndex: number;
  noteId: string; // Associated note ID
  data: CanvasElementData;
  createdAt: string;
  updatedAt: string;
}

// Canvas element data types
export type CanvasElementData =
  | NoteElementData
  | TextElementData
  | DrawingElementData
  | MindmapElementData
  | WebsiteElementData;

export interface NoteElementData {
  type: 'note';
  title: string;
  content: string;
  color?: string;
}

export interface TextElementData {
  type: 'text';
  content: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
}

export interface DrawingElementData {
  type: 'drawing';
  paths: DrawingPath[];
  strokeColor?: string;
  strokeWidth?: number;
}

export interface DrawingPath {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface MindmapElementData {
  type: 'mindmap';
  title: string;
  nodes: MindmapNode[];
}

export interface MindmapNode {
  id: string;
  text: string;
  parentId?: string;
  position: { x: number; y: number };
}

export interface WebsiteElementData {
  type: 'website';
  url: string;
  title?: string;
}

// Canvas connections (arrows between elements)
export interface CanvasConnection {
  id: string;
  fromElementId: string;
  toElementId: string;
  fromPoint?: ConnectionPoint; // Optional anchor point on element
  toPoint?: ConnectionPoint;
  style?: ConnectionStyle;
  noteId: string; // Associated note ID
  createdAt: string;
}

export interface ConnectionPoint {
  side: 'top' | 'right' | 'bottom' | 'left';
  offset?: number; // Offset from center (0-1)
}

export interface ConnectionStyle {
  strokeColor?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  arrowType?: 'arrow' | 'dot' | 'none';
}

// Canvas viewport state
export interface CanvasViewport {
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
}

// Canvas state
export interface CanvasState {
  elements: CanvasElement[];
  connections: CanvasConnection[];
  selectedElementIds: string[];
  selectedConnectionIds: string[];
  activeTool: CanvasToolType;
  viewport: CanvasViewport;
  isDragging: boolean;
  isDrawing: boolean;
  drawingPath?: DrawingPath;
}
