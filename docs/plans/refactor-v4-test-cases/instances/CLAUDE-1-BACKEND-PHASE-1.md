# CLAUDE-1: Backend Services - Phase 1 (HIGH Priority)

**Role:** Backend services, security fixes, process management
**Test Framework:** VS Code Native Testing (@vscode/test-cli, assert)
**Coordination:** Check `CLAUDE-HANDOFF.md` before starting and after completing tasks

---

## Codebase Alignment Status (Updated 2026-01-04)

| Item | Status | Notes |
|------|--------|-------|
| C1: Shell Wrapper Bypass | ❌ NOT DONE | PermissionsManager doesn't detect `bash -c`, `sh -c`, or chained commands |
| C2: SIGKILL Timeout | ✅ DONE | ProcessManager has 3-stage shutdown: stdin→SIGTERM→SIGKILL (lines 406-469) |
| C3: CLI Argument Injection | ⚠️ PARTIAL | `shell.ts` has `isValidShellPath()`, but not applied to config paths |
| C4: Path Traversal | ⚠️ PARTIAL | Uses `path.resolve()`, NOT `fs.realpath` for symlink resolution |
| H2: Memory-Efficient Pagination | ✅ DONE | ConversationManager uses streaming readline, PAGE_SIZE=100 |
| H3: Race Condition | ✅ DONE | ProcessManager uses `async-mutex` (v0.5.0 installed) |
| H4: WSL Path Centralization | ✅ DONE | `src/utils/paths.ts` has full WSL path conversion utilities |

---

## Phase 1 Scope (REVISED)

This phase covers **HIGH PRIORITY security items and critical features**:

### Security (CRITICAL)
- C1: Shell wrapper bypass prevention (not implemented)
- C3: Validate config paths using existing `shell.ts` utilities
- C4: Upgrade path traversal to use `fs.realpath` for symlink resolution
- Add missing tests for security functions

### Critical Features (HIGH)
- M1: Structured logging with timestamps and log levels
- Conversation Search Service for full-text search across sessions
- Think Mode Settings & Process Restart (toggle thinking mode)
- Concurrent Message Support (track multiple in-flight messages)
- MCP Terminal Process Restart (restart on MCP config changes)

**Items already complete:** C2, H2, H3, H4

---

## Your Files (You Own These)

```
src/services/
├── ProcessManager.ts       # ✅ Has graceful shutdown, mutex
├── ProcessRegistry.ts      # ✅ Has spawn/kill/killAll/cleanupOrphaned
├── PermissionsManager.ts   # ❌ Needs shell wrapper detection
├── ConversationManager.ts  # ⚠️ Has path.resolve(), needs fs.realpath
├── StreamBuffer.ts         # ✅ JSON parsing works, no overflow callback
└── index.ts                # ✅ Exports all services

src/utils/                  # ✅ EXISTS - Don't recreate!
├── paths.ts               # ✅ WSL conversion, cross-platform utilities
├── shell.ts               # ✅ Shell escaping, isValidShellPath()
├── process-control.ts     # ✅ Process tree killing utilities
└── [other utils...]

src/test/services/
├── StreamBuffer.test.ts        # ✅ Exists (18.9 KB)
├── PermissionsManager.test.ts  # ✅ Exists (21 KB) - extend with C1 tests
├── ConversationManager.test.ts # ✅ Exists (20.3 KB) - extend with C4 tests
├── ProcessManager.test.ts      # ❌ MISSING - needs creation
└── ProcessRegistry.test.ts     # ❌ MISSING - needs creation

src/test/mocks/
├── vscode.ts              # ✅ Exists (348 lines, comprehensive)
├── child_process.ts       # ❌ MISSING - needs creation for ProcessManager tests
└── fs.ts                  # ❌ MISSING - needs creation for ConversationManager tests
```

---

## CRITICAL: C1. Shell Wrapper Bypass in PermissionsManager

**Status:** ❌ NOT IMPLEMENTED
**File:** `src/services/PermissionsManager.ts:153`
**Risk:** Commands like `bash -c "rm -rf /"` or `ls && rm -rf /` bypass blocking

