/**
 * Backend Factory
 *
 * Creates the appropriate backend implementation based on configuration.
 * Supports both Claude Code CLI and OpenCode CLI backends.
 */

import type { IBackend, BackendConfig, BackendType } from './types';
import { ClaudeBackend } from './ClaudeBackend';
import { OpenCodeBackend } from './OpenCodeBackend';

/**
 * Factory for creating backend instances.
 */
export class BackendFactory {
  /**
   * Create a backend instance based on configuration.
   *
   * @param config - Backend configuration including type and options
   * @returns The appropriate backend implementation
   */
  static create(config: BackendConfig): IBackend {
    switch (config.type) {
      case 'opencode':
        return new OpenCodeBackend(config);
      case 'claude':
      default:
        return new ClaudeBackend(config);
    }
  }

  /**
   * Get the default backend type.
   */
  static getDefaultType(): BackendType {
    return 'claude';
  }

  /**
   * Validate backend configuration.
   *
   * @param config - Configuration to validate
   * @returns True if valid, throws on invalid
   */
  static validateConfig(config: BackendConfig): boolean {
    if (!config.cwd) {
      throw new Error('Backend config requires a working directory (cwd)');
    }

    if (config.type === 'opencode' && config.opencode?.serverUrl) {
      try {
        new URL(config.opencode.serverUrl);
      } catch {
        throw new Error(`Invalid OpenCode server URL: ${config.opencode.serverUrl}`);
      }
    }

    return true;
  }
}
