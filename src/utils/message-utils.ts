/**
 * Utility functions for extracting and processing message data
 * Handles the dual format: string OR {content, images} object
 */

/**
 * Extract text content from message data.
 * Handles both legacy string format and new object format with images.
 *
 * @param data - Message data (string | {content, images} | unknown)
 * @returns The extracted text content as a string
 */
export function extractMessageText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object' && 'content' in data) {
    return String((data as { content: unknown }).content);
  }
  return String(data || '');
}

/**
 * Extract text from a conversation message.
 * Convenience wrapper that handles the full message object.
 *
 * @param message - Message object with messageType and data properties
 * @returns The extracted text content
 */
export function getMessageContent(message: { data?: unknown }): string {
  return extractMessageText(message.data);
}
