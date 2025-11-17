import { create } from 'zustand';
import type {
  CanvasElement,
  CanvasConnection,
  CanvasToolType,
  CanvasViewport,
  CanvasPosition,
  CanvasSize,
  CanvasElementData,
} from '@/types/canvas';

interface CanvasStore {
  // Canvas state
  elements: Map<string, CanvasElement>; // Map for O(1) lookup
  connections: Map<string, CanvasConnection>;
  selectedElementIds: Set<string>;
  selectedConnectionIds: Set<string>;
  activeTool: CanvasToolType;
  viewport: CanvasViewport;

  // Interaction state
  isDragging: boolean;
  isPanning: boolean;
  isDrawing: boolean;
  dragStartPos: CanvasPosition | null;

  // Actions - Elements
  addElement: (element: Omit<CanvasElement, 'id' | 'createdAt' | 'updatedAt' | 'zIndex'>) => string;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  deleteElements: (ids: string[]) => void;
  moveElement: (id: string, position: CanvasPosition) => void;
  resizeElement: (id: string, size: CanvasSize) => void;
  getElement: (id: string) => CanvasElement | undefined;
  getElementsByNote: (noteId: string) => CanvasElement[];
  clearElements: (noteId?: string) => void;

  // Actions - Connections
  addConnection: (connection: Omit<CanvasConnection, 'id' | 'createdAt'>) => string;
  updateConnection: (id: string, updates: Partial<CanvasConnection>) => void;
  deleteConnection: (id: string) => void;
  deleteConnections: (ids: string[]) => void;
  getConnectionsByElement: (elementId: string) => CanvasConnection[];
  getConnectionsByNote: (noteId: string) => CanvasConnection[];
  clearConnections: (noteId?: string) => void;

  // Actions - Selection
  selectElement: (id: string, multiSelect?: boolean) => void;
  selectElements: (ids: string[]) => void;
  deselectElement: (id: string) => void;
  deselectAll: () => void;
  toggleElementSelection: (id: string) => void;

  // Actions - Tools
  setActiveTool: (tool: CanvasToolType) => void;

  // Actions - Viewport
  setViewport: (viewport: Partial<CanvasViewport>) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setScroll: (scrollLeft: number, scrollTop: number) => void;

  // Actions - Interaction
  setIsDragging: (dragging: boolean) => void;
  setIsPanning: (panning: boolean) => void;
  setIsDrawing: (drawing: boolean) => void;
  setDragStartPos: (pos: CanvasPosition | null) => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // Initial state
  elements: new Map(),
  connections: new Map(),
  selectedElementIds: new Set(),
  selectedConnectionIds: new Set(),
  activeTool: 'cursor',
  viewport: {
    zoom: 1,
    scrollLeft: 0,
    scrollTop: 0,
  },
  isDragging: false,
  isPanning: false,
  isDrawing: false,
  dragStartPos: null,

  // Element actions
  addElement: (element) => {
    const id = `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const maxZIndex = Math.max(0, ...Array.from(get().elements.values()).map(e => e.zIndex));

    const newElement: CanvasElement = {
      ...element,
      id,
      zIndex: maxZIndex + 1,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      const newElements = new Map(state.elements);
      newElements.set(id, newElement);
      return { elements: newElements };
    });

    return id;
  },

  updateElement: (id, updates) => {
    set((state) => {
      const element = state.elements.get(id);
      if (!element) return state;

      const newElements = new Map(state.elements);
      newElements.set(id, {
        ...element,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      return { elements: newElements };
    });
  },

  deleteElement: (id) => {
    set((state) => {
      const newElements = new Map(state.elements);
      newElements.delete(id);

      // Also delete connections related to this element
      const newConnections = new Map(state.connections);
      Array.from(newConnections.entries()).forEach(([connId, conn]) => {
        if (conn.fromElementId === id || conn.toElementId === id) {
          newConnections.delete(connId);
        }
      });

      const newSelectedIds = new Set(state.selectedElementIds);
      newSelectedIds.delete(id);

      return {
        elements: newElements,
        connections: newConnections,
        selectedElementIds: newSelectedIds,
      };
    });
  },

  deleteElements: (ids) => {
    ids.forEach((id) => get().deleteElement(id));
  },

  moveElement: (id, position) => {
    get().updateElement(id, { position });
  },

  resizeElement: (id, size) => {
    get().updateElement(id, { size });
  },

  getElement: (id) => {
    return get().elements.get(id);
  },

  getElementsByNote: (noteId) => {
    return Array.from(get().elements.values()).filter(e => e.noteId === noteId);
  },

  clearElements: (noteId) => {
    if (noteId) {
      set((state) => {
        const newElements = new Map(state.elements);
        Array.from(newElements.entries()).forEach(([id, element]) => {
          if (element.noteId === noteId) {
            newElements.delete(id);
          }
        });
        return { elements: newElements };
      });
    } else {
      set({ elements: new Map() });
    }
  },

  // Connection actions
  addConnection: (connection) => {
    const id = `connection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newConnection: CanvasConnection = {
      ...connection,
      id,
      createdAt: now,
    };

    set((state) => {
      const newConnections = new Map(state.connections);
      newConnections.set(id, newConnection);
      return { connections: newConnections };
    });

    return id;
  },

