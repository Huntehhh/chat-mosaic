# Changelog - 2026-01-02 (Session: Regression Fix & Branch Consolidation)

## Regression Fixed, All Feature Branches Merged, Console Errors Resolved

- **Goal**: Investigate and fix UI regression, merge all unmerged feature branches, port image sending to new architecture
- **Risk Level**: High - Major merge of 5 feature branches with conflict resolution

Fixed a critical regression caused by a bulk commit that overwrote good code from unmerged branches. Merged all 5 pending feature branches, ported image sending to the refactored hook structure, and resolved all console errors/warnings.

---

## Quick-Scan Summary

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Unmerged branches | 5 | 0 | All consolidated |
| Console errors | 3 | 0 | Fixed |
| Console warnings | 2 | 0 | Fixed |
| Stale worktrees | 4 | 0 | Cleaned up |
| Files changed | - | 48 | +4,037 / -1,538 lines |

---

## ✅ No Breaking Changes

All changes are backward compatible. The refactored hook structure maintains the same external API.

---

## Root Cause Analysis

### The Regression
Commit `6f23a7c` ("sync local files to git") bulk-committed 230 files with old code, overwriting changes from unmerged feature branches.

### Resolution
1. Merged `feature/ui-fixes` to restore token display positioning
2. Merged all remaining feature branches systematically
3. Ported image sending code to new hook architecture
4. Fixed console errors from missing message handlers

---

## Merged Branches

| Branch | Commits | Key Features |
|--------|---------|--------------|
| `feature/token-display` | 1 | Token/cost display prep for frontend |
| `feature/framer-components` | 1 | Framer motion animations, new UI components |
| `feature/wt3-frontend-logic` | 1 | Major refactor: split hooks into handlers |
| `feature/multi-window-processes` | 10 | Multi-window support, worktree scripts |
| `feature/mcp-editor-integration` | 15 | MCP editor panel, settings fixes |

---

## Added

### New Handler Files (from wt3-frontend-logic merge)
- `src/webview/hooks/handlers/index.ts` - Handler exports
- `src/webview/hooks/handlers/useChatHandlers.ts` - Chat message handlers
- `src/webview/hooks/handlers/useFileHandlers.ts` - File/workspace handlers
- `src/webview/hooks/handlers/useMcpHandlers.ts` - MCP server handlers
- `src/webview/hooks/handlers/useSessionHandlers.ts` - Session management
- `src/webview/hooks/handlers/useSettingsHandlers.ts` - Settings handlers
- `src/webview/hooks/handlers/useTokenHandlers.ts` - Token update handlers
- `src/webview/hooks/handlers/useUiHandlers.ts` - UI state handlers

### New Hooks
- `src/webview/hooks/useAdaptiveLayout.ts` - Responsive breakpoint handling
- `src/webview/hooks/useChatActions.ts` - Chat input actions (send, stop, new)
- `src/webview/hooks/useModalHandlers.ts` - Modal state management

### New Store
- `src/webview/stores/branchStore.ts` - Session branching feature state

### New Components (from framer-components merge)
- `src/webview/components/atoms/streaming-cursor.tsx`
- `src/webview/components/atoms/tool-output-skeleton.tsx`
- `src/webview/components/molecules/file-diff-view.tsx`
- `src/webview/components/molecules/permission-banner.tsx`
- `src/webview/components/molecules/thinking-block.tsx`
- `src/webview/components/organisms/pinned-context-shelf.tsx`
- `src/webview/lib/animations.ts` - Framer motion animation definitions

---

## Changed

### `src/webview/hooks/useVSCodeMessaging.ts`
- Refactored from 891 to ~415 lines using Map-based message dispatcher
- `sendMessage()` now accepts images array instead of boolean flag
```typescript
const sendMessage = useCallback((
  text: string,
  planMode: boolean,
  thinkingMode: boolean,
  images?: Array<{ id: string; path: string; position: number }>
) => { ... }, []);
```

### `src/webview/hooks/useChatActions.ts`
- Added `pendingImages` and `clearPendingImages` from chatStore
- `handleSubmit()` now builds images array and passes to sendMessage
- Images cleared after successful send

### `src/webview/hooks/handlers/useSessionHandlers.ts`
- Added `updateChatName` handler for chat name updates
- Added `chatNameUpdated` handler for name change notifications

