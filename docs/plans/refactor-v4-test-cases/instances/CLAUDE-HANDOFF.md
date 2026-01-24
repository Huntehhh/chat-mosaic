# Claude Instance Coordination - Handoff File

**Purpose:** Cross-Claude communication for dependencies and requests
**Protocol:** Check this file BEFORE starting work and AFTER completing each major task
**Last Updated:** 2026-01-04 (Phase 1 Complete - Final Review)

---

## IMPORTANT: Codebase Reality Check

**Before starting any phase, understand what ALREADY EXISTS:**

### Backend (src/services/)
- ✅ **ProcessManager.ts** - Graceful 3-stage shutdown, mutex protection
- ✅ **ProcessRegistry.ts** - spawn/kill/killAll/cleanupOrphanedProcesses
- ✅ **PermissionsManager.ts** - Pattern matching + C1 shell wrapper detection (DONE)
- ✅ **ConversationManager.ts** - Streaming pagination + fs.realpath upgrade (DONE)
- ⚠️ **StreamBuffer.ts** - JSON parsing (needs overflow callback - Phase 2)
- ✅ **async-mutex** - Already installed (v0.5.0)

### Frontend (src/webview/)
- ✅ **chatStore.ts** - Has pendingPermissions, pendingMessageQueue for concurrent messages
- ✅ **settingsStore.ts** - Has permissions, yoloMode, thinkingEnabled
- ✅ **tokenStore.ts** - EXTRACTED from chatStore (token/context tracking)
- ✅ **permissionStore.ts** - EXTRACTED from chatStore (permission state)
- ✅ **error-boundary.tsx** - Exists (108 lines)
- ✅ **MessageList.tsx** - Uses Virtuoso with all features
- ✅ **handlers/** - 7 handler files (well-organized)
- ✅ **messages.ts** - Typed message unions + SetThinkingEnabledRequest
- ✅ **CollapsibleContent** - Lazy loading component for large outputs
- ✅ **SearchPanel** - Conversation search UI (ready for backend service)
- ✅ **TokenDisplay** - Enhanced with context window visualization
- ✅ **ThinkIntensitySlider** - Has enable/disable toggle

### Architecture
- ⚠️ **extension.ts** - 3,091 lines (NOT refactored)
- ❌ **src/facades/** - Does NOT exist (not implemented)
- ✅ **src/services/backends/** - Backend adapter pattern exists
- ✅ **CI/CD** - .github/workflows/ci.yml exists
- ✅ **EventBus** - CREATED by Claude-3 (src/utils/EventBus.ts)
- ✅ **debounce.ts** - CREATED by Claude-3 (src/utils/debounce.ts)
- ✅ **message-text-extractor.ts** - CREATED by Claude-3 (consolidates 6 implementations)
- ✅ **utils/index.ts** - CREATED by Claude-3 (barrel export for all utilities)

---

## Instance Overview (REVISED)

| Instance | Role | Phase 1 Focus | Phase 2 Focus |
|----------|------|---------------|---------------|
| Claude-1 | Backend | C1 (shell wrapper bypass), C3/C4 security fixes | Search/Export services, logging |
| Claude-2 | Frontend | ~~Mostly done~~ - optional polish | Search/Export UI, Terminal UI |
| Claude-3 | Architecture | EventBus utility, debounce, integration tests | Service enhancements (NOT facades) |

---

## File Ownership (STRICT - No Overlap)

### Claude-1 Owns:
```
src/services/
├── ProcessManager.ts        # ✅ DONE - Graceful shutdown, imports from utils
├── ProcessRegistry.ts       # ✅ EXISTS - Has cleanupOrphanedProcesses
├── PermissionsManager.ts    # ✅ DONE - C1 shell wrapper detection with depth tracking
├── ConversationManager.ts   # ✅ DONE - C4 fs.realpath + uses message-text-extractor
├── StreamBuffer.ts          # ⚠️ Phase 2 - Needs overflow callback
├── ConversationSearchService.ts   # ❌ CREATE Phase 2
├── ExportService.ts               # ❌ CREATE Phase 2
└── index.ts                 # ✅ EXISTS

src/utils/
├── paths.ts                 # ✅ EXISTS - WSL conversion
├── shell.ts                 # ✅ EXISTS - Has isValidShellPath
├── process-control.ts       # ✅ EXISTS
├── logger.ts                # ❌ CREATE Phase 2

src/test/services/
├── PermissionsManager.test.ts  # ✅ DONE - 40+ C1 shell wrapper test cases
├── ProcessManager.test.ts      # ✅ DONE - Path validation tests
├── ProcessRegistry.test.ts     # ✅ DONE - Process lifecycle tests
src/test/mocks/
├── child_process.ts            # ✅ DONE - Mock for ProcessManager tests
```

### Claude-2 Owns:
```
src/webview/
├── stores/
│   ├── chatStore.ts          # ✅ ENHANCED - pendingMessageQueue for concurrent messages
│   ├── settingsStore.ts      # ✅ ENHANCED - thinkingEnabled state
│   ├── tokenStore.ts         # ✅ EXISTS - Extracted from chatStore
│   └── permissionStore.ts    # ✅ EXISTS - Extracted from chatStore
├── hooks/
│   ├── useVSCodeMessaging.ts # ✅ ENHANCED - messageAck + bufferOverflow + processExited handlers
│   ├── useModalHandlers.ts   # ✅ EXISTS
│   ├── useKeyboardShortcuts.ts # ❌ CREATE if needed (optional)
│   └── handlers/             # ✅ EXISTS (7 files) - useUiHandlers enhanced with stream events
├── components/
│   ├── ui/error-boundary.tsx # ✅ EXISTS
│   ├── ui/token-display.tsx  # ✅ ENHANCED - Context window visualization
│   ├── ui/collapsible-content.tsx # ✅ EXISTS - Lazy loading
│   ├── molecules/think-intensity-slider.tsx # ✅ ENHANCED - Enable toggle
│   ├── organisms/search-panel.tsx # ✅ EXISTS (ready for backend)
│   ├── organisms/chat-input.tsx # ✅ ENHANCED - Concurrent typing
│   ├── export-dialog.tsx     # ❌ CREATE Phase 2
│   └── terminal-output.tsx   # ❌ CREATE Phase 2
├── containers/
│   └── MessageList.tsx       # ✅ EXISTS - Uses Virtuoso

src/types/messages.ts         # ✅ ENHANCED - SetThinkingEnabledRequest added
```

### Claude-3 Owns:
```
src/extension.ts              # ✅ MODIFIED - Added cleanupOrphanedProcesses, dispose with timeout

# REVISED: Enhance services, don't create facades
src/services/McpService.ts    # Add event emission (Phase 2)
src/services/GitService.ts    # Add backup methods (Phase 2)
src/services/TerminalManager.ts # ✅ MODIFIED - Added closeAll, closeTerminal, dispose, tracking

src/utils/
├── EventBus.ts               # ✅ CREATED Phase 1 (opt-in event system)
├── debounce.ts               # ✅ CREATED Phase 1 (debounce/throttle/rateLimit/delay/after/once)
├── HandlerRegistry.ts        # ✅ CREATED Phase 1 (unified handler pattern)
├── message-text-extractor.ts # ✅ CREATED Phase 1 (consolidated 6 implementations)
└── index.ts                  # ✅ CREATED Phase 1 (barrel export)

src/test/integration/
├── cli-communication.test.ts # ✅ CREATED Phase 1
├── permission-flow.test.ts   # ✅ CREATED Phase 1
└── multi-panel.test.ts       # ✅ CREATED Phase 1

.github/workflows/ci.yml      # ✅ ENHANCED - Test artifacts, VSIX build job
```

---

## Requests TO Claude-1 (Backend)

### FROM Claude-3
```
[COMPLETED] REQ-3-001: Export ProcessRegistry and ProcessManager
Status: ALREADY EXISTS in services/index.ts
Resolution: No action needed
```

### FROM Claude-3
```
[COMPLETED] REQ-3-002: Ensure cleanupOrphanedProcesses() exists
Status: EXISTS in ProcessRegistry (lines 338-351)
Resolution: Verify called on startup in extension.ts
```

### FROM Claude-2
```
[PENDING] REQ-2-001: Add onBufferOverflow callback to StreamBuffer
Priority: MEDIUM (Claude-2 Phase 2)
File: src/services/StreamBuffer.ts
```

### FROM Claude-2
```
[PENDING] REQ-2-003: ConversationSearchService for Search UI
Priority: MEDIUM (Claude-2 Phase 2)
Create: src/services/ConversationSearchService.ts
```

### FROM Claude-2
```
[PENDING] REQ-2-004: ExportService for Export UI
Priority: MEDIUM (Claude-2 Phase 2)
Create: src/services/ExportService.ts
```

### FROM Claude-2
```
[PENDING] REQ-2-005: Handle setThinkingEnabled message in extension.ts
Priority: LOW (frontend-only state for now)
File: src/extension.ts
Action: Add handler for { type: 'setThinkingEnabled', enabled: boolean }
Note: Frontend already stores thinkingEnabled in settingsStore.
      Backend should persist and pass to CLI process on next message.
```

### FROM Claude-3 (NEW - Code Consolidation)
```
[COMPLETED] REQ-3-005: Replace _extractUserText with consolidated utility
Status: DONE by Claude-1
- Added import: import { extractText } from '../utils/message-text-extractor'
- Replaced 4 calls to this._extractUserText() with extractText()
- Removed 37-line private _extractUserText() method
- All 309 tests pass
```

### FROM Claude-3 (NEW - Code Consolidation)
```
[COMPLETED] REQ-3-006: Deprecate extractTextFromContent in types/shared.ts
Status: DONE by Claude-1
- Added @deprecated JSDoc to extractTextFromContent()
- Added @deprecated JSDoc to extractToolUses()
- Points to message-text-extractor utilities
```

---

## Requests TO Claude-2 (Frontend)

### FROM Claude-3
```
[COMPLETED] REQ-3-003: Handle new event messages
Status: DONE - Added bufferOverflow and processExited handlers
File: src/webview/hooks/handlers/useUiHandlers.ts (lines 78-93)
- bufferOverflow: Shows toast "Stream buffer overflow - some output may be truncated"
- processExited: Stops processing, hides overlay, shows appropriate toast
Registered in: useVSCodeMessaging.ts (lines 109-111)
```

### FROM Claude-1
```
[COMPLETED] REQ-1-001: Display buffer overflow warning
Status: DONE - Added in useUiHandlers.ts
Trigger: { type: 'bufferOverflow' } message
Shows: Toast notification (5s duration)
```

### FROM Claude-3
```
[PENDING] REQ-3-004: MCP Manager UI integration
Status: mcp-manager-panel.tsx EXISTS
May need: Wire to McpService events when implemented (Phase 2)
```

### FROM Claude-3 (Code Consolidation - REVISED)
```
[PENDING] REQ-3-007: Delete unused messageUtils.ts
Priority: LOW (dead code cleanup)
File: src/webview/lib/messageUtils.ts
Action: DELETE this file - it is NEVER imported anywhere
Note: Analysis shows this file has no imports. message-text-extractor.ts
      is the canonical utility. See "Dead Code Discovery" section below.
      Also delete: conversationUtils.ts, messageHandlers.ts (same reason)
```

---

## Requests TO Claude-3 (Architecture)

### FROM Claude-1
```
[CANCELLED] REQ-1-002: Wire services to facades
Status: CANCELLED - Using services directly, not facades
Resolution: Services are already well-structured
```

### FROM Claude-2
```
[MOSTLY DONE] REQ-2-002: Extension→Webview message types
Status: src/types/messages.ts has comprehensive types
Resolution: Add new types as needed
```

---

## Currently Being Modified

**Phase 1: ALL COMPLETE ✅** - No active modifications

<details>
<summary>Phase 1 Completed Work (click to expand)</summary>

| File | Claude | Status | Notes |
|------|--------|--------|-------|
| PermissionsManager.ts | Claude-1 | DONE | C1 shell wrapper/chaining/substitution detection with depth tracking |
| ConversationManager.ts | Claude-1 | DONE | C4 fs.realpath upgrade done |
| ProcessManager.ts | Claude-1 | DONE | Removed duplicate path functions, imports from utils |
| PermissionsManager.test.ts | Claude-1 | DONE | Extended with C1 tests (40+ new test cases) |
| ProcessManager.test.ts | Claude-1 | DONE | Created with path validation tests |
| ProcessRegistry.test.ts | Claude-1 | DONE | Created with process lifecycle tests |
| child_process.ts mock | Claude-1 | DONE | Created for ProcessManager tests |
| useVSCodeMessaging.ts | Claude-2 | DONE | Removed ghost handlers (checkpointsList, customSnippetsData), added bufferOverflow/processExited |
| useUiHandlers.ts | Claude-2 | DONE | Added bufferOverflow + processExited handlers with toast notifications |
| useChatHandlers.ts | Claude-2 | DONE | Removed dead permissionsList/permissionsData handlers (now only in useUiHandlers) |
| tokenStore.ts | Claude-2 | DONE | Added architecture note for Phase 2 migration path |
| src/extension.ts | Claude-3 | DONE | Added cleanupOrphanedProcesses + dispose() with 5s timeout |
| src/services/TerminalManager.ts | Claude-3 | DONE | Added closeAll, closeTerminal, dispose, terminal tracking |
| src/utils/EventBus.ts | Claude-3 | DONE | Created opt-in event system with emitAsync |
| src/utils/debounce.ts | Claude-3 | DONE | Created debounce/throttle/rateLimit/delay/after/once |
| src/utils/message-text-extractor.ts | Claude-3 | DONE | Consolidated 6 implementations |
| src/utils/index.ts | Claude-3 | DONE | Created barrel export for all utilities |
| src/utils/HandlerRegistry.ts | Claude-3 | DONE | Created unified handler registration pattern |
| src/test/integration/*.ts | Claude-3 | DONE | Created cli-communication, permission-flow, multi-panel tests |
| .github/workflows/ci.yml | Claude-3 | DONE | Enhanced with test artifacts, VSIX build job |

</details>

---

## BLOCKING ISSUES (Require Fix Before Compile)

### FROM Claude-1 TO Claude-3
```
[FIXED] permission-flow.test.ts has API mismatches with PermissionsManager
Status: Claude-3 fixed - updated test to use correct PermissionsManager API
- Constructor now uses 2 args (context, callbacks)
- Uses actual PermissionRequest interface
- Tests actual methods: isCommandBlocked, addPendingRequest, etc.
```

### FROM Claude-1 TO Claude-3
```
[FIXED] utils/index.ts had duplicate normalizePathForOS export
Status: Claude-1 fixed duplicate export (removed from claude-args, kept in paths)
```

### FROM Claude-1 (Fixed in passing)
```
[FIXED] TerminalManager.ts exec() calls had incorrect shell: true option
Status: Claude-1 fixed - removed { shell: true } from exec() calls (lines 478, 492)
Note: This was blocking compilation due to TypeScript overload mismatch
```

---

## What's Actually Installed

```json
{
  "dependencies": {
    "async-mutex": "^0.5.0"  // ✅ Already in use by ProcessManager
  },
  "devDependencies": {
    "@types/mocha": "^10.0.10",
    "@vscode/test-cli": "^0.0.10",
    "@vscode/test-electron": "^2.5.2"
  }
}
```

**NOT installed (add if needed):**
- `proper-lockfile` - For file locking (Phase 2)

---

## Testing Reality

**Framework:** VS Code Native Testing (NOT Vitest)
**Command:** `npm test`
**Config:** `.vscode-test.mjs`

**Existing tests (Phase 1 Complete):**
- `src/test/extension.test.ts`
- `src/test/services/StreamBuffer.test.ts`
- `src/test/services/PermissionsManager.test.ts` (40+ test cases)
- `src/test/services/ConversationManager.test.ts`
- `src/test/services/ProcessManager.test.ts` ✅ CREATED
- `src/test/services/ProcessRegistry.test.ts` ✅ CREATED
- `src/test/integration/cli-communication.test.ts` ✅ CREATED
- `src/test/integration/permission-flow.test.ts` ✅ CREATED
- `src/test/integration/multi-panel.test.ts` ✅ CREATED
- `src/test/mocks/vscode.ts` (comprehensive)
- `src/test/mocks/child_process.ts` ✅ CREATED

**Potential additions (Phase 2):**
- Unit tests for utils (EventBus, debounce, HandlerRegistry)
- More integration test coverage

---

## Priority Order for All Claudes

### HIGH Priority (Phase 1) - ALL COMPLETE ✅
1. **CLAUDE-1:** ~~C1 shell wrapper bypass prevention~~ ✅ DONE
2. **CLAUDE-1:** ~~C3 apply isValidShellPath to config paths~~ ✅ ALREADY DONE
3. **CLAUDE-1:** ~~C4 upgrade to fs.realpath~~ ✅ DONE
4. **CLAUDE-2:** ~~Delete src/ui/ dead code (94+ files)~~ ✅ DONE
5. **CLAUDE-2:** ~~Remove duplicate handlers~~ ✅ DONE
6. **CLAUDE-2:** ~~Enhance TokenDisplay with context window~~ ✅ DONE
7. **CLAUDE-2:** ~~Add ThinkIntensitySlider enable toggle~~ ✅ DONE
8. **CLAUDE-2:** ~~Enable concurrent typing in chat-input~~ ✅ DONE
9. **CLAUDE-2:** ~~Add pendingMessageQueue to chatStore~~ ✅ DONE
10. **CLAUDE-2:** ~~Add messageAck handler~~ ✅ DONE
11. **CLAUDE-2:** ~~Export SearchPanel, ThinkingIntensityModal~~ ✅ DONE
12. **CLAUDE-3:** ~~Create EventBus.ts (opt-in utility)~~ ✅ DONE
13. **CLAUDE-3:** ~~Create debounce.ts utilities~~ ✅ DONE
14. **CLAUDE-3:** ~~Create message-text-extractor.ts~~ ✅ DONE (consolidated 6 implementations)
15. **CLAUDE-3:** ~~Delete src/_legacy/ dead code~~ ✅ DONE
16. **CLAUDE-3:** ~~Add cleanupOrphanedProcesses on startup~~ ✅ DONE
17. **CLAUDE-3:** ~~Create HandlerRegistry utility pattern~~ ✅ DONE
18. **CLAUDE-3:** ~~Add TerminalManager closeAll/dispose methods~~ ✅ DONE
19. **CLAUDE-3:** ~~Ensure async dispose() with 5s timeout~~ ✅ DONE
20. **CLAUDE-3:** ~~Create integration test scaffolding~~ ✅ DONE
21. **CLAUDE-3:** ~~Enhance CI/CD pipeline~~ ✅ DONE

### MEDIUM Priority (Phase 2)
1. **CLAUDE-1:** ConversationSearchService
2. **CLAUDE-1:** ExportService
3. **CLAUDE-2:** SearchPanel component
4. **CLAUDE-2:** ExportDialog component
5. **CLAUDE-3:** Enhance McpService with events
6. **CLAUDE-3:** Add more comprehensive integration tests

---

## Dead Code Discovery (Claude-3 Analysis - 2026-01-04)

**Files NOT imported anywhere (candidates for deletion):**

### Backend Dead Code
```
src/utils/message-utils.ts (31 lines)
- Exports: extractMessageText, getMessageContent
- Status: Exported in utils/index.ts but NEVER imported
- Recommendation: DELETE (superseded by message-text-extractor.ts)
```

### Frontend Dead Code (webview/lib/)
```
src/webview/lib/messageUtils.ts (130+ lines)
- Exports: getMessageText, formatMessage, etc.
- Status: NEVER imported anywhere in webview
- Recommendation: DELETE (superseded by message-text-extractor.ts)

src/webview/lib/conversationUtils.ts (217 lines)
- Exports: formatConversationsForHistory, groupConversationsByDate, etc.
- Status: NEVER imported - was created but never integrated
- Recommendation: Review for usefulness, then DELETE or integrate

src/webview/lib/messageHandlers.ts (118 lines)
- Exports: registerHandler, handleMessage, etc.
- Status: NEVER imported - similar to HandlerRegistry
- Recommendation: DELETE (superseded by utils/HandlerRegistry.ts)
```

**Note:** These files may have been created during development but never wired in.
Consider deleting in Phase 2 cleanup or integrating if still useful.

---

## Phase 1 Summary - COMPLETE ✅

**All 21 HIGH priority items completed across all Claude instances.**

| Instance | Items Completed | Key Deliverables |
|----------|-----------------|------------------|
| Claude-1 | 3 | Shell wrapper detection, fs.realpath upgrade, security fixes |
| Claude-2 | 8 | UI enhancements, handler cleanup, store improvements |
| Claude-3 | 10 | Utilities (EventBus, debounce, HandlerRegistry), integration tests, CI/CD |

**Code Review Fixes Applied:**
- HandlerRegistry: Fixed array mutation during iteration
- TerminalManager: Fixed memory leak in pollInterval
- debounce: Fixed double-fire bug, optimized rateLimit to O(1)
- EventBus: Added max listener warning, improved emitAsync error reporting

**Compilation Status:** ✅ Passing
**All BLOCKING issues:** ✅ Resolved

---

## End of Phase Checklist

Before finishing your phase:
- [ ] All `[BLOCKING]` requests TO you completed
- [ ] Updated requests you completed to `[COMPLETED]`
- [ ] Removed files from "Currently Being Modified"
- [ ] Ran `npm run compile` successfully
- [ ] Tests pass (`npm test`)
- [ ] Updated this handoff file with any new dependencies or requests
