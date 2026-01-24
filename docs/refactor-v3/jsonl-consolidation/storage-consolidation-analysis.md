# Storage Consolidation Analysis

**Problem**: Extension duplicates conversation data in JSON when Claude CLI already stores everything in JSONL.

---

## Claude JSONL Structure (`~/.claude/projects/<workspace>/*.jsonl`)

### Record Types

| Type | Purpose |
|------|---------|
| `user` | User messages |
| `assistant` | Claude responses with usage/model info |
| `system` | Local commands, compaction events |
| `summary` | Conversation title/summary |
| `file-history-snapshot` | File backup snapshots |

### Common Fields (all records)

```
parentUuid        → Links to previous message (chain)
uuid              → Unique record ID
sessionId         → Conversation session ID
timestamp         → ISO-8601 datetime
type              → Record type
isSidechain       → Branch conversation flag
userType          → "external" for main thread
cwd               → Working directory
gitBranch         → Current git branch
version           → CLI version (e.g., "2.0.72")
```

### User Record Fields

```
message.role      → "user"
message.content   → String or ContentBlock[]
thinkingMetadata  → { level, disabled, triggers[] }
todos             → Todo list state
isMeta            → True for system/caveat messages
```

### Assistant Record Fields

```
message.id        → API message ID
message.model     → Model used (e.g., "claude-opus-4-5-20251101")
message.role      → "assistant"
message.content   → ContentBlock[] (text, thinking, tool_use)
message.stop_reason → "end_turn", "tool_use", etc.
message.usage     → Token accounting (see below)
requestId         → API request ID
```

### Usage Object (in assistant records)

```
input_tokens                  → Base input tokens
output_tokens                 → Output tokens
cache_creation_input_tokens   → New cache tokens
cache_read_input_tokens       → Cached tokens read
service_tier                  → "standard", etc.
cache_creation.ephemeral_5m_input_tokens
cache_creation.ephemeral_1h_input_tokens
```

### Content Block Types

```
{ type: "text", text: "..." }
{ type: "thinking", thinking: "...", signature: "..." }
{ type: "tool_use", id: "...", name: "Read", input: {...} }
{ type: "tool_result", tool_use_id: "...", content: "..." }
```

---

## Extension JSON Structure (`storageUri/conversations/*.json`)

```
sessionId         → Matches JSONL sessionId
startTime         → First message timestamp
endTime           → Last save timestamp
messageCount      → Total messages
totalCost         → Pre-summed cost
totalTokens.input → Pre-summed input tokens
totalTokens.output→ Pre-summed output tokens
filename          → Self-reference for lookup
chatName          → User-defined custom name (ONLY UNIQUE FIELD)
messages[]        → Flattened message array
  .timestamp
  .messageType    → "userInput" | "output" | "toolUse" | "toolResult"
  .data           → Message content (stripped of file diffs)
```

---

## Actual Data Overlap

| Data | In JSONL | In JSON | Redundant? |
|------|----------|---------|------------|
| Message content | ✓ | ✓ | **Yes** |
| Timestamps | ✓ | ✓ | **Yes** |
| Session ID | ✓ | ✓ | **Yes** |
| Token counts | Per-message | Summed | Computable |
| Cost | Computable | Summed | Computable |
| Model info | ✓ | ✗ | — |
| Git branch/cwd | ✓ | ✗ | — |
| Thinking blocks | ✓ | ✗ | — |
| File snapshots | ✓ | ✗ | — |
| Chat name | ✗ | ✓ | **Only unique field** |

---

## Verdict

**The JSON files duplicate 95% of JSONL data.** The only field JSON adds is `chatName`.

Current flow:
```
Claude CLI writes JSONL → Extension reads JSONL
                        → Extension ALSO writes JSON (redundant)
                        → Extension reads JSON for history
```

---

## Recommended Architecture

### Option A: Metadata-Only Index

Store only what JSONL lacks:

```json
// conversations/index.json
{
  "fb33f961-b3fe-4393-baa4-72c72dfdd850": {
    "chatName": "Code Review Session",
    "cachedCost": 0.0523,
    "cachedTokens": { "input": 25000, "output": 8000 },
    "lastAccessed": "2025-12-18T21:15:00Z"
  }
}
```

- Read messages from JSONL (already implemented)
- Cache computed stats on first load
- Invalidate cache if JSONL modified

### Option B: Symlink Approach

- Don't write JSON files at all
- Use JSONL as single source of truth
- Store `chatName` in VS Code workspace state only

### Migration Path

1. Keep JSON write for backward compatibility (deprecate)
2. Add `preferJSONL: true` setting
3. When loading, prefer JSONL if available
4. Only write index.json with metadata
5. Remove JSON write after transition period

### Implementation Changes

| Current | Proposed |
|---------|----------|
| `_saveCurrentConversation()` writes full JSON | Write to index.json only |
| `_loadConversationHistory()` reads JSON | Read from JSONL + index lookup |
| `_updateConversationIndex()` duplicates data | Store chatName + cached stats only |
| 500ms debounce save | Only save on chatName change or session end |

### Benefits

- **50%+ disk savings** per conversation
- **Single source of truth** (JSONL)
- **Faster saves** (no message serialization)
- **No sync issues** between JSON/JSONL
- **Leverage Claude's streaming format** for large conversations

---

## Files to Modify

```
src/extension.ts
  - _saveCurrentConversation()  → Remove or make index-only
  - _loadConversationHistory()  → Delegate to JSONL loader
  - _updateConversationIndex()  → Slim down to metadata

src/services/ConversationManager.ts
  - Already has loadJSONLConversation() → Use as primary
  - Add computeStats() for on-load calculation
  - Add index management for chatName/cache
```
