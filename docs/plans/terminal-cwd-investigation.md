# Terminal CWD Investigation - Environment Variable Hypothesis

## Problem Summary

Running `/mcp` command creates duplicate project entries in `~/.claude/.claude.json` with different path formats:
- `"C:\\HApps\\job-automation"` (backslashes - from background process)
- `"C:/HApps/job-automation"` (forward slashes - from terminal)

Additionally, the initial background process was able to execute MCPs that should have been disabled in `.claude.json`, suggesting Claude may not be reading from the expected project configuration.

---

## We Do NOT Pass Any Explicit Path Argument to Claude

Claude CLI does not have a `--cwd` flag. It determines project path from the shell's current working directory.

Available path-related flags from `claude --help`:
- `--add-dir <directories...>` - Additional directories to allow tool access to

No explicit project path argument exists.

---

## Key Difference: Environment Variables

Looking at the activation logs:
```
[Extension Host] Set CLAUDE_CODE_SSE_PORT=36577 in terminal environment (in-memory)
[Extension Host] Set ENABLE_IDE_INTEGRATION=true in terminal environment (in-memory)
```

### Background Process (`cp.spawn`)

```typescript
proc = cp.spawn('powershell', ['-NoProfile', '-Command', psCommand], {
  env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  stdio: ['pipe', 'pipe', 'pipe']
});
```

- Inherits extension host's `process.env`
- Does NOT have `ENABLE_IDE_INTEGRATION` or `CLAUDE_CODE_SSE_PORT`
- Only adds `FORCE_COLOR: '0'` and `NO_COLOR: '1'`

### Terminal (`vscode.window.createTerminal`)

- VS Code manages terminal environment separately
- HAS `ENABLE_IDE_INTEGRATION=true` and `CLAUDE_CODE_SSE_PORT=<port>`
- May have other `__VSCODE_*` environment variables

---

## Hypothesis

Claude may be getting the project path from VS Code's terminal environment (maybe some `__VSCODE_*` variable or similar) when `ENABLE_IDE_INTEGRATION=true`, causing it to see a different path than when run from the background process.

When `ENABLE_IDE_INTEGRATION=true`:
- Claude might look for IDE-specific path information
- Could be reading from a VS Code environment variable that uses forward slashes
- May behave differently in terms of project path detection

When `ENABLE_IDE_INTEGRATION` is not set (background process):
- Claude uses standard shell current directory detection
- `Set-Location -LiteralPath` with backslashes is respected

---

## Potential Solutions to Test

1. **Unset `ENABLE_IDE_INTEGRATION` for MCP terminal**
   - Pass explicit `env` option to `createTerminal` without IDE integration vars

2. **Set same environment in terminal as background process**
   - Explicitly set `FORCE_COLOR=0`, `NO_COLOR=1` and unset IDE vars

3. **Investigate what VS Code environment variables exist**
   - Log all environment variables in both contexts
   - Look for `__VSCODE_*`, `TERM_PROGRAM`, `PWD`, etc.

4. **Check Claude's IDE integration code**
   - Understand how Claude uses `ENABLE_IDE_INTEGRATION`
   - Find if it reads path from somewhere other than shell CWD

---

## Files Involved

| File | Location | Purpose |
|------|----------|---------|
| `extension.ts` | Line 684-687 | Background process spawn with explicit env |
| `TerminalManager.ts` | `_createTerminal()` | Terminal creation (no explicit env) |
| VS Code internal | Terminal environment | Sets `ENABLE_IDE_INTEGRATION`, `CLAUDE_CODE_SSE_PORT` |

---

## Next Steps

1. Add logging to capture environment variables in both contexts
2. Test unsetting `ENABLE_IDE_INTEGRATION` in terminal
3. Compare full environment between background process and terminal
