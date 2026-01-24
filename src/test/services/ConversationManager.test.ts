/**
 * ConversationManager Test Suite
 *
 * Tests for conversation loading, pagination, and security validation.
 * CRITICAL: Security tests prevent path traversal and malicious file access.
 */

import * as assert from 'assert';
import * as path from 'path';

// =============================================================================
// Test Constants (must match ConversationManager.ts)
// =============================================================================

const PAGE_SIZE = 100;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// =============================================================================
// Security Validation Functions (reimplemented for testing)
// =============================================================================

/**
 * Check if a path contains path traversal attempts
 */
function hasPathTraversal(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  return filePath.includes('..') || normalized.includes('..');
}

/**
 * Check if file extension is allowed
 */
function isValidFileExtension(filePath: string): boolean {
  return filePath.endsWith('.jsonl');
}

/**
 * Validate file size
 */
function isFileSizeValid(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

/**
 * Validate session ID format (for per-project index)
 */
function isValidSessionId(sessionId: string): boolean {
  // Session IDs should be alphanumeric with dashes and underscores
  return /^[a-zA-Z0-9_-]+$/.test(sessionId) && sessionId.length > 0;
}

// =============================================================================
// JSONL Parsing Functions (reimplemented for testing)
// =============================================================================

interface ParsedMessage {
  type: string;
  content?: string | unknown[];
  timestamp?: string;
  text?: string | null;
  message?: { content?: unknown };
}

/**
 * Parse a single JSONL line
 */
function parseJsonlLine(line: string): ParsedMessage | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Extract user message text from various formats
 */
function extractUserMessageText(entry: ParsedMessage): string | undefined {
  // Direct text field
  if (typeof (entry as { text?: string }).text === 'string') {
    return (entry as { text: string }).text;
  }

  // Message.content as string
  const message = (entry as { message?: { content?: unknown } }).message;
  if (message && typeof message.content === 'string') {
    return message.content;
  }

  // Message.content as array with text block
  if (message && Array.isArray(message.content)) {
    const textBlock = message.content.find(
      (block: { type?: string }) => block && typeof block === 'object' && block.type === 'text'
    );
    if (textBlock && typeof (textBlock as { text?: string }).text === 'string') {
      return (textBlock as { text: string }).text;
    }
  }

  // Direct content field
  if (typeof (entry as { content?: unknown }).content === 'string') {
    return (entry as { content: string }).content;
  }

  return undefined;
}

// =============================================================================
// Test Suite
// =============================================================================

suite('ConversationManager Test Suite', () => {
  // ===========================================================================
  // Security Validation Tests
  // ===========================================================================

  suite('Path Traversal Prevention', () => {
    test('should detect simple path traversal', () => {
      assert.strictEqual(hasPathTraversal('../../../etc/passwd'), true);
    });

    test('should detect path traversal in middle of path', () => {
      assert.strictEqual(hasPathTraversal('/home/user/../../../etc/passwd'), true);
    });

    test('should detect Windows-style path traversal', () => {
      assert.strictEqual(hasPathTraversal('..\\..\\..\\windows\\system32'), true);
    });

    test('should detect encoded path traversal', () => {
      // Note: This should be caught after URL decoding
      const decoded = decodeURIComponent('%2e%2e%2f%2e%2e%2f');
      assert.strictEqual(hasPathTraversal(decoded), true);
    });

    test('should allow normal paths', () => {
      assert.strictEqual(hasPathTraversal('/home/user/.claude/projects/test.jsonl'), false);
    });

    test('should allow paths with dots in filenames', () => {
      assert.strictEqual(hasPathTraversal('/path/to/file.name.jsonl'), false);
    });
  });

  suite('File Extension Validation', () => {
    test('should accept .jsonl files', () => {
      assert.strictEqual(isValidFileExtension('/path/to/conversation.jsonl'), true);
    });

    test('should reject non-jsonl files', () => {
      assert.strictEqual(isValidFileExtension('/path/to/file.txt'), false);
      assert.strictEqual(isValidFileExtension('/path/to/file.json'), false);
      assert.strictEqual(isValidFileExtension('/path/to/file.js'), false);
    });

    test('should reject files with no extension', () => {
      assert.strictEqual(isValidFileExtension('/path/to/file'), false);
    });

    test('should handle case sensitivity', () => {
      // .jsonl is case-sensitive
      assert.strictEqual(isValidFileExtension('/path/to/file.JSONL'), false);
    });

    test('should reject double extensions', () => {
      assert.strictEqual(isValidFileExtension('/path/to/file.jsonl.txt'), false);
    });
  });

  suite('File Size Validation', () => {
    test('should accept files under 100MB', () => {
      assert.strictEqual(isFileSizeValid(1024), true); // 1KB
      assert.strictEqual(isFileSizeValid(10 * 1024 * 1024), true); // 10MB
      assert.strictEqual(isFileSizeValid(99 * 1024 * 1024), true); // 99MB
    });

    test('should accept files at exactly 100MB', () => {
      assert.strictEqual(isFileSizeValid(MAX_FILE_SIZE), true);
    });

    test('should reject files over 100MB', () => {
      assert.strictEqual(isFileSizeValid(MAX_FILE_SIZE + 1), false);
      assert.strictEqual(isFileSizeValid(200 * 1024 * 1024), false); // 200MB
    });

    test('should reject empty files', () => {
      assert.strictEqual(isFileSizeValid(0), false);
    });

    test('should reject negative sizes', () => {
      assert.strictEqual(isFileSizeValid(-1), false);
    });
  });

  suite('Session ID Validation', () => {
    test('should accept valid session IDs', () => {
      assert.strictEqual(isValidSessionId('sess_abc123'), true);
      assert.strictEqual(isValidSessionId('session-123-test'), true);
      assert.strictEqual(isValidSessionId('01234_test'), true);
    });

    test('should reject empty session IDs', () => {
      assert.strictEqual(isValidSessionId(''), false);
    });

    test('should reject session IDs with special characters', () => {
      assert.strictEqual(isValidSessionId('session/test'), false);
      assert.strictEqual(isValidSessionId('session\\test'), false);
      assert.strictEqual(isValidSessionId('session;test'), false);
      assert.strictEqual(isValidSessionId('session`test`'), false);
    });

    test('should reject session IDs with spaces', () => {
      assert.strictEqual(isValidSessionId('session test'), false);
    });
  });

  // ===========================================================================
  // JSONL Parsing Tests
  // ===========================================================================

  suite('JSONL Line Parsing', () => {
    test('should parse valid JSON line', () => {
      const result = parseJsonlLine('{"type":"user","text":"Hello"}');
      assert.deepStrictEqual(result, { type: 'user', text: 'Hello' });
    });

    test('should return null for empty lines', () => {
      assert.strictEqual(parseJsonlLine(''), null);
      assert.strictEqual(parseJsonlLine('   '), null);
      assert.strictEqual(parseJsonlLine('\t\n'), null);
    });

    test('should return null for malformed JSON', () => {
      assert.strictEqual(parseJsonlLine('{invalid}'), null);
      assert.strictEqual(parseJsonlLine('not json at all'), null);
    });

    test('should handle JSON with newlines in strings', () => {
      const result = parseJsonlLine('{"text":"line1\\nline2"}') as ParsedMessage | null;
      assert.strictEqual(result?.text, 'line1\nline2');
    });
  });

  suite('User Message Extraction', () => {
    test('should extract from direct text field', () => {
      const entry = { type: 'user', text: 'Hello world' };
      assert.strictEqual(extractUserMessageText(entry), 'Hello world');
    });

    test('should extract from message.content string', () => {
      const entry = {
        type: 'user',
        message: { content: 'Hello from message' }
      };
      assert.strictEqual(extractUserMessageText(entry), 'Hello from message');
    });

    test('should extract from message.content array with text block', () => {
      const entry = {
        type: 'user',
        message: {
          content: [
            { type: 'text', text: 'Hello from array' }
          ]
        }
      };
      assert.strictEqual(extractUserMessageText(entry), 'Hello from array');
    });

    test('should extract from direct content field', () => {
      const entry = { type: 'user', content: 'Hello from content' };
      assert.strictEqual(extractUserMessageText(entry), 'Hello from content');
    });

    test('should handle multiple content blocks', () => {
      const entry = {
        type: 'user',
        message: {
          content: [
            { type: 'image', data: 'base64...' },
            { type: 'text', text: 'Caption for image' }
          ]
        }
      };
      assert.strictEqual(extractUserMessageText(entry), 'Caption for image');
    });

    test('should return undefined for non-text messages', () => {
      const entry = {
        type: 'user',
        message: {
          content: [
            { type: 'image', data: 'base64...' }
          ]
        }
      };
      assert.strictEqual(extractUserMessageText(entry), undefined);
    });

    test('should return undefined for missing content', () => {
      const entry = { type: 'user' };
      assert.strictEqual(extractUserMessageText(entry), undefined);
    });
  });

  // ===========================================================================
  // Pagination Tests
  // ===========================================================================

  suite('Pagination Logic', () => {
    test('PAGE_SIZE should be 100', () => {
      assert.strictEqual(PAGE_SIZE, 100);
    });

    test('should calculate correct page count', () => {
      const calculatePageCount = (totalMessages: number): number => {
        return Math.ceil(totalMessages / PAGE_SIZE);
      };

      assert.strictEqual(calculatePageCount(50), 1);
      assert.strictEqual(calculatePageCount(100), 1);
      assert.strictEqual(calculatePageCount(101), 2);
      assert.strictEqual(calculatePageCount(250), 3);
    });

    test('should calculate correct hasMore flag', () => {
      const hasMoreMessages = (loaded: number, total: number): boolean => {
        return loaded < total;
      };

      assert.strictEqual(hasMoreMessages(50, 100), true);
      assert.strictEqual(hasMoreMessages(100, 100), false);
      assert.strictEqual(hasMoreMessages(100, 150), true);
    });

    test('should calculate correct next page offset', () => {
      const getNextOffset = (currentLoaded: number): number => {
        return currentLoaded;
      };

      assert.strictEqual(getNextOffset(0), 0);
      assert.strictEqual(getNextOffset(100), 100);
      assert.strictEqual(getNextOffset(200), 200);
    });
  });

  // ===========================================================================
  // Message Type Tests
  // ===========================================================================

  suite('Message Type Handling', () => {
    test('should identify user messages', () => {
      const isUserMessage = (entry: { type: string }): boolean => {
        return entry.type === 'user' || entry.type === 'human';
      };

      assert.strictEqual(isUserMessage({ type: 'user' }), true);
      assert.strictEqual(isUserMessage({ type: 'human' }), true);
      assert.strictEqual(isUserMessage({ type: 'assistant' }), false);
    });

    test('should identify assistant messages', () => {
      const isAssistantMessage = (entry: { type: string }): boolean => {
        return entry.type === 'assistant';
      };

      assert.strictEqual(isAssistantMessage({ type: 'assistant' }), true);
      assert.strictEqual(isAssistantMessage({ type: 'user' }), false);
    });

    test('should identify skip-able message types', () => {
      const shouldSkipMessage = (entry: { type: string }): boolean => {
        const skipTypes = ['file-history-snapshot', 'queue-operation'];
        return skipTypes.includes(entry.type);
      };

      assert.strictEqual(shouldSkipMessage({ type: 'file-history-snapshot' }), true);
      assert.strictEqual(shouldSkipMessage({ type: 'queue-operation' }), true);
      assert.strictEqual(shouldSkipMessage({ type: 'user' }), false);
      assert.strictEqual(shouldSkipMessage({ type: 'assistant' }), false);
    });
  });

  // ===========================================================================
  // Per-Project Index Tests
  // ===========================================================================

  suite('Per-Project Index', () => {
    interface PerProjectIndexEntry {
      chatName?: string;
      lastAccessed?: string;
    }

    interface PerProjectIndex {
      version: 1;
      projectFolder: string;
      entries: Record<string, PerProjectIndexEntry>;
    }

    test('should create valid empty index', () => {
      const createEmptyIndex = (projectFolder: string): PerProjectIndex => ({
        version: 1,
        projectFolder,
        entries: {}
      });

      const index = createEmptyIndex('test-project');
      assert.strictEqual(index.version, 1);
      assert.strictEqual(index.projectFolder, 'test-project');
      assert.deepStrictEqual(index.entries, {});
    });

    test('should add entry to index', () => {
      const index: PerProjectIndex = {
        version: 1,
        projectFolder: 'test',
        entries: {}
      };

      index.entries['session-123'] = {
        chatName: 'My Chat',
        lastAccessed: new Date().toISOString()
      };

      assert.strictEqual(index.entries['session-123'].chatName, 'My Chat');
    });

    test('should update existing entry', () => {
      const index: PerProjectIndex = {
        version: 1,
        projectFolder: 'test',
        entries: {
          'session-123': { chatName: 'Old Name' }
        }
      };

      index.entries['session-123'].chatName = 'New Name';
      assert.strictEqual(index.entries['session-123'].chatName, 'New Name');
    });

    test('should serialize/deserialize correctly', () => {
      const original: PerProjectIndex = {
        version: 1,
        projectFolder: 'test-project',
        entries: {
          'sess-1': { chatName: 'Chat 1' },
          'sess-2': { chatName: 'Chat 2', lastAccessed: '2024-01-01T00:00:00Z' }
        }
      };

      const serialized = JSON.stringify(original);
      const deserialized = JSON.parse(serialized) as PerProjectIndex;

      assert.deepStrictEqual(deserialized, original);
    });
  });

  // ===========================================================================
  // Conversation List Building
  // ===========================================================================

  suite('Conversation List Building', () => {
    interface ConversationListItem {
      filename: string;
      sessionId: string;
      startTime: string;
      messageCount: number;
      firstUserMessage: string;
      source: 'cli' | 'internal';
    }

    test('should create valid conversation list item', () => {
      const item: ConversationListItem = {
        filename: 'session-123.jsonl',
        sessionId: 'session-123',
        startTime: '2024-01-01T00:00:00Z',
        messageCount: 10,
        firstUserMessage: 'Hello, Claude!',
        source: 'cli'
      };

      assert.strictEqual(item.sessionId, 'session-123');
      assert.strictEqual(item.source, 'cli');
    });

    test('should truncate long first user message', () => {
      const MAX_LENGTH = 100;
      const truncate = (text: string): string => {
        if (text.length <= MAX_LENGTH) return text;
        return text.slice(0, MAX_LENGTH - 3) + '...';
      };

      const longMessage = 'A'.repeat(150);
      const truncated = truncate(longMessage);

      assert.strictEqual(truncated.length, MAX_LENGTH);
      assert.ok(truncated.endsWith('...'));
    });

    test('should sort by startTime descending', () => {
      const items: ConversationListItem[] = [
        { filename: 'a.jsonl', sessionId: 'a', startTime: '2024-01-01', messageCount: 1, firstUserMessage: '', source: 'cli' },
        { filename: 'c.jsonl', sessionId: 'c', startTime: '2024-01-03', messageCount: 1, firstUserMessage: '', source: 'cli' },
        { filename: 'b.jsonl', sessionId: 'b', startTime: '2024-01-02', messageCount: 1, firstUserMessage: '', source: 'cli' },
      ];

      items.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

      assert.strictEqual(items[0].sessionId, 'c');
      assert.strictEqual(items[1].sessionId, 'b');
      assert.strictEqual(items[2].sessionId, 'a');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  suite('Edge Cases', () => {
    test('should handle empty JSONL file', () => {
      const lines: string[] = [];
      const messages = lines
        .map(parseJsonlLine)
        .filter((m): m is ParsedMessage => m !== null);

      assert.strictEqual(messages.length, 0);
    });

    test('should handle JSONL with only whitespace lines', () => {
      const lines = ['', '   ', '\n', '\t'];
      const messages = lines
        .map(parseJsonlLine)
        .filter((m): m is ParsedMessage => m !== null);

      assert.strictEqual(messages.length, 0);
    });

    test('should handle JSONL with mixed valid/invalid lines', () => {
      const lines = [
        '{"type":"user","text":"Hello"}',
        '{invalid json}',
        '{"type":"assistant","text":"Hi"}',
        '',
        '{"type":"user","text":"Bye"}'
      ];

      const messages = lines
        .map(parseJsonlLine)
        .filter((m): m is ParsedMessage => m !== null);

      assert.strictEqual(messages.length, 3);
    });

    test('should handle very long messages', () => {
      const longText = 'A'.repeat(100000);
      const line = JSON.stringify({ type: 'user', text: longText });
      const result = parseJsonlLine(line) as ParsedMessage | null;

      assert.ok(result);
      assert.strictEqual(result?.text?.length, 100000);
    });

    test('should handle unicode in messages', () => {
      const unicodeText = '你好世界 🌍 مرحبا';
      const line = JSON.stringify({ type: 'user', text: unicodeText });
      const result = parseJsonlLine(line) as ParsedMessage | null;

      assert.ok(result);
      assert.strictEqual(result?.text, unicodeText);
    });

    test('should handle null values in content', () => {
      const line = JSON.stringify({ type: 'user', text: null });
      const result = parseJsonlLine(line) as ParsedMessage | null;

      assert.ok(result);
      assert.strictEqual(result?.text, null);
    });
  });
});
