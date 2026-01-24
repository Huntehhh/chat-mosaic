/**
 * OpenCodeEventMapper - Event Normalization for OpenCode
 *
 * Maps OpenCode SSE events to normalized BackendEvents.
 * This enables seamless switching between Claude and OpenCode backends.
 */

import type { BackendEvent, BackendEventType } from '../types';
import type { OpenCodeEvent, OpenCodeEventType } from './OpenCodeEventStream';

// ============================================================================
// OpenCode Event Property Types
// ============================================================================

interface MessagePartUpdatedProps {
  part: {
    id: string;
    sessionID: string;
    messageID: string;
    type: 'text' | 'reasoning' | 'tool';
    text?: string;
    tool?: string;
    callID?: string;
    state?: ToolState;
  };
  delta?: string;
}

interface ToolState {
  status: 'pending' | 'running' | 'completed' | 'error';
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  time?: { start: number; end?: number };
}

interface SessionStatusProps {
  sessionID: string;
  status: {
    type: 'idle' | 'busy' | 'retry';
  };
}

interface SessionErrorProps {
  sessionID?: string;
  error: string;
}

interface PermissionProps {
  id: string;
  sessionID: string;
  type: string;
  title: string;
  pattern?: string | string[];
  metadata: Record<string, unknown>;
}

interface TodoUpdatedProps {
  sessionID: string;
  todos: Array<{
    content: string;
    status: string;
    activeForm?: string;
  }>;
}

interface FileEditedProps {
  file: string;
}

interface MessageUpdatedProps {
  info: {
    id: string;
    sessionID: string;
    role: 'user' | 'assistant';
    tokens?: {
      input: number;
      output: number;
      reasoning?: number;
      cache: { read: number; write: number };
    };
    cost?: number;
  };
}

// ============================================================================
// OpenCodeEventMapper Class
// ============================================================================

export class OpenCodeEventMapper {
  /**
   * Map an OpenCode event to normalized BackendEvents.
   * May yield zero, one, or multiple events depending on the input.
   */
  static *mapToBackendEvents(
    event: OpenCodeEvent,
    sessionId: string
  ): Generator<BackendEvent> {
    const timestamp = Date.now();

    switch (event.type as OpenCodeEventType) {
      case 'message.part.updated': {
        const props = event.properties as MessagePartUpdatedProps;
        yield* this._mapMessagePartUpdated(props, timestamp);
        break;
      }

      case 'session.status': {
        const props = event.properties as SessionStatusProps;
        yield {
          type: 'session_status' as BackendEventType,
          sessionId: props.sessionID,
          timestamp,
          data: { status: props.status.type },
        };
        break;
      }

      case 'session.error': {
        const props = event.properties as SessionErrorProps;
        yield {
          type: 'session_error' as BackendEventType,
          sessionId: props.sessionID ?? sessionId,
          timestamp,
          data: { error: props.error },
        };
        break;
      }

      case 'permission.updated': {
        const permission = event.properties as PermissionProps;
        yield {
          type: 'permission_request' as BackendEventType,
          sessionId: permission.sessionID,
          timestamp,
          data: {
            id: permission.id,
            type: permission.type,
            title: permission.title,
            metadata: permission.metadata,
            patterns: Array.isArray(permission.pattern)
              ? permission.pattern
              : permission.pattern
                ? [permission.pattern]
                : undefined,
          },
        };
        break;
      }

      case 'todo.updated': {
        const props = event.properties as TodoUpdatedProps;
        yield {
          type: 'todo_updated' as BackendEventType,
          sessionId: props.sessionID,
          timestamp,
          data: { todos: props.todos },
        };
        break;
      }

      case 'file.edited': {
        const props = event.properties as FileEditedProps;
        yield {
          type: 'file_edited' as BackendEventType,
          sessionId,
          timestamp,
          data: { file: props.file },
        };
        break;
      }

      case 'message.updated': {
        const props = event.properties as MessageUpdatedProps;
        const msg = props.info;

        // Extract token usage from assistant messages
        if (msg.role === 'assistant' && msg.tokens) {
          yield {
            type: 'tokens' as BackendEventType,
            sessionId: msg.sessionID,
            messageId: msg.id,
            timestamp,
            data: {
              input: msg.tokens.input,
              output: msg.tokens.output,
              reasoning: msg.tokens.reasoning,
              cacheRead: msg.tokens.cache.read,
              cacheWrite: msg.tokens.cache.write,
            },
          };

          if (msg.cost !== undefined) {
            yield {
              type: 'cost' as BackendEventType,
              sessionId: msg.sessionID,
              messageId: msg.id,
              timestamp,
              data: { cost: msg.cost },
            };
          }
        }
        break;
      }

      // Events we acknowledge but don't need to handle yet
      case 'session.created':
      case 'session.updated':
      case 'session.deleted':
      case 'session.idle':
      case 'session.compacted':
      case 'permission.replied':
      case 'message.removed':
      case 'message.part.removed':
      case 'file.watcher.updated':
      case 'pty.created':
      case 'pty.updated':
      case 'pty.exited':
      case 'pty.deleted':
      case 'mcp.tools.changed':
      case 'lsp.client.diagnostics':
      case 'lsp.updated':
      case 'vcs.branch.updated':
      case 'project.updated':
      case 'installation.updated':
      case 'installation.update-available':
      case 'server.connected':
      case 'server.instance.disposed':
      case 'global.disposed':
      case 'command.executed':
      case 'tui.prompt.append':
      case 'tui.command.execute':
      case 'tui.toast.show':
        // No-op for now, can be extended later
        break;

      default:
        console.log('[OpenCodeEventMapper] Unhandled event type:', event.type);
    }
  }

