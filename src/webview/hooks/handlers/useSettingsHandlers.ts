import { useMemo } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useSettingsStore } from '../../stores/settingsStore';

/** Map VS Code config keys to frontend store keys */
const CONFIG_TO_STORE_MAP: Record<string, string> = {
  'thinking.mode': 'thinkingMode',
  'mode.plan': 'planMode',
  'thinking.intensity': 'thinkingIntensity',
  'wsl.enabled': 'wslEnabled',
  'wsl.distro': 'wslDistribution',
  'wsl.nodePath': 'nodePath',
  'wsl.claudePath': 'claudePath',
  'permissions.yoloMode': 'yoloMode',
  'compact.toolOutput': 'compactToolOutput',
  'display.showTodoList': 'showTodoList',
};

/**
 * Handlers for settings and configuration updates
 * Message types: settings, settingsData, platformInfo, accountInfo, workspacePath
 */
export function useSettingsHandlers() {
  const { setSubscriptionType } = useChatStore();
  const { updateSettings, setPlatformInfo, setWorkspacePath } = useSettingsStore();

  return useMemo(() => ({
    settings: (data: Record<string, unknown>) => {
      updateSettings(data);
    },

    settingsData: (data: Record<string, unknown>) => {
      // Map VS Code config keys to frontend store keys
      const mapped: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        const storeKey = CONFIG_TO_STORE_MAP[key] || key;
        mapped[storeKey] = value;
      }
      updateSettings(mapped);
    },

    platformInfo: (data: {
      platform: string;
      isWindows: boolean;
      wslAlertDismissed: boolean;
      wslEnabled: boolean;
    }) => {
      setPlatformInfo(data);
    },

    accountInfo: (data: { subscriptionType?: string }) => {
      if (data.subscriptionType) {
        setSubscriptionType(data.subscriptionType);
      }
    },

    workspacePath: (data: string) => {
      setWorkspacePath(data);
    },
  }), [updateSettings, setPlatformInfo, setSubscriptionType, setWorkspacePath]);
}
