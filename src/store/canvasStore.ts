import { create } from 'zustand';

// Canvas element types matching prototype
export type CanvasElementType = 'note' | 'drawing' | 'text' | 'website' | 'mindmap';

// Canvas tools matching prototype
export type CanvasTool = 'hand' | 'cursor' | 'arrow' | 'note' | 'drawing' | 'text' | 'mindmap' | 'website';

// Connection between two canvas elements
export interface CanvasConnection {
  from: string; // element id
  to: string; // element id
}

// Individual canvas element
export interface CanvasElement {
  id: string;
  type: CanvasElementType;
  x: number; // absolute position on canvas
  y: number; // absolute position on canvas
  width: number;
  height: number;
  content: string;
  color: string; // background color
  label: string; // glassmorphic label text
  drawing?: string; // base64 data URL for drawings
  noteId?: string; // ID of linked note (for full note editing)
}

interface CanvasState {
  // Canvas elements
  elements: CanvasElement[];
  nextElementId: number;

  // Zoom and pan
  zoom: number; // 0.5 to 2.0 (50% to 200%)
  panX: number; // viewport scroll position
  panY: number; // viewport scroll position

  // Tool selection
  selectedTool: CanvasTool;

  // Connections
  connections: CanvasConnection[];
  connectingFrom: string | null; // element id when in connecting mode

  // Full-screen modal
  editingElement: CanvasElement | null;

  // Actions
  addElement: (element: Omit<CanvasElement, 'id'>) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setSelectedTool: (tool: CanvasTool) => void;
  addConnection: (from: string, to: string) => void;
  removeConnection: (from: string, to: string) => void;
  setConnectingFrom: (elementId: string | null) => void;
  setEditingElement: (element: CanvasElement | null) => void;
  clearCanvas: () => void;
  initializeDefaultElements: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  elements: [],
  nextElementId: 1,

  zoom: 1.0,
  panX: 2000, // Start centered on canvas
  panY: 2000,

  selectedTool: 'hand',

  connections: [],
  connectingFrom: null,

  editingElement: null,

  addElement: (element) => set((state) => ({
    elements: [...state.elements, { ...element, id: `element-${state.nextElementId}` }],
    nextElementId: state.nextElementId + 1,
  })),

  updateElement: (id, updates) => set((state) => ({
    elements: state.elements.map((el) =>
      el.id === id ? { ...el, ...updates } : el
    ),
    // Also update editing element if it's the same one
    editingElement: state.editingElement?.id === id
      ? { ...state.editingElement, ...updates }
      : state.editingElement,
  })),

  deleteElement: (id) => set((state) => ({
    elements: state.elements.filter((el) => el.id !== id),
    connections: state.connections.filter((conn) => conn.from !== id && conn.to !== id),
  })),

  setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(2.0, zoom)) }),

  setPan: (x, y) => set({ panX: x, panY: y }),

  setSelectedTool: (tool) => set({ selectedTool: tool, connectingFrom: null }),

  addConnection: (from, to) => set((state) => {
    // Don't add duplicate connections
    const exists = state.connections.some(
      (conn) => conn.from === from && conn.to === to
    );
    if (exists) return state;

    return {
      connections: [...state.connections, { from, to }],
      connectingFrom: null,
    };
  }),

  removeConnection: (from, to) => set((state) => ({
    connections: state.connections.filter(
      (conn) => !(conn.from === from && conn.to === to)
    ),
  })),

  setConnectingFrom: (elementId) => set({ connectingFrom: elementId }),

  setEditingElement: (element) => set({ editingElement: element }),

  clearCanvas: () => set({
    elements: [],
    connections: [],
    connectingFrom: null,
    editingElement: null,
  }),

  initializeDefaultElements: () => {
    const colors = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f472b6'];

    set({
      elements: [
        {
          id: 'element-1',
          type: 'note',
          x: 2200,
          y: 2350,
          width: 150,
          height: 150,
          content: 'Start Here',
          color: colors[0],
          label: 'First Note',
        },
        {
          id: 'element-2',
          type: 'drawing',
          x: 2450,
          y: 2350,
          width: 200,
          height: 200,
          content: '',
          color: '#ffffff',
          label: 'Drawing',
        },
        {
          id: 'element-3',
          type: 'note',
          x: 2750,
          y: 2350,
          width: 150,
          height: 150,
          content: 'Ideas',
          color: colors[4],
          label: 'Ideas',
        },
      ],
      nextElementId: 4,
    });
  },
}));
