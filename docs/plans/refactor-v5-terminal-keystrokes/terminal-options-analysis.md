# Terminal & Keystroke Streaming Options Analysis

**Created**: 2026-01-04
**Status**: Research/Planning
**Goal**: Enable interactive Claude CLI commands like `/mcp`, `/help`, etc.

---

## Current Architecture

### How We Spawn Claude CLI Today

```typescript
const spawnedProcess = cp.spawn('claude', args, {
  cwd: workspaceFolder,
  env: { ...process.env },
  shell: false,  // Direct spawn, no shell wrapper
  stdio: ['pipe', 'pipe', 'pipe']  // We control stdin/stdout/stderr
});
```

**Key characteristics:**
- **No shell**: We spawn `claude` directly, not via PowerShell/cmd
- **JSON messaging**: We use `--input-format stream-json` for structured communication
- **No TTY**: The process has no terminal attached, so it can't render interactive UI

### Why Interactive Commands Don't Work

Claude CLI's interactive commands (`/mcp`, `/help`, `/model`, etc.) require:
1. **TTY detection**: Claude checks if stdin is a TTY to enable interactive mode
2. **Raw keystroke input**: User types `/m` → `/mc` → `/mcp` → Enter
3. **ANSI rendering**: Claude draws menus, highlights, cursor movement
4. **Bidirectional streaming**: Keystrokes in, rendered output out

With `stdio: 'pipe'`, none of this works.

---

## Option A: Pseudo-Terminal (PTY) via node-pty

### Overview
Use `node-pty` to create a real pseudo-terminal that Claude thinks is an interactive shell.

### Implementation

```typescript
import * as pty from 'node-pty';

// Create PTY
const terminal = pty.spawn('claude', [], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: workspaceFolder,
  env: process.env,
});

// Stream keystrokes TO Claude
terminal.write('/mcp');
terminal.write('\r');  // Enter key

// Stream output FROM Claude (ANSI sequences included)
terminal.onData((data: string) => {
  webview.postMessage({ type: 'ptyOutput', data });
});

// Resize handling
terminal.resize(newCols, newRows);
```

### Frontend Requirements
Need a terminal emulator in the webview:

```typescript
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

const term = new Terminal({
  theme: { background: '#09090b', foreground: '#fafafa' },
  fontSize: 13,
  fontFamily: 'monospace',
});

// Mount to DOM
term.open(containerElement);

// Receive PTY output
vscode.onMessage((msg) => {
  if (msg.type === 'ptyOutput') {
    term.write(msg.data);
  }
});

// Send keystrokes
term.onData((data) => {
  vscode.postMessage({ type: 'ptyInput', data });
});
```

### Pros
- Full interactive support (all Claude CLI features work)
- Native terminal rendering (colors, cursor, menus)
- Mature library with good Windows support

### Cons
- **Native dependency**: `node-pty` requires node-gyp compilation
- **Bundle size**: xterm.js adds ~500KB
- **Complexity**: Managing terminal state, resize, scrollback
- **Mode switching**: Need to switch between JSON mode and PTY mode

### Dependencies
```json
{
  "node-pty": "^0.10.1",
  "xterm": "^5.3.0",
  "xterm-addon-fit": "^0.8.0"
}
```

---

## Option B: Hybrid Architecture

### Overview
Keep JSON streaming for normal chat, spawn PTY only for interactive commands.

### Implementation