**Current behavior (lines 153-179):**
- Uses simple pattern matching against normalized command
- Checks BLOCKED_COMMAND_PATTERNS array
- Does NOT recurse into shell wrappers or chained commands

**Add before existing pattern matching in `isCommandBlocked()`:**
```typescript
function isCommandBlocked(command: string): { blocked: boolean; reason?: string } {
  const normalizedCommand = command.trim().toLowerCase().replace(/\s+/g, ' ');

  // CRITICAL: Detect shell wrapper patterns
  const shellWrapperRegex = /^(bash|sh|dash|zsh|fish)\s+(-c\s+)?['"]/i;
  if (shellWrapperRegex.test(normalizedCommand)) {
    const innerMatch = normalizedCommand.match(/^(?:bash|sh|dash|zsh|fish)\s+(?:-c\s+)?['"](.+)['"]/i);
    if (innerMatch) {
      const innerResult = isCommandBlocked(innerMatch[1]);
      if (innerResult.blocked) {
        return { blocked: true, reason: `Shell wrapper detected: ${innerResult.reason}` };
      }
    }
  }

  // Detect command chaining (;, &&, ||, |)
  if (/[;&|]/.test(normalizedCommand)) {
    const subCommands = normalizedCommand.split(/[;&|]+/).map(s => s.trim());
    for (const sub of subCommands) {
      if (sub.length > 0) {
        const subResult = isCommandBlocked(sub);
        if (subResult.blocked) {
          return { blocked: true, reason: `Chained command blocked: ${subResult.reason}` };
        }
      }
    }
  }

  // Detect $() and backtick command substitution
  if (/\$\(.*\)|`.*`/.test(normalizedCommand)) {
    const substitutionMatch = normalizedCommand.match(/\$\((.*?)\)|`(.*?)`/);
    if (substitutionMatch) {
      const innerCmd = substitutionMatch[1] || substitutionMatch[2];
      const innerResult = isCommandBlocked(innerCmd);
      if (innerResult.blocked) {
        return { blocked: true, reason: `Command substitution blocked: ${innerResult.reason}` };
      }
    }
  }

  // ... existing pattern matching continues
}
```

**Add to BLOCKED_COMMAND_PATTERNS (around line 48):**
```typescript
'bash -c *',
'sh -c *',
'eval *',
'* | bash',
'* | sh',
'echo * | base64 -d | *',
```

---

## C3. CLI Argument Injection via Settings (Partial Fix)

**Status:** ⚠️ PARTIAL - `shell.ts` has validation, but not applied to settings
**Existing Utility:** `src/utils/shell.ts:212-216`

```typescript
// Already exists in shell.ts
export function isValidShellPath(path: string): boolean {
  const regex = /[;&|`$(){}[\]<>!#*?~\n\r]/;
  return !regex.test(path);
}
```

**Action Required:** Apply `isValidShellPath()` to `nodePath` and `claudePath` in ProcessManager:

```typescript
// In ProcessManager.spawn() or spawnAsync()
import { isValidShellPath } from '../utils/shell';

