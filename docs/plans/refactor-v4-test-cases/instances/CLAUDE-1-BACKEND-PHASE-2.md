# CLAUDE-1: Backend Services - Phase 2 (MEDIUM/LOW Priority)

**Role:** Backend services, new features, code quality
**Test Framework:** VS Code Native Testing (@vscode/test-cli, assert)
**Prerequisite:** Complete Phase 1 first

---

## Codebase Alignment Status (Updated 2026-01-04)

| Item | Status | Notes |
|------|--------|-------|
| M3: Model Constants | ❌ NOT DONE | No `SUPPORTED_MODELS` in constants.ts |
| M4: Buffer Overflow Callback | ❌ NOT DONE | StreamBuffer has MAX_BUFFER_SIZE but no callback |
| M5: Async Return Types | ⚠️ CHECK | Some functions may lack explicit return types |
| File Locking | ❌ NOT DONE | `proper-lockfile` not installed |
| Save Queue | ⚠️ CHECK | Uses boolean flag, may need queue approach |
| ExportService | ❌ NOT DONE | Service doesn't exist |
| Allowlist Mode | ❌ NOT DONE | Only blocklist mode in PermissionsManager |

**Moved to Phase 1:** M1 (Structured Logging), ConversationSearchService, Think Mode Settings, Concurrent Messages, MCP Terminal Restart

---

## Phase 2 Scope

This phase covers **MEDIUM and LOW priority** code quality items and secondary features:
- Buffer overflow notification (M4)
- Allowlist mode (enhanced security)
- File locking for concurrent writes
- Save queue fix
- Conversation Export service
- Hardcoded model strings fix (M3)
- Async return types audit (M5)

**Note:** The following were moved to Phase 1 due to HIGH priority:
- ~~Structured logging (M1)~~ → PHASE 1
- ~~Conversation Search service~~ → PHASE 1
- ~~Think Mode Settings & Process Restart~~ → PHASE 1
- ~~Concurrent Message Support~~ → PHASE 1
- ~~MCP Terminal Process Restart~~ → PHASE 1

---

## MEDIUM Priority Fixes

### M1. Structured Logging

**Status:** ❌ NOT DONE
**Create:** `src/utils/logger.ts`

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  component: string;
}

class Logger {
  private _component: string;
  private _minLevel: LogLevel = 'info';

  constructor(component: string) {
    this._component = component;
  }

  setMinLevel(level: LogLevel): void {
    this._minLevel = level;
  }

  private _shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this._minLevel);
  }

  private _log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this._shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      component: this._component
    };

    const formatted = `[${entry.timestamp}] [${level.toUpperCase()}] [${this._component}] ${message}`;

    switch (level) {
      case 'error': console.error(formatted, data ?? ''); break;
      case 'warn': console.warn(formatted, data ?? ''); break;
      default: console.log(formatted, data ?? '');
    }
  }

  debug(msg: string, data?: Record<string, unknown>): void { this._log('debug', msg, data); }
  info(msg: string, data?: Record<string, unknown>): void { this._log('info', msg, data); }
  warn(msg: string, data?: Record<string, unknown>): void { this._log('warn', msg, data); }
  error(msg: string, data?: Record<string, unknown>): void { this._log('error', msg, data); }
}

export const createLogger = (component: string): Logger => new Logger(component);

// Usage in services:
// const log = createLogger('ProcessManager');
// log.info('Process spawned', { pid: 1234, panelId: 'panel-1' });
```

**Then replace `console.log` calls in all services with structured logging.**

---

### M3. Hardcoded Model Strings

**Status:** ❌ NOT DONE
**Note:** Current `src/constants.ts` has timeout/limit constants but NO model constants

**Add to existing `src/constants.ts`:**

```typescript
export const SUPPORTED_MODELS = ['opus', 'sonnet', 'haiku', 'default'] as const;
export type SupportedModel = typeof SUPPORTED_MODELS[number];

export const MODEL_DISPLAY_NAMES: Record<SupportedModel, string> = {
  opus: 'Claude Opus',
  sonnet: 'Claude Sonnet',
  haiku: 'Claude Haiku',
  default: 'Default'
};

