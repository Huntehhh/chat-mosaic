# CLAUDE-3: Architecture & Integration - Phase 2 (MEDIUM/LOW Priority)

**Role:** Additional integrations, advanced features, service enhancements
**Test Framework:** VS Code Native Testing (@vscode/test-cli, assert)
**Prerequisite:** Complete Phase 1 first

---

## Codebase Alignment Status (Updated 2026-01-04)

| Item | Status | Notes |
|------|--------|-------|
| McpFacade | ⚠️ RECONSIDER | McpService exists - may not need facade layer |
| GitFacade | ⚠️ RECONSIDER | GitService exists - enhance rather than wrap |
| Backend Adapters | ✅ DONE | `src/services/backends/` has adapter pattern |
| Type Definitions | ⚠️ PARTIAL | Some in process.ts, session.ts, shared.ts |

**Moved to Phase 1:** Verify TerminalManager, Async Cleanup in Dispose, Architectural Recommendations

---

## Revised Strategy: Enhance Services, Not Wrap Them

**Key insight from codebase exploration:**

The codebase already uses a **service composition** pattern with:
- `src/services/McpService.ts` (7,175 bytes)
- `src/services/GitService.ts` (exists)
- `src/services/TerminalManager.ts` (13,931 bytes)

Creating facades on top of these would add unnecessary indirection. Instead:
1. **Enhance existing services** with event emission
2. **Add missing functionality** directly to services
3. **Use EventBus opt-in** for loose coupling where beneficial

---

## Phase 2 Scope (REVISED)

Focus on **enhancing existing services**:
1. Add event emission to McpService
2. Enhance GitService with backup functionality
3. Add integration tests for enhanced services

**Note:** The following were moved to Phase 1 due to higher priority:
- ~~Verify TerminalManager completeness~~ → PHASE 1
- ~~Ensure proper async cleanup on dispose~~ → PHASE 1
- ~~Architectural recommendations~~ → PHASE 1

---

## Your Files (You Own These - REVISED)

```
# Services to ENHANCE (don't wrap)
src/services/McpService.ts       # Add event emission
src/services/GitService.ts       # Add backup methods if missing

# NEW Files to Create
src/utils/EventBus.ts            # If not created in Phase 1
src/utils/debounce.ts            # If not created in Phase 1

src/test/integration/
├── mcp-service.test.ts          # NEW
├── git-service.test.ts          # NEW
└── terminal-manager.test.ts     # NEW

# Extension Cleanup
src/extension.ts                 # Verify dispose awaits kills
```

---

## Enhance McpService with Events

**Current:** `src/services/McpService.ts` (7,175 bytes)
**Enhancement:** Add event emission for status changes

```typescript
// Add to existing McpService class
import { eventBus, EVENTS } from '../utils/EventBus';

export const MCP_EVENTS = {
  SERVER_ADDED: 'mcp:serverAdded',
  SERVER_REMOVED: 'mcp:serverRemoved',
  SERVER_STATUS_CHANGED: 'mcp:serverStatusChanged',
  SERVERS_LOADED: 'mcp:serversLoaded',
} as const;

// Add to existing methods:

async addServer(config: McpServerConfig): Promise<void> {
  // ... existing logic
  eventBus.emit(MCP_EVENTS.SERVER_ADDED, { server: config });
}

async removeServer(name: string): Promise<void> {
  // ... existing logic
  eventBus.emit(MCP_EVENTS.SERVER_REMOVED, { name });
}

async restartServer(name: string): Promise<void> {
  eventBus.emit(MCP_EVENTS.SERVER_STATUS_CHANGED, { name, status: 'restarting' });
  // ... existing logic
  eventBus.emit(MCP_EVENTS.SERVER_STATUS_CHANGED, { name, status: 'running' });
}
```

---

## Enhance GitService with Backup Methods

**Current:** `src/services/GitService.ts` (exists)
**Enhancement:** Add backup/restore if missing