async spawnAsync(config: ProcessConfig): Promise<ChildProcess | undefined> {
  // Validate paths before use
  if (config.nodePath && !isValidShellPath(config.nodePath)) {
    throw new Error('Invalid nodePath: contains shell metacharacters');
  }
  if (config.claudePath && !isValidShellPath(config.claudePath)) {
    throw new Error('Invalid claudePath: contains shell metacharacters');
  }
  // ... existing logic
}
```

---

## C4. Path Traversal - Upgrade to fs.realpath

**Status:** ⚠️ PARTIAL - Uses `path.resolve()` which doesn't follow symlinks
**File:** `src/services/ConversationManager.ts:319-340`

**Current implementation:**
```typescript
private _validateFilePath(filePath: string): { isValid: boolean; error?: string; validPath?: string } {
  const resolved = path.resolve(filePath);  // Doesn't resolve symlinks!
  // ...
}
```

**Upgrade to use `fs.realpath`:**
```typescript
private async _validateFilePath(filePath: string): Promise<{ isValid: boolean; error?: string; validPath?: string }> {
  let realPath: string;
  try {
    realPath = await fs.promises.realpath(filePath);  // Resolves symlinks
  } catch {
    return { isValid: false, error: `File not accessible: ${filePath}` };
  }

  let resolvedProjectsPath: string;
  try {
    resolvedProjectsPath = await fs.promises.realpath(this._cliProjectsPath!);
  } catch {
    return { isValid: false, error: 'Projects directory not accessible' };
  }

  if (!realPath.startsWith(resolvedProjectsPath + path.sep)) {
    return { isValid: false, error: 'Path traversal detected: file is outside projects directory' };
  }

  if (!realPath.endsWith('.jsonl')) {
    return { isValid: false, error: 'Invalid file type: only .jsonl files allowed' };
  }

  try {
    const stats = await fs.promises.stat(realPath);
    if (stats.size > 100 * 1024 * 1024) {
      return { isValid: false, error: 'File too large: maximum 100MB' };
    }
  } catch {
    return { isValid: false, error: 'Cannot read file stats' };
  }

  return { isValid: true, validPath: realPath };
}
```

---

## Unit Tests for Phase 1

### Extend PermissionsManager.test.ts with C1 tests

```typescript
// Add to existing src/test/services/PermissionsManager.test.ts
import * as assert from 'assert';

describe('PermissionsManager Shell Wrapper Prevention', () => {
  test('should block bash -c with dangerous command', () => {
    const result = pm.isCommandBlocked('bash -c "rm -rf /"');
    assert.strictEqual(result.blocked, true);
    assert.ok(result.reason?.includes('Shell wrapper'));
  });

  test('should block sh -c with dangerous command', () => {
    const result = pm.isCommandBlocked('sh -c "sudo su"');
    assert.strictEqual(result.blocked, true);
  });

  test('should block semicolon chained commands', () => {
    const result = pm.isCommandBlocked('npm install; rm -rf /');
    assert.strictEqual(result.blocked, true);
    assert.ok(result.reason?.includes('Chained command'));
  });

  test('should block && chained dangerous commands', () => {
    const result = pm.isCommandBlocked('ls && rm -rf /');
    assert.strictEqual(result.blocked, true);
  });

  test('should block pipe to shell', () => {
    const result = pm.isCommandBlocked('echo "malicious" | bash');
    assert.strictEqual(result.blocked, true);
  });

  test('should block $() command substitution', () => {
    const result = pm.isCommandBlocked('echo $(rm -rf /)');
    assert.strictEqual(result.blocked, true);
    assert.ok(result.reason?.includes('Command substitution'));
  });

  test('should block backtick command substitution', () => {
    const result = pm.isCommandBlocked('echo `rm -rf /`');
    assert.strictEqual(result.blocked, true);
  });

  test('should NOT block safe chained commands', () => {
    const result = pm.isCommandBlocked('npm install && npm test');
    assert.strictEqual(result.blocked, false);
  });
});
```

### Create ProcessManager.test.ts

```typescript
// src/test/services/ProcessManager.test.ts
import * as assert from 'assert';
// Will need child_process mock

describe('ProcessManager', () => {
  describe('Path Validation', () => {
    test('should reject nodePath with shell metacharacters', async () => {
      assert.rejects(async () => {
        await pm.spawnAsync({ nodePath: 'node; rm -rf /', cwd: '/test' });
      }, /Invalid nodePath/);
    });

    test('should reject claudePath with shell metacharacters', async () => {
      assert.rejects(async () => {
        await pm.spawnAsync({ claudePath: 'claude$(malicious)', cwd: '/test' });
      }, /Invalid claudePath/);
    });

    test('should accept valid paths', async () => {
      // Mock spawn to not actually execute
      await pm.spawnAsync({ nodePath: '/usr/bin/node', cwd: '/test' });
    });
  });
});
```

### Create child_process mock

```typescript
// src/test/mocks/child_process.ts
import { EventEmitter } from 'events';

