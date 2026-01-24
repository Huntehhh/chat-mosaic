/**
 * Centralized utility for building Claude CLI arguments.
 *
 * Single source of truth for all Claude spawn operations:
 * - Background processes (ProcessManager)
 * - Per-panel processes (_spawnPanelProcess)
 * - Pre-spawn processes (_prespawnClaudeProcess)
 * - Terminal commands (_executeSlashCommand, _openMCPTerminal)
 */

import * as path from 'path';
import { Platform } from './platform';

// =============================================================================
// Path Normalization
// =============================================================================

/**
 * Normalize a path to use the native OS path separator.
 *
 * On Windows, this ensures backslashes are used, which is critical for
 * Claude CLI to recognize the project correctly in ~/.claude/projects.json.
 *
 * Without this, paths like "C:/HApps/project" and "C:\HApps\project" are
 * treated as different projects, causing MCP settings to not be shared.
 */
export function normalizePathForOS(inputPath: string | undefined): string | undefined {
  if (!inputPath) return undefined;

  // Use path.normalize to ensure consistent separators for the OS
  // On Windows, this converts forward slashes to backslashes
  return path.normalize(inputPath);
}

/**
 * Build a terminal command that preserves Windows backslash paths.
 *
 * On Windows, wraps the command in PowerShell to ensure the working directory
 * uses backslashes. Git Bash converts paths to forward slashes, which causes
 * Claude to store projects with different path formats in projects.json.
 *
 * @param claudeCommand - The claude command to run (e.g., "claude --resume abc123")
 * @param cwd - The working directory path
 * @param wslEnabled - Whether WSL is enabled
 * @returns Object with command to send and whether cd is needed separately
 */
export function buildTerminalCommand(
  claudeCommand: string,
  cwd: string | undefined,
  wslEnabled: boolean = false
): { command: string; needsSeparateCd: boolean } {
  // On Windows (non-WSL), wrap in PowerShell to preserve backslash paths
  if (Platform.isWindows && !wslEnabled && cwd) {
    return {
      command: `powershell -NoProfile -Command "Set-Location -LiteralPath '${cwd}'; ${claudeCommand}"`,
      needsSeparateCd: false
    };
  }

  // For WSL or non-Windows, return command as-is (caller handles cd)
  return {
    command: claudeCommand,
    needsSeparateCd: !!cwd
  };
}

// =============================================================================
// Types
// =============================================================================

export interface ClaudeArgsOptions {
  /** Session ID to resume */
  sessionId?: string;
  /** Model to use (e.g., 'claude-3-opus', 'default') */
  model?: string;
  /** Skip all permission prompts */
  yoloMode?: boolean;
  /** Use plan mode for permission handling */
  planMode?: boolean;
  /** Slash command to execute (e.g., 'init', 'config', 'mcp') */
  slashCommand?: string;
  /** Include --verbose flag (default: true for stream-json) */
  verbose?: boolean;
  /** Use stream-json format (default: true for background processes) */
  streamJson?: boolean;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Build Claude CLI arguments based on options.
 *
 * @example
 * // Background process with session resume
 * buildClaudeArgs({ sessionId: 'abc123', model: 'claude-3-opus' })
 * // => ['--verbose', '--output-format', 'stream-json', '--input-format', 'stream-json', '--permission-prompt-tool', 'stdio', '--model', 'claude-3-opus', '--resume', 'abc123']
 *
 * @example
 * // Terminal slash command
 * buildClaudeArgs({ slashCommand: 'mcp', sessionId: 'abc123', streamJson: false })
 * // => ['/mcp', '--resume', 'abc123']
 *
 * @example
 * // Yolo mode (skip permissions)
 * buildClaudeArgs({ yoloMode: true })
 * // => ['--verbose', '--output-format', 'stream-json', '--input-format', 'stream-json', '--dangerously-skip-permissions']
 */
export function buildClaudeArgs(options: ClaudeArgsOptions = {}): string[] {
  const args: string[] = [];

  // Slash command goes first (for terminal execution)
  if (options.slashCommand) {
    args.push(`/${options.slashCommand}`);
  }

  // Output format (required for extension communication)
  // For terminals, we skip stream-json since they're interactive
  if (options.streamJson !== false) {
    // --verbose is required when using --output-format stream-json
    if (options.verbose !== false) {
      args.push('--verbose');
    }
    args.push('--output-format', 'stream-json');
    args.push('--input-format', 'stream-json');
  }

  // Permission handling
  // Priority: planMode > yoloMode > normal (stdio)
  if (options.planMode) {
    args.push('--permission-prompt-tool', 'stdio');
    args.push('--permission-mode', 'plan');
  } else if (options.yoloMode) {
    args.push('--dangerously-skip-permissions');
  } else if (options.streamJson !== false) {
    // Only add permission-prompt-tool for background processes (stream-json mode)
    // Terminal commands handle permissions interactively
    args.push('--permission-prompt-tool', 'stdio');
  }

  // Model selection
  if (options.model && options.model !== 'default') {
    args.push('--model', options.model);
  }

  // Session resume
  if (options.sessionId) {
    args.push('--resume', options.sessionId);
  }

  return args;
}

// =============================================================================
// Helper for terminal commands (no stream-json)
// =============================================================================

/**
 * Build args for terminal-based slash commands.
 * Simplified version without stream-json format.
 */
export function buildTerminalArgs(options: Pick<ClaudeArgsOptions, 'sessionId' | 'slashCommand'>): string[] {
  return buildClaudeArgs({
    ...options,
    streamJson: false,
    verbose: false,
  });
}

// =============================================================================
// Helper for interactive terminals (just session resume)
// =============================================================================

/**
 * Build args for interactive terminal session (e.g., /mcp).
 * Only includes --resume flag, no output format flags.
 */
export function buildInteractiveArgs(sessionId?: string): string[] {
  if (sessionId) {
    return ['--resume', sessionId];
  }
  return [];
}
