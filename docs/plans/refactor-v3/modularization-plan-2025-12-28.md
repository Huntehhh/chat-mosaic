# Modularization Plan: Claude Code Chat Extension

## Session Progress

### Session 18 (2025-12-28 continuation)

**Track A Completion:**
- [x] Replaced `_openMCPTerminal` call to use `this._terminalManager.openMCPTerminal()`
- [x] Deleted inline `_openMCPTerminal()` method (~103 lines removed)
- [x] Updated `_buildProcessConfig()` to use `this._spawnConfig` for shared fields
- [x] Updated `_spawnPanelProcess()` to use `this._spawnConfig.cwd`

**Track B: StreamProcessor Extraction:**
- [x] Created `src/services/StreamProcessor.ts` (556 lines)
- [x] Added StreamProcessor export to `src/services/index.ts`
- [x] Initialized StreamProcessor in extension.ts constructor with callbacks
- [x] Updated `_handleProcessStdout` to delegate to StreamProcessor
- [x] Updated `_handleProcessStderr` to delegate to StreamProcessor
- [x] Updated `_handleProcessClose` to delegate to StreamProcessor
- [x] Updated `_handleProcessError` to delegate to StreamProcessor
- [x] Added `processJson()` public method for panel process path
- [x] Updated `_handlePanelProcessMessage` to use StreamProcessor
- [x] Deleted inline `_processJsonStreamData()` method (~328 lines)
- [x] Removed `_processRawOutput` and `_processErrorOutput` buffer fields
- [x] **extension.ts reduced from 4,716 to 4,128 lines (-588 lines, 12% reduction)**
- [x] Build passes with all changes

### Session 17 (2025-12-28)
- [x] Created `src/utils/spawn-config.ts` with shared `ClaudeSpawnConfig` interface
- [x] Created `src/services/TerminalManager.ts` with 5 terminal methods (login, model, usage, slash, mcp)
- [x] Added TerminalManager export to `src/services/index.ts`
- [x] Integrated TerminalManager into `extension.ts` constructor
- [x] Replaced `_handleLoginRequired` to use TerminalManager
- [x] Replaced `_openModelTerminal` to use TerminalManager
- [x] Replaced `_openUsageTerminal` to use TerminalManager
- [x] Replaced `_runInstallCommand` to use TerminalManager
- [x] Replaced `_executeSlashCommand` to use TerminalManager (except /compact and /mcp routing)
- [x] Cleaned up old refactor docs (moved to docs/plans/done/)

### Track A Status: COMPLETE
All terminal spawning now uses TerminalManager. Background process spawning (`_spawnPanelProcess`) uses shared `ClaudeSpawnConfig` for consistency.

### Track B Status: StreamProcessor COMPLETE
JSON stream parsing extracted to StreamProcessor service. Both ProcessManager path and panel process path now use StreamProcessor.

### Deferred to Next Session
- Track B (remaining): Extract CliIntegration, SettingsManager
- Track C: Split frontend messageHandlers.ts

---

## Problem Statement

Claude process spawning is duplicated across **13 locations**. The main `extension.ts` file is **4,716 lines** (a "God Class"). Changes to spawn behavior require editing 5+ files.

## Goals

1. **Single spawn location** - All Claude CLI spawning through one service
2. **Reduce extension.ts** - From 4,716 lines to ~800 lines
3. **Reusable modules** - Each service has one responsibility
4. **Easier maintenance** - Change spawn logic in one place

---

## Phase 1: Consolidate Process Spawning

### Current State

| Location | File | Lines | Purpose |
|----------|------|-------|---------|
| 1-3 | ProcessManager.ts | 279-332 | WSL/PowerShell/Native spawn |
| 4-6 | extension.ts | 617-642 | Per-panel spawn (LEGACY) |
| 7-8 | extension.ts | 1290, 3223 | ProcessManager.spawn() calls |
| 9-13 | extension.ts | 1785+ | 5 terminal types (login, model, usage, slash, mcp) |

### Target State

```
src/services/
├── ProcessManager.ts       # Background JSON-stream processes
├── TerminalManager.ts      # NEW: All vscode.createTerminal operations
└── index.ts

src/utils/
├── claude-args.ts          # EXISTING: Shared argument building
└── spawn-config.ts         # NEW: Shared configuration type
```

### CRITICAL: Shared Configuration

Both ProcessManager and TerminalManager MUST use the same configuration source to prevent path/shell divergence (the MCP bug we just fixed).

