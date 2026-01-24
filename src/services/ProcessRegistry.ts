/**
 * ProcessRegistry - Unified process management for all Claude processes
 *
 * Manages Claude CLI processes for both the main sidebar and multi-panel windows.
 * Each process is identified by a panelId (the sidebar uses panelId = "main").
 *
 * Key features:
 * - Unified spawn/write/kill interface for all processes
 * - Per-process state isolation (isProcessing, pendingPermissions, etc.)
 * - Full ProcessManager lifecycle for each process (heartbeat, mutex, graceful shutdown)
 * - StreamBuffer for robust JSON parsing per process
 * - Edge case handling for panel close, message routing, etc.
 */

import * as cp from 'child_process';
import { ProcessManager, ProcessConfig, StreamBuffer, createStreamBuffer } from './index';
import type { ProcessManagerCallbacks } from '../types/process';

// Re-export for convenience
export type { ProcessConfig };

/**
 * Identifier for the main sidebar panel (legacy - being phased out)
 */
export const MAIN_PANEL_ID = 'main';

/**
 * Identifier for the sidebar panel
 */
export const SIDEBAR_PANEL_ID = 'sidebar';

/**
 * State for an individual managed process
 */
export interface ProcessState {
  isProcessing: boolean;
  sessionId: string | undefined;
  lastActivityAt: number;
  errorOutput: string;
}

/**
 * A managed process with its associated resources
 */
export interface ManagedProcess {
  panelId: string;
  processManager: ProcessManager;
  streamBuffer: StreamBuffer;
  state: ProcessState;
  createdAt: number;
  /** Unique spawn generation to prevent old process callbacks from affecting new entries */
  spawnGeneration: number;
}

/**
 * Message received from Claude process
 */
export interface ProcessMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Callbacks for ProcessRegistry events
 * All callbacks include panelId for proper routing
 */
export interface ProcessRegistryCallbacks {
  /** Called when stdout data is received and parsed */
  onMessage: (panelId: string, message: ProcessMessage) => void;

  /** Called when stderr data is received */
  onStderr: (panelId: string, data: string) => void;

  /** Called when process closes */
  onClose: (panelId: string, code: number | null, errorOutput: string) => void;

  /** Called when process errors */
  onError: (panelId: string, error: Error) => void;

  /** Check if a panel still exists (for message routing validation) */
  isPanelActive: (panelId: string) => boolean;
}

/**
 * ProcessRegistry - Manages all Claude processes uniformly
 */
export class ProcessRegistry {
  private _processes: Map<string, ManagedProcess> = new Map();
  private _callbacks: ProcessRegistryCallbacks;
  /** Counter for unique spawn generations (prevents old process callbacks from affecting new entries) */
  private _spawnGenerationCounter: number = 0;

  constructor(callbacks: ProcessRegistryCallbacks) {
    this._callbacks = callbacks;
  }

