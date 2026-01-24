# Regression & Missing Feature Analysis Report

> **Date**: 2026-01-02
> **Analyst**: Claude Opus 4.5
> **Reviewers**: Gemini 3 Pro, Grok 4.1 Fast (via Zen MCP consensus)
> **Scope**: Comparison of documented features vs. actual codebase implementation
> **Files Analyzed**: 22 Markdown docs + 76 TypeScript/TSX files

---

## Executive Summary

After thorough analysis of the documentation against the current codebase, significant gaps exist where documented features were either never fully integrated or are missing entirely. This document catalogs everything that needs to be updated or added back based on the changelogs and refactor documentation.

**Total Issues Identified**: 32 items across P0/P1/P2 priorities

---

## 🚨 CRITICAL - P0 (Must Fix Immediately) [8 Items]

### 1. StreamProcessor Not Integrated
**Status**: ❌ EXTRACTED BUT NOT USED
**Source**: `modularization-plan-2025-12-28.md`, `03-PERFORMANCE-IMPROVEMENTS.md`

- **Documented**: `StreamProcessor.ts` was created to handle JSON stream parsing with brace-aware buffering
- **Reality**: `extension.ts` still uses naive `split('\n')` parsing at lines 579 and 1143
- **Files affected**:
  - `src/extension.ts:579` - `const lines = processInfo.rawOutput.split('\n')`
  - `src/extension.ts:1143` - `const lines = rawOutput.split('\n')`
- **Impact**: Multi-line JSON from Claude CLI corrupts, causing parse errors
- **The Fix**: Replace all `split('\n')` with `StreamBuffer.append()` or use `StreamProcessor`

### 2. No Zod Validation in Extension.ts
**Status**: ❌ NOT IMPLEMENTED
**Source**: `01-TECHNICAL-DEBT-AND-BUGS.md`, `03-ARCHITECTURE-ROADMAP.md`

- **Documented**: Full Zod validation for CLI output parsing with schema definitions
- **Reality**: Zero `safeParse` calls in `extension.ts` (verified via grep)
- **Schemas needed**: `UserMessageSchema`, `AssistantMessageSchema`, `ToolUseSchema`, `ToolResultSchema`
- **Impact**: CLI schema changes crash the extension silently
- **The Fix**: Add Zod validation to `_handleProcessStdout` and `_processJsonStreamData`

### 3. setThinkingIntensity Backend Call Missing
**Status**: ❌ NOT WIRED UP
**Source**: `changelog/2025-12-27-session-16.md`

- **Documented**: `setThinkingIntensity` should call backend to write to `~/.claude/settings.json`
- **Reality**:
  - `useVSCodeSender()` doesn't export `setThinkingIntensity`
  - `extension.ts` contains NO method named `_setThinkingIntensity`
  - No handler registered in `_initializeMessageRouter`
- **Impact**: Changing the slider updates UI state but does NOTHING to the actual Claude process or config file

### 4. "Ghost" TerminalManager - Services Not Connected
**Status**: ❌ EXTRACTED BUT ORPHANED
**Source**: `modularization-plan-2025-12-28.md`, Session 17 changelog

- **Documented**: Session 17 claims `_handleLoginRequired`, `_openModelTerminal`, etc. were replaced to use `this._terminalManager`
- **Reality**: `extension.ts` (lines 1618, 4162, 4199) still manually implements `vscode.window.createTerminal`
- **Impact**: The "Terminal Path Fix" (Session 17) which standardized CWD paths is NOT active

### 5. Logic Duplication - Zombie Code in Extension.ts
**Status**: ❌ DEAD CODE NOT DELETED
**Source**: `modularization-plan-2025-12-28.md`, Session 18 changelog

- **Documented**: Session 18 claims `_openMCPTerminal` (~103 lines) and `_processJsonStreamData` (~328 lines) were deleted
- **Reality**: They are still present in `extension.ts`:
  - `_processJsonStreamData` exists at line 1225 (~316 lines)
  - MCP terminal logic persists in `_executeSlashCommand`
- **Impact**: ~450 lines of zombie code. Bug fixes applied to `StreamProcessor.ts` are ignored

### 6. MCP Terminal Restart Not Killing Process
**Status**: ❌ NOT WORKING
**Source**: `changelog/2025-12-27-session-16.md`

- **Documented**: MCP terminal close should kill and restart the background process
- **Reality**: The panelId capture mechanism may be stale - process kill may target wrong panel
- **Impact**: MCP config changes don't apply until full VS Code restart

