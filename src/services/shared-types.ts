/**
 * Shared types between extension.ts and frontend (webview).
 * Single source of truth for message payloads and common interfaces.
 *
 * NOTE: ToolUse, ToolResult, and SessionInfo are defined in CliSchemas.ts
 * as Zod-inferred types. Use those for CLI message parsing.
 */

// =============================================================================
// Webview Message Types
// =============================================================================

/**
 * Base message structure for webview communication
 */
export interface WebviewMessage {
  type: string;
  data?: unknown;
}

/**
 * Payload for sending a message to Claude
 */
export interface SendMessagePayload {
  text: string;
  planMode?: boolean;
  thinkingMode?: boolean;
  images?: string[];
}

// =============================================================================
// Token Tracking Types
// =============================================================================

/**
 * Token usage update from Claude CLI
 */
export interface TokenUpdate {
  totalTokensInput: number;
  totalTokensOutput: number;
  currentInputTokens?: number;
  currentOutputTokens?: number;
}

/**
 * Cost calculation for token usage
 */
export interface TokenCost {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error information for display
 */
export interface ErrorInfo {
  message: string;
  code?: string;
  recoverable?: boolean;
  action?: string;
}

// =============================================================================
// State Types
// =============================================================================

/**
 * Connection state for Claude process
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Process state information
 */
export interface ProcessState {
  running: boolean;
  sessionId?: string;
  connectionState: ConnectionState;
}
