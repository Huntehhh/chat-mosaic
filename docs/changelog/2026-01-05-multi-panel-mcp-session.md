# Changelog - 2026-01-05 (Session 1)

## Multi-Panel Bug Fixes, Chat History Selection, and /mcp Command Implementation

- **Goal**: Fix multi-panel architecture bugs and implement interactive MCP management via `/mcp` command
- **Risk Level**: Medium - Core message routing and process lifecycle changes

This session resolved critical bugs in multi-panel chat switching and chat renaming, then implemented a new `/mcp` slash command that opens an interactive terminal for MCP server management with automatic process restart.

| Metric | Before | After |
|--------|--------|-------|
| Chat history switching | Broken (ID mismatch) | Working |
| Chat rename in history | Not displayed | Shows custom name |
| MCP management | Manual terminal only | `/mcp` command |
| Process restart on MCP edit | Manual | Automatic |

## ✅ No Breaking Changes

All changes are additive or internal bug fixes. No API signature changes affect external consumers.

## Environment & Dependencies

| Type | Name | Change | Notes |
|------|------|--------|-------|
| Type | `InteractiveArgsOptions` | Added | New interface for `buildInteractiveArgs()` |

---

## Phase 1: Multi-Panel Chat Selection Bug Fix

### Fixed: `src/webview/hooks/useModalHandlers.ts`

Fixed conversation not switching when clicking history items due to ID format mismatch:

- **Root Cause**: `historyConv.id` contained filename with `.jsonl` extension (e.g., `"uuid.jsonl"`) but comparison used `c.sessionId` which is UUID only (e.g., `"uuid"`)
- Modified `handleSelectConversation()` to match by `filename` OR `id` field
- Fixed `setActiveConversationId()` to extract sessionId without `.jsonl` extension
- Added `setActiveConversationId` and `clearConversationNeedsResponse` to useChatStore destructuring

```typescript
// Before (broken)
const original = conversations.find((c) => c.sessionId === historyConv.id);

// After (working)
const original = conversations.find((c) => c.filename === historyConv.id || c.id === historyConv.id);
const sessionId = original.sessionId || historyConv.id.replace('.jsonl', '');
```

---

## Phase 2: Chat Rename Display in History

### Fixed: `src/webview/App.tsx`

Chat names set by user were not appearing in history panel:

- **Root Cause**: Title mapping used `firstUserMessage || name` but ignored `chatName` field
- Added `chatName` as first priority in title fallback chain

```typescript
// Before
title: c.firstUserMessage || c.name || 'Untitled'

// After
title: c.chatName || c.firstUserMessage || c.name || 'Untitled'
```

---

## Phase 3: `/mcp` Command Implementation

### Added: Interactive MCP Terminal Command

New `/mcp` slash command opens a visible terminal for interactive MCP server management:

**Flow:**
1. User types `/mcp` in chat input
2. Detects command in `_sendMessageToClaude()` before any processing
3. Opens interactive terminal: `claude --resume <sessionId> [--dangerously-skip-permissions]`
4. User manages MCPs via keyboard shortcuts (Shift+Tab)
5. On terminal close, background Claude process is killed and notification shown
6. Process respawns on next message with new MCP configuration

### Changed: `src/utils/claude-args.ts`

Extended `buildInteractiveArgs()` to support permission flags:

```typescript
export interface InteractiveArgsOptions {
  sessionId?: string;
  dangerouslySkipPermissions?: boolean;
}

export function buildInteractiveArgs(options: InteractiveArgsOptions | string = {}): string[]
```

### Changed: `src/services/TerminalManager.ts`

Updated `openMCPTerminal()` signature to accept `dangerouslySkipPermissions` parameter:

```typescript
openMCPTerminal(sessionId: string, panelId?: string, dangerouslySkipPermissions?: boolean): TerminalResult | null
```

### Changed: `src/extension.ts`

1. **Added `/mcp` detection** at start of `_sendMessageToClaude()`:
```typescript
const trimmedMessage = message.trim().toLowerCase();
if (trimmedMessage === '/mcp') {
  // Open MCP terminal and return early
  this._terminalManager.openMCPTerminal(sessionId, targetPanelId, yoloMode);
  return;
}
```

2. **Implemented `_restartProcessAfterMCP()`** to handle process lifecycle:
   - Kills existing hidden Claude process
   - Shows notification: "MCP configuration updated"
   - Process respawns automatically on next message

3. **Added MCP restart tracking** to suppress spurious error messages:
```typescript
private _mcpRestartingPanels: Set<string> = new Set();
```

When process is killed intentionally for MCP restart, `onClose` and `onError` handlers check this Set and skip error display.

---

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/webview/hooks/useModalHandlers.ts` | Modified | Fixed conversation ID matching |
| `src/webview/App.tsx` | Modified | Added chatName to title priority |
| `src/utils/claude-args.ts` | Modified | Added `InteractiveArgsOptions`, updated `buildInteractiveArgs()` |
| `src/utils/index.ts` | Modified | Exported `InteractiveArgsOptions` type |
| `src/services/TerminalManager.ts` | Modified | Added `dangerouslySkipPermissions` param to `openMCPTerminal()` |
| `src/extension.ts` | Modified | `/mcp` detection, `_restartProcessAfterMCP()`, MCP restart tracking |

---

## Key Interfaces

```typescript
// New type for interactive terminal args
export interface InteractiveArgsOptions {
  sessionId?: string;
  dangerouslySkipPermissions?: boolean;
}

// Updated function signature (backward compatible)
export function buildInteractiveArgs(options: InteractiveArgsOptions | string = {}): string[]

// Updated terminal method
openMCPTerminal(sessionId: string, panelId?: string, dangerouslySkipPermissions?: boolean): TerminalResult | null
```

---

## Verification

**Command**: `npm run compile`
**Results**: ✅ Extension and webview compiled successfully

**Manual Testing**:
- ✅ Clicking history items now switches conversations
- ✅ Renamed chats display custom name in history panel
- ✅ `/mcp` opens interactive terminal with correct session
- ✅ Closing MCP terminal kills and restarts background process
- ✅ No spurious "operation was aborted" error on MCP terminal close

---

## Technical Notes

### MCP Restart Error Suppression

When the MCP terminal closes and triggers process restart, the process kill generates error events. To prevent showing "Error running Claude: The operation was aborted" to users:

1. Panel ID added to `_mcpRestartingPanels` Set before kill
2. `onClose` handler checks Set → returns early if match
3. `onError` handler checks Set → returns early and removes from Set

This distinguishes intentional kills (MCP restart) from unexpected process failures.

### Conversation ID Architecture

The conversation list has two ID concepts:
- `filename`: Full filename with extension (e.g., `"uuid.jsonl"`)
- `sessionId`: UUID only (e.g., `"uuid"`)

History panel receives filename as `id`, but internal tracking uses sessionId. The fix ensures both formats are checked during lookup.