### `src/webview/hooks/handlers/useUiHandlers.ts`
- Fixed `modelSelected` to handle undefined data safely
```typescript
modelSelected: (data: { model: string } | undefined) => {
  if (data?.model) { setModel(data.model); }
},
```

### `src/webview/stores/chatStore.ts`
- Added `nextImagePosition` counter for stable image ordering
- `pendingImages` now includes `position` field
- `addPendingImage` auto-assigns position on add
- `clearPendingImages` resets position counter

### `src/extension.ts`
- Image sending with base64 encoding
- Images sorted by position before sending to Claude CLI
- Support for multiple image formats (jpg, png, gif, webp, svg, bmp)

---

## Fixed

### Console Errors
- `Unknown message type: updateChatName` - Added handler
- `Unknown message type: chatNameUpdated` - Added handler
- `Cannot read properties of undefined (reading 'model')` - Added null check in `modelSelected`

### Console Warnings
- Removed debug `alert()` call from `conversation-item.tsx:79`
- Removed umami analytics script from `ui-react.ts` (blocked by VS Code CSP)

### Build Errors
- Removed backup `.tsx/.ts` files from `docs/session-logs/backup-2026-01-02/` that caused TypeScript compilation errors

---

## Removed

- `docs/session-logs/backup-2026-01-02/` - Entire backup directory (caused TS errors)
- `docs/plans/mcp-project-level-storage.md` - Stale planning doc
- `docs/plans/terminal-cwd-investigation.md` - Stale planning doc
- Umami analytics script from HTML template (CSP blocks it anyway)
- 4 stale git worktrees cleaned up

---

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/webview/hooks/handlers/*.ts` | **NEW** | 8 handler files from refactor |
| `src/webview/hooks/useChatActions.ts` | **NEW** | Chat input actions hook |
| `src/webview/hooks/useModalHandlers.ts` | **NEW** | Modal state hook |
| `src/webview/hooks/useAdaptiveLayout.ts` | **NEW** | Responsive layout hook |
| `src/webview/stores/branchStore.ts` | **NEW** | Branch/session store |
| `src/webview/lib/animations.ts` | **NEW** | Framer motion animations |
| `src/webview/hooks/useVSCodeMessaging.ts` | Modified | Refactored + image support |
| `src/extension.ts` | Modified | Base64 image encoding |
| `src/ui-react.ts` | Modified | Removed umami script |
| `docs/session-logs/backup-2026-01-02/*` | **DELETED** | Caused TS errors |

---

## Key Interfaces

```typescript
// Image sending signature (useChatActions.ts)
const handleSubmit = useCallback(() => {
  const images = pendingImages.map(img => ({
    id: img.id,
    path: img.path,
    position: img.position
  }));
  sendMessage(inputValue, planMode, thinkingMode,
    images.length > 0 ? images : undefined);
  clearPendingImages();
}, [...]);

// Pending image type (chatStore.ts)
pendingImages: Array<{
  id: string;
  src: string;
  path: string;
  position: number
}>;

// Image content format sent to Claude CLI
content: [
  { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '...' } },
  { type: 'text', text: 'User message' }
]
```

---

## Verification

**Command**: `npm run compile`
**Results**: ✅ Compiled successfully

**Command**: `npx vsce package --allow-missing-repository`
**Results**: ✅ Packaged (3036 files, 7.01 MB)

**Command**: `code --install-extension claude-code-chat-1.1.0.vsix --force`
**Results**: ✅ Extension installed

**Manual checks**:
- All 5 feature branches merged
- No unmerged branches remaining
- All worktrees cleaned up
- Console errors resolved

---

## Git State

```
8efd792 fix: resolve console errors and warnings
be29730 Merge branch 'feature/mcp-editor-integration' into main
830ad7b Merge branch 'feature/multi-window-processes' into main
760a386 fix: port image sending to refactored hook structure
46da3de Merge branch 'feature/wt3-frontend-logic' into main
8587e99 feat: add image sending to Claude CLI and clickable file paths
4db3533 Merge branch 'feature/framer-components'
daea067 Merge branch 'feature/token-display'
7431473 fix: merge feature/ui-fixes to restore UI positioning
```

---

## Prevention Rules Added

Added to `CLAUDE.md` to prevent future regressions:

```markdown
### CRITICAL: Prevent Regressions
Before ANY bulk commit or "sync" operation:
1. git branch --no-merged main  # Check for unmerged work
2. If branches exist, STOP and ask user

At session start, always run:
- git log --oneline -3
- git branch --no-merged main
- git status --short
```
