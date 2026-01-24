/**
 * TerminalManager - Handles all interactive Claude CLI terminal operations
 *
 * Centralizes terminal spawning to ensure consistent path handling and
 * configuration across all terminal types. Uses ClaudeSpawnConfig from
 * spawn-config.ts to match ProcessManager's configuration.
 *
 * Terminal Types:
 * - Login: Initial authentication
 * - Model: Model selection via /model
 * - Usage: Usage stats via ccusage
 * - Slash: Generic slash commands (/init, /config, etc.)
 * - MCP: Interactive MCP management
 */

import * as vscode from 'vscode';
import {
  buildTerminalArgs,
  buildInteractiveArgs,
  normalizePathForOS
} from '../utils/claude-args';
import type { ClaudeSpawnConfig } from '../utils/spawn-config';
import { Platform, getInstallCommand } from '../utils/platform';

// =============================================================================
// Types
// =============================================================================

/**
 * Callbacks for terminal events
 */
export interface TerminalManagerCallbacks {
  /** Called to post a message to the webview */
  postMessage: (message: { type: string; data?: any }) => void;
  /** Called when MCP terminal closes and process restart is needed */
  onMCPTerminalClosed?: (panelId?: string, sessionId?: string) => void;
}

/**
 * Result from opening a terminal
 */
export interface TerminalResult {
  /** The created terminal */
  terminal: vscode.Terminal;
  /** User-facing message about the terminal */
  message: string;
}

// =============================================================================
// TerminalManager Class
// =============================================================================

export class TerminalManager {
  private _config: ClaudeSpawnConfig;
  private _callbacks: TerminalManagerCallbacks;

  constructor(config: ClaudeSpawnConfig, callbacks: TerminalManagerCallbacks) {
    this._config = config;
    this._callbacks = callbacks;
  }

  /**
   * Update the spawn configuration (call when settings change)
   */
  updateConfig(config: ClaudeSpawnConfig): void {
    this._config = config;
  }

  // ===========================================================================
  // Core Terminal Creation (Single Source of Truth)
  // ===========================================================================

  /**
   * Create a terminal with consistent shell configuration.
   *
   * On Windows (non-WSL): Uses PowerShell explicitly to ensure backslash paths
   * are preserved. NOTE: Do NOT set `cwd` option - VS Code has issues parsing
   * Windows paths with drive letters (c:) as URI schemes. Instead, use
   * _buildCommand() with cwd parameter to send Set-Location command.
   *
   * @param name - Terminal display name
   * @param location - Terminal location (optional)
   */
  private _createTerminal(
    name: string,
    location?: vscode.TerminalLocation | { viewColumn: vscode.ViewColumn }
  ): vscode.Terminal {
    const options: vscode.TerminalOptions = { name };

    if (location) {
      options.location = location;
    }

    // NOTE: We intentionally do NOT set shellPath here. VS Code's createTerminal
    // with shellPath: 'powershell.exe' causes URI parsing errors. Instead, we
    // rely on the user's default terminal shell and use Set-Location in the
    // command (via _buildCommand) to ensure correct path handling.

    return vscode.window.createTerminal(options);
  }

