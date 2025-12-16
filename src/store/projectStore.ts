import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Project,
  ProjectSettings,
  CreateProjectInput,
  TreeItem,
  TreeItemWithChildren,
  CreateTreeItemInput,
  TodayTask,
  canHaveChildren,
} from '@/types/project';

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  defaultNoteDepth: 'detailed',
  includeFlashcards: true,
  includePractice: true,
  includeQuizzes: false,
  aiAssistEnabled: true,
};

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface ProjectStore {
  // State
  projects: Project[];
  treeItems: TreeItem[];
  activeProjectId: string | null;
  selectedItemId: string | null;
  expandedIds: Set<string>;
  pinnedIds: Set<string>;
  todayTasks: TodayTask[];

  // UI State
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  // Project Actions
  setProjects: (projects: Project[]) => void;
  addProject: (input: CreateProjectInput) => Project;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  setActiveProject: (projectId: string | null) => void;

  // Tree Item Actions
  setTreeItems: (items: TreeItem[]) => void;
  addTreeItem: (input: CreateTreeItemInput) => TreeItem;
  updateTreeItem: (itemId: string, updates: Partial<TreeItem>) => void;
  deleteTreeItem: (itemId: string) => void;
  moveTreeItem: (itemId: string, newParentId: string | null, newPosition: number) => void;

  // Selection & Expansion
  setSelectedItem: (itemId: string | null) => void;
  toggleExpanded: (itemId: string) => void;
  expandItem: (itemId: string) => void;
  collapseItem: (itemId: string) => void;
  expandAll: (projectId: string) => void;
  collapseAll: (projectId: string) => void;

  // Pinning
  togglePinned: (itemId: string) => void;
  isPinned: (itemId: string) => boolean;

  // Today Tasks
  setTodayTasks: (tasks: TodayTask[]) => void;
  updateTaskStatus: (taskId: string, status: TodayTask['status']) => void;

  // Search
  setSearchQuery: (query: string) => void;

  // Helpers
  getProjectById: (projectId: string) => Project | undefined;
  getTreeItemById: (itemId: string) => TreeItem | undefined;
  getTreeItemsByProject: (projectId: string) => TreeItem[];
  getChildItems: (parentId: string | null, projectId: string) => TreeItem[];
  buildTree: (projectId: string) => TreeItemWithChildren[];
  getPinnedItems: () => TreeItem[];
  getItemProgress: (itemId: string) => number;

  // Initialize with defaults
  initializeDefaults: () => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
  // Initial State
  projects: [],
  treeItems: [],
  activeProjectId: null,
  selectedItemId: null,
  expandedIds: new Set(),
  pinnedIds: new Set(),
  todayTasks: [],
  searchQuery: '',
  isLoading: false,
  error: null,

  // ========================================================================
  // PROJECT ACTIONS
  // ========================================================================

  setProjects: (projects) => set({ projects }),

  addProject: (input) => {
    const newProject: Project = {
      id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: input.name,
      icon: input.icon || '📚',
      type: input.type,
      description: input.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: 0,
      status: 'active',
      settings: { ...DEFAULT_PROJECT_SETTINGS, ...input.settings },
      targetDate: input.targetDate,
      startDate: new Date().toISOString(),
    };

    set((state) => ({
      projects: [...state.projects, newProject],
    }));

    return newProject;
  },

  updateProject: (projectId, updates) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? { ...p, ...updates, updatedAt: new Date().toISOString() }
          : p
      ),
    }));
  },

  deleteProject: (projectId) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
      treeItems: state.treeItems.filter((i) => i.projectId !== projectId),
      activeProjectId:
        state.activeProjectId === projectId ? null : state.activeProjectId,
    }));
  },

  setActiveProject: (projectId) => set({ activeProjectId: projectId }),

  // ========================================================================
  // TREE ITEM ACTIONS
  // ========================================================================

  setTreeItems: (items) => set({ treeItems: items }),

  addTreeItem: (input) => {
    const siblings = get().getChildItems(input.parentId || null, input.projectId);
    const maxPosition = siblings.reduce((max, s) => Math.max(max, s.position), -1);

    const newItem: TreeItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId: input.projectId,
      parentId: input.parentId || null,
      name: input.name,
      type: input.type,
      origin: input.origin || 'user',
      status: 'not_started',
      position: maxPosition + 1,
      filePath: input.filePath,
      url: input.url,
      noteId: input.noteId,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      treeItems: [...state.treeItems, newItem],
    }));

    // Auto-expand parent if exists
    if (input.parentId) {
      get().expandItem(input.parentId);
    }

    return newItem;
  },

  updateTreeItem: (itemId, updates) => {
    set((state) => ({
      treeItems: state.treeItems.map((item) =>
        item.id === itemId
          ? { ...item, ...updates, updatedAt: new Date().toISOString() }
          : item
      ),
    }));
  },

  deleteTreeItem: (itemId) => {
    const item = get().getTreeItemById(itemId);
    if (!item) return;

    // Get all descendant IDs to delete
    const getAllDescendantIds = (parentId: string): string[] => {
      const children = get().treeItems.filter((i) => i.parentId === parentId);
      return children.flatMap((c) => [c.id, ...getAllDescendantIds(c.id)]);
    };

    const idsToDelete = [itemId, ...getAllDescendantIds(itemId)];

    set((state) => ({
      treeItems: state.treeItems.filter((i) => !idsToDelete.includes(i.id)),
      selectedItemId:
        state.selectedItemId && idsToDelete.includes(state.selectedItemId)
          ? null
          : state.selectedItemId,
      pinnedIds: new Set(
        [...state.pinnedIds].filter((id) => !idsToDelete.includes(id))
      ),
    }));
  },

  moveTreeItem: (itemId, newParentId, newPosition) => {
    set((state) => {
      const items = [...state.treeItems];
      const itemIndex = items.findIndex((i) => i.id === itemId);
      if (itemIndex === -1) return state;

      const item = items[itemIndex];
      const oldParentId = item.parentId;
      const projectId = item.projectId;

      // Update the moved item
      items[itemIndex] = {
        ...item,
        parentId: newParentId,
        position: newPosition,
        updatedAt: new Date().toISOString(),
      };

      // Reorder siblings in old parent
      if (oldParentId !== newParentId) {
        const oldSiblings = items.filter(
          (i) => i.parentId === oldParentId && i.projectId === projectId && i.id !== itemId
        );
        oldSiblings
          .sort((a, b) => a.position - b.position)
          .forEach((sibling, index) => {
            const siblingIndex = items.findIndex((i) => i.id === sibling.id);
            if (siblingIndex !== -1) {
              items[siblingIndex] = { ...items[siblingIndex], position: index };
            }
          });
      }

      // Reorder siblings in new parent
      const newSiblings = items.filter(
        (i) => i.parentId === newParentId && i.projectId === projectId
      );
      newSiblings
        .sort((a, b) => a.position - b.position)
        .forEach((sibling, index) => {
          const siblingIndex = items.findIndex((i) => i.id === sibling.id);
          if (siblingIndex !== -1) {
            items[siblingIndex] = { ...items[siblingIndex], position: index };
          }
        });

      return { treeItems: items };
    });
  },

  // ========================================================================
  // SELECTION & EXPANSION
  // ========================================================================

  setSelectedItem: (itemId) => set({ selectedItemId: itemId }),

  toggleExpanded: (itemId) => {
    set((state) => {
      const expanded = new Set(state.expandedIds);
      if (expanded.has(itemId)) {
        expanded.delete(itemId);
      } else {
        expanded.add(itemId);
      }
      return { expandedIds: expanded };
    });
  },

  expandItem: (itemId) => {
    set((state) => {
      const expanded = new Set(state.expandedIds);
      expanded.add(itemId);
      return { expandedIds: expanded };
    });
  },

  collapseItem: (itemId) => {
    set((state) => {
      const expanded = new Set(state.expandedIds);
      expanded.delete(itemId);
      return { expandedIds: expanded };
    });
  },

  expandAll: (projectId) => {
    const items = get().getTreeItemsByProject(projectId);
    const foldersAndParents = items.filter(
      (i) => canHaveChildren(i.type) || items.some((c) => c.parentId === i.id)
    );

    set((state) => {
      const expanded = new Set(state.expandedIds);
      foldersAndParents.forEach((f) => expanded.add(f.id));
      return { expandedIds: expanded };
    });
  },

  collapseAll: (projectId) => {
    const items = get().getTreeItemsByProject(projectId);
    const itemIds = new Set(items.map((i) => i.id));

    set((state) => {
      const expanded = new Set(state.expandedIds);
      itemIds.forEach((id) => expanded.delete(id));
      return { expandedIds: expanded };
    });
  },

  // ========================================================================
  // PINNING
  // ========================================================================

  togglePinned: (itemId) => {
    set((state) => {
      const pinned = new Set(state.pinnedIds);
      if (pinned.has(itemId)) {
        pinned.delete(itemId);
      } else {
        pinned.add(itemId);
      }
      return { pinnedIds: pinned };

      // Also update the tree item
    });

    get().updateTreeItem(itemId, { isPinned: !get().isPinned(itemId) });
  },

  isPinned: (itemId) => get().pinnedIds.has(itemId),

  // ========================================================================
  // TODAY TASKS
  // ========================================================================

  setTodayTasks: (tasks) => set({ todayTasks: tasks }),

  updateTaskStatus: (taskId, status) => {
    set((state) => ({
      todayTasks: state.todayTasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status,
              completedAt: status === 'completed' ? new Date().toISOString() : undefined,
            }
          : t
      ),
    }));
  },

  // ========================================================================
  // SEARCH
  // ========================================================================

  setSearchQuery: (query) => set({ searchQuery: query }),

  // ========================================================================
  // HELPERS
  // ========================================================================

  getProjectById: (projectId) => {
    return get().projects.find((p) => p.id === projectId);
  },

  getTreeItemById: (itemId) => {
    return get().treeItems.find((i) => i.id === itemId);
  },

  getTreeItemsByProject: (projectId) => {
    return get().treeItems.filter((i) => i.projectId === projectId);
  },

  getChildItems: (parentId, projectId) => {
    return get()
      .treeItems.filter((i) => i.parentId === parentId && i.projectId === projectId)
      .sort((a, b) => a.position - b.position);
  },

  buildTree: (projectId) => {
    const items = get().getTreeItemsByProject(projectId);
    const itemMap = new Map<string, TreeItemWithChildren>();

    // Initialize all items with empty children
    items.forEach((item) => {
      itemMap.set(item.id, { ...item, children: [] });
    });

    // Build tree structure
    const roots: TreeItemWithChildren[] = [];

    items.forEach((item) => {
      const itemWithChildren = itemMap.get(item.id)!;

      if (item.parentId === null) {
        roots.push(itemWithChildren);
      } else {
        const parent = itemMap.get(item.parentId);
        if (parent) {
          parent.children.push(itemWithChildren);
        } else {
          // Orphan item, add to root
          roots.push(itemWithChildren);
        }
      }
    });

    // Sort children by position
    const sortChildren = (items: TreeItemWithChildren[]) => {
      items.sort((a, b) => a.position - b.position);
      items.forEach((item) => sortChildren(item.children));
    };
    sortChildren(roots);

    return roots;
  },

  getPinnedItems: () => {
    const pinnedIds = get().pinnedIds;
    return get().treeItems.filter((i) => pinnedIds.has(i.id));
  },

  getItemProgress: (itemId) => {
    const item = get().getTreeItemById(itemId);
    if (!item) return 0;

    // For items with explicit progress
    if (item.progress !== undefined) return item.progress;

    // For folders, calculate based on children
    if (canHaveChildren(item.type)) {
      const children = get().treeItems.filter((i) => i.parentId === itemId);
      if (children.length === 0) return 0;

      const completedCount = children.filter(
        (c) => c.status === 'completed'
      ).length;
      return Math.round((completedCount / children.length) * 100);
    }

    // Based on status
    switch (item.status) {
      case 'completed':
        return 100;
      case 'in_progress':
        return 50;
      default:
        return 0;
    }
  },

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  initializeDefaults: () => {
    const { projects } = get();

    // Create sample "Deep Learning" project if none exist
    if (projects.length === 0) {
      const sampleProject: Project = {
        id: 'deep-learning-project',
        name: 'Deep Learning',
        icon: '📘',
        type: 'general',
        description: 'Goodfellow, Bengio, Courville',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        progress: 35,
        status: 'active',
        settings: DEFAULT_PROJECT_SETTINGS,
      };

      // Sample tree items with various file types
      const sampleItems: TreeItem[] = [
        // Source PDF Book
        {
          id: 'source-pdf',
          projectId: 'deep-learning-project',
          parentId: null,
          name: 'Deep_Learning_Book.pdf',
          type: 'pdf',
          origin: 'imported',
          status: 'completed',
          position: 0,
          isPinned: true,
          fileSize: 15728640, // ~15MB
          pageCount: 800,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // Source Video Lecture
        {
          id: 'source-video',
          projectId: 'deep-learning-project',
          parentId: null,
          name: 'VAE_Tutorial.mov',
          type: 'video',
          origin: 'imported',
          status: 'in_progress',
          position: 1,
          isPinned: false,
          fileSize: 524288000, // ~500MB
          duration: 3600, // 1 hour
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // Source Audio Lecture
        {
          id: 'source-audio',
          projectId: 'deep-learning-project',
          parentId: null,
          name: 'Lecture_03_Backprop.m4a',
          type: 'audio',
          origin: 'imported',
          status: 'not_started',
          position: 2,
          isPinned: false,
          fileSize: 52428800, // ~50MB
          duration: 2700, // 45 mins
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // AI Generated Notes Folder
        {
          id: 'part-1',
          projectId: 'deep-learning-project',
          parentId: null,
          name: 'Part I: Applied Mathematics',
          type: 'folder',
          origin: 'ai_generated',
          status: 'in_progress',
          position: 3,
          isPinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // Linear Algebra (completed)
        {
          id: 'linear-algebra',
          projectId: 'deep-learning-project',
          parentId: 'part-1',
          name: 'Linear Algebra',
          type: 'note',
          origin: 'ai_generated',
          status: 'completed',
          position: 0,
          isPinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // Probability (in progress)
        {
          id: 'probability',
          projectId: 'deep-learning-project',
          parentId: 'part-1',
          name: 'Probability & Information Theory',
          type: 'note',
          origin: 'ai_generated',
          status: 'in_progress',
          position: 1,
          isPinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // Numerical Computation (not started)
        {
          id: 'numerical',
          projectId: 'deep-learning-project',
          parentId: 'part-1',
          name: 'Numerical Computation',
          type: 'note',
          origin: 'ai_generated',
          status: 'not_started',
          position: 2,
          isPinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // Part II: Deep Networks (folder)
        {
          id: 'part-2',
          projectId: 'deep-learning-project',
          parentId: null,
          name: 'Part II: Deep Networks',
          type: 'folder',
          origin: 'ai_generated',
          status: 'not_started',
          position: 4,
          isPinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // Part III: Deep Learning Research (folder)
        {
          id: 'part-3',
          projectId: 'deep-learning-project',
          parentId: null,
          name: 'Part III: Deep Learning Research',
          type: 'folder',
          origin: 'ai_generated',
          status: 'not_started',
          position: 5,
          isPinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      set({
        projects: [sampleProject],
        treeItems: sampleItems,
        activeProjectId: 'deep-learning-project',
        expandedIds: new Set(['part-1']), // Expand Part I by default
      });
    }
  },
    }),
    {
      name: 'note3-project-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projects: state.projects,
        treeItems: state.treeItems,
        activeProjectId: state.activeProjectId,
        pinnedIds: Array.from(state.pinnedIds),
        expandedIds: Array.from(state.expandedIds),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert arrays back to Sets after rehydration
          state.pinnedIds = new Set(state.pinnedIds as unknown as string[]);
          state.expandedIds = new Set(state.expandedIds as unknown as string[]);
        }
      },
    }
  )
);

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

/**
 * Get the active project
 */
export const useActiveProject = () => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const getProjectById = useProjectStore((s) => s.getProjectById);
  return activeProjectId ? getProjectById(activeProjectId) : undefined;
};

/**
 * Get tree for active project
 */
export const useActiveProjectTree = () => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const buildTree = useProjectStore((s) => s.buildTree);
  return activeProjectId ? buildTree(activeProjectId) : [];
};

/**
 * Check if an item is expanded
 */
export const useIsExpanded = (itemId: string) => {
  return useProjectStore((s) => s.expandedIds.has(itemId));
};

/**
 * Get filtered items based on search query
 */
export const useFilteredItems = (projectId: string) => {
  const items = useProjectStore((s) => s.getTreeItemsByProject(projectId));
  const searchQuery = useProjectStore((s) => s.searchQuery);

  if (!searchQuery.trim()) return items;

  const query = searchQuery.toLowerCase();
  return items.filter((item) => item.name.toLowerCase().includes(query));
};
