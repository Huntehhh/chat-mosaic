# File Open Relocation Feature

## Problem
When the extension panel is focused, clicking files in VS Code's Explorer sidebar opens them in the same pane as the extension (replacing/competing with it). Users want files to open in an adjacent pane automatically.

## Solution
Listen for file opens in the same ViewColumn as the extension panel, then automatically relocate them to an adjacent column.

## Implementation

### File to Update
`src/extension.ts`

### Changes Required

1. **Track panel ViewColumn** - The panel's column can change if user drags it. Track via `onDidChangeViewState`:
```typescript
panel.onDidChangeViewState((e) => {
    panelState.viewColumn = e.webviewPanel.viewColumn;
});
```

2. **Add file relocation listener** in `activate()` function (around line 56):
```typescript
const fileRelocationDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (!editor) return;

    // Get the extension panel's current ViewColumn
    const panelColumn = provider.getActivePanelColumn();
    if (!panelColumn) return;

    // If file opened in same column as our panel, relocate it
    if (editor.viewColumn === panelColumn) {
        const targetColumn = panelColumn === vscode.ViewColumn.One
            ? vscode.ViewColumn.Two
            : vscode.ViewColumn.One;

        await vscode.window.showTextDocument(editor.document, {
            viewColumn: targetColumn,
            preserveFocus: false
        });
    }
});
context.subscriptions.push(fileRelocationDisposable);
```

3. **Add helper method** to `ClaudeChatProvider` class:
```typescript
public getActivePanelColumn(): vscode.ViewColumn | undefined {
    const panelState = this._panels.get(this._activePanelId);
    return panelState?.panel.viewColumn;
}
```

## Notes
- May cause brief flicker as file opens then moves (VS Code limitation)
- Only relocates when extension panel is in the same column
- Moves to ViewColumn.One or Two (whichever is opposite)

---

# Terminal CWD Inconsistency Bug

## Problem
Terminal commands (like `/mcp`, `/context`) may execute without `Set-Location` PowerShell wrapper, causing Claude CLI to use wrong working directory.

## Root Cause: Stale Config + Multiple CWD Sources

### Source 1: `_spawnConfig.cwd` (STALE)
Set once at extension activation, never updated:
```typescript
// extension.ts:296 - Set ONCE in constructor
this._spawnConfig = buildSpawnConfig();

// spawn-config.ts:68-70 - Can be empty string!
const rawCwd = workspaceFolder ||
  vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
  '';  // <-- EMPTY STRING if no workspace
```

**Used by:**
- `_spawnPanelProcess()` (extension.ts:664)
- All TerminalManager methods (`openMCPTerminal`, `executeSlashCommand`, etc.)

### Source 2: Fresh Workspace Lookup (LIVE)
Computed fresh each call with `process.cwd()` fallback:
```typescript
// extension.ts:1111-1112
const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
const cwd = normalizePathForOS(workspaceFolder ? workspaceFolder.uri.fsPath : process.cwd()) || process.cwd();
```

**Used by:**
- `_sendMessageToClaude()` (extension.ts:1111-1112)
- `_prespawnClaudeProcess()` (extension.ts:2846-2847)

## The Bug: Empty CWD Skips PowerShell Wrapper

In `buildTerminalCommand()` (claude-args.ts:52):
```typescript
if (process.platform === 'win32' && !wslEnabled && cwd) {  // <-- if cwd falsy...
  return {
    command: `powershell -NoProfile -Command "Set-Location -LiteralPath '${cwd}'; ${claudeCommand}"`,
    ...
  };
}
// Falls through to raw command without PowerShell wrapper
return { command: claudeCommand, needsSeparateCd: !!cwd };
```

## Missing Update: Config Never Refreshed

`TerminalManager.updateConfig()` exists but is **never called**:
```typescript
// TerminalManager.ts:65-67 - EXISTS
updateConfig(config: ClaudeSpawnConfig): void {
  this._config = config;
}

// extension.ts:1415-1432 - newSessionOnConfigChange() does NOT call it
public newSessionOnConfigChange() {
  this._initializeMCPConfig();
  this._newSession();
  // MISSING: this._spawnConfig = buildSpawnConfig();
  // MISSING: this._terminalManager.updateConfig(this._spawnConfig);
}
```

## Scenarios Causing Bug

| Scenario | Result |
|----------|--------|
| No workspace open at activation | `cwd = ''`, no PowerShell wrap |
| Workspace changed after activation | Stale cwd used for terminals |
| WSL config changed | `newSessionOnConfigChange()` doesn't update `_spawnConfig` |

## Expected vs Actual Command

**Expected (with cwd):**
```
powershell -NoProfile -Command "Set-Location -LiteralPath 'c:\HApps\project'; claude /context --resume abc123"
```

**Actual (if cwd empty):**
```
claude /context --resume abc123
```

## Fix Required

In `newSessionOnConfigChange()` and potentially on workspace folder change:
```typescript
// Rebuild spawn config
this._spawnConfig = buildSpawnConfig();

// Update TerminalManager
this._terminalManager.updateConfig(this._spawnConfig);
```

## Files Involved

| File | Line | Issue |
|------|------|-------|
| `extension.ts` | 296 | `_spawnConfig` set once, never updated |
| `extension.ts` | 1415-1432 | `newSessionOnConfigChange()` missing config rebuild |
| `spawn-config.ts` | 68-70 | Can return empty string for cwd |
| `claude-args.ts` | 52 | Condition skips PowerShell if cwd falsy |
| `TerminalManager.ts` | 65-67 | `updateConfig()` never called |