export const DEFAULT_MODEL: SupportedModel = 'sonnet';
```

**Update extension.ts and webview stores to use these constants instead of string literals.**

---

### M4. StreamBuffer Overflow Notification

**Status:** ❌ NOT DONE - Has MAX_BUFFER_SIZE but no callback
**File:** `src/services/StreamBuffer.ts`
**Current:** Lines 60-64 log warning and reset, but don't notify caller

**Add overflow callback:**

```typescript
private _onOverflow?: () => void;

setOnOverflow(callback: () => void): void {
  this._onOverflow = callback;
}

parse(chunk: string): ParsedJSON[] {
  if (this._buffer.length + chunk.length > StreamBuffer.MAX_BUFFER_SIZE) {
    console.warn(`[StreamBuffer] Buffer exceeded ${StreamBuffer.MAX_BUFFER_SIZE} bytes, resetting`);
    this.reset();
    this._onOverflow?.();
    return [];
  }
  // ... rest of parse logic
}
```

**Coordinate with CLAUDE-2 for UI notification.**

---

### M5. Incomplete Async Function Return Types

**Status:** ⚠️ AUDIT NEEDED

**Add explicit return types to all async functions:**

```typescript
// Before
private async _parseJSONLToWebviewMessages(filePath: string) { }

// After
private async _parseJSONLToWebviewMessages(filePath: string): Promise<void> { }
```

**Files to audit:**
- `src/services/ConversationManager.ts`
- `src/services/ProcessManager.ts`
- `src/services/PermissionsManager.ts`
- `src/services/ProcessRegistry.ts`

---

## New Features

### File Locking for Concurrent Writes

**Status:** ❌ NOT DONE - `proper-lockfile` not in package.json
**Problem:** Multi-window race conditions cause data loss in per-project index

**Install:**
```bash
npm install proper-lockfile
npm install -D @types/proper-lockfile
```

**Update ConversationManager:**
```typescript
import lockfile from 'proper-lockfile';

private async _savePerProjectIndex(): Promise<void> {
  const indexPath = this._getPerProjectIndexPath();

  let release: (() => Promise<void>) | undefined;
  try {
    // Acquire lock
    release = await lockfile.lock(indexPath, {
      retries: {
        retries: 5,
        minTimeout: 100,
        maxTimeout: 1000
      }
    });

    // Read current state (may have changed)
    const current = await this._readPerProjectIndex();

    // Merge updates
    const merged = this._mergeIndexUpdates(current, this._pendingUpdates);

    // Write atomically
    const tempPath = indexPath + '.tmp.' + randomUUID();
    await fs.promises.writeFile(tempPath, JSON.stringify(merged, null, 2));
    await fs.promises.rename(tempPath, indexPath);

    this._pendingUpdates.clear();
  } finally {
    if (release) await release();
  }
}
```

---

### Replace Boolean Save Flag with Queue

**File:** `src/services/ConversationManager.ts`
**Current (potential race):** Uses `_perProjectIndexSaveInProgress: boolean`

**Fix with queue approach:**
```typescript
private _pendingUpdates: Map<string, Partial<PerProjectIndexEntry>> = new Map();
private _saveDebounceTimer?: NodeJS.Timeout;

async updateChatName(sessionId: string, name: string): Promise<void> {
  this._pendingUpdates.set(sessionId, {
    ...this._pendingUpdates.get(sessionId),
    chatName: name
  });
  this._scheduleSave();
}

private _scheduleSave(): void {
  if (this._saveDebounceTimer) return;

  this._saveDebounceTimer = setTimeout(async () => {
    this._saveDebounceTimer = undefined;
    await this._savePerProjectIndex();
  }, 500); // Debounce 500ms
}
```

---

### UUID for Temp Files

**File:** `src/services/ConversationManager.ts`

```typescript
import { randomUUID } from 'crypto';

// Instead of:
// const tempPath = filePath + '.tmp.' + Date.now();

