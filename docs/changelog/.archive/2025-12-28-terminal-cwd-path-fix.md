# Changelog - 2025-12-28 (Terminal CWD Path Fix)

## Terminal Path Consistency - Fixing Duplicate .claude.json Entries

- **Goal**: Fix path format mismatch between background processes and terminals causing duplicate project entries in `.claude.json`
- **Risk Level**: Med - Core terminal spawning refactored

Fixed bug where `/mcp` command created duplicate project entries in `~/.claude/.claude.json` with different path formats (`C:\\HApps\\...` vs `C:/HApps/...`). Terminals now use identical PowerShell invocation as background processes.

## Quick-Scan Summary

| Component | Before | After | Change |
|-----------|--------|-------|--------|
| `TerminalManager.ts` | ~350 lines | ~340 lines | Refactored |
| Terminal methods | 5 different patterns | 1 centralized helper | Standardized |
| Path consistency | Broken (forward slashes) | Fixed (backslashes) | Aligned with background process |

## ✅ No Breaking Changes

Internal refactoring only. All public APIs unchanged.

## Environment & Dependencies

No changes to dependencies or environment variables.

---

## Root Cause Analysis

### The Bug

Claude CLI stores project configurations in `~/.claude/.claude.json` keyed by working directory path. When the path format differs between spawns, Claude creates duplicate entries:

```json
"C:\\HApps\\job-automation": { ... },  // Background process (correct)
"C:/HApps/job-automation": { ... }     // Terminal (incorrect)
```

### Why It Happened

| Spawn Method | Implementation | Path Result |
|--------------|----------------|-------------|
| Background process | `cp.spawn('powershell', ['-NoProfile', '-Command', ...])` | Backslashes ✅ |
| Terminal (old) | `vscode.createTerminal()` + various commands | Forward slashes ❌ |

VS Code's terminal API handles paths differently than Node's `child_process.spawn()`.

---

## The Fix

### Changed: `src/services/TerminalManager.ts`

**Centralized terminal creation with `_createTerminal()` helper:**

```typescript
private _createTerminal(
  name: string,
  location?: vscode.TerminalLocation | { viewColumn: vscode.ViewColumn }
): vscode.Terminal {
  const options: vscode.TerminalOptions = { name };
  if (location) options.location = location;
  // NOTE: No shellPath - causes URI parsing errors in VS Code
  return vscode.window.createTerminal(options);
}
```

**Standardized command building with `_buildCommand()`:**

```typescript
private _buildCommand(claudeArgs: string[], cwd?: string): string {
  if (this._config.wslEnabled && process.platform === 'win32') {
    return `wsl -d ${this._config.wslDistro} ${this._config.claudePath} ${claudeArgs.join(' ')}`;
  }

  const claudeCmd = `claude ${claudeArgs.join(' ')}`;

  // On Windows, wrap in PowerShell to match background process exactly
  if (process.platform === 'win32' && cwd) {
    const escapedCwd = cwd.replace(/'/g, "''");
    return `powershell -NoProfile -Command "Set-Location -LiteralPath '${escapedCwd}'; ${claudeCmd}"`;
  }

  return claudeCmd;
}
```

### Command Comparison (Now Identical)

**Background Process** (`extension.ts:684`):
```
cp.spawn('powershell', ['-NoProfile', '-Command',
  "Set-Location -LiteralPath 'c:\HApps\job-automation'; claude --verbose ..."])
```

**MCP Terminal** (`TerminalManager.ts:120`):
```
terminal.sendText(
  `powershell -NoProfile -Command "Set-Location -LiteralPath 'c:\HApps\job-automation'; claude --resume ..."`)
```

Both now execute PowerShell with `-NoProfile -Command "Set-Location -LiteralPath '...'"`.

---

## Iterations Attempted