  /**
   * Build the command to run in the terminal.
   * On Windows, wraps in PowerShell to match background process behavior exactly.
   * This ensures Claude sees identical path formats in terminals and background processes.
   */
  private _buildCommand(claudeArgs: string[], cwd?: string): string {
    if (this._config.wslEnabled && Platform.isWindows) {
      return `wsl -d ${this._config.wslDistro} ${this._config.claudePath} ${claudeArgs.join(' ')}`;
    }

    const claudeCmd = `claude ${claudeArgs.join(' ')}`;

    // On Windows, wrap entire command in PowerShell to match background process behavior.
    // This ensures Claude sees identical path handling regardless of the user's default shell.
    // The background process uses: cp.spawn('powershell', ['-NoProfile', '-Command', ...])
    // So we replicate that exact pattern here.
    if (Platform.isWindows && cwd) {
      // Escape single quotes in path for PowerShell
      const escapedCwd = cwd.replace(/'/g, "''");
      return `powershell -NoProfile -Command "Set-Location -LiteralPath '${escapedCwd}'; ${claudeCmd}"`;
    }

    return claudeCmd;
  }

  // ===========================================================================
  // Login Terminal
  // ===========================================================================

  /**
   * Open a terminal for Claude login/authentication
   */
  openLoginTerminal(): TerminalResult {
    const terminal = this._createTerminal(
      'Claude Login',
      { viewColumn: vscode.ViewColumn.One }
    );

    const command = this._buildCommand([]);
    terminal.sendText(command);
    terminal.show();

    const message = 'Please login with your Claude plan or API key in the terminal, then come back to this chat.';

    // Notify UI
    this._callbacks.postMessage({
      type: 'terminalOpened',
      data: message
    });

    // Show VS Code notification
    vscode.window.showInformationMessage(message, 'OK');

    return { terminal, message };
  }

  // ===========================================================================
  // Model Terminal
  // ===========================================================================

  /**
   * Open a terminal for model selection via /model command
   */
  openModelTerminal(sessionId?: string): TerminalResult {
    const args = buildTerminalArgs({
      slashCommand: 'model',
      sessionId
    });

    const terminalCwd = normalizePathForOS(this._config.cwd);
    const terminal = this._createTerminal(
      'Claude Model Selection',
      { viewColumn: vscode.ViewColumn.One }
    );

    const command = this._buildCommand(args, terminalCwd);
    console.log(`[TerminalManager] Model terminal: cwd=${terminalCwd}, command=${command}`);
    terminal.sendText(command);
    terminal.show();

    const message = 'Check the terminal to update your default model configuration. Come back to this chat here after making changes.';

    // Notify UI
    this._callbacks.postMessage({
      type: 'terminalOpened',
      data: message
    });

    // Show VS Code notification
    vscode.window.showInformationMessage(message, 'OK');

    return { terminal, message };
  }

  // ===========================================================================
  // Usage Terminal
  // ===========================================================================

  /**
   * Open a terminal to view usage statistics
   */
  openUsageTerminal(usageType: 'plan' | 'api'): TerminalResult {
    const terminal = this._createTerminal(
      'Claude Usage',
      { viewColumn: vscode.ViewColumn.One }
    );

    let command: string;
    if (usageType === 'plan') {
      // Plan users get live usage view
      command = 'npx -y ccusage blocks --live';
    } else {
      // API users get recent usage history
      command = 'npx -y ccusage blocks --recent --order desc';
    }

    // WSL needs special handling for npx commands
    if (this._config.wslEnabled && Platform.isWindows) {
      terminal.sendText(`wsl -d ${this._config.wslDistro} bash -ic "${command}"`);
    } else {
      terminal.sendText(command);
    }

    terminal.show();

    const message = 'Usage statistics terminal opened.';
    return { terminal, message };
  }

  // ===========================================================================
  // Slash Command Terminal
  // ===========================================================================

  /**
   * Execute a slash command in a terminal
   * Note: /compact should be handled in-chat, /mcp should use openMCPTerminal
   */
  executeSlashCommand(command: string, sessionId?: string): TerminalResult | null {
    console.log('[TerminalManager] Executing slash command:', command);

    // Build command arguments
    const args = buildTerminalArgs({
      slashCommand: command,
      sessionId
    });

    const terminalCwd = normalizePathForOS(this._config.cwd);
    const terminal = this._createTerminal(
      `Claude /${command}`,
      { viewColumn: vscode.ViewColumn.One }
    );

    const cmd = this._buildCommand(args, terminalCwd);
    console.log(`[TerminalManager] Terminal spawn: cwd=${terminalCwd}, session=${sessionId || 'none'}`);
    console.log(`[TerminalManager] Command: ${cmd}`);
    terminal.sendText(cmd);
    terminal.show();

    const message = `Executing /${command} command in terminal. Check the terminal output and return when ready.`;

    // Notify UI
    this._callbacks.postMessage({
      type: 'terminalOpened',
      data: message
    });

    // Show VS Code notification
    vscode.window.showInformationMessage(message, 'OK');

    return { terminal, message };
  }

  // ===========================================================================
  // MCP Terminal
  // ===========================================================================

  /**
   * Open an interactive Claude terminal for MCP management.
   * After the terminal closes, triggers callback to restart background process.
   *
   * @param sessionId - Current session ID (required)
   * @param panelId - Panel ID for restart callback
   */
  openMCPTerminal(sessionId: string, panelId?: string): TerminalResult | null {
    if (!sessionId) {
      this._callbacks.postMessage({
        type: 'error',
        data: 'No active session. Send a message first to create a session, then use /mcp.'
      });
      return null;
    }

    const terminalCwd = normalizePathForOS(this._config.cwd);
    const args = buildInteractiveArgs(sessionId);
    const command = this._buildCommand(args, terminalCwd);

    console.log(`[MCP Terminal] cwd=${terminalCwd}, session=${sessionId}`);
    console.log(`[MCP Terminal] Command: ${command}`);

    const terminal = this._createTerminal('Claude MCP Manager');
    terminal.sendText(command);
    terminal.show(true); // true = preserve focus on terminal

    const message = 'Interactive Claude session opened. Use keyboard shortcuts to manage MCPs. Close terminal when done.';

    // Notify UI
    this._callbacks.postMessage({
      type: 'info',
      data: message
    });

    // Show VS Code notification
    vscode.window.showInformationMessage(
      'Interactive Claude session opened. Use keyboard shortcuts (Shift+Tab) to manage MCPs. Close terminal when done to refresh.',
      'OK'
    );

    // Set up terminal close detection
    this._setupMCPTerminalCloseDetection(terminal, panelId, sessionId);

    console.log(`[MCP Terminal] Opened, waiting for close... (panel: ${panelId})`);

    return { terminal, message };
  }

  /**
   * Set up detection for when MCP terminal closes to trigger process restart
   */
  private _setupMCPTerminalCloseDetection(
    terminal: vscode.Terminal,
    panelId?: string,
    sessionId?: string
  ): void {
    const terminalName = terminal.name;
    let restartTriggered = false;

    const triggerRestart = (source: string) => {
      if (restartTriggered) return;
      restartTriggered = true;
      console.log(`[MCP Terminal] Close detected via ${source}, triggering restart...`);
      if (pollInterval) clearInterval(pollInterval);
      disposable.dispose();

      // Call the callback to restart background process
      this._callbacks.onMCPTerminalClosed?.(panelId, sessionId);
    };

    // Method 1: Standard close event (may be deferred by VS Code)
    const disposable = vscode.window.onDidCloseTerminal(closedTerminal => {
      if (closedTerminal === terminal || closedTerminal.name === terminalName) {
        triggerRestart('onDidCloseTerminal event');
      }
    });

    // Method 2: Poll for terminal existence (workaround for deferred events)
    const pollInterval = setInterval(() => {
      const stillExists = vscode.window.terminals.some(t => t === terminal);
      if (!stillExists) {
        triggerRestart('polling (terminal no longer exists)');
      }
    }, 1000); // Check every second

    // Cleanup poll after 10 minutes max
    setTimeout(() => {
      if (!restartTriggered && pollInterval) {
        clearInterval(pollInterval);
        console.log(`[MCP Terminal] Polling timeout reached, stopping poll`);
      }
    }, 600000);
  }

  // ===========================================================================
  // Install Command (runs in background, not a terminal)
  // ===========================================================================

  /**
   * Run Claude CLI installation command in background
   * Note: This doesn't create a terminal, runs silently
   */
  runInstallCommand(): void {
    const { exec } = require('child_process');

    // Check if npm exists and node >= 18
    exec('node --version', { shell: true }, (nodeErr: Error | null, nodeStdout: string) => {
      let useNpm = false;

      if (!nodeErr && nodeStdout) {
        const match = nodeStdout.trim().match(/^v(\d+)/);
        if (match && parseInt(match[1], 10) >= 18) {
          useNpm = true;
        }
      }

      // Use platform utility for install command
      const command = getInstallCommand(useNpm);

      // Run installation silently in the background
      exec(command, { shell: true }, (error: Error | null, _stdout: string, stderr: string) => {
        if (error) {
          this._callbacks.postMessage({
            type: 'installComplete',
            data: { success: false, error: stderr || error.message }
          });
        } else {
          this._callbacks.postMessage({
            type: 'installComplete',
            data: { success: true }
          });
        }
      });
    });
  }
}