  /**
   * Spawn a new Claude process for a panel
   *
   * @param panelId - Unique panel identifier (use MAIN_PANEL_ID for sidebar)
   * @param config - Process configuration
   * @returns The spawned child process, or undefined if spawn fails
   */
  async spawn(panelId: string, config: ProcessConfig): Promise<cp.ChildProcess | undefined> {
    // Check for duplicate panelId - AWAIT the kill to prevent race condition
    if (this._processes.has(panelId)) {
      console.warn(`[ProcessRegistry] Process already exists for panel ${panelId}, killing existing`);
      try {
        await this.kill(panelId);
      } catch (err) {
        console.error('Failed to kill existing process:', err);
      }
    }

    // Verify panel still exists before spawning
    if (!this._callbacks.isPanelActive(panelId)) {
      console.warn(`[ProcessRegistry] Panel ${panelId} no longer active, aborting spawn`);
      return undefined;
    }

    try {
      // Create per-process StreamBuffer for JSON parsing
      const streamBuffer = createStreamBuffer();

      // Increment spawn generation - used to prevent old process callbacks from affecting new entries
      const spawnGeneration = ++this._spawnGenerationCounter;

      // Create ProcessManager callbacks that route to correct panel
      // IMPORTANT: Capture spawnGeneration in closure to validate callbacks are for current process
      const pmCallbacks: ProcessManagerCallbacks = {
        onStdout: (data: string) => this._handleStdout(panelId, spawnGeneration, data),
        onStderr: (data: string) => this._handleStderr(panelId, spawnGeneration, data),
        onClose: (code: number | null, errorOutput: string) => this._handleClose(panelId, spawnGeneration, code, errorOutput),
        onError: (error: Error) => this._handleError(panelId, spawnGeneration, error),
      };

      // Create ProcessManager for this process
      const processManager = new ProcessManager(pmCallbacks);

      // Create managed process entry
      const managedProcess: ManagedProcess = {
        panelId,
        processManager,
        streamBuffer,
        state: {
          isProcessing: false,
          sessionId: undefined,
          lastActivityAt: Date.now(),
          errorOutput: '',
        },
        createdAt: Date.now(),
        spawnGeneration,
      };

      // Register before spawning (so handlers can find it)
      this._processes.set(panelId, managedProcess);

      // Spawn the actual process
      const childProcess = processManager.spawn(config);

      console.log(`[ProcessRegistry] Spawned process for panel ${panelId}, PID: ${childProcess.pid}`);

      return childProcess;
    } catch (error) {
      console.error(`[ProcessRegistry] Failed to spawn process for panel ${panelId}:`, error);
      this._processes.delete(panelId);
      return undefined;
    }
  }

  /**
   * Write data to a panel's process stdin
   *
   * @param panelId - Panel identifier
   * @param data - Data to write (typically JSON string + newline)
   * @returns true if write succeeded, false otherwise
   */
  write(panelId: string, data: string): boolean {
    const managed = this._processes.get(panelId);
    if (!managed) {
      console.warn(`[ProcessRegistry] No process found for panel ${panelId}`);
      return false;
    }

    // Verify panel still exists before writing
    if (!this._callbacks.isPanelActive(panelId)) {
      console.warn(`[ProcessRegistry] Panel ${panelId} no longer active, dropping write`);
      return false;
    }

    // Update activity timestamp
    managed.state.lastActivityAt = Date.now();
    managed.state.isProcessing = true;

    return managed.processManager.write(data);
  }

  /**
   * End stdin for a panel's process (signals no more input)
   *
   * @param panelId - Panel identifier
   */
  endStdin(panelId: string): void {
    const managed = this._processes.get(panelId);
    if (managed) {
      managed.processManager.endStdin();
    }
  }

  /**
   * Kill a panel's process with graceful shutdown
   *
   * @param panelId - Panel identifier
   */
  async kill(panelId: string): Promise<void> {
    const managed = this._processes.get(panelId);
    if (!managed) {
      return;
    }

    console.log(`[ProcessRegistry] Killing process for panel ${panelId}`);

    // Remove from registry first to prevent message routing
    this._processes.delete(panelId);

    // Kill via ProcessManager (graceful: stdin → SIGTERM → SIGKILL)
    await managed.processManager.kill();
  }

  /**
   * Kill all processes (for extension deactivation)
   */
  async killAll(): Promise<void> {
    console.log(`[ProcessRegistry] Killing all ${this._processes.size} processes`);

    const killPromises = Array.from(this._processes.keys()).map(
      panelId => this.kill(panelId)
    );

    await Promise.all(killPromises);
  }

  /**
   * Check if a panel has a running process
   *
   * @param panelId - Panel identifier
   */
  isRunning(panelId: string): boolean {
    const managed = this._processes.get(panelId);
    return managed?.processManager.isRunning() ?? false;
  }

  /**
   * Check if a panel's process is currently processing a message
   *
   * @param panelId - Panel identifier
   */
  isProcessing(panelId: string): boolean {
    const managed = this._processes.get(panelId);
    return managed?.state.isProcessing ?? false;
  }