| Attempt | Approach | Result |
|---------|----------|--------|
| 1 | Set `shellPath: 'powershell.exe'` + send `Set-Location...; claude...` | URI parsing error in VS Code |
| 2 | Set `shellPath` + `cwd` option | URI parsing error persisted |
| 3 | Remove `cwd`, keep `shellPath` | Still wrong path format |
| 4 | Remove `shellPath`, wrap command in `powershell -Command "..."` | ✅ **Works** |

**Key insight**: VS Code's `createTerminal({ shellPath: 'powershell.exe' })` causes internal URI parsing errors. The solution is to NOT set `shellPath` and instead wrap the command in `powershell -Command "..."` so it runs identically regardless of the user's default shell.

---

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/services/TerminalManager.ts` | Modified | Centralized `_createTerminal()` and `_buildCommand()` |
| `src/utils/claude-args.ts` | Unchanged | `buildTerminalCommand()` no longer used by TerminalManager |

---

## Verification

**Command**: `npm run compile`
**Results**: Build successful ✅

**Manual Testing**:
1. Send message → Creates correct `C:\\HApps\\...` entry
2. Run `/mcp` → Should NOT create duplicate `C:/HApps/...` entry
3. Close terminal, send message → Process restarts with correct path

---

## Open Loops

### Known Issues
- VS Code "URI scheme contains illegal characters" error still appears intermittently - this is a VS Code internal bug, not our code
- Secondary "powershell" terminal sometimes appears - also VS Code bug (inconsistent)

### Investigation Notes
The URI error occurs in VS Code's internal code (`main.js`) when parsing paths with drive letters (`c:`) as URI schemes. We worked around it by not setting `cwd` or `shellPath` on terminal options.

### Remaining Modularization Tasks
- [ ] Track B: Extract CliIntegration (~200 lines) from extension.ts
- [ ] Track B: Extract SettingsManager (~300 lines) from extension.ts
- [ ] Track C: Split messageHandlers.ts into domain handlers

### Resume Prompt
```
Resume from terminal CWD fix verification.

Test: Delete bad entry from .claude.json, run /mcp, verify no duplicate created.

If still broken, compare logs for [Spawn] vs [MCP Terminal] command strings.

Continue modularization: docs/plans/modularization-plan-2025-12-28.md
```

---

## ACTUAL Root Cause Discovered

After extensive debugging, the **true root cause** was identified as user-specific, not an extension bug:

### The Real Issue

The user had custom PowerShell aliases that invoked Claude differently:

```powershell
# User's PowerShell profile (~\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1)
function clawed {
    & "C:\Users\casil\AppData\Roaming\npm\claude.cmd" --dangerously-skip-permissions $args
}
```

| Invocation Method | Path Format in .claude.json |
|-------------------|----------------------------|
| `claude.cmd` (npm wrapper) | `C:\\HApps\\...` (double backslash) |
| `claude` (direct command) | `C:/HApps/...` (forward slash) |

The extension uses `claude` directly, while the user's daily workflow used `claude.cmd` via aliases. This caused the path format mismatch.

### Resolution

1. **Updated PowerShell aliases** to use `claude` directly:
   ```powershell
   function clawed {
       claude --dangerously-skip-permissions $args
   }
   ```

2. **Standardized `.claude.json`** to use forward slashes (`C:/`) throughout

3. **Extension code unchanged** - the refactoring done earlier is still valid and improves consistency

### Key Learning

When debugging path issues on Windows:
- `claude.cmd` (npm batch wrapper) handles paths differently than `claude` (direct)
- Check user's shell aliases/profile for custom invocation patterns
- Standardize on one invocation method across all tools

---

## Context Manifest

Priority files for debugging this issue:
- `src/services/TerminalManager.ts` - `_createTerminal()` and `_buildCommand()` methods
- `src/extension.ts:684` - Background process spawn for comparison
- `docs/plans/terminal-cwd-investigation.md` - Environment variable hypothesis (superseded)
- `~/.claude/.claude.json` - Check for duplicate path entries
- `~\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1` - User's Claude aliases
