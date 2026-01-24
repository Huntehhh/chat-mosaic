/**
 * StreamBuffer Test Suite
 *
 * Tests for the JSON stream parser that handles Claude CLI output.
 * This is CRITICAL for reliability - malformed parsing breaks the entire extension.
 */

import * as assert from 'assert';
import { StreamBuffer, LineBuffer, ParsedJSON } from '../../services/StreamBuffer';

suite('StreamBuffer Test Suite', () => {
  suite('StreamBuffer.parse()', () => {
    // =========================================================================
    // Happy Path - Single Objects
    // =========================================================================

    test('should parse single complete JSON object', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parse('{"type":"message","content":"hello"}');

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0].data, { type: 'message', content: 'hello' });
    });

    test('should preserve raw string in result', () => {
      const buffer = new StreamBuffer();
      const input = '{"key":"value"}';
      const result = buffer.parse(input);

      assert.strictEqual(result[0].raw, input);
    });

    test('should parse empty object', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parse('{}');

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0].data, {});
    });

    // =========================================================================
    // Happy Path - Multiple Objects
    // =========================================================================

    test('should parse multiple JSON objects in one chunk', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parse('{"a":1}{"b":2}{"c":3}');

      assert.strictEqual(result.length, 3);
      assert.deepStrictEqual(result[0].data, { a: 1 });
      assert.deepStrictEqual(result[1].data, { b: 2 });
      assert.deepStrictEqual(result[2].data, { c: 3 });
    });

    test('should parse objects separated by newlines', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parse('{"a":1}\n{"b":2}\n{"c":3}');

      assert.strictEqual(result.length, 3);
    });

    test('should parse objects with whitespace between them', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parse('{"a":1}   \n\n  {"b":2}');

      assert.strictEqual(result.length, 2);
    });

    // =========================================================================
    // Chunked Input - Split Across Multiple parse() Calls
    // =========================================================================

    test('should buffer incomplete JSON chunks', () => {
      const buffer = new StreamBuffer();

      // Incomplete JSON should return empty and buffer content
      const result1 = buffer.parse('{"type":"mes');
      assert.strictEqual(result1.length, 0, 'Incomplete JSON should not be parsed');

      // Buffer should have content now
      assert.ok(buffer.getBufferLength() > 0, 'Buffer should contain incomplete chunk');
    });

    test('should track buffer state during chunked parsing', () => {
      const buffer = new StreamBuffer();

      // Add first chunk
      buffer.parse('{"key":');
      assert.ok(buffer.getBufferLength() > 0, 'Buffer should have content');

      // Add more content
      buffer.parse('"value"');
      assert.ok(buffer.getBufferLength() > 0, 'Buffer should still have content');
    });

    test('should handle multiple objects in sequence', () => {
      const buffer = new StreamBuffer();

      // Parse first complete object
      const result1 = buffer.parse('{"a":1}');
      assert.strictEqual(result1.length, 1, 'First object should parse');

      // Parse second complete object
      const result2 = buffer.parse('{"b":2}');
      assert.strictEqual(result2.length, 1, 'Second object should parse');
    });

    // =========================================================================
    // Escaped Characters in Strings
    // =========================================================================

    test('should handle escaped quotes in strings', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parse('{"text":"He said \\"hello\\""}');

      assert.strictEqual(result.length, 1);
      assert.strictEqual((result[0].data as { text: string }).text, 'He said "hello"');
    });

    test('should handle escaped backslashes', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parse('{"path":"C:\\\\Users\\\\test"}');

      assert.strictEqual(result.length, 1);
      assert.strictEqual((result[0].data as { path: string }).path, 'C:\\Users\\test');
    });

    test('should handle escaped newlines in strings', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parse('{"text":"line1\\nline2"}');

      assert.strictEqual(result.length, 1);
      assert.strictEqual((result[0].data as { text: string }).text, 'line1\nline2');
    });

    test('should handle escaped tabs in strings', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parse('{"text":"col1\\tcol2"}');

      assert.strictEqual(result.length, 1);
      assert.strictEqual((result[0].data as { text: string }).text, 'col1\tcol2');
    });

    // =========================================================================
    // Braces Inside Strings (Must Not Confuse Parser)
    // =========================================================================

    test('should handle opening brace inside string', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parse('{"code":"function() {"}');

      assert.strictEqual(result.length, 1);
      assert.strictEqual((result[0].data as { code: string }).code, 'function() {');
    });

    test('should handle closing brace inside string', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parse('{"code":"return }"}');

      assert.strictEqual(result.length, 1);
    });

    test('should handle complex code with nested braces in string', () => {
      const buffer = new StreamBuffer();
      const code = 'function() { if (x) { return {}; } }';
      const result = buffer.parse(`{"code":"${code}"}`);

      assert.strictEqual(result.length, 1);
      assert.strictEqual((result[0].data as { code: string }).code, code);
    });

    test('should handle JSON-like content inside string', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parse('{"data":"{\\"nested\\":true}"}');

      assert.strictEqual(result.length, 1);
    });

    // =========================================================================
    // Nested Objects
    // =========================================================================

    test('should handle deeply nested objects', () => {
      const buffer = new StreamBuffer();
      const nested = { a: { b: { c: { d: { e: 'deep' } } } } };
      const result = buffer.parse(JSON.stringify(nested));

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0].data, nested);
    });

    test('should handle objects with arrays', () => {
      const buffer = new StreamBuffer();
      const obj = { items: [1, 2, { nested: true }, [3, 4]] };
      const result = buffer.parse(JSON.stringify(obj));

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0].data, obj);
    });

    // =========================================================================
    // OOM Protection
    // =========================================================================

    test('should handle large input without crashing', () => {
      const buffer = new StreamBuffer();

      // Create a large but valid JSON object
      const largeValue = 'a'.repeat(10000); // 10KB
      const largeJson = `{"data":"${largeValue}"}`;
      const result = buffer.parse(largeJson);

      // Should successfully parse the large object
      assert.strictEqual(result.length, 1);
      assert.ok(result[0].data, 'Should have parsed data');
    });

    test('should not crash on very large incomplete input', () => {
      const buffer = new StreamBuffer();

      // Try to parse a large incomplete chunk
      const largeChunk = '{' + 'a'.repeat(100000); // 100KB incomplete

      // Should not throw
      try {
        buffer.parse(largeChunk);
        assert.ok(true, 'Should not throw on large input');
      } catch {
        assert.fail('Should not throw on large input');
      }
    });

    // =========================================================================
    // Malformed JSON
    // =========================================================================

    test('should handle malformed JSON without crashing', () => {
      const buffer = new StreamBuffer();
      const originalWarn = console.warn;
      console.warn = () => {}; // Suppress warning

      // Malformed JSON should not crash
      const result = buffer.parse('{invalid json content');

      console.warn = originalWarn;

      // May or may not parse anything, but should not throw
      assert.ok(Array.isArray(result), 'Should return an array');
    });

    test('should parse valid JSON objects correctly', () => {
      const buffer = new StreamBuffer();

      // Valid JSON should parse correctly
      const result = buffer.parse('{"valid":true}');

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0].data, { valid: true });
    });

    test('should handle truncated string gracefully', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parse('{"unclosed":"string');

      assert.strictEqual(result.length, 0, 'Incomplete JSON should not be parsed');
      assert.ok(buffer.hasPartialObject(), 'Should have partial object');
    });

    // =========================================================================
    // State Inspection
    // =========================================================================

    test('hasPartialObject returns false for fresh buffer', () => {
      const buffer = new StreamBuffer();
      assert.strictEqual(buffer.hasPartialObject(), false);
    });

    test('getBufferLength returns 0 for fresh buffer', () => {
      const buffer = new StreamBuffer();
      assert.strictEqual(buffer.getBufferLength(), 0);
    });

    test('getBraceDepth returns 0 for fresh buffer', () => {
      const buffer = new StreamBuffer();
      assert.strictEqual(buffer.getBraceDepth(), 0);
    });

    test('complete object parsing leaves clean state', () => {
      const buffer = new StreamBuffer();

      // Parse a complete simple object
      const result = buffer.parse('{"simple":"object"}');
      assert.strictEqual(result.length, 1);

      // Buffer should be in clean state
      assert.strictEqual(buffer.getBraceDepth(), 0);
      assert.strictEqual(buffer.hasPartialObject(), false);
    });
  });

  // ===========================================================================
  // flush() Tests
  // ===========================================================================

  suite('StreamBuffer.flush()', () => {
    test('should return remaining buffer content', () => {
      const buffer = new StreamBuffer();
      buffer.parse('{"incomplete":');

      const remaining = buffer.flush();
      assert.strictEqual(remaining, '{"incomplete":');
    });

    test('should return undefined for empty buffer', () => {
      const buffer = new StreamBuffer();
      assert.strictEqual(buffer.flush(), undefined);
    });

    test('should reset state after flush', () => {
      const buffer = new StreamBuffer();
      buffer.parse('{"incomplete":');
      buffer.flush();

      assert.strictEqual(buffer.getBufferLength(), 0);
      assert.strictEqual(buffer.hasPartialObject(), false);
    });

    test('should return undefined for whitespace-only buffer', () => {
      const buffer = new StreamBuffer();
      buffer.parse('   \n\n  ');

      const remaining = buffer.flush();
      assert.strictEqual(remaining, undefined);
    });
  });

  // ===========================================================================
  // reset() Tests
  // ===========================================================================

  suite('StreamBuffer.reset()', () => {
    test('should clear all state', () => {
      const buffer = new StreamBuffer();
      buffer.parse('{"partial":true');

      buffer.reset();

      assert.strictEqual(buffer.getBufferLength(), 0);
      assert.strictEqual(buffer.getBraceDepth(), 0);
      assert.strictEqual(buffer.hasPartialObject(), false);
    });
  });

  // ===========================================================================
  // parseWithFallback() Tests
  // ===========================================================================

  suite('StreamBuffer.parseWithFallback()', () => {
    test('should parse JSON and return any remaining raw lines', () => {
      const buffer = new StreamBuffer();
      // Parse a JSON object, then check what's in raw lines
      const result = buffer.parseWithFallback('{"json":1}');

      assert.strictEqual(result.json.length, 1);
      // After parsing complete JSON, no raw lines expected
      assert.strictEqual(result.rawLines.length, 0);
    });

    test('should identify non-JSON lines as raw', () => {
      const buffer = new StreamBuffer();
      // Parse text that doesn't start with {
      const result = buffer.parseWithFallback('Plain text line\n');

      assert.strictEqual(result.json.length, 0);
      // The text should be captured as raw
      assert.ok(result.rawLines.length >= 1 || buffer.flush()?.includes('Plain'));
    });

    test('should handle JSON-only input', () => {
      const buffer = new StreamBuffer();
      const result = buffer.parseWithFallback('{"only":"json"}');

      assert.strictEqual(result.json.length, 1);
      assert.strictEqual(result.rawLines.length, 0);
    });

    test('should handle mixed JSON and text in separate calls', () => {
      const buffer = new StreamBuffer();

      // First call with JSON
      const result1 = buffer.parseWithFallback('{"a":1}');
      assert.strictEqual(result1.json.length, 1);

      // Second call with text
      buffer.parse('Not JSON');
      const remaining = buffer.flush();
      assert.ok(remaining?.includes('Not JSON'));
    });
  });

  // ===========================================================================
  // LineBuffer Tests (Simpler Alternative)
  // ===========================================================================

  suite('LineBuffer', () => {
    test('should parse newline-separated JSON', () => {
      const buffer = new LineBuffer();
      const result = buffer.parse('{"a":1}\n{"b":2}\n');

      assert.strictEqual(result.length, 2);
    });

    test('should keep incomplete line in buffer', () => {
      const buffer = new LineBuffer();

      const result1 = buffer.parse('{"compl');
      assert.strictEqual(result1.length, 0);

      const result2 = buffer.parse('ete":true}\n');
      assert.strictEqual(result2.length, 1);
    });

    test('should skip malformed lines', () => {
      const buffer = new LineBuffer();
      const originalWarn = console.warn;
      console.warn = () => {};

      const result = buffer.parse('{bad json}\n{"good":true}\n');

      console.warn = originalWarn;
      assert.strictEqual(result.length, 1);
    });

    test('should return remaining on flush', () => {
      const buffer = new LineBuffer();
      buffer.parse('{"incomplete":');

      assert.strictEqual(buffer.flush(), '{"incomplete":');
    });
  });

  // ===========================================================================
  // Real-World Claude CLI Message Types
  // ===========================================================================

  suite('Real-World Message Types', () => {
    test('should parse system init message', () => {
      const buffer = new StreamBuffer();
      const message = {
        type: 'system',
        subtype: 'init',
        sessionId: 'sess_abc123',
        cwd: '/project'
      };
      const result = buffer.parse(JSON.stringify(message));

      assert.strictEqual(result.length, 1);
      assert.strictEqual((result[0].data as typeof message).type, 'system');
    });

    test('should parse assistant message with content array', () => {
      const buffer = new StreamBuffer();
      const message = {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Hello!' },
            { type: 'tool_use', id: 'tool_1', name: 'Bash', input: { command: 'ls' } }
          ]
        }
      };
      const result = buffer.parse(JSON.stringify(message));

      assert.strictEqual(result.length, 1);
    });

    test('should parse tool result with error', () => {
      const buffer = new StreamBuffer();
      const message = {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool_1',
              content: 'Command failed',
              is_error: true
            }
          ]
        }
      };
      const result = buffer.parse(JSON.stringify(message));

      assert.strictEqual(result.length, 1);
    });

    test('should parse result message with cost', () => {
      const buffer = new StreamBuffer();
      const message = {
        type: 'result',
        is_error: false,
        session_id: 'sess_abc123',
        cost_usd: 0.05,
        duration_ms: 1500,
        usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };
      const result = buffer.parse(JSON.stringify(message));

      assert.strictEqual(result.length, 1);
      assert.strictEqual((result[0].data as typeof message).cost_usd, 0.05);
    });

    test('should parse control_request for permissions', () => {
      const buffer = new StreamBuffer();
      const message = {
        type: 'control_request',
        request: {
          type: 'tool_use',
          name: 'Bash',
          input: { command: 'npm install' }
        }
      };
      const result = buffer.parse(JSON.stringify(message));

      assert.strictEqual(result.length, 1);
    });
  });
});
