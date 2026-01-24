import { create } from 'zustand';

// =============================================================================
// Permission Types
// =============================================================================

export interface PermissionRequest {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  suggestions?: string[];
  decisionReason?: string;
  status: 'pending' | 'approved' | 'denied';
}

interface PermissionState {
  // Pending permission requests
  pendingPermissions: PermissionRequest[];

  // =========================================================================
  // Actions
  // =========================================================================

  addPendingPermission: (permission: PermissionRequest) => void;
  updatePermissionStatus: (id: string, status: 'approved' | 'denied') => void;
  removePendingPermission: (id: string) => void;
  clearPendingPermissions: () => void;
}

// =============================================================================
// Store Implementation
// =============================================================================

export const usePermissionStore = create<PermissionState>((set) => ({
  // Initial state
  pendingPermissions: [],

  // Permission actions
  addPendingPermission: (permission) => set((s) => ({
    pendingPermissions: [...s.pendingPermissions, permission],
  })),

  updatePermissionStatus: (id, status) => set((s) => ({
    pendingPermissions: s.pendingPermissions.map((p) =>
      p.id === id ? { ...p, status } : p
    ),
  })),

  removePendingPermission: (id) => set((s) => ({
    pendingPermissions: s.pendingPermissions.filter((p) => p.id !== id),
  })),

  clearPendingPermissions: () => set({ pendingPermissions: [] }),
}));
