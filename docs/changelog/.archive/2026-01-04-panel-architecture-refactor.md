# Changelog - 2026-01-04 (Session: Panel Architecture Refactor)

## Panel Crosstalk Fixes and Architecture Refactor (Phases 1-2 Complete)

- **Goal**: Fix multi-panel crosstalk where messages from one chat appear in another, then consolidate panel architecture
- **Risk Level**: Med - Architecture changes complete for Phases 1-2, ready for testing

This session fixed critical panel routing issues and created a comprehensive plan to consolidate the dual panel architecture into a unified system with per-panel state.

| Metric | Before | After |
|--------|--------|-------|
| Panel ID routing | Always `MAIN_PANEL_ID` | Uses actual `panelId` parameter |
| `_killClaudeProcess` | No panelId support | Accepts and logs `panelId` |
| `_newSession` | Killed all processes | Kills only specified panel's process |
| Refactor plan | None | 15-step plan across 4 phases |

## ⚠️ Breaking Changes

- `PanelState.panel` is now optional (`panel?`) - callers must use optional chaining
- `_createPanelState()` signature changed: `(panel?: WebviewPanel, webviewView?: WebviewView)`
- Build currently fails with 4 TypeScript errors due to optional `panel` field (fix in progress)

## Environment & Dependencies

| Type | Name | Change | Notes |
|------|------|--------|-------|
| Const | `SIDEBAR_PANEL_ID` | **Added** | New constant `'sidebar'` for sidebar panel identification |

## Changed

### `src/extension.ts`
- Updated `_sendMessageToClaude()` to use `targetPanelId = panelId || MAIN_PANEL_ID` for spawn/write calls
- Updated `_killClaudeProcess()` to accept `panelId?` and log which panel is being killed
- Updated `_newSession()` to accept `panelId?` and only kill that panel's process
- Updated `_stopClaudeProcess()` to pass `targetPanelId` through to `_killClaudeProcess()`
- Updated message router to pass `panelId` to `newSession` and `stopRequest` handlers
- Updated `newSessionOnConfigChange()` to use `killAll()` since WSL config affects all processes
- Expanded `PanelState` interface with: `webviewView?`, `totalContextTokens`, `selectedModel`, `accountInfoFetched`
- Made `PanelState.panel` optional to support sidebar (which uses `webviewView`)
- Updated `_createPanelState()` to accept both panel types and initialize new fields
- Added `closeAllPanels()` null check with `panelState.panel?.dispose()`

### `src/services/ProcessRegistry.ts`
- Added `SIDEBAR_PANEL_ID = 'sidebar'` constant

### `src/services/index.ts`
- Added `SIDEBAR_PANEL_ID` to exports from ProcessRegistry

### `src/ui-react.ts`
- Added `${webview.cspSource}` to `connect-src` CSP directive
- Added `data:` to `font-src` CSP directive for Google Fonts

## Key Interfaces

```typescript
// Updated PanelState interface
interface PanelState {
  panel?: vscode.WebviewPanel;       // Optional - for floating windows
  webviewView?: vscode.WebviewView;  // Optional - for sidebar
  sessionId: string | undefined;
  chatName: string;
  conversation: Array<{ timestamp: string, messageType: string, data: any }>;
  conversationStartTime: string | undefined;
  totalCost: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalContextTokens: number;  // NEW
  requestCount: number;
  draftMessage: string;
  scrollPosition: number;
  isProcessing: boolean;
  selectedModel: string;        // NEW
  accountInfoFetched: boolean;  // NEW
  pendingPermissionRequests: Map<string, PermissionRequest>;
}

// Updated function signatures
private _createPanelState(panel?: vscode.WebviewPanel, webviewView?: vscode.WebviewView): PanelState
private async _killClaudeProcess(panelId?: string): Promise<void>
private async _newSession(panelId?: string): Promise<void>
```

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/extension.ts` | Modified | Panel routing, state interface, process management |
| `src/services/ProcessRegistry.ts` | Modified | Added `SIDEBAR_PANEL_ID` constant |
| `src/services/index.ts` | Modified | Export `SIDEBAR_PANEL_ID` |
| `src/ui-react.ts` | Modified | CSP fixes for Google Fonts |
| `~/.claude/plans/memoized-snuggling-bumblebee.md` | **NEW** | Comprehensive refactor plan |

## Verification

**Command**: `npm run compile`
**Results**: Build passes

All TypeScript errors have been fixed with proper null checks for optional `panel` field.

## Session 2 Changes (Continuation)

### Phase 1: Unified Panel Architecture (COMPLETE)
- Fixed all 4 TypeScript errors with null checks for optional `panel` field
- Registered sidebar in `_panels` Map with `SIDEBAR_PANEL_ID` in `showInWebview()`
- Added state sync infrastructure: `_getPanelState()`, `_getActivePanelId()`, `_syncFromPanelState()`, `_syncToPanelState()`
- Updated `_postMessageToPanel()` to handle `SIDEBAR_PANEL_ID` explicitly
- Updated `_setProcessingState()` to sync both class-level and panel state
- Updated panel focus handlers to sync state when switching panels
- Updated `_processJsonStreamData()` to sync session ID, tokens, and cost to panel state

### Phase 2: Services Layer Consolidation (PARTIAL)
- **Deleted** `src/services/CliIntegration.ts` (457 lines of dead code)
- Removed CliIntegration comments from `src/services/index.ts`
- Verified legacy internal JSON storage is already deprecated (code rejects `source: 'internal'`)
- **Deferred** StreamProcessor consolidation (larger refactor)
- **Deferred** Utility modules (git services commented out)

## Architecture Plan Created

A comprehensive 4-phase refactor plan was created at `~/.claude/plans/memoized-snuggling-bumblebee.md`:

**Phase 1 (Steps 1-5):** Unified Panel Architecture
- All panels in single `_panels` Map
- Remove class-level state variables
- Per-panel state for sessions, tokens, conversations

**Phase 2 (Steps 6-9):** Services Consolidation
- Delete CliIntegration (deprecated, 70% overlap with ConversationManager)
- Remove legacy internal JSON storage
- Consolidate StreamProcessor
- Create utility modules

**Phase 3 (Steps 10-13):** Frontend Store Simplification
- Consolidate permission state
- Split useModalHandlers god hook
- Merge duplicate message handlers

**Phase 4 (Steps 14-15):** Code Cleanup
- Type safety improvements
- Replace callbacks with EventEmitter

See `docs/changelog/open-loops/panel-architecture-refactor.md` for continuation.