### 7. TerminalManager.updateConfig() Never Called
**Status**: ❌ STALE CONFIG
**Source**: `docs/plans/.archive/file-open-relocation.md`

- **Documented**: `TerminalManager.updateConfig()` exists at line 65-67
- **Reality**: `newSessionOnConfigChange()` doesn't call it - config set once at activation, never updated
- **Files**: `extension.ts:1415-1432`, `TerminalManager.ts:65-67`
- **Impact**: Terminal commands use stale CWD after workspace changes, PowerShell wrapper skipped

### 8. No Graceful Process Shutdown
**Status**: ❌ NOT IMPLEMENTED
**Source**: `01-TECHNICAL-DEBT-AND-BUGS.md` (Section 2.2)

- **Documented**: Process kill should try stdin shutdown before SIGTERM/SIGKILL
- **Reality**: `ProcessManager.kill()` jumps straight to SIGTERM
- **Code Location**: `ProcessManager.ts:194-236`
- **Impact**: File locks and orphan processes possible

---

## 🔶 HIGH PRIORITY - P1 (Should Fix Soon) [12 Items]

### 9. No Accessibility - Focus Traps & ARIA Labels
**Status**: ❌ NOT IMPLEMENTED
**Source**: `04-GENERAL-IMPROVEMENTS.md`, upgraded to P0 in Session 3

- **Documented**: All 6+ modals need focus traps and ARIA labels
- **Reality**:
  - No `useFocusTrap` hook exists
  - Zero files contain `aria-modal` or `aria-labelledby`
- **Files needing fixes**: `settings-modal.tsx`, `mcp-servers-modal.tsx`, `slash-commands-modal.tsx`, `model-selector-modal.tsx`, `thinking-intensity-modal.tsx`, `history-panel.tsx`

### 10. No ErrorBoundary Component
**Status**: ❌ NOT IMPLEMENTED
**Source**: `03-ARCHITECTURE-ROADMAP.md`

- **Documented**: Required for React.lazy modal loading
- **Reality**: No `ErrorBoundary` component exists in codebase
- **Impact**: Webview crashes completely on component load failures

### 11. No React.lazy/Suspense Usage
**Status**: ❌ NOT IMPLEMENTED
**Source**: `03-PERFORMANCE-IMPROVEMENTS.md` (Section 9)

- **Documented**: Lazy load modals for faster initial render
- **Reality**: Zero React.lazy or Suspense imports in webview code
- **Impact**: All components loaded upfront, slower startup

### 12. No Event-Driven Architecture (EventBus)
**Status**: ⚠️ PARTIALLY IMPLEMENTED
**Source**: `03-ARCHITECTURE-ROADMAP.md`

- **Documented**: Use EventEmitter/EventBus for decoupled communication
- **Reality**: Only `ClaudeBackend.ts` uses EventEmitter - not used in main extension.ts
- **Impact**: Tight coupling between services

### 13. No Unit Test Framework
**Status**: ❌ NOT IMPLEMENTED
**Source**: `03-ARCHITECTURE-ROADMAP.md` (Success Metrics)

- **Documented**: Vitest + MSW framework with 80% coverage target
- **Reality**: Only one basic test file exists (`extension.test.ts`)
- **Impact**: Cannot safely refactor without breaking things

### 14. Multi-Panel Process Race Condition
**Status**: ❌ NOT ADDRESSED
**Source**: `04-ADDENDUM-MISSING-ITEMS.md` (Section 5)

- **Documented**: When multiple panels exist, `_sendMessageToPanel` can race with process spawn/kill
- **Reality**: No mutex or lock around process operations
- **Code Location**: `extension.ts:1052-1062`
- **Fix**: Add `async-mutex` for process operations
- **Impact**: Messages may go to wrong process or get lost

### 15. Conversation Index Corruption
**Status**: ❌ NOT ADDRESSED
**Source**: `04-ADDENDUM-MISSING-ITEMS.md` (Section 6)

- **Documented**: `_conversationIndex` can corrupt on simultaneous saves or crashes
- **Reality**: No atomic write or recovery mechanism
- **Fix**: Use temp file + atomic rename pattern
- **Impact**: Lost conversation history

### 16. Type Desynchronization Risk
**Status**: ❌ NOT ADDRESSED
**Source**: `04-ADDENDUM-MISSING-ITEMS.md` (Section 1)

- **Documented**: Create unified type system with single source of truth
- **Reality**: Type definitions duplicated between `extension.ts` (inline) and frontend (`types/messages.ts`)
- **Impact**: Changing message payload in extension breaks frontend silently until runtime

