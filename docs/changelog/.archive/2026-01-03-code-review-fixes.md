# Changelog - 2026-01-03 (Code Review Fixes)

## Comprehensive Security, Performance, and Stability Fixes

- **Goal**: Implement all fixes identified in the comprehensive code review
- **Risk Level**: Med - Multiple critical fixes across services, all additive/defensive changes

Addressed 11 issues from `docs/code-review-2026-01-03.md` spanning CRITICAL, HIGH, MEDIUM, and LOW severity. Fixes include race condition prevention, memory safety, security hardening, React performance optimization, and resource leak prevention.

---

## Quick-Scan Summary

| Severity | Issues Fixed | Key Areas |
|----------|--------------|-----------|
| CRITICAL | 2 | Process spawning, buffer overflow |
| HIGH | 5 | Audit logging, React perf, path traversal, ReDoS |
| MEDIUM | 4 | Closures, file handles, memory leaks, state reset |
| LOW | 1 | Cache sizing |

| File | Lines Changed | Type |
|------|---------------|------|
| `ProcessRegistry.ts` | +25 | Race condition fix + cleanup method |
| `StreamBuffer.ts` | +8 | Buffer size limit |
| `PermissionsManager.ts` | +20 | Init promise + ReDoS protection |
| `CliIntegration.ts` | +18 | Path traversal validation |
| `App.tsx` | +30 | useShallow selectors + dep fixes |
| `chatStore.ts` | +2 | State reset consistency |
| `ConversationManager.ts` | +12 | File handle leak fix |
| `DiffService.ts` | +2 | Cache size increase |

---

## ✅ No Breaking Changes

All fixes are backward-compatible defensive improvements.

---

## Environment & Dependencies

| Type | Name | Change | Notes |
|------|------|--------|-------|
| Dep | `zustand` | Used `useShallow` | Already installed (^5.0.9) |

---

## Security

### Fixed: Path Traversal Vulnerability in CliIntegration

**File**: `src/services/CliIntegration.ts:212-238`

Added validation to ensure loaded files are within authorized `~/.claude/projects` directory:

```typescript
const resolvedPath = path.resolve(filePath);
const resolvedProjectsPath = path.resolve(this._cliProjectsPath);

if (!resolvedPath.startsWith(resolvedProjectsPath)) {
  // Block access and log attempt
}
```

- Prevents arbitrary file read via crafted webview messages
- Additional check for `.jsonl` extension only

### Fixed: ReDoS Vulnerability in PermissionsManager

**File**: `src/services/PermissionsManager.ts:289-313`

Added protection against catastrophic backtracking in user-provided regex patterns:

```typescript
// Reject patterns with dangerous constructs
const DANGEROUS_PATTERNS = /(\+|\*|\?)\s*(\+|\*|\?)|(\(\?[^)]*\)){3,}|(.)\1{5,}/;
if (DANGEROUS_PATTERNS.test(regexStr)) {
  console.warn(`Potentially unsafe regex pattern rejected: ${pattern}`);
  return false;
}

// Limit regex length
if (regexStr.length > 200) {
  return false;
}
```

---

## Fixed

### CRITICAL: Process Spawning Race Condition

**File**: `src/services/ProcessRegistry.ts:98-107`

Changed `spawn()` to async and await `kill()` completion before spawning:

```typescript
// Before: fire-and-forget (race condition)
this.kill(panelId).catch(err => console.error(...));

// After: await completion
async spawn(...): Promise<cp.ChildProcess | undefined> {
  if (this._processes.has(panelId)) {
    await this.kill(panelId);  // Wait for cleanup
  }
  // ...spawn new process
}
```

- Prevents zombie processes from resource contention
- Prevents port/lock conflicts on rapid restart

### CRITICAL: Unbounded Buffer Growth (OOM Prevention)

**File**: `src/services/StreamBuffer.ts:44-64`

Added 10MB buffer size limit to prevent memory exhaustion:

```typescript
private static readonly MAX_BUFFER_SIZE = 10 * 1024 * 1024;

parse(chunk: string): ParsedJSON[] {
  if (this._buffer.length + chunk.length > StreamBuffer.MAX_BUFFER_SIZE) {
    console.warn('StreamBuffer exceeded max size, resetting');
    this.reset();
    return [];
  }
  // ...
}
```

### HIGH: Audit Log Data Loss

**File**: `src/services/PermissionsManager.ts:115-125, 317-320`

