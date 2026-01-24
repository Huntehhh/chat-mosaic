/**
 * OpenCodeEventStream - SSE Event Subscriber for OpenCode
 *
 * Connects to the OpenCode SSE endpoint for real-time event streaming.
 * Uses native Node.js fetch for SSE handling instead of browser EventSource.
 */

// ============================================================================
// Event Types
// ============================================================================

export type OpenCodeEventType =
  | 'message.updated'
  | 'message.removed'
  | 'message.part.updated'
  | 'message.part.removed'
  | 'session.created'
  | 'session.updated'
  | 'session.deleted'
  | 'session.status'
  | 'session.idle'
  | 'session.error'
  | 'session.compacted'
  | 'permission.updated'
  | 'permission.replied'
  | 'todo.updated'
  | 'file.edited'
  | 'file.watcher.updated'
  | 'pty.created'
  | 'pty.updated'
  | 'pty.exited'
  | 'pty.deleted'
  | 'mcp.tools.changed'
  | 'lsp.client.diagnostics'
  | 'lsp.updated'
  | 'vcs.branch.updated'
  | 'project.updated'
  | 'installation.updated'
  | 'installation.update-available'
  | 'server.connected'
  | 'server.instance.disposed'
  | 'global.disposed'
  | 'command.executed'
  | 'tui.prompt.append'
  | 'tui.command.execute'
  | 'tui.toast.show';

export interface OpenCodeEvent {
  type: OpenCodeEventType;
  properties: unknown;
}

export type EventCallback = (event: OpenCodeEvent) => void;

// ============================================================================
// Configuration
// ============================================================================

export interface EventStreamConfig {
  baseUrl: string;
  directory: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

// ============================================================================
// OpenCodeEventStream Class
// ============================================================================

export class OpenCodeEventStream {
  // LOW FIX: Define defaults as constants to avoid non-null assertions later
  private static readonly DEFAULT_RECONNECT_INTERVAL = 3000;
  private static readonly DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

  private _config: Required<EventStreamConfig>;
  private _abortController?: AbortController;
  private _listeners: Map<string, Set<EventCallback>> = new Map();
  private _reconnectAttempts = 0;
  private _reconnectTimer?: ReturnType<typeof setTimeout>;
  private _isConnecting = false;
  private _isDisconnected = false;
  private _isConnected = false;

  constructor(config: EventStreamConfig) {
    // LOW FIX: Ensure all config values are defined to eliminate non-null assertions
    this._config = {
      baseUrl: config.baseUrl,
      directory: config.directory,
      reconnectInterval: config.reconnectInterval ?? OpenCodeEventStream.DEFAULT_RECONNECT_INTERVAL,
      maxReconnectAttempts: config.maxReconnectAttempts ?? OpenCodeEventStream.DEFAULT_MAX_RECONNECT_ATTEMPTS,
    };
  }

  // -------------------------------------------------------------------------
  // Connection Management
  // -------------------------------------------------------------------------

  /**
   * Connect to the SSE endpoint
   */
  connect(): void {
    if (this._isConnecting || this._isConnected) {
      console.log('[OpenCodeEventStream] Already connected or connecting');
      return;
    }

    this._isDisconnected = false;
    this._isConnecting = true;

    const url = `${this._config.baseUrl}/event?directory=${encodeURIComponent(this._config.directory)}`;
    console.log('[OpenCodeEventStream] Connecting to:', url);

    this._startSSEConnection(url);
  }

  /**
   * Disconnect from the SSE endpoint
   */
  disconnect(): void {
    this._isDisconnected = true;
    this._isConnected = false;
    this._clearReconnectTimer();

    if (this._abortController) {
      this._abortController.abort();
      this._abortController = undefined;
    }

    console.log('[OpenCodeEventStream] Disconnected');
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this._isConnected;
  }

  // -------------------------------------------------------------------------
  // Event Handling
  // -------------------------------------------------------------------------

  /**
   * Subscribe to an event type
   * @param eventType - Event type or '*' for all events
   * @param callback - Callback function
   */
  on(eventType: string, callback: EventCallback): void {
    if (!this._listeners.has(eventType)) {
      this._listeners.set(eventType, new Set());
    }
    this._listeners.get(eventType)!.add(callback);
  }

  /**
   * Unsubscribe from an event type
   */
  off(eventType: string, callback: EventCallback): void {
    this._listeners.get(eventType)?.delete(callback);
  }

  /**
   * Remove all listeners for an event type
   */
  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this._listeners.delete(eventType);
    } else {
      this._listeners.clear();
    }
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private async _startSSEConnection(url: string): Promise<void> {
    this._abortController = new AbortController();

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: this._abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      this._isConnecting = false;
      this._isConnected = true;
      this._reconnectAttempts = 0;
      console.log('[OpenCodeEventStream] Connected');

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('[OpenCodeEventStream] Stream ended');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data) as OpenCodeEvent;
              this._dispatch(parsed);
            } catch (error) {
              console.error('[OpenCodeEventStream] Failed to parse event:', error, data);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[OpenCodeEventStream] Connection aborted');
        return;
      }
      console.error('[OpenCodeEventStream] Connection error:', error);
      this._isConnecting = false;
      this._isConnected = false;
      this._handleError();
    }
  }

  private _dispatch(event: OpenCodeEvent): void {
    // Dispatch to type-specific listeners
    const typeListeners = this._listeners.get(event.type);
    if (typeListeners) {
      for (const callback of typeListeners) {
        try {
          callback(event);
        } catch (error) {
          console.error('[OpenCodeEventStream] Listener error:', error);
        }
      }
    }

    // Dispatch to wildcard listeners
    const wildcardListeners = this._listeners.get('*');
    if (wildcardListeners) {
      for (const callback of wildcardListeners) {
        try {
          callback(event);
        } catch (error) {
          console.error('[OpenCodeEventStream] Wildcard listener error:', error);
        }
      }
    }
  }

  private _handleError(): void {
    if (this._isDisconnected) {
      return;
    }

    // Attempt reconnection with exponential backoff
    // LOW FIX: Removed non-null assertions - config values are now guaranteed defined
    if (this._reconnectAttempts < this._config.maxReconnectAttempts) {
      const delay = this._config.reconnectInterval * Math.pow(2, this._reconnectAttempts);
      this._reconnectAttempts++;

      console.log(
        `[OpenCodeEventStream] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts}/${this._config.maxReconnectAttempts})`
      );

      this._reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('[OpenCodeEventStream] Max reconnection attempts reached');

      // Dispatch error event
      this._dispatch({
        type: 'server.instance.disposed',
        properties: {
          error: 'Max reconnection attempts reached',
        },
      });
    }
  }

  private _clearReconnectTimer(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = undefined;
    }
  }
}
