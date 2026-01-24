# Agent 3: Services Layer Completion

> **Project**: `C:\HApps\claude-code-chat` (VS Code Extension)
> **Scope**: `src/services/**/*` ONLY (16 service files)
> **Worktree**: Create with `git worktree add .worktrees/services-agent main`
> **Mode**: `--dangerously-skip-permissions` recommended for speed

---

## CRITICAL: Coordination Protocol

**Every 15-20 minutes**, check and update: `docs/plans/v2-regression/COORDINATION.md`

```bash
# Check for messages from other agents
cat docs/plans/v2-regression/COORDINATION.md

# Log your progress (append, don't overwrite)
echo "[$(date -Iseconds)] [AGENT_3] STATUS: Working on Task X" >> docs/plans/v2-regression/COORDINATION.md
```

---

## Your Mission

You are the **Services Specialist**. You have SOLE ownership of `src/services/`. No other agent will touch these files. Your job is to:
1. Ensure all 16 services are properly exported
2. Verify interfaces match what Agent 1 needs
3. Add security features (deny list, audit logging)
4. Create shared types file

**NOTE**: Agent 1 will be importing these services. If you change any interface, LOG IT to the coordination file immediately so Agent 1 knows!

---

## Pre-Flight Checklist

```bash
# 1. Create isolated worktree
git worktree add .worktrees/services-agent -b feature/services-completion main
cd .worktrees/services-agent

# 2. Verify your scope (should see 16+ .ts files)
ls src/services/

# 3. Log start to coordination file
echo "[$(date -Iseconds)] [AGENT_3] STATUS: STARTED" >> docs/plans/v2-regression/COORDINATION.md
```

---

## Tasks (In Order)

### Task 1: Verify All Exports in index.ts

**Location**: `src/services/index.ts`

Ensure ALL services are exported. Current state should include:

```typescript
// Verify these are all present:
export { BackupService } from './BackupService';
export { ConversationManager } from './ConversationManager';
export { ProcessManager } from './ProcessManager';
export { PermissionsManager } from './PermissionsManager';
export { MessageRouter, getMessageRouter } from './MessageRouter';
export { PanelManager } from './PanelManager';
export * from './CliSchemas';
export { MessageDebouncer } from './MessageDebouncer';
export { MemoryMonitor, getMemoryMonitor } from './MemoryMonitor';
export { StreamBuffer, createStreamBuffer } from './StreamBuffer';
export { McpService, getMcpService } from './McpService';
export { GitService } from './GitService';
export { SessionManager } from './SessionManager';
export { MetricsService } from './MetricsService';
export { StreamProcessor } from './StreamProcessor';
export { TerminalManager } from './TerminalManager';
```

### Task 2: Verify StreamBuffer Interface

**Location**: `src/services/StreamBuffer.ts`

Ensure the interface matches what extension.ts needs:

```typescript
export interface ParsedJSON {
  data: unknown;  // The parsed JSON object
  raw: string;    // Original string (for debugging)
}

export class StreamBuffer {
  parse(chunk: string): ParsedJSON[];  // Returns array of parsed objects
  flush(): string | undefined;          // Get remaining unparsed content
  reset(): void;                        // Clear buffer state
}

export function createStreamBuffer(): StreamBuffer;
```

### Task 3: Verify TerminalManager Callbacks Interface

**Location**: `src/services/TerminalManager.ts`

Ensure callbacks interface is complete:

```typescript
export interface TerminalManagerCallbacks {
  postMessage: (message: { type: string; data?: any }) => void;
  onMCPTerminalClosed?: (panelId?: string, sessionId?: string) => void;
}

export class TerminalManager {
  constructor(config: ClaudeSpawnConfig, callbacks: TerminalManagerCallbacks);
  updateConfig(config: ClaudeSpawnConfig): void;
  openLoginTerminal(): TerminalResult;
  openModelTerminal(sessionId?: string): TerminalResult;
  openUsageTerminal(usageType: 'plan' | 'api'): TerminalResult;
  executeSlashCommand(command: string, sessionId?: string): TerminalResult | null;
  openMCPTerminal(sessionId: string, panelId?: string): TerminalResult | null;
  runInstallCommand(): void;
}
```

### Task 4: Add Non-JSON Fallback to StreamBuffer (P1)

**Location**: `src/services/StreamBuffer.ts`

Add a method to handle raw text that isn't JSON:

```typescript
export class StreamBuffer {
  // ... existing methods ...

  /**
   * Parse chunk, returning both JSON objects and raw text lines.
   * Raw text is text that doesn't look like JSON (no opening brace).
   */
  parseWithFallback(chunk: string): { json: ParsedJSON[]; rawLines: string[] } {
    const json = this.parse(chunk);

    // Collect any non-JSON lines from the buffer
    const rawLines: string[] = [];
    const bufferLines = this._buffer.split('\n');

    for (const line of bufferLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('{')) {
        rawLines.push(trimmed);
      }
    }

    return { json, rawLines };
  }
}
```

### Task 5: Add Deny List to PermissionsManager (P1)

**Location**: `src/services/PermissionsManager.ts`

Add a hardcoded deny list for dangerous commands:

```typescript
// At top of file, add constant:
const DENY_LIST = [
  /rm\s+-rf\s+\//, // rm -rf /
  /rm\s+-rf\s+~/, // rm -rf ~
  /mkfs\./,        // Format commands
  /dd\s+if=.*of=\/dev/, // Disk overwrite
  /:(){ :|:& };:/, // Fork bomb
  />\s*\/dev\/sda/, // Write to disk
  /sudo\s+rm/,     // sudo rm anything
  /chmod\s+-R\s+777\s+\//, // chmod 777 /
];

// Add method:
export class PermissionsManager {
  // ... existing methods ...

  /**
   * Check if a command matches the deny list.
   * Returns true if the command should be BLOCKED.
   */
  isDenied(command: string): boolean {
    for (const pattern of DENY_LIST) {
      if (pattern.test(command)) {
        console.warn(`[PermissionsManager] DENIED dangerous command: ${command}`);
        return true;
      }
    }
    return false;
  }
}
```

