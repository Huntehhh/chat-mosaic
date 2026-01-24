# Agent 1 (Backend) - Remaining Work from refactor-v3

> **Source**: Analysis of `docs/plans/refactor-v3/` by Agent 3
> **Date**: 2026-01-02

---

## P0 - Critical (From Consensus Summary)

### 1. Wire StreamBuffer to ALL CLI Parsing

**Problem**: `extension.ts` line 630 still uses `split('\n')` for panel process output.

**Fix**: Replace all `split('\n')` usages with `StreamBuffer.parse(chunk)`:

```typescript
// Lines to fix in extension.ts:
// - Line 630 (panel process handler)
// - Line 948-979 (main process handler)

const streamBuffer = new StreamBuffer();
proc.stdout?.on('data', (data: Buffer) => {
  const chunk = data.toString();
  const parsedMessages = streamBuffer.parse(chunk);
  for (const { data } of parsedMessages) {
    this.handleParsedMessage(data);
  }
});
```

**Note**: `parseWithFallback()` is now available for mixed JSON/text streams.

### 2. Consolidate Duplicate Spawn Calls

**Problem**: Direct `cp.spawn()` and `createTerminal()` calls bypass centralized services.

**Locations to fix**:
- Lines 562, 1041, 1058: `cp.spawn()` → Use `ProcessManager`
- Lines 1667, 3963, 3993, 4080: `createTerminal()` → Use `TerminalManager`

---

## P1 - High Priority

### 3. Extract CliIntegration.ts (~200 lines)

**Source**: modularization-plan-2025-12-28.md

**Methods to extract from extension.ts**:
- `_scanCLIConversations()` (lines 1897-2035)
- `_loadCLIConversation()` (lines 2035-2085)
- `_loadMoreCLIMessages()` (lines 2085-2121)
- `_getCliProjectFolderName()` (lines 1878-1895)

**Target**: `src/services/CliIntegration.ts`

### 4. Extract SettingsManager.ts (~300 lines)

**Source**: modularization-plan-2025-12-28.md

**Methods to extract from extension.ts**:
- `_sendCurrentSettings()`
- `_updateSettings()`
- `_setSelectedModel()`
- `_setPlanMode()`
- `_setThinkingIntensity()`
- `_readClaudeSettings()`, `_writeClaudeSettings()`
- `_readClaudeGlobalConfig()`, `_getClaudeSettingsPath()`

**Target**: `src/services/SettingsManager.ts`

### 5. Add setThinkingIntensity Handler

**Source**: AGENT-1-BACKEND.md Task 5

**Implementation**:
```typescript
case 'setThinkingIntensity':
  const { intensity } = message;
  await vscode.workspace.getConfiguration('claudeCodeChat')
    .update('thinkingIntensity', intensity, vscode.ConfigurationTarget.Workspace);
  break;
```

**Note**: Agent 2 wired the frontend to send this message.

### 6. Merge MCP Methods into McpService.ts

**Methods to move from extension.ts**:
- `_loadMCPServers()` (lines 2595-2622)
- `_saveMCPServer()` (lines 2622-2669)
- `_deleteMCPServer()` (lines 2669-2706)

### 7. Merge Backup Methods into BackupService.ts

**Methods to move from extension.ts**:
- `_initializeBackupRepo()` (lines 1657-1690)
- `_createBackupCommit()` (lines 1690-1723)
- `_restoreToCommit()` (lines 1723-1772)
- `_sendCheckpoints()` (lines 1772-1785)

---

## P2 - Medium Priority

### 8. Add Zod Validation to CLI Parsing

**Source**: 04-GENERAL-IMPROVEMENTS.md

**Implementation**:
```typescript
import { CliMessageSchema } from './services/CliSchemas';

function parseCliOutput(line: string): CliMessage | null {
  const result = CliMessageSchema.safeParse(JSON.parse(line));
  if (!result.success) {
    logger.warn('CLI output validation failed', { errors: result.error.issues });
    return createFallbackMessage(JSON.parse(line));
  }
  return result.data;
}
```

### 9. Create Logger Service

**Source**: 04-GENERAL-IMPROVEMENTS.md

**Target**: `src/services/Logger.ts`

```typescript
class Logger {
  private outputChannel: OutputChannel;

  info(message: string, context?: object): void;
  warn(message: string, context?: object): void;
  error(message: string, error?: Error, context?: object): void;
}
```

### 10. Atomic JSONL Snapshots

**Source**: 03-PERFORMANCE-IMPROVEMENTS.md

**Problem**: Race condition between append and snapshot creation.

**Solution**: Atomic rename pattern in ConversationManager:
```typescript
async atomicSnapshot() {
  const tempPath = this.activePath + '.tmp';
  const messages = await this.loadAllMessages();
  await fs.writeFile(tempPath, JSON.stringify(messages));
  await fs.rename(tempPath, this.snapshotPath);  // Atomic
  await fs.truncate(this.activePath, 0);
}
```

---

## Available from Agent 3

These are ready for you to use:

1. **parseWithFallback()** in StreamBuffer - handles mixed JSON/text
2. **shared-types.ts** exports: `WebviewMessage`, `SendMessagePayload`, `TokenUpdate`, `TokenCost`, `ErrorInfo`, `ConnectionState`, `ProcessState`
3. All 16 services exported from `src/services/index.ts`

---

## File Size Target

| File | Current | Target |
|------|---------|--------|
| extension.ts | ~4,128 | ~800 |
