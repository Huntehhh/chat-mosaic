/**
 * Backend Abstraction Layer Exports
 *
 * Provides unified interface for both Claude Code CLI and OpenCode CLI backends.
 */

// Types
export type {
  BackendEventType,
  BackendEvent,
  MessageContent,
  SessionStatus,
  BackendSession,
  ModelCapabilities,
  ModelCost,
  BackendModel,
  BackendProvider,
  AgentMode,
  BackendAgent,
  BackendPermissionRequest,
  PermissionResponse,
  ThinkingMode,
  BackendSpawnOptions,
  BackendConnectOptions,
  BackendType,
  ClaudeBackendConfig,
  OpenCodeBackendConfig,
  BackendConfig,
  IBackend,
} from './types';

export { BackendError, OpenCodeError } from './types';

// Factory
export { BackendFactory } from './BackendFactory';

// Implementations
export { ClaudeBackend } from './ClaudeBackend';
export { OpenCodeBackend } from './OpenCodeBackend';

// Adapter (bridges backend events to UI messages)
export { BackendAdapter } from './BackendAdapter';
export type { BackendAdapterCallbacks, BackendAdapterState } from './BackendAdapter';

// OpenCode components (for advanced usage)
export { OpenCodeClient } from './opencode/OpenCodeClient';
export { OpenCodeEventStream } from './opencode/OpenCodeEventStream';
export { OpenCodeServerManager } from './opencode/OpenCodeServerManager';
export { OpenCodeEventMapper } from './opencode/OpenCodeEventMapper';

// Re-export OpenCode types
export type {
  OpenCodeSession,
  OpenCodeMessage,
  OpenCodeMessagePart,
  OpenCodeProvider,
  OpenCodeModel,
  OpenCodeProviderListResponse,
  OpenCodeAgent,
  OpenCodePermission,
  OpenCodeConfig,
  OpenCodeMcpConfig,
  OpenCodeMcpStatus,
  PromptPart,
  PromptInput,
  OpenCodeClientConfig,
} from './opencode/OpenCodeClient';

export type {
  OpenCodeEventType,
  OpenCodeEvent,
  EventCallback,
  EventStreamConfig,
} from './opencode/OpenCodeEventStream';

export type { ServerManagerConfig } from './opencode/OpenCodeServerManager';
