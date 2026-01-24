# Codebase Modularization Plan

## Executive Summary

Analysis of 8 files totaling **8,629 lines** reveals significant extraction opportunities. Primary target: `extension.ts` (4,104 lines) which alone accounts for 48% of analyzed code.

```
┌─────────────────────────────────────────────────────────────────┐
│  CURRENT STATE                    TARGET STATE                  │
├─────────────────────────────────────────────────────────────────┤
│  extension.ts: 4,104 lines   →    extension.ts: ~800 lines      │
│  ConversationManager: 1,084  →    ConversationManager: ~250     │
│  PermissionsManager: 735     →    PermissionsManager: ~300      │
│  messageHandlers: 613        →    messageHandlers: ~200         │
│  App.tsx: 578                →    App.tsx: ~150                 │
│  ProcessManager: 543         →    ProcessManager: ~280          │
│  useVSCodeMessaging: 438     →    useVSCodeMessaging: ~150      │
│  messages.ts: 445            →    Split into 5 focused files    │
├─────────────────────────────────────────────────────────────────┤
│  TOTAL: 8,629 lines          →    TOTAL: ~8,600 lines           │
│  8 files                     →    25-30 focused modules         │
│  Avg: 1,078 lines/file       →    Avg: ~300 lines/file          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Extension.ts Decomposition (HIGH PRIORITY)

**Current:** 4,104 lines in single class with 60+ methods
**Target:** ~800 lines orchestrator + 8 extracted modules

### 1.1 Extract Permission System → `src/services/PermissionService.ts`

| Method | Lines | Current Location |
|--------|-------|------------------|
| `_isToolPreApproved()` | 37 | 2037-2074 |
| `_matchesPattern()` | 12 | 2059-2067 |
| `_handleControlResponse()` | 23 | 2105-2128 |
| `_handleControlRequest()` | 120 | 2128-2248 |
| `_sendPermissionResponse()` | 41 | 2259-2300 |
| `_handlePermissionResponse()` | 28 | 2259-2289 |
| `_cancelPendingPermissionRequests()` | 16 | 2289-2305 |
| `_saveLocalPermission()` | 49 | 2305-2354 |
| `_sendPermissions()` | 31 | 2354-2385 |
| `_removePermission()` | 43 | 2385-2428 |
| `_addPermission()` | 64 | 2428-2492 |

**Extraction: ~400 lines → New PermissionService**

### 1.2 Extract JSON Stream Processor → `src/services/StreamProcessor.ts`

| Method | Lines | Current Location |
|--------|-------|------------------|
| `_processJsonStreamData()` | 316 | 1225-1541 |
| `_handleProcessStdout()` | 37 | 948-985 |
| `_handleProcessStderr()` | 8 | 985-993 |
| `_handleProcessClose()` | 30 | 993-1023 |

**Extraction: ~390 lines → New StreamProcessor**

### 1.3 Extract CLI Integration → `src/services/CliIntegration.ts`

| Method | Lines | Current Location |
|--------|-------|------------------|
| `_getCliProjectFolderName()` | 17 | 1878-1895 |
| `_scanCLIConversations()` | 138 | 1897-2035 |
| `_loadCLIConversation()` | 50 | 2035-2085 |
| `_loadMoreCLIMessages()` | 36 | 2085-2121 |
| `_sendConversationList()` | 43 | 2121-2164 |

**Extraction: ~200 lines → New CliIntegration**

### 1.4 Extract MCP Management → `src/services/McpManager.ts`

| Method | Lines | Current Location |
|--------|-------|------------------|
| `_loadMCPServers()` | 27 | 2595-2622 |
| `_saveMCPServer()` | 47 | 2622-2669 |
| `_deleteMCPServer()` | 37 | 2669-2706 |

**Extraction: ~115 lines → Merge with existing McpService**

### 1.5 Extract Git/Backup Operations → `src/services/BackupManager.ts`

| Method | Lines | Current Location |
|--------|-------|------------------|
| `_initializeBackupRepo()` | 33 | 1657-1690 |
| `_createBackupCommit()` | 33 | 1690-1723 |
| `_restoreToCommit()` | 49 | 1723-1772 |
| `_sendCheckpoints()` | 13 | 1772-1785 |

**Extraction: ~130 lines → Merge with existing BackupService**

### 1.6 Extract Webview Management → `src/services/WebviewManager.ts`

| Method | Lines | Current Location |
|--------|-------|------------------|
| `show()` | 72 | 714-786 |
| `_setupPanelMessageHandler()` | 34 | 786-820 |
| `_postMessage()` | 18 | 820-838 |
| `_sendReadyMessage()` | 43 | 838-881 |
| `_handleWebviewMessage()` | 7 | 881-888 |
| `_setupWebviewMessageHandler()` | 14 | 888-902 |
| `reinitializeWebview()` | 18 | 902-920 |

**Extraction: ~220 lines → New WebviewManager**

### 1.7 Extract File/Terminal Operations → `src/services/FileOperations.ts`

| Method | Lines | Current Location |
|--------|-------|------------------|
| `_openFileInEditor()` | 11 | 3896-3907 |
| `_openDiffByMessageIndex()` | 48 | 3907-3955 |
| `_openDiffEditor()` | 49 | 3955-4004 |
| `_createImageFile()` | 48 | 4004-4052 |
| `_openModelTerminal()` | 20 | 3716-3736 |
| `_openUsageTerminal()` | 18 | 3736-3754 |
| `_runInstallCommand()` | 37 | 3754-3791 |

**Extraction: ~180 lines → New FileOperations**

### 1.8 Extract Custom Snippets → Merge with existing service

| Method | Lines | Current Location |
|--------|-------|------------------|
| `_sendCustomSnippets()` | 16 | 2712-2728 |
| `_saveCustomSnippet()` | 22 | 2728-2750 |
| `_deleteCustomSnippet()` | 25 | 2750-2775 |

**Extraction: ~65 lines → New SnippetService or utility**

---

## Phase 2: ConversationManager Decomposition

**Current:** 1,084 lines
**Target:** ~250 lines orchestrator + 4 extracted modules

### 2.1 Extract JSONL Schemas → `src/types/jsonl-schemas.ts`

```
Lines 17-141: 8 Zod schema definitions
```
**Extraction: ~125 lines → Pure type definitions**

### 2.2 Extract Index Persistence → `src/services/IndexStore.ts`

| Method | Lines |
|--------|-------|
| `_loadConversationIndex()` | 54 |
| `_validateIndexEntries()` | 8 |
| `_saveConversationIndex()` | 49 |
| `_atomicWriteFile()` | 20 |
| `_rebuildConversationIndex()` | 59 |

**Extraction: ~160 lines → Atomic file operations**

### 2.3 Extract JSONL Parser → `src/services/JSONLParser.ts`

| Method | Lines |
|--------|-------|
| `_parseJSONLStreaming()` | 58 |
| `_parseJSONLEntry()` | 82 |

**Extraction: ~147 lines → Streaming parser**

### 2.4 Extract Message Extractors → `src/lib/messageExtractors.ts`

| Method | Lines |
|--------|-------|
| `_extractUserText()` | 37 |
| `_extractAssistantContent()` | 37 |

**Extraction: ~80 lines → Pure utility functions**

### 2.5 Extract Claude Project Discovery → `src/services/ClaudeProjectDiscovery.ts`

| Method | Lines |
|--------|-------|
| `_getClaudeJSONLConversations()` | 38 |
| `_getClaudeProjectsPath()` | 2 |
| `_getProjectFolderName()` | 11 |
| `_parseJSONLMetadataStreaming()` | 72 |

**Extraction: ~115 lines → CLI integration**

---

## Phase 3: PermissionsManager Decomposition

**Current:** 735 lines
**Target:** ~300 lines orchestrator + 4 extracted modules

### 3.1 Extract Command Patterns → `src/constants/commandPatterns.ts`

```
Lines 47-97: BLOCKED_COMMAND_PATTERNS
Lines 103-107: WARNED_COMMAND_PATTERNS
Lines 588-665: Command pattern lookup table
```
**Extraction: ~130 lines → Constants file**

### 3.2 Extract Security Validator → `src/services/CommandSecurityValidator.ts`

| Method | Lines |
|--------|-------|
| `isCommandBlocked()` | 27 |
| `isCommandWarned()` | 11 |
| `_matchesPattern()` | 33 |

**Extraction: ~80 lines → Security focused module**

### 3.3 Extract Audit Logger → `src/services/AuditLogger.ts`

| Method | Lines |
|--------|-------|
| `_initializeAuditLog()` | 17 |
| `_logAuditEntry()` | 11 |
| `_readAuditLog()` | 9 |
| `getRecentAuditEntries()` | 23 |
| `logPermissionDecision()` | 15 |

**Extraction: ~75 lines → Audit logging**

### 3.4 Extract Permissions Storage → `src/services/PermissionsStorage.ts`

| Method | Lines |
|--------|-------|
| `saveLocalPermission()` | 49 |
| `getPermissions()` | 18 |
| `removePermission()` | 37 |
| `addPermission()` | 47 |

**Extraction: ~150 lines → File I/O abstraction**

---

## Phase 4: Frontend Decomposition

### 4.1 messageHandlers.ts Refactoring

**Current:** 613 lines, 50+ handlers
**Target:** ~200 lines + handler modules

#### Extract Handler Factories

```typescript
// src/webview/lib/handlers/factories.ts
export const createSimpleMessageHandler = (type: MessageType) =>
  (data: any, ctx: HandlerContext) => {
    const content = typeof data === 'string' ? data : data?.content;
    ctx.addMessage({ type, content, timestamp: Date.now() });
  };

