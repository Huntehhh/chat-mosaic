/**
 * ClaudeBackend - IBackend implementation for Claude Code CLI
 *
 * Wraps existing ProcessManager and StreamProcessor to implement the unified
 * backend interface. Uses child_process spawning with stdin/stdout JSONL streaming.
 */

import { EventEmitter } from 'events';
import type {
  IBackend,
  BackendConfig,
  BackendConnectOptions,
  BackendEvent,
  BackendSession,
  BackendModel,
  BackendProvider,
  BackendAgent,
  BackendPermissionRequest,
  MessageContent,
  BackendSpawnOptions,
  PermissionResponse,
  BackendEventType,
} from './types';
import { BackendError } from './types';
import { ProcessManager } from '../ProcessManager';

// Known Claude models (static list - Claude CLI doesn't have a dynamic models API)
const CLAUDE_MODELS: BackendModel[] = [
  {
    id: 'claude-sonnet-4-20250514',
    providerId: 'anthropic',
    name: 'Claude Sonnet 4',
    displayName: 'Claude Sonnet 4 (Latest)',
    capabilities: { vision: true, reasoning: true, toolUse: true },
    cost: { inputPer1k: 0.003, outputPer1k: 0.015 },
  },
  {
    id: 'claude-opus-4-20250514',
    providerId: 'anthropic',
    name: 'Claude Opus 4',
    displayName: 'Claude Opus 4',
    capabilities: { vision: true, reasoning: true, toolUse: true },
    cost: { inputPer1k: 0.015, outputPer1k: 0.075 },
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    providerId: 'anthropic',
    name: 'Claude 3.5 Sonnet',
    displayName: 'Claude 3.5 Sonnet',
    capabilities: { vision: true, reasoning: true, toolUse: true },
    cost: { inputPer1k: 0.003, outputPer1k: 0.015 },
  },
  {
    id: 'claude-3-5-haiku-20241022',
    providerId: 'anthropic',
    name: 'Claude 3.5 Haiku',
    displayName: 'Claude 3.5 Haiku',
    capabilities: { vision: true, reasoning: false, toolUse: true },
    cost: { inputPer1k: 0.001, outputPer1k: 0.005 },
  },
];

const CLAUDE_PROVIDER: BackendProvider = {
  id: 'anthropic',
  name: 'Anthropic',
  connected: true,
  models: CLAUDE_MODELS,
};

/**
 * Internal event types for mapping Claude CLI JSONL to BackendEvents
 */
interface ClaudeJsonData {
  type: 'system' | 'assistant' | 'user' | 'result' | 'control_request' | 'control_response';
  subtype?: string;
  session_id?: string;
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      thinking?: string;
      name?: string;
      input?: Record<string, unknown>;
      id?: string;
      content?: unknown;
      is_error?: boolean;
      tool_use_id?: string;
    }>;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  is_error?: boolean;
  result?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  status?: string | null;
  compact_metadata?: {
    trigger?: string;
    pre_tokens?: number;
  };
  tools?: string[];
  mcp_servers?: string[];
  // Control request/response fields
  tool?: string;
  title?: string;
  risk?: string;
  action?: string;
  permission?: {
    once?: boolean;
    allow?: boolean;
    deny?: boolean;
  };
  command?: string;
  metadata?: Record<string, unknown>;
}

export class ClaudeBackend implements IBackend {
  readonly name = 'claude' as const;

  private _config: BackendConfig;
  private _processManager?: ProcessManager;
  private _eventEmitter = new EventEmitter();
  private _connected = false;
  private _currentSessionId?: string;
  private _cwd: string;
  private _outputBuffer = '';

  // Pending permission requests
  private _pendingPermissions: Map<string, BackendPermissionRequest> = new Map();
  private _permissionResolvers: Map<string, (response: PermissionResponse) => void> = new Map();

