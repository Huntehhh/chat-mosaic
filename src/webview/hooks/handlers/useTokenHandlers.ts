import { useMemo } from 'react';
import { useChatStore } from '../../stores/chatStore';
import type { ContextLevel } from '../../components/ui/context-progress-bar';

/**
 * Token update data from backend
 * Supports both incremental updates (currentInputTokens) and absolute sets (setTokensInput)
 */
interface TokenUpdateData {
  // Incremental values (add to existing totals)
  currentInputTokens?: number;
  currentOutputTokens?: number;
  // Absolute values (replace totals - used for session restore)
  setTokensInput?: number;
  setTokensOutput?: number;
  // Additional fields
  totalCost?: number;
  requestCount?: number;
}

/**
 * Handlers for token, cost, and context updates
 * Message types: updateTokens, updateTotals, updateContext
 */
export function useTokenHandlers() {
  const { updateTokens, setTokens, setTotalCost, setRequestCount, setContext } = useChatStore();

  return useMemo(() => ({
    /**
     * Handle token updates from backend
     * - If setTokensInput/setTokensOutput present: SET absolute values (restore mode)
     * - If currentInputTokens/currentOutputTokens present: ADD incremental values (streaming mode)
     */
    updateTokens: (data: TokenUpdateData) => {
      // Check for absolute set mode first (session restore)
      if (data.setTokensInput !== undefined || data.setTokensOutput !== undefined) {
        setTokens(data.setTokensInput || 0, data.setTokensOutput || 0);
        if (data.totalCost !== undefined) setTotalCost(data.totalCost);
        if (data.requestCount !== undefined) setRequestCount(data.requestCount);
        return;
      }

      // Incremental add mode (normal streaming)
      updateTokens(data.currentInputTokens || 0, data.currentOutputTokens || 0);
    },

    updateTotals: (data: {
      totalCost?: number;
      requestCount?: number;
      totalTokensInput?: number;
      totalTokensOutput?: number;
    }) => {
      if (data.totalCost !== undefined) setTotalCost(data.totalCost);
      if (data.requestCount !== undefined) setRequestCount(data.requestCount);
      if (data.totalTokensInput !== undefined || data.totalTokensOutput !== undefined) {
        setTokens(data.totalTokensInput || 0, data.totalTokensOutput || 0);
      }
    },

    updateContext: (data: {
      contextTokens?: number;
      contextPercentage?: number;
      contextLevel?: ContextLevel;
    }) => {
      setContext(
        data.contextTokens || 0,
        data.contextPercentage || 0,
        data.contextLevel || 'low'
      );
    },
  }), [updateTokens, setTokens, setTotalCost, setRequestCount, setContext]);
}