```typescript
// Add to existing GitService class

interface BackupInfo {
  commitHash: string;
  timestamp: Date;
  message: string;
  filesChanged: number;
}

async createBackup(message?: string): Promise<BackupInfo | null> {
  if (!this._enabled) return null;

  const timestamp = new Date();
  const backupMessage = message || `Claude Code backup - ${timestamp.toISOString()}`;

  try {
    // Use VS Code git extension or child_process git
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    const git = gitExtension?.exports?.getAPI(1);

    if (!git) return null;

    const repo = git.repositories.find(
      (r: { rootUri: vscode.Uri }) => r.rootUri.fsPath === this._workspaceRoot
    );

    if (!repo) return null;

    // Stage, get status, commit
    await repo.add(['.']);
    const filesChanged = repo.state.indexChanges?.length || 0;

    if (filesChanged === 0) return null;

    await repo.commit(backupMessage);

    const backup: BackupInfo = {
      commitHash: repo.state.HEAD?.commit || 'unknown',
      timestamp,
      message: backupMessage,
      filesChanged
    };

    eventBus.emit('git:backupCreated', { backup });
    return backup;
  } catch (error) {
    console.error('[GitService] Backup failed:', error);
    return null;
  }
}

async restoreBackup(commitHash: string): Promise<boolean> {
  // Implementation...
}

async getBackupHistory(limit = 20): Promise<BackupInfo[]> {
  // Implementation...
}
```

---

## Verify TerminalManager Completeness

**Current:** `src/services/TerminalManager.ts` (13,931 bytes)

**Verify these methods exist:**
- `openTerminal(options?: { cwd?: string; name?: string })`
- `executeInTerminal(command: string, options?)`
- `closeTerminal(id: string)`
- `closeAll()`

**Add if missing:**
```typescript
executeInTerminal(command: string, options?: { cwd?: string; newTerminal?: boolean }): void {
  let terminal: vscode.Terminal;

  if (options?.newTerminal) {
    terminal = this.openTerminal({ cwd: options.cwd });
  } else {
    terminal = this._getOrCreateTerminal();
  }

  if (options?.cwd) {
    terminal.sendText(`cd "${options.cwd}"`);
  }

  terminal.sendText(command);
  terminal.show();

  eventBus.emit('terminal:commandExecuted', { command, cwd: options?.cwd });
}
```

---

## Ensure Async Cleanup in extension.ts Dispose

**Check and fix if needed:**

```typescript
// In ClaudeChatProvider.dispose()

async dispose(): Promise<void> {
  // IMPORTANT: Await process kills with timeout
  try {
    await Promise.race([
      this._processRegistry.killAll(),
      new Promise(resolve => setTimeout(resolve, 5000)) // 5s timeout
    ]);
  } catch (error) {
    console.error('[ClaudeChatProvider] Error during dispose:', error);
  }

  // Cleanup other resources
  for (const panel of this._panels.values()) {
    panel.webview?.dispose();
  }
  this._panels.clear();

  // Clear event subscriptions
  if (typeof eventBus !== 'undefined') {
    eventBus.clear();
  }

  // Dispose terminal manager
  this._terminalManager?.closeAll();
}
```

**Also check panel disposal:**
```typescript
private async _disposePanel(panelId: string): Promise<void> {
  // Kill process and AWAIT it
  try {
    await this._processRegistry.kill(panelId);
  } catch (error) {
    console.error(`[ClaudeChatProvider] Error killing process for ${panelId}:`, error);
  }

  // Then cleanup panel state
  this._panels.delete(panelId);
}
```

---

## Integration Tests

### McpService Tests

```typescript
// src/test/integration/mcp-service.test.ts
import * as assert from 'assert';
import { McpService, MCP_EVENTS } from '../../services/McpService';
import { eventBus } from '../../utils/EventBus';

describe('McpService Integration', () => {
  let service: McpService;
  const events: unknown[] = [];

  beforeEach(() => {
    service = new McpService(mockContext);
    events.length = 0;
    eventBus.on(MCP_EVENTS.SERVER_ADDED, (data) => events.push(data));
  });

  afterEach(() => {
    eventBus.clear();
  });

  test('should emit event when adding server', async () => {
    await service.addServer({
      name: 'test-server',
      command: 'node',
      args: ['server.js']
    });

    assert.strictEqual(events.length, 1);
  });
});
```

### GitService Tests

```typescript
// src/test/integration/git-service.test.ts
import * as assert from 'assert';
import { GitService } from '../../services/GitService';

describe('GitService Integration', () => {
  test('should not backup when disabled', async () => {
    const service = new GitService('/test');
    service.setEnabled(false);

    const backup = await service.createBackup();

    assert.strictEqual(backup, null);
  });

  // More tests with mocked vscode.git extension...
});
```

