import { invoke } from '@tauri-apps/api/core';
import type { RootNode, CreateRootNodeInput, UpdateRootNodeInput } from '@/types/rootNode';

// Root Node Service - handles all root node CRUD operations via Tauri

export async function getAllRootNodes(): Promise<RootNode[]> {
  return await invoke<RootNode[]>('get_all_root_nodes');
}

export async function getRootNodeById(nodeId: string): Promise<RootNode> {
  return await invoke<RootNode>('get_root_node_by_id', { nodeId });
}

export async function getRootNodesByNote(noteId: string): Promise<RootNode[]> {
  return await invoke<RootNode[]>('get_root_nodes_by_note', { noteId });
}

export async function getRootNodesByProject(projectId?: string | null): Promise<RootNode[]> {
  return await invoke<RootNode[]>('get_root_nodes_by_project', { projectId: projectId || null });
}

export async function searchRootNodes(query: string, projectId?: string | null): Promise<RootNode[]> {
  return await invoke<RootNode[]>('search_root_nodes', { query, projectId: projectId || null });
}

export async function createRootNode(input: CreateRootNodeInput): Promise<RootNode> {
  return await invoke<RootNode>('create_root_node', { input });
}

export async function updateRootNode(nodeId: string, input: UpdateRootNodeInput): Promise<RootNode> {
  return await invoke<RootNode>('update_root_node', { nodeId, input });
}

export async function deleteRootNode(nodeId: string): Promise<void> {
  return await invoke<void>('delete_root_node', { nodeId });
}

export async function getRootNodeByTerm(term: string, projectId?: string | null): Promise<RootNode | null> {
  return await invoke<RootNode | null>('get_root_node_by_term', { term, projectId: projectId || null });
}