  /**
   * Set processing state for a panel
   *
   * @param panelId - Panel identifier
   * @param isProcessing - Whether the process is currently processing
   */
  setProcessing(panelId: string, isProcessing: boolean): void {
    const managed = this._processes.get(panelId);
    if (managed) {
      managed.state.isProcessing = isProcessing;
    }
  }

  /**
   * Get session ID for a panel
   *
   * @param panelId - Panel identifier
   */
  getSessionId(panelId: string): string | undefined {
    return this._processes.get(panelId)?.state.sessionId;
  }

  /**
   * Set session ID for a panel
   *
   * @param panelId - Panel identifier
   * @param sessionId - Session ID from Claude
   */
  setSessionId(panelId: string, sessionId: string): void {
    const managed = this._processes.get(panelId);
    if (managed) {
      managed.state.sessionId = sessionId;
    }
  }

  /**
   * Get the underlying child process for a panel (for advanced operations)
   *
   * @param panelId - Panel identifier
   */
  getProcess(panelId: string): cp.ChildProcess | undefined {
    return this._processes.get(panelId)?.processManager.getProcess();
  }

  /**
   * Get all active panel IDs
   */
  getActivePanelIds(): string[] {
    return Array.from(this._processes.keys());
  }

  /**
   * Get count of active processes
   */
  getProcessCount(): number {
    return this._processes.size;
  }

  /**
   * Get managed process info (for debugging/monitoring)
   *
   * @param panelId - Panel identifier
   */
  getProcessInfo(panelId: string): ManagedProcess | undefined {
    return this._processes.get(panelId);
  }