### TerminalManager Tests

```typescript
// src/test/integration/terminal-manager.test.ts
import * as assert from 'assert';
import { TerminalManager } from '../../services/TerminalManager';

describe('TerminalManager Integration', () => {
  test('should track opened terminals', () => {
    const manager = new TerminalManager();
    // Mock vscode.window.createTerminal

    const info = manager.openTerminal({ name: 'Test' });

    assert.ok(info.id);
    assert.strictEqual(manager.getActiveTerminalCount(), 1);
  });

  test('should cleanup on closeAll', () => {
    const manager = new TerminalManager();
    manager.openTerminal({ name: 'Term1' });
    manager.openTerminal({ name: 'Term2' });

    manager.closeAll();

    assert.strictEqual(manager.getActiveTerminalCount(), 0);
  });
});
```

---

## Build & Test Commands

```bash
# Run integration tests
npm test -- --grep "Integration"

# Run all tests
npm test

# Compile
npm run compile
```

---

## Phase 2 Definition of Done

### Already Done ✅
- [x] McpService exists (enhance, don't wrap)
- [x] GitService exists (enhance, don't wrap)
- [x] Backend adapter pattern exists

### Still Required ❌
- [ ] Add event emission to McpService
- [ ] Add backup/restore methods to GitService (if missing)
- [ ] Integration tests for McpService and GitService
- [ ] No TypeScript errors (`npm run compile`)

### NOT Doing
- Creating facade wrappers (services are sufficient)
- Full extension.ts refactor (incremental improvements instead)

**Note:** See Phase 1 for TerminalManager verification, async cleanup in dispose, and architectural recommendations.

**Coordinate with CLAUDE-2 for MCP Manager UI integration via message passing.**
**Coordinate with CLAUDE-2 for Terminal output component integration.**

---

## NEW FEATURE: /MCP Command → Visible Terminal with Process Restart

**Priority:** HIGH
**Status:** ❌ NOT DONE
**Files to modify:**
- `src/extension.ts` (route /mcp to openMCPTerminal)
- `src/services/TerminalManager.ts` (verify openMCPTerminal implementation)
- `src/webview/hooks/handlers/useChatHandlers.ts` (if /mcp comes from chat)

### Overview

When user types `/mcp` command:
1. Spawn a **visible** terminal (not headless) using the existing `openMCPTerminal()` method
2. User interacts with MCP settings in the visible terminal
3. Listen for terminal close event
4. When terminal closes, restart the background Claude process to apply MCP changes
5. Ensure proper `panelId` tracking to avoid crosstalk between panels

### Current State (from exploration)

**TerminalManager already has:**
- `openMCPTerminal(sessionId, panelId)` method (lines 278-325)
- `_setupMCPTerminalCloseDetection()` with dual detection (lines 330-371)
- `onMCPTerminalClosed` callback in interface

**Issue found:**
- `_executeSlashCommand()` in extension.ts routes `/mcp` to generic `executeSlashCommand()` instead of `openMCPTerminal()`

### 1. Route /mcp to openMCPTerminal

**File:** `src/extension.ts`

```typescript
// Update _executeSlashCommand method (around line 2873)

private _executeSlashCommand(command: string, panelId?: string): void {
  const targetPanelId = panelId || MAIN_PANEL_ID;
  const sessionId = this._getSessionIdForPanel(targetPanelId);

  // Handle /compact specially (in-chat, not terminal)
  if (command === 'compact') {
    this._sendMessageToClaude(`/${command}`, false, false, undefined, targetPanelId);
    return;
  }

  // Handle /mcp specially - use visible terminal with close detection
  if (command === 'mcp') {
    const result = this._terminalManager.openMCPTerminal(sessionId, targetPanelId);
    if (result) {
      result.terminal.show(true);  // true = preserve focus
      vscode.window.showInformationMessage(
        'MCP Manager opened. Close the terminal to apply changes.',
        'OK'
      );
    } else {
      vscode.window.showErrorMessage('Failed to open MCP terminal. No active session.');
    }
    return;
  }

  // All other slash commands use generic handler
  const result = this._terminalManager.executeSlashCommand(command, sessionId);
  if (result) {
    result.terminal.show();
    vscode.window.showInformationMessage(result.message, 'OK');
  }
}
```

### 2. Verify TerminalManager Callback Setup

**File:** `src/extension.ts` (constructor or initialization)

```typescript
// Ensure TerminalManager receives the callback

this._terminalManager = new TerminalManager({
  getClaudeCommand: () => this._getClaudeCommand(),
  getWorkingDirectory: () => this._getWorkingDirectory(),
  getEnvironment: () => this._getEnvironment(),

  // MCP terminal close handler - triggers process restart
  onMCPTerminalClosed: async (panelId?: string, sessionId?: string) => {
    console.log(`[Extension] MCP terminal closed for panel ${panelId}, session ${sessionId}`);

    const targetPanelId = panelId || MAIN_PANEL_ID;

    // Restart Claude process to apply MCP changes
    await this._restartClaudeProcess(targetPanelId);

    // Notify user
    vscode.window.showInformationMessage('MCP settings applied.', 'OK');
  }
});
```

### 3. Verify openMCPTerminal Passes panelId

**File:** `src/services/TerminalManager.ts`

The existing implementation should already pass panelId, but verify:

```typescript
openMCPTerminal(sessionId: string, panelId?: string): TerminalResult | null {
  if (!sessionId) {
    console.warn('[TerminalManager] No session ID for MCP terminal');
    return null;
  }

  const command = this._buildCommand('mcp', sessionId);
  const terminal = this._createTerminal('Claude MCP Manager');

  terminal.sendText(command);
  terminal.show(true);

  // CRITICAL: Pass panelId to close detection
  this._setupMCPTerminalCloseDetection(terminal, panelId, sessionId);

  return {
    terminal,
    message: 'MCP Manager opened. Close terminal to apply changes.'
  };
}
```

### 4. Verify Close Detection Callback

**File:** `src/services/TerminalManager.ts`

```typescript
private _setupMCPTerminalCloseDetection(
  terminal: vscode.Terminal,
  panelId?: string,
  sessionId?: string
): void {
  const terminalName = terminal.name;
  let restartTriggered = false;

  const triggerRestart = (source: string) => {
    if (restartTriggered) return;
    restartTriggered = true;

    console.log(`[MCP Terminal] Close detected via ${source}`);
    console.log(`[MCP Terminal] panelId: ${panelId}, sessionId: ${sessionId}`);

    // CRITICAL: Pass panelId to callback for proper process restart
    this._callbacks.onMCPTerminalClosed?.(panelId, sessionId);
  };

  // Method 1: Standard close event
  const disposable = vscode.window.onDidCloseTerminal(closedTerminal => {
    if (closedTerminal === terminal || closedTerminal.name === terminalName) {
      triggerRestart('onDidCloseTerminal');
    }
  });

  // Method 2: Polling fallback (VS Code may defer events)
  const pollInterval = setInterval(() => {
    const stillExists = vscode.window.terminals.some(t => t === terminal);
    if (!stillExists) {
      clearInterval(pollInterval);
      triggerRestart('polling');
    }
  }, 1000);

  // Cleanup after 10 minutes (terminal left open too long)
  setTimeout(() => {
    if (!restartTriggered) {
      clearInterval(pollInterval);
      disposable.dispose();
    }
  }, 600000);
}
```

### 5. Add /mcp to Slash Commands Modal (Optional)

**File:** `src/webview/components/organisms/slash-commands-modal.tsx`

If `/mcp` should appear in the UI slash commands list:

```typescript
// Add to DEFAULT_CLI_COMMANDS array (around line 57-68)

const DEFAULT_CLI_COMMANDS: SlashCommand[] = [
  // ... existing commands
  {
    command: 'mcp',
    description: 'Open MCP Manager to configure servers',
    category: 'tools'
  }
];
```

### 6. Handle /mcp from Chat Input

**File:** `src/webview/hooks/handlers/useChatHandlers.ts`

If user types `/mcp` in chat (not slash command modal):

```typescript
// In message handling, detect /mcp and route appropriately

const handleSendMessage = useCallback((text: string) => {
  // Check for slash commands
  if (text.trim().startsWith('/')) {
    const command = text.trim().slice(1).split(' ')[0].toLowerCase();

    if (command === 'mcp') {
      // Send special message to open MCP terminal
      postMessage({ type: 'openMCPTerminal' });
      return;  // Don't send as regular message
    }
  }

  // Regular message handling...
  sendMessage(text, planMode, thinkingMode, images);
}, [sendMessage, planMode, thinkingMode, images, postMessage]);
```

### 7. Handle openMCPTerminal Message (Backend)

**File:** `src/extension.ts`

```typescript
// Add message handler

this._messageRouter.register('openMCPTerminal',
  (_msg: unknown, panelId?: string) => {
    this._executeSlashCommand('mcp', panelId);
  }
);
```

### Edge Cases

1. **Multiple panels**: Each panel should track its own MCP terminal → process restart
2. **Terminal left open**: 10-minute timeout cleans up listeners
3. **Rapid open/close**: `restartTriggered` flag prevents double-restart
4. **No session**: Return error if no active session

### Integration Test Plan

```typescript
describe('MCP Terminal Feature', () => {
  test('/mcp command opens visible terminal', () => {
    // Execute /mcp
    // Verify terminal created with name "Claude MCP Manager"
    // Verify terminal.show() called
  });

  test('MCP terminal close triggers process restart', async () => {
    // Open MCP terminal
    // Close terminal
    // Verify _restartClaudeProcess called with correct panelId
  });

  test('panelId isolation works for multiple panels', async () => {
    // Open MCP terminal for panel-1
    // Open MCP terminal for panel-2
    // Close panel-1 terminal
    // Verify only panel-1 process restarted
  });

  test('session preserved after MCP restart', async () => {
    // Note current sessionId
    // Open and close MCP terminal
    // Verify new process uses same sessionId
  });
});
```

---

## Dead Code Cleanup (From Phase 1 Analysis)

**Priority:** LOW
**Status:** ❌ NOT DONE

### Backend Dead Code
```
src/utils/message-utils.ts (31 lines)
- Exports: extractMessageText, getMessageContent
- Status: Exported in utils/index.ts but NEVER imported elsewhere
- Action: DELETE file, remove exports from utils/index.ts
- Superseded by: message-text-extractor.ts
```

### Note for Claude-2
The following webview dead code files should be deleted by Claude-2:
- `src/webview/lib/messageUtils.ts` (130+ lines)
- `src/webview/lib/conversationUtils.ts` (217 lines)
- `src/webview/lib/messageHandlers.ts` (118 lines)

---

## Unit Tests for Phase 1 Utilities

**Priority:** MEDIUM
**Status:** ❌ NOT DONE

These utilities were created in Phase 1 but lack unit tests:

### EventBus.test.ts
```typescript
// src/test/utils/EventBus.test.ts
import * as assert from 'assert';
import { EventBus, eventBus, EVENTS } from '../../utils/EventBus';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  test('on/emit basic functionality', () => {
    const events: string[] = [];
    bus.on('test', (data: string) => events.push(data));
    bus.emit('test', 'hello');
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0], 'hello');
  });

  test('once removes handler after first call', () => {
    let count = 0;
    bus.once('test', () => count++);
    bus.emit('test', null);
    bus.emit('test', null);
    assert.strictEqual(count, 1);
  });

  test('emitAsync waits for async handlers', async () => {
    let resolved = false;
    bus.on('test', async () => {
      await new Promise(r => setTimeout(r, 10));
      resolved = true;
    });
    await bus.emitAsync('test', null);
    assert.strictEqual(resolved, true);
  });

  test('max listeners warning', () => {
    bus.setMaxListeners(2);
    bus.on('test', () => {});
    bus.on('test', () => {});
    // Third should trigger warning (captured via console spy if needed)
    bus.on('test', () => {});
    assert.strictEqual(bus.listenerCount('test'), 3);
  });
});
```

### debounce.test.ts
```typescript
// src/test/utils/debounce.test.ts
import * as assert from 'assert';
import { debounce, throttle, rateLimit, once, after } from '../../utils/debounce';

describe('Debounce Utilities', () => {
  describe('debounce', () => {
    test('delays execution', (done) => {
      let count = 0;
      const debounced = debounce(() => count++, 50);
      debounced();
      debounced();
      debounced();
      assert.strictEqual(count, 0);
      setTimeout(() => {
        assert.strictEqual(count, 1);
        done();
      }, 100);
    });

    test('cancel prevents execution', (done) => {
      let count = 0;
      const debounced = debounce(() => count++, 50);
      debounced();
      debounced.cancel();
      setTimeout(() => {
        assert.strictEqual(count, 0);
        done();
      }, 100);
    });
  });

  describe('throttle', () => {
    test('limits call frequency', (done) => {
      let count = 0;
      const throttled = throttle(() => count++, 50);
      throttled(); // Executes immediately
      throttled(); // Queued
      throttled(); // Overwrites queued
      assert.strictEqual(count, 1);
      setTimeout(() => {
        assert.strictEqual(count, 2);
        done();
      }, 100);
    });
  });

  describe('rateLimit', () => {
    test('blocks when limit exceeded', () => {
      let count = 0;
      const limited = rateLimit(() => count++, { maxCalls: 2, windowMs: 100 });
      assert.strictEqual(limited(), true);
      assert.strictEqual(limited(), true);
      assert.strictEqual(limited(), false); // Blocked
      assert.strictEqual(count, 2);
    });
  });

  describe('once', () => {
    test('only executes first call', () => {
      let count = 0;
      const onceFn = once(() => ++count);
      assert.strictEqual(onceFn(), 1);
      assert.strictEqual(onceFn(), 1);
      assert.strictEqual(count, 1);
    });
  });
});
```

### HandlerRegistry.test.ts
```typescript
// src/test/utils/HandlerRegistry.test.ts
import * as assert from 'assert';
import { HandlerRegistry } from '../../utils/HandlerRegistry';

describe('HandlerRegistry', () => {
  let registry: HandlerRegistry<{ type: string; data?: unknown }>;

  beforeEach(() => {
    registry = new HandlerRegistry();
  });

  test('register and dispatch', async () => {
    const received: unknown[] = [];
    registry.register('test', (msg) => received.push(msg.data));

    const handled = await registry.dispatch('test', { type: 'test', data: 'hello' });

    assert.strictEqual(handled, true);
    assert.strictEqual(received[0], 'hello');
  });

  test('registerOnce removes after first call', async () => {
    let count = 0;
    registry.registerOnce('test', () => count++);

    await registry.dispatch('test', { type: 'test' });
    await registry.dispatch('test', { type: 'test' });

    assert.strictEqual(count, 1);
  });

  test('unregister function works', async () => {
    let count = 0;
    const unregister = registry.register('test', () => count++);

    await registry.dispatch('test', { type: 'test' });
    unregister();
    await registry.dispatch('test', { type: 'test' });

    assert.strictEqual(count, 1);
  });

  test('priority ordering', async () => {
    const order: number[] = [];
    registry.register('test', () => order.push(1), { priority: 1 });
    registry.register('test', () => order.push(2), { priority: 2 });
    registry.register('test', () => order.push(0), { priority: 0 });

    await registry.dispatch('test', { type: 'test' });

    assert.deepStrictEqual(order, [2, 1, 0]);
  });
});
```

---

## Updated Phase 2 Definition of Done

### New Features Added
- [ ] **MCP Terminal Routing**: Route /mcp to openMCPTerminal() instead of generic slash command
- [ ] **Panel ID Tracking**: Ensure panelId flows through terminal → callback → process restart
- [ ] **Close Detection Verified**: Both event listener and polling working
- [ ] **Optional UI**: Add /mcp to slash commands modal

### Service Enhancements
- [ ] Add event emission to McpService
- [ ] Add backup/restore methods to GitService
- [ ] Integration tests for McpService and GitService

### Dead Code Cleanup
- [ ] Delete `src/utils/message-utils.ts` (superseded by message-text-extractor)
- [ ] Remove exports from `utils/index.ts`

### Unit Tests for Utilities (NEW)
- [ ] Create `src/test/utils/` directory
- [ ] EventBus.test.ts
- [ ] debounce.test.ts
- [ ] HandlerRegistry.test.ts
- [ ] message-text-extractor.test.ts (optional - used internally)

### Coordinate with CLAUDE-1
- CLAUDE-1 handles `_restartClaudeProcess()` implementation
- CLAUDE-1 handles `onMCPTerminalClosed` callback wiring

### Coordinate with CLAUDE-2
- CLAUDE-2 should delete dead webview files (see Dead Code Cleanup section)

**Note:** See Phase 1 for TerminalManager verification, async cleanup in dispose, and architectural recommendations
