/**
 * Backend Abstraction Layer - Unified Types
 *
 * Provides a common interface for both Claude Code CLI and OpenCode CLI backends.
 * This allows seamless switching between backends via feature flag.
 */

// ============================================================================
// Event Types
// ============================================================================

/** Normalized event types from both backends */
export type BackendEventType =
  | 'text'               // Text content streaming
  | 'text_delta'         // Incremental text update
  | 'reasoning'          // Extended thinking content
  | 'tool_pending'       // Tool call queued
  | 'tool_running'       // Tool execution started
  | 'tool_completed'     // Tool finished successfully
  | 'tool_error'         // Tool failed
  | 'permission_request' // Permission needed
  | 'session_status'     // Session state change (idle/busy/retry)
  | 'session_error'      // Session-level error
  | 'tokens'             // Token usage update
  | 'cost'               // Cost update
  | 'todo_updated'       // Todo list changed
  | 'file_edited'        // File was modified
  | 'done';              // Message complete

/** Unified event structure from both backends */
export interface BackendEvent {
  type: BackendEventType;
  sessionId: string;
  messageId?: string;
  partId?: string;
  data: unknown;
  timestamp: number;
}

// ============================================================================
// Message Content
// ============================================================================

/** Normalized message content for sending */
export interface MessageContent {
  text?: string;
  images?: Array<{ data: string; mediaType: string }>;
  files?: Array<{ path: string; content?: string }>;
}

// ============================================================================
// Session Types
// ============================================================================

/** Session status values */
export type SessionStatus = 'idle' | 'busy' | 'retry';

/** Unified session representation */
export interface BackendSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: SessionStatus;
  messageCount?: number;
  cost?: number;
  tokens?: { input: number; output: number };
}

// ============================================================================
// Model & Provider Types
// ============================================================================

/** Model capability flags */
export interface ModelCapabilities {
  vision: boolean;
  reasoning: boolean;
  toolUse: boolean;
}

/** Model cost information */
export interface ModelCost {
  inputPer1k: number;
  outputPer1k: number;
}

/** Unified model representation */
export interface BackendModel {
  id: string;
  providerId: string;
  name: string;
  displayName: string;
  capabilities: ModelCapabilities;
  cost?: ModelCost;
}

/** Unified provider representation */
export interface BackendProvider {
  id: string;
  name: string;
  connected: boolean;
  models: BackendModel[];
}

// ============================================================================
// Agent Types
// ============================================================================

/** Agent execution mode */
export type AgentMode = 'primary' | 'subagent' | 'all';

/** Unified agent representation */
export interface BackendAgent {
  name: string;
  description?: string;
  mode: AgentMode;
  isNative: boolean;
  isDefault: boolean;
  model?: { providerId: string; modelId: string };
  tools: Record<string, boolean>;
}

// ============================================================================
// Permission Types
// ============================================================================

/** Permission request from backend */
export interface BackendPermissionRequest {
  id: string;
  sessionId: string;
  type: string;            // 'bash', 'edit', 'external_directory', etc.
  title: string;           // User-facing description
  tool: string;            // Tool name
  input: Record<string, unknown>;
  patterns?: string[];     // Matching patterns for "always" approval
  metadata?: Record<string, unknown>;
}

/** User response to permission request */
export type PermissionResponse = 'once' | 'always' | 'reject';

// ============================================================================
// Spawn & Connection Options
// ============================================================================

/** Thinking mode levels */
export type ThinkingMode = 'none' | 'think' | 'think-hard' | 'ultrathink';

/** Options for spawning a new message/session */
export interface BackendSpawnOptions {
  cwd: string;
  sessionId?: string;        // Resume existing session
  model?: string;            // provider/model format
  agent?: string;            // Agent name
  thinkingMode?: ThinkingMode;
}

/** Backend connection options */
export interface BackendConnectOptions {
  cwd: string;
}

// ============================================================================
// Backend Configuration
// ============================================================================

/** Backend type identifier */
export type BackendType = 'claude' | 'opencode';

/** Claude-specific configuration */
export interface ClaudeBackendConfig {
  wslEnabled?: boolean;
  wslDistro?: string;
  nodePath?: string;
  claudePath?: string;
}

/** OpenCode-specific configuration */
export interface OpenCodeBackendConfig {
  serverUrl?: string;       // Default: http://localhost:4096
  autoStart?: boolean;      // Start server if not running
  executablePath?: string;  // Custom opencode binary path
}

/** Full backend configuration */
export interface BackendConfig {
  type: BackendType;
  cwd: string;
  claude?: ClaudeBackendConfig;
  opencode?: OpenCodeBackendConfig;
}

// ============================================================================
// Backend Interface
// ============================================================================

/**
 * Unified backend interface for AI CLI interactions.
 * Implementations: ClaudeBackend, OpenCodeBackend
 */
export interface IBackend {
  /** Backend identifier */
  readonly name: BackendType;

  /** Whether the backend is currently connected */
  readonly isConnected: boolean;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Connect to the backend */
  connect(options?: BackendConnectOptions): Promise<void>;

  /** Disconnect from the backend */
  disconnect(): Promise<void>;

  // -------------------------------------------------------------------------
  // Providers & Models
  // -------------------------------------------------------------------------

  /** Get all available providers */
  getProviders(): Promise<BackendProvider[]>;

  /** Get all available models across providers */
  getModels(): Promise<BackendModel[]>;

  /** Get all available agents */
  getAgents(): Promise<BackendAgent[]>;

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  /** Create a new session */
  createSession(options?: { title?: string }): Promise<BackendSession>;

  /** List all sessions */
  listSessions(): Promise<BackendSession[]>;

  /** Get a specific session */
  getSession(sessionId: string): Promise<BackendSession | null>;

  /** Delete a session */
  deleteSession(sessionId: string): Promise<void>;

  /** Abort/interrupt current processing in a session */
  abortSession(sessionId: string): Promise<void>;

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  /**
   * Send a message and receive streaming events.
   * Returns an async generator that yields BackendEvents.
   */
  sendMessage(
    sessionId: string,
    content: MessageContent,
    options?: BackendSpawnOptions
  ): AsyncGenerator<BackendEvent, void, unknown>;

  // -------------------------------------------------------------------------
  // Permissions
  // -------------------------------------------------------------------------

  /** Get pending permission requests for a session */
  getPendingPermissions(sessionId: string): Promise<BackendPermissionRequest[]>;

  /** Respond to a permission request */
  respondToPermission(
    sessionId: string,
    permissionId: string,
    response: PermissionResponse
  ): Promise<void>;

  // -------------------------------------------------------------------------
  // Event Subscription
  // -------------------------------------------------------------------------

  /**
   * Subscribe to background events from the backend.
   * Returns an async generator that yields BackendEvents.
   */
  subscribeToEvents(): AsyncGenerator<BackendEvent, void, unknown>;

  /** Unsubscribe from background events */
  unsubscribeFromEvents(): void;
}

// ============================================================================
// Error Types
// ============================================================================

/** Backend error with structured information */
export class BackendError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

/** Error specific to OpenCode backend */
export class OpenCodeError extends BackendError {
  constructor(
    public readonly response: { error: string; code?: string; details?: unknown }
  ) {
    super(response.error, response.code, response.details);
    this.name = 'OpenCodeError';
  }
}