// Replaces 5 identical handlers (lines 166-189)
```

#### Split Handler Categories

```
src/webview/lib/handlers/
├── index.ts              (re-exports + setupHandlers)
├── registry.ts           (registerHandler, handleMessage)
├── message-handlers.ts   (simple message creators)
├── state-handlers.ts     (direct state setters)
├── permission-handlers.ts
├── conversation-handlers.ts
├── config-handlers.ts
└── data-transformers.ts
```

### 4.2 App.tsx Refactoring

**Current:** 578 lines
**Target:** ~150 lines + extracted hooks

#### Extract Custom Hooks

```
src/webview/hooks/
├── useInputHandlers.ts      (lines 141-164)
├── useHeaderHandlers.ts     (lines 170-182)
├── useSettingsHandlers.ts   (lines 208-253)
├── useHistoryHandlers.ts    (lines 264-313)
├── useModelHandlers.ts      (lines 319-336)
├── useMCPHandlers.ts        (lines 342-372)
└── useAppState.ts           (aggregates 3 store hooks)
```

#### Extract Modal Container

```typescript
// src/webview/containers/ModalContainer.tsx
// Lines 475-575 → Separate component for all modal rendering
```

### 4.3 useVSCodeMessaging.ts Refactoring

**Current:** 438 lines with 31 sender functions
**Target:** ~150 lines + domain hooks

#### Split Sender Hooks

```
src/webview/hooks/senders/
├── useMessageSender.ts      (4 functions)
├── usePermissionSender.ts   (5 functions)
├── useConversationSender.ts (4 functions)
├── useFileSender.ts         (6 functions)
├── useSettingsSender.ts     (3 functions)
├── useMCPSender.ts          (3 functions)
└── index.ts                 (re-exports all)
```

---

## Phase 5: Type System Improvements

### 5.1 Split messages.ts

**Current:** 445 lines in single file
**Target:** 5 focused type files

```
src/types/
├── messages.ts              (base + unions, ~50 lines)
├── webview-requests.ts      (24 interfaces, ~190 lines)
├── extension-messages.ts    (14 interfaces, ~130 lines)
├── data-models.ts           (7 interfaces, ~55 lines)
└── type-guards.ts           (validation helpers, ~20 lines)
```

### 5.2 Add Strong Typing

```typescript
// Replace Record<string, unknown> with typed settings
interface ApplicationSettings {
  thinking?: { intensity: number };
  wsl?: { enabled: boolean; distro: string; nodePath: string; claudePath: string };
  permissions?: { yoloMode: boolean };
  compact?: { toolOutput: boolean; mcpCalls: boolean; previewHeight: number };
  display?: { showTodoList: boolean };
}
```

---

## Phase 6: ProcessManager Refinement

**Current:** 543 lines
**Target:** ~280 lines + 3 utilities

### 6.1 Extract WSL Utilities → `src/lib/wslUtils.ts`

| Function | Lines |
|----------|-------|
| `isWSLPath()` | 7 |
| `isUNCPath()` | 8 |
| `convertToWSLPath()` | 31 |
| `shellEscape()` | 5 |
| `isValidShellPath()` | 3 |

**Extraction: ~55 lines → Reusable utilities**

### 6.2 Extract Shutdown Sequence → `src/services/ProcessShutdown.ts`

| Method | Lines |
|--------|-------|
| `kill()` | 65 |
| `_waitForExit()` | 19 |
| `_killProcessGroup()` | 30 |

**Extraction: ~115 lines → Complex shutdown logic**

### 6.3 Extract Heartbeat Monitor → `src/services/HeartbeatMonitor.ts`

| Method | Lines |
|--------|-------|
| `_startHeartbeat()` | 44 |
| `_stopHeartbeat()` | 9 |
| `_recordActivity()` | 3 |

**Extraction: ~60 lines → Monitoring abstraction**

---

## Implementation Priority Matrix

| Priority | Module | Lines Saved | Effort | Risk | Dependencies |
|----------|--------|-------------|--------|------|--------------|
| **P0** | StreamProcessor from extension.ts | 390 | High | Medium | ProcessManager |
| **P0** | PermissionService from extension.ts | 400 | High | Medium | None |
| **P1** | JSONL Schemas extraction | 125 | Low | Low | None |
| **P1** | Command Patterns constants | 130 | Low | Low | None |
| **P1** | Handler Factories | 50 | Low | Low | None |
| **P2** | CLI Integration | 200 | Medium | Low | ConversationManager |
| **P2** | IndexStore | 160 | Medium | Medium | ConversationManager |
| **P2** | Sender Hooks split | 200 | Medium | Low | None |
| **P3** | App.tsx hooks | 300 | Medium | Low | Stores |
| **P3** | WebviewManager | 220 | Medium | Medium | Extension |
| **P3** | Type system split | 0 | Low | Low | All consumers |

---

## New File Structure (Post-Refactor)

```
src/
├── extension.ts                    (~800 lines, orchestrator)
├── constants/
│   └── commandPatterns.ts          (~130 lines)
├── lib/
│   ├── wslUtils.ts                 (~55 lines)
│   └── messageExtractors.ts        (~80 lines)
├── services/
│   ├── index.ts
│   ├── ProcessManager.ts           (~280 lines)
│   ├── ConversationManager.ts      (~250 lines)
│   ├── PermissionsManager.ts       (~300 lines)
│   ├── PermissionService.ts        (~400 lines) NEW
│   ├── StreamProcessor.ts          (~390 lines) NEW
│   ├── CliIntegration.ts           (~200 lines) NEW
│   ├── WebviewManager.ts           (~220 lines) NEW
│   ├── FileOperations.ts           (~180 lines) NEW
│   ├── IndexStore.ts               (~160 lines) NEW
│   ├── JSONLParser.ts              (~150 lines) NEW
│   ├── ClaudeProjectDiscovery.ts   (~115 lines) NEW
│   ├── CommandSecurityValidator.ts (~80 lines) NEW
│   ├── AuditLogger.ts              (~75 lines) NEW
│   ├── PermissionsStorage.ts       (~150 lines) NEW
│   ├── ProcessShutdown.ts          (~115 lines) NEW
│   ├── HeartbeatMonitor.ts         (~60 lines) NEW
│   ├── BackupService.ts            (existing + merge)
│   ├── McpService.ts               (existing + merge)
│   └── ...existing services
├── types/
│   ├── messages.ts                 (~50 lines)
│   ├── webview-requests.ts         (~190 lines) NEW
│   ├── extension-messages.ts       (~130 lines) NEW
│   ├── data-models.ts              (~55 lines) NEW
│   ├── jsonl-schemas.ts            (~125 lines) NEW
│   └── type-guards.ts              (~20 lines) NEW
└── webview/
    ├── App.tsx                     (~150 lines)
    ├── containers/
    │   └── ModalContainer.tsx      (~180 lines) NEW
    ├── hooks/
    │   ├── useVSCodeMessaging.ts   (~150 lines)
    │   ├── useInputHandlers.ts     NEW
    │   ├── useSettingsHandlers.ts  NEW
    │   ├── useHistoryHandlers.ts   NEW
    │   ├── useAppState.ts          NEW
    │   └── senders/
    │       ├── useMessageSender.ts NEW
    │       ├── usePermissionSender.ts NEW
    │       └── ...more sender hooks
    └── lib/
        ├── messageHandlers.ts      (~200 lines)
        └── handlers/
            ├── factories.ts        NEW
            ├── message-handlers.ts NEW
            ├── permission-handlers.ts NEW
            └── ...category handlers
```

---

## Success Metrics

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Largest file | 4,104 lines | ~800 lines | 80% reduction |
| Avg file size (analyzed) | 1,078 lines | ~300 lines | 72% reduction |
| Files over 500 lines | 6 | 0 | 100% elimination |
| Cyclomatic complexity (extension.ts) | ~85 | ~25 | 70% reduction |
| Test coverage potential | Low | High | Isolated units |

---

## Risk Mitigation

1. **Incremental extraction**: Extract one module at a time, validate with tests
2. **Interface stability**: Define interfaces before extracting implementations
3. **Backward compatibility**: Maintain re-exports from original locations initially
4. **Regression testing**: Run full test suite after each extraction
5. **Git safety**: Create feature branch per extraction phase