export class MockChildProcess extends EventEmitter {
  pid = 12345;
  killed = false;
  stdin = {
    write: () => true,
    end: () => {}
  };
  stdout = new EventEmitter();
  stderr = new EventEmitter();

  kill(signal?: string): boolean {
    this.killed = true;
    this.emit('exit', 0, signal);
    return true;
  }
}

export function spawn(command: string, args?: string[], options?: object): MockChildProcess {
  return new MockChildProcess();
}

export function resetMock(): void {
  // Reset any recorded calls
}
```

---

## Build & Test Commands

```bash
# Run tests with VS Code test runner
npm test

# Compile TypeScript
npm run compile

# Run specific test file (if supported)
npm test -- --grep "PermissionsManager"
```

---

## Phase 1 Definition of Done

### Already Complete ✅
- [x] C2: SIGKILL timeout - 3-stage graceful shutdown implemented
- [x] H2: Memory-efficient pagination - streaming readline with PAGE_SIZE=100
- [x] H3: Mutex protection - async-mutex used in ProcessManager
- [x] H4: WSL path utilities - `src/utils/paths.ts` comprehensive

### Still Required ❌

**Security Items:**
- [ ] C1: Shell wrapper bypass prevention implemented in PermissionsManager
- [ ] C1: Command chaining detection (`;`, `&&`, `||`, `|`)
- [ ] C1: Command substitution detection (`$()`, backticks)
- [ ] C3: Apply `isValidShellPath()` to config paths in ProcessManager
- [ ] C4: Upgrade `_validateFilePath` to use `fs.realpath`
- [ ] Create child_process.ts mock for ProcessManager tests
- [ ] Extend PermissionsManager.test.ts with C1 security tests

**Critical Features:**
- [ ] M1: Create `src/utils/logger.ts` with structured logging
- [ ] M1: Replace `console.log` calls in all services
- [ ] Conversation Search Service created (`src/services/ConversationSearchService.ts`)
- [ ] Think Mode Settings handler in `extension.ts` (setThinkingDisabled message)
- [ ] Think Mode Settings write to `.claude/settings.local.json`
- [ ] Process restart method `_restartClaudeProcess()` in `extension.ts`
- [ ] Concurrent Message tracking with message IDs
- [ ] Concurrent Message acknowledgment messages (messageAck)
- [ ] MCP Terminal onMCPTerminalClosed callback handler

**Testing:**
- [ ] All security tests passing
- [ ] No TypeScript errors (`npm run compile`)

---

## COMPREHENSIVE MODULARIZATION (From Codebase Analysis)

### CRITICAL: Extract Services from extension.ts (3,061 lines)

extension.ts is a monolithic God class. Extract the following into separate services:

#### 1. Extract StreamProcessor Logic (450+ lines)
**Current:** `_processJsonStreamData()` method in extension.ts (lines 1552-1950+)
**Problem:** Massive switch/case handling all message types
**Solution:** Create `src/services/StreamDataProcessor.ts`

```typescript
// Extract to StreamDataProcessor.ts
export class StreamDataProcessor {
  constructor(
    private tokenTracker: TokenAndCostTracker,
    private conversationManager: ConversationManager
  ) {}

  processMessage(messageType: string, data: unknown, panelId: string): void {
    // Move all switch case logic here
  }
}
```

#### 2. Extract PermissionController (170 lines)
**Current:** `_handleControlRequest()`, `_sendPermissionResponse()`, `_handlePermissionResponse()` scattered in extension.ts
**Solution:** Create `src/services/PermissionController.ts`

```typescript
export class PermissionController {
  async handleRequest(request: CLIControlRequest, process, panelId): Promise<void>
  sendResponse(requestId: string, approved: boolean): void
  cancelPending(panelId: string): void
}
```

#### 3. Extract StateManager (100 lines)
**Current:** `_syncFromPanelState()`, `_syncToPanelState()`, 35+ private fields in extension.ts
**Problem:** Triple state storage (class fields + PanelState + services)
**Solution:** Create `src/services/StateManager.ts`

```typescript
export class StateManager {
  private _panels: Map<string, PanelState>