// Use:
const tempPath = filePath + '.tmp.' + randomUUID();
```

---

### Allowlist Mode (Security Enhancement)

**Status:** ❌ NOT DONE
**File:** `src/services/PermissionsManager.ts`

**Add setting:**
```typescript
// In VS Code settings schema (package.json)
"claudeCodeChat.permissions.mode": {
  "type": "string",
  "enum": ["blocklist", "allowlist"],
  "default": "blocklist",
  "description": "Permission mode: blocklist (block dangerous, allow rest) or allowlist (block all, allow only approved)"
}
```

**Update PermissionsManager:**
```typescript
private _mode: 'blocklist' | 'allowlist' = 'blocklist';

async isToolPreApproved(toolName: string, input: Record<string, unknown>): Promise<boolean> {
  // First check: always block dangerous commands regardless of mode
  if (toolName === 'Bash') {
    const blocked = this.isCommandBlocked(input.command as string);
    if (blocked.blocked) return false;
  }

  if (this._mode === 'allowlist') {
    // In allowlist mode, ONLY pre-approved patterns pass
    return this._matchesAllowlist(toolName, input);
  }

  // Blocklist mode: check pre-approved patterns
  return this._matchesPreApproved(toolName, input);
}

private _matchesAllowlist(toolName: string, input: Record<string, unknown>): boolean {
  const patterns = this._alwaysAllow.get(toolName) || [];
  if (patterns.length === 0) return false;

  return patterns.some(pattern => this._matchesPattern(JSON.stringify(input), pattern));
}
```

---

### Conversation Search Service

**Status:** ❌ NOT DONE
**Create:** `src/services/ConversationSearchService.ts`

```typescript
import * as readline from 'readline';
import * as fs from 'fs';

interface SearchableMessage {
  id: string;
  text: string;
  timestamp: number;
  type: 'user' | 'assistant';
  sessionId: string;
}

interface SearchResult {
  sessionId: string;
  messageId: string;
  snippet: string;
  timestamp: number;
  matchCount: number;
}

interface SearchOptions {
  caseSensitive?: boolean;
  limit?: number;
  sessionFilter?: string[];
}

export class ConversationSearchService {
  private _cliProjectsPath: string;

  constructor(cliProjectsPath: string) {
    this._cliProjectsPath = cliProjectsPath;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const regex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
    const limit = options.limit || 50;

    // Get all session files
    const sessionsDir = this._cliProjectsPath;
    const files = await fs.promises.readdir(sessionsDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    for (const file of jsonlFiles) {
      if (options.sessionFilter && !options.sessionFilter.includes(file)) continue;

      const filePath = `${sessionsDir}/${file}`;
      const sessionId = file.replace('.jsonl', '');

      const matches = await this._searchInFile(filePath, sessionId, regex);
      results.push(...matches);

      if (results.length >= limit) break;
    }

    return results
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  private async _searchInFile(
    filePath: string,
    sessionId: string,
    regex: RegExp
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });

    let lineNumber = 0;
    for await (const line of rl) {
      lineNumber++;
      try {
        const entry = JSON.parse(line);
        const text = this._extractText(entry);

        if (text && regex.test(text)) {
          const matches = text.match(regex) || [];
          results.push({
            sessionId,
            messageId: entry.uuid || `line-${lineNumber}`,
            snippet: this._extractSnippet(text, regex),
            timestamp: entry.timestamp || 0,
            matchCount: matches.length
          });
        }
      } catch {}
    }

    return results;
  }

  private _extractText(entry: unknown): string {
    if (typeof entry !== 'object' || entry === null) return '';
    const obj = entry as Record<string, unknown>;

    if (obj.type === 'user' && obj.message) {
      const msg = obj.message as Record<string, unknown>;
      if (typeof msg.content === 'string') return msg.content;
      if (Array.isArray(msg.content)) {
        return msg.content
          .filter((c: unknown) => typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'text')
          .map((c: unknown) => (c as Record<string, unknown>).text)
          .join(' ');
      }
    }

    if (obj.type === 'assistant' && obj.message) {
      const msg = obj.message as Record<string, unknown>;
      if (Array.isArray(msg.content)) {
        return msg.content
          .filter((c: unknown) => typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'text')
          .map((c: unknown) => (c as Record<string, unknown>).text)
          .join(' ');
      }
    }

    return '';
  }

