/**
 * Cross-Platform Path Utilities
 *
 * Provides unified path handling across Windows, macOS, and Linux.
 * Includes XDG Base Directory compliance for Linux and WSL path conversion.
 *
 * XDG Base Directory Specification (Linux):
 * - $XDG_CONFIG_HOME: User config (default: ~/.config)
 * - $XDG_DATA_HOME: User data (default: ~/.local/share)
 * - $XDG_CACHE_HOME: User cache (default: ~/.cache)
 *
 * @module paths
 */

import * as os from 'os';
import * as path from 'path';
import { Platform } from './platform';

// =============================================================================
// Home Directory
// =============================================================================

/**
 * Get the user's home directory.
 * Uses os.homedir() which works correctly on all platforms.
 *
 * This replaces the buggy pattern:
 * `process.env.HOME || process.env.USERPROFILE || ''`
 *
 * @returns Absolute path to home directory
 */
export function getHomeDir(): string {
  return os.homedir();
}

// =============================================================================
// Config Directories (XDG-compliant)
// =============================================================================

/**
 * Get the configuration directory following platform conventions.
 *
 * Platform behavior:
 * - Windows: %APPDATA% (e.g., C:\Users\<user>\AppData\Roaming)
 * - macOS: ~/Library/Application Support
 * - Linux: $XDG_CONFIG_HOME or ~/.config
 *
 * @param appName - Application name for subdirectory (default: 'claude')
 * @returns Absolute path to config directory
 */
export function getConfigDir(appName: string = 'claude'): string {
  if (Platform.isWindows) {
    const appData = process.env.APPDATA ||
      path.join(getHomeDir(), 'AppData', 'Roaming');
    return path.join(appData, appName);
  }

  if (Platform.isMacOS) {
    return path.join(getHomeDir(), 'Library', 'Application Support', appName);
  }

  // Linux - XDG Base Directory compliance
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return path.join(xdgConfig, appName);
  }
  return path.join(getHomeDir(), '.config', appName);
}

/**
 * Get the data directory following platform conventions.
 *
 * Platform behavior:
 * - Windows: Same as config (AppData\Roaming)
 * - macOS: Same as config (Library/Application Support)
 * - Linux: $XDG_DATA_HOME or ~/.local/share
 *
 * @param appName - Application name for subdirectory
 * @returns Absolute path to data directory
 */
export function getDataDir(appName: string = 'claude'): string {
  if (Platform.isLinux) {
    const xdgData = process.env.XDG_DATA_HOME;
    if (xdgData) {
      return path.join(xdgData, appName);
    }
    return path.join(getHomeDir(), '.local', 'share', appName);
  }

  // Windows and macOS use same location as config
  return getConfigDir(appName);
}

/**
 * Get the cache directory following platform conventions.
 *
 * Platform behavior:
 * - Windows: %LOCALAPPDATA% (e.g., C:\Users\<user>\AppData\Local)
 * - macOS: ~/Library/Caches
 * - Linux: $XDG_CACHE_HOME or ~/.cache
 *
 * @param appName - Application name for subdirectory
 * @returns Absolute path to cache directory
 */
export function getCacheDir(appName: string = 'claude'): string {
  if (Platform.isWindows) {
    const localAppData = process.env.LOCALAPPDATA ||
      path.join(getHomeDir(), 'AppData', 'Local');
    return path.join(localAppData, appName);
  }

  if (Platform.isMacOS) {
    return path.join(getHomeDir(), 'Library', 'Caches', appName);
  }

  // Linux - XDG compliance
  const xdgCache = process.env.XDG_CACHE_HOME;
  if (xdgCache) {
    return path.join(xdgCache, appName);
  }
  return path.join(getHomeDir(), '.cache', appName);
}

// =============================================================================
// Claude CLI Paths
// =============================================================================

/**
 * Get the Claude CLI configuration directory.
 * Claude stores its config in ~/.claude/ on all platforms.
 *
 * @returns Absolute path to ~/.claude
 */
export function getClaudeConfigDir(): string {
  return path.join(getHomeDir(), '.claude');
}

/**
 * Get the Claude CLI projects directory.
 * Claude stores project data in ~/.claude/projects/
 *
 * @returns Absolute path to ~/.claude/projects
 */
export function getClaudeProjectsPath(): string {
  return path.join(getClaudeConfigDir(), 'projects');
}

/**
 * Get the path to Claude's main config file.
 *
 * @returns Absolute path to ~/.claude/config.json (or similar)
 */
