/**
 * BackendAdapter - Bridges IBackend events to extension UI messages
 *
 * Converts normalized BackendEvents to the UI message format expected by
 * the webview. This enables seamless switching between Claude and OpenCode
 * backends without changing the UI layer.
 */

import type {
  IBackend,
  BackendEvent,
  BackendSession,
  BackendModel,
  BackendProvider,
  BackendAgent,
  BackendSpawnOptions,
  MessageContent,
  PermissionResponse,
  BackendConfig,
  BackendType,
} from './types';
import { BackendFactory } from './BackendFactory';

// ============================================================================
// Callback Types
// ============================================================================

export interface BackendAdapterCallbacks {
  /** Post a message to the webview (UI-only, not saved) */
  postMessage: (message: { type: string; data?: unknown }, panelId?: string) => void;

  /** Send and save a message to conversation */
  sendAndSaveMessage: (message: { type: string; data: unknown }, panelId?: string) => void;

  /** Handle login/auth required */
  handleLoginRequired: () => void;

  /** Handle permission request */
  handlePermissionRequest: (request: {
    id: string;
    sessionId: string;
    type: string;
    title: string;
    tool: string;
    input: Record<string, unknown>;
  }) => void;

  /** Read file content for diff display */
  readFile: (filePath: string) => Promise<string | undefined>;

  /** Log messages */
  log: (message: string) => void;

  /** Log errors */
  logError: (message: string, error?: unknown) => void;
}

// ============================================================================
// State Types
// ============================================================================

export interface BackendAdapterState {
  sessionId: string | undefined;
  isProcessing: boolean;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCost: number;
  requestCount: number;
  currentTodos: Array<{ content: string; status: string; activeForm?: string }>;
}

// ============================================================================
// BackendAdapter Class
// ============================================================================

export class BackendAdapter {
  private _backend: IBackend;
  private _callbacks: BackendAdapterCallbacks;
  private _state: BackendAdapterState;
  private _connected = false;
  private _currentPanelId?: string;

  // Background event listener control
  private _backgroundListenerActive = false;

  // Track tool use for result matching
  private _pendingToolCalls: Map<string, {
    tool: string;
    input: Record<string, unknown>;
    fileContentBefore?: string;
    startLine?: number;
  }> = new Map();

