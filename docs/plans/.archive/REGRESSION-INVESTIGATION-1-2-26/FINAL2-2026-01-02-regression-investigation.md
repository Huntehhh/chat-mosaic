# Regression Investigation Report
**Date:** 2026-01-02
**Issue:** Massive UI regression moving codebase back ~5 days
**Status:** IN PROGRESS - Resume in next chat

---

## CONTEXT FOR NEXT CHAT

### What Happened
A "sync local files to git" commit (6f23a7c) overwrote good code with old files because multiple feature branches were never merged. This caused UI regressions.

### What's Been Fixed
1. ✅ Merged `feature/ui-fixes` → token display positioning fixed
2. ✅ Implemented image sending to Claude CLI (base64, stable positions)
3. ✅ Added regression prevention rules to CLAUDE.md

### What Still Needs To Be Done
1. **Merge one of these branches for settings modal fix:**
   - `feature/display-fixes` - cleaner settings, OR
   - `feature/mcp-editor-integration` - has "fix: Settings DISPLAY layout" + MCP editor
   - `feature/multi-window-processes` - has "fix: Settings DISPLAY layout" + multi-window

2. **Commit the current uncommitted changes** (image sending, clickable paths)

3. **Compile and reinstall** after merging

---

## UNMERGED BRANCHES - DETAILED

| Branch | Commits Ahead of Main | Key Changes |
|--------|----------------------|-------------|
| `feature/display-fixes` | 0 (diverged) | Cleaner settings modal UI |
| `feature/token-display` | 1 | `feat: prep backend token/cost data for frontend display` |
| `feature/framer-components` | 1 | `feat: add framer-motion animations and new UI components` |
| `feature/mcp-editor-integration` | 15 | MCP editor, settings fixes, worktree scripts |
| `feature/multi-window-processes` | 10 | Multi-window support, settings layout fix |
| `feature/wt3-frontend-logic` | 1 | `refactor: split hooks and extract App.tsx handlers` |

### Recommended Merge Order
1. First try `feature/mcp-editor-integration` - has most fixes including settings
2. Or `feature/multi-window-processes` - also has settings fix
3. Check for conflicts carefully

---

## CURRENT UNCOMMITTED CHANGES

```
M CLAUDE.md                                    # Regression prevention rules
M src/extension.ts                             # Image sending (base64 encoding)
M src/webview/App.tsx                          # Pass images array to sendMessage
M src/webview/hooks/useVSCodeMessaging.ts      # sendMessage accepts images
M src/webview/lib/clickable-paths.tsx          # Clickable file path detection
M src/webview/lib/markdown.tsx                 # Clickable path integration
M src/webview/stores/chatStore.ts              # nextImagePosition counter
```

### Image Sending Implementation Details
- **Location:** `src/extension.ts` lines 1078-1132
- **Format:** Base64 encoded with media_type
- **Position stability:** Images get position on add, never changes on delete
- **Sorting:** Images sorted by position before sending to Claude

```typescript
// Content array format sent to Claude CLI:
content: [
  { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '...' } },
  { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: '...' } },
  { type: 'text', text: 'User message here' }
]
```

---

## ROOT CAUSE ANALYSIS

**Session 2** (Image Preview session) ran:
```bash
git add -A && git commit -m "chore: sync local files to git - local files as source of truth"
```

This committed 230 files with 49,337 insertions - but the working directory had OLD files that were missing changes from unmerged feature branches.

---

## GIT STATE

```
7431473 fix: merge feature/ui-fixes to restore UI positioning (CURRENT HEAD)
6c31dd1 feat: add image preview with remove buttons and clickable lightbox
6f23a7c chore: sync local files to git (THE PROBLEM COMMIT - 230 files)
71e299a chore: exclude docs, opencode-cli, .serena, .mcp.json
```

---

## SESSION LOGS REFERENCED

1. **`docs/session-logs/2026-01-02-image-system-session.md`** - Image system implementation
2. **`docs/changelog/2026-01-02-session-image-preview.md`** - Caused regression
3. **`CHANGE_LOG_SESSION.md`** - Clickable paths session

---

## SETTINGS MODAL ISSUE

**Current (main) - BROKEN:**
- Every toggle has redundant height input (copy-paste error)
- Shows "px" not "lines"
- `src/webview/components/organisms/settings-modal.tsx` lines 232-299

**feature/display-fixes - BETTER:**
- Only "Compact tool output" has height input
- Cleaner layout

**User wanted "lines" not "px"** - this may have been uncommitted local changes that were lost

---

## COMMANDS TO RUN IN NEXT SESSION

```bash
# 1. Check current state
git status --short
git branch --no-merged main

# 2. Stash current uncommitted work
git stash push -m "image-sending-and-clickable-paths"

# 3. Merge settings fix (try mcp-editor-integration first)
git merge feature/mcp-editor-integration
# OR if conflicts: git merge feature/display-fixes

# 4. Pop stash and resolve conflicts
git stash pop

# 5. Compile and install
npm run compile
npx vsce package --allow-missing-repository
code --install-extension claude-code-chat-1.1.0.vsix --force
```

---

## USER'S ORIGINAL IMAGE TASK

> Set up the image system in the backend so that it actually sends images to Claude and make sure that they're being sent in order. Handle edge cases: if image one is deleted, image two position should not change to image one position. This is because user is pasting images while talking to Claude.

**STATUS: ✅ IMPLEMENTED** - but needs to be committed after branch merge