  /**
   * Map message part updates to BackendEvents
   */
  private static *_mapMessagePartUpdated(
    props: MessagePartUpdatedProps,
    timestamp: number
  ): Generator<BackendEvent> {
    const part = props.part;
    const base = {
      sessionId: part.sessionID,
      messageId: part.messageID,
      partId: part.id,
      timestamp,
    };

    switch (part.type) {
      case 'text':
        yield {
          ...base,
          type: (props.delta ? 'text_delta' : 'text') as BackendEventType,
          data: {
            text: props.delta ?? part.text,
            fullText: part.text,
          },
        };
        break;

      case 'reasoning':
        yield {
          ...base,
          type: 'reasoning' as BackendEventType,
          data: { text: part.text },
        };
        break;

      case 'tool':
        if (part.state) {
          yield* this._mapToolPart(part, base, timestamp);
        }
        break;
    }
  }

  /**
   * Map tool part updates to BackendEvents
   */
  private static *_mapToolPart(
    part: MessagePartUpdatedProps['part'],
    base: { sessionId: string; messageId: string; partId: string; timestamp: number },
    _timestamp: number
  ): Generator<BackendEvent> {
    const state = part.state!;

    switch (state.status) {
      case 'pending':
        yield {
          ...base,
          type: 'tool_pending' as BackendEventType,
          data: {
            tool: part.tool,
            callId: part.callID,
            input: state.input,
          },
        };
        break;

      case 'running':
        yield {
          ...base,
          type: 'tool_running' as BackendEventType,
          data: {
            tool: part.tool,
            callId: part.callID,
            input: state.input,
            title: state.title,
            metadata: state.metadata,
          },
        };
        break;

      case 'completed':
        yield {
          ...base,
          type: 'tool_completed' as BackendEventType,
          data: {
            tool: part.tool,
            callId: part.callID,
            input: state.input,
            output: state.output,
            title: state.title,
            metadata: state.metadata,
            duration: state.time?.end && state.time?.start
              ? state.time.end - state.time.start
              : undefined,
          },
        };
        break;

      case 'error':
        yield {
          ...base,
          type: 'tool_error' as BackendEventType,
          data: {
            tool: part.tool,
            callId: part.callID,
            input: state.input,
            error: state.error,
            metadata: state.metadata,
          },
        };
        break;
    }
  }
}