  private _extractSnippet(text: string, regex: RegExp): string {
    const match = regex.exec(text);
    if (!match) return text.slice(0, 100);

    const start = Math.max(0, match.index - 50);
    const end = Math.min(text.length, match.index + match[0].length + 50);

    let snippet = text.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  }
}
```

**Export in services/index.ts.**

---

### Conversation Export Service

**Status:** ❌ NOT DONE
**Create:** `src/services/ExportService.ts`

```typescript
import * as fs from 'fs';

interface ConversationMessage {
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  toolName?: string;
  toolInput?: unknown;
}

export class ExportService {
  async exportAsMarkdown(messages: ConversationMessage[], title?: string): Promise<string> {
    let md = `# ${title || 'Claude Code Conversation'}\n\n`;
    md += `*Exported: ${new Date().toISOString()}*\n\n---\n\n`;

    for (const msg of messages) {
      if (msg.type === 'user') {
        md += `## User\n\n${msg.content}\n\n`;
      } else if (msg.type === 'assistant') {
        md += `## Claude\n\n${msg.content}\n\n`;
      } else if (msg.type === 'system') {
        md += `> **System:** ${msg.content}\n\n`;
      }
    }

    return md;
  }

  async exportAsJSON(messages: ConversationMessage[], pretty = true): Promise<string> {
    return JSON.stringify(messages, null, pretty ? 2 : 0);
  }

