/**
 * OpenCodeServerManager - Server Lifecycle Manager for OpenCode
 *
 * Manages starting, stopping, and monitoring the OpenCode server process.
 * The server is started with `opencode serve --port <port>`.
 */

import * as cp from 'child_process';
import { Platform } from '../../../utils/platform';

// ============================================================================
// Configuration
// ============================================================================

export interface ServerManagerConfig {
  port?: number;
  executablePath?: string;
  cwd: string;
  startupTimeout?: number;
  healthCheckInterval?: number;
}

// ============================================================================
// OpenCodeServerManager Class
// ============================================================================

export class OpenCodeServerManager {
  private _process?: cp.ChildProcess;
  private _port: number;
  private _executablePath: string;
  private _cwd: string;
  private _startupTimeout: number;
  private _healthCheckInterval: number;
  private _isStarting = false;

  constructor(config: ServerManagerConfig) {
    this._port = config.port ?? 4096;
    this._executablePath = config.executablePath || 'opencode';
    this._cwd = config.cwd;
    this._startupTimeout = config.startupTimeout ?? 15000;
    this._healthCheckInterval = config.healthCheckInterval ?? 500;
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  get port(): number {
    return this._port;
  }

  get url(): string {
    return `http://localhost:${this._port}`;
  }

  get isManaged(): boolean {
    return this._process !== undefined;
  }

  // -------------------------------------------------------------------------
  // Health Check
  // -------------------------------------------------------------------------

  /**
   * Check if the OpenCode server is running and healthy
   */
  async isRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.url}/global/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get server health status
   */
  async getHealth(): Promise<{ healthy: boolean; version?: string } | null> {
    try {
      const response = await fetch(`${this.url}/global/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return { healthy: false };
      }

      const data = await response.json() as { healthy: boolean; version?: string };
      return data;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Server Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start the OpenCode server if not already running
   */
  async start(): Promise<void> {
    if (this._isStarting) {
      console.log('[OpenCodeServerManager] Already starting...');
      return;
    }

    // Check if already running
    if (await this.isRunning()) {
      console.log('[OpenCodeServerManager] Server already running');
      return;
    }

    this._isStarting = true;
    console.log(`[OpenCodeServerManager] Starting server on port ${this._port}...`);

    try {
      await this._spawnServer();
      await this._waitForReady();
      console.log('[OpenCodeServerManager] Server started successfully');
    } catch (error) {
      console.error('[OpenCodeServerManager] Failed to start server:', error);
      await this.stop();
      throw error;
    } finally {
      this._isStarting = false;
    }
  }

  /**
   * Stop the managed OpenCode server
   */
  async stop(): Promise<void> {
    if (!this._process) {
      console.log('[OpenCodeServerManager] No managed server to stop');
      return;
    }

    console.log('[OpenCodeServerManager] Stopping server...');

    return new Promise<void>((resolve) => {
      const process = this._process!;
      this._process = undefined;

      // Set up timeout for force kill
      const forceKillTimeout = setTimeout(() => {
        if (!process.killed) {
          console.log('[OpenCodeServerManager] Force killing server...');
          process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      // Set up clean exit handler
      process.once('exit', () => {
        clearTimeout(forceKillTimeout);
        console.log('[OpenCodeServerManager] Server stopped');
        resolve();
      });

      // Try graceful shutdown first
      process.kill('SIGTERM');
    });
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private async _spawnServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['serve', '--port', String(this._port)];

      console.log(`[OpenCodeServerManager] Spawning: ${this._executablePath} ${args.join(' ')}`);

      this._process = cp.spawn(this._executablePath, args, {
        cwd: this._cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: Platform.isUnix,
        env: {
          ...process.env,
          NO_COLOR: '1',
        },
      });

      // Log stdout/stderr for debugging
      this._process.stdout?.on('data', (data) => {
        console.log(`[OpenCode Server] ${data.toString().trim()}`);
      });

      this._process.stderr?.on('data', (data) => {
        console.error(`[OpenCode Server] ${data.toString().trim()}`);
      });

      // Handle spawn error
      this._process.on('error', (error) => {
        console.error('[OpenCodeServerManager] Spawn error:', error);
        reject(error);
      });

      // Handle unexpected exit during startup
      const onExit = (code: number | null) => {
        console.error(`[OpenCodeServerManager] Server exited during startup with code ${code}`);
        reject(new Error(`Server exited with code ${code}`));
      };

      this._process.once('exit', onExit);

      // Give the process a moment to start
      setTimeout(() => {
        this._process?.off('exit', onExit);
        resolve();
      }, 100);
    });
  }

  private async _waitForReady(): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < this._startupTimeout) {
      if (await this.isRunning()) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, this._healthCheckInterval));
    }

    throw new Error(`Server failed to start within ${this._startupTimeout}ms`);
  }
}