### Task 6: Add Audit Logging to PermissionsManager (P1)

**Location**: `src/services/PermissionsManager.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class PermissionsManager {
  private _auditLogPath: string;

  constructor(callbacks: PermissionsManagerCallbacks) {
    // ... existing initialization ...
    this._auditLogPath = path.join(os.homedir(), '.claude', 'permissions-audit.jsonl');
  }

  /**
   * Log a permission decision for auditing
   */
  private _logAudit(entry: {
    timestamp: string;
    toolName: string;
    command?: string;
    decision: 'approved' | 'denied' | 'auto-approved';
    reason?: string;
  }): void {
    try {
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this._auditLogPath, line, 'utf8');
    } catch (error) {
      console.error('[PermissionsManager] Failed to write audit log:', error);
    }
  }

  // Call _logAudit in approve/deny methods
}
```

### Task 7: Verify ProcessManager Has Heartbeat

**Location**: `src/services/ProcessManager.ts`

Ensure heartbeat monitoring exists (around lines 320-370):

```typescript
export class ProcessManager {
  private _lastActivityTimestamp: number = Date.now();
  private _heartbeatInterval: NodeJS.Timeout | null = null;

  startHeartbeatMonitoring(intervalMs: number = 30000): void {
    this.stopHeartbeatMonitoring();

    this._heartbeatInterval = setInterval(() => {
      const timeSinceActivity = Date.now() - this._lastActivityTimestamp;

      // Adaptive timeout: longer during "thinking"
      const timeout = this._isThinking ? 120000 : 60000;

      if (timeSinceActivity > timeout) {
        console.warn('[ProcessManager] Process unresponsive, triggering restart');
        this.kill();
        this._callbacks.onError(new Error('Process became unresponsive'));
      }
    }, intervalMs);
  }

  stopHeartbeatMonitoring(): void {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }

  updateActivityTimestamp(): void {
    this._lastActivityTimestamp = Date.now();
  }
}
```

### Task 8: Create Shared Types File (P1)

**Create**: `src/services/shared-types.ts`

```typescript
/**
 * Shared types between extension.ts and frontend.
 * Single source of truth for message payloads.
 */

export interface WebviewMessage {
  type: string;
  data?: unknown;
}

export interface SendMessagePayload {
  text: string;
  planMode?: boolean;
  thinkingMode?: boolean;
  images?: string[];
}

export interface SessionInfo {
  sessionId: string;
  tools: string[];
  mcpServers: string[];
}

export interface TokenUpdate {
  totalTokensInput: number;
  totalTokensOutput: number;
  currentInputTokens?: number;
  currentOutputTokens?: number;
}

// Add more shared types as needed
```

Add export to index.ts:
```typescript
export * from './shared-types';
```

---

## DO NOT TOUCH

- `src/extension.ts` - Agent 1's domain
- `src/webview/**/*` - Agent 2's domain
- Any files not in `src/services/`

---

## Completion Checklist

- [ ] Task 1: All services exported in index.ts (verify 16+ exports)
- [ ] Task 2: StreamBuffer interface verified (parse, flush, reset methods)
- [ ] Task 3: TerminalManager interface verified (all 7 methods present)
- [ ] Task 4: Non-JSON fallback added (parseWithFallback method)
- [ ] Task 5: Deny list added to PermissionsManager (DENY_LIST + isDenied method)
- [ ] Task 6: Audit logging added to PermissionsManager (_logAudit method)
- [ ] Task 7: Heartbeat verified in ProcessManager (startHeartbeatMonitoring exists)
- [ ] Task 8: shared-types.ts created and exported
- [ ] Code compiles: `npm run compile`

---

## When Done

```bash
# 1. Log completion to coordination file
echo "[$(date -Iseconds)] [AGENT_3] COMPLETED: All 8 tasks finished" >> docs/plans/v2-regression/COORDINATION.md

# 2. Commit your changes
git add src/services/
git commit -m "feat: complete services layer with security and shared types"

# 3. Verify build
npm run compile

# 4. Log final status
echo "[$(date -Iseconds)] [AGENT_3] STATUS: Build verified, ready for merge" >> docs/plans/v2-regression/COORDINATION.md
```

**DO NOT** remove the worktree yet - wait for all agents to complete and coordinate merge order.

---

## Coordination File

All agents read/write to: `docs/plans/v2-regression/COORDINATION.md`

**Check it every 15-20 minutes** for:
- Questions from Agent 1 about service interfaces
- Blockers to report
- Status updates

**Log format**:
```
[TIMESTAMP] [AGENT_3] STATUS: message
[TIMESTAMP] [AGENT_3] COMPLETED: task description
[TIMESTAMP] [AGENT_3] BLOCKED: description
[TIMESTAMP] [AGENT_3] [TO: AGENT_1] INTERFACE_CHANGE: description of what changed
```

---

## Important Notes

- **You should complete FIRST** - Agent 1 depends on your exports being correct
- If you change ANY interface signature, immediately log to COORDINATION.md
- Agent 1 will import: `StreamBuffer`, `createStreamBuffer`, `TerminalManager`, `CliSchemas`, and the Zod schemas
- The ClaudeSpawnConfig type is in `src/utils/spawn-config.ts` (NOT your scope, but TerminalManager uses it)