  updateConnection: (id, updates) => {
    set((state) => {
      const connection = state.connections.get(id);
      if (!connection) return state;

      const newConnections = new Map(state.connections);
      newConnections.set(id, { ...connection, ...updates });
      return { connections: newConnections };
    });
  },

  deleteConnection: (id) => {
    set((state) => {
      const newConnections = new Map(state.connections);
      newConnections.delete(id);

      const newSelectedIds = new Set(state.selectedConnectionIds);
      newSelectedIds.delete(id);

      return {
        connections: newConnections,
        selectedConnectionIds: newSelectedIds,
      };
    });
  },

  deleteConnections: (ids) => {
    ids.forEach((id) => get().deleteConnection(id));
  },

  getConnectionsByElement: (elementId) => {
    return Array.from(get().connections.values()).filter(
      c => c.fromElementId === elementId || c.toElementId === elementId
    );
  },

  getConnectionsByNote: (noteId) => {
    return Array.from(get().connections.values()).filter(c => c.noteId === noteId);
  },

  clearConnections: (noteId) => {
    if (noteId) {
      set((state) => {
        const newConnections = new Map(state.connections);
        Array.from(newConnections.entries()).forEach(([id, connection]) => {
          if (connection.noteId === noteId) {
            newConnections.delete(id);
          }
        });
        return { connections: newConnections };
      });
    } else {
      set({ connections: new Map() });
    }
  },

  // Selection actions
  selectElement: (id, multiSelect = false) => {
    set((state) => {
      const newSelectedIds = multiSelect ? new Set(state.selectedElementIds) : new Set<string>();
      newSelectedIds.add(id);
      return { selectedElementIds: newSelectedIds };
    });
  },

  selectElements: (ids) => {
    set({ selectedElementIds: new Set(ids) });
  },

  deselectElement: (id) => {
    set((state) => {
      const newSelectedIds = new Set(state.selectedElementIds);
      newSelectedIds.delete(id);
      return { selectedElementIds: newSelectedIds };
    });
  },

  deselectAll: () => {
    set({ selectedElementIds: new Set(), selectedConnectionIds: new Set() });
  },

  toggleElementSelection: (id) => {
    set((state) => {
      const newSelectedIds = new Set(state.selectedElementIds);
      if (newSelectedIds.has(id)) {
        newSelectedIds.delete(id);
      } else {
        newSelectedIds.add(id);
      }
      return { selectedElementIds: newSelectedIds };
    });
  },

  // Tool actions
  setActiveTool: (tool) => {
    set({ activeTool: tool });
    // Deselect all when changing tools
    get().deselectAll();
  },

  // Viewport actions
  setViewport: (viewport) => {
    set((state) => ({
      viewport: { ...state.viewport, ...viewport }
    }));
  },

  setZoom: (zoom) => {
    const clampedZoom = Math.max(0.1, Math.min(5, zoom));
    set((state) => ({
      viewport: { ...state.viewport, zoom: clampedZoom }
    }));
  },

  zoomIn: () => {
    const currentZoom = get().viewport.zoom;
    get().setZoom(currentZoom * 1.2);
  },

  zoomOut: () => {
    const currentZoom = get().viewport.zoom;
    get().setZoom(currentZoom / 1.2);
  },

  resetZoom: () => {
    get().setZoom(1);
  },

  setScroll: (scrollLeft, scrollTop) => {
    set((state) => ({
      viewport: { ...state.viewport, scrollLeft, scrollTop }
    }));
  },

  // Interaction actions
  setIsDragging: (dragging) => set({ isDragging: dragging }),

  setIsPanning: (panning) => set({ isPanning: panning }),

  setIsDrawing: (drawing) => set({ isDrawing: drawing }),

  setDragStartPos: (pos) => set({ dragStartPos: pos }),
}));
