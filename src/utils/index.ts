/**
 * Utils Barrel Export
 *
 * Centralized exports for all utility modules.
 * Import from this file for convenience:
 *
 * @example
 * ```typescript
 * import { debounce, throttle, eventBus, Platform } from '../utils';
 * ```
 */

// Event system
export { EventBus, eventBus, EVENTS } from './EventBus';
export type { EventSubscription, EventType } from './EventBus';

// Handler registry (unified message/event handler pattern)
export { HandlerRegistry, createTypedRegistry } from './HandlerRegistry';
export type { Handler, HandlerOptions } from './HandlerRegistry';

// Timing utilities
export {
  debounce,
  debounceWithOptions,
  throttle,
  rateLimit,
  delay,
  after,
  once,
} from './debounce';

// Claude CLI argument building
export {
  buildClaudeArgs,
  buildTerminalArgs,
  buildInteractiveArgs,
  buildTerminalCommand,
  // Note: normalizePathForOS is exported from paths.ts, not here to avoid duplicate
} from './claude-args';
export type { ClaudeArgsOptions, InteractiveArgsOptions } from './claude-args';

// Message utilities (legacy)
export { extractMessageText, getMessageContent } from './message-utils';

// Message text extraction (consolidated utility)
export {
  extractText,
  extractTextFromBlocks,
  extractThinkingFromBlocks,
  extractToolUses,
  extractDisplayText,
  extractTextPreview,
  hasText,
  isTextBlock,
  isThinkingBlock,
  isToolUseBlock,
  isToolResultBlock,
} from './message-text-extractor';
export type {
  TextContentBlock,
  ThinkingContentBlock,
  ToolUseContentBlock,
  ToolResultContentBlock,
  ContentBlock,
  TextExtractable,
} from './message-text-extractor';

// System notifications
export { showResponseNotification, getLastAssistantMessagePreview } from './notifications';

// Path utilities (cross-platform with XDG compliance)
export {
  getHomeDir,
  getConfigDir,
  getDataDir,
  getCacheDir,
  getClaudeConfigDir,
  getClaudeProjectsPath,
  getClaudeConfigFile,
  isWSLPath,
  isUNCPath,
  convertToWSLPath,
  convertFromWSLPath,
  normalizePathForOS,
  joinPath,
  getDirName,
  getBaseName,
} from './paths';

// Platform detection
export {
  Platform,
  getDefaultShell,
  detectShellType,
  isWSLEnvironment,
  isWSLCapable,
  getInstallCommand,
  getPlatformInfo,
} from './platform';
export type { ShellType } from './platform';

// Process control (cross-platform)
export {
  getSpawnOptions,
  getBackgroundSpawnOptions,
  isProcessRunning,
  createProcessAbortController,
} from './process-control';
export type { SpawnOptions, ProcessSignal } from './process-control';

// Shell utilities
export {
  escapePosixArg,
  escapePowerShellArg,
  escapeFishArg,
  escapeCmdArg,
  escapeArg,
  escapeArgs,
  buildShellCommand,
  buildPowerShellArgs,
  buildWSLArgs,
  isValidShellPath,
  validateShellPath,
} from './shell';

// Spawn configuration
export {
  buildSpawnConfig,
  hasPlatformConfigChanged,
  hasPermissionConfigChanged,
  hasThinkingConfigChanged,
} from './spawn-config';
export type { ClaudeSpawnConfig } from './spawn-config';
