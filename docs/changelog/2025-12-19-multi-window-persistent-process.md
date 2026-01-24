# Changelog - 2025-12-19 (Multi-Window + Persistent Process Session)

## Complete Multi-Window Infrastructure with Persistent Process Support

- **Goal**: Merge panel management and persistent process methods for full multi-window support
- **Risk Level**: Med - Core messaging architecture, but additive changes only

Merged two parallel development efforts: panel management (per-panel state tracking) and persistent process mode (process reuse to eliminate startup latency). Both are now in `src/extension.ts`.

---

## Quick-Scan Summary

| Component | Before | After | Change |
|-----------|--------|-------|--------|
| Panel Management Methods | 0 | 3 | `_generatePanelId`, `_createPanelState`, `_disposePanel` |
| Persistent Process Methods | 0 | 9 | `_buildProcessConfig`, `_ensurePanelProcess`, etc. |
| Lines in extension.ts | ~3550 | ~3780 | +230 lines |

---

## ✅ No Breaking Changes

All additions are new methods. Existing `_sendMessageToClaude` signature extended with optional `panelId` parameter (backward compatible).

---

## ✅ No Environment/Dependency Changes

---

## Added

### Interfaces: `src/extension.ts:76-115`
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
  // ... per-panel conversation state
}

interface PanelProcessInfo {
  process: cp.ChildProcess;
  config: ProcessConfig;
  rawOutput: string;
  abortController: AbortController;
}
```

### State Variables: `src/extension.ts:204-215`
- `_panels: Map<string, PanelState>` - Track all open panels
- `_panelProcesses: Map<string, PanelProcessInfo>` - Process per panel
- `_activePanelId: string | undefined` - Currently focused panel
- `_panelCounter: number` - Unique ID generation

### Panel Management Methods
| Method | Line | Purpose |
|--------|------|---------|
| `_generatePanelId()` | 250 | Create unique panel IDs |
| `_createPanelState()` | 258 | Initialize per-panel state |
| `_disposePanel()` | 295 | Cleanup panel and its process |

### Persistent Process Methods
| Method | Line | Purpose |
|--------|------|---------|
| `_buildProcessConfig()` | 279 | Snapshot current settings |
| `_hasConfigChanged()` | 335 | Detect restart-triggering changes |
| `_ensurePanelProcess()` | 348 | Reuse or spawn process |
| `_spawnPanelProcess()` | 368 | Spawn with config |
| `_setupPanelProcessHandlers()` | 436 | Event handlers for stdout/stderr |
| `_handlePanelProcessMessage()` | 475 | Route messages to correct panel |
| `_postMessageToPanel()` | 498 | Send to specific panel's webview |
| `_killPanelProcess()` | 511 | Terminate panel's process |
| `_killAllPanelProcesses()` | 524 | Cleanup all (for dispose) |

## Changed

### `_sendMessageToClaude()`: `src/extension.ts:755`
- Added optional `panelId?: string` parameter for multi-window routing

### `dispose()`: `src/extension.ts:3850`
- Now calls `_killAllPanelProcesses()`
- Clears `_panels` and `_panelProcesses` Maps
- Clears `_restartDebounceTimer`

---

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/extension.ts` | Modified | +230 lines, all multi-window infrastructure |
| `CLAUDE.md` | Modified | Updated to sparse checkout workflow |

---

## Verification

**Command**: `npm run compile`
**Results**: ✅ Compiles successfully (extension + webview)

---

## Open Loops

### Not Yet Wired Up
The persistent process methods exist but `_sendMessageToClaude` still spawns per-message. Next step: modify `_sendMessageToClaude` to call `_ensurePanelProcess(panelId)` instead of `cp.spawn()` directly.

### CLAUDE.md Updated
Main now uses **Sparse Checkout Workflow** - each Claude instance only checks out files they need. See `CLAUDE.md` for new `wt add <name> <files...>` syntax.

### Git State
- Branch: `main` (37 commits ahead of origin)
- Not pushed to remote yet
- Feature branches can be cleaned up: `feature/multi-window-safe`, `feature/multi-window-processes`

---

## Resume Prompt

```
Resume multi-window persistent process integration.

CURRENT STATE:
- All infrastructure methods exist in src/extension.ts
- Methods NOT yet wired up to _sendMessageToClaude

NEXT STEPS:
1. Modify _sendMessageToClaude (line 755) to use _ensurePanelProcess(panelId)
2. Remove inline cp.spawn() call, use persistent process instead
3. Test with multiple chat panels open
4. Clean up old feature branches

VERIFICATION: npm run compile
```

---

## Context Manifest

Priority files for next session:
- `src/extension.ts:755` - `_sendMessageToClaude` needs persistent process integration
- `src/extension.ts:348` - `_ensurePanelProcess` ready to use
- `CLAUDE.md` - New sparse checkout workflow
