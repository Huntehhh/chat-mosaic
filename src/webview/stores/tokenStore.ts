import { create } from 'zustand';

// =============================================================================
// Token & Context State Types
// =============================================================================
//
// ARCHITECTURE NOTE (Phase 2 TODO):
// This store was extracted from chatStore but handlers still use chatStore.
// chatStore re-exports this at the end for type compatibility.
// To complete migration:
// 1. Update useTokenHandlers to import from './tokenStore' instead of chatStore
// 2. Update components reading token state to use useTokenStore
// 3. Remove duplicate token state from chatStore
// =============================================================================

export type ContextLevel = 'low' | 'medium' | 'high' | 'critical';

interface TokenState {
  // Tokens & Cost
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCost: number;
  requestCount: number;
  subscriptionType: string | null;

  // Context Window Tracking
  contextTokens: number;           // Total tokens counting toward context window
  contextPercentage: number;       // 0-100 percentage of context used
  contextLevel: ContextLevel;      // Color coding level

  // =========================================================================
  // Actions
  // =========================================================================

  // Token & Cost actions
  updateTokens: (input: number, output: number) => void;
  setTokens: (input: number, output: number) => void;
  setTotalCost: (cost: number) => void;
  setRequestCount: (count: number) => void;
  setSubscriptionType: (type: string | null) => void;

  // Context Window actions
  setContext: (tokens: number, percentage: number, level: ContextLevel) => void;
  resetContext: () => void;

  // Reset all token state (for new sessions)
  resetTokens: () => void;
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useTokenStore = create<TokenState>((set) => ({
  // Initial state
  totalTokensInput: 0,
  totalTokensOutput: 0,
  totalCost: 0,
  requestCount: 0,
  subscriptionType: null,
  contextTokens: 0,
  contextPercentage: 0,
  contextLevel: 'low',

  // Token & cost actions
  updateTokens: (input, output) =>
    set((s) => ({
      totalTokensInput: s.totalTokensInput + input,
      totalTokensOutput: s.totalTokensOutput + output,
    })),

  setTokens: (input, output) =>
    set({ totalTokensInput: input, totalTokensOutput: output }),

  setTotalCost: (cost) => set({ totalCost: cost }),

  setRequestCount: (count) => set({ requestCount: count }),

  setSubscriptionType: (type) => set({ subscriptionType: type }),

  // Context window actions
  setContext: (tokens, percentage, level) => set({
    contextTokens: tokens,
    contextPercentage: percentage,
    contextLevel: level,
  }),

  resetContext: () => set({
    contextTokens: 0,
    contextPercentage: 0,
    contextLevel: 'low',
  }),

  // Reset all token state
  resetTokens: () => set({
    totalTokensInput: 0,
    totalTokensOutput: 0,
    totalCost: 0,
    requestCount: 0,
    contextTokens: 0,
    contextPercentage: 0,
    contextLevel: 'low',
  }),
}));