**Create `src/utils/spawn-config.ts`:**
```typescript
export interface ClaudeSpawnConfig {
  cwd: string;                    // Workspace path (normalized)
  sessionId?: string;
  model?: string;
  wslEnabled: boolean;
  wslDistro: string;
  claudePath: string;             // WSL claude path
  nodePath: string;               // WSL node path
  yoloMode: boolean;
  planMode: boolean;
}

// Single source of truth - extension.ts builds this once
export function buildSpawnConfig(context: vscode.ExtensionContext): ClaudeSpawnConfig {
  const config = vscode.workspace.getConfiguration('claudeCodeChat');
  return {
    cwd: normalizePathForOS(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''),
    wslEnabled: config.get<boolean>('wsl.enabled', false),
    wslDistro: config.get<string>('wsl.distro', 'Ubuntu'),
    claudePath: config.get<string>('wsl.claudePath', '/usr/local/bin/claude'),
    nodePath: config.get<string>('wsl.nodePath', '/usr/bin/node'),
    yoloMode: config.get<boolean>('yoloMode', false),
    planMode: config.get<boolean>('planMode', false),
  };
}
```

**Both services consume this config:**
```typescript
// ProcessManager (background processes)
class ProcessManager {
  constructor(private config: ClaudeSpawnConfig, callbacks: ProcessManagerCallbacks) {}

  spawn(sessionId?: string): void {
    const args = buildClaudeArgs({
      sessionId,
      model: this.config.model,
      yoloMode: this.config.yoloMode,
      planMode: this.config.planMode,
    });
    // Uses this.config.wslEnabled, this.config.cwd, etc.
  }
}

// TerminalManager (interactive terminals)
class TerminalManager {
  constructor(private config: ClaudeSpawnConfig) {}

  openMCPTerminal(sessionId: string): vscode.Terminal {
    const args = buildInteractiveArgs(sessionId);
    const { command } = buildTerminalCommand(`claude ${args.join(' ')}`, this.config.cwd, this.config.wslEnabled);
    // Uses same config.wslEnabled, config.cwd, etc.
  }
}
```

### Changes Required

**1. Create `src/utils/spawn-config.ts`**
- Define `ClaudeSpawnConfig` interface
- Add `buildSpawnConfig()` function
- Both services import from this file

**2. Remove `_spawnPanelProcess()` from extension.ts (lines 617-642)**
- This duplicates ProcessManager logic
- Route all background spawns through ProcessManager

**3. Create `TerminalManager.ts`**
- Move all 5 terminal spawn methods:
  - `_openLoginTerminal()` (line 1785)
  - `_openModelTerminal()` (line 4162)
  - `_openUsageTerminal()` (line 4199)
  - `_executeSlashCommand()` (line 4293)
  - `_openMCPTerminal()` (line 4360)
- Use shared `buildTerminalCommand()` from claude-args.ts
- Consume `ClaudeSpawnConfig` for all WSL/path settings

**4. Update ProcessManager to consume `ClaudeSpawnConfig`**
- Already has WSL/PowerShell/Native logic
- Now gets config from shared source instead of individual parameters

### Files to Modify

| File | Action |
|------|--------|
| `src/utils/spawn-config.ts` | **NEW** - Shared ClaudeSpawnConfig interface |
| `src/services/TerminalManager.ts` | **NEW** - 5 terminal methods |
| `src/services/ProcessManager.ts` | Update to accept ClaudeSpawnConfig |
| `src/extension.ts` | Delete _spawnPanelProcess, use shared config |
| `src/utils/claude-args.ts` | No changes (already correct) |

---

## Phase 2: Extract Services from extension.ts

### 2.1 StreamProcessor (~390 lines)

Extract JSON stream parsing from Claude stdout.

**Methods to extract:**
- `_processJsonStreamData()` (lines 1225-1541) - 316 lines
- `_handleProcessStdout()` (lines 948-985)
- `_handleProcessStderr()` (lines 985-993)
- `_handleProcessClose()` (lines 993-1023)

**New file:** `src/services/StreamProcessor.ts`

### 2.2 CliIntegration (~200 lines)

Extract CLI conversation loading (from ~/.claude).

**Methods to extract:**
- `_scanCLIConversations()` (lines 1897-2035)
- `_loadCLIConversation()` (lines 2035-2085)
- `_loadMoreCLIMessages()` (lines 2085-2121)
- `_getCliProjectFolderName()` (lines 1878-1895)

**New file:** `src/services/CliIntegration.ts`

### 2.3 SettingsManager (~300 lines)

Extract configuration handling.

**Methods to extract:**
- `_sendCurrentSettings()`
- `_updateSettings()`
- `_setSelectedModel()`
- `_setPlanMode()`
- `_setThinkingIntensity()`
- `_readClaudeSettings()`, `_writeClaudeSettings()`
- `_readClaudeGlobalConfig()`, `_getClaudeSettingsPath()`