  async exportAsHTML(messages: ConversationMessage[], title?: string): Promise<string> {
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>${title || 'Claude Code Conversation'}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .user { background: #e3f2fd; padding: 12px; border-radius: 8px; margin: 8px 0; }
    .assistant { background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 8px 0; }
    .system { background: #fff3e0; padding: 8px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #263238; color: #aed581; padding: 12px; border-radius: 4px; overflow-x: auto; }
    code { background: #eceff1; padding: 2px 4px; border-radius: 2px; }
  </style>
</head>
<body>
  <h1>${title || 'Claude Code Conversation'}</h1>
`;

    for (const msg of messages) {
      const content = this._escapeHtml(msg.content)
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');

      html += `  <div class="${msg.type}">\n    <strong>${msg.type === 'user' ? 'You' : 'Claude'}:</strong>\n    <p>${content}</p>\n  </div>\n`;
    }

    html += `</body>\n</html>`;
    return html;
  }

  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async saveToFile(content: string, filePath: string): Promise<void> {
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }
}
```

**Export in services/index.ts.**

---

## Tests for Phase 2

### Logger Tests

```typescript
import * as assert from 'assert';
import { createLogger } from '../../utils/logger';

describe('Logger', () => {
  test('should format log messages with timestamp and component', () => {
    const log = createLogger('TestComponent');
    const spy = /* spy on console.log */;
    log.info('Test message');
    assert.ok(spy.calledWith(/* contains [TestComponent] */));
  });

  test('should respect minimum log level', () => {
    const log = createLogger('Test');
    log.setMinLevel('warn');
    const spy = /* spy on console.log */;
    log.info('Should not appear');
    assert.ok(!spy.called);
  });
});
```

### ConversationSearchService Tests

```typescript
describe('ConversationSearchService', () => {
  test('should find messages matching query', async () => {
    const service = new ConversationSearchService('/mock/path');
    // Mock file system
    const results = await service.search('function');
    assert.ok(results.length > 0);
  });

  test('should extract snippet around match', async () => {
    // Test snippet extraction
  });

  test('should respect case sensitivity option', async () => {
    // Test case sensitivity
  });
});
```

### ExportService Tests

```typescript
describe('ExportService', () => {
  test('should export to markdown', async () => {
    const service = new ExportService();
    const md = await service.exportAsMarkdown([
      { type: 'user', content: 'Hello' },
      { type: 'assistant', content: 'Hi there!' }
    ]);
    assert.ok(md.includes('## User'));
    assert.ok(md.includes('## Claude'));
  });

  test('should export to HTML with escaped content', async () => {
    const service = new ExportService();
    const html = await service.exportAsHTML([
      { type: 'user', content: '<script>alert("xss")</script>' }
    ]);
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>alert'));
  });
});
```

---

## Build & Test Commands

```bash
# Install new dependencies
npm install proper-lockfile
npm install -D @types/proper-lockfile

# Run tests
npm test

# Compile
npm run compile
```

---

## Phase 2 Definition of Done

- [ ] M1: Structured logging implemented across all services
- [ ] M3: Model constants extracted to constants.ts
- [ ] M4: Buffer overflow callback implemented in StreamBuffer
- [ ] M5: All async functions have explicit return types
- [ ] File locking implemented for per-project index
- [ ] Save queue replaces boolean flag
- [ ] UUID used for temp files
- [ ] Allowlist mode implemented
- [ ] ConversationSearchService created and tested
- [ ] ExportService created and tested
- [ ] All tests passing
- [ ] No TypeScript errors

**Coordinate with CLAUDE-2 for frontend integration of Search and Export.**

---

## NEW FEATURE: Think Mode Settings & Process Restart

**Priority:** HIGH
**Status:** ❌ NOT DONE
**Files to modify:**
- `src/extension.ts` (message handler, process restart)
- `src/services/SettingsManager.ts` (settings file write)

### Overview

When user toggles thinking mode enabled/disabled in the modal:
1. Check if `.claude/settings.local.json` exists in current project
2. Write `alwaysThinkingEnabled: true/false` to the file
3. Close the current Claude terminal process
4. Immediately reopen it so the setting takes effect

### 1. Handle setThinkingDisabled Message

**File:** `src/extension.ts`

```typescript
// Add to _messageRouter.register() section (around line 494-507)

this._messageRouter.register('setThinkingDisabled',
  async (msg: { disabled: boolean; intensity?: string; restartProcess: boolean }, panelId?: string) => {
    const targetPanelId = panelId || MAIN_PANEL_ID;

    try {
      // 1. Update .claude/settings.local.json in current workspace
      await this._updateProjectThinkingSettings(msg.disabled, msg.intensity);

      // 2. Restart Claude process if requested
      if (msg.restartProcess) {
        await this._restartClaudeProcess(targetPanelId);
      }

      // 3. Notify frontend of success
      this._postMessageToPanel(targetPanelId, {
        type: 'thinkingSettingsSaved',
        success: true,
        disabled: msg.disabled
      });
    } catch (error) {
      console.error('[setThinkingDisabled] Error:', error);
      this._postMessageToPanel(targetPanelId, {
        type: 'thinkingSettingsSaved',
        success: false,
        error: (error as Error).message
      });
    }
  }
);
```

### 2. Update Project Settings File

**File:** `src/extension.ts` (add new method)

```typescript
/**
 * Update .claude/settings.local.json with thinking mode settings
 */
private async _updateProjectThinkingSettings(
  disabled: boolean,
  intensity?: string
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder open');
  }

  const projectRoot = workspaceFolders[0].uri.fsPath;
  const settingsDir = path.join(projectRoot, '.claude');
  const settingsPath = path.join(settingsDir, 'settings.local.json');

  // Ensure .claude directory exists
  await fs.promises.mkdir(settingsDir, { recursive: true });

  // Read existing settings or create new object
  let settings: Record<string, unknown> = {};
  try {
    const existing = await fs.promises.readFile(settingsPath, 'utf-8');
    settings = JSON.parse(existing);
  } catch {
    // File doesn't exist or invalid JSON - start fresh
  }

  // Update thinking settings
  settings.alwaysThinkingEnabled = !disabled;

  // Optionally store intensity for reference (Claude CLI reads alwaysThinkingEnabled)
  if (intensity) {
    settings.thinkingIntensity = intensity;
  }

  // Write atomically
  const tempPath = settingsPath + '.tmp.' + Date.now();
  await fs.promises.writeFile(tempPath, JSON.stringify(settings, null, 2), 'utf-8');
  await fs.promises.rename(tempPath, settingsPath);

  console.log(`[ThinkingSettings] Updated ${settingsPath}: alwaysThinkingEnabled=${!disabled}`);
}
```

### 3. Restart Claude Process

**File:** `src/extension.ts` (add new method)

```typescript
/**
 * Close and reopen Claude process for a panel
 * Used when settings change that require process restart
 */
private async _restartClaudeProcess(panelId: string): Promise<void> {
  console.log(`[RestartProcess] Restarting Claude process for panel ${panelId}`);

  // 1. Kill existing process (gracefully)
  try {
    await this._processRegistry.kill(panelId);
  } catch (error) {
    console.warn(`[RestartProcess] Error killing process: ${error}`);
  }

  // 2. Brief delay to ensure cleanup
  await new Promise(resolve => setTimeout(resolve, 500));

  // 3. Get panel state for session restoration
  const panelState = this._panels.get(panelId);
  const sessionId = panelState?.sessionId || this._currentSessionId;

  // 4. Notify frontend that process is restarting
  this._postMessageToPanel(panelId, {
    type: 'processRestarting',
    panelId,
    reason: 'settings_changed'
  });

  // 5. Respawn the process with same session
  const config = this._buildProcessConfig(panelId);
  if (sessionId) {
    config.sessionId = sessionId;
  }

  try {
    await this._processRegistry.spawn(panelId, config);

    // 6. Notify frontend process is ready
    this._postMessageToPanel(panelId, {
      type: 'processRestarted',
      panelId,
      success: true
    });
  } catch (error) {
    console.error('[RestartProcess] Failed to respawn:', error);
    this._postMessageToPanel(panelId, {
      type: 'processRestarted',
      panelId,
      success: false,
      error: (error as Error).message
    });
  }
}
```

### 4. Add Message Types

**File:** `src/types/messages.ts`

```typescript
// Extension → Webview messages
interface ThinkingSettingsSavedMessage {
  type: 'thinkingSettingsSaved';
  success: boolean;
  disabled?: boolean;
  error?: string;
}

interface ProcessRestartingMessage {
  type: 'processRestarting';
  panelId: string;
  reason: 'settings_changed' | 'mcp_changed' | 'manual';
}

interface ProcessRestartedMessage {
  type: 'processRestarted';
  panelId: string;
  success: boolean;
  error?: string;
}
```

---

## NEW FEATURE: Concurrent Message Support (Backend)

**Priority:** HIGH
**Status:** ❌ NOT DONE
**Files to modify:**
- `src/extension.ts` (message handler)
- `src/services/ProcessRegistry.ts` (track message IDs)
- `src/services/StreamProcessor.ts` (return message IDs)

### Overview

Support concurrent message sending from frontend:
1. Accept `messageId` in sendMessage payload
2. Track active messages per panel
3. Return `messageId` in all response messages
4. Send `messageAck` for status updates

### 1. Update sendMessage Handler

**File:** `src/extension.ts`

```typescript
// Update existing sendMessage handler (around line 494-507)

this._messageRouter.register('sendMessage',
  async (msg: {
    text: string;
    planMode?: boolean;
    thinkingMode?: boolean;
    images?: ImageData[];
    messageId: string;  // NEW: Required for tracking
  }, panelId?: string) => {
    const targetPanelId = panelId || MAIN_PANEL_ID;
    const messageId = msg.messageId;

    // Send immediate acknowledgment
    this._postMessageToPanel(targetPanelId, {
      type: 'messageAck',
      messageId,
      status: 'received',
      panelId: targetPanelId
    });

    // Track this message
    this._trackActiveMessage(targetPanelId, messageId);

    try {
      // Send status update when processing starts
      this._postMessageToPanel(targetPanelId, {
        type: 'messageAck',
        messageId,
        status: 'processing',
        panelId: targetPanelId
      });

      // Existing send logic...
      await this._sendMessageToClaude(
        msg.text,
        msg.planMode,
        msg.thinkingMode,
        msg.images,
        targetPanelId,
        messageId  // Pass messageId through
      );

    } catch (error) {
      // Send error status
      this._postMessageToPanel(targetPanelId, {
        type: 'messageAck',
        messageId,
        status: 'error',
        panelId: targetPanelId,
        error: (error as Error).message
      });
      this._untrackActiveMessage(targetPanelId, messageId);
    }
  }
);
```

### 2. Track Active Messages

**File:** `src/extension.ts` (add tracking)

```typescript
// Add to class properties
private _activeMessages: Map<string, Set<string>> = new Map();  // panelId -> Set<messageId>

private _trackActiveMessage(panelId: string, messageId: string): void {
  if (!this._activeMessages.has(panelId)) {
    this._activeMessages.set(panelId, new Set());
  }
  this._activeMessages.get(panelId)!.add(messageId);
}

private _untrackActiveMessage(panelId: string, messageId: string): void {
  this._activeMessages.get(panelId)?.delete(messageId);
}

private _getActiveMessageCount(panelId: string): number {
  return this._activeMessages.get(panelId)?.size || 0;
}

private _clearActiveMessages(panelId: string): void {
  this._activeMessages.delete(panelId);
}
```

### 3. Update _sendMessageToClaude to Accept messageId

**File:** `src/extension.ts`

```typescript
private async _sendMessageToClaude(
  message: string,
  planMode?: boolean,
  thinkingMode?: boolean,
  images?: ImageData[],
  panelId?: string,
  messageId?: string  // NEW parameter
): Promise<void> {
  // ... existing logic

  // Include messageId in the JSON sent to Claude CLI stdin
  const userMessage = {
    type: 'user_message',
    session_id: sessionId,
    message: {
      role: 'user',
      content: messageContent
    },
    // NEW: Include message tracking ID
    _trackingId: messageId
  };

  this._processRegistry.write(panelId, JSON.stringify(userMessage) + '\n');
}
```

### 4. Update StreamProcessor to Return messageId

**File:** `src/services/StreamProcessor.ts`

When processing responses from Claude, include the tracking ID in messages sent to frontend:

```typescript
// In the message processing callback

interface ProcessedMessage {
  type: string;
  data: unknown;
  panelId: string;
  messageId?: string;  // NEW: Include for tracking
}

// When emitting messages to frontend
const responseMessage: ProcessedMessage = {
  type: 'assistantMessage',
  data: parsedContent,
  panelId,
  messageId: currentTrackingId  // Include tracking ID
};
```

### 5. Send Completion Acknowledgment

**File:** `src/extension.ts`

When Claude's response completes (end of stream):

```typescript
// In the onClose or completion handler

private _handleMessageComplete(panelId: string, messageId: string): void {
  // Send completion acknowledgment
  this._postMessageToPanel(panelId, {
    type: 'messageAck',
    messageId,
    status: 'completed',
    panelId
  });

  // Remove from active tracking
  this._untrackActiveMessage(panelId, messageId);

  // Only set isProcessing false when NO active messages remain
  if (this._getActiveMessageCount(panelId) === 0) {
    this._setProcessingState(panelId, false);
  }
}
```

### 6. Update Stop Handler for Concurrent Messages

**File:** `src/extension.ts`

```typescript
this._messageRouter.register('stopRequest',
  async (_msg: unknown, panelId?: string) => {
    const targetPanelId = panelId || MAIN_PANEL_ID;

    // Get all active messages for this panel
    const activeMessages = this._activeMessages.get(targetPanelId);
    if (activeMessages) {
      // Send error status for all active messages
      for (const messageId of activeMessages) {
        this._postMessageToPanel(targetPanelId, {
          type: 'messageAck',
          messageId,
          status: 'error',
          panelId: targetPanelId,
          error: 'Stopped by user'
        });
      }
    }

    // Clear all active messages
    this._clearActiveMessages(targetPanelId);

    // Existing stop logic...
    await this._stopClaudeProcess(targetPanelId);
  }
);
```

### Edge Cases & Testing

1. **Rapid fire messages**: Test sending 5+ messages quickly
2. **Stop during queue**: Verify all queued messages get error status
3. **Panel switching**: Messages should be isolated per panel
4. **Process crash**: All active messages should get error status
5. **Network issues**: Handle partial message delivery
6. **Message ordering**: Responses should match request order

### Coordinate with CLAUDE-2 (Frontend)

Frontend needs to:
1. Send `messageId` with every message
2. Track pending messages in store
3. Update UI based on `messageAck` messages
4. Handle `completed` and `error` statuses

---

## NEW FEATURE: MCP Terminal Process Restart

**Priority:** HIGH
**Status:** ❌ NOT DONE
**Coordinate with:** CLAUDE-3 for terminal routing

### Overview

When user closes the visible MCP terminal, restart the background Claude process to apply MCP changes.

### Handle MCP Terminal Close Callback

**File:** `src/extension.ts`

```typescript
// In TerminalManager callbacks setup (constructor or initialization)

this._terminalManager = new TerminalManager({
  // ... existing callbacks

  onMCPTerminalClosed: async (panelId?: string, sessionId?: string) => {
    console.log(`[MCP Terminal] Closed, restarting process for panel ${panelId || 'main'}`);

    const targetPanelId = panelId || MAIN_PANEL_ID;

    // Restart the Claude process to pick up MCP changes
    await this._restartClaudeProcess(targetPanelId);

    // Notify user
    vscode.window.showInformationMessage(
      'MCP settings applied. Claude process restarted.',
      'OK'
    );
  }
});
```

### Tests

```typescript
describe('MCP Terminal Integration', () => {
  test('should restart process when MCP terminal closes', async () => {
    // 1. Spawn MCP terminal
    // 2. Simulate terminal close
    // 3. Verify process was killed and respawned
    // 4. Verify session was preserved
  });

  test('should pass correct panelId through callback', () => {
    // Verify panelId isolation
  });
});
```

---

## Dead Code Cleanup (From Phase 1 Analysis)

### Delete Unused Files

**Status:** ❌ NOT DONE
**Priority:** LOW

```
src/utils/message-utils.ts (31 lines)
- Exports: extractMessageText, getMessageContent
- Status: Exported in utils/index.ts but NEVER imported anywhere
- Action: DELETE file, remove from utils/index.ts exports
- Reason: Superseded by message-text-extractor.ts (created by Claude-3)
```

### Remove Deprecated Function Exports (After Migration)

**Status:** ⚠️ DEPRECATED - Wait for callers to migrate
**Files:**
- `src/types/shared.ts` - extractTextFromContent(), extractToolUses()

These were marked `@deprecated` in Phase 1. After verifying no callers remain:
```bash
# Check for remaining callers
grep -r "extractTextFromContent\|extractToolUses" src/ --include="*.ts" | grep -v "shared.ts"
```

If no callers found, remove the deprecated functions.

---

## Console.log Migration Scope (For M1 Structured Logging)

**Phase 1 Discovery:** 203 console.log calls in src/services/

When implementing M1 (Structured Logging), prioritize these services:
1. `ProcessManager.ts` - 20+ calls (process lifecycle)
2. `ConversationManager.ts` - 15+ calls (file I/O)
3. `PermissionsManager.ts` - 15+ calls (security decisions)
4. `StreamBuffer.ts` - 5+ calls (parsing errors)
5. `ProcessRegistry.ts` - 10+ calls (process tracking)

**Migration pattern:**
```typescript
// Before
console.log('[ProcessManager] Process spawned:', pid);

// After
import { createLogger } from '../utils/logger';
const log = createLogger('ProcessManager');
log.info('Process spawned', { pid });
```

---

## Updated Phase 2 Definition of Done

### Code Quality Features
- [ ] M1: Structured logging (createLogger) - migrate 203 console.log calls
- [ ] M3: Model constants extracted to constants.ts
- [ ] M4: Buffer overflow callback implemented in StreamBuffer
- [ ] M5: All async functions have explicit return types
- [ ] File locking for per-project index (proper-lockfile)
- [ ] Save queue replaces boolean flag
- [ ] UUID for temp files
- [ ] Allowlist mode implemented

### Dead Code Cleanup
- [ ] Delete src/utils/message-utils.ts (superseded)
- [ ] Remove deprecated functions from types/shared.ts (after migration)

### New Features
- [ ] ExportService created and tested (Markdown, JSON, HTML)

### Testing
- [ ] Logger tests (log levels, formatting)
- [ ] ExportService tests (format outputs, HTML escaping)
- [ ] All tests passing
- [ ] No TypeScript errors

**Note:** See Phase 1 for Think Mode Settings, Concurrent Messages, and MCP Terminal Restart
