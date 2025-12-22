import { create } from 'zustand';
import type { RootNode, CreateRootNodeInput, UpdateRootNodeInput } from '@/types/rootNode';
import * as rootNodeService from '@/services/rootNodeService';

interface RootNodeState {
  // State
  rootNodes: RootNode[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchAllRootNodes: () => Promise<void>;
  fetchRootNodesByNote: (noteId: string) => Promise<RootNode[]>;
  fetchRootNodesByProject: (projectId?: string | null) => Promise<RootNode[]>;
  searchRootNodes: (query: string, projectId?: string | null) => Promise<RootNode[]>;
  createRootNode: (input: CreateRootNodeInput) => Promise<RootNode>;
  updateRootNode: (nodeId: string, input: UpdateRootNodeInput) => Promise<RootNode>;
  deleteRootNode: (nodeId: string) => Promise<void>;
  getRootNodeByTerm: (term: string, projectId?: string | null) => Promise<RootNode | null>;
  
  // Helpers
  getRootNodeById: (nodeId: string) => RootNode | undefined;
  getRootNodesForNote: (noteId: string) => RootNode[];
}

export const useRootNodeStore = create<RootNodeState>((set, get) => ({
  // Initial state
  rootNodes: [],
  loading: false,
  error: null,

  // Fetch all root nodes
  fetchAllRootNodes: async () => {
    set({ loading: true, error: null });
    try {
      const rootNodes = await rootNodeService.getAllRootNodes();
      set({ rootNodes, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  // Fetch root nodes by note
  fetchRootNodesByNote: async (noteId: string) => {
    try {
      const nodes = await rootNodeService.getRootNodesByNote(noteId);
      return nodes;
    } catch (error) {
      console.error('Failed to fetch root nodes by note:', error);
      return [];
    }
  },

  // Fetch root nodes by project
  fetchRootNodesByProject: async (projectId?: string | null) => {
    try {
      const nodes = await rootNodeService.getRootNodesByProject(projectId);
      return nodes;
    } catch (error) {
      console.error('Failed to fetch root nodes by project:', error);
      return [];
    }
  },

  // Search root nodes
  searchRootNodes: async (query: string, projectId?: string | null) => {
    try {
      const nodes = await rootNodeService.searchRootNodes(query, projectId);
      return nodes;
    } catch (error) {
      console.error('Failed to search root nodes:', error);
      return [];
    }
  },

  // Create root node
  createRootNode: async (input: CreateRootNodeInput) => {
    set({ loading: true, error: null });
    try {
      const newNode = await rootNodeService.createRootNode(input);
      set((state) => ({
        rootNodes: [...state.rootNodes, newNode],
        loading: false,
      }));
      return newNode;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  // Update root node
  updateRootNode: async (nodeId: string, input: UpdateRootNodeInput) => {
    set({ loading: true, error: null });
    try {
      const updatedNode = await rootNodeService.updateRootNode(nodeId, input);
      set((state) => ({
        rootNodes: state.rootNodes.map((node) =>
          node.id === nodeId ? updatedNode : node
        ),
        loading: false,
      }));
      return updatedNode;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  // Delete root node
  deleteRootNode: async (nodeId: string) => {
    set({ loading: true, error: null });
    try {
      await rootNodeService.deleteRootNode(nodeId);
      set((state) => ({
        rootNodes: state.rootNodes.filter((node) => node.id !== nodeId),
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  // Get root node by term
  getRootNodeByTerm: async (term: string, projectId?: string | null) => {
    try {
      return await rootNodeService.getRootNodeByTerm(term, projectId);
    } catch (error) {
      console.error('Failed to get root node by term:', error);
      return null;
    }
  },

  // Helper: Get root node by ID from local state
  getRootNodeById: (nodeId: string) => {
    return get().rootNodes.find((node) => node.id === nodeId);
  },

  // Helper: Get root nodes for a specific note from local state
  getRootNodesForNote: (noteId: string) => {
    return get().rootNodes.filter((node) => node.note_id === noteId);
  },
}));
