import { create } from 'zustand';

// =============================================================================
// Types
// =============================================================================

export interface BranchableMessage {
  id: string;
  parentId: string | null;
  branchId: string;
  content: string;
  type: 'user' | 'claude' | 'tool-use' | 'tool-result' | 'system' | 'thinking' | 'error';
  timestamp: number;
  children: string[]; // IDs of branched responses
}

export interface Branch {
  id: string;
  name: string;
  parentBranchId: string | null;
  createdAt: number;
  messageIds: string[];
}

interface BranchState {
  // State
  activeBranchId: string;
  branches: Map<string, Branch>;
  branchPoints: Map<string, string[]>; // messageId -> childBranchIds

  // Actions
  createBranch: (fromMessageId: string, name?: string) => string;
  switchBranch: (branchId: string) => void;
  deleteBranch: (branchId: string) => void;
  renameBranch: (branchId: string, name: string) => void;

  // Query helpers
  getBranch: (branchId: string) => Branch | undefined;
  getBranchHistory: (branchId: string) => string[];
  getChildBranches: (messageId: string) => string[];

  // Reset
  reset: () => void;
}

// =============================================================================
// Default State
// =============================================================================

const DEFAULT_BRANCH_ID = 'main';

const createDefaultBranch = (): Branch => ({
  id: DEFAULT_BRANCH_ID,
  name: 'Main',
  parentBranchId: null,
  createdAt: Date.now(),
  messageIds: [],
});

const initialState = {
  activeBranchId: DEFAULT_BRANCH_ID,
  branches: new Map([[DEFAULT_BRANCH_ID, createDefaultBranch()]]),
  branchPoints: new Map(),
};

// =============================================================================
// Store
// =============================================================================

export const useBranchStore = create<BranchState>((set, get) => ({
  ...initialState,

  createBranch: (fromMessageId: string, name?: string) => {
    const branchId = `branch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const currentBranch = get().branches.get(get().activeBranchId);

    if (!currentBranch) {
      console.error('[BranchStore] Cannot create branch: active branch not found');
      return '';
    }

    // Find the index of the message in the current branch
    const messageIndex = currentBranch.messageIds.indexOf(fromMessageId);
    if (messageIndex === -1) {
      console.error('[BranchStore] Cannot create branch: message not found in active branch');
      return '';
    }

    // Create new branch with messages up to (but not including) the branch point
    const newBranch: Branch = {
      id: branchId,
      name: name || `Branch ${get().branches.size}`,
      parentBranchId: get().activeBranchId,
      createdAt: Date.now(),
      messageIds: currentBranch.messageIds.slice(0, messageIndex),
    };

    set((state) => {
      const newBranches = new Map(state.branches);
      newBranches.set(branchId, newBranch);

      // Track this as a branch point
      const newBranchPoints = new Map(state.branchPoints);
      const existingChildren = newBranchPoints.get(fromMessageId) || [];
      newBranchPoints.set(fromMessageId, [...existingChildren, branchId]);

      return {
        branches: newBranches,
        branchPoints: newBranchPoints,
        activeBranchId: branchId,
      };
    });

    return branchId;
  },

  switchBranch: (branchId: string) => {
    const branch = get().branches.get(branchId);
    if (!branch) {
      console.error('[BranchStore] Cannot switch: branch not found', branchId);
      return;
    }
    set({ activeBranchId: branchId });
  },

  deleteBranch: (branchId: string) => {
    if (branchId === DEFAULT_BRANCH_ID) {
      console.error('[BranchStore] Cannot delete main branch');
      return;
    }

    set((state) => {
      const newBranches = new Map(state.branches);
      newBranches.delete(branchId);

      // If we're deleting the active branch, switch to main
      const newActiveBranchId =
        state.activeBranchId === branchId ? DEFAULT_BRANCH_ID : state.activeBranchId;

      // Clean up branch points
      const newBranchPoints = new Map(state.branchPoints);
      for (const [messageId, children] of newBranchPoints) {
        const filtered = children.filter((id) => id !== branchId);
        if (filtered.length === 0) {
          newBranchPoints.delete(messageId);
        } else {
          newBranchPoints.set(messageId, filtered);
        }
      }

      return {
        branches: newBranches,
        branchPoints: newBranchPoints,
        activeBranchId: newActiveBranchId,
      };
    });
  },

  renameBranch: (branchId: string, name: string) => {
    set((state) => {
      const branch = state.branches.get(branchId);
      if (!branch) return state;

      const newBranches = new Map(state.branches);
      newBranches.set(branchId, { ...branch, name });

      return { branches: newBranches };
    });
  },

  getBranch: (branchId: string) => {
    return get().branches.get(branchId);
  },

  getBranchHistory: (branchId: string) => {
    const branch = get().branches.get(branchId);
    return branch?.messageIds || [];
  },

  getChildBranches: (messageId: string) => {
    return get().branchPoints.get(messageId) || [];
  },

  reset: () => {
    set({
      ...initialState,
      branches: new Map([[DEFAULT_BRANCH_ID, createDefaultBranch()]]),
      branchPoints: new Map(),
    });
  },
}));

// =============================================================================
// Atomic Selectors
// =============================================================================

export const useActiveBranchId = () => useBranchStore((s) => s.activeBranchId);
export const useActiveBranch = () =>
  useBranchStore((s) => s.branches.get(s.activeBranchId));
export const useBranches = () => useBranchStore((s) => Array.from(s.branches.values()));
export const useBranchCount = () => useBranchStore((s) => s.branches.size);
export const useHasBranches = () => useBranchStore((s) => s.branches.size > 1);
