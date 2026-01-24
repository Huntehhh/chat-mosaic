# Agent 1: Backend Core Integration

> **Project**: `C:\HApps\claude-code-chat` (VS Code Extension)
> **Scope**: `src/extension.ts` ONLY (4344 lines currently)
> **Worktree**: Create with `git worktree add .worktrees/backend-agent main`
> **Mode**: `--dangerously-skip-permissions` recommended for speed

---

## CRITICAL: Coordination Protocol

**Every 15-20 minutes**, check and update: `docs/plans/v2-regression/COORDINATION.md`

```bash
# Check for messages from other agents
cat docs/plans/v2-regression/COORDINATION.md

# Log your progress (append, don't overwrite)
echo "[$(date -Iseconds)] [AGENT_1] STATUS: Working on Task X" >> docs/plans/v2-regression/COORDINATION.md
```

---

## Your Mission

You are the **Backend Integration Specialist**. You have SOLE ownership of `src/extension.ts`. No other agent will touch this file. Your job is to:
1. Wire the 13 orphaned services into extension.ts
2. Delete ~481 lines of zombie/duplicate code
3. Add missing message handlers

---

## Pre-Flight Checklist

```bash
# 1. Create isolated worktree
git worktree add .worktrees/backend-agent -b feature/backend-integration main
cd .worktrees/backend-agent

# 2. Verify you're in the right place
head -10 src/extension.ts

# 3. Log start to coordination file
echo "[$(date -Iseconds)] [AGENT_1] STATUS: STARTED" >> docs/plans/v2-regression/COORDINATION.md
```

---

## Tasks (In Order)

### Task 1: Add Service Imports (5 min)

**Current State** (line 6):
```typescript
import { MessageRouter, getMemoryMonitor, GitService } from './services';
```

**Target State**:
```typescript
import {
  MessageRouter,
  getMemoryMonitor,
  GitService,
  StreamBuffer,
  createStreamBuffer,
  StreamProcessor,
  TerminalManager,
  ProcessManager,
  CliSchemas
} from './services';
```

### Task 2: Create Service Instances in Constructor

Find the `ClaudeChatProvider` constructor and add service instances:

```typescript
// After existing initialization (around line 230)
private _streamBuffer: StreamBuffer;
private _terminalManager: TerminalManager;

// In constructor:
this._streamBuffer = createStreamBuffer();
this._terminalManager = new TerminalManager(this._buildSpawnConfig(), {
  postMessage: (msg) => this._postMessage(msg),
  onMCPTerminalClosed: (panelId, sessionId) => this._restartProcessAfterMCP(panelId, sessionId)
});
```

### Task 3: Replace split('\n') with StreamBuffer (Critical)

**Location 1 - Line 579** in `_setupPanelProcessHandlers`:
```typescript
// BEFORE:
const lines = processInfo.rawOutput.split('\n');
processInfo.rawOutput = lines.pop() || '';

// AFTER:
const parsed = this._streamBuffer.parse(chunk);
for (const { data: jsonData } of parsed) {
  this._handlePanelProcessMessage(panelId, jsonData);
}
```

**Location 2 - Line 1143** in stdout handler:
```typescript
// BEFORE:
const lines = rawOutput.split('\n');
rawOutput = lines.pop() || '';

// AFTER:
const parsed = this._streamBuffer.parse(data.toString());
for (const { data: jsonData } of parsed) {
  // Handle control requests, responses, and regular messages
  if (jsonData.type === 'control_request') {
    this._handleControlRequest(jsonData, claudeProcess);
    continue;
  }
  if (jsonData.type === 'control_response') {
    this._handleControlResponse(jsonData);
    continue;
  }
  this._processJsonStreamData(jsonData); // Will be replaced in Task 5
}
```

### Task 4: Wire TerminalManager into _executeSlashCommand

**Location**: Lines 4045-4089

Replace manual terminal creation with TerminalManager:

```typescript
private _executeSlashCommand(command: string): void {
  if (command === 'compact') {
    this._sendMessageToClaude(`/${command}`);
    return;
  }

  // Use TerminalManager instead of manual creation
  this._terminalManager.executeSlashCommand(command, this._currentSessionId);
}
```

This replaces ~45 lines of duplicate code.

### Task 5: Add setThinkingIntensity Handler

**Location**: `_initializeMessageRouter()` around line 315

Add after the last `register` call:

```typescript
this._messageRouter.register('setThinkingIntensity', async (msg: any) => {
  const intensity = msg.intensity;
  if (!intensity || !['none', 'think', 'think_hard', 'ultrathink'].includes(intensity)) {
    return;
  }

  // Write to ~/.claude/settings.json
  const os = require('os');
  const fs = require('fs').promises;
  const path = require('path');

  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  try {
    let settings: any = {};
    try {
      const content = await fs.readFile(settingsPath, 'utf8');
      settings = JSON.parse(content);
    } catch { /* File doesn't exist yet */ }

    settings.thinkingIntensity = intensity;
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

    this._postMessage({ type: 'thinkingIntensitySaved', data: { intensity } });
  } catch (error) {
    console.error('Failed to save thinking intensity:', error);
  }
});
```

### Task 6: Call updateConfig in newSessionOnConfigChange

**Location**: Line 1611 `newSessionOnConfigChange()`

Add after `_initializeMCPConfig()`:

```typescript
public newSessionOnConfigChange() {
  this._initializeMCPConfig();

  // Update terminal manager with new config
  if (this._terminalManager) {
    this._terminalManager.updateConfig(this._buildSpawnConfig());
  }

  // ... rest of method
}
```

