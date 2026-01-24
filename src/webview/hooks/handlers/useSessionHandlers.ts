import { useMemo } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { ContextLevel } from '../../components/ui/context-progress-bar';

/**
 * Handlers for session initialization and management
 * Message types: ready, sessionInfo, sessionCleared, newSession, chatRenamed, sessionResumed
 */
export function useSessionHandlers() {
  const {
    setChatName,
    setDraftMessage,
    setScrollPosition,
    setSessionId,
    setTotalCost,
    setTokens,
    setRequestCount,
    setSubscriptionType,
    setContext,
    clearMessages,
  } = useChatStore();
  const { setModel } = useSettingsStore();

  return useMemo(() => ({
    ready: (data: string | {
      chatName?: string;
      draftMessage?: string;
      scrollPosition?: number;
      selectedModel?: string;
      currentSessionId?: string;
      totalCost?: number;
      totalTokensInput?: number;
      totalTokensOutput?: number;
      requestCount?: number;
      subscriptionType?: string;
      contextTokens?: number;
      contextPercentage?: number;
      contextLevel?: ContextLevel;
    }) => {
      // Handle legacy string format (just a status message, don't reset state)
      if (typeof data === 'string') {
        console.log('[SessionHandlers] ready (string):', data);
        return;
      }

      // Handle object format with state restoration
      if (data.chatName) setChatName(data.chatName);
      if (data.draftMessage !== undefined) setDraftMessage(data.draftMessage);
      if (data.scrollPosition !== undefined) setScrollPosition(data.scrollPosition);
      if (data.selectedModel) {
        setModel(data.selectedModel);
      }
      if (data.currentSessionId) {
        setSessionId(data.currentSessionId);
      }
      if (data.totalCost !== undefined) setTotalCost(data.totalCost);
      // Use setTokens (absolute) instead of updateTokens (incremental) for restore
      if (data.totalTokensInput !== undefined || data.totalTokensOutput !== undefined) {
        setTokens(data.totalTokensInput || 0, data.totalTokensOutput || 0);
      }
      if (data.requestCount !== undefined) setRequestCount(data.requestCount);
      if (data.subscriptionType) {
        setSubscriptionType(data.subscriptionType);
      }
      // Restore context window state only if provided
      if (data.contextTokens !== undefined) {
        setContext(
          data.contextTokens,
          data.contextPercentage || 0,
          data.contextLevel || 'low'
        );
      }
    },

    sessionInfo: (data: { sessionId: string; tools?: string[] }) => {
      setSessionId(data.sessionId);
    },

    sessionCleared: () => {
      clearMessages();
      setChatName('Claude Code Chat');
    },

    newSession: () => {
      clearMessages();
      setChatName('Claude Code Chat');
    },

    chatRenamed: (data: string) => {
      setChatName(data || 'Claude Code Chat');
    },

    // Also handle updateChatName and chatNameUpdated (aliases for chatRenamed)
    updateChatName: (data: { name: string } | string) => {
      const name = typeof data === 'string' ? data : data?.name;
      setChatName(name || 'Claude Code Chat');
    },

    chatNameUpdated: (data: { name: string } | string) => {
      const name = typeof data === 'string' ? data : data?.name;
      setChatName(name || 'Claude Code Chat');
    },

    sessionResumed: (data: { sessionId: string }) => {
      setSessionId(data.sessionId);
    },

    restoreInputText: (data: string) => {
      setDraftMessage(data);
    },

    restoreScrollPosition: (data: number) => {
      setScrollPosition(data || 0);
    },
  }), [
    setChatName,
    setDraftMessage,
    setScrollPosition,
    setSessionId,
    setTotalCost,
    setTokens,
    setRequestCount,
    setSubscriptionType,
    setContext,
    clearMessages,
    setModel,
  ]);
}
