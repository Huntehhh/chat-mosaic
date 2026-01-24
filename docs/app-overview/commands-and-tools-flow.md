# Commands and Tools Flow

How slash commands and tool execution work in the extension.

---

## 1. MCP Tools

MCP (Model Context Protocol) tools are exposed by external servers configured in `mcp-servers.json`.

### Configuration

**File**: `<storage>/mcp/mcp-servers.json`
```json
{
  "mcpServers": {
    "perplexity": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-perplexity"],
      "env": { "PERPLEXITY_API_KEY": "..." }
    }
  }
}
```

### CLI Flag

Passed at process spawn (`extension.ts:1163-1165`):
```
--mcp-config <path-to-mcp-servers.json>
```

### Tool Naming Convention

MCP tools appear as: `mcp__<server>__<tool>`

Example: `mcp__perplexity__search`

### Stream Output (tool_use)

```json
{
  "type": "assistant",
  "message": {
    "content": [{
      "type": "tool_use",
      "id": "toolu_xxx",
      "name": "mcp__perplexity__search",
      "input": { "query": "fun fact about cats" }
    }]
  }
}
```

### Stream Output (tool_result)

```json
{
  "type": "user",
  "message": {
    "content": [{
      "type": "tool_result",
      "tool_use_id": "toolu_xxx",
      "content": "[{\"type\":\"text\",\"text\":\"...\"}]"
    }]
  }
}
```

---

## 2. Slash Commands

### Execution Flow

```
UI: executeSlashCommand(command)
       ↓
vscode.postMessage({ type: 'executeSlashCommand', command })
       ↓
Backend: _executeSlashCommand(command)
       ↓
Opens NEW terminal with: claude /<command> --resume <sessionId>
```

### Special Case: /compact

`/compact` runs **in-process** instead of opening terminal (`extension.ts:3829-3831`):
```typescript
if (command === 'compact') {
    this._sendMessageToClaude(`/${command}`);
    return;
}
```

Sent to stdin as a regular user message:
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{ "type": "text", "text": "/compact" }]
  }
}
```

### All Other Commands

Open a new VS Code terminal (`extension.ts:3849-3858`):
```bash
claude /<command> --resume <sessionId>
```

Examples:
- `/init` → `claude /init --resume abc123`
- `/mcp` → `claude /mcp --resume abc123`
- `/config` → `claude /config --resume abc123`

**Why terminal?** These commands require interactive input (e.g., selecting options, entering values) that can't be handled via stdin JSON.

---

## 3. The `/mcp` Slash Command

Opens an **interactive Claude session** in a VS Code terminal for MCP management. User can use Claude CLI keyboard shortcuts (Shift+Tab) to enable/disable MCPs. When the terminal is closed, the background Claude process is restarted to pick up MCP changes.

### Execution Flow

```
UI: clicks /mcp or types /mcp
       ↓
vscode.postMessage({ type: 'executeSlashCommand', command: 'mcp' })
       ↓
Backend: _executeSlashCommand('mcp') → _openMCPTerminal()
       ↓
vscode.window.createTerminal({ name: 'Claude MCP Manager' })
       ↓
terminal.sendText('claude --resume <sessionId>')  // Interactive session, NOT /mcp
       ↓
terminal.show()
       ↓
vscode.window.onDidCloseTerminal() listener registered
       ↓
[User manages MCPs via keyboard shortcuts]
       ↓
User closes terminal
       ↓
_restartBackgroundProcessForMCP() called
       ↓
Background Claude process killed and will restart on next message
```

### Code (`extension.ts:4025-4124`)

```typescript
// _openMCPTerminal()
const terminal = vscode.window.createTerminal({
    name: 'Claude MCP Manager',
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
});

// Opens interactive Claude session (not /mcp command)
terminal.sendText(`claude --resume ${sessionId}`);
terminal.show();

// Listen for terminal close to restart background process
const disposable = vscode.window.onDidCloseTerminal(closedTerminal => {
    if (closedTerminal === terminal) {
        disposable.dispose();
        this._restartBackgroundProcessForMCP();
    }
});

// _restartBackgroundProcessForMCP()
// Kills existing panel process or shared ProcessManager
// Next message will respawn with --resume, picking up MCP changes
```

### Messages Sent

| Direction | Type | Data |
|-----------|------|------|
| Webview → Backend | `executeSlashCommand` | `{ command: 'mcp' }` |
| Backend → Webview | `info` | `'Interactive Claude session opened...'` |
| Backend → Webview | `info` | `'MCP changes applied. Session will resume...'` |

### Key Differences from Other Commands

| Aspect | `/mcp` | Other commands (e.g., `/init`) |
|--------|--------|-------------------------------|
| Terminal command | `claude --resume <id>` | `claude /<cmd> --resume <id>` |
| Purpose | Interactive MCP management | One-shot command execution |
| Terminal close handling | Restarts background process | No action |
| Post-terminal state | MCPs refreshed on next message | No change |

### Capabilities

| Capability | Supported |
|------------|-----------|
| Open interactive Claude session | ✓ |
| User manages MCPs via shortcuts | ✓ |
| Detect terminal close | ✓ |
| Restart background process | ✓ |
| Read terminal output | ✗ |
| Send keystrokes after launch | ✗ |

---

## 4. Built-in Tools

Native Claude Code tools (no MCP prefix).

### Tool Use Flow

```
Claude decides to use tool
       ↓
Streams: { type: "assistant", message.content: [{ type: "tool_use", name: "Read", ... }] }
       ↓
Extension shows tool_use in UI
       ↓
(If permission required) Control request → UI prompt → Control response
       ↓
Claude executes tool
       ↓
Streams: { type: "user", message.content: [{ type: "tool_result", ... }] }
       ↓
Extension shows tool_result in UI
```

### Common Tools

| Tool | Description |
|------|-------------|
| `Read` | Read file contents |
| `Write` | Create new file |
| `Edit` | Modify existing file |
| `MultiEdit` | Multiple edits in one file |
| `Bash` | Execute shell command |
| `Glob` | Find files by pattern |
| `Grep` | Search file contents |
| `Task` | Spawn sub-agent |
| `TodoWrite` | Update todo list |
| `WebFetch` | Fetch URL content |
| `WebSearch` | Web search |

---

## 5. Key Files

| Component | File | Lines |
|-----------|------|-------|
| Slash command handler | `extension.ts` | 3890-3934 |
| MCP config path | `extension.ts` | 1163-1165 |
| Tool use processing | `extension.ts` | 1314-1398 |
| Tool result processing | `extension.ts` | 1403-1470 |
| MCP server CRUD | `extension.ts` | 2596-2710 |
| MCP service | `services/McpService.ts` | Full file |
