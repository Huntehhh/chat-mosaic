import { useMemo } from 'react';
import { useChatStore, type PermissionRequest } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';

/**
 * Handlers for chat messages, tool use, permissions, and processing state
 * Message types: userInput, output, thinking, error, system, systemMessage,
 *                streamingMessage, toolUse, toolResult, permissionRequest,
 *                updatePermissionStatus, expirePendingPermissions,
 *                setProcessing, loading, compacting, clearLoading,
 *                todosUpdated, clipboardText, responseComplete, messageAck
 * Note: permissionsList/permissionsData handled by useUiHandlers (settingsStore)
 */
export function useChatHandlers() {
  const {
    addMessage,
    updateLastMessage,
    setProcessing,
    addPendingPermission,
    updatePermissionStatus,
    clearPendingPermissions,
    setTodos,
    setClipboardText,
    setConversationNeedsResponse,
    activeConversationId,
    removePendingMessage,
  } = useChatStore();

  const {
    showThinkingOverlay,
    hideThinkingOverlay,
  } = useUIStore();

  return useMemo(() => ({
    // Message types
    userInput: (data: string | { content: string }) => {
      const content = typeof data === 'string' ? data : data.content;
      addMessage({ type: 'user', content, timestamp: Date.now() });
    },

    output: (data: string | { content: string }) => {
      const content = typeof data === 'string' ? data : data.content;
      addMessage({ type: 'claude', content, timestamp: Date.now() });
    },

    thinking: (data: string | { content: string }) => {
      const content = typeof data === 'string' ? data : data.content;
      addMessage({ type: 'thinking', content, timestamp: Date.now() });
    },

    error: (data: string | unknown) => {
      const content = typeof data === 'string' ? data : String(data);
      addMessage({ type: 'error', content, timestamp: Date.now() });
    },

    system: (data: string | { content: string }) => {
      const content = typeof data === 'string' ? data : data.content;
      addMessage({ type: 'system', content, timestamp: Date.now() });
    },

    systemMessage: (data: string | { content: string }) => {
      const content = typeof data === 'string' ? data : data.content;
      addMessage({ type: 'system', content, timestamp: Date.now() });
    },

    // Streaming
    streamingMessage: (data: { content: string }) => {
      updateLastMessage(data.content);
    },

    // Tool use
    toolUse: (data: {
      toolName: string;
      toolInfo: string;
      rawInput?: Record<string, unknown>;
      filePath?: string;
      oldContent?: string;
      newContent?: string;
      toolUseId?: string;
    }) => {
      addMessage({
        type: 'tool-use',
        content: data.toolInfo,
        toolName: data.toolName,
        toolInput: data.rawInput,
        filePath: data.filePath,
        oldContent: data.oldContent,
        newContent: data.newContent,
        toolUseId: data.toolUseId,
        timestamp: Date.now(),
      });
    },

    toolResult: (data: {
      toolName: string;
      content?: string;  // Backend sends 'content', not 'result'
      result?: string;   // Keep for backward compatibility
      isError?: boolean;
      toolUseId?: string;
      newContent?: string;
      fileContentAfter?: string;
      hidden?: boolean;
    }) => {
      // Note: 'hidden' flag from backend indicates this result shouldn't show output
      // (e.g., Read tool success results). We still add the message but mark it.
      addMessage({
        type: 'tool-result',
        content: data.hidden ? '' : (data.content || data.result || ''),
        toolName: data.toolName,
        isError: data.isError,
        toolUseId: data.toolUseId,
        newContent: data.newContent || data.fileContentAfter,
        timestamp: Date.now(),
      });
    },

    // Permissions
    permissionRequest: (data: {
      id: string;
      tool: string;
      input: Record<string, unknown>;
      suggestions?: string[];
      decisionReason?: string;
    }) => {
      const permission: PermissionRequest = {
        id: data.id,
        tool: data.tool,
        input: data.input,
        suggestions: data.suggestions,
        decisionReason: data.decisionReason,
        status: 'pending',
      };
      addPendingPermission(permission);
      addMessage({
        type: 'permission',
        content: JSON.stringify(data.input),
        permissionId: data.id,
        toolName: data.tool,
        permissionSuggestions: data.suggestions,
        decisionReason: data.decisionReason,
        timestamp: Date.now(),
      });
    },

    updatePermissionStatus: (data: { id: string; status: 'approved' | 'denied' }) => {
      updatePermissionStatus(data.id, data.status);
    },

    // Note: permissionsList and permissionsData are handled by useUiHandlers
    // (they update settingsStore.permissions, not chatStore)

    expirePendingPermissions: () => {
      clearPendingPermissions();
    },

    // Processing state
    setProcessing: (data: { isProcessing: boolean }) => {
      setProcessing(data.isProcessing);
      if (!data.isProcessing) {
        hideThinkingOverlay();
      }
    },

    loading: (data: { loading: boolean; message?: string }) => {
      if (data.loading) {
        showThinkingOverlay();
      } else {
        hideThinkingOverlay();
      }
    },

    compacting: (data: { compacting: boolean }) => {
      if (data.compacting) {
        showThinkingOverlay();
      } else {
        hideThinkingOverlay();
      }
    },

    clearLoading: () => {
      setProcessing(false);
      hideThinkingOverlay();
    },

    // Todos
    todosUpdated: (data: Array<{ content: string; status: string; id?: string }>) => {
      setTodos(data);
    },

    // Clipboard
    clipboardText: (data: string) => {
      setClipboardText(data);
    },

    // Response complete (for visual indicator on conversation items)
    responseComplete: (data: { conversationId: string }) => {
      // Only mark as "needs response" if this is NOT the active conversation
      if (data.conversationId && data.conversationId !== activeConversationId) {
        setConversationNeedsResponse(data.conversationId, true);
      }
    },

    // Message acknowledgement (for concurrent message queue)
    messageAck: (data: { messageId: string }) => {
      removePendingMessage(data.messageId);
    },
  }), [
    addMessage,
    updateLastMessage,
    setProcessing,
    addPendingPermission,
    updatePermissionStatus,
    clearPendingPermissions,
    setTodos,
    setClipboardText,
    setConversationNeedsResponse,
    activeConversationId,
    removePendingMessage,
    showThinkingOverlay,
    hideThinkingOverlay,
  ]);
}
