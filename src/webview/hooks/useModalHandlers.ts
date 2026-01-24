import { useState, useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { useVSCodeSender } from './useVSCodeMessaging';
import type { ModelOption } from '../components/organisms/model-selector-modal';
import type { McpServer as McpServerPanel } from '../components/organisms/mcp-manager-panel';
import type { CliCommand, Snippet } from '../components/organisms/slash-commands-modal';
import type { InstallState } from '../components/molecules/install-modal';

/**
 * Hook for modal-related handlers
 * Extracts modal handling logic from App.tsx
 */
export function useModalHandlers() {
  const { openModal, closeModal, toggleModal } = useUIStore();
  const { setChatName, conversations, setActiveConversationId, clearConversationNeedsResponse } = useChatStore();
  const {
    setWslEnabled,
    setWslDistribution,
    setNodePath,
    setClaudePath,
    setYoloMode,
    setCompactToolOutput,
    setToolCategoryPreview,
    setShowTodoList,
    mcpServers,
    toolPreviewSettings,
  } = useSettingsStore();

  const {
    renameChat,
    updateSettings: updateSettingsBackend,
    enableYoloMode,
    loadConversation,
    requestConversations,
    selectModel,
    openModelTerminal,
    saveMCPServer,
    deleteMCPServer,
    executeSlashCommand,
    runInstall,
  } = useVSCodeSender();

  // Install state
  const [installState, setInstallState] = useState<InstallState>('initial');

  // ==========================================================================
  // Header Handlers
  // ==========================================================================

  const handleSettings = useCallback(() => {
    openModal('settings');
  }, [openModal]);

  const handleHistory = useCallback(() => {
    toggleModal('history');
    requestConversations();
  }, [toggleModal, requestConversations]);

  const handleRename = useCallback((newName: string) => {
    setChatName(newName);
    renameChat(newName);
  }, [setChatName, renameChat]);

  // ==========================================================================
  // Settings Modal Handlers
  // ==========================================================================

  const handleWslEnabledChange = useCallback((enabled: boolean) => {
    setWslEnabled(enabled);
    updateSettingsBackend({ wslEnabled: enabled });
  }, [setWslEnabled, updateSettingsBackend]);

  const handleWslDistributionChange = useCallback((value: string) => {
    setWslDistribution(value);
    updateSettingsBackend({ wslDistribution: value });
  }, [setWslDistribution, updateSettingsBackend]);

  const handleNodePathChange = useCallback((value: string) => {
    setNodePath(value);
    updateSettingsBackend({ nodePath: value });
  }, [setNodePath, updateSettingsBackend]);

  const handleClaudePathChange = useCallback((value: string) => {
    setClaudePath(value);
    updateSettingsBackend({ claudePath: value });
  }, [setClaudePath, updateSettingsBackend]);

  const handleYoloModeChange = useCallback((enabled: boolean) => {
    setYoloMode(enabled);
    if (enabled) {
      enableYoloMode();
    }
  }, [setYoloMode, enableYoloMode]);

  const handleCompactToolOutputChange = useCallback((enabled: boolean) => {
    setCompactToolOutput(enabled);
    updateSettingsBackend({ compactToolOutput: enabled });
  }, [setCompactToolOutput, updateSettingsBackend]);

  const handleToolCategoryPreviewChange = useCallback((category: string, config: { inputLines?: number; outputLines?: number }) => {
    setToolCategoryPreview(category as any, config);
    // Optionally persist to backend - for now just update local state
  }, [setToolCategoryPreview]);

  const handleShowTodoListChange = useCallback((enabled: boolean) => {
    setShowTodoList(enabled);
    updateSettingsBackend({ showTodoList: enabled });
  }, [setShowTodoList, updateSettingsBackend]);

  const handleManageMcpServers = useCallback(() => {
    closeModal();
    openModal('mcpServers');
  }, [closeModal, openModal]);

  // ==========================================================================
  // History Panel Handlers
  // ==========================================================================

  const handleSelectConversation = useCallback((historyConv: { id: string; source: 'chat' | 'cli'; title?: string }) => {
    // historyConv.id is the filename (e.g., "uuid.jsonl"), not the sessionId
    // Match by filename OR by id (which is set to filename in useFileHandlers)
    const original = conversations.find((c) => c.filename === historyConv.id || c.id === historyConv.id);
    if (original) {
      const title = original.firstUserMessage || original.name || 'Claude Code Chat';
      setChatName(title);
      loadConversation(original.filename, original.source, original.cliPath);

      // Set as active conversation using sessionId (UUID without .jsonl)
      const sessionId = original.sessionId || historyConv.id.replace('.jsonl', '');
      setActiveConversationId(sessionId);
      clearConversationNeedsResponse(sessionId);
    } else {
      console.warn('[handleSelectConversation] Conversation not found:', historyConv.id);
    }
    closeModal();
  }, [conversations, loadConversation, closeModal, setChatName, setActiveConversationId, clearConversationNeedsResponse]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRestoreCheckpoint = useCallback((conversation: { id: string }, checkpoint: { sha: string }) => {
    // TODO: Implement checkpoint restore
    console.log('Restore checkpoint:', conversation.id, checkpoint.sha);
  }, []);

  // ==========================================================================
  // Model Selector Handlers
  // ==========================================================================

  const handleSelectModel = useCallback((model: ModelOption) => {
    const modelMap: Record<ModelOption, string> = {
      opus: 'Opus',
      sonnet: 'Sonnet',
      default: 'Default',
    };
    selectModel(modelMap[model]);
    closeModal();
  }, [selectModel, closeModal]);

  const handleConfigureModel = useCallback(() => {
    openModelTerminal();
  }, [openModelTerminal]);

  // ==========================================================================
  // MCP Servers Panel Handlers
  // ==========================================================================

  const handleToggleMcpServer = useCallback((id: string) => {
    // TODO: Update server enabled state via backend
    console.log('Toggle MCP server:', id);
  }, []);

  const handleDeleteMcpServer = useCallback((id: string) => {
    deleteMCPServer(id);
  }, [deleteMCPServer]);

  const handleSaveMcpServer = useCallback((server: Partial<McpServerPanel>) => {
    if (!server.name) return;
    saveMCPServer(server.name, {
      type: server.type || 'stdio',
      command: server.command,
      args: server.args,
      url: server.url,
      env: server.env,
    });
  }, [saveMCPServer]);

  // ==========================================================================
  // Slash Commands Modal Handlers
  // ==========================================================================

  const handleSelectCliCommand = useCallback((command: CliCommand) => {
    executeSlashCommand(command.command);
    closeModal();
  }, [executeSlashCommand, closeModal]);

  // This needs to update input, which is in useChatActions
  // So we return a handler factory
  const createSnippetHandler = useCallback((setInputValue: (fn: (prev: string) => string) => void) => {
    return (snippet: Snippet) => {
      setInputValue((prev) => prev + ` ${snippet.label}`);
      closeModal();
    };
  }, [closeModal]);

  // ==========================================================================
  // Install Modal Handlers
  // ==========================================================================

  const handleInstall = useCallback(() => {
    setInstallState('installing');
    runInstall();
  }, [runInstall]);

  const handleViewDocs = useCallback(() => {
    window.open('https://docs.anthropic.com/claude-code', '_blank');
  }, []);

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  // Convert store MCP servers to panel format
  const panelMcpServers: McpServerPanel[] = mcpServers.map((s) => ({
    id: s.id,
    name: s.name,
    type: (s.type || 'stdio') as 'http' | 'sse' | 'stdio',
    status: s.enabled ? 'running' as const : 'disabled' as const,
    url: s.url,
    command: s.command,
    args: s.args,
    env: s.env,
  }));

  return {
    // Install state
    installState,

    // Header handlers
    handleSettings,
    handleHistory,
    handleRename,

    // Settings handlers
    handleWslEnabledChange,
    handleWslDistributionChange,
    handleNodePathChange,
    handleClaudePathChange,
    handleYoloModeChange,
    handleCompactToolOutputChange,
    toolPreviewSettings,
    handleToolCategoryPreviewChange,
    handleShowTodoListChange,
    handleManageMcpServers,

    // History handlers
    handleSelectConversation,
    handleRestoreCheckpoint,

    // Model handlers
    handleSelectModel,
    handleConfigureModel,

    // MCP handlers
    handleToggleMcpServer,
    handleDeleteMcpServer,
    handleSaveMcpServer,
    panelMcpServers,

    // Slash command handlers
    handleSelectCliCommand,
    createSnippetHandler,

    // Install handlers
    handleInstall,
    handleViewDocs,
  };
}