  constructor(config: BackendConfig, callbacks: BackendAdapterCallbacks) {
    this._backend = BackendFactory.create(config);
    this._callbacks = callbacks;
    this._state = {
      sessionId: undefined,
      isProcessing: false,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalCost: 0,
      requestCount: 0,
      currentTodos: [],
    };
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  get backendName(): BackendType {
    return this._backend.name;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  get sessionId(): string | undefined {
    return this._state.sessionId;
  }

  get isProcessing(): boolean {
    return this._state.isProcessing;
  }

  get state(): Readonly<BackendAdapterState> {
    return this._state;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async connect(cwd: string): Promise<void> {
    try {
      await this._backend.connect({ cwd });
      this._connected = true;
      this._callbacks.log(`[BackendAdapter] Connected to ${this._backend.name} backend`);

      // Start background event listener for async updates (todos, file edits, etc.)
      this._startBackgroundListener();
    } catch (error) {
      this._callbacks.logError(`[BackendAdapter] Failed to connect`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Stop background listener first
      this._stopBackgroundListener();

      await this._backend.disconnect();
      this._connected = false;
      this._callbacks.log('[BackendAdapter] Disconnected');
    } catch (error) {
      this._callbacks.logError('[BackendAdapter] Disconnect error', error);
    }
  }

  // -------------------------------------------------------------------------
  // Background Event Listener (HIGH priority fix)
  // -------------------------------------------------------------------------

  /**
   * Start listening for background events from the backend.
   * This captures events like todo_updated, file_edited that arrive
   * outside of active sendMessage() calls.
   */
  private _startBackgroundListener(): void {
    if (this._backgroundListenerActive) {
      return;
    }

    this._backgroundListenerActive = true;
    this._callbacks.log('[BackendAdapter] Starting background event listener');

    // Run in background (non-blocking)
    this._runBackgroundListener().catch((error) => {
      this._callbacks.logError('[BackendAdapter] Background listener error', error);
    });
  }

  /**
   * Stop the background event listener.
   */
  private _stopBackgroundListener(): void {
    this._backgroundListenerActive = false;
    this._backend.unsubscribeFromEvents();
    this._callbacks.log('[BackendAdapter] Stopped background event listener');
  }

  /**
   * Run the background event listener loop.
   * Consumes events from subscribeToEvents() and processes them.
   */
  private async _runBackgroundListener(): Promise<void> {
    try {
      let eventCount = 0;
      for await (const event of this._backend.subscribeToEvents()) {
        // Check if we should stop
        if (!this._connected || !this._backgroundListenerActive) {
          this._callbacks.log(`[BackendAdapter] Background listener stopping (connected=${this._connected}, active=${this._backgroundListenerActive})`);
          break;
        }

        eventCount++;
        // DEBUG: Log background events (helpful for testing)
        this._callbacks.log(`[BackendAdapter] Background event #${eventCount}: ${event.type} (session: ${event.sessionId})`);

        // Process background events
        await this._handleBackendEvent(event);
      }
      this._callbacks.log(`[BackendAdapter] Background listener loop ended after ${eventCount} events`);
    } catch (error) {
      // Only log if we're still supposed to be listening
      if (this._backgroundListenerActive) {
        this._callbacks.logError('[BackendAdapter] Background listener error', error);
      }
    } finally {
      this._backgroundListenerActive = false;
    }
  }

  // -------------------------------------------------------------------------
  // Providers & Models
  // -------------------------------------------------------------------------

  async getProviders(): Promise<BackendProvider[]> {
    return this._backend.getProviders();
  }

  async getModels(): Promise<BackendModel[]> {
    return this._backend.getModels();
  }

  async getAgents(): Promise<BackendAgent[]> {
    return this._backend.getAgents();
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  async createSession(title?: string): Promise<BackendSession> {
    const session = await this._backend.createSession({ title });
    this._state.sessionId = session.id;
    return session;
  }

  async listSessions(): Promise<BackendSession[]> {
    return this._backend.listSessions();
  }

  async loadSession(sessionId: string): Promise<BackendSession | null> {
    const session = await this._backend.getSession(sessionId);
    if (session) {
      this._state.sessionId = session.id;
    }
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this._backend.deleteSession(sessionId);
    if (this._state.sessionId === sessionId) {
      this._state.sessionId = undefined;
    }
  }

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  /**
   * Send a message and process streaming events
   */
  async sendMessage(
    text: string,
    options?: {
      images?: Array<{ data: string; mediaType: string }>;
      files?: Array<{ path: string }>;
      model?: string;
      agent?: string;
      panelId?: string;
      cwd?: string;
    }
  ): Promise<void> {
    const startTime = Date.now();
    this._callbacks.log(`[BackendAdapter] sendMessage START - backend=${this._backend.name}, text="${text.slice(0, 50)}..."`);

    if (!this._state.sessionId) {
      // Create session if none exists
      this._callbacks.log('[BackendAdapter] No session, creating new one...');
      await this.createSession();
      this._callbacks.log(`[BackendAdapter] Created session: ${this._state.sessionId}`);
    }

    this._currentPanelId = options?.panelId;
    this._state.isProcessing = true;
    this._postMessage({ type: 'setProcessing', data: { isProcessing: true } });

    const content: MessageContent = {
      text,
      images: options?.images,
      files: options?.files,
    };

    const spawnOptions: BackendSpawnOptions = {
      cwd: options?.cwd ?? process.cwd(),
      model: options?.model,
      agent: options?.agent,
    };

    this._callbacks.log(`[BackendAdapter] Sending to session ${this._state.sessionId} with options: model=${options?.model}, cwd=${spawnOptions.cwd}`);

    try {
      const eventGenerator = this._backend.sendMessage(
        this._state.sessionId!,
        content,
        spawnOptions
      );

      let eventCount = 0;
      for await (const event of eventGenerator) {
        eventCount++;
        // DEBUG: Log each event type received
        this._callbacks.log(`[BackendAdapter] Event #${eventCount}: ${event.type}`);
        await this._handleBackendEvent(event);
      }

      const duration = Date.now() - startTime;
      this._callbacks.log(`[BackendAdapter] sendMessage COMPLETE - ${eventCount} events in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this._callbacks.logError(`[BackendAdapter] sendMessage FAILED after ${duration}ms`, error);
      this._postMessage({
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this._state.isProcessing = false;
      this._postMessage({ type: 'setProcessing', data: { isProcessing: false } });
      this._state.requestCount++;
    }
  }

  /**
   * Abort current processing
   */
  async abort(): Promise<void> {
    if (this._state.sessionId) {
      await this._backend.abortSession(this._state.sessionId);
      this._state.isProcessing = false;
      this._postMessage({ type: 'setProcessing', data: { isProcessing: false } });
    }
  }

  // -------------------------------------------------------------------------
  // Permissions
  // -------------------------------------------------------------------------

  async respondToPermission(
    permissionId: string,
    response: PermissionResponse
  ): Promise<void> {
    if (!this._state.sessionId) return;
    await this._backend.respondToPermission(this._state.sessionId, permissionId, response);
  }

  // -------------------------------------------------------------------------
  // Event Handling
  // -------------------------------------------------------------------------

  private async _handleBackendEvent(event: BackendEvent): Promise<void> {
    switch (event.type) {
      case 'text':
      case 'text_delta': {
        const data = event.data as { text: string; fullText?: string };
        this._sendAndSave({
          type: 'output',
          data: data.text,
        });
        break;
      }

      case 'reasoning': {
        const data = event.data as { text: string };
        this._sendAndSave({
          type: 'thinking',
          data: data.text,
        });
        break;
      }

      case 'tool_pending':
      case 'tool_running': {
        const data = event.data as {
          tool: string;
          callId: string;
          input?: Record<string, unknown>;
          title?: string;
        };

        // Track tool call for result matching
        const toolInput = data.input ?? {};
        const pendingToolEntry = {
          tool: data.tool,
          input: toolInput,
          fileContentBefore: undefined as string | undefined,
          startLine: undefined as number | undefined,
        };
        this._pendingToolCalls.set(data.callId, pendingToolEntry);

        // Read file content before for diff display
        // MEDIUM FIX: Capture reference before await to prevent race condition
        let fileContentBefore: string | undefined;
        if (
          (data.tool === 'Edit' || data.tool === 'MultiEdit' || data.tool === 'Write') &&
          toolInput.file_path
        ) {
          fileContentBefore = await this._callbacks.readFile(toolInput.file_path as string);
          // Use captured reference instead of re-fetching from Map after await
          pendingToolEntry.fileContentBefore = fileContentBefore ?? '';
        }

        // Handle TodoWrite specially
        if (data.tool === 'TodoWrite' && toolInput.todos) {
          const todos = (toolInput.todos as Array<{
            content: string;
            status: string;
            activeForm?: string;
          }>).map((todo) => ({
            content: todo.content,
            status: todo.status,
            activeForm: todo.activeForm,
          }));
          this._state.currentTodos = todos;
          this._postMessage({ type: 'todosUpdated', data: todos });
        }

        const toolInfo = `🔧 Executing: ${data.tool}`;
        this._sendAndSave({
          type: 'toolUse',
          data: {
            toolInfo,
            toolInput: '',
            rawInput: toolInput,
            toolName: data.tool,
            fileContentBefore,
            toolUseId: data.callId,
          },
        });
        break;
      }

      case 'tool_completed': {
        const data = event.data as {
          tool: string;
          callId: string;
          input?: Record<string, unknown>;
          output?: unknown;
        };

        const pendingTool = this._pendingToolCalls.get(data.callId);
        this._pendingToolCalls.delete(data.callId);

        // Read file content after for diff display
        let fileContentAfter: string | undefined;
        const toolInput = data.input ?? pendingTool?.input ?? {};
        if (
          (data.tool === 'Edit' || data.tool === 'MultiEdit' || data.tool === 'Write') &&
          toolInput.file_path
        ) {
          fileContentAfter = await this._callbacks.readFile(toolInput.file_path as string);
        }

        // Don't send tool result for Read and TodoWrite unless there's an error
        if (data.tool === 'Read' || data.tool === 'TodoWrite') {
          this._sendAndSave({
            type: 'toolResult',
            data: {
              content: typeof data.output === 'string' ? data.output : JSON.stringify(data.output),
              isError: false,
              toolUseId: data.callId,
              toolName: data.tool,
              rawInput: toolInput,
              hidden: true,
            },
          });
        } else {
          this._sendAndSave({
            type: 'toolResult',
            data: {
              content: typeof data.output === 'string' ? data.output : JSON.stringify(data.output),
              isError: false,
              toolUseId: data.callId,
              toolName: data.tool,
              rawInput: toolInput,
              fileContentAfter,
              startLine: pendingTool?.startLine,
            },
          });
        }
        break;
      }

      case 'tool_error': {
        const data = event.data as {
          tool: string;
          callId: string;
          input?: Record<string, unknown>;
          error?: string;
        };

        this._pendingToolCalls.delete(data.callId);

        this._sendAndSave({
          type: 'toolResult',
          data: {
            content: data.error ?? 'Tool execution failed',
            isError: true,
            toolUseId: data.callId,
            toolName: data.tool,
            rawInput: data.input,
          },
        });
        break;
      }

      case 'permission_request': {
        const data = event.data as {
          id: string;
          type: string;
          title: string;
          metadata?: Record<string, unknown>;
        };

        this._callbacks.handlePermissionRequest({
          id: data.id,
          sessionId: event.sessionId,
          type: data.type,
          title: data.title,
          tool: data.type,
          input: data.metadata ?? {},
        });
        break;
      }

      case 'session_status': {
        const data = event.data as { status: string; tools?: string[]; mcpServers?: string[] };

        if (data.tools || data.mcpServers) {
          this._postMessage({
            type: 'sessionInfo',
            data: {
              sessionId: event.sessionId,
              tools: data.tools ?? [],
              mcpServers: data.mcpServers ?? [],
            },
          });
        }

        // Update session ID if provided
        if (event.sessionId && event.sessionId !== this._state.sessionId) {
          this._state.sessionId = event.sessionId;
        }
        break;
      }

      case 'session_error': {
        const data = event.data as { error: string };
        this._postMessage({ type: 'error', data: data.error });

        // Check for login required
        if (data.error.includes('Invalid API key') || data.error.includes('unauthorized')) {
          this._callbacks.handleLoginRequired();
        }
        break;
      }

      case 'tokens': {
        const data = event.data as {
          input: number;
          output: number;
          cacheRead?: number;
          cacheWrite?: number;
        };

        this._state.totalTokensInput += data.input;
        this._state.totalTokensOutput += data.output;

        this._postMessage({
          type: 'updateTokens',
          data: {
            totalTokensInput: this._state.totalTokensInput,
            totalTokensOutput: this._state.totalTokensOutput,
            currentInputTokens: data.input,
            currentOutputTokens: data.output,
            cacheReadTokens: data.cacheRead ?? 0,
            cacheCreationTokens: data.cacheWrite ?? 0,
          },
        });
        break;
      }

      case 'cost': {
        const data = event.data as { cost: number };
        this._state.totalCost += data.cost;

        this._postMessage({
          type: 'updateTotals',
          data: {
            totalCost: this._state.totalCost,
            totalTokensInput: this._state.totalTokensInput,
            totalTokensOutput: this._state.totalTokensOutput,
            requestCount: this._state.requestCount,
            currentCost: data.cost,
          },
        });
        break;
      }

      case 'todo_updated': {
        const data = event.data as {
          todos: Array<{ content: string; status: string; activeForm?: string }>;
        };
        this._state.currentTodos = data.todos;
        this._postMessage({ type: 'todosUpdated', data: data.todos });
        break;
      }

      case 'file_edited': {
        // Could be used for file watching notifications
        break;
      }

      case 'done': {
        this._postMessage({ type: 'setProcessing', data: { isProcessing: false } });
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Helper Methods
  // -------------------------------------------------------------------------

  private _postMessage(message: { type: string; data?: unknown }): void {
    this._callbacks.postMessage(message, this._currentPanelId);
  }

  private _sendAndSave(message: { type: string; data: unknown }): void {
    this._callbacks.sendAndSaveMessage(message, this._currentPanelId);
  }

  /**
   * Reset state for new session
   */
  resetState(): void {
    this._state = {
      sessionId: undefined,
      isProcessing: false,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalCost: 0,
      requestCount: 0,
      currentTodos: [],
    };
    this._pendingToolCalls.clear();
  }
}
