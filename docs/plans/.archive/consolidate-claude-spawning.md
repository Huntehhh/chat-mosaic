# Refactor: Consolidate Claude Process Spawning

## Problem

Claude process spawning logic is duplicated across 4+ locations:

| Location | Purpose | Spawn Method |
|----------|---------|--------------|
| `_spawnPanelProcess()` | Per-panel background processes | `cp.spawn()` |
| `ProcessManager.spawn()` | Shared background process | `cp.spawn()` |
| `_prespawnClaudeProcess()` | Pre-warm process on load | Uses ProcessManager |
| `_sendMessageToClaude()` | Main message sending | Uses ProcessManager |
| `_executeSlashCommand()` | Terminal commands | `terminal.sendText()` |
| `_openMCPTerminal()` | Interactive MCP terminal | `terminal.sendText()` |

### Issues

1. **Args built in multiple places** - Similar but slightly different logic
2. **Easy to miss flags** - Like the `--mcp-config` bug we just fixed
3. **Duplication** - `_spawnPanelProcess` duplicates ProcessManager functionality
4. **Inconsistency** - Different places may use different defaults

---

## Proposed Solution

### 1. Create `buildClaudeArgs()` Utility

Single function to build CLI arguments:

```typescript
// src/utils/claude-args.ts

export interface ClaudeArgsOptions {
  sessionId?: string;
  model?: string;
  yoloMode?: boolean;
  planMode?: boolean;
  slashCommand?: string;  // e.g., '/init', '/config'
  verbose?: boolean;      // default: true for stream-json
  streamJson?: boolean;   // default: true
}

export function buildClaudeArgs(options: ClaudeArgsOptions): string[] {
  const args: string[] = [];

  // Output format (required for extension communication)
  if (options.streamJson !== false) {
    if (options.verbose !== false) {
      args.push('--verbose');
    }
    args.push('--output-format', 'stream-json');
    args.push('--input-format', 'stream-json');
  }

  // Permission handling
  if (options.planMode) {
    args.push('--permission-prompt-tool', 'stdio');
    args.push('--permission-mode', 'plan');
  } else if (options.yoloMode) {
    args.push('--dangerously-skip-permissions');
  } else {
    args.push('--permission-prompt-tool', 'stdio');
  }

  // Model selection
  if (options.model && options.model !== 'default') {
    args.push('--model', options.model);
  }

  // Session resume
  if (options.sessionId) {
    args.push('--resume', options.sessionId);
  }

  // Slash command (for terminal execution)
  if (options.slashCommand) {
    args.unshift(`/${options.slashCommand}`);
  }

  return args;
}
```

### 2. Refactor ProcessManager

Make ProcessManager the **single source** for background process spawning:

```typescript
// src/services/ProcessManager.ts

export interface ProcessSpawnOptions {
  cwd: string;
  sessionId?: string;
  model?: string;
  yoloMode?: boolean;
  planMode?: boolean;
  wslEnabled?: boolean;
  wslDistro?: string;
  claudePath?: string;
}

class ProcessManager {
  spawn(options: ProcessSpawnOptions): void {
    const args = buildClaudeArgs({
      sessionId: options.sessionId,
      model: options.model,
      yoloMode: options.yoloMode,
      planMode: options.planMode,
    });

    // Handle WSL vs native
    const { command, spawnArgs } = this.buildSpawnCommand(args, options);

    this._currentProcess = cp.spawn(command, spawnArgs, {
      cwd: options.cwd,
      shell: process.platform === 'win32',
      // ...
    });
  }
}
```

### 3. Eliminate `_spawnPanelProcess`

Per-panel processes should use ProcessManager with panel-specific session IDs:

```typescript
// Before: Duplicate spawning logic in _spawnPanelProcess
// After: Use ProcessManager with panel context

private _panelProcessManagers: Map<string, ProcessManager> = new Map();

private getOrCreatePanelProcess(panelId: string): ProcessManager {
  if (!this._panelProcessManagers.has(panelId)) {
    const pm = new ProcessManager(/* callbacks */);
    this._panelProcessManagers.set(panelId, pm);
  }
  return this._panelProcessManagers.get(panelId)!;
}
```

### 4. Simplify Terminal Commands

```typescript
private _executeSlashCommand(command: string): void {
  const args = buildClaudeArgs({
    sessionId: this._currentSessionId,
    slashCommand: command,
    streamJson: false,  // Terminals don't need stream-json
    verbose: false,
  });

  const terminal = vscode.window.createTerminal({ name: `Claude /${command}` });
  terminal.sendText(`claude ${args.join(' ')}`);
  terminal.show();
}
```

---

## Migration Steps

1. **Create `src/utils/claude-args.ts`** with `buildClaudeArgs()` function
2. **Update ProcessManager** to use `buildClaudeArgs()`
3. **Update `_sendMessageToClaude`** to pass options to ProcessManager
4. **Remove `_spawnPanelProcess`** - use ProcessManager instances per panel
5. **Update slash commands** to use `buildClaudeArgs()`
6. **Test all spawn paths**:
   - New chat message
   - Resume session
   - Per-panel processes
   - `/mcp`, `/init`, `/config` commands
   - Plan mode
   - Yolo mode

---

## Benefits

- **Single source of truth** for CLI arguments
- **Easier to add/remove flags** - change in one place
- **Consistent behavior** across all spawn paths
- **Easier testing** - can unit test `buildClaudeArgs()`
- **Reduced code** - eliminate ~100 lines of duplication

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils/claude-args.ts` | **NEW** - buildClaudeArgs function |
| `src/services/ProcessManager.ts` | Use buildClaudeArgs, simplify spawn |
| `src/extension.ts` | Remove _spawnPanelProcess, update callers |
