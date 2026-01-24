# Changelog - 2025-12-19 (Session 6)

## React Frontend Wiring & API Mismatch Fixes

- **Goal**: Wire up the new React/shadcn frontend to the existing backend and fix all API mismatches
- **Risk Level**: Medium - Major frontend switch with extensive API alignment needed

Completed the frontend replacement by wiring all components, fixing 17+ API mismatches between frontend and backend, and adding proper Tailwind CSS processing. The UI now renders correctly with icons and styling.

---

## ✅ No Breaking Changes

Backend API unchanged - all fixes were on the frontend side to match existing backend contracts.

---

## Summary Metrics

| Metric | Before | After |
|--------|--------|-------|
| API Mismatches | 17+ | 0 |
| Message Handlers | ~25 | 38 |
| CSS Bundle Size | 6KB (broken) | 52KB (working) |
| Material Icons | Text fallback | Proper icons |

---

## Environment & Dependencies

| Type | Name | Change | Notes |
|------|------|--------|-------|
| Dep | `esbuild-style-plugin` | Added | PostCSS/Tailwind processing for esbuild |
| Font | Material Symbols | Added | Google Fonts CDN in HTML template |
| CSP | `font-src` | Updated | Allow `fonts.gstatic.com` |
| CSP | `style-src` | Updated | Allow `fonts.googleapis.com` |

---

## Phase 1: Component Wiring

### Added: `src/webview/containers/MessageList.tsx`
- Message rendering container with auto-scroll
- Maps message types to `MessageBlock` components
- Handles permission cards with approve/deny/always-allow

### Changed: `src/webview/App.tsx`
- Full layout with AppHeader, MessageList, TodoList, ChatInput
- Wired all 6 modals: Settings, History, MCP Servers, Model Selector, Slash Commands, Install
- Proper conversation data mapping from store to HistoryPanel format

---

## Phase 2: API Mismatch Fixes

### Fixed: Sender Mismatches (Frontend → Backend)

| Function | Was Sending | Now Sends |
|----------|-------------|-----------|
| `restoreToCommit` | `restoreToCommit` | `restoreCommit` |
| `requestWorkspaceFiles` | `requestWorkspaceFiles` | `getWorkspaceFiles` |
| `openFile` | `openFileInEditor` | `openFile` |
| `createImage` | `createImage` | `createImageFile` |
| `selectModel` | `setSelectedModel` | `selectModel` |
| `viewUsage` | `openUsageTerminal` | `viewUsage` |
| `runInstall` | `runInstall` | `runInstallCommand` |
| `requestConversations` | `requestConversations` | `getConversationList` |
| `loadConversation` | `fullPath` param | `cliPath` param |

### Fixed: Handler Aliases (Backend → Frontend)

```typescript
// These backend message types now map to existing handlers:
case 'permissionsData':      // → permissionsList handler
case 'checkpoints':          // → checkpointsList handler
case 'customSnippetsData':   // → customSnippets handler
case 'system':               // → systemMessage handler
```

### Added: New Message Handlers

```typescript
// src/webview/hooks/useVSCodeMessaging.ts
case 'clearLoading':           // Clears processing state
case 'showInstallModal':       // Opens install modal
case 'loginRequired':          // TODO: Login UI
case 'mcpServerError':         // Error logging
case 'mcpServerSaved':         // Refresh trigger
case 'mcpServerDeleted':       // Refresh trigger
case 'customSnippetSaved':     // Refresh trigger
case 'customSnippetDeleted':   // Refresh trigger
case 'scrollToBottom':         // Handled by MessageList
case 'expirePendingPermissions': // Clears permissions
case 'sessionResumed':         // Updates session ID
case 'restoreError':           // TODO: Error UI
case 'restoreProgress':        // TODO: Progress UI
case 'imagePath':              // TODO: Image handling
```

---

## Phase 3: Tailwind CSS & Icons

### Changed: `build/esbuild.webview.js`
- Added `esbuild-style-plugin` for PostCSS processing
- Tailwind CSS now properly compiles utility classes

### Changed: `src/ui-react.ts`
- Added Material Symbols Outlined font from Google Fonts
- Updated CSP to allow Google Fonts domains
- Added `connect-src` for font loading

---

## Phase 4: Type Alignment

### Changed: `src/types/messages.ts`

```typescript
// ConversationListItem now matches backend structure:
export interface ConversationListItem {
  filename: string;
  sessionId: string;           // was: displayName
  startTime: string;           // was: timestamp
  endTime: string;             // NEW
  messageCount: number;        // NEW
  totalCost: number;           // NEW
  firstUserMessage: string;    // NEW - used as title
  lastUserMessage: string;     // NEW - used as preview
  source: 'internal' | 'cli';  // was: 'local' | 'claude'
  cliPath?: string;            // was: fullPath
}
```

### Changed: `src/webview/stores/chatStore.ts`
- Extended `Conversation` with convenience fields: `id`, `name`, `lastModified`
- Maps from backend fields to UI-expected fields

---

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/webview/containers/MessageList.tsx` | **NEW** | Message rendering container |
| `src/webview/App.tsx` | Modified | Full layout, all modals wired |
| `src/webview/hooks/useVSCodeMessaging.ts` | Modified | 9 sender fixes, 12 new handlers |
| `src/types/messages.ts` | Modified | ConversationListItem type aligned |
| `src/webview/stores/chatStore.ts` | Modified | Conversation interface extended |
| `src/ui-react.ts` | Modified | Material Icons, CSP updates |
| `build/esbuild.webview.js` | Modified | PostCSS/Tailwind plugin |
| `src/_legacy/` | **NEW** | Archived: ui.ts, ui-styles.ts, script.ts |
| `src/extension.ts` | Modified | Imports ui-react.ts instead of ui.ts |
| `docs/api-mismatch-audit.md` | **NEW** | Full audit documentation |
| `docs/claude-jsonl-structure.md` | **NEW** | JSONL format documentation |

---

## Verification

**Build Command**: `npm run compile`
**Result**: ✅ Successful

```
out\webview\index.js   234.9kb (minified)
out\webview\index.css   52.3kb (minified)
```

**Package Command**: `npx vsce package --allow-missing-repository`
**Install Command**: `code --install-extension claude-code-chat-1.1.0.vsix --force`
**Result**: ✅ Extension installed successfully

**Git Commit**: `62d0865 Fix frontend/backend API mismatches`

---

## Open Loops

### Known Issues
- History panel shows conversations but loading a conversation is untested
- Some TODO handlers log to console instead of showing UI (loginRequired, restoreError)
- `scrollToBottom` not wired to MessageList ref

### Features Not Yet Tested
- MCP server management (save/delete)
- Custom snippets (save/delete)
- Checkpoint restore
- Image attachment

### Next Immediate Action
Test the full chat flow:
1. Open Claude Code Chat
2. Click History icon
3. Verify conversations load from `~/.claude/projects/<workspace>/`
4. Select a conversation and verify it loads

### Resume Prompt
```
Resume Claude Code Chat frontend testing. The UI is now rendering correctly with icons and styling.

Run `npm run compile && npx vsce package --allow-missing-repository` to build.

Test conversation history loading from CLI projects folder.
```

---

## Context Manifest

Priority files for next session:
- `src/webview/hooks/useVSCodeMessaging.ts` - All message handlers
- `src/webview/App.tsx` - Main layout and modal wiring
- `src/extension.ts:1468-1588` - CLI conversation scanning
- `docs/api-mismatch-audit.md` - Reference for any remaining mismatches
- `docs/claude-jsonl-structure.md` - JSONL format for conversation parsing
