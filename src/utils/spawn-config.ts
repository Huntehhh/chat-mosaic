/**
 * Shared configuration for Claude CLI spawning.
 *
 * This module provides a single source of truth for spawn configuration,
 * ensuring both ProcessManager (background processes) and TerminalManager
 * (interactive terminals) use identical settings.
 *
 * This prevents path/shell divergence issues like the MCP bug where different
 * path formats caused Claude to treat the same directory as different projects.
 */

import * as vscode from 'vscode';
import * as os from 'os';
import { normalizePathForOS } from './claude-args';

// =============================================================================
// Types
// =============================================================================

/**
 * Shared configuration for spawning Claude CLI processes and terminals.
 * Built once from VS Code settings and shared across all spawn operations.
 */
export interface ClaudeSpawnConfig {
  /** Working directory (normalized for OS) */
  cwd: string;
  /** Whether to run through WSL (Windows only) */
  wslEnabled: boolean;
  /** WSL distribution name (e.g., 'Ubuntu') */
  wslDistro: string;
  /** Path to Claude CLI in WSL */
  claudePath: string;
  /** Path to Node.js in WSL */
  nodePath: string;
  /** Skip all permission prompts (YOLO mode) */
  yoloMode: boolean;
  /** Use plan mode for permission handling */
  planMode: boolean;
  /** Selected model (e.g., 'claude-3-opus', 'default') */
  model: string;
  /** Thinking intensity ('disabled', 'think', 'think-hard', 'think-harder', 'ultrathink') */
  thinkingIntensity: string;
  /** Whether thinking mode is enabled */
  thinkingMode: boolean;
}

// =============================================================================
// Config Builder
// =============================================================================

/**
 * Build spawn configuration from VS Code settings.
 *
 * Call this once when settings change and pass the config to both
 * ProcessManager and TerminalManager.
 *
 * @param workspaceFolder - Optional workspace folder to use for cwd
 * @returns Shared spawn configuration
 *
 * @example
 * const config = buildSpawnConfig();
 * const processManager = new ProcessManager(config, callbacks);
 * const terminalManager = new TerminalManager(config);
 */
export function buildSpawnConfig(workspaceFolder?: string): ClaudeSpawnConfig {
  const vsConfig = vscode.workspace.getConfiguration('claudeCodeChat');

  // Get cwd from workspace or provided folder, fallback to home directory
  // An empty cwd causes PowerShell Set-Location to fail on Windows
  const rawCwd = workspaceFolder ||
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
    os.homedir();

  return {
    cwd: normalizePathForOS(rawCwd) || rawCwd,
    wslEnabled: vsConfig.get<boolean>('wsl.enabled', false),
    wslDistro: vsConfig.get<string>('wsl.distro', 'Ubuntu'),
    claudePath: vsConfig.get<string>('wsl.claudePath', '/usr/local/bin/claude'),
    nodePath: vsConfig.get<string>('wsl.nodePath', '/usr/bin/node'),
    yoloMode: vsConfig.get<boolean>('yoloMode', false),
    planMode: vsConfig.get<boolean>('planMode', false),
    model: vsConfig.get<string>('model', 'default'),
    thinkingIntensity: vsConfig.get<string>('thinkingIntensity', 'think'),
    thinkingMode: vsConfig.get<boolean>('thinkingMode', false),
  };
}

/**
 * Check if two spawn configs have the same platform/WSL settings.
 * Used to determine if a process restart is needed.
 */
export function hasPlatformConfigChanged(
  oldConfig: ClaudeSpawnConfig | undefined,
  newConfig: ClaudeSpawnConfig
): boolean {
  if (!oldConfig) return true;

  return (
    oldConfig.cwd !== newConfig.cwd ||
    oldConfig.wslEnabled !== newConfig.wslEnabled ||
    oldConfig.wslDistro !== newConfig.wslDistro ||
    oldConfig.claudePath !== newConfig.claudePath ||
    oldConfig.nodePath !== newConfig.nodePath
  );
}

/**
 * Check if permission-related config has changed.
 * Used to determine if a process restart is needed for permission mode changes.
 */
export function hasPermissionConfigChanged(
  oldConfig: ClaudeSpawnConfig | undefined,
  newConfig: ClaudeSpawnConfig
): boolean {
  if (!oldConfig) return true;

  return (
    oldConfig.yoloMode !== newConfig.yoloMode ||
    oldConfig.planMode !== newConfig.planMode
  );
}

/**
 * Check if thinking-related config has changed.
 * Used to update Claude's global settings file.
 */
export function hasThinkingConfigChanged(
  oldConfig: ClaudeSpawnConfig | undefined,
  newConfig: ClaudeSpawnConfig
): boolean {
  if (!oldConfig) return true;

  return (
    oldConfig.thinkingMode !== newConfig.thinkingMode ||
    oldConfig.thinkingIntensity !== newConfig.thinkingIntensity
  );
}
