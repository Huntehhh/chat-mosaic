/**
 * Shell Command Building and Escaping
 *
 * Provides cross-platform shell escaping and command building utilities.
 * Supports PowerShell, bash, zsh, fish, and sh.
 *
 * Best Practice: Prefer using argument arrays with spawn() over shell strings
 * to avoid escaping issues entirely. Use these utilities only when shell
 * invocation is unavoidable (e.g., Set-Location in PowerShell).
 *
 * @module shell
 */

import { Platform, detectShellType, type ShellType } from './platform';

// Re-export ShellType for convenience
export type { ShellType };

// =============================================================================
// Shell Argument Escaping
// =============================================================================

/**
 * Check if an argument is safe (no escaping needed).
 * Safe characters: alphanumeric, forward slash, backslash, dot, underscore, hyphen
 */
function isSafeArg(arg: string): boolean {
  return /^[a-zA-Z0-9\\/._-]+$/.test(arg);
}

/**
 * Escape an argument for POSIX shells (bash, zsh, sh).
 * Wraps in single quotes and escapes existing single quotes.
 *
 * @param arg - Argument to escape
 * @returns Escaped argument safe for bash/zsh/sh
 *
 * @example
 * escapePosixArg("it's") // => "'it'\\''s'"
 * escapePosixArg("simple") // => "simple" (no escaping needed)
 */
export function escapePosixArg(arg: string): string {
  if (isSafeArg(arg)) return arg;
  // Wrap in single quotes, escape existing single quotes with '\''
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Escape an argument for PowerShell.
 * Uses single quotes with '' for escaping internal single quotes.
 *
 * @param arg - Argument to escape
 * @returns Escaped argument safe for PowerShell
 *
 * @example
 * escapePowerShellArg("it's") // => "'it''s'"
 */
export function escapePowerShellArg(arg: string): string {
  if (isSafeArg(arg)) return arg;
  // PowerShell: single quotes with '' for escaping
  return `'${arg.replace(/'/g, "''")}'`;
}

/**
 * Escape an argument for Fish shell.
 * Uses single quotes with \' for escaping.
 *
 * @param arg - Argument to escape
 * @returns Escaped argument safe for fish
 *
 * @example
 * escapeFishArg("it's") // => "'it\\'s'"
 */
export function escapeFishArg(arg: string): string {
  if (isSafeArg(arg)) return arg;
  // Fish: single quotes with \' for escaping
  return `'${arg.replace(/'/g, "\\'")}'`;
}

/**
 * Escape an argument for cmd.exe.
 * Uses double quotes and escapes internal quotes.
 *
 * @param arg - Argument to escape
 * @returns Escaped argument safe for cmd.exe
 */
export function escapeCmdArg(arg: string): string {
  if (isSafeArg(arg)) return arg;
  // cmd.exe: double quotes, escape internal quotes with \"
  return `"${arg.replace(/"/g, '\\"')}"`;
}

/**
 * Escape an argument for the specified shell type.
 *
 * @param arg - Argument to escape
 * @param shell - Target shell type
 * @returns Escaped argument
 */
export function escapeArg(arg: string, shell: ShellType): string {
  switch (shell) {
    case 'powershell':
      return escapePowerShellArg(arg);
    case 'cmd':
      return escapeCmdArg(arg);
    case 'fish':
      return escapeFishArg(arg);
    case 'bash':
    case 'zsh':
    case 'sh':
    default:
      return escapePosixArg(arg);
  }
}

/**
 * Escape multiple arguments for the specified shell type.
 *
 * @param args - Arguments to escape
 * @param shell - Target shell type
 * @returns Space-joined escaped arguments
 */
export function escapeArgs(args: string[], shell: ShellType): string {
  return args.map(arg => escapeArg(arg, shell)).join(' ');
}

// =============================================================================
// Shell Command Building
// =============================================================================

/**
 * Build a shell command with working directory change.
 * On Windows, uses PowerShell's Set-Location for consistent path handling.
 * On Unix, returns command as-is (spawn handles cwd).
 *
 * @param command - Command to execute (e.g., "claude --resume abc123")
 * @param cwd - Working directory path
 * @param shell - Shell type (auto-detected if not provided)
 * @returns Object with command string and whether separate cd is needed
 */
export function buildShellCommand(
  command: string,
  cwd?: string,
  shell?: ShellType
): { command: string; needsSeparateCd: boolean } {
  const shellType = shell || detectShellType();

  // On Windows with PowerShell, wrap command with Set-Location
  // This ensures consistent path handling with backslashes
  if (Platform.isWindows && shellType === 'powershell' && cwd) {
    const escapedCwd = escapePowerShellArg(cwd);
    return {
      command: `Set-Location -LiteralPath ${escapedCwd}; ${command}`,
      needsSeparateCd: false,
    };
  }

  // For cmd.exe on Windows
  if (Platform.isWindows && shellType === 'cmd' && cwd) {
    const escapedCwd = escapeCmdArg(cwd);
    return {
      command: `cd /d ${escapedCwd} && ${command}`,
      needsSeparateCd: false,
    };
  }

  // For Unix shells, return command as-is (spawn handles cwd option)
  return {
    command,
    needsSeparateCd: !!cwd,
  };
}

/**
 * Build a PowerShell command string for spawning.
 * Wraps the command to run via powershell.exe with proper flags.
 *
 * @param psCommand - PowerShell command to execute
 * @returns Array of arguments for spawn('powershell', ...)
 */
export function buildPowerShellArgs(psCommand: string): string[] {
  return ['-NoProfile', '-Command', psCommand];
}

/**
 * Build a WSL command string for spawning.
 *
 * @param distro - WSL distribution name
 * @param command - Command to run inside WSL
 * @param args - Additional arguments
 * @returns Array of arguments for spawn('wsl', ...)
 */
export function buildWSLArgs(
  distro: string,
  command: string,
  args: string[] = []
): string[] {
  return ['-d', distro, command, ...args];
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate that a path doesn't contain dangerous shell characters.
 * Use this before constructing shell commands with user-provided paths.
 *
 * @param pathStr - Path to validate
 * @returns true if path is safe for shell use
 */
export function isValidShellPath(pathStr: string): boolean {
  // Dangerous characters that could enable command injection
  const dangerousChars = /[;&|`$(){}[\]<>!#*?~\n\r]/;
  return !dangerousChars.test(pathStr);
}

/**
 * Validate a shell path and throw if dangerous.
 *
 * @param pathStr - Path to validate
 * @param name - Name of the path for error messages
 * @throws Error if path contains dangerous characters
 */
export function validateShellPath(pathStr: string, name: string = 'path'): void {
  if (!isValidShellPath(pathStr)) {
    throw new Error(`Invalid ${name}: "${pathStr}" contains unsafe characters`);
  }
}
