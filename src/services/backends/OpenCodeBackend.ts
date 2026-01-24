/**
 * OpenCodeBackend - IBackend implementation for OpenCode CLI
 *
 * Uses HTTP REST API + SSE streaming for communication.
 * Server runs via `opencode serve --port 4096`.
 */

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
} from './types';
import { BackendError } from './types';
import { OpenCodeClient, type PromptInput, type PromptPart } from './opencode/OpenCodeClient';
import { OpenCodeEventStream, type OpenCodeEvent } from './opencode/OpenCodeEventStream';
import { OpenCodeServerManager } from './opencode/OpenCodeServerManager';
import { OpenCodeEventMapper } from './opencode/OpenCodeEventMapper';

export class OpenCodeBackend implements IBackend {
  readonly name = 'opencode' as const;

  private _config: BackendConfig;
  private _client?: OpenCodeClient;
  private _eventStream?: OpenCodeEventStream;
  private _serverManager?: OpenCodeServerManager;
  private _connected = false;
  private _cwd: string;

  // LOW FIX: Track if we started the server so we can clean it up on disconnect
  private _serverStartedByUs = false;

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

    const serverUrl = this._config.opencode?.serverUrl ?? 'http://localhost:4096';
    const port = parseInt(new URL(serverUrl).port) || 4096;

    // Start server if autoStart enabled
    if (this._config.opencode?.autoStart !== false) {
      this._serverManager = new OpenCodeServerManager({
        port,
        executablePath: this._config.opencode?.executablePath,
        cwd: this._cwd,
      });

      try {
        // Check if server is already running before starting
        const wasRunning = await this._serverManager.isRunning();
        await this._serverManager.start();
        // LOW FIX: Track if we started it (for cleanup on disconnect)
        this._serverStartedByUs = !wasRunning;
      } catch (error) {
        console.error('[OpenCodeBackend] Failed to start server:', error);
        throw new BackendError(
          'Failed to start OpenCode server. Make sure opencode CLI is installed.',
          'SERVER_START_FAILED',
          error
        );
      }
    }

    // Initialize HTTP client
    this._client = new OpenCodeClient({
      baseUrl: serverUrl,
      directory: this._cwd,
    });

    // Verify connection
    try {
      const health = await this._client.health();
      if (!health.healthy) {
        throw new BackendError('OpenCode server is not healthy');
      }
      console.log(`[OpenCodeBackend] Connected to OpenCode v${health.version}`);
    } catch (error) {
      if (error instanceof BackendError) throw error;
      throw new BackendError(
        'Failed to connect to OpenCode server',
        'CONNECTION_FAILED',
        error
      );
    }

    // Connect event stream
    this._eventStream = new OpenCodeEventStream({
      baseUrl: serverUrl,
      directory: this._cwd,
    });
    this._eventStream.connect();