  syncFromPanel(panelId: string): void
  syncToPanel(panelId: string, state: Partial<PanelState>): void
  getPanel(panelId: string): PanelState | undefined
  updateConversation(panelId: string, messages: Message[]): void
}
```

#### 4. Extract TokenAndCostTracker (80 lines)
**Current:** `_totalCost`, `_totalTokensInput/Output`, scattered calculation logic
**Solution:** Create `src/services/TokenAndCostTracker.ts`

```typescript
export class TokenAndCostTracker {
  recordTokens(panelId: string, input: number, output: number, cache: number): void
  getContextPercentage(panelId: string): { percentage: number; level: string }
  resetAfterCompaction(panelId: string): void
}
```

---

### Split ConversationManager.ts (1,355 lines → ~700 lines)

#### 1. Extract Zod Schemas (CRITICAL - 400 lines)
**Current:** Lines 25-140 in ConversationManager.ts contain schema definitions
**Problem:** Duplicates CliSchemas.ts and bloats the file
**Solution:** Move ALL schemas to `src/services/CliSchemas.ts`

**Action Items:**
- [ ] Consolidate all Zod schemas into CliSchemas.ts
- [ ] Export inferred types: `type UserMessage = z.infer<typeof UserMessageSchema>`
- [ ] Update ConversationManager to import schemas instead of defining them
- [ ] Remove 400 lines of duplicate schema code

#### 2. Extract ConversationPaginator (110 lines)
**Current:** Pagination logic mixed with file I/O (lines 362-471)
**Solution:** Create `src/services/ConversationPaginator.ts`

```typescript
export class ConversationPaginator {
  async loadPage(filePath: string, offset: number, limit: number): Promise<ParsedMessages>
  async countTotalMessages(filePath: string): Promise<number>
}
```

#### 3. Extract WebviewMessageConverter (150 lines)
**Current:** JSONL → UI format conversion (lines 536-701)
**Solution:** Create `src/services/WebviewMessageConverter.ts`

```typescript
export class WebviewMessageConverter {
  toWebviewFormat(jsonlMessages: JSONLMessage[]): ConversationMessage[]
  fromWebviewFormat(webviewMessages: ConversationMessage[]): JSONLMessage[]
}
```

---

### Split PermissionsManager.ts (812 lines → ~450 lines)

#### 1. Extract BlockedCommandList (120 lines)
**Current:** Lines 48-108 contain hardcoded BLOCKED_COMMAND_PATTERNS
**Solution:** Create `src/services/BlockedCommandList.ts`

```typescript
export const BLOCKED_COMMAND_PATTERNS = [
  'rm -rf *',
  'sudo *',
  // ... all patterns
];

export class CommandValidator {
  isBlocked(command: string): { blocked: boolean; reason?: string }
  matchesPattern(command: string, pattern: string): boolean
}
```

#### 2. Extract PermissionAuditor (150 lines)
**Current:** Audit logging logic mixed with permission checks
**Solution:** Create `src/services/PermissionAuditor.ts`

```typescript
export class PermissionAuditor {
  async logDecision(entry: AuditEntry): Promise<void>
  async getAuditHistory(limit?: number): Promise<AuditEntry[]>
}
```

---

### CRITICAL: Consolidate JSONL Parsing

**Problem:** JSONL parsing implemented in 3+ places:
- `StreamBuffer.ts` (210 lines, brace-counting parser)
- `ConversationManager.ts` (readline + manual parsing)
- `StreamProcessor.ts` (stream buffer handling)

**Solution:** Unify all JSONL parsing to use StreamBuffer

**Action Items:**
- [ ] Update ConversationManager to use StreamBuffer for parsing
- [ ] Update StreamProcessor to delegate to StreamBuffer
- [ ] Remove duplicate parsing implementations
- [ ] Create unified `JSONLStreamParser` wrapper if needed

---

### Backend Adapter Consolidation

**Problem:** ClaudeBackend (558 lines) and OpenCodeBackend (432 lines) share lifecycle patterns

**Solution:** Create BaseBackend pattern

```typescript
// src/services/backends/BaseBackend.ts
export abstract class BaseBackend {
  abstract connect(): Promise<void>
  abstract spawn(config): Promise<void>
  abstract close(): Promise<void>

