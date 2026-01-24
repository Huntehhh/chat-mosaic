# Changelog - 2025-12-19 (Multi-Window Implementation Session)

## Multi-Window Support with Independent Claude Processes

- **Goal**: Enable multiple Claude Code Chat windows, each with its own independent Claude process
- **Risk Level**: Med - Core messaging architecture change, partially complete

Implemented multi-window infrastructure allowing users to open multiple chat panels simultaneously. Each panel will have its own Claude process and conversation state. **Work is IN PROGRESS on branch `feature/multi-window-safe`.**

---

## ⚠️ Breaking Changes

- `_handleWebviewMessage(message)` → `_handleWebviewMessage(message, panelId?)`
- `_postMessage(message)` → `_postMessage(message, panelId?)`
- `_sendMessageToClaude(message, planMode?, thinkingMode?)` → `_sendMessageToClaude(message, planMode?, thinkingMode?, panelId?)` (IN PROGRESS)

---

## Current State

| Component | Status | Notes |
|-----------|--------|-------|
| Interfaces (ProcessConfig, PanelState, PanelProcessInfo) | ✅ Complete | Lines 76-115 |
| State variables (_panels, _panelProcesses, etc.) | ✅ Complete | Lines 204-215 |
| Panel management (show, dispose, generate ID) | ✅ Complete | Lines 247-397 |
| _postMessage with panelId | ✅ Complete | Lines 399-427 |
| _handleWebviewMessage with panelId | ✅ Complete | Line 476 |
| _sendMessageToClaude with panelId | ⏳ In Progress | Line 655 - needs panelId param |
| _sendAndSaveMessage with panelId | ❌ Pending | Needs signature update |
| Persistent process methods | ❌ Pending | _ensurePanelProcess, etc. |
| dispose() cleanup | ❌ Pending | Multi-panel cleanup |
| Compile & Test | ❌ Pending | |

---

## Added

### New Interfaces (`src/extension.ts:76-115`)
```typescript
interface ProcessConfig {
  model: string;
  yoloMode: boolean;
  mcpConfigPath: string | undefined;
  wslEnabled: boolean;
  wslDistro: string;
  planMode: boolean;
  thinkingMode: boolean;
}

interface PanelState {
  panel: vscode.WebviewPanel;
  sessionId: string | undefined;
  chatName: string;
  conversation: Array<...>;
  // ... cost, tokens, processing state
}

interface PanelProcessInfo {
  process: cp.ChildProcess;
  config: ProcessConfig;
  rawOutput: string;
  abortController: AbortController;
}
```

### New State Variables (`src/extension.ts:204-215`)
```typescript
private _panels: Map<string, PanelState> = new Map();
private _panelProcesses: Map<string, PanelProcessInfo> = new Map();
private _activePanelId: string | undefined;
private _panelCounter: number = 0;
private _persistentProcess: cp.ChildProcess | undefined;
private _processConfig: ProcessConfig | undefined;
private _restartPending: boolean = false;
private _restartDebounceTimer: ReturnType<typeof setTimeout> | undefined;
private _persistentProcessRawOutput: string = '';
```

### New Methods
| Method | Line | Purpose |
|--------|------|---------|
| `_generatePanelId()` | 250 | Creates unique panel IDs |
| `_createPanelState()` | 258 | Initializes panel state |
| `_disposePanel(panelId)` | 279 | Cleans up specific panel |
| `_setupPanelMessageHandler()` | 388 | Panel-specific message handling |

### New Documentation
- `docs/parallel-claude-overwrite-incident.md` - Documents the code loss incident

---

## Changed

### `show()` method (lines 316-383)
- Now creates independent panels instead of reusing single panel
- Generates unique panel ID
- Stores panel in `_panels` Map
- Sets up panel-specific dispose and focus handlers

### `_postMessage()` (lines 399-427)
- Added optional `panelId` parameter
- Routes messages to specific panel or falls back to active/legacy

### `_handleWebviewMessage()` (line 476)
- Added optional `panelId` parameter
- Passes panelId to `_sendMessageToClaude`

---

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/extension.ts` | Modified | +191 lines, multi-window infrastructure |
| `docs/parallel-claude-overwrite-incident.md` | **NEW** | Documents code loss incident |
| `docs/changelog/2025-12-19-multi-window-session.md` | **NEW** | This file |

---

## Open Loops

### Incomplete Work (Must Complete Before Merge)

1. **Update `_sendMessageToClaude`** (line 655)
   - Add `panelId` parameter to signature
   - Add `effectivePanelId` logic
   - Pass panelId to all `_postMessage` and `_sendAndSaveMessage` calls

2. **Update `_sendAndSaveMessage`** (find with grep)
   - Add optional `panelId` parameter
   - Pass to `_postMessage`

3. **Add Persistent Process Methods**
   - `_buildProcessConfig()`
   - `_hasConfigChanged()`
   - `_ensurePanelProcess()`
   - `_spawnPanelProcess()`
   - `_killPanelProcess()`
   - `_setupPanelProcessHandlers()`

4. **Update `dispose()`**
   - Kill all panel processes
   - Clear all panels from Map

5. **Compile and Test**
   - `npm run compile`
   - Test with multiple windows

### Reference Implementation

The complete implementation exists in worktree:
```bash
C:\HApps\claude-code-chat\.worktrees\multi-window
# Branch: feature/multi-window-processes
# Commit: 590c9f0
```

Can copy methods from there:
```bash
git show 590c9f0:src/extension.ts | grep -A 50 "_ensurePanelProcess"
```

---

## Git State

```
Branch: feature/multi-window-safe (based on main)
Status: 191 insertions, 13 deletions (uncommitted)
Related branches:
  - feature/multi-window-processes (in .worktrees/multi-window) - full implementation
  - main - target for merge
```

---

## Resume Prompt

```
Resume multi-window implementation for Claude Code Chat.

CURRENT STATE:
- Branch: feature/multi-window-safe
- Uncommitted changes: +191 lines in src/extension.ts
- Interfaces and state variables: DONE
- Panel management methods: DONE
- _postMessage with panelId: DONE

IMMEDIATE NEXT STEPS:
1. Read src/extension.ts line 655 (_sendMessageToClaude)
2. Add panelId parameter and effectivePanelId logic
3. Update all _postMessage/_sendAndSaveMessage calls in that method
4. Find and update _sendAndSaveMessage signature
5. Add persistent process methods (copy from git show 590c9f0:src/extension.ts)
6. Update dispose() for multi-panel cleanup
7. Compile: npm run compile
8. Commit and merge to main

REFERENCE:
- Full implementation in .worktrees/multi-window (commit 590c9f0)
- Can extract methods with: git show 590c9f0:src/extension.ts | grep -A N "methodName"
```

---

## Context Manifest

Priority files for next session:
- `src/extension.ts` - Main implementation (lines 655+ need work)
- `.worktrees/multi-window/src/extension.ts` - Reference implementation
- `docs/changelog/2025-12-19-multi-window-session.md` - This file
- `docs/parallel-claude-overwrite-incident.md` - Background on code loss
