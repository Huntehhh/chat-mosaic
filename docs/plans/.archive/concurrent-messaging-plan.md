# Concurrent Messaging Feature Plan

Enable users to send messages while Claude is actively responding.

---

## Executive Summary

Claude Code CLI supports receiving user messages mid-response via stdin when using `--input-format stream-json`. Our extension already uses this format but blocks UI input during processing. This plan removes that blocking while ensuring stability.

**Risk Level**: Medium - Known issues exist with stream-json input (GitHub #3187, #5034), but our current single-message flow works, suggesting careful implementation can succeed.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User types → [BLOCKED while isProcessing=true] → Cannot send  │
│                                                                 │
│  Process stdin ← JSON message (only when UI unlocked)          │
│                                                                 │
│  Process stdout → JSON events → UI renders                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Blocking Points (Files & Lines)

| Location | File | Line | Code |
|----------|------|------|------|
| Textarea disabled | `chat-input.tsx` | 122 | `disabled={isProcessing}` |
| Enter key blocked | `chat-input.tsx` | 58 | `!isProcessing` guard |
| Submit guard | `App.tsx` | 147 | `if (!inputValue.trim() \|\| isProcessing) return` |
| Backend flag | `extension.ts` | 1093 | `this._isProcessing = true` |

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TARGET FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User types → [ALWAYS ENABLED] → Send anytime                  │
│                                                                 │
│  Process stdin ← JSON messages (queued, sent sequentially)     │
│                                                                 │
│  Process stdout → JSON events → UI renders (interleaved)       │
│                                                                 │
│  Visual indicator shows "Claude is working" without blocking   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Frontend Unblocking

**Goal**: Allow typing and sending while `isProcessing=true`

#### 1.1 Remove Textarea Disabled State

**File**: `src/webview/components/organisms/chat-input.tsx`

```diff
- disabled={isProcessing}
+ disabled={false}
```

Keep the placeholder change for UX feedback:
```typescript
placeholder={isProcessing ? 'Claude is working... (you can still send)' : placeholder}
```

#### 1.2 Remove Enter Key Guard

**File**: `src/webview/components/organisms/chat-input.tsx`

```diff
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
-   if (e.key === 'Enter' && !e.shiftKey && !isProcessing) {
+   if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };
```

#### 1.3 Remove Submit Handler Guard

**File**: `src/webview/App.tsx`

```diff
  const handleSubmit = useCallback(() => {
-   if (!inputValue.trim() || isProcessing) return;
+   if (!inputValue.trim()) return;
    sendMessage(inputValue, planMode, thinkingMode);
    setInputValue('');
    setDraftMessage('');
  }, [inputValue, isProcessing, planMode, thinkingMode, sendMessage, setDraftMessage]);
```

#### 1.4 Update Button Behavior

**File**: `src/webview/components/organisms/chat-input.tsx`

Current button switches between Send/Stop. New behavior:
- Show **both** Send and Stop when processing
- Or: Keep single button as Send, add separate Stop button

**Option A - Dual Buttons** (Recommended):
```tsx
{isProcessing && (
  <Button variant="ghost" size="icon" onClick={onStop}>
    <Icon name="stop" size="sm" />
  </Button>
)}
<Button
  variant="accent"
  size="icon"
  onClick={onSubmit}
  disabled={!value.trim()}
>
  <Icon name="arrow_upward" size="sm" />
</Button>
```

**Option B - Keep Current Toggle**:
Leave as-is, user must stop before sending new message.

---

### Phase 2: Backend Message Queue

**Goal**: Safely handle multiple messages sent in quick succession

#### 2.1 Add Message Queue to Extension

**File**: `src/extension.ts`

```typescript
// Add to class properties
private _messageQueue: Array<{
  text: string;
  planMode: boolean;
  thinkingMode: boolean;
  timestamp: number;
}> = [];
private _isWritingToStdin = false;
```

#### 2.2 Queue-Based Send Logic

```typescript
private async _sendMessageToClaude(
  message: string,
  planMode?: boolean,
  thinkingMode?: boolean,
  panelId?: string
) {
  // Always show user input immediately in UI
  this._sendAndSaveMessage({
    type: 'userInput',
    data: message
  });

  // If process not running, spawn it first
  if (!this._processManager.isRunning()) {
    await this._spawnClaudeProcess(planMode, thinkingMode);
  }

  // Write to stdin (process handles interleaving internally)
  const userMessage = {
    type: 'user',
    session_id: this._currentSessionId || '',
    message: {
      role: 'user',
      content: [{ type: 'text', text: message }]
    },
    parent_tool_use_id: null
  };

  this._processManager.write(JSON.stringify(userMessage) + '\n');

  // Set processing if not already
  if (!this._isProcessing) {
    this._isProcessing = true;
    this._postMessage({
      type: 'setProcessing',
      data: { isProcessing: true }
    });
  }
}
```

#### 2.3 Track Pending Messages Count

```typescript
private _pendingMessageCount = 0;

// Increment on send
this._pendingMessageCount++;

// Decrement when we receive a complete response
// (detected by 'result' message type or similar)
```

---

### Phase 3: Response Attribution (Optional Enhancement)

**Goal**: Visually link responses to their triggering messages

Claude Code's stream-json output includes message IDs. We can use these to:
1. Tag each user message with a unique ID
2. Match response content to the originating message
3. Display grouped or threaded view

**Complexity**: High - defer to future iteration.

---

### Phase 4: UI Polish

#### 4.1 Working Indicator

Show non-blocking indicator when Claude is processing:
- Subtle animation in header/status bar
- "Claude is thinking..." badge (already exists)
- Keep thinking blocks visible

#### 4.2 Message Ordering

Ensure messages display in send order:
- User message 1
- Claude response 1 (streaming)
- User message 2 (sent mid-stream)
- Claude response 1 (continues)
- Claude response 2 (starts when ready)

This is the natural order Claude Code CLI produces.

#### 4.3 Stop Behavior

When user clicks Stop:
- Current behavior: Kills entire process
- **Keep this behavior** - stopping mid-conversation should halt all processing

---

## Risk Analysis

### Known Issues with stream-json Input

| Issue | Description | Mitigation |
|-------|-------------|------------|
| #3187 | Hang after 2nd message | Our current flow works; test concurrent sends thoroughly |
| #5034 | Duplicate entries in session | We manage our own conversation storage; shouldn't affect us |
| #13198 | Multiple instances hang | We use single process per session; not applicable |

### Testing Requirements

1. **Basic Flow**: Send message while Claude is responding
2. **Rapid Fire**: Send 3+ messages in quick succession
3. **Long Response**: Interrupt during extended code generation
4. **Tool Use**: Send message while Claude is using tools
5. **Permission Prompt**: Send message while permission dialog is open
6. **Session Resume**: Concurrent sends after session resume

---

## Implementation Order

```
┌────────────────────────────────────────────────────────────────┐
│  Step 1: Frontend Unblocking (chat-input.tsx, App.tsx)         │
│          - Remove disabled states                               │
│          - Update button layout                                 │
│          - Estimated: 15 lines changed                          │
├────────────────────────────────────────────────────────────────┤
│  Step 2: Backend Adjustments (extension.ts)                    │
│          - Remove isProcessing guards on send                   │
│          - Keep processing indicator logic                      │
│          - Estimated: 5 lines changed                           │
├────────────────────────────────────────────────────────────────┤
│  Step 3: Testing                                                │
│          - Manual testing of all scenarios                      │
│          - Verify no regressions                                │
├────────────────────────────────────────────────────────────────┤
│  Step 4: UI Polish (optional)                                   │
│          - Dual button layout                                   │
│          - Enhanced working indicator                           │
└────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/webview/components/organisms/chat-input.tsx` | Remove `disabled={isProcessing}`, update Enter handler, button layout |
| `src/webview/App.tsx` | Remove `isProcessing` guard from `handleSubmit` |
| `src/extension.ts` | Remove guards that prevent sending during processing (minimal) |

**Total estimated changes**: ~25 lines

---

## Decision Points

### Q1: Button Layout During Processing?

**Option A**: Show both Send + Stop buttons (recommended)
**Option B**: Keep toggle behavior, user must stop first

### Q2: Visual Feedback for Queued Messages?

**Option A**: Show "Message queued" indicator
**Option B**: Just show the message immediately (simpler)

### Q3: Rate Limiting?

**Option A**: Allow unlimited sends
**Option B**: Add soft limit (e.g., max 5 pending messages)

---

## Rollback Plan

If concurrent messaging causes issues:
1. Re-add `disabled={isProcessing}` to textarea
2. Re-add guards to submit handlers
3. Revert button layout changes

All changes are isolated to UI blocking logic; core message flow unchanged.