  /**
   * Clean up orphaned process entries (where process has exited but entry remains)
   * Call periodically to prevent memory leaks from crashed processes
   */
  cleanupOrphanedProcesses(): number {
    let cleaned = 0;
    for (const [panelId, managed] of this._processes) {
      if (!managed.processManager.isRunning()) {
        console.log(`[ProcessRegistry] Cleaning up orphaned entry: ${panelId}`);
        this._processes.delete(panelId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[ProcessRegistry] Cleaned up ${cleaned} orphaned process entries`);
    }
    return cleaned;
  }

  /**
   * Record external activity for a panel (e.g., permission response)
   *
   * @param panelId - Panel identifier
   */
  recordActivity(panelId: string): void {
    const managed = this._processes.get(panelId);
    if (managed) {
      managed.state.lastActivityAt = Date.now();
      managed.processManager.recordExternalActivity();
    }
  }

  // =========================================================================
  // Private Handlers
  // =========================================================================

  /**
   * Handle stdout data from a process
   * @param spawnGeneration - The spawn generation this callback was created for
   */
  private _handleStdout(panelId: string, spawnGeneration: number, data: string): void {
    console.log(`[ProcessRegistry] _handleStdout called for ${panelId}, gen=${spawnGeneration}, dataLen=${data.length}`);

    const managed = this._processes.get(panelId);
    if (!managed) {
      console.warn(`[ProcessRegistry] Received stdout for unknown panel ${panelId}`);
      return;
    }

    // CRITICAL: Check if this callback is for the current process, not an old one
    if (managed.spawnGeneration !== spawnGeneration) {
      console.log(`[ProcessRegistry] Ignoring stdout from old process (gen ${spawnGeneration}, current ${managed.spawnGeneration})`);
      return;
    }

    // Verify panel still exists before processing
    if (!this._callbacks.isPanelActive(panelId)) {
      console.log(`[ProcessRegistry] Panel ${panelId} no longer active, dropping stdout`);
      return;
    }

    // Update activity timestamp
    managed.state.lastActivityAt = Date.now();

    // Parse JSON using StreamBuffer
    const parsed = managed.streamBuffer.parse(data);
    console.log(`[ProcessRegistry] ${panelId}: StreamBuffer parsed ${parsed.length} messages`);

    // Enhanced logging for debugging multi-chunk issues
    if (parsed.length === 0 && managed.streamBuffer.hasPartialObject()) {
      console.log(`[ProcessRegistry] ${panelId}: StreamBuffer has partial object - bufferLen=${managed.streamBuffer.getBufferLength()}, braceDepth=${managed.streamBuffer.getBraceDepth()}`);
    }

    for (const { data: jsonData } of parsed) {
      // Route parsed message to callback
      this._callbacks.onMessage(panelId, jsonData as ProcessMessage);

      // Update session ID if present in message
      if (jsonData && typeof jsonData === 'object' && 'session_id' in jsonData) {
        managed.state.sessionId = jsonData.session_id as string;
      }

      // Update processing state if this is a result message
      if (jsonData && typeof jsonData === 'object' && 'type' in jsonData) {
        if (jsonData.type === 'result') {
          managed.state.isProcessing = false;
        }
      }
    }
  }

  /**
   * Handle stderr data from a process
   * @param spawnGeneration - The spawn generation this callback was created for
   */
  private _handleStderr(panelId: string, spawnGeneration: number, data: string): void {
    const managed = this._processes.get(panelId);
    if (!managed) {
      return;
    }

    // Check if this callback is for the current process
    if (managed.spawnGeneration !== spawnGeneration) {
      return;
    }

    // Accumulate error output
    managed.state.errorOutput += data;

    // Only forward if panel still exists
    if (this._callbacks.isPanelActive(panelId)) {
      this._callbacks.onStderr(panelId, data);
    }
  }

  /**
   * Handle process close
   * @param spawnGeneration - The spawn generation this callback was created for
   */
  private _handleClose(panelId: string, spawnGeneration: number, code: number | null, errorOutput: string): void {
    const managed = this._processes.get(panelId);

    // CRITICAL: Only delete if this callback is for the current process, not an old one
    // This prevents: OLD process close handler from deleting NEW process's entry
    if (managed && managed.spawnGeneration !== spawnGeneration) {
      console.log(`[ProcessRegistry] Ignoring close from old process (gen ${spawnGeneration}, current ${managed.spawnGeneration})`);
      return;
    }

    // Remove from registry (only if it was the current process)
    if (managed) {
      this._processes.delete(panelId);
    }

    // Only notify if panel still exists
    if (this._callbacks.isPanelActive(panelId)) {
      this._callbacks.onClose(panelId, code, managed?.state.errorOutput ?? errorOutput);
    } else {
      console.log(`[ProcessRegistry] Panel ${panelId} closed, process exited with code ${code}`);
    }
  }

  /**
   * Handle process error
   * @param spawnGeneration - The spawn generation this callback was created for
   */
  private _handleError(panelId: string, spawnGeneration: number, error: Error): void {
    const managed = this._processes.get(panelId);

    // Only delete if this callback is for the current process
    if (managed && managed.spawnGeneration !== spawnGeneration) {
      console.log(`[ProcessRegistry] Ignoring error from old process (gen ${spawnGeneration}, current ${managed.spawnGeneration})`);
      return;
    }

    // Remove from registry
    if (managed) {
      this._processes.delete(panelId);
    }

    // Only notify if panel still exists
    if (this._callbacks.isPanelActive(panelId)) {
      this._callbacks.onError(panelId, error);
    } else {
      console.log(`[ProcessRegistry] Panel ${panelId} closed, process error: ${error.message}`);
    }
  }
}

/**
 * Singleton instance for global access
 */
let _processRegistryInstance: ProcessRegistry | undefined;

/**
 * Get the singleton ProcessRegistry instance
 */
export function getProcessRegistry(callbacks?: ProcessRegistryCallbacks): ProcessRegistry {
  if (!_processRegistryInstance) {
    if (!callbacks) {
      throw new Error('ProcessRegistry must be initialized with callbacks on first access');
    }
    _processRegistryInstance = new ProcessRegistry(callbacks);
  }
  return _processRegistryInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetProcessRegistry(): void {
  if (_processRegistryInstance) {
    _processRegistryInstance.killAll().catch(console.error);
    _processRegistryInstance = undefined;
  }
}