Added `_initPromise` pattern to prevent audit log writes before initialization:

```typescript
private _initPromise: Promise<void>;

constructor(...) {
  this._initPromise = this._initializeAuditLog();
}

private async _logAuditEntry(entry: AuditEntry): Promise<void> {
  await this._initPromise;  // Ensure init complete
  // ...
}
```

### MEDIUM: File Handle Leak in ConversationManager

**File**: `src/services/ConversationManager.ts:638-644`

Added unified cleanup function with guard:

```typescript
let isCleanedUp = false;

const cleanup = () => {
  if (isCleanedUp) return;
  isCleanedUp = true;
  rl.close();
  fileStream.destroy();
};
```

### MEDIUM: Orphaned Process Memory Leak

**File**: `src/services/ProcessRegistry.ts:320-337`

Added cleanup method for orphaned process entries:

```typescript
cleanupOrphanedProcesses(): number {
  let cleaned = 0;
  for (const [panelId, managed] of this._processes) {
    if (!managed.processManager.isRunning()) {
      this._processes.delete(panelId);
      cleaned++;
    }
  }
  return cleaned;
}
```

### MEDIUM: Inconsistent State Reset

**File**: `src/webview/stores/chatStore.ts:215-226`

Fixed `clearMessages` to also reset image state:

```typescript
clearMessages: () => set({
  messages: [],
  // ...existing resets...
  pendingImages: [],      // NEW: Also clear images
  nextImagePosition: 1,   // NEW: Reset counter
}),
```

---

## Changed

### React Performance: useShallow Selectors

**File**: `src/webview/App.tsx:4, 63-106`

Added `useShallow` from Zustand to prevent re-renders on unrelated state changes:

```typescript
import { useShallow } from 'zustand/react/shallow';

// Before: entire store subscription
const { chatName, ... } = useChatStore();

// After: shallow comparison prevents unnecessary re-renders
const { chatName, todos, ... } = useChatStore(
  useShallow(state => ({
    chatName: state.chatName,
    todos: state.todos,
    // ...
  }))
);
```

- Token stats isolated to separate selector
- UI state uses shallow comparison

### Fixed Stale Closure in useEffect

**File**: `src/webview/App.tsx:112-117`

Added missing dependencies:

```typescript
// Before
}, [inputValueLocal]);  // Missing deps

// After
}, [inputValueLocal, chatActions.inputValue, chatActions.handleInputChange]);
```

### Increased DiffService Cache Size

**File**: `src/services/DiffService.ts:97, 112`

Increased default LRU cache from 50 to 100 entries for power users reviewing many diffs.

---

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/services/ProcessRegistry.ts` | Modified | Race condition fix + cleanup method |
| `src/services/StreamBuffer.ts` | Modified | MAX_BUFFER_SIZE limit |
| `src/services/PermissionsManager.ts` | Modified | Init promise + ReDoS protection |
| `src/services/CliIntegration.ts` | Modified | Path traversal validation |
| `src/services/ConversationManager.ts` | Modified | File handle leak fix |
| `src/services/DiffService.ts` | Modified | Cache size 50→100 |
| `src/webview/App.tsx` | Modified | useShallow + deps fix |
| `src/webview/stores/chatStore.ts` | Modified | clearMessages state reset |
| `src/extension.ts` | Modified | Await async spawn calls |

---

## Verification

**Command**: `npm run compile`
**Results**: ✅ Extension and webview compile successfully

**Package**: `npx vsce package --allow-missing-repository`
**Results**: ✅ `claude-code-chat-1.1.0.vsix` (7.23 MB)

**Install**: `code --install-extension claude-code-chat-1.1.0.vsix --force`
**Results**: ✅ Extension installed successfully

---

## Key Interfaces

```typescript
// ProcessRegistry - now async
async spawn(panelId: string, config: ProcessConfig): Promise<cp.ChildProcess | undefined>
cleanupOrphanedProcesses(): number

// StreamBuffer - new constant
private static readonly MAX_BUFFER_SIZE = 10 * 1024 * 1024;

// PermissionsManager - new property
private _initPromise: Promise<void>;

// DiffServiceConfig - updated default
maxCacheSize?: number;  // Default: 100 (was 50)
```

---

## Related Documents

- `docs/code-review-2026-01-03.md` - Full code review with issue details
- `docs/plans/v2-regression/SESSION-HANDOFF-AGENT1.md` - Agent 1 backend context
