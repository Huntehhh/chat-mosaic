# Changelog - 2026-01-04 (Multi-Panel Isolation Session)

## Multi-Panel Process Isolation: Fixed Cross-Panel Contamination

- **Goal**: Fix session ID and process routing bugs causing multi-panel chats to interfere with each other
- **Risk Level**: High - Core process management changes affecting all panel operations

Fixed critical bugs where opening multiple chat panels caused responses to route to wrong panels, session IDs to contaminate across panels, and "New" session button to spawn non-responsive chats.

---

## Quick-Scan Summary

| Issue | Before | After |
|-------|--------|-------|
| New session empty `session_id` | Sent `session_id: ""` | Omits field entirely |
| Old process close handler | Deleted NEW process entry | Checks spawn generation |
| Session ID routing | Could use wrong panel's session | Always uses panel-specific |
| Process callbacks | Could affect wrong panel | Generation-validated |

---

## ✅ No Breaking Changes

All changes are internal to process management. External APIs unchanged.

---

## Fixed

### Fixed: Empty `session_id` Breaking New Sessions

**File**: `src/extension.ts:1499-1519`

When clicking "+ New" to start a fresh session, the message sent to Claude CLI included `session_id: ""` (empty string). Claude CLI interpreted this as "resume session with ID empty string" which doesn't exist, causing the process to hang.

**Before**:
```typescript
const messageSessionId = panelState?.sessionId || this._currentSessionId || '';
const userMessage = {
  type: 'user',
  session_id: messageSessionId,  // Always included, even if ""
  // ...
};
```

**After**:
```typescript
const messageSessionId = panelState?.sessionId || this._currentSessionId;
const userMessage: Record<string, unknown> = {
  type: 'user',
  message: { role: 'user', content },
  parent_tool_use_id: null
};
if (messageSessionId) {
  userMessage.session_id = messageSessionId;  // Only include if truthy
}
```

### Fixed: Old Process Close Handler Deleting New Process Entry

**File**: `src/services/ProcessRegistry.ts`

Root cause of cross-panel contamination: when Panel 1 clicked "New" and spawned a new process, the OLD process's close handler (still bound to the same `panelId`) would eventually fire and delete the NEW process's registry entry.

**Timeline of bug**:
1. Panel 1 spawns NEW process (PID 76524), replaces entry in `_processes` map
2. OLD process (PID 83232) finally exits
3. OLD process's close handler deletes `_processes['panel-1']` — **deletes the NEW entry!**
4. Panel 1 loses its registry entry
5. Panel 2's responses get misrouted

**Solution**: Added `spawnGeneration` counter to track which process instance each callback belongs to.

```typescript
export interface ManagedProcess {
  // ... existing fields
  /** Unique spawn generation to prevent old process callbacks from affecting new entries */
  spawnGeneration: number;
}

export class ProcessRegistry {
  private _spawnGenerationCounter: number = 0;

  async spawn(panelId: string, config: ProcessConfig) {
    const spawnGeneration = ++this._spawnGenerationCounter;

    const pmCallbacks = {
      onStdout: (data) => this._handleStdout(panelId, spawnGeneration, data),
      onClose: (code, err) => this._handleClose(panelId, spawnGeneration, code, err),
      // ...
    };
    // ...
  }

  private _handleClose(panelId: string, spawnGeneration: number, code, errorOutput) {
    const managed = this._processes.get(panelId);

    // CRITICAL: Only delete if this callback is for the CURRENT process
    if (managed && managed.spawnGeneration !== spawnGeneration) {
      console.log(`Ignoring close from old process (gen ${spawnGeneration}, current ${managed.spawnGeneration})`);
      return;  // Don't delete!
    }
    // Safe to delete - this is the current process
    this._processes.delete(panelId);
  }
}
```

### Fixed: Class-Level `_currentSessionId` Contamination

**File**: `src/extension.ts:1075-1100`

When Panel 2 loaded, it was overwriting `this._currentSessionId` (class-level, shared), which could affect Panel 1 if Panel 1's `panelState.sessionId` was undefined as a fallback.

**Before**:
```typescript
if (latestConversation) {
  panelState.sessionId = latestConversation.sessionId;
  this._currentSessionId = latestConversation.sessionId;  // Overwrites class-level!
}
```