### 17. Non-JSON Stdout Fallback Missing
**Status**: ❌ NOT IMPLEMENTED
**Source**: `03-PERFORMANCE-IMPROVEMENTS.md` (Session 3 Updates)

- **Documented**: Claude CLI occasionally outputs non-JSON (progress indicators, raw errors)
- **Reality**: StreamBuffer brace-counting ignores text not wrapped in `{}`
- **Impact**: Users miss critical startup errors or crash notifications
- **Fix**: Add raw text fallback with 1-second timeout

### 18. No Hardcoded Deny List
**Status**: ❌ NOT IMPLEMENTED
**Source**: `01-TECHNICAL-DEBT-AND-BUGS.md` (Section 4.2)

- **Documented**: Block dangerous commands like `rm -rf /`, `sudo rm`, fork bombs
- **Reality**: Dangerous commands can be auto-approved if user creates broad patterns
- **Code Location**: `PermissionsManager.ts`
- **Impact**: Security vulnerability

### 19. No Audit Logging
**Status**: ❌ NOT IMPLEMENTED
**Source**: `01-TECHNICAL-DEBT-AND-BUGS.md` (Section 4.3)

- **Documented**: Log permission decisions to JSONL file for debugging/compliance
- **Reality**: No record of `approved`, `denied`, or `auto-approved` actions
- **Impact**: Cannot debug permission issues or maintain compliance

### 20. No Heartbeat/Zombie Process Detection
**Status**: ❌ NOT IMPLEMENTED
**Source**: `01-TECHNICAL-DEBT-AND-BUGS.md` (Section 2.1)

- **Documented**: Add heartbeat monitoring to detect unresponsive processes
- **Reality**: Process only checked when explicitly killed
- **Code Location**: `ProcessManager.ts`
- **Fix**: Add 30-second heartbeat with adaptive timeout during "thinking"
- **Impact**: Zombie processes consume resources undetected

---

## 🟡 MEDIUM PRIORITY - P2 (Should Plan For) [12 Items]

### 21. MessageList Virtualization
**Status**: ❌ NOT IMPLEMENTED
**Source**: `03-PERFORMANCE-IMPROVEMENTS.md` (Section 4)

- **Documented**: Use react-virtuoso for 1000+ message handling
- **Reality**: No `react-virtuoso` or `react-window` imports found
- **Impact**: Performance degradation with long conversations

### 22. Storage Consolidation Not Done
**Status**: ❌ NOT IMPLEMENTED
**Source**: `refactor-v3/jsonl-consolidation/storage-consolidation-analysis.md`

- **Documented**: Use JSONL as single source of truth, append-only writes
- **Reality**: Still writing full JSON conversations (O(N) instead of O(1))
- **Impact**: Wasted disk space, sync issues, slower saves

### 23. LRU Cache for DiffContentProvider
**Status**: ❌ NOT IMPLEMENTED
**Source**: `03-PERFORMANCE-IMPROVEMENTS.md` (Section 5)

- **Documented**: Add LRU cache with 50-item limit
- **Reality**: Still using unbounded `Map<string, string>`
- **Code Location**: `extension.ts:12`
- **Impact**: Memory leaks during long sessions

### 24. Dependency Injection Pattern
**Status**: ❌ NOT IMPLEMENTED
**Source**: `03-ARCHITECTURE-ROADMAP.md`

- **Documented**: Constructor injection for testability
- **Reality**: All services constructed internally in `ClaudeChatProvider`
- **Impact**: Cannot unit test without mocking entire VS Code API

### 25. Zustand Atomic Selectors
**Status**: ❌ NOT IMPLEMENTED
**Source**: `04-ADDENDUM-MISSING-ITEMS.md` (Section 4)

- **Documented**: Use atomic selectors for surgical re-renders
- **Reality**: `App.tsx` pulls entire state causing re-renders on any store change
- **Impact**: 60-80% unnecessary re-renders in complex components

### 26. WSL Path Edge Cases
**Status**: ❌ NOT ADDRESSED
**Source**: `04-ADDENDUM-MISSING-ITEMS.md` (Section 7)

