# Claude Code Chat: System Deep Dive

**Date:** 2026-01-04
**Purpose:** Understanding what happens when you use the extension and what could go wrong

---

## The Basic Flow (What You See)

```
You type message → Claude thinks → Response streams in → Done
```

## What Actually Happens Under the Hood

```
1. You click Send
   ↓
2. Extension spawns a NEW Claude CLI process (claude --output-format stream-json ...)
   ↓
3. Your message + images sent via stdin as JSON
   ↓
4. Claude CLI streams responses back via stdout (JSONL format)
   ↓
5. Extension parses stream, updates UI in real-time
   ↓
6. When done, process exits (or stays alive for permission requests)
   ↓
7. Conversation metadata saved to per-project index
```

---

## Key User-Facing Behaviors

### 1. Each Message = New Process (Usually)

When you send a message:
- A fresh `claude` CLI process spawns
- If resuming a session, it uses `--resume <sessionId>` to continue context
- The process lives until Claude finishes OR you cancel

**Implication:** If you close VS Code mid-response, the Claude process may become orphaned (keeps running in background).

### 2. Conversations Are Stored in TWO Places

| Location | What's There | Who Writes |
|----------|--------------|------------|
| `~/.claude/projects/<encoded-workspace>/` | Full JSONL conversation history | Claude CLI |
| `{extension-storage}/chat-index/` | Chat names, last accessed, stats | This extension |

**Implication:** The extension doesn't own the conversation files—Claude CLI does. The extension just maintains metadata.

### 3. Backup System (Currently Disabled)

We disabled this, but when enabled:
- Before each message, git commits your workspace files
- Lets you "restore" if Claude messes something up
- Was broken because GitService was never initialized

---

## What Could Go Wrong

### Risk 1: Multi-Window Race Conditions (HIGH)

**Scenario:**
1. You open the same project in 2 VS Code windows
2. Window A: Rename conversation to "Feature Work"
3. Window B: Send a message (updates stats)
4. **Result:** One write overwrites the other

**Why:** The per-project index uses load → modify → save pattern with NO file locking. Both windows load the same file, modify independently, and the last writer wins.

**Code location:** `ConversationManager.ts:1226-1280`

---

### Risk 2: Rapid Updates Drop Data (HIGH)

**Scenario:**
1. You rapidly rename a chat 3 times: "A" → "B" → "C"
2. Save A starts...
3. Save B queued (pending=true)
4. Save C arrives—pending already true, **silently ignored**
5. Final result: "B" (not "C")

**Why:** The save queue is a single boolean flag, not a proper queue. Only one pending save can exist.

**Code location:** `ConversationManager.ts:1173-1190`

---

### Risk 3: Orphaned Claude Processes (MEDIUM)

**Scenario:**
1. You force-quit VS Code while Claude is mid-response
2. The `dispose()` function tries to kill processes
3. VS Code exits before kill completes
4. Claude process keeps running in background

**Why:** `killAll()` is async but VS Code doesn't wait forever. Also, `cleanupOrphanedProcesses()` exists but is **never called**.

**Code location:**
- `extension.ts:2682` (dispose)
- `ProcessRegistry.ts:324-337` (unused cleanup method)

---

### Risk 4: Timestamp Collision in Atomic Writes (LOW but catastrophic)

**Scenario:**
1. Two rapid saves happen within the same millisecond
2. Both create temp file: `chat-index.json.tmp.1704067200000`
3. One deletes the other's temp file
4. Data corruption

**Why:** Temp filename uses `Date.now()` (millisecond precision), not UUID.

**Code location:** `ConversationManager.ts:1199`

---

### Risk 5: Claude Doesn't Know About Your Other Commits

**Current state (backup disabled):** Not applicable—no commits happening.