**New file:** `src/services/SettingsManager.ts`

### 2.4 Merge into Existing McpService (~115 lines)

**Methods to move from extension.ts:**
- `_loadMCPServers()` (lines 2595-2622)
- `_saveMCPServer()` (lines 2622-2669)
- `_deleteMCPServer()` (lines 2669-2706)

**Target:** `src/services/McpService.ts` (already exists, enhance it)

### 2.5 Merge into Existing BackupService (~130 lines)

**Methods to move from extension.ts:**
- `_initializeBackupRepo()` (lines 1657-1690)
- `_createBackupCommit()` (lines 1690-1723)
- `_restoreToCommit()` (lines 1723-1772)
- `_sendCheckpoints()` (lines 1772-1785)

**Target:** `src/services/BackupService.ts` (already exists, enhance it)

---

## Phase 3: Frontend Handler Split

### Current State

`messageHandlers.ts` - 613 lines, 50+ handlers in one file

### Target State

```
src/webview/lib/handlers/
├── index.ts              # Re-exports + setupHandlers
├── registry.ts           # Handler registration + dispatch
├── chat-handlers.ts      # userInput, output, thinking, error, system
├── permission-handlers.ts # permissionRequest, permissionsList, updateStatus
├── conversation-handlers.ts # conversationList, conversationHistory, sessionCleared
├── config-handlers.ts    # settings, platformInfo, accountInfo, ready
├── tool-handlers.ts      # toolUse, toolResult, toolStatus
├── mcp-handlers.ts       # mcpServers, mcpServerSaved, mcpServerDeleted
└── factories.ts          # createSimpleMessageHandler pattern
```

### Handler Registry Pattern

```typescript
// src/webview/lib/handlers/registry.ts
type MessageHandler = (data: any, ctx: HandlerContext) => void;

const handlers = new Map<string, MessageHandler>();

export function registerHandler(type: string, handler: MessageHandler) {
  handlers.set(type, handler);
}

export function handleMessage(type: string, data: any, ctx: HandlerContext) {
  const handler = handlers.get(type);
  if (handler) {
    handler(data, ctx);
  } else {
    console.log('[MessageHandlers] Unknown type:', type);
  }
}

// src/webview/lib/handlers/index.ts
import { registerHandler, handleMessage } from './registry';
import { chatHandlers } from './chat-handlers';
import { permissionHandlers } from './permission-handlers';
// ... etc

export function setupHandlers() {
  Object.entries(chatHandlers).forEach(([type, handler]) => registerHandler(type, handler));
  Object.entries(permissionHandlers).forEach(([type, handler]) => registerHandler(type, handler));
  // ... etc
}

export { handleMessage };
```

### Handler Categories

| File | Handlers | Lines |
|------|----------|-------|
| chat-handlers.ts | userInput, output, thinking, error, system, init | ~80 |
| permission-handlers.ts | permissionRequest, permissionsList, updateStatus | ~60 |
| conversation-handlers.ts | conversationList, conversationHistory, sessionCleared, scrollToBottom | ~70 |
| config-handlers.ts | settings, platformInfo, accountInfo, ready, workspaceFiles | ~80 |
| tool-handlers.ts | toolUse, toolResult, toolStatus | ~100 |
| mcp-handlers.ts | mcpServers, mcpServerSaved, mcpServerDeleted | ~50 |
| factories.ts | createSimpleMessageHandler | ~30 |

### Factory Pattern for Repetitive Handlers

```typescript
// src/webview/lib/handlers/factories.ts
export function createSimpleMessageHandler(type: MessageType) {
  return (data: any, ctx: HandlerContext) => {
    const content = typeof data === 'string' ? data : data?.content;
    ctx.addMessage({ type, content, timestamp: Date.now() });
  };
}

// Usage - replaces 5 identical handlers
export const chatHandlers = {
  userInput: createSimpleMessageHandler('user'),
  output: createSimpleMessageHandler('claude'),
  thinking: createSimpleMessageHandler('thinking'),
  error: createSimpleMessageHandler('error'),
  system: createSimpleMessageHandler('system'),
};
```

---

## Implementation Order

All work happens in parallel across 3 tracks:

### Track A: Spawn Consolidation
1. Create `src/utils/spawn-config.ts` with shared ClaudeSpawnConfig
2. Create `src/services/TerminalManager.ts` with 5 terminal methods
3. Update ProcessManager to accept ClaudeSpawnConfig
4. Remove `_spawnPanelProcess()` from extension.ts
5. Update all callers to use TerminalManager/ProcessManager