export function getClaudeConfigFile(): string {
  return path.join(getClaudeConfigDir(), 'config.json');
}

// =============================================================================
// WSL Path Conversion
// =============================================================================

/**
 * Check if a path is already a WSL/Unix path (starts with /).
 *
 * @param pathStr - Path to check
 * @returns true if path is Unix-style
 */
export function isWSLPath(pathStr: string): boolean {
  return pathStr.startsWith('/');
}

/**
 * Check if a path is a UNC network path.
 *
 * @param pathStr - Path to check
 * @returns true if path is UNC (e.g., \\server\share)
 */
export function isUNCPath(pathStr: string): boolean {
  return pathStr.startsWith('\\\\') || pathStr.startsWith('//');
}

/**
 * Convert a Windows path to WSL path format.
 *
 * Handles:
 * - Already-converted paths (returns as-is)
 * - UNC paths (\\wsl$\distro\... format)
 * - Standard Windows paths (C:\Users\... -> /mnt/c/Users/...)
 * - Relative paths (normalizes separators)
 *
 * @param windowsPath - Windows-style path to convert
 * @returns WSL-compatible path
 *
 * @example
 * convertToWSLPath('C:\\Users\\me\\project') // => '/mnt/c/Users/me/project'
 * convertToWSLPath('/mnt/c/already/wsl')     // => '/mnt/c/already/wsl' (unchanged)
 */
export function convertToWSLPath(windowsPath: string): string {
  // Already a WSL/Unix path - don't double-convert
  if (isWSLPath(windowsPath)) {
    return windowsPath;
  }

  // Handle UNC paths
  if (isUNCPath(windowsPath)) {
    // Special handling for \\wsl$\distro\... paths
    const wslMatch = windowsPath.match(
      /^[\\\/]{2}wsl\$[\\\/]([^\\\/]+)[\\\/](.*)$/i
    );
    if (wslMatch) {
      // Extract path after distro name
      return '/' + wslMatch[2].replace(/\\/g, '/');
    }

    console.warn('[paths] UNC paths not fully supported in WSL:', windowsPath);
    return windowsPath;
  }

  // Standard Windows path with drive letter (e.g., C:\Users\...)
  const driveMatch = windowsPath.match(/^([a-zA-Z]):/);
  if (driveMatch) {
    const drive = driveMatch[1].toLowerCase();
    const rest = windowsPath.slice(2).replace(/\\/g, '/');
    return `/mnt/${drive}${rest}`;
  }

  // Relative path or other format - just normalize separators
  return windowsPath.replace(/\\/g, '/');
}

/**
 * Convert a WSL path back to Windows path format.
 *
 * @param wslPath - WSL-style path to convert
 * @returns Windows-compatible path
 *
 * @example
 * convertFromWSLPath('/mnt/c/Users/me') // => 'C:\\Users\\me'
 */
export function convertFromWSLPath(wslPath: string): string {
  // Check for /mnt/<drive>/... pattern
  const mntMatch = wslPath.match(/^\/mnt\/([a-z])\/(.*)$/i);
  if (mntMatch) {
    const drive = mntMatch[1].toUpperCase();
    const rest = mntMatch[2].replace(/\//g, '\\');
    return `${drive}:\\${rest}`;
  }

  // Not a convertible path
  return wslPath;
}

// =============================================================================
// Path Normalization
// =============================================================================

/**
 * Normalize a path to use the native OS path separator.
 *
 * On Windows, this ensures backslashes are used, which is critical for
 * Claude CLI to recognize the project correctly in ~/.claude/projects.json.
 *
 * @param inputPath - Path to normalize
 * @returns Normalized path with correct separators, or undefined if input is falsy
 */
export function normalizePathForOS(inputPath: string | undefined): string | undefined {
  if (!inputPath) return undefined;
  return path.normalize(inputPath);
}

/**
 * Join path segments using the native OS separator.
 *
 * @param segments - Path segments to join
 * @returns Joined path
 */
export function joinPath(...segments: string[]): string {
  return path.join(...segments);
}

/**
 * Get the directory name from a path.
 *
 * @param filePath - Path to extract directory from
 * @returns Directory portion of path
 */
export function getDirName(filePath: string): string {
  return path.dirname(filePath);
}

/**
 * Get the base name (file name) from a path.
 *
 * @param filePath - Path to extract file name from
 * @returns File name portion of path
 */
export function getBaseName(filePath: string): string {
  return path.basename(filePath);
}
