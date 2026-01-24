# CLAUDE-3: Architecture & Integration - Phase 1 (HIGH Priority)

**Role:** Facade architecture, extension.ts refactor, integration tests, CI/CD
**Test Framework:** VS Code Native Testing (@vscode/test-cli, assert)
**Coordination:** Check `CLAUDE-HANDOFF.md` before starting and after completing tasks

---

## Codebase Alignment Status (Updated 2026-01-04)

| Item | Status | Notes |
|------|--------|-------|
| extension.ts Refactor | ❌ NOT DONE | Still 3,091 lines - NOT refactored to ~500 |
| src/facades/ Directory | ❌ NOT DONE | Directory doesn't exist |
| EventBus | ❌ NOT DONE | Doesn't exist - uses MessageRouter instead |
| Debounce Utilities | ⚠️ PARTIAL | MessageDebouncer exists, no centralized debounce.ts |
| ProcessFacade | ❌ NOT DONE | Using ProcessRegistry directly |
| PermissionsFacade | ❌ NOT DONE | Using PermissionsManager directly |
| CI/CD Pipeline | ✅ DONE | `.github/workflows/ci.yml` exists (40 lines) |
| cleanupOrphanedProcesses | ✅ DONE | Exists in ProcessRegistry (lines 338-351) |
| Integration Tests | ⚠️ MINIMAL | Some service tests exist, no facade tests |

---

## Current Architecture (What Exists)

The codebase uses a **direct service composition** pattern rather than facades:

```
src/extension.ts (3,091 lines) - Monolithic provider
       │
       ├── ProcessRegistry      ──→ Multi-panel process management
       ├── ProcessManager       ──→ Single process lifecycle
       ├── PermissionsManager   ──→ Permission checking
       ├── ConversationManager  ──→ JSONL storage
       ├── MessageRouter        ──→ Command dispatching (event-like)
       ├── TerminalManager      ──→ Terminal integration
       ├── McpService           ──→ MCP configuration
       ├── GitService           ──→ Git operations
       └── backends/            ──→ Backend adapter pattern (facade-like)
           ├── BackendAdapter.ts
           ├── ClaudeBackend.ts
           └── OpenCodeBackend.ts
```

**Key insight:** The backend adapter pattern (`src/services/backends/`) IS a form of facade, allowing swap-able backends without changing extension.ts.

---

## Phase 1 Scope (REVISED)

This phase should focus on **incremental improvements** rather than complete rewrite:

1. Create EventBus utility (lightweight, opt-in)
2. Create centralized debounce/throttle utilities
3. Add cleanupOrphanedProcesses call on startup (if not already)
4. **Verify TerminalManager completeness** (all needed methods exist)
5. **Ensure async cleanup in dispose()** (await process kills with timeout)
6. **Apply architectural recommendations** (enhance services, don't create facades)
7. Improve CI/CD with test coverage
8. Add integration tests for key flows

**Note:** Full facade refactor would require significant changes to extension.ts. Consider whether benefits justify the effort.

---

## Your Files (You Own These)

```
# Existing Files to Modify
src/extension.ts               # 3,091 lines - improve incrementally
.github/workflows/ci.yml       # ✅ Exists (40 lines) - enhance

# New Files to Create
src/utils/
├── EventBus.ts               # NEW: Optional event system
├── debounce.ts               # NEW: Centralized utilities
└── index.ts                  # Update exports

src/types/
└── events.ts                 # NEW: Event type definitions

src/test/integration/
├── cli-communication.test.ts  # NEW
├── permission-flow.test.ts    # NEW
└── multi-panel.test.ts        # NEW

# Files That Already Exist (Don't Recreate)
src/services/ProcessRegistry.ts    # ✅ Has cleanupOrphanedProcesses
src/services/MessageRouter.ts      # ✅ Event-like routing exists
src/services/MessageDebouncer.ts   # ✅ Debouncing for messages
```

---

## EventBus (Create as Opt-In Utility)

**Purpose:** Provide loose coupling for new features without requiring extension.ts rewrite

**Create:** `src/utils/EventBus.ts`

```typescript
type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

interface EventSubscription {
  unsubscribe: () => void;
}

export class EventBus {
  private _handlers = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): EventSubscription {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event)!.add(handler as EventHandler);

    return {
      unsubscribe: () => this._handlers.get(event)?.delete(handler as EventHandler)
    };
  }

  once<T>(event: string, handler: EventHandler<T>): EventSubscription {
    const wrapper: EventHandler<T> = (data) => {
      this._handlers.get(event)?.delete(wrapper as EventHandler);
      handler(data);
    };
    return this.on(event, wrapper);
  }

  emit<T>(event: string, data: T): void {
    const handlers = this._handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (e) {
          console.error(`[EventBus] Error in handler for ${event}:`, e);
        }
      }
    }
  }

  off(event: string): void {
    this._handlers.delete(event);
  }

  clear(): void {
    this._handlers.clear();
  }

  listEvents(): string[] {
    return Array.from(this._handlers.keys());
  }
}

// Optional singleton for extension-wide use
export const eventBus = new EventBus();

// Event type constants (add as needed)
export const EVENTS = {
  PROCESS_SPAWNED: 'process:spawned',
  PROCESS_EXIT: 'process:exit',
  PERMISSION_PROMPT: 'permission:prompt',
  PERMISSION_RESPONDED: 'permission:responded',
  CONVERSATION_LOADED: 'conversation:loaded',
  PANEL_ACTIVATED: 'panel:activated',
} as const;
```

---

## Debounce Utilities

**Note:** MessageDebouncer exists but is specific to message batching.
**Create:** `src/utils/debounce.ts` for general-purpose use

```typescript
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | undefined;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = undefined;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

export function rateLimit<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: { maxCalls: number; windowMs: number }
): (...args: Parameters<T>) => boolean {
  const calls: number[] = [];

  return (...args: Parameters<T>): boolean => {
    const now = Date.now();
    const windowStart = now - options.windowMs;

    while (calls.length > 0 && calls[0] < windowStart) {
      calls.shift();
    }

    if (calls.length >= options.maxCalls) {
      return false;
    }

    calls.push(now);
    fn(...args);
    return true;
  };
}
```

**Export in `src/utils/index.ts`.**

---

## Verify cleanupOrphanedProcesses on Startup

**File:** `src/services/ProcessRegistry.ts` (lines 338-351)
**Status:** ✅ Method exists

**Check in extension.ts** that it's called on activation:

```typescript
// In ClaudeChatProvider constructor or activate()
this._processRegistry.cleanupOrphanedProcesses();
```

If not called, add it.

---

## Enhance CI/CD Pipeline

**Existing:** `.github/workflows/ci.yml` (40 lines)
**Enhancement:** Add coverage, caching, better artifact handling

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [18, 20]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run compile

      - name: Lint
        run: npm run lint || true

      - name: Run tests
        run: npm test
        continue-on-error: true  # Don't fail on test failures yet

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.os }}-${{ matrix.node }}
          path: test-results/

  build:
    runs-on: ubuntu-latest
    needs: [test]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run compile
      - run: npx vsce package --allow-missing-repository

      - name: Upload VSIX
        uses: actions/upload-artifact@v4
        with:
          name: extension-vsix
          path: '*.vsix'
```

---

## Integration Tests

### CLI Communication Test

```typescript
// src/test/integration/cli-communication.test.ts
import * as assert from 'assert';
import { ProcessRegistry } from '../../services/ProcessRegistry';

describe('CLI Communication Integration', () => {
  let registry: ProcessRegistry;

  beforeEach(() => {
    registry = new ProcessRegistry();
  });

  afterEach(async () => {
    await registry.killAll();
  });

  describe('Process Lifecycle', () => {
    test('should spawn process for panel', async () => {
      // Would need mocked child_process
      // This is a placeholder structure
    });

    test('should handle rapid spawn/kill cycles', async () => {
      // Test race condition handling
    });

    test('should cleanup orphaned processes', () => {
      registry.cleanupOrphanedProcesses();
      // Verify no orphans remain
    });
  });
});
```

### Permission Flow Test

```typescript
// src/test/integration/permission-flow.test.ts
import * as assert from 'assert';
import { PermissionsManager } from '../../services/PermissionsManager';