**When backup was enabled:**
- The extension creates commits in an **isolated backup repo** (separate from your project's git)
- Stored at: `{extensionStorage}/backups/.git`
- Work tree: your workspace root

**The overwrite concern:**

If you had the backup system AND were using git in your actual project:
- Claude would edit files in your workspace
- Your workspace git would see Claude's changes
- The extension's backup git would ALSO see them
- But they're completely separate repos

**However, here's a real risk:**
1. Claude edits `src/app.ts`
2. You manually edit `src/app.ts` in another editor
3. Claude's next edit assumes the file is what Claude last saw
4. **Claude overwrites your manual changes**

This isn't a backup system problem—it's fundamental to how Claude works. Claude doesn't watch for external file changes between its responses.

---

## Summary: Current State

| Feature | Status | Risk Level |
|---------|--------|------------|
| Message sending | ✅ Works | Low |
| Response streaming | ✅ Works | Low |
| Conversation persistence | ⚠️ Race conditions | High |
| Multi-window support | ⚠️ Data loss possible | High |
| Process cleanup | ⚠️ Orphans possible | Medium |
| Backup/restore | 🔴 Disabled | N/A |
| Permission handling | ✅ Works | Low |

---

## Recommendations to Fix These Issues

### 1. Replace boolean flag with queue
**File:** `ConversationManager.ts:1173-1190`
```typescript
// Instead of:
private _perProjectIndexSavePending: boolean = false;

// Use:
private _pendingUpdates: Set<string> = new Set(); // sessionIds to update
```

### 2. Add file locking
```bash
npm install proper-lockfile
```
Then wrap save operations with lock/unlock.

### 3. Call cleanupOrphanedProcesses()
**File:** `extension.ts` in `activate()` or ClaudeChatProvider constructor
```typescript
// On startup, clean up any orphaned process entries
this._processRegistry.cleanupOrphanedProcesses();
```

### 4. Use UUID for temp files
**File:** `ConversationManager.ts:1199`
```typescript
// Instead of:
const tempPath = filePath + '.tmp.' + Date.now();

// Use:
import { randomUUID } from 'crypto';
const tempPath = filePath + '.tmp.' + randomUUID();
```

### 5. Await process kills in panel disposal
**File:** `extension.ts:665-668`
```typescript
// Instead of:
this._processRegistry.kill(panelId).catch(e => { ... });

// Use:
await this._processRegistry.kill(panelId);
```

---

## Detailed Message Flow (For Reference)

### Entry Point
- **File:** `src/extension.ts`
- **Line 449:** Message router registers 'sendMessage' handler

### _sendMessageToClaude() Method (Lines 1112-1322)

1. **Line 1120:** Gets workspace folder as CWD
2. **Lines 1127-1147:** Applies thinking mode prefix if enabled
3. **Lines 1156-1159:** Sends user message to webview and saves to conversation
4. **Lines 1184-1200:** Builds Claude CLI args
5. **Line 1240:** Spawns process via ProcessRegistry
6. **Lines 1268-1305:** Processes images (read, base64, MIME type)
7. **Lines 1310-1319:** Constructs user message JSON
8. **Line 1319:** Sends message to Claude via stdin

### Response Processing

- **ProcessRegistry** receives stdout data
- **StreamBuffer** parses JSON stream (handles multi-line objects)
- **_processJsonStreamData()** routes by message type:
  - System messages → session init, status
  - Assistant messages → text, thinking, tool use
  - Result messages → cost, duration, completion

### Permission Handling

When Claude wants to execute a tool:
1. Extract tool name from request
2. Check if pre-approved via PermissionsManager
3. If not, send permission request to UI
4. Wait for user approval/denial
5. Send control_response back to Claude via stdin

---

## File Locations Quick Reference

| Purpose | Path |
|---------|------|
| Main extension | `src/extension.ts` |
| Process management | `src/services/ProcessRegistry.ts` |
| Process wrapper | `src/services/ProcessManager.ts` |
| Conversation storage | `src/services/ConversationManager.ts` |
| JSON stream parsing | `src/services/StreamBuffer.ts` |
| Permission handling | `src/services/PermissionsManager.ts` |
| Git backup (disabled) | `src/services/GitService.ts` |
| Webview messaging | `src/webview/hooks/useVSCodeMessaging.ts` |
| Chat state | `src/webview/stores/chatStore.ts` |
