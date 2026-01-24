# Changelog - 2025-12-19 (Persistent Process Mode Session)

## Persistent Claude Process Mode with Multi-Window Support

- **Goal**: Keep Claude CLI process alive between messages to eliminate startup latency, with auto-restart on config changes
- **Risk Level**: Med - Core messaging architecture change, but isolated to extension.ts

Implemented persistent process mode to avoid respawning Claude CLI for each message. Also identified need for multi-window support where each VS Code chat window gets its own independent process.

---

## ⚠️ CRITICAL: Code Was Overwritten

The persistent process implementation (commit `ec3b32f`) was **overwritten by another Claude instance's later commits**. The code needs to be re-implemented.

```bash
# The original commit still exists in history:
git show ec3b32f:src/extension.ts | grep "_ensurePersistentProcess"  # Shows 6 matches
git show HEAD:src/extension.ts | grep "_ensurePersistentProcess"     # Shows 0 matches
```

The overwriting occurred in commit `9c5a386` ("Fix settings update and CLI tool display").

---

## ✅ What Was Implemented (Now Lost)

### ProcessConfig Interface
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
```

### State Variables Added
```typescript
private _persistentProcess: cp.ChildProcess | undefined;
private _processConfig: ProcessConfig | undefined;
private _restartPending: boolean = false;
private _restartDebounceTimer: ReturnType<typeof setTimeout> | undefined;
private _persistentProcessRawOutput: string = '';
```

### Key Methods Implemented
| Method | Purpose |
|--------|---------|
| `_buildProcessConfig()` | Snapshot current settings |
| `_hasConfigChanged()` | Detect restart-triggering changes |
| `_ensurePersistentProcess()` | Reuse or spawn process |
| `_spawnPersistentProcess()` | Spawn with handlers |
| `_setupPersistentProcessHandlers()` | Event handlers (no stdin.end on result) |
| `_killPersistentProcess()` | Graceful termination |
| `_scheduleProcessRestart()` | Debounced restart (300ms) |
| `_restartPersistentProcess()` | Execute restart with toast |
| `_onPersistentMessageComplete()` | Handle result without closing stdin |
| `_preSpawnPersistentProcess()` | Pre-spawn on extension activation |

### Settings Handlers Modified
These were updated to call `_scheduleProcessRestart()`:
- `_setSelectedModel()` - Model changes
- `_enableYoloMode()` - YOLO mode toggle
- `_saveMCPServer()` - MCP config add/update
- `_deleteMCPServer()` - MCP config removal

### Toast Notification System
- Added `toast` state to `src/webview/stores/uiStore.ts`
- Created `src/webview/components/atoms/toast.tsx`
- Added handler in `src/webview/hooks/useVSCodeMessaging.ts`

---

## Open Loops

### Known Issue: Single Process per VS Code Window
Current architecture uses ONE `ClaudeChatProvider` instance with ONE `_persistentProcess`. If user opens multiple chat panels, they share the same process.

**Required Fix**: Each panel needs its own process:
```typescript
// Instead of:
private _persistentProcess: cp.ChildProcess | undefined;

// Need:
private _panelProcesses: Map<string, {
  process: cp.ChildProcess;
  config: ProcessConfig;
  sessionId: string;
}> = new Map();
```

### Worktree Created (Not Used)
```bash
# Fresh worktree exists at:
C:\HApps\claude-code-chat\.worktrees\multi-window

# On branch:
feature/multi-window-processes
```

---

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/extension.ts` | Needs changes | Re-implement persistent process + multi-window |
| `src/webview/stores/uiStore.ts` | May need restore | Toast state was added |
| `src/webview/components/atoms/toast.tsx` | Check if exists | Toast component |
| `src/webview/hooks/useVSCodeMessaging.ts` | May need restore | Toast message handler |

---

## Remaining TODOs

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Create panel tracking Map | Pending | Replace `_panel: WebviewPanel` with `_panels: Map<string, WebviewPanel>` |
| 2 | Create process tracking Map | Pending | Each panel ID maps to its own `cp.ChildProcess` |
| 3 | Update `show()` method | Pending | Create independent panels instead of reusing single panel |
| 4 | Update `_sendMessageToClaude` | Pending | Route to correct process based on active panel |
| 5 | Update cleanup/dispose | Pending | Kill all processes, clear all panels |
| 6 | Re-implement persistent process methods | Pending | Restore from commit `ec3b32f` or rewrite |
| 7 | Compile and test | Pending | Verify with multiple windows |

---

## Architecture: Multi-Window Design

```
┌─────────────────────────────────────────────────────────────┐
│                    ClaudeChatProvider                        │
│                                                              │
│  _panels: Map<panelId, WebviewPanel>                        │
│  _panelProcesses: Map<panelId, {                            │
│      process: ChildProcess,                                  │
│      config: ProcessConfig,                                  │
│      sessionId: string,                                      │
│      rawOutput: string                                       │
│  }>                                                          │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Panel A  │  │ Panel B  │  │ Sidebar  │                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       │             │             │                          │
│       ▼             ▼             ▼                          │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐                   │
│  │Claude A │   │Claude B │   │Claude C │  (3 processes)    │
│  └─────────┘   └─────────┘   └─────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Resume Prompt

Paste this to continue:

```
Resume persistent process mode implementation for Claude Code Chat extension.

CONTEXT:
- Original implementation was in commit ec3b32f but got overwritten
- Need to re-implement AND add multi-window support
- Worktree exists at: .worktrees/multi-window (branch: feature/multi-window-processes)

IMMEDIATE ACTIONS:
1. cd to worktree: cd "C:\HApps\claude-code-chat\.worktrees\multi-window"
2. Check if toast.tsx exists, restore if needed
3. Re-implement persistent process methods in extension.ts
4. Add multi-window support with Map<panelId, process>

KEY FILES:
- src/extension.ts - Main implementation
- src/webview/stores/uiStore.ts - Toast state
- src/webview/components/atoms/toast.tsx - Toast component
- src/webview/hooks/useVSCodeMessaging.ts - Toast handler

REFERENCE COMMIT: git show ec3b32f:src/extension.ts
```

---

## Context Manifest

Priority files for next session:
- `src/extension.ts` - Main changes needed (lines 113-160 for state, ~530 for _sendMessageToClaude)
- `git show ec3b32f:src/extension.ts` - Reference for lost implementation
- `.worktrees/multi-window/` - Fresh worktree to work in
- `docs/changelog/2025-12-19-persistent-process-session.md` - This file
