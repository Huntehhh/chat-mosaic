/**
 * OpenCodeClient - HTTP client for OpenCode CLI REST API
 *
 * Provides typed methods for all OpenCode API endpoints.
 * The server runs via `opencode serve --port 4096`.
 */

import { OpenCodeError } from '../types';

// ============================================================================
// API Response Types
// ============================================================================

export interface OpenCodeSession {
  id: string;
  title: string;
  time: {
    created: number;
    updated: number;
  };
}

export interface OpenCodeMessage {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant';
  time: number;
  tokens?: {
    input: number;
    output: number;
    reasoning?: number;
    cache: { read: number; write: number };
  };
  cost?: number;
}

export interface OpenCodeMessagePart {
  id: string;
  sessionID: string;
  messageID: string;
  type: 'text' | 'reasoning' | 'tool';
  text?: string;
  tool?: string;
  callID?: string;
  state?: {
    status: 'pending' | 'running' | 'completed' | 'error';
    input?: Record<string, unknown>;
    output?: unknown;
    error?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    time?: { start: number; end?: number };
  };
}

export interface OpenCodeProvider {
  id: string;
  name: string;
  models: Record<string, OpenCodeModel>;
}

export interface OpenCodeModel {
  name: string;
  attachment: boolean;
  reasoning: boolean;
  tool_call: boolean;
  cost?: { input: number; output: number };
}

export interface OpenCodeProviderListResponse {
  all: OpenCodeProvider[];
  connected: string[];
}

export interface OpenCodeAgent {
  name: string;
  description?: string;
  mode: 'primary' | 'subagent' | 'all';
  native?: boolean;
  default?: boolean;
  model?: { providerID: string; modelID: string };
  tools: Record<string, boolean>;
}

export interface OpenCodePermission {
  id: string;
  sessionID: string;
  type: string;
  title: string;
  pattern?: string | string[];
  metadata: Record<string, unknown>;
}

export interface OpenCodeConfig {
  provider: { id: string; model: string };
  mcp: Record<string, OpenCodeMcpConfig>;
  instructions?: string;
}

export interface OpenCodeMcpConfig {
  type: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface OpenCodeMcpStatus {
  name: string;
  config: OpenCodeMcpConfig;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
  tools?: string[];
}

export interface PromptPart {
  type: 'text' | 'file';
  text?: string;
  mime?: string;
  url?: string;
}

export interface PromptInput {
  parts: PromptPart[];
  model?: { providerID: string; modelID: string };
  agent?: string;
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface OpenCodeClientConfig {
  baseUrl: string;
  directory: string;
  timeout?: number;
}

// ============================================================================
// OpenCodeClient Class
// ============================================================================

export class OpenCodeClient {
  private _config: OpenCodeClientConfig;
  private _abortController?: AbortController;

  constructor(config: OpenCodeClientConfig) {
    this._config = {
      ...config,
      timeout: config.timeout ?? 30000,
    };
  }

  // -------------------------------------------------------------------------
  // Generic Fetch
  // -------------------------------------------------------------------------