  constructor(config: BackendConfig) {
    this._config = config;
    this._cwd = config.cwd;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async connect(options?: BackendConnectOptions): Promise<void> {
    if (options?.cwd) {
      this._cwd = options.cwd;
    }

    // Claude CLI doesn't need explicit connection - it's spawned per-message
    // We just verify the CLI is available
    this._connected = true;
    console.log('[ClaudeBackend] Connected');
  }

  async disconnect(): Promise<void> {
    if (this._processManager?.isRunning()) {
      await this._processManager.kill();
    }
    this._processManager = undefined;
    this._connected = false;
    this._pendingPermissions.clear();
    this._permissionResolvers.clear();
    console.log('[ClaudeBackend] Disconnected');
  }

  // -------------------------------------------------------------------------
  // Providers & Models
  // -------------------------------------------------------------------------

  async getProviders(): Promise<BackendProvider[]> {
    // Claude CLI only supports Anthropic
    return [CLAUDE_PROVIDER];
  }

  async getModels(): Promise<BackendModel[]> {
    return CLAUDE_MODELS;
  }

  async getAgents(): Promise<BackendAgent[]> {
    // Claude CLI doesn't have an explicit agent system
    return [];
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  async createSession(_options?: { title?: string }): Promise<BackendSession> {
    // Claude CLI creates sessions implicitly
    const sessionId = `claude_${Date.now()}`;
    this._currentSessionId = sessionId;

    return {
      id: sessionId,
      title: _options?.title ?? 'New Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'idle',
    };
  }

  async listSessions(): Promise<BackendSession[]> {
    // Claude CLI doesn't have a session listing API
    // Sessions are managed by the extension's ConversationManager
    return [];
  }

  async getSession(sessionId: string): Promise<BackendSession | null> {
    if (sessionId === this._currentSessionId) {
      return {
        id: sessionId,
        title: 'Current Session',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: this._processManager?.isRunning() ? 'busy' : 'idle',
      };
    }
    return null;
  }

  async deleteSession(_sessionId: string): Promise<void> {
    // Claude CLI doesn't have a delete session API
    // Sessions are managed by the extension's ConversationManager
  }

  async abortSession(_sessionId: string): Promise<void> {
    if (this._processManager?.isRunning()) {
      await this._processManager.kill();
    }
  }

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  async *sendMessage(
    sessionId: string,
    content: MessageContent,
    options?: BackendSpawnOptions
  ): AsyncGenerator<BackendEvent, void, unknown> {
    if (!content.text) {
      throw new BackendError('Message content text is required');
    }

    // Create event queue for yielding
    const eventQueue: BackendEvent[] = [];
    let resolveEvent: (() => void) | null = null;
    let done = false;

    const pushEvent = (event: BackendEvent) => {
      eventQueue.push(event);
      resolveEvent?.();
    };

    // Create ProcessManager with callbacks that push events
    this._processManager = new ProcessManager({
      onStdout: (data: string) => {
        this._outputBuffer += data;
        const lines = this._outputBuffer.split('\n');
        this._outputBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const jsonData = JSON.parse(line.trim()) as ClaudeJsonData;
            const events = this._mapJsonToEvents(jsonData, sessionId);
            for (const event of events) {
              pushEvent(event);
            }

            // Check for completion
            if (jsonData.type === 'result' && jsonData.subtype === 'success') {
              done = true;
              pushEvent({
                type: 'done',
                sessionId,
                timestamp: Date.now(),
                data: null,
              });
            }
          } catch (e) {
            console.error('[ClaudeBackend] Failed to parse JSON:', line, e);
          }
        }
      },
      onStderr: (data: string) => {
        console.error('[ClaudeBackend] stderr:', data);
      },
      onClose: (code: number | null, _errorOutput: string) => {
        console.log('[ClaudeBackend] Process closed with code:', code);
        done = true;
        resolveEvent?.();
      },
      onError: (error: Error) => {
        pushEvent({
          type: 'session_error',
          sessionId,
          timestamp: Date.now(),
          data: { error: error.message },
        });
        done = true;
        resolveEvent?.();
      },
    });

    // Spawn the process
    const spawnOptions = {
      cwd: options?.cwd ?? this._cwd,
      sessionId: sessionId !== this._currentSessionId ? sessionId : undefined,
      model: options?.model,
      yoloMode: false,
      planMode: false,
      wslEnabled: this._config.claude?.wslEnabled ?? false,
      wslDistro: this._config.claude?.wslDistro ?? 'Ubuntu',
      nodePath: this._config.claude?.nodePath ?? '/usr/bin/node',
      claudePath: this._config.claude?.claudePath ?? '/usr/local/bin/claude',
    };

    this._processManager.spawnWithOptions(spawnOptions);

    // Write the message to stdin
    const messagePayload = JSON.stringify({ text: content.text }) + '\n';
    this._processManager.write(messagePayload);

    // LOW FIX: Small delay between write and endStdin to ensure data is flushed
    // This prevents potential race conditions on slow systems
    await new Promise((resolve) => setTimeout(resolve, 10));
    this._processManager.endStdin();

    // Yield events as they come
    while (!done) {
      if (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      } else {
        await new Promise<void>((resolve) => {
          resolveEvent = resolve;
        });
        resolveEvent = null;
      }
    }

    // Yield any remaining events
    while (eventQueue.length > 0) {
      yield eventQueue.shift()!;
    }
  }

  // -------------------------------------------------------------------------
  // Permissions
  // -------------------------------------------------------------------------

  async getPendingPermissions(sessionId: string): Promise<BackendPermissionRequest[]> {
    return Array.from(this._pendingPermissions.values()).filter(
      (p) => p.sessionId === sessionId
    );
  }

  async respondToPermission(
    _sessionId: string,
    permissionId: string,
    response: PermissionResponse
  ): Promise<void> {
    const resolver = this._permissionResolvers.get(permissionId);
    if (resolver) {
      resolver(response);
      this._permissionResolvers.delete(permissionId);
      this._pendingPermissions.delete(permissionId);
    }

    // Send response to process if running
    if (this._processManager?.isRunning()) {
      const responsePayload = {
        type: 'permission_response',
        id: permissionId,
        response: response,
      };
      this._processManager.write(JSON.stringify(responsePayload) + '\n');
    }
  }

