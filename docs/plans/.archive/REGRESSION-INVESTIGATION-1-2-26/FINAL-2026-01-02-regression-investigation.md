# Regression Investigation Report
**Date:** 2026-01-02
**Issue:** Massive UI regression moving codebase back ~5 days

---

## Root Cause

**Session 2** (Image Preview session) ran:
```bash
git add -A && git commit -m "chore: sync local files to git - local files as source of truth"
```

This committed 230 files with 49,337 insertions - but the working directory had OLD files that were missing changes from unmerged feature branches.

---

## Unmerged Branches Found

| Branch | Status | Contains |
|--------|--------|----------|
| `feature/ui-fixes` | **MERGED** (7431473) | Token display `right-0`, tool rendering fixes |
| `feature/display-fixes` | **NOT MERGED** | Clean settings modal, proper height input placement |
| `feature/framer-components` | NOT MERGED | Framer motion animations |
| `feature/mcp-editor-integration` | NOT MERGED | MCP editor features |
| `feature/multi-window-processes` | NOT MERGED | Multi-window support |
| `feature/token-display` | NOT MERGED | Token display improvements |
| `feature/wt3-frontend-logic` | NOT MERGED | Frontend logic extraction |

---

## Session Logs Referenced

1. **`docs/session-logs/2026-01-02-image-system-session.md`**
   - My session (Image System Implementation)
   - Modified: `useVSCodeMessaging.ts`, `chatStore.ts`
   - No git commands

2. **`docs/changelog/2026-01-02-session-image-preview.md`**
   - Session 2 (Image Preview Feature)
   - **CAUSED REGRESSION** with "sync local files" commit
   - Did: `git add -A && git commit` (230 files changed)
   - Then compiled and installed

3. **`CHANGE_LOG_SESSION.md`**
   - Session 3 (Clickable Paths)
   - Modified: `clickable-paths.tsx`, `markdown.tsx`
   - Only ran `git status`

---

## Symptoms User Reported

1. Token display moved too far right (overflow) → **FIXED** by merging `feature/ui-fixes`
2. Settings modal missing backend buttons → Still broken
3. Display settings showing pixels instead of lines → Still broken (may be lost local changes)
4. Can't send messages while Claude responding → Need to verify
5. Stop button styling wrong → Need to verify
6. Chat box not expanding → Need to verify

---

## Current Git State

```
7431473 fix: merge feature/ui-fixes to restore UI positioning
6c31dd1 feat: add image preview with remove buttons and clickable lightbox
6f23a7c chore: sync local files to git (THE PROBLEM COMMIT - 230 files)
71e299a chore: exclude docs, opencode-cli, .serena, .mcp.json
```

---

## Fixes Applied

1. ✅ Merged `feature/ui-fixes` → commit 7431473
2. ✅ Implemented image sending with base64 encoding
3. ✅ Added stable image positions (survives deletions)
4. ✅ Added regression prevention rules to CLAUDE.md
5. ⏳ Need to merge `feature/display-fixes` for settings modal

---

## Settings Modal Issue

**Current (main):**
- Every toggle has redundant height input
- Shows "px" not "lines"
- Has "Manage MCP Servers" button

**feature/display-fixes:**
- Only "Compact tool output" has height input
- Cleaner layout
- No MCP button

**Neither has "lines"** - user may have had uncommitted local changes

---

## Prevention Rules Added to CLAUDE.md

```markdown
### CRITICAL: Prevent Regressions

**Before ANY bulk commit or "sync" operation:**
1. git branch --no-merged main  # Check for unmerged work
2. If branches exist, STOP and ask user

**At session start, always run:**
- git log --oneline -3
- git branch --no-merged main
- git status --short
```

---

## Next Steps

1. Merge `feature/display-fixes` into main
2. Check other unmerged branches for needed features
3. Compile and reinstall
4. Verify all UI issues resolved

---

## Files Currently Uncommitted

```
M CLAUDE.md
M src/extension.ts
M src/webview/App.tsx
M src/webview/hooks/useVSCodeMessaging.ts
M src/webview/lib/clickable-paths.tsx
M src/webview/lib/markdown.tsx
M src/webview/stores/chatStore.ts
```

These contain:
- Image sending implementation (base64, positions)
- Clickable file paths
- Regression prevention docs