    this._connected = true;
    console.log('[OpenCodeBackend] Connected');
  }

  async disconnect(): Promise<void> {
    this._eventStream?.disconnect();
    this._client?.abort();

    // LOW FIX: Stop the server if we started it (not if it was already running)
    // This prevents orphan processes while still allowing shared server usage
    if (this._serverManager && this._serverStartedByUs) {
      console.log('[OpenCodeBackend] Stopping server we started...');
      await this._serverManager.stop();
      this._serverStartedByUs = false;
    }

    this._connected = false;
    console.log('[OpenCodeBackend] Disconnected');
  }

  // -------------------------------------------------------------------------
  // Providers & Models
  // -------------------------------------------------------------------------

  async getProviders(): Promise<BackendProvider[]> {
    if (!this._client) throw new BackendError('Not connected');

    const response = await this._client.getProviders();

    return response.all.map((p) => ({
      id: p.id,
      name: p.name,
      connected: response.connected.includes(p.id),
      models: Object.entries(p.models).map(([id, m]) => ({
        id,
        providerId: p.id,
        name: m.name,
        displayName: `${p.name} / ${m.name}`,
        capabilities: {
          vision: m.attachment,
          reasoning: m.reasoning,
          toolUse: m.tool_call,
        },
        cost: m.cost
          ? {
              inputPer1k: m.cost.input,
              outputPer1k: m.cost.output,
            }
          : undefined,
      })),
    }));
  }

  async getModels(): Promise<BackendModel[]> {
    const providers = await this.getProviders();
    return providers.flatMap((p) => p.models);
  }

  async getAgents(): Promise<BackendAgent[]> {
    if (!this._client) throw new BackendError('Not connected');

    const agents = await this._client.getAgents();

    return agents.map((a) => ({
      name: a.name,
      description: a.description,
      mode: a.mode,
      isNative: a.native ?? false,
      isDefault: a.default ?? false,
      model: a.model
        ? { providerId: a.model.providerID, modelId: a.model.modelID }
        : undefined,
      tools: a.tools,
    }));
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  async createSession(options?: { title?: string }): Promise<BackendSession> {
    if (!this._client) throw new BackendError('Not connected');

    const session = await this._client.createSession(options);
    return this._mapSession(session);
  }

  async listSessions(): Promise<BackendSession[]> {
    if (!this._client) throw new BackendError('Not connected');

    const sessions = await this._client.listSessions();
    return sessions.map((s) => this._mapSession(s));
  }

  async getSession(sessionId: string): Promise<BackendSession | null> {
    if (!this._client) throw new BackendError('Not connected');

    try {
      const session = await this._client.getSession(sessionId);
      return this._mapSession(session);
    } catch {
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this._client) throw new BackendError('Not connected');
    await this._client.deleteSession(sessionId);
  }

  async abortSession(sessionId: string): Promise<void> {
    if (!this._client) throw new BackendError('Not connected');
    await this._client.abortSession(sessionId);
  }

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  async *sendMessage(
    sessionId: string,
    content: MessageContent,
    options?: BackendSpawnOptions
  ): AsyncGenerator<BackendEvent, void, unknown> {
    if (!this._client) throw new BackendError('Not connected');

    // Build prompt input
    const parts: PromptPart[] = [];

    if (content.text) {
      parts.push({ type: 'text', text: content.text });
    }

    if (content.images) {
      for (const img of content.images) {
        parts.push({
          type: 'file',
          mime: img.mediaType,
          url: `data:${img.mediaType};base64,${img.data}`,
        });
      }
    }

    // Build model selection
    let model: { providerID: string; modelID: string } | undefined;
    if (options?.model) {
      const [providerId, modelId] = options.model.split('/');
      if (providerId && modelId) {
        model = { providerID: providerId, modelID: modelId };
      }
    }

    const input: PromptInput = {
      parts,
      model,
      agent: options?.agent,
    };

    // Send message and get streaming response
    const response = await this._client.sendMessage(sessionId, input);

    // Parse SSE stream from response
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            yield {
              type: 'done',
              sessionId,
              timestamp: Date.now(),
              data: null,
            };
            return;
          }

          try {
            const event = JSON.parse(data) as OpenCodeEvent;
            const backendEvents = OpenCodeEventMapper.mapToBackendEvents(event, sessionId);
            for (const backendEvent of backendEvents) {
              yield backendEvent;
            }
          } catch (e) {
            console.error('[OpenCodeBackend] Failed to parse event:', e);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Permissions
  // -------------------------------------------------------------------------

  async getPendingPermissions(sessionId: string): Promise<BackendPermissionRequest[]> {
    if (!this._client) throw new BackendError('Not connected');

    const permissions = await this._client.listPermissions();

    return permissions
      .filter((p) => p.sessionID === sessionId)
      .map((p) => ({
        id: p.id,
        sessionId: p.sessionID,
        type: p.type,
        title: p.title,
        tool: p.type,
        input: p.metadata,
        patterns: Array.isArray(p.pattern)
          ? p.pattern
          : p.pattern
            ? [p.pattern]
            : undefined,
        metadata: p.metadata,
      }));
  }

  async respondToPermission(
    sessionId: string,
    permissionId: string,
    response: PermissionResponse
  ): Promise<void> {
    if (!this._client) throw new BackendError('Not connected');
    await this._client.respondToPermission(sessionId, permissionId, response);
  }

  // -------------------------------------------------------------------------
  // Event Subscription
  // -------------------------------------------------------------------------

  // MEDIUM FIX: Maximum buffer size to prevent unbounded memory growth
  private static readonly MAX_EVENT_BUFFER = 1000;

  async *subscribeToEvents(): AsyncGenerator<BackendEvent, void, unknown> {
    if (!this._eventStream) throw new BackendError('Not connected');

    // Create a channel to bridge callback-based events to async generator
    const events: BackendEvent[] = [];
    let resolver: (() => void) | null = null;
    let isDone = false;

    const handler = (event: OpenCodeEvent) => {
      // Extract sessionId from event properties if available
      const props = event.properties as { sessionID?: string } | undefined;
      const sessionId = props?.sessionID ?? '';

      const mapped = OpenCodeEventMapper.mapToBackendEvents(event, sessionId);
      for (const backendEvent of mapped) {
        // MEDIUM FIX: Bounded buffer - drop oldest events if buffer is full
        if (events.length >= OpenCodeBackend.MAX_EVENT_BUFFER) {
          console.warn('[OpenCodeBackend] Event buffer full, dropping oldest event');
          events.shift(); // Drop oldest to prevent OOM
        }
        events.push(backendEvent);
      }
      resolver?.();
    };

    this._eventStream.on('*', handler);

    try {
      while (this._connected && !isDone) {
        if (events.length > 0) {
          yield events.shift()!;
        } else {
          await new Promise<void>((resolve) => {
            resolver = resolve;
            // Add timeout to prevent infinite wait
            setTimeout(() => {
              resolver = null;
              resolve();
            }, 1000);
          });
          resolver = null;
        }
      }
    } finally {
      this._eventStream.off('*', handler);
    }
  }

  unsubscribeFromEvents(): void {
    this._eventStream?.disconnect();
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private _mapSession(session: {
    id: string;
    title: string;
    time: { created: number; updated: number };
  }): BackendSession {
    return {
      id: session.id,
      title: session.title,
      createdAt: session.time.created,
      updatedAt: session.time.updated,
      status: 'idle',
      messageCount: undefined,
      cost: undefined,
      tokens: undefined,
    };
  }
}
