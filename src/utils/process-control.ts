/**
 * Cross-Platform Process Control
 *
 * Provides unified process spawning and termination across Windows, macOS, and Linux.
 * Handles the differences in process group management between platforms.
 *
 * Key differences:
 * - Unix: Uses process groups with negative PID for tree kill
 * - Windows: Uses taskkill /T for tree kill (no native process groups)
 * - WSL: Requires killing both inside WSL and the Windows wrapper
 *
 * @module process-control
 */

import * as cp from 'child_process';
import { promisify } from 'util';
import { Platform } from './platform';

const execAsync = promisify(cp.exec);

// =============================================================================
// Types
// =============================================================================

export interface SpawnOptions {
  /** Working directory for the spawned process */
  cwd: string;
  /** Whether to detach the process (Unix: creates process group) */
  detached?: boolean;
  /** Whether to use shell (generally avoid for security) */
  shell?: boolean;
  /** Additional environment variables */
  env?: NodeJS.ProcessEnv;
  /** stdio configuration */
  stdio?: cp.StdioOptions;
}

export type ProcessSignal = 'SIGTERM' | 'SIGKILL' | 'SIGINT';

// =============================================================================
// Spawn Options
// =============================================================================

/**
 * Get platform-appropriate spawn options.
 *
 * On Unix:
 * - detached: true creates a new process group (needed for clean tree kill)
 * - Process group leader can be killed with negative PID
 *
 * On Windows:
 * - detached doesn't have the same effect
 * - Use taskkill /T for tree kill instead
 *
 * @param options - Spawn options
 * @returns Node.js ChildProcess spawn options
 */
export function getSpawnOptions(options: SpawnOptions): cp.SpawnOptions {
  const baseEnv = {
    ...process.env,
    ...options.env,
    // Disable color output for consistent parsing
    FORCE_COLOR: '0',
    NO_COLOR: '1',
  };

  return {
    cwd: options.cwd,
    // Unix: detached creates process group for clean termination
    // Windows: detached doesn't help (use taskkill /T instead)
    detached: Platform.isUnix && (options.detached ?? true),
    shell: options.shell ?? false,
    stdio: options.stdio ?? ['pipe', 'pipe', 'pipe'],
    env: baseEnv,
  };
}

/**
 * Get spawn options specifically for background processes.
 * These are long-running processes that need reliable termination.
 *
 * @param cwd - Working directory
 * @param env - Additional environment variables
 * @returns Spawn options configured for background processes
 */
export function getBackgroundSpawnOptions(
  cwd: string,
  env?: NodeJS.ProcessEnv
): cp.SpawnOptions {
  return getSpawnOptions({
    cwd,
    detached: true,
    shell: false,
    env,
  });
}

// =============================================================================
// Process Termination
// =============================================================================

/**
 * Kill a process and all its children (cross-platform).
 *
 * Implementation details:
 * - Windows: Uses `taskkill /pid <pid> /T /F` for tree kill
 * - Unix: Uses `process.kill(-pid, signal)` to kill process group
 *
 * Note: On Unix, this requires the process to have been spawned with
 * `detached: true` to create a process group.
 *
 * @param pid - Process ID to kill
 * @param signal - Signal to send (default: SIGTERM)
 * @returns Promise that resolves when kill completes
 *
 * @example
 * // Graceful termination
 * await killProcessTree(pid, 'SIGTERM');
 *
 * // Force kill
 * await killProcessTree(pid, 'SIGKILL');
 */
export async function killProcessTree(
  pid: number,
  signal: ProcessSignal = 'SIGTERM'
): Promise<void> {
  if (Platform.isWindows) {
    await killWindowsProcessTree(pid);
  } else {
    await killUnixProcessGroup(pid, signal);
  }
}

/**
 * Kill a Windows process tree using taskkill.
 *
 * @param pid - Process ID to kill
 */
async function killWindowsProcessTree(pid: number): Promise<void> {
  try {
    // /T = kill child processes (tree)
    // /F = force kill
    await execAsync(`taskkill /pid ${pid} /T /F`);
  } catch (e: unknown) {
    const error = e as Error;
    // Ignore "not found" errors - process already dead
    if (!error.message?.includes('not found') &&
        !error.message?.includes('not running')) {
      // Log but don't throw - process may have exited naturally
      console.warn(`[ProcessControl] taskkill warning:`, error.message);
    }
  }
}

/**
 * Kill a Unix process group using negative PID.
 *
 * @param pid - Process ID (will be negated to target group)
 * @param signal - Signal to send
 */
async function killUnixProcessGroup(
  pid: number,
  signal: ProcessSignal
): Promise<void> {
  try {
    // Negative PID targets the process group
    // This requires the process to have been spawned with detached: true
    process.kill(-pid, signal);
  } catch (e: unknown) {
    const error = e as NodeJS.ErrnoException;
    // ESRCH = no such process (already dead)
    if (error.code !== 'ESRCH') {
      console.warn(`[ProcessControl] kill warning:`, error.message);
    }
  }
}

/**
 * Kill a WSL process with special handling.
 *
 * WSL processes require killing both:
 * 1. The process inside WSL (using pkill)
 * 2. The Windows-side wsl.exe wrapper
 *
 * @param pid - Windows PID of the wsl.exe process
 * @param wslDistro - WSL distribution name
 * @param processName - Name of process to kill inside WSL (default: "claude")
 */
export async function killWSLProcess(
  pid: number,
  wslDistro: string,
  processName: string = 'claude'
): Promise<void> {
  // 1. Kill inside WSL using pkill
  try {
    await execAsync(`wsl -d ${wslDistro} pkill -9 -f "${processName}"`);
  } catch {
    // Process may already be dead or pkill not available
  }

  // 2. Kill the Windows-side wsl.exe wrapper
  try {
    await execAsync(`taskkill /pid ${pid} /T /F`);
  } catch {
    // Process may already be dead
  }
}

/**
 * Gracefully terminate a process with timeout fallback to force kill.
 *
 * 1. Send SIGTERM and wait for graceful shutdown
 * 2. If timeout expires, send SIGKILL
 *
 * @param pid - Process ID to terminate
 * @param timeoutMs - Timeout before force kill (default: 5000ms)
 * @returns Promise that resolves when process is terminated
 */
export async function terminateProcessGracefully(
  pid: number,
  timeoutMs: number = 5000
): Promise<void> {
  // First try graceful termination
  await killProcessTree(pid, 'SIGTERM');

  // Wait for process to exit or timeout
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (!isProcessRunning(pid)) {
      return; // Process exited gracefully
    }
    await sleep(100);
  }

  // Timeout - force kill
  await killProcessTree(pid, 'SIGKILL');
}

// =============================================================================
// Process Status
// =============================================================================

/**
 * Check if a process is running.
 *
 * @param pid - Process ID to check
 * @returns true if process is running
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create an AbortController with automatic cleanup.
 * Useful for managing process lifecycle.
 *
 * @returns AbortController
 */
export function createProcessAbortController(): AbortController {
  return new AbortController();
}
