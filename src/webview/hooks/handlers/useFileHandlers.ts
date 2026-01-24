import { useMemo } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { CommitInfo, ConversationListItem, WorkspaceFile, CustomSnippet } from '../../../types/messages';

/**
 * Handlers for file, workspace, conversation, and checkpoint operations
 * Message types: workspaceFiles, checkpoints, checkpointsList, showRestoreOption,
 *                conversationList, conversationHistory, customSnippets
 */
export function useFileHandlers() {
  const {
    setWorkspaceFiles,
    setCommits,
    addCommit,
    setConversations,
    clearMessages,
    addMessage,
  } = useChatStore();
  const { setCustomSnippets } = useSettingsStore();

  return useMemo(() => ({
    workspaceFiles: (data: WorkspaceFile[]) => {
      setWorkspaceFiles(data);
    },

    checkpoints: (data: CommitInfo[]) => {
      setCommits(data);
    },

    // Note: checkpointsList removed - duplicate of checkpoints handler

    showRestoreOption: (data: CommitInfo) => {
      addCommit(data);
    },

    conversationList: (data: ConversationListItem[]) => {
      setConversations(data.map((c) => ({
        ...c,
        // Use filename as unique ID (sessionId can be duplicated across files)
        id: c.filename || c.sessionId,
        name: c.firstUserMessage,
        lastModified: c.startTime,
        preview: c.lastUserMessage || '',
      })));
    },

    conversationHistory: (data: { messages: Array<{ type: string; data: unknown }> }) => {
      clearMessages();
      data.messages.forEach((m) => {
        if (m.type === 'userInput') {
          addMessage({ type: 'user', content: String(m.data), timestamp: Date.now() });
        } else if (m.type === 'output') {
          addMessage({ type: 'claude', content: String(m.data), timestamp: Date.now() });
        }
      });
    },

    customSnippets: (data: CustomSnippet[]) => {
      setCustomSnippets(data);
    },

    // Note: customSnippetsData removed - duplicate of customSnippets handler

    customSnippetSaved: () => {
      // Refresh snippets list after save - handled automatically
    },

    customSnippetDeleted: () => {
      // Refresh snippets list after delete - handled automatically
    },
  }), [setWorkspaceFiles, setCommits, addCommit, setConversations, clearMessages, addMessage, setCustomSnippets]);
}