```
┌─────────────────────────────────────────────────────────┐
│                        Webview                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐     ┌─────────────────────────────┐│
│  │  Chat Messages  │     │   Terminal Overlay          ││
│  │  (React/HTML)   │     │   (xterm.js, hidden until   ││
│  │                 │     │    interactive command)     ││
│  └─────────────────┘     └─────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                      Extension Host                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐     ┌─────────────────────────────┐│
│  │  ProcessManager │     │   PtyManager                ││
│  │  (JSON stdin)   │     │   (node-pty for /commands)  ││
│  │  Normal chat    │     │   Interactive mode only     ││
│  └─────────────────┘     └─────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Flow
1. User types `/mcp` in chat input
2. Frontend detects `/` prefix, shows terminal overlay
3. Backend spawns PTY, connects to overlay
4. User interacts directly with Claude CLI
5. When done, terminal closes, returns to JSON mode

### Pros
- Best of both worlds
- Terminal only loaded when needed
- Clean separation of concerns

### Cons
- Two communication channels to manage
- Context switching complexity
- State synchronization between modes

---

## Option C: Command Proxy (No PTY)

### Overview
Intercept interactive commands, fetch data via Claude CLI flags, render in React.

### Implementation
Instead of letting Claude render `/mcp` interactively, we:
1. Detect `/mcp` command
2. Run `claude --list-mcp-servers` (or similar) to get data
3. Render our own UI with the data

```typescript
// When user types /mcp
if (input.startsWith('/mcp')) {
  // Spawn separate process to get MCP list
  const result = await exec('claude mcp list --json');
  const servers = JSON.parse(result);

  // Show our own React-based MCP manager
  webview.postMessage({ type: 'showMcpManager', data: servers });
}
```

### Pros
- No native dependencies
- Full control over UI/UX
- Consistent with our React-based design

### Cons
- Must reimplement each command's UI
- May not have all functionality Claude CLI has
- Maintenance burden as Claude CLI evolves

---

## Option D: VS Code Integrated Terminal

### Overview
Use VS Code's built-in terminal API for interactive commands.

### Implementation

```typescript
// Create a VS Code terminal
const terminal = vscode.window.createTerminal({
  name: 'Claude Interactive',
  cwd: workspaceFolder,
});

// Show it
terminal.show();

// Send command
terminal.sendText('claude');
terminal.sendText('/mcp');
```

### Pros
- Zero dependencies
- Uses VS Code's native terminal
- User-familiar interface

### Cons
- Leaves our extension's UI
- Can't integrate results back into chat
- User context switch

---

## Comparison Matrix

| Criterion | PTY (A) | Hybrid (B) | Proxy (C) | VS Code Term (D) |
|-----------|---------|------------|-----------|------------------|
| Interactive support | ✅ Full | ✅ Full | ⚠️ Partial | ✅ Full |
| Native dependency | ❌ Required | ❌ Required | ✅ None | ✅ None |
| Bundle size impact | ❌ +500KB | ⚠️ +500KB (lazy) | ✅ None | ✅ None |
| UX consistency | ⚠️ Different | ⚠️ Overlay | ✅ React UI | ❌ Leaves app |
| Implementation effort | Medium | High | High | Low |
| Maintenance burden | Low | Medium | High | Low |

---

## Recommendation

### Short-term: Option C (Command Proxy)
- Intercept `/mcp`, `/model`, `/help` commands
- Fetch data via Claude CLI flags or API
- Render our own React UI

This approach:
- Requires no native dependencies
- Keeps UX consistent
- Gives us full control

### Long-term: Option B (Hybrid with PTY)
When we need full interactive support:
- Add `node-pty` as optional dependency
- Lazy-load xterm.js only when needed
- Show terminal overlay for complex commands

---

## Implementation Priority

1. **Phase 1**: Implement `/mcp` command proxy (show our MCP manager)
2. **Phase 2**: Implement `/model` command proxy (show model selector)
3. **Phase 3**: Evaluate PTY for remaining commands
4. **Phase 4**: Full hybrid architecture if needed

---

## Technical Notes

### Windows Shell Performance (Reference)

If we ever need a shell wrapper:

| Shell | Startup Time | Memory | Notes |
|-------|-------------|--------|-------|
| Direct spawn | ~5-10ms | Minimal | Current approach, best |
| cmd.exe | ~50-100ms | Low | Basic, no features |
| PowerShell 5.1 | ~200-500ms | Medium | Legacy, slow |
| PowerShell 7 | ~100-200ms | Medium | Faster than 5.1 |
| Git Bash | ~300-500ms | Higher | Unix compatibility |

**Current approach (direct spawn) is optimal.**

### node-pty Platform Support

| Platform | Support | Notes |
|----------|---------|-------|
| Windows | ✅ conpty | Windows 10 1809+ native |
| macOS | ✅ Native | Full support |
| Linux | ✅ Native | Full support |
| WSL | ⚠️ Via Windows | Works through wsl.exe |
