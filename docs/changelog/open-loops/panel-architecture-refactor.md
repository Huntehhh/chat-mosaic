# Panel Architecture Refactor
Created: 2026-01-04 (Session: Panel Architecture Refactor)
Status: ready-for-testing (bug fix applied)

## Context
Multi-panel crosstalk was occurring because all processes were spawning with `MAIN_PANEL_ID` instead of actual panel IDs. A larger architectural issue was discovered: state is shared globally instead of per-panel.

## Completed Work (Phases 1-2)

### Phase 1: Unified Panel Architecture
- [x] Step 1: Expanded `PanelState` interface with all per-panel fields
- [x] Step 2: Registered sidebar in `_panels` Map with `SIDEBAR_PANEL_ID`
- [x] Step 3: Added state sync infrastructure (`_syncFromPanelState`, `_syncToPanelState`)
- [x] Step 4: Updated `_processJsonStreamData` to sync panel state (session, tokens, cost)
- [x] Step 5: Updated panel focus handlers to sync state when switching panels

### Phase 2: Services Layer Consolidation
- [x] Step 6: Deleted `CliIntegration.ts` (dead code, 70% overlap with ConversationManager)
- [x] Step 7: Verified legacy internal JSON storage is already deprecated
- [ ] Step 8: StreamProcessor consolidation (DEFERRED - larger refactor)
- [ ] Step 9: Create utility modules (DEFERRED - git services commented out)

## Bug Fix Applied (Session 2 Continuation)

**Root cause identified**: All `_sendAndSaveMessage` and `_postMessage` calls in `_processJsonStreamData` were missing the `panelId` parameter. This caused messages to route to the "active" panel instead of the panel that owns the process.

**Fix applied**:
- Updated all `_sendAndSaveMessage({...})` calls to `_sendAndSaveMessage({...}, panelId)`
- Updated all `_postMessage({...})` calls to `_postMessageToPanel(panelId, {...})`
- Fixed `_sendMessageToClaude` to use `targetPanelId` for all its messages
- Added panel-specific conversation lookup in `case 'user'` for tool results

## Current State
**Build status**: PASSING

**Key changes:**
- Sidebar now registered in `_panels` Map with `SIDEBAR_PANEL_ID`
- Panel state syncs when switching between panels
- Token/cost/session updates go to both class-level and panel-specific state
- Deleted 457 lines of dead code (CliIntegration.ts)

## Test Cases
1. Open two floating panels, send message to each - responses should go to correct panel
2. Open sidebar + floating panel - both should work independently
3. Close one panel - other should continue working
4. Switch focus between panels - token counts should update correctly

## Resume Prompt (if testing reveals issues)
```
Review panel architecture refactor at docs/changelog/open-loops/panel-architecture-refactor.md

Key files:
- src/extension.ts - Panel state, sync methods, message routing
- ~/.claude/plans/memoized-snuggling-bumblebee.md - Full 15-step plan

Phase 1-2 complete. If crosstalk still occurs, check:
1. Is panelId being passed to _sendMessageToClaude?
2. Is _processJsonStreamData receiving correct panelId from ProcessRegistry?
3. Are panel state updates syncing to the _panels Map?
```

## Remaining Work (Phases 3-4)
- Phase 3: Frontend store simplification
- Phase 4: Code cleanup (type safety, EventEmitter pattern)

## Relevant Files
- `src/extension.ts` - Main file with PanelState interface and routing logic
- `src/services/ProcessRegistry.ts` - SIDEBAR_PANEL_ID constant
- `src/services/index.ts` - Removed CliIntegration exports
- `~/.claude/plans/memoized-snuggling-bumblebee.md` - Full 15-step refactor plan