  protected handleStream(data): void {
    // Shared stream handling logic
  }
}

// ClaudeBackend extends BaseBackend (~350 lines instead of 558)
// OpenCodeBackend extends BaseBackend (~250 lines instead of 432)
```

---

### Remove Duplicate Code

#### 1. Remove Duplicate Path Functions (30 lines saved)
**Problem:** ProcessManager.ts (lines 45-78) reimplements path utilities
**Solution:** Import from `src/utils/paths.ts`

```typescript
// In ProcessManager.ts, replace local implementations:
import { isWSLPath, isUNCPath, convertToWSLPath } from '../utils/paths';
// Delete lines 45-78
```

#### 2. Remove Duplicate Message Text Extraction (100 lines saved)
**Problem:** 5 implementations across:
- `src/utils/message-utils.ts`
- `src/webview/lib/messageUtils.ts`
- `src/services/ConversationManager.ts:706`
- `src/types/shared.ts`
- Test helpers

**Solution:** Create single `MessageTextExtractor` utility

```typescript
// src/utils/message-text-extractor.ts
export function extractTextFromContent(content: ContentBlock[] | string): string {
  if (typeof content === 'string') return content;
  return content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');
}
```

---

### Service Folder Reorganization

**Current:** 34 files in flat `src/services/` directory

**Proposed Structure:**
```
src/services/
├── index.ts (barrel export)
├── core/
│   ├── ProcessManager.ts
│   ├── ProcessRegistry.ts
│   ├── ConversationManager.ts
│   └── index.ts
├── streaming/
│   ├── StreamBuffer.ts
│   ├── StreamProcessor.ts
│   ├── MessageRouter.ts
│   ├── MessageDebouncer.ts
│   └── index.ts
├── features/
│   ├── mcp/
│   │   ├── McpService.ts
│   │   └── index.ts
│   ├── permissions/
│   │   ├── PermissionsManager.ts
│   │   ├── CommandValidator.ts
│   │   ├── PermissionAuditor.ts
│   │   └── index.ts
│   ├── sessions/
│   │   ├── SessionManager.ts
│   │   └── index.ts
│   └── backup/
│       ├── BackupService.ts
│       └── index.ts
├── monitoring/
│   ├── LogService.ts
│   ├── MemoryMonitor.ts
│   ├── MetricsService.ts
│   └── index.ts
└── backends/
    ├── BaseBackend.ts
    ├── ClaudeBackend.ts
    ├── opencode/
    └── index.ts
```

**Action Items:**
- [ ] Create folder structure
- [ ] Move files to new locations
- [ ] Update all imports
- [ ] Update barrel exports

---

### Delete Dead Code

**Action Items:**
- [ ] Delete `src/_legacy/` directory (3 files, old HTML/CSS UI)
- [ ] Verify nothing imports from _legacy/ before deletion

---

## Phase 1 Priority Summary

**Quick Wins (Do First):**
1. Extract Zod schemas from ConversationManager → CliSchemas.ts (saves 400 LOC, 2-3 hours)
2. Delete src/_legacy/ (saves confusion, 5 minutes)
3. Remove duplicate path functions from ProcessManager (saves 30 LOC, 30 minutes)
4. Consolidate message text extraction (saves 100 LOC, 1 hour)

**High Impact (Do Next):**
5. Extract PermissionController from extension.ts (saves 170 LOC, 3-4 hours)
6. Extract StreamProcessor handlers from extension.ts (saves 450 LOC, 4-6 hours)
7. Split ConversationManager into 4 services (improves testability, 1 day)
8. Consolidate JSONL parsing to StreamBuffer (eliminates duplication, 2-3 hours)

**After completing Phase 1, proceed to CLAUDE-1-BACKEND-PHASE-2.md**
