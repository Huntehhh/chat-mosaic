/**
 * HandlerRegistry - Unified handler registration pattern
 *
 * Provides a consistent API for message/event handler registration
 * that can be used by both backend (MessageRouter) and frontend (useVSCodeMessaging).
 *
 * This pattern consolidates the two parallel message routing systems:
 * - Extension: MessageRouter class
 * - Webview: useVSCodeMessaging hook with Map-based dispatch
 *
 * @example
 * ```typescript
 * import { HandlerRegistry } from '../utils/HandlerRegistry';
 *
 * interface MyMessage {
 *   type: string;
 *   data?: unknown;
 * }
 *
 * const registry = new HandlerRegistry<MyMessage>();
 *
 * registry.register('greeting', async (msg) => {
 *   console.log('Received greeting:', msg.data);
 * });
 *
 * await registry.dispatch('greeting', { type: 'greeting', data: 'Hello!' });
 * ```
 */

export type Handler<TMessage = unknown> = (message: TMessage) => void | Promise<void>;

export interface HandlerOptions {
  /** If true, handler will be removed after first invocation */
  once?: boolean;
  /** Priority for handler execution (higher = earlier, default 0) */
  priority?: number;
}

interface RegisteredHandler<TMessage> {
  handler: Handler<TMessage>;
  options: HandlerOptions;
}

export class HandlerRegistry<TMessage = unknown> {
  private _handlers = new Map<string, RegisteredHandler<TMessage>[]>();

  /**
   * Register a handler for a specific message type
   *
   * @param type - Message type to handle
   * @param handler - Handler function
   * @param options - Optional configuration
   * @returns Unregister function
   */
  register(
    type: string,
    handler: Handler<TMessage>,
    options: HandlerOptions = {}
  ): () => void {
    const registered: RegisteredHandler<TMessage> = {
      handler,
      options: { priority: 0, ...options },
    };

    if (!this._handlers.has(type)) {
      this._handlers.set(type, []);
    }

    const handlers = this._handlers.get(type)!;
    handlers.push(registered);

    // Sort by priority (higher first)
    handlers.sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));

    // Return unregister function
    return () => {
      const idx = handlers.indexOf(registered);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    };
  }

  /**
   * Register a one-time handler (automatically removed after first call)
   *
   * @param type - Message type to handle
   * @param handler - Handler function
   * @returns Unregister function
   */
  registerOnce(type: string, handler: Handler<TMessage>): () => void {
    return this.register(type, handler, { once: true });
  }

  /**
   * Register multiple handlers at once
   *
   * @param handlers - Map of type to handler
   * @returns Function to unregister all handlers
   */
  registerAll(handlers: Record<string, Handler<TMessage>>): () => void {
    const unregisters: (() => void)[] = [];

    for (const [type, handler] of Object.entries(handlers)) {
      unregisters.push(this.register(type, handler));
    }

    return () => {
      for (const unregister of unregisters) {
        unregister();
      }
    };
  }

  /**
   * Dispatch a message to registered handlers
   *
   * @param type - Message type
   * @param message - Message payload
   * @returns True if any handler was called
   */
  async dispatch(type: string, message: TMessage): Promise<boolean> {
    const handlers = this._handlers.get(type);

    if (!handlers || handlers.length === 0) {
      return false;
    }

    // Iterate over a COPY to prevent concurrent modification issues
    // (e.g., handler unregisters itself or another dispatch runs concurrently)
    const handlersCopy = [...handlers];
    const toRemove: RegisteredHandler<TMessage>[] = [];

    for (const registered of handlersCopy) {
      try {
        await registered.handler(message);
      } catch (error) {
        console.error(`[HandlerRegistry] Error in handler for "${type}":`, error);
      }

      if (registered.options.once) {
        toRemove.push(registered);
      }
    }

    // Remove one-time handlers from the ORIGINAL array
    for (const registered of toRemove) {
      const idx = handlers.indexOf(registered);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    }

    return true;
  }

  /**
   * Dispatch synchronously (for handlers that don't return promises)
   *
   * @param type - Message type
   * @param message - Message payload
   * @returns True if any handler was called
   */
  dispatchSync(type: string, message: TMessage): boolean {
    const handlers = this._handlers.get(type);

    if (!handlers || handlers.length === 0) {
      return false;
    }

    // Iterate over a COPY to prevent concurrent modification issues
    const handlersCopy = [...handlers];
    const toRemove: RegisteredHandler<TMessage>[] = [];

    for (const registered of handlersCopy) {
      try {
        registered.handler(message);
      } catch (error) {
        console.error(`[HandlerRegistry] Error in handler for "${type}":`, error);
      }

      if (registered.options.once) {
        toRemove.push(registered);
      }
    }

    // Remove one-time handlers from the ORIGINAL array
    for (const registered of toRemove) {
      const idx = handlers.indexOf(registered);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    }

    return true;
  }

  /**
   * Check if a handler is registered for a type
   *
   * @param type - Message type
   * @returns True if at least one handler is registered
   */
  has(type: string): boolean {
    const handlers = this._handlers.get(type);
    return handlers !== undefined && handlers.length > 0;
  }

  /**
   * Get the number of handlers for a type
   *
   * @param type - Message type
   * @returns Number of registered handlers
   */
  count(type: string): number {
    return this._handlers.get(type)?.length || 0;
  }

  /**
   * Get all registered message types
   *
   * @returns Array of registered types
   */
  types(): string[] {
    return Array.from(this._handlers.keys()).filter(
      (type) => this._handlers.get(type)!.length > 0
    );
  }

  /**
   * Remove all handlers for a specific type
   *
   * @param type - Message type
   */
  clear(type: string): void {
    this._handlers.delete(type);
  }

  /**
   * Remove all handlers
   */
  clearAll(): void {
    this._handlers.clear();
  }
}

/**
 * Create a typed handler registry with message type inference
 *
 * @example
 * ```typescript
 * interface AppMessage {
 *   type: 'init' | 'update' | 'close';
 *   data?: unknown;
 * }
 *
 * const registry = createTypedRegistry<AppMessage>();
 * registry.register('init', (msg) => { // msg is AppMessage });
 * ```
 */
export function createTypedRegistry<TMessage>(): HandlerRegistry<TMessage> {
  return new HandlerRegistry<TMessage>();
}