describe('Permission Flow Integration', () => {
  let manager: PermissionsManager;

  beforeEach(() => {
    // Mock ExtensionContext
    manager = new PermissionsManager(mockContext);
  });

  describe('Command Blocking', () => {
    test('should block dangerous commands', () => {
      const result = manager.isCommandBlocked('rm -rf /');
      assert.strictEqual(result.blocked, true);
    });

    test('should allow safe commands', () => {
      const result = manager.isCommandBlocked('npm install');
      assert.strictEqual(result.blocked, false);
    });
  });
});
```

### Multi-Panel Test

```typescript
// src/test/integration/multi-panel.test.ts
import * as assert from 'assert';
import { ProcessRegistry } from '../../services/ProcessRegistry';

describe('Multi-Panel Integration', () => {
  describe('Panel Isolation', () => {
    test('should manage separate processes per panel', async () => {
      // Verify independent processes
    });

    test('should route messages to correct panel', async () => {
      // Verify routing
    });

    test('should cleanup on panel dispose', async () => {
      // Verify cleanup
    });
  });
});
```

---

## Incremental Refactor Strategy

Instead of rewriting extension.ts to use facades, consider this approach:

### Phase 1A: Utilities Only
- Create EventBus (opt-in, don't wire everywhere)
- Create debounce utilities
- Add integration tests

### Phase 1B: Gradual Adoption
- Wire EventBus for new features only
- Use utilities in new code
- Don't touch working extension.ts logic

### Phase 1C: Identify High-Value Refactors
- Profile extension.ts for pain points
- Identify specific methods to extract
- Create facades incrementally for those areas

---

## Build & Test Commands

```bash
# Run tests
npm test

# Run specific integration tests (if configured)
npm test -- --grep "Integration"

# Type check
npm run compile

