/**
 * Message Text Extractor - Consolidated utility for extracting text from various message formats
 *
 * This utility consolidates multiple duplicate implementations across the codebase:
 * - ConversationManager._extractUserText()
 * - webview/lib/messageUtils.getMessageText()
 * - utils/message-utils.extractMessageText()
 * - types/shared.extractTextFromContent()
 * - StreamProcessor inline extraction
 *
 * Handles all Claude CLI JSONL message format variations.
 *
 * @example
 * ```typescript
 * import { extractText, extractTextFromBlocks } from '../utils/message-text-extractor';
 *
 * // From any message-like object
 * const text = extractText(message);
 *
 * // From ContentBlock array specifically
 * const blockText = extractTextFromBlocks(message.content);
 * ```
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Text content block from Claude CLI
 */
export interface TextContentBlock {
  type: 'text';
  text: string;
}

/**
 * Thinking content block from Claude CLI
 */
export interface ThinkingContentBlock {
  type: 'thinking';
  thinking: string;
}

/**
 * Tool use content block from Claude CLI
 */
export interface ToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

/**
 * Tool result content block from Claude CLI
 */
export interface ToolResultContentBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
}

/**
 * Union of all content block types
 */
export type ContentBlock =
  | TextContentBlock
  | ThinkingContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock
  | { type: string; [key: string]: unknown };

/**
 * Generic message-like object with various possible text locations
 */
export interface TextExtractable {
  content?: ContentBlock[] | string;
  text?: string;
  message?: {
    content?: ContentBlock[] | string;
    text?: string;
  };
  thinking?: string;
  toolName?: string;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a content block is a text block
 */
export function isTextBlock(block: unknown): block is TextContentBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    'type' in block &&
    (block as { type: string }).type === 'text' &&
    'text' in block &&
    typeof (block as { text: unknown }).text === 'string'
  );
}

/**
 * Check if a content block is a thinking block
 */
export function isThinkingBlock(block: unknown): block is ThinkingContentBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    'type' in block &&
    (block as { type: string }).type === 'thinking' &&
    'thinking' in block &&
    typeof (block as { thinking: unknown }).thinking === 'string'
  );
}

/**
 * Check if a content block is a tool use block
 */
export function isToolUseBlock(block: unknown): block is ToolUseContentBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    'type' in block &&
    (block as { type: string }).type === 'tool_use'
  );
}

/**
 * Check if a content block is a tool result block
 */
export function isToolResultBlock(block: unknown): block is ToolResultContentBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    'type' in block &&
    (block as { type: string }).type === 'tool_result'
  );
}

// =============================================================================
// Core Extraction Functions
// =============================================================================

/**
 * Extract text from a ContentBlock array
 *
 * @param blocks - Array of content blocks
 * @param options - Extraction options
 * @returns Concatenated text from all text blocks
 */
export function extractTextFromBlocks(
  blocks: ContentBlock[],
  options: {
    includeThinking?: boolean;
    separator?: string;
    trim?: boolean;
  } = {}
): string {
  const { includeThinking = false, separator = '', trim = true } = options;

  const parts: string[] = [];

  for (const block of blocks) {
    if (isTextBlock(block)) {
      parts.push(block.text);
    } else if (includeThinking && isThinkingBlock(block)) {
      parts.push(block.thinking);
    }
  }

  const result = parts.join(separator);
  return trim ? result.trim() : result;
}

/**
 * Extract thinking text from a ContentBlock array
 *
 * @param blocks - Array of content blocks
 * @returns Concatenated thinking text
 */
export function extractThinkingFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .filter(isThinkingBlock)
    .map((b) => b.thinking)
    .join('');
}

/**
 * Extract tool uses from a ContentBlock array
 *
 * @param blocks - Array of content blocks
 * @returns Array of tool use blocks
 */
export function extractToolUses(blocks: ContentBlock[]): ToolUseContentBlock[] {
  return blocks.filter(isToolUseBlock);
}

/**
 * Universal text extraction from any message-like object
 *
 * Handles all known JSONL message format variations:
 * 1. message.content array with text blocks
 * 2. message.content as string
 * 3. content array with text blocks (direct on entry)
 * 4. content as string (direct on entry)
 * 5. text property (direct on entry)
 * 6. Plain string
 *
 * @param source - Message object or string
 * @returns Extracted text string
 */
export function extractText(source: unknown): string {
  // Handle null/undefined
  if (source == null) {
    return '';
  }

  // Handle plain string
  if (typeof source === 'string') {
    return source;
  }

  // Handle non-objects
  if (typeof source !== 'object') {
    return String(source);
  }

  const obj = source as Record<string, unknown>;

  // Format 1 & 2: message.content (nested)
  if (obj.message && typeof obj.message === 'object') {
    const message = obj.message as Record<string, unknown>;

    if (message.content) {
      if (Array.isArray(message.content)) {
        const text = extractTextFromBlocks(message.content as ContentBlock[]);
        if (text) return text;
      } else if (typeof message.content === 'string') {
        return message.content;
      }
    }

    if (typeof message.text === 'string') {
      return message.text;
    }
  }

  // Format 3 & 4: content directly on entry
  if (obj.content !== undefined) {
    if (Array.isArray(obj.content)) {
      const text = extractTextFromBlocks(obj.content as ContentBlock[]);
      if (text) return text;
    } else if (typeof obj.content === 'string') {
      return obj.content;
    }
  }

  // Format 5: text directly on entry
  if (typeof obj.text === 'string') {
    return obj.text;
  }

  // Handle thinking block style
  if (typeof obj.thinking === 'string') {
    return obj.thinking;
  }

  // Handle tool name for tool-use messages
  if (typeof obj.toolName === 'string') {
    return obj.toolName;
  }

  return '';
}

/**
 * Extract text for display purposes with message type awareness
 *
 * @param message - Conversation message with type
 * @returns Display-appropriate text
 */
export function extractDisplayText(
  message: TextExtractable & { type?: string }
): string {
  switch (message.type) {
    case 'thinking':
      return message.thinking || '';
    case 'tool-use':
      return message.toolName || '';
    default:
      return extractText(message);
  }
}

/**
 * Extract a preview of text (truncated to maxLength)
 *
 * @param source - Message object or string
 * @param maxLength - Maximum length (default 100)
 * @returns Truncated text with ellipsis if needed
 */
export function extractTextPreview(source: unknown, maxLength = 100): string {
  const text = extractText(source).trim();

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Check if a message-like object has any extractable text
 *
 * @param source - Object to check
 * @returns True if text can be extracted
 */
export function hasText(source: unknown): boolean {
  return extractText(source).length > 0;
}
