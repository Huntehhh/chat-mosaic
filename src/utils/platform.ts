/**
 * Platform Detection and Utilities
 *
 * Single source of truth for all platform-specific checks.
 * Consolidates scattered `process.platform` checks throughout the codebase.
 *
 * @module platform
 */

import * as os from 'os';

// =============================================================================
// Platform Detection
// =============================================================================

/**
 * Platform detection flags and utilities.
 * Use these instead of direct `process.platform` checks.
 */
export const Platform = {
  /** Running on Windows */
  isWindows: process.platform === 'win32',

  /** Running on macOS */
  isMacOS: process.platform === 'darwin',

  /** Running on Linux */
  isLinux: process.platform === 'linux',

  /** Running on any Unix-like system (macOS or Linux) */
  isUnix: process.platform !== 'win32',

  /** CPU architecture */
  arch: process.arch as 'x64' | 'arm64' | 'ia32' | string,

  /** Platform name for logging */
  name: process.platform,
};

// =============================================================================
// Shell Detection
// =============================================================================

export type ShellType = 'powershell' | 'cmd' | 'bash' | 'zsh' | 'fish' | 'sh';

/**
 * Get the default shell for the current platform.
 *
 * @returns Shell executable path or name
 */
export function getDefaultShell(): string {
  if (Platform.isWindows) {
    return 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

/**
 * Detect the shell type from a shell path.
 *
 * @param shellPath - Path to shell executable (defaults to $SHELL or platform default)
 * @returns Detected shell type
 */
export function detectShellType(shellPath?: string): ShellType {
  const shell = shellPath || getDefaultShell();
  const shellLower = shell.toLowerCase();

  if (shellLower.includes('powershell') || shellLower.includes('pwsh')) {
    return 'powershell';
  }
  if (shellLower.includes('cmd')) {
    return 'cmd';
  }
  if (shellLower.includes('fish')) {
    return 'fish';
  }
  if (shellLower.includes('zsh')) {
    return 'zsh';
  }
  if (shellLower.includes('bash')) {
    return 'bash';
  }

  // Default to sh for unknown shells
  return 'sh';
}

// =============================================================================
// WSL Detection
// =============================================================================

/**
 * Check if running inside WSL (Windows Subsystem for Linux).
 *
 * @returns true if running inside WSL
 */
export function isWSLEnvironment(): boolean {
  return !!process.env.WSL_DISTRO_NAME;
}

/**
 * Check if running on Windows with WSL available.
 * Note: This doesn't check if WSL is actually installed, just if we're on Windows.
 *
 * @returns true if WSL could potentially be used
 */
export function isWSLCapable(): boolean {
  return Platform.isWindows;
}

// =============================================================================
// Home Directory
// =============================================================================

/**
 * Get the user's home directory.
 * Uses os.homedir() which works correctly on all platforms.
 *
 * @returns Absolute path to home directory
 */
export function getHomeDir(): string {
  return os.homedir();
}

// =============================================================================
// Installation Commands
// =============================================================================

/**
 * Get the Claude CLI installation command for the current platform.
 *
 * @param useNpm - If true and Node >= 18, use npm install instead
 * @returns Installation command string
 */
export function getInstallCommand(useNpm: boolean = false): string {
  if (useNpm) {
    return 'npm install -g @anthropic-ai/claude-code';
  }

  if (Platform.isWindows) {
    return 'irm https://claude.ai/install.ps1 | iex';
  }

  return 'curl -fsSL https://claude.ai/install.sh | sh';
}

// =============================================================================
// Platform Info for Logging/Debugging
// =============================================================================

/**
 * Get platform information for logging and debugging.
 *
 * @returns Object with platform details
 */
export function getPlatformInfo(): {
  platform: string;
  arch: string;
  shell: string;
  homeDir: string;
  isWSL: boolean;
  nodeVersion: string;
} {
  return {
    platform: Platform.name,
    arch: Platform.arch,
    shell: getDefaultShell(),
    homeDir: getHomeDir(),
    isWSL: isWSLEnvironment(),
    nodeVersion: process.version,
  };
}