# Build VSIX
npx vsce package --allow-missing-repository
```

---

## Phase 1 Definition of Done

### Already Complete ✅
- [x] CI/CD pipeline exists
- [x] cleanupOrphanedProcesses() exists in ProcessRegistry
- [x] MessageRouter provides event-like dispatching
- [x] Backend adapter pattern exists (facade-like)

### Still Required ❌
- [ ] Create EventBus utility (opt-in)
- [ ] Create centralized debounce/throttle utilities
- [ ] Export utilities in src/utils/index.ts
- [ ] Verify cleanupOrphanedProcesses called on startup
- [ ] **Verify TerminalManager has all needed methods** (openTerminal, executeInTerminal, closeTerminal, closeAll)
- [ ] **Ensure extension.ts dispose() awaits process kills** (with 5s timeout)
- [ ] **Ensure panel disposal awaits process kills** (proper async cleanup)
- [ ] **Document architectural recommendations** (enhance services, not facades)
- [ ] Add integration test files (cli-communication, permission-flow, multi-panel)
- [ ] Enhance CI/CD with coverage
- [ ] No TypeScript errors (`npm run compile`)

### NOT Recommended for Phase 1
- Full extension.ts refactor to facades (too much churn for unclear benefit)
- Wholesale adoption of EventBus (add incrementally)
- Creating facade wrappers on top of services (adds indirection without benefit)

---

## COMPREHENSIVE ARCHITECTURAL RECOMMENDATIONS (From Codebase Analysis)

### Domain-Driven Folder Reorganization

**Problem:** Flat service structure (34 files) and scattered webview components make navigation difficult

**Solution:** Reorganize entire codebase around domains/features

#### Proposed Top-Level Structure

```
src/
├── main/ (backend entry)
│   ├── extension.ts (slim orchestrator)
│   └── index.ts
├── types/ (shared across all)
│   ├── index.ts
│   ├── process.ts
│   ├── session.ts
│   ├── messages.ts
│   ├── shared.ts
│   └── domain/
│       ├── mcp.ts
│       ├── permissions.ts
│       └── terminals.ts
├── utils/ (purely functional, no state)
│   ├── platform.ts
│   ├── shell.ts
│   ├── paths.ts
│   ├── process-control.ts
│   ├── notifications.ts
│   ├── message-text-extractor.ts (consolidated)
│   ├── debounce.ts
│   ├── EventBus.ts
│   └── index.ts
├── services/ (backend domain logic)
│   ├── index.ts (barrel export)
│   ├── core/ (foundational services)
│   │   ├── ProcessManager.ts
│   │   ├── ProcessRegistry.ts
│   │   ├── ConversationManager.ts
│   │   └── index.ts
│   ├── streaming/ (message processing)
│   │   ├── StreamBuffer.ts
│   │   ├── StreamProcessor.ts
│   │   ├── MessageRouter.ts
│   │   ├── MessageDebouncer.ts
│   │   └── index.ts
│   ├── features/ (domain features)
│   │   ├── mcp/
│   │   │   ├── McpService.ts
│   │   │   └── index.ts
│   │   ├── permissions/
│   │   │   ├── PermissionsManager.ts
│   │   │   ├── CommandValidator.ts
│   │   │   ├── PermissionAuditor.ts
│   │   │   └── index.ts
│   │   ├── sessions/
│   │   │   ├── SessionManager.ts
│   │   │   └── index.ts
│   │   ├── backup/
│   │   │   ├── BackupService.ts
│   │   │   └── index.ts
│   │   └── diffs/
│   │       ├── DiffService.ts
│   │       └── index.ts
│   ├── monitoring/
│   │   ├── LogService.ts
│   │   ├── MemoryMonitor.ts
│   │   ├── MetricsService.ts
│   │   └── index.ts
│   ├── config/
│   │   ├── SettingsManager.ts
│   │   └── index.ts
│   ├── backends/
│   │   ├── BackendAdapter.ts
│   │   ├── BaseBackend.ts
│   │   ├── ClaudeBackend.ts
│   │   ├── opencode/
│   │   └── index.ts
│   └── shared/
│       ├── CliSchemas.ts (consolidated Zod schemas)
│       ├── shared-types.ts
│       └── PanelManager.ts
├── webview/ (React frontend)
│   ├── main/
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── stores/ (Zustand - organized by domain)
│   │   ├── index.ts
│   │   ├── chatStore.ts
│   │   ├── tokenStore.ts
│   │   ├── permissionStore.ts
│   │   ├── conversationMetaStore.ts
│   │   ├── settingsStore.ts
│   │   ├── toolPreviewStore.ts
│   │   ├── mcpStore.ts
│   │   └── branchStore.ts
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── useVSCodeMessaging.ts
│   │   ├── messaging/ (extracted)
│   │   │   ├── messageHandlers.ts
│   │   │   └── handlerRegistry.ts
│   │   ├── useModalHandlers.ts
│   │   ├── useChatActions.ts
│   │   └── handlers/
│   │       ├── useChatHandlers.ts
│   │       ├── useFileHandlers.ts
│   │       ├── useMcpHandlers.ts
│   │       └── ...
│   ├── components/
│   │   ├── index.ts
│   │   ├── primitives/ (renamed from ui/)
│   │   │   ├── buttons/
│   │   │   ├── inputs/
│   │   │   ├── surfaces/
│   │   │   └── feedback/
│   │   ├── atoms/
│   │   │   ├── StreamingCursor.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── index.ts
│   │   ├── molecules/ (organized by domain)
│   │   │   ├── messaging/
│   │   │   ├── mcp/
│   │   │   ├── permissions/
│   │   │   ├── forms/
│   │   │   ├── cards/
│   │   │   ├── tool-blocks/
│   │   │   └── utils/
│   │   ├── organisms/ (organized by feature)
│   │   │   ├── chat/
│   │   │   ├── sidebar/
│   │   │   ├── modals/
│   │   │   ├── panels/
│   │   │   └── settings/
│   │   └── layouts/
│   │       └── ChatLayout.tsx
│   ├── lib/
│   │   ├── formatters/
│   │   │   ├── mcp-formatter.ts
│   │   │   ├── json-formatter.ts
│   │   │   ├── html-formatter.ts
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── conversationUtils.ts
│   │   │   ├── messageUtils.ts
│   │   │   └── index.ts
│   │   ├── markdown.tsx
│   │   └── animations.ts
│   └── styles/
│       └── globals.css
├── __tests__/ (mirrors src/ structure)
│   ├── unit/
│   │   ├── services/
│   │   │   ├── core/
│   │   │   ├── streaming/
│   │   │   ├── features/
│   │   │   └── monitoring/
│   │   ├── utils/
│   │   ├── webview/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   └── components/
│   │   └── types/
│   ├── integration/
│   │   ├── extension/
│   │   ├── backends/
│   │   └── services/
│   ├── mocks/
│   │   ├── vscode.ts
│   │   ├── child_process.ts
│   │   ├── fs.ts
│   │   └── services/
│   └── fixtures/
│       ├── conversations/
│       ├── processes/
│       └── messages/
└── constants.ts
```

---

### Consolidate Message Handling Systems

**Problem:** Two parallel message routing systems (extension vs webview) with different APIs

**Current State:**
- Extension: `MessageRouter` class (95 lines)
- Webview: `useVSCodeMessaging` hook with functional Map-based dispatch

**Solution:** Create shared `HandlerRegistry` base pattern

```typescript
// src/utils/HandlerRegistry.ts
export class HandlerRegistry<TMessage = unknown> {
  private handlers = new Map<string, (msg: TMessage) => void | Promise<void>>();

