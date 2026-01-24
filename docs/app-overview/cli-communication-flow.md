# CLI Communication Flow

How the extension communicates with Claude Code CLI.

---

## 1. Initialization (Prespawn)

**When**: On conversation load (`loadConversation` → 200ms delay → `_prespawnClaudeProcess`)

**Command**: `claude` with args:
```
--output-format stream-json
--input-format stream-json
--verbose
--permission-prompt-tool stdio    (or --dangerously-skip-permissions if yolo)
--mcp-config <path>               (if custom MCP servers)
--permission-mode plan            (if plan mode)
--model <name>                    (if non-default)
--resume <sessionId>              (if existing session)
```

**Spawn options**:
```typescript
{ shell: true, cwd: workspaceFolder, stdio: ['pipe','pipe','pipe'] }
```

**Process reuse**: Subsequent messages go to existing process via stdin. No respawn unless:
- Session changes (kill old, prespawn new)
- Process dies/errors
- User clicks "New Chat"

---

## 2. Message Sending

**JSON to stdin** (`extension.ts:1127-1138`):
```json
{
  "type": "user",
  "session_id": "abc123",
  "message": {
    "role": "user",
    "content": [{ "type": "text", "text": "your message here" }]
  },
  "parent_tool_use_id": null
}
```

**Thinking mode**: Prepends to message text (not a CLI flag):
| Setting | Prefix |
|---------|--------|
| `think` | `THINK THROUGH THIS STEP BY STEP: \n` |
| `think-hard` | `THINK HARD THROUGH THIS STEP BY STEP: \n` |
| `think-harder` | `THINK HARDER THROUGH THIS STEP BY STEP: \n` |
| `ultrathink` | `ULTRATHINK THROUGH THIS STEP BY STEP: \n` |

UI displays original message; Claude receives prefixed version.

---

## 3. Message Streaming (stdout)

**Format**: Newline-delimited JSON (JSONL), one object per line.

**Key message types**:

| Type | Subtype | Contains |
|------|---------|----------|
| `system` | `init` | `session_id`, model info |
| `system` | `status` | compacting, etc. |
| `assistant` | - | `message.content[]` array |
| `control_request` | `permission_request` | Permission prompts |

**Assistant content blocks**:
```json
{
  "type": "assistant",
  "message": {
    "content": [
      { "type": "text", "text": "..." },
      { "type": "thinking", "thinking": "..." },
      { "type": "tool_use", "name": "Read", "input": {...}, "id": "toolu_xxx" }
    ]
  }
}
```

**Tool result** (after permission granted):
```json
{
  "type": "assistant",
  "message": {
    "content": [
      { "type": "tool_result", "tool_use_id": "toolu_xxx", "content": "..." }
    ]
  }
}
```

---

## 4. Permission Handling

**Control request from CLI**:
```json
{
  "type": "control_request",
  "control_type": "permission_request",
  "request_id": "req_xxx",
  "tool": "Bash",
  "input": { "command": "rm -rf /" }
}
```

**Permission response to CLI** (via stdin):
```json
{
  "type": "control_response",
  "request_id": "req_xxx",
  "permission": "allow"
}
```

---

## 5. Key Files

| Component | File | Key Lines |
|-----------|------|-----------|
| Message router registration | `extension.ts` | 304-306 |
| Process spawn logic | `extension.ts` | 1126-1199 |
| Prespawn logic | `extension.ts` | 2946-2970 |
| stdin write | `ProcessManager.ts` | 357-363 |
| stdout parsing | `extension.ts` | 948-979 |
| Response routing | `extension.ts` | 1225+ |
| Thinking mode prefix | `extension.ts` | 1069-1091 |