  private async _fetch<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this._config.baseUrl}${path}`;
    const method = options?.method ?? 'GET';
    const startTime = Date.now();

    // DEBUG: Log request
    console.log(`[OpenCodeClient] ${method} ${path} - starting...`);

    this._abortController = new AbortController();

    const timeoutId = setTimeout(() => {
      this._abortController?.abort();
    }, this._config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'x-opencode-directory': this._config.directory,
          ...options?.headers,
        },
        signal: this._abortController.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (!response.ok) {
        let errorBody: { error: string; code?: string; details?: unknown };
        try {
          errorBody = await response.json() as { error: string; code?: string; details?: unknown };
        } catch {
          errorBody = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        console.error(`[OpenCodeClient] ${method} ${path} - FAILED ${response.status} in ${duration}ms:`, errorBody.error);
        throw new OpenCodeError(errorBody);
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        console.log(`[OpenCodeClient] ${method} ${path} - OK (empty) in ${duration}ms`);
        return undefined as T;
      }

      console.log(`[OpenCodeClient] ${method} ${path} - OK in ${duration}ms (${text.length} bytes)`);
      return JSON.parse(text) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (error instanceof OpenCodeError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[OpenCodeClient] ${method} ${path} - TIMEOUT after ${duration}ms`);
        throw new OpenCodeError({ error: 'Request timeout' });
      }

      console.error(`[OpenCodeClient] ${method} ${path} - ERROR after ${duration}ms:`, error);
      throw new OpenCodeError({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // -------------------------------------------------------------------------
  // Health Check
  // -------------------------------------------------------------------------

  async health(): Promise<{ healthy: boolean; version: string }> {
    return this._fetch('/global/health');
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  async listSessions(): Promise<OpenCodeSession[]> {
    return this._fetch('/session');
  }

  async createSession(options?: { title?: string }): Promise<OpenCodeSession> {
    return this._fetch('/session', {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    });
  }

  async getSession(sessionId: string): Promise<OpenCodeSession> {
    return this._fetch(`/session/${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this._fetch(`/session/${sessionId}`, { method: 'DELETE' });
  }

  async abortSession(sessionId: string): Promise<void> {
    await this._fetch(`/session/${sessionId}/abort`, { method: 'POST' });
  }

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  async getMessages(sessionId: string): Promise<OpenCodeMessage[]> {
    return this._fetch(`/session/${sessionId}/message`);
  }

  async getMessageParts(
    sessionId: string,
    messageId: string
  ): Promise<OpenCodeMessagePart[]> {
    return this._fetch(`/session/${sessionId}/message/${messageId}/part`);
  }

  /**
   * Send a message and get a streaming response.
   * Returns the raw Response for SSE parsing.
   */
  async sendMessage(
    sessionId: string,
    input: PromptInput
  ): Promise<Response> {
    const url = `${this._config.baseUrl}/session/${sessionId}/message`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-opencode-directory': this._config.directory,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      let errorBody: { error: string };
      try {
        errorBody = await response.json() as { error: string };
      } catch {
        errorBody = { error: `HTTP ${response.status}` };
      }
      throw new OpenCodeError(errorBody);
    }

    return response;
  }

  // -------------------------------------------------------------------------
  // Providers & Models
  // -------------------------------------------------------------------------

  async getProviders(): Promise<OpenCodeProviderListResponse> {
    return this._fetch('/provider');
  }

  // -------------------------------------------------------------------------
  // Agents
  // -------------------------------------------------------------------------

  async getAgents(): Promise<OpenCodeAgent[]> {
    return this._fetch('/agent');
  }

  // -------------------------------------------------------------------------
  // Permissions
  // -------------------------------------------------------------------------

  async listPermissions(): Promise<OpenCodePermission[]> {
    return this._fetch('/permission');
  }

  async respondToPermission(
    sessionId: string,
    permissionId: string,
    response: 'once' | 'always' | 'reject'
  ): Promise<void> {
    await this._fetch(`/session/${sessionId}/permissions/${permissionId}`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    });
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  async getConfig(): Promise<OpenCodeConfig> {
    return this._fetch('/config');
  }

  async updateConfig(config: Partial<OpenCodeConfig>): Promise<OpenCodeConfig> {
    return this._fetch('/config', {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  }

  // -------------------------------------------------------------------------
  // MCP Servers
  // -------------------------------------------------------------------------

  async getMcpStatus(): Promise<Record<string, OpenCodeMcpStatus>> {
    return this._fetch('/mcp');
  }

  async addMcpServer(name: string, config: OpenCodeMcpConfig): Promise<void> {
    await this._fetch('/mcp', {
      method: 'POST',
      body: JSON.stringify({ name, config }),
    });
  }

  async removeMcpServer(name: string): Promise<void> {
    await this._fetch(`/mcp/${name}`, { method: 'DELETE' });
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  abort(): void {
    this._abortController?.abort();
  }
}
