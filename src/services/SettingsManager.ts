/**
 * SettingsManager - Handles VS Code configuration read/write for the extension
 *
 * Centralizes all settings operations to ensure consistent key mapping
 * between frontend and VS Code configuration.
 */

import * as vscode from 'vscode';

const CONFIG_NAMESPACE = 'claudeCodeChat';

/** Frontend key to VS Code config key mapping */
const KEY_MAP: Record<string, string> = {
  'wslEnabled': 'wsl.enabled',
  'wslDistribution': 'wsl.distro',
  'nodePath': 'wsl.nodePath',
  'claudePath': 'wsl.claudePath',
  'compactToolOutput': 'compact.toolOutput',
  'compactMcpCalls': 'compact.mcpCalls',
  'previewHeight': 'compact.previewHeight',
  'showTodoList': 'display.showTodoList',
  'yoloMode': 'permissions.yoloMode',
  'thinkingIntensity': 'thinking.intensity',
  'thinkingMode': 'thinking.mode',
  'planMode': 'mode.plan',
};

/** Settings that should use workspace-level configuration */
const WORKSPACE_SETTINGS = new Set(['permissions.yoloMode']);

export interface SettingsManagerCallbacks {
  postMessage: (msg: any) => void;
}

export interface SettingsData {
  'thinking.intensity': string;
  'thinking.mode': boolean;
  'mode.plan': boolean;
  'wsl.enabled': boolean;
  'wsl.distro': string;
  'wsl.nodePath': string;
  'wsl.claudePath': string;
  'permissions.yoloMode': boolean;
  'compact.enabled': boolean;
  'compact.previewHeight': number;
}

export class SettingsManager {
  private _callbacks: SettingsManagerCallbacks;

  constructor(callbacks: SettingsManagerCallbacks) {
    this._callbacks = callbacks;
  }

  /**
   * Get current settings and send to webview
   */
  sendCurrentSettings(): void {
    const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    const settings: SettingsData = {
      'thinking.intensity': config.get<string>('thinking.intensity', 'think'),
      'thinking.mode': config.get<boolean>('thinking.mode', true),
      'mode.plan': config.get<boolean>('mode.plan', false),
      'wsl.enabled': config.get<boolean>('wsl.enabled', false),
      'wsl.distro': config.get<string>('wsl.distro', 'Ubuntu'),
      'wsl.nodePath': config.get<string>('wsl.nodePath', '/usr/bin/node'),
      'wsl.claudePath': config.get<string>('wsl.claudePath', '/usr/local/bin/claude'),
      'permissions.yoloMode': config.get<boolean>('permissions.yoloMode', false),
      'compact.enabled': config.get<boolean>('compact.enabled', false),
      'compact.previewHeight': config.get<number>('compact.previewHeight', 150)
    };

    this._callbacks.postMessage({
      type: 'settingsData',
      data: settings
    });
  }

  /**
   * Update settings from frontend
   */
  updateSettings(settings: Record<string, any>): void {
    const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);

    for (const [frontendKey, value] of Object.entries(settings)) {
      const configKey = KEY_MAP[frontendKey] || frontendKey;
      console.log(`[Settings] Updating ${frontendKey} -> ${configKey} = ${value}`);

      const target = WORKSPACE_SETTINGS.has(configKey)
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;

      Promise.resolve(config.update(configKey, value, target))
        .then(() => {
          console.log(`[Settings] Successfully updated ${configKey} = ${value}`);
          this._callbacks.postMessage({
            type: 'settingUpdated',
            data: { key: configKey, value }
          });
        })
        .catch((error: any) => {
          console.error(`[Settings] Failed to update ${configKey}:`, error);
        });
    }
  }

  /**
   * Enable YOLO mode (skip all permissions)
   */
  async enableYoloMode(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
      await config.update('permissions.yoloMode', true, vscode.ConfigurationTarget.Workspace);
      console.log('YOLO Mode enabled - all future permissions will be skipped');
      this.sendCurrentSettings();
    } catch (error) {
      console.error('Error enabling YOLO mode:', error);
    }
  }

  /**
   * Get a specific configuration value
   */
  get<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    return config.get<T>(key, defaultValue);
  }

  /**
   * Check if yolo mode is enabled
   */
  isYoloMode(): boolean {
    return this.get<boolean>('permissions.yoloMode', false);
  }

  /**
   * Check if WSL is enabled
   */
  isWslEnabled(): boolean {
    return this.get<boolean>('wsl.enabled', false);
  }

  /**
   * Get WSL distribution name
   */
  getWslDistro(): string {
    return this.get<string>('wsl.distro', 'Ubuntu');
  }
}
