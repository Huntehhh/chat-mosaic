# Claude CLI JSONL Format Reference

Each line is a JSON object. Key field: `type` determines the entry type.

## Entry Types

### `summary`
Session title/description. Usually first line(s).
```json
{"type":"summary","summary":"Session title here","leafUuid":"..."}
```

### `file-history-snapshot`
Tracks file backups for undo/restore.
```json
{"type":"file-history-snapshot","messageId":"...","snapshot":{...},"isSnapshotUpdate":false}
```

### `user`
User message entry.
```json
{
  "type":"user",
  "message":{"role":"user","content":[...]},
  "uuid":"...",
  "timestamp":"ISO-8601",
  "sessionId":"...",
  "cwd":"C:\\path",
  "gitBranch":"branch-name",
  "version":"2.0.74",
  "parentUuid":"..." | null,
  "isSidechain":false,
  "userType":"external",
  "thinkingMetadata":{"level":"high","disabled":false,"triggers":[]},
  "todos":[],
  "imagePasteIds":[]
}
```

### `assistant`
Claude's response.
```json
{
  "type":"assistant",
  "message":{"model":"...","id":"msg_...","role":"assistant","content":[...],"stop_reason":"end_turn"|null,"usage":{...}},
  "uuid":"...",
  "timestamp":"ISO-8601",
  "parentUuid":"...",
  "requestId":"req_..."
}
```

## Content Block Types (inside `message.content`)

| Type | Fields | Description |
|------|--------|-------------|
| `text` | `text` | Plain text response |
| `thinking` | `thinking`, `signature` | Extended thinking content |
| `tool_use` | `id`, `name`, `input` | Tool invocation |
| `tool_result` | `tool_use_id`, `content` | Tool response (in user entries) |
| `image` | `source.type`, `source.media_type`, `source.data` | Base64 image |

## Usage Object (in assistant)
```json
"usage":{
  "input_tokens":N,
  "output_tokens":N,
  "cache_creation_input_tokens":N,
  "cache_read_input_tokens":N,
  "service_tier":"standard"
}
```

## Key Fields Summary

| Field | Location | Description |
|-------|----------|-------------|
| `sessionId` | user | UUID identifying the session |
| `uuid` | user/assistant | Unique ID for this entry |
| `parentUuid` | user/assistant | Links to previous entry (conversation threading) |
| `timestamp` | all | ISO-8601 datetime |
| `isSidechain` | user/assistant | Branch/alternate path flag |
| `cwd` | user | Working directory |
| `gitBranch` | user | Current git branch |
| `version` | user | Claude CLI version |
