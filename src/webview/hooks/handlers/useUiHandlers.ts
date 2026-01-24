import { useMemo } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUIStore } from '../../stores/uiStore';

/**
 * Handlers for UI-related messages (modals, toasts, installation, model selection)
 * Message types: showInstallModal, installComplete, toast, loginRequired,
 *                modelSelected, scrollToBottom, restoreError, restoreProgress, imagePath,
 *                bufferOverflow, processExited
 */
export function useUiHandlers() {
  const { addMessage, setProcessing, addPendingImage } = useChatStore();
  const { setModel, setPermissions } = useSettingsStore();
  const { openModal, closeModal, showToast, hideThinkingOverlay } = useUIStore();

  return useMemo(() => ({
    showInstallModal: () => {
      openModal('install');
    },

    installComplete: (data: { success: boolean; error?: string }) => {
      if (data.success) {
        closeModal();
      } else if (data.error) {
        addMessage({
          type: 'error',
          content: `Installation failed: ${data.error}`,
          timestamp: Date.now(),
        });
      }
    },

    toast: (data: { message: string; duration?: number }) => {
      showToast(data.message, data.duration);
    },

    loginRequired: () => {
      // TODO: Show login required UI
      console.log('[VSCode Messaging] Login required');
    },

    modelSelected: (data: { model: string } | undefined) => {
      if (data?.model) {
        setModel(data.model);
      }
    },

    terminalOpened: () => {
      // Terminal was opened - could show notification
    },

    scrollToBottom: () => {
      // This can be handled by the MessageList component via a ref
    },

    restoreError: (data: unknown) => {
      console.log('[Restore Error]', data);
    },

    restoreProgress: (data: unknown) => {
      console.log('[Restore Progress]', data);
    },

    imagePath: (data: unknown) => {
      // Handle image path from backend (file picker or clipboard paste)
      // Two formats: { path: string } from selectImageFile or { filePath: string } from createImageFile
      const dataObj = data as Record<string, unknown>;
      const filePath = (dataObj?.filePath || dataObj?.path) as string | undefined;

      if (filePath) {
        const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        // Convert file path to file:// URI for display in webview
        const normalizedPath = filePath.replace(/\\/g, '/');
        const src = normalizedPath.startsWith('/')
          ? `file://${normalizedPath}`
          : `file:///${normalizedPath}`;

        addPendingImage({ id, src, path: filePath });
        console.log('[Image Path] Added pending image:', filePath);
      } else {
        console.warn('[Image Path] No valid path in data:', data);
      }
    },

    // Permission data is handled here since it updates settingsStore
    permissionsList: (data: { alwaysAllow: Record<string, boolean | string[]> }) => {
      setPermissions(data.alwaysAllow);
    },

    permissionsData: (data: { alwaysAllow: Record<string, boolean | string[]> }) => {
      setPermissions(data.alwaysAllow);
    },

    // Stream/process events from backend
    bufferOverflow: (data?: { size?: number; maxSize?: number }) => {
      console.warn('[Stream Buffer] Overflow detected:', data);
      showToast('Stream buffer overflow - some output may be truncated', 5000);
    },

    processExited: (data?: { code?: number; signal?: string }) => {
      console.log('[Process] Exited:', data);
      setProcessing(false);
      hideThinkingOverlay();
      if (data?.signal === 'SIGTERM') {
        showToast('Process stopped', 2000);
      } else if (data?.code !== 0 && data?.code !== undefined) {
        showToast(`Process exited with code ${data.code}`, 3000);
      }
    },
  }), [openModal, closeModal, showToast, addMessage, setModel, setPermissions, setProcessing, hideThinkingOverlay, addPendingImage]);
}
