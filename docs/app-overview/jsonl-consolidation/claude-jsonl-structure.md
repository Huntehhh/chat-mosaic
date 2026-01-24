# Claude Code JSONL File Structure

Documentation of the JSONL format used by Claude Code CLI for conversation history storage in `~/.claude/projects/<workspace>/`.

## File Location

- **Path**: `~/.claude/projects/<workspace>/*.jsonl`
- **Workspace folder naming**: Converts `C:\HApps\project` → `C--HApps-project`
- **File types**:
  - `agent-*.jsonl` - Agent session files
  - `<uuid>.jsonl` - UUID-based session files

---

## Record Type Overview

The JSONL files contain **10 distinct record types**:

| Type | Description |
|------|-------------|
| `user` | User messages |
| `assistant` | Claude's responses with model info and token usage |
| `message` | Generic message container |
| `summary` | Conversation summary record |
| `create` | File creation events |
| `thinking` | Extended thinking/reasoning blocks |
| `system` | System events (compaction, boundaries) |
| `tool_use` | Tool invocation requests |
| `tool_result` | Tool execution results |
| `text` | Text content blocks |

---

## Core Fields (Present in ALL Records)

```typescript
interface BaseRecord {
  parentUuid: string | null;     // References previous message UUID
  sessionId: string;             // Unique conversation session UUID
  version: string;               // CLI version (e.g., "2.0.5")
  uuid: string;                  // Unique record identifier
  timestamp: string;             // ISO-8601 datetime
  type: string;                  // Record type
  isSidechain: boolean;          // Whether sidechain message
  userType: string;              // "external" for main thread
  cwd: string;                   // Current working directory
  gitBranch: string;             // Git branch (may be empty)
}
```

---

## Record Type Details

### 1. USER Record (`type: "user"`)

Regular user messages containing instructions, questions, or responses.

```typescript
interface UserRecord extends BaseRecord {
  type: "user";
  message: {
    role: "user";
    content: string | ContentBlock[];
  };
  isMeta?: boolean;  // true for caveat/meta messages
}
```

**Content variations:**
- Simple string: `"Read CLAUDE.md first"`
- Command: `"<command-name>/mcp</command-name>..."`
- Local command output: `"<local-command-stdout>..."`
- Tool results array: `[{"tool_use_id": "...", "type": "tool_result", "content": "..."}]`

---

### 2. ASSISTANT Record (`type: "assistant"`)

Claude's responses with full metadata including model info and token usage.

```typescript
interface AssistantRecord extends BaseRecord {
  type: "assistant";
  message: {
    id: string;                    // API request ID
    type: "message";
    role: "assistant";
    model: string;                 // e.g., "claude-opus-4-1-20250805"
    content: ContentBlock[];       // Response content blocks
    stop_reason: string | null;    // "end_turn", "tool_use", etc.
    stop_sequence: string | null;
    usage: {
      input_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
      output_tokens: number;
      service_tier: string;
      cache_creation?: {
        ephemeral_5m_input_tokens: number;
        ephemeral_1h_input_tokens: number;
      };
    };
  };
  requestId: string;
}
```

**Content block types in assistant messages:**
- Text: `{"type": "text", "text": "response"}`
- Tool use: `{"type": "tool_use", "id": "...", "name": "Read", "input": {...}}`
- Thinking: `{"type": "thinking", "thinking": "reasoning..."}`

---

### 3. SUMMARY Record (`type: "summary"`)

Standalone conversation summary created at conversation boundaries.

```typescript
interface SummaryRecord {
  type: "summary";
  summary: string;       // Brief summary text
  leafUuid: string;      // UUID of associated message
}
```

**Example:**
```json
{
  "type": "summary",
  "summary": "Universal CLAUDE.md Template: Reusable Project Practices",
  "leafUuid": "e94f2a21-fa4b-462a-bbea-d850620d80ad"
}
```

---

### 4. SYSTEM Record (`type: "system"`)

System-level events like conversation compaction.