- **Documented**: Handle UNC paths, special characters, double-conversion
- **Reality**: Current `convertToWSLPath()` only handles simple `C:\` paths
- **Code Location**: `extension.ts`
- **Impact**: WSL path failures on complex paths

### 27. Legacy JSON File Compatibility
**Status**: ❌ NOT IMPLEMENTED
**Source**: `03-PERFORMANCE-IMPROVEMENTS.md` (Session 3 Updates)

- **Documented**: Dual-mode reader to support both JSON and JSONL formats
- **Reality**: Switching to JSONL would break existing `.json` conversation histories
- **Fix**: Detect format by first character (`[` = JSON, else JSONL)

### 28. JSONL Race Condition
**Status**: ❌ NOT ADDRESSED
**Source**: `03-PERFORMANCE-IMPROVEMENTS.md` (Session 3 Updates)

- **Documented**: Append-only JSONL has race condition during snapshot creation
- **Fix**: Use atomic rename pattern (write temp → rename → truncate active)
- **Impact**: Data corruption during concurrent access

### 29. Unified CacheService
**Status**: ❌ NOT IMPLEMENTED
**Source**: `03-PERFORMANCE-IMPROVEMENTS.md` (Conflict Resolution)

- **Documented**: Multiple caching strategies (LRU for diffs, TTL for index) should use unified service
- **Reality**: Each cache implemented separately
- **Impact**: Complex cache invalidation logic

### 30. CliIntegration Service Not Extracted
**Status**: ❌ NOT DONE
**Source**: `modularization-plan-2025-12-28.md` (Track B.2)

- **Documented**: Extract `_scanCLIConversations()`, `_loadCLIConversation()` (~200 lines)
- **Reality**: Still in `extension.ts`
- **Impact**: extension.ts remains bloated

### 31. SettingsManager Service Not Extracted
**Status**: ❌ NOT DONE
**Source**: `modularization-plan-2025-12-28.md` (Track B.3)

- **Documented**: Extract `_sendCurrentSettings()`, `_updateSettings()`, etc. (~300 lines)
- **Reality**: Still in `extension.ts`
- **Impact**: extension.ts remains bloated

### 32. Frontend messageHandlers.ts Split Incomplete
**Status**: ❌ NOT DONE
**Source**: `modularization-plan-2025-12-28.md` (Track C)

- **Documented**: Split 613-line file into 6 domain handler files with registry pattern
- **Reality**: Handlers in hooks/handlers but messageHandlers.ts still large
- **Target**: messageHandlers.ts reduced to ~100 lines with handler registry

---

## ✅ IMPLEMENTED (Working)

The following documented features ARE implemented:

| Feature | Status | Files |
|---------|--------|-------|
| Frontend handler split | ✅ | 7 handler files in `src/webview/hooks/handlers/` |
| Service extraction | ✅ | 17 services in `src/services/` |
| Thinking intensity slider (UI) | ✅ | `think-intensity-slider.tsx`, `thinking-intensity-modal.tsx` |
| PinnedContextShelf | ✅ | `pinned-context-shelf.tsx` (UI only, no backend) |
| PermissionBanner | ✅ | `permission-banner.tsx` |
| FileDiffView | ✅ | `file-diff-view.tsx`, `diff-view.tsx` |
| StreamingCursor | ✅ | `streaming-cursor.tsx` |
| ToolOutputSkeleton | ✅ | `tool-output-skeleton.tsx` |
| ThinkingBlock | ✅ | `thinking-block.tsx` |
| CollapsibleCard | ✅ | `collapsible-card.tsx` |
| PixelLoader | ✅ | `pixel-loader.tsx` |
| MCP Editor UI | ✅ | `mcp-editor-form.tsx`, `mcp-server-list.tsx` |
| Image sending | ✅ | In `sendMessage()` with images parameter |
| buildClaudeArgs utility | ✅ | `src/utils/claude-args.ts` |
| ClaudeSpawnConfig | ✅ | `src/utils/spawn-config.ts` |

---

## Implementation Priority Order

```
Phase 0 (IMMEDIATE - Re-Integration Crisis)
├─ RE-WIRE extension.ts to use extracted services:
│   ├─ Delete _processJsonStreamData (lines 1225-1541)
│   │   └─ Replace with: this._streamProcessor.processJson(data)
│   ├─ Delete manual terminal creation in _handleLoginRequired
│   │   └─ Replace with: this._terminalManager.openLoginTerminal()
│   └─ Sync _handleProcessStdout to delegate to StreamProcessor
├─ Fix JSON stream parsing (replace split('\n') with StreamBuffer)
├─ Wire setThinkingIntensity handler in _initializeMessageRouter
├─ Call TerminalManager.updateConfig() in newSessionOnConfigChange()
├─ Add graceful stdin shutdown before SIGKILL
└─ Fix MCP terminal restart process kill logic

Phase 1 (Stabilization)
├─ Add focus traps + ARIA to all 6 modals
├─ Create ErrorBoundary component
├─ Add Zod validation (NOW safe after service integration)
├─ Add async-mutex for multi-panel process operations
├─ Add atomic writes for conversation index
├─ Create unified types in src/types/shared.ts
├─ Add non-JSON stdout fallback in StreamBuffer
├─ Add hardcoded deny list in PermissionsManager
├─ Add audit logging for permissions
└─ Set up Vitest with characterization tests

Phase 2 (Enhancement)
├─ Add React.lazy for modals
├─ Implement EventBus pattern
├─ Add MessageList virtualization (react-virtuoso)
├─ Implement LRU cache for diffs
├─ Add process heartbeat monitoring (adaptive during thinking)
├─ Extract CliIntegration service (~200 lines)
├─ Extract SettingsManager service (~300 lines)
└─ Complete frontend handler registry pattern

Phase 3 (Optimization)
├─ Begin storage consolidation (JSONL-only with dual-reader)
├─ Implement atomic JSONL snapshot pattern
├─ Create unified CacheService
├─ Add Zustand atomic selectors
├─ Fix WSL path edge cases
├─ Dependency injection pattern
└─ Complete unit test coverage to 80%
```

---

## ⚠️ Implementation Risks

### Risk 1: Interface Mismatch
`StreamProcessor.ts` may expect a callback structure that `extension.ts` doesn't currently provide. When integrating, conform `extension.ts` to the interfaces defined in `services/`.

### Risk 2: Double-Processing Messages
When integrating `StreamProcessor`, ensure the old `on('data')` logic in `extension.ts` is removed to prevent parsing messages twice.

### Risk 3: Build Config Mismatch
`extension.ts` builds config manually in `_buildProcessConfig` (line 425). Must use `src/utils/spawn-config.ts` for consistency with `TerminalManager`.

### Risk 4: Multi-Panel State Inconsistency
Because `extension.ts` reverted while `services/` evolved, they have drifted apart. Treat `extension.ts` as the "broken" side and conform it to service interfaces.

---

## Quick Wins (Can Fix in Minutes)

1. **Register setThinkingIntensity handler** - Add ~5 lines in `_initializeMessageRouter` to at least log the message
2. **Export setThinkingIntensity in useVSCodeSender** - Add the postMessage call
3. **Add basic ARIA labels** - 10 lines per modal (`aria-modal="true"`, `aria-labelledby`)
4. **Import StreamBuffer in extension.ts** - Replace `split('\n')` calls at lines 579 and 1143
5. **Standardize CWD in _buildProcessConfig** - Copy the platform-aware path logic from `TerminalManager.ts`
6. **Call TerminalManager.updateConfig()** - Add 2 lines in `newSessionOnConfigChange()`

---

## Source Documentation Files

### Core Planning Docs
- `docs/01-TECHNICAL-DEBT-AND-BUGS.md` - 18 issues catalogued
- `docs/02-NEW-FEATURES-AND-IMPROVEMENTS.md` - 24 features proposed
- `docs/03-ARCHITECTURE-ROADMAP.md` - Full refactoring plan
- `docs/04-ADDENDUM-MISSING-ITEMS.md` - 7 additional items from follow-up review

### Modularization Plans
- `docs/plans/modularization-plan-2025-12-28.md` - Track A/B/C status
- `docs/plans/.archive/file-open-relocation.md` - CWD bug analysis
- `docs/plans/.archive/consolidate-claude-spawning.md` - Spawn consolidation

### Changelogs
- `docs/changelog/2025-12-27-session-16.md`
- `docs/changelog/2025-12-28-session-17.md`
- `docs/changelog/2025-12-28-session-18.md`
- `docs/changelog/2025-12-28-terminal-cwd-path-fix.md`
- `docs/changelog/2026-01-02-session-image-preview.md`

### Refactor V3 Series
- `docs/refactor-v3/00-CONSENSUS-SUMMARY.md`
- `docs/refactor-v3/02-ARCHITECTURE-CHANGES.md`
- `docs/refactor-v3/03-PERFORMANCE-IMPROVEMENTS.md`
- `docs/refactor-v3/04-GENERAL-IMPROVEMENTS.md`
- `docs/refactor-v3/jsonl-consolidation/storage-consolidation-analysis.md`

### Key Source Files Checked
- `src/extension.ts` (4344 lines)
- `src/services/index.ts`
- `src/services/StreamProcessor.ts`
- `src/services/TerminalManager.ts`
- `src/utils/spawn-config.ts`
- `src/webview/hooks/useVSCodeMessaging.ts`
- `src/webview/hooks/handlers/*.ts` (7 files)
- Various component files in `src/webview/components/`
