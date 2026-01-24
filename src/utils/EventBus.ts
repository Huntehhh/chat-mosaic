/**
 * EventBus - Lightweight pub/sub event system for loose coupling
 *
 * Provides an opt-in event system that can be used for new features
 * without requiring changes to existing extension.ts architecture.
 *
 * @example
 * ```typescript
 * import { eventBus, EVENTS } from '../utils/EventBus';
 *
 * // Subscribe to events
 * const subscription = eventBus.on(EVENTS.PROCESS_SPAWNED, (data) => {
 *   console.log('Process spawned:', data.panelId);
 * });
 *
 * // Emit events
 * eventBus.emit(EVENTS.PROCESS_SPAWNED, { panelId: 'panel-1', pid: 12345 });
 *
 * // Cleanup
 * subscription.unsubscribe();
 * ```
 */

type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

export interface EventSubscription {
  unsubscribe: () => void;
}

/** Default max listeners per event before warning */
const DEFAULT_MAX_LISTENERS = 10;

export class EventBus {
  private _handlers = new Map<string, Set<EventHandler>>();
  private _maxListeners = DEFAULT_MAX_LISTENERS;
  private _warnedEvents = new Set<string>();

  /**
   * Set the maximum number of listeners per event before warning
   * @param n - Maximum listeners (0 = unlimited)
   */
  setMaxListeners(n: number): this {
    this._maxListeners = n;
    return this;
  }

  /**
   * Get the current max listeners setting
   */
  getMaxListeners(): number {
    return this._maxListeners;
  }

  /**
   * Subscribe to an event
   * @param event - Event name to subscribe to
   * @param handler - Callback function to invoke when event is emitted
   * @returns Subscription object with unsubscribe method
   */
  on<T>(event: string, handler: EventHandler<T>): EventSubscription {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    const handlers = this._handlers.get(event)!;
    handlers.add(handler as EventHandler);

    // Warn about potential memory leak if too many listeners
    if (
      this._maxListeners > 0 &&
      handlers.size > this._maxListeners &&
      !this._warnedEvents.has(event)
    ) {
      this._warnedEvents.add(event);
      console.warn(
        `[EventBus] Possible memory leak: ${handlers.size} listeners for "${event}". ` +
          `Use setMaxListeners() to increase limit if this is intentional.`
      );
    }

    return {
      unsubscribe: () => this._handlers.get(event)?.delete(handler as EventHandler),
    };
  }

  /**
   * Subscribe to an event once - handler is automatically removed after first invocation
   * @param event - Event name to subscribe to
   * @param handler - Callback function to invoke once
   * @returns Subscription object with unsubscribe method
   */
  once<T>(event: string, handler: EventHandler<T>): EventSubscription {
    const wrapper: EventHandler<T> = (data) => {
      this._handlers.get(event)?.delete(wrapper as EventHandler);
      handler(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * Emit an event to all subscribers
   * @param event - Event name to emit
   * @param data - Data to pass to handlers
   */
  emit<T>(event: string, data: T): void {
    const handlers = this._handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (e) {
          console.error(`[EventBus] Error in handler for ${event}:`, e);
        }
      }
    }
  }

  /**
   * Emit an event and wait for all async handlers to complete
   * @param event - Event name to emit
   * @param data - Data to pass to handlers
   * @returns Object with success status and any errors that occurred
   */
  async emitAsync<T>(
    event: string,
    data: T
  ): Promise<{ success: boolean; errors: Error[] }> {
    const errors: Error[] = [];
    const handlers = this._handlers.get(event);

    if (!handlers || handlers.size === 0) {
      return { success: true, errors: [] };
    }

    const promises: Promise<void>[] = [];
    for (const handler of handlers) {
      try {
        const result = handler(data);
        if (result instanceof Promise) {
          promises.push(
            result.catch((e) => {
              const error = e instanceof Error ? e : new Error(String(e));
              errors.push(error);
              console.error(`[EventBus] Async error in handler for ${event}:`, e);
            })
          );
        }
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        errors.push(error);
        console.error(`[EventBus] Error in handler for ${event}:`, e);
      }
    }

    await Promise.all(promises);
    return { success: errors.length === 0, errors };
  }

  /**
   * Remove all handlers for a specific event
   * @param event - Event name to clear
   */
  off(event: string): void {
    this._handlers.delete(event);
  }

  /**
   * Remove all handlers for all events
   */
  clear(): void {
    this._handlers.clear();
  }

  /**
   * Get list of all registered event names
   * @returns Array of event names
   */
  listEvents(): string[] {
    return Array.from(this._handlers.keys());
  }

  /**
   * Get the number of handlers for a specific event
   * @param event - Event name to check
   * @returns Number of registered handlers
   */
  listenerCount(event: string): number {
    return this._handlers.get(event)?.size ?? 0;
  }
}

// Singleton instance for extension-wide use
export const eventBus = new EventBus();

// Event type constants - add new events as needed
export const EVENTS = {
  // Process lifecycle events
  PROCESS_SPAWNED: 'process:spawned',
  PROCESS_EXIT: 'process:exit',
  PROCESS_ERROR: 'process:error',

  // Permission events
  PERMISSION_PROMPT: 'permission:prompt',
  PERMISSION_RESPONDED: 'permission:responded',

  // Conversation events
  CONVERSATION_LOADED: 'conversation:loaded',
  CONVERSATION_SAVED: 'conversation:saved',

  // Panel events
  PANEL_ACTIVATED: 'panel:activated',
  PANEL_DISPOSED: 'panel:disposed',

  // Terminal events
  TERMINAL_OPENED: 'terminal:opened',
  TERMINAL_CLOSED: 'terminal:closed',

  // Message events
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_SENT: 'message:sent',
} as const;

// Type helper for event data
export type EventType = (typeof EVENTS)[keyof typeof EVENTS];