```typescript
interface SystemRecord extends BaseRecord {
  type: "system";
  subtype: string;           // e.g., "compact_boundary"
  content: string;           // Description
  level: string;             // "info", "warn", "error"
  isMeta: boolean;
  logicalParentUuid?: string;
  compactMetadata?: {
    trigger: string;         // "auto", "manual"
    preTokens: number;       // Token count before compaction
  };
}
```

---

### 5. THINKING Record (within content)

Extended thinking blocks from reasoning mode.

```typescript
interface ThinkingBlock {
  type: "thinking";
  thinking: string;  // Extended reasoning text
}
```

---

### 6. TOOL_USE Record (within content)

Tool invocation requests.

```typescript
interface ToolUseBlock {
  type: "tool_use";
  id: string;           // Unique tool call ID
  name: string;         // Tool name: "Read", "Bash", "Glob", "Write", "Edit", etc.
  input: Record<string, unknown>;  // Tool-specific parameters
}
```

**Common tool names:**
- `Read` - Read file contents
- `Write` - Write file
- `Edit` - Edit file
- `MultiEdit` - Multiple edits
- `Bash` - Execute shell command
- `Glob` - Find files by pattern
- `Grep` - Search file contents
- `Task` - Launch subagent
- `WebFetch` - Fetch web content
- `WebSearch` - Web search
- `TodoWrite` - Update todo list

---

### 7. TOOL_RESULT Record (within user content)

Results from tool execution.

```typescript
interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;   // References the tool_use record
  content: string;       // Tool output/result
}
```

---

### 8. CREATE Record (toolUseResult)

File creation events with full content.

```typescript
interface CreateResult {
  type: "create";
  filePath: string;              // Full path to created file
  content: string;               // Complete file content
  structuredPatch: PatchInfo[];  // Diff/patch information
}
```

---

## Conversation Flow Pattern

```
1. USER record - User provides instructions
   ↓
2. ASSISTANT record - Claude responds, may include tool_use
   ↓
3. USER record (isMeta: true) - System caveat about local commands
   ↓
4. USER record - Contains tool_result in content array
   ↓
5. ASSISTANT record - Claude processes tool result
   ↓
   [Repeat 3-5 as needed for tool chains]
   ↓
6. SYSTEM record - Optional compaction boundary
   ↓
7. SUMMARY record - Created at conversation end
```

---

## Message Linking

Records form a linked chain via `parentUuid`:

```
message-1 (parentUuid: null)
    ↓
message-2 (parentUuid: message-1.uuid)
    ↓
message-3 (parentUuid: message-2.uuid)
```

---

## File Size Patterns

| Size | Lines | Description |
|------|-------|-------------|
| Small | ~6 lines | Brief sessions |
| Medium | 250-300 lines | Typical working sessions |
| Large | 450+ lines | Extended development with many tools |
| Summary-only | 1 line | Just summary record |

---

## Component Mapping for UI

| JSONL Type | shadcn Component |
|------------|------------------|
| `user` | `MessageBlock type="user"` |
| `assistant` | `MessageBlock type="assistant"` |
| `thinking` | `MessageBlock type="thinking"` or `CollapsibleCard` |
| `tool_use` | `MessageBlock type="tool"` + `CollapsibleCard` |
| `tool_result` | Inside `CollapsibleCard` |
| `system` | System message or separator |
| `summary` | Conversation title/preview |
| File create/edit | `DiffView` |
| Code blocks | `CodeBlock` |

---

## Key Observations

1. **Parentage Tracking**: `parentUuid` forms linked conversation chain
2. **Token Accounting**: Every assistant response includes detailed usage
3. **Tool Integration**: Tools via `tool_use` in content, results via `tool_result`
4. **Session Isolation**: Unique `sessionId` per conversation
5. **Version Tracking**: CLI version logged in each record
6. **File Events**: Created files captured with full content
7. **Thinking Transparency**: Reasoning blocks preserved when enabled
8. **Metadata Rich**: Context preserved (cwd, git branch, paths)