  register(type: string, handler: (msg: TMessage) => void | Promise<void>): void {
    this.handlers.set(type, handler);
  }

  async dispatch(type: string, message: TMessage): Promise<void> {
    const handler = this.handlers.get(type);
    if (handler) {
      await handler(message);
    }
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  clear(): void {
    this.handlers.clear();
  }
}
```

**Action Items:**
- [ ] Create HandlerRegistry utility
- [ ] Update MessageRouter to extend/use HandlerRegistry
- [ ] Update webview useVSCodeMessaging to use HandlerRegistry pattern
- [ ] Document shared API pattern

---

### Centralize Message Text Extraction

**Problem:** 5 duplicate implementations across:
- `src/utils/message-utils.ts`
- `src/webview/lib/messageUtils.ts`
- `src/services/ConversationManager.ts:706`
- `src/types/shared.ts`
- Test helpers

**Solution:** Single canonical utility

```typescript
// src/utils/message-text-extractor.ts
export interface TextExtractable {
  content?: ContentBlock[] | string;
  text?: string;
  message?: string;
}

export function extractTextFromContent(
  source: ContentBlock[] | string | TextExtractable
): string {
  // Handle string
  if (typeof source === 'string') {
    return source;
  }

  // Handle ContentBlock[]
  if (Array.isArray(source)) {
    return source
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');
  }

  // Handle object with content property
  if ('content' in source) {
    return extractTextFromContent(source.content);
  }

  // Handle object with text property
  if ('text' in source) {
    return source.text || '';
  }

  // Handle object with message property
  if ('message' in source) {
    return source.message || '';
  }

  return '';
}
```

**Action Items:**
- [ ] Create message-text-extractor.ts utility
- [ ] Replace ConversationManager._extractUserText() with import
- [ ] Replace webview/lib/messageUtils.getMessageText() with import
- [ ] Update test helpers to use canonical utility
- [ ] Remove duplicate implementations

---

### Create Comprehensive Test Structure

**Current:** 3/34 services tested (8.8% coverage), no webview tests

**Proposed:** Mirror src/ structure in __tests__/

```
src/__tests__/
├── unit/
│   ├── services/
│   │   ├── core/
│   │   │   ├── ProcessManager.test.ts
│   │   │   ├── ProcessRegistry.test.ts
│   │   │   └── ConversationManager.test.ts
│   │   ├── streaming/
│   │   │   ├── StreamBuffer.test.ts
│   │   │   ├── StreamProcessor.test.ts
│   │   │   └── MessageRouter.test.ts
│   │   ├── features/
│   │   │   ├── permissions/
│   │   │   │   ├── PermissionsManager.test.ts
│   │   │   │   ├── CommandValidator.test.ts
│   │   │   │   └── PermissionAuditor.test.ts
│   │   │   ├── mcp/
│   │   │   │   └── McpService.test.ts
│   │   │   └── sessions/
│   │   │       └── SessionManager.test.ts
│   │   └── backends/
│   │       ├── ClaudeBackend.test.ts
│   │       └── OpenCodeBackend.test.ts
│   ├── utils/
│   │   ├── debounce.test.ts
│   │   ├── EventBus.test.ts
│   │   ├── message-text-extractor.test.ts
│   │   └── paths.test.ts
│   ├── webview/
│   │   ├── hooks/
│   │   │   ├── useVSCodeMessaging.test.ts
│   │   │   └── useChatActions.test.ts
│   │   ├── stores/
│   │   │   ├── chatStore.test.ts
│   │   │   ├── tokenStore.test.ts
│   │   │   └── settingsStore.test.ts
│   │   └── components/
│   │       ├── ErrorBoundary.test.tsx
│   │       └── MessageBlock.test.tsx
│   └── types/
│       └── messages.test.ts
├── integration/
│   ├── extension/
│   │   ├── multi-panel.test.ts
│   │   └── process-lifecycle.test.ts
│   ├── backends/
│   │   └── backend-switching.test.ts
│   └── services/
│       ├── permission-flow.test.ts
│       └── conversation-loading.test.ts
├── mocks/
│   ├── vscode.ts
│   ├── child_process.ts
│   ├── fs.ts
│   └── services/
│       ├── MockProcessManager.ts
│       └── MockConversationManager.ts
└── fixtures/
    ├── conversations/
    │   ├── sample-session.jsonl
    │   └── large-session.jsonl
    ├── processes/
    │   └── mock-process-output.json
    └── messages/
        └── message-samples.ts
```

**Action Items:**
- [ ] Create __tests__/ folder structure mirroring src/
- [ ] Move existing tests to new structure
- [ ] Create test fixtures for common scenarios
- [ ] Create mock services for integration tests
- [ ] Set up test coverage reporting
- [ ] Target 80%+ test coverage

---

### Delete Dead Code (Both src/ui/ and src/_legacy/)

**Action Items:**
- [ ] Delete `src/ui/` folder (9.9 MB, Stitch exports, not used)
- [ ] Delete `src/_legacy/` folder (3 files, old HTML/CSS UI)
- [ ] Verify no imports from either before deletion
- [ ] Update .gitignore if needed
- [ ] Total savings: ~10 MB of dead code

---

### Implementation Priority

**Phase 1A: Quick Wins (Day 1 - 2-3 hours)**
1. Create EventBus utility
2. Create debounce/throttle utilities
3. Delete src/ui/ and src/_legacy/
4. Create message-text-extractor utility
5. Verify cleanupOrphanedProcesses called on startup

**Phase 1B: Test Infrastructure (Day 2 - 4-6 hours)**
6. Create __tests__/ folder structure
7. Create mocks/ and fixtures/ directories
8. Move existing tests to new structure
9. Add integration test scaffolding

**Phase 1C: Architectural Verification (Day 3 - 2-3 hours)**
10. Verify TerminalManager completeness
11. Ensure async cleanup in dispose()
12. Document architectural recommendations
13. Enhance CI/CD with coverage reporting

**Phase 1D: Consolidation (Day 4 - 3-4 hours)**
14. Create HandlerRegistry pattern
15. Consolidate message text extraction to single utility
16. Update all imports to use new utilities

---

## Phase 1 Priority Summary

**Quick Wins (Do First):**
1. Delete src/ui/ and src/_legacy/ (10 minutes, saves 10 MB)
2. Create message-text-extractor utility (1 hour, consolidates 5 implementations)
3. Create EventBus and debounce utilities (2 hours, enables future refactoring)

**High Impact (Do Next):**
4. Create __tests__/ structure (2-3 hours, enables comprehensive testing)
5. Create HandlerRegistry pattern (2-3 hours, unifies message handling)
6. Verify TerminalManager and async dispose (1-2 hours, ensures reliability)

**After completing Phase 1, proceed to CLAUDE-3-ARCHITECTURE-PHASE-2.md**