### Track B: Service Extraction (extension.ts → services)
1. Extract `StreamProcessor.ts` (~390 lines)
2. Extract `CliIntegration.ts` (~200 lines)
3. Extract `SettingsManager.ts` (~300 lines)
4. Merge MCP methods into `McpService.ts`
5. Merge backup methods into `BackupService.ts`

### Track C: Frontend Handler Split
1. Create `src/webview/lib/handlers/` directory structure
2. Create `registry.ts` with handler registration
3. Create `factories.ts` with createSimpleMessageHandler
4. Split handlers into domain files (chat, permission, conversation, config, tool, mcp)
5. Update `messageHandlers.ts` to use registry pattern
6. Update imports in App.tsx

### Execution Strategy

**Session 1:** Tracks A + B.1 in parallel
- Track A: Full spawn consolidation (spawn-config, TerminalManager, ProcessManager update)
- Track B.1: Extract StreamProcessor (biggest complexity reducer)

**Session 2:** Tracks B.2-5 + C in parallel
- Track B: Remaining service extractions
- Track C: Frontend handler split

### Verification After Each Change
- `npm run compile` passes
- Extension loads and basic chat works
- MCPs still sync correctly (spawn config tested)

---

## File Size Targets

| File | Current | Target | Reduction |
|------|---------|--------|-----------|
| extension.ts | 4,716 | ~800 | 83% |
| messageHandlers.ts | 613 | ~200 | 67% |
| ProcessManager.ts | 645 | ~300 | 54% |

---

## New File Structure

```
src/
├── extension.ts                    (~800 lines, orchestrator only)
│
├── utils/
│   ├── claude-args.ts              (existing - shared arg building)
│   └── spawn-config.ts             (~50 lines) NEW - shared config
│
├── services/
│   ├── index.ts                    (re-exports all services)
│   ├── ProcessManager.ts           (~350 lines) UPDATED - uses ClaudeSpawnConfig
│   ├── TerminalManager.ts          (~200 lines) NEW - 5 terminal methods
│   ├── StreamProcessor.ts          (~400 lines) NEW - JSON stream parsing
│   ├── CliIntegration.ts           (~200 lines) NEW - ~/.claude loading
│   ├── SettingsManager.ts          (~300 lines) NEW - config handling
│   ├── McpService.ts               (~350 lines) ENHANCED - merged methods
│   ├── BackupService.ts            (~350 lines) ENHANCED - merged methods
│   ├── ConversationManager.ts      (existing, unchanged)
│   ├── PermissionsManager.ts       (existing, unchanged)
│   ├── MessageRouter.ts            (existing, unchanged)
│   ├── PanelManager.ts             (existing, unchanged)
│   └── StreamBuffer.ts             (existing, unchanged)
│
├── types/
│   ├── process.ts                  (existing)
│   ├── messages.ts                 (existing)
│   └── session.ts                  (existing)
│
└── webview/
    ├── App.tsx                     (existing, unchanged)
    └── lib/
        ├── messageHandlers.ts      (~100 lines) REDUCED - uses registry
        └── handlers/               NEW directory
            ├── index.ts            (setupHandlers + exports)
            ├── registry.ts         (handler registration)
            ├── factories.ts        (createSimpleMessageHandler)
            ├── chat-handlers.ts    (~80 lines)
            ├── permission-handlers.ts (~60 lines)
            ├── conversation-handlers.ts (~70 lines)
            ├── config-handlers.ts  (~80 lines)
            ├── tool-handlers.ts    (~100 lines)
            └── mcp-handlers.ts     (~50 lines)
```

---

## Success Criteria

### Spawn Consolidation (Track A) - COMPLETE
- [x] All terminal spawning through TerminalManager
- [x] Both ProcessManager and _spawnPanelProcess use shared ClaudeSpawnConfig
- [x] buildClaudeArgs used for all argument building
- [x] MCP path issue resolved (same config = same project path)
- [~] _spawnPanelProcess kept but uses shared config (full removal requires ProcessManager multi-panel support)

### Service Extraction (Track B)
- [x] StreamProcessor.ts contains all JSON stream parsing (556 lines)
- [ ] CliIntegration.ts handles all ~/.claude operations
- [ ] SettingsManager.ts handles all config read/write
- [ ] McpService.ts includes extension.ts MCP methods
- [ ] BackupService.ts includes extension.ts backup methods
- [~] extension.ts at 4,128 lines (down from 4,716, target ~800)

### Frontend Handler Split (Track C)
- [ ] messageHandlers.ts reduced to ~100 lines
- [ ] Handler registry pattern in place
- [ ] 6 domain handler files created
- [ ] Factory pattern for simple handlers

### Quality Gates
- [ ] `npm run compile` passes after each change
- [ ] No file > 500 lines
- [ ] Extension loads and chat works
- [ ] MCP enable/disable persists correctly