  // -------------------------------------------------------------------------
  // Event Subscription
  // -------------------------------------------------------------------------

  /**
   * Subscribe to background events from the backend.
   *
   * LOW FIX: Documented no-op behavior for Claude backend.
   *
   * NOTE: Claude CLI does NOT support background events. All events are delivered
   * synchronously through the sendMessage() async generator. This method exists
   * only to satisfy the IBackend interface contract.
   *
   * Unlike OpenCode which has an SSE endpoint for async events (file edits, todos, etc.),
   * Claude CLI is a one-shot process that exits after processing a single message.
   * Background events like file_edited or todo_updated will never be emitted here.
   *
   * The BackendAdapter's background listener will simply idle when connected to Claude.
   */
  async *subscribeToEvents(): AsyncGenerator<BackendEvent, void, unknown> {
    // Claude CLI doesn't have background events - all events come through sendMessage
    // This generator yields nothing but keeps the interface contract intact
    while (this._connected) {
      // Sleep and check connection status periodically
      // This allows clean shutdown when disconnect() is called
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    // Generator ends cleanly when disconnected
  }

  /**
   * Unsubscribe from background events.
   * No-op for Claude backend since there are no background events.
   */
  unsubscribeFromEvents(): void {
    // No-op for Claude backend - setting _connected = false in disconnect()
    // will cause subscribeToEvents() to exit on next iteration
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  /**
   * Map Claude CLI JSON data to normalized BackendEvents
   */
  private _mapJsonToEvents(jsonData: ClaudeJsonData, sessionId: string): BackendEvent[] {
    const events: BackendEvent[] = [];
    const timestamp = Date.now();

    switch (jsonData.type) {
      case 'system':
        if (jsonData.subtype === 'init' && jsonData.session_id) {
          this._currentSessionId = jsonData.session_id;
          events.push({
            type: 'session_status',
            sessionId: jsonData.session_id,
            timestamp,
            data: { status: 'idle', tools: jsonData.tools, mcpServers: jsonData.mcp_servers },
          });
        }
        break;

      case 'assistant':
        if (jsonData.message?.content) {
          for (const content of jsonData.message.content) {
            if (content.type === 'text' && content.text?.trim()) {
              events.push({
                type: 'text' as BackendEventType,
                sessionId,
                timestamp,
                data: { text: content.text.trim() },
              });
            } else if (content.type === 'thinking' && content.thinking?.trim()) {
              events.push({
                type: 'reasoning' as BackendEventType,
                sessionId,
                timestamp,
                data: { text: content.thinking.trim() },
              });
            } else if (content.type === 'tool_use') {
              events.push({
                type: 'tool_running' as BackendEventType,
                sessionId,
                timestamp,
                data: {
                  tool: content.name,
                  callId: content.id,
                  input: content.input,
                },
              });
            }
          }

          // Token usage
          if (jsonData.message.usage) {
            events.push({
              type: 'tokens' as BackendEventType,
              sessionId,
              timestamp,
              data: {
                input: jsonData.message.usage.input_tokens ?? 0,
                output: jsonData.message.usage.output_tokens ?? 0,
                cacheRead: jsonData.message.usage.cache_read_input_tokens ?? 0,
                cacheWrite: jsonData.message.usage.cache_creation_input_tokens ?? 0,
              },
            });
          }
        }
        break;

      case 'user':
        if (jsonData.message?.content) {
          for (const content of jsonData.message.content) {
            if (content.type === 'tool_result') {
              const isError = content.is_error ?? false;
              events.push({
                type: isError ? 'tool_error' : 'tool_completed',
                sessionId,
                timestamp,
                data: {
                  callId: content.tool_use_id,
                  output: content.content,
                  isError,
                },
              });
            }
          }
        }
        break;

      case 'control_request':
        if (jsonData.tool && jsonData.title) {
          const permissionId = `perm_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const request: BackendPermissionRequest = {
            id: permissionId,
            sessionId,
            type: jsonData.risk ?? 'unknown',
            title: jsonData.title,
            tool: jsonData.tool,
            input: (jsonData.metadata ?? {}) as Record<string, unknown>,
            metadata: jsonData.metadata,
          };
          this._pendingPermissions.set(permissionId, request);

          events.push({
            type: 'permission_request' as BackendEventType,
            sessionId,
            timestamp,
            data: request,
          });
        }
        break;

      case 'result':
        if (jsonData.subtype === 'success') {
          if (jsonData.total_cost_usd !== undefined) {
            events.push({
              type: 'cost' as BackendEventType,
              sessionId,
              timestamp,
              data: { cost: jsonData.total_cost_usd },
            });
          }
        }
        break;
    }

    return events;
  }
}