**After**:
```typescript
if (latestConversation) {
  panelState.sessionId = latestConversation.sessionId;
  // NOTE: Intentionally NOT setting this._currentSessionId here
  // Each panel should use its own panelState.sessionId to prevent cross-contamination
}
```

### Fixed: Per-Panel Processing State in Result Handler

**File**: `src/extension.ts:1851-2014`

Result handling now updates panel-specific state first, using the existing `resultPanelState` variable instead of just class-level state.

```typescript
case 'result':
  // Clear processing state - update PANEL state first
  const resultPanelState = this._panels.get(panelId);
  if (resultPanelState) {
    resultPanelState.isProcessing = false;
    resultPanelState.sessionId = jsonData.session_id;  // Panel-specific
  }
  this._isProcessing = false;  // Class-level for legacy
```

---

## Changed

### Changed: `_loadLatestConversationAsync()` No Longer Sets Class-Level Session

Only sets panel-specific `panelState.sessionId`, preventing cross-panel session contamination.

### Changed: Result Handler Uses Panel-Specific State

Removed duplicate variable declarations, reuses `resultPanelState` throughout the result handling block.

### Changed: All ProcessRegistry Handlers Validate Spawn Generation

All five handlers (`_handleStdout`, `_handleStderr`, `_handleClose`, `_handleError`, `_handleUnresponsive`) now validate spawn generation before processing.

---

## Added

### Added: Test Case Documentation

**File**: `docs/plans/refactor-v4-test-cases/v1/multi-panel-state-isolation.md`

Comprehensive test cases for multi-panel isolation including:
- Independent panel processes
- Panel closure independence
- Concurrent message handling
- Session ID isolation
- Same conversation in multiple panels
- Processing state isolation
- New session independence

---

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/extension.ts` | Modified | Session ID handling, result routing, state management |
| `src/services/ProcessRegistry.ts` | Modified | Added spawn generation tracking |
| `docs/plans/refactor-v4-test-cases/v1/multi-panel-state-isolation.md` | **NEW** | Test case documentation |

---

## Key Interfaces

```typescript
// ProcessRegistry - new generation tracking
export interface ManagedProcess {
  panelId: string;
  processManager: ProcessManager;
  streamBuffer: StreamBuffer;
  state: ProcessState;
  createdAt: number;
  spawnGeneration: number;  // NEW - prevents old callbacks from affecting new entries
}

// Handler signatures updated to include generation
private _handleStdout(panelId: string, spawnGeneration: number, data: string): void
private _handleClose(panelId: string, spawnGeneration: number, code: number | null, errorOutput: string): void
```

---

## Verification

**Command**: `npm run compile`
**Result**: Compilation successful

**Manual Testing Required**:
1. Open Panel 1, send message
2. Press Ctrl+Shift+C to open Panel 2
3. Click "New" in Panel 2
4. Send messages in both panels simultaneously
5. Verify responses route to correct panels
6. Close Panel 2 - Panel 1 should continue working

---

## Architecture Notes

### Why Spawn Generation Instead of Process Reference

Could have stored `childProcess` reference and compared in callbacks. Spawn generation is simpler because:
1. Single incrementing counter vs. managing process lifecycle
2. Works even if process reference becomes stale
3. Easier to debug (can log generation numbers)
4. No memory leaks from holding process references

### Multi-Panel Architecture (Now Working)

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
│                                                              │
│  _panels Map:                                                │
│    "panel-1" → { sessionId: "abc", spawnGen: 3 }            │
│    "panel-2" → { sessionId: "def", spawnGen: 4 }            │
│                                                              │
│  ProcessRegistry._processes Map:                             │
│    "panel-1" → { processManager: PM1, spawnGen: 3 }         │
│    "panel-2" → { processManager: PM2, spawnGen: 4 }         │
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
   ┌───────────┐                 ┌───────────┐
   │ claude    │                 │ claude    │
   │ PID 1234  │                 │ PID 5678  │
   │ --resume  │                 │ (new)     │
   │ abc       │                 │           │
   └───────────┘                 └───────────┘
```

Each panel has isolated:
- Session ID
- Claude CLI process
- Spawn generation (for callback validation)
- Processing state