### Task 7: Add Zod Validation to JSON Parsing (P0 Critical)

**Location**: After replacing split('\n') with StreamBuffer, add validation

Import CliSchemas at top:
```typescript
import {
  // ... existing imports ...
  CliSchemas,
  UserMessageSchema,
  AssistantMessageSchema,
  SystemMessageSchema
} from './services';
```

Then wrap JSON parsing with validation:
```typescript
// In the StreamBuffer parse loop:
for (const { data: jsonData } of parsed) {
  // Validate based on message type
  const validated = this._validateCliMessage(jsonData);
  if (!validated) continue;

  // ... handle validated message
}

// Add helper method:
private _validateCliMessage(jsonData: any): any | null {
  if (!jsonData?.type) return null;

  try {
    switch (jsonData.type) {
      case 'system':
        return SystemMessageSchema.parse(jsonData);
      case 'assistant':
        return AssistantMessageSchema.parse(jsonData);
      case 'user':
        return UserMessageSchema.parse(jsonData);
      case 'result':
        return jsonData; // ResultSchema if available
      default:
        return jsonData; // Pass through unknown types
    }
  } catch (error) {
    console.warn('[Validation] Invalid CLI message:', error);
    return null;
  }
}
```

### Task 8: DELETE Zombie Code (_processJsonStreamData)

**Location**: Lines 1263-1579 (approximately 316 lines)

**Action**: DELETE the entire `_processJsonStreamData` method. It's duplicate code - StreamProcessor.ts has the correct implementation.

```typescript
// DELETE THIS ENTIRE METHOD:
private async _processJsonStreamData(jsonData: any) {
  // ... ~316 lines of duplicate code ...
}
```

After deletion, update line 1172 to use StreamProcessor instead:
```typescript
// BEFORE:
this._processJsonStreamData(jsonData);

// AFTER:
// The StreamBuffer.parse() loop already handles this - no replacement needed
// Just delete the call and the method
```

### Task 9: DELETE Duplicate _killProcessGroup

**Location**: Lines 3435-3533 (approximately 100 lines)

**Action**: DELETE the entire `_killProcessGroup` method. ProcessManager.ts has the correct implementation with graceful shutdown.

```typescript
// DELETE THIS ENTIRE METHOD:
private async _killProcessGroup(pid: number, signal: string = 'SIGTERM'): Promise<void> {
  // ... ~100 lines of duplicate code ...
}
```

Update callers to use ProcessManager:
```typescript
// BEFORE (in _stopClaudeProcess around line 3510):
await this._killProcessGroup(pid, 'SIGTERM');

// AFTER:
// If you wire ProcessManager, use: await this._processManager.kill();
// Otherwise, keep the inline implementation for now
```

### Task 10: Add _buildSpawnConfig Helper (Required for TerminalManager)

**Location**: Add near other config methods (around line 380)

This helper builds the config object TerminalManager needs:

```typescript
private _buildSpawnConfig(): import('./utils/spawn-config').ClaudeSpawnConfig {
  const config = vscode.workspace.getConfiguration('claudeCodeChat');
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const cwd = workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  return {
    cwd,
    wslEnabled: config.get<boolean>('wsl.enabled', false),
    wslDistro: config.get<string>('wsl.distro', 'Ubuntu'),
    nodePath: config.get<string>('wsl.nodePath', '/usr/bin/node'),
    claudePath: config.get<string>('wsl.claudePath', '/usr/local/bin/claude'),
  };
}
```

---

## DO NOT TOUCH

- `src/services/**/*` - Agent 3's domain
- `src/webview/**/*` - Agent 2's domain
- Any files not in your scope

---

## Completion Checklist

- [ ] Task 1: Service imports added
- [ ] Task 2: Service instances created (_streamBuffer, _terminalManager)
- [ ] Task 3: split('\n') replaced with StreamBuffer.parse() at lines 579, 1143
- [ ] Task 4: TerminalManager wired into _executeSlashCommand
- [ ] Task 5: setThinkingIntensity handler added to _initializeMessageRouter
- [ ] Task 6: updateConfig() called in newSessionOnConfigChange
- [ ] Task 7: Zod validation added with _validateCliMessage helper
- [ ] Task 8: _processJsonStreamData DELETED (~316 lines)
- [ ] Task 9: _killProcessGroup DELETED (~100 lines) OR kept if ProcessManager not wired
- [ ] Task 10: _buildSpawnConfig helper added
- [ ] Code compiles: `npm run compile`

---

## When Done

```bash
# 1. Log completion to coordination file
echo "[$(date -Iseconds)] [AGENT_1] COMPLETED: All 10 tasks finished" >> docs/plans/v2-regression/COORDINATION.md

# 2. Commit your changes
git add src/extension.ts
git commit -m "feat: wire orphaned services, delete ~400 lines of zombie code"

# 3. Verify build
npm run compile

# 4. Log final status
echo "[$(date -Iseconds)] [AGENT_1] STATUS: Build verified, ready for merge" >> docs/plans/v2-regression/COORDINATION.md
```

**DO NOT** remove the worktree yet - wait for all agents to complete and coordinate merge order.

---

## Coordination File

All agents read/write to: `docs/plans/v2-regression/COORDINATION.md`

**Check it every 15-20 minutes** for:
- Questions from other agents
- Blockers to report
- Interface changes from Agent 3

**Log format**:
```
[TIMESTAMP] [AGENT_1] STATUS: message
[TIMESTAMP] [AGENT_1] COMPLETED: task description
[TIMESTAMP] [AGENT_1] BLOCKED: description
[TIMESTAMP] [AGENT_1] [TO: AGENT_3] Q: question text
```
