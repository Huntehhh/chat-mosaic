# Changelog - 2025-12-20 (Session 1)

## CLI History Panel Now Shows Actual Conversations

- **Goal**: Fix CLI history showing "0 messages" for all conversations
- **Risk Level**: Low - Additive logging + filtering, no core logic changes

Fixed the CLI history panel that was displaying snapshot-only JSONL files as conversations with 0 messages. Added comprehensive debug logging and proper VSIX packaging for runtime dependencies.

## Quick-Scan Summary

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| CLI sessions shown | 32 (most empty) | ~7 (with content) | Filtered noise |
| Debug visibility | None | Full logging | Diagnosable |
| VSIX dependencies | Missing zod/minimatch | All included | Extension activates |

## ✅ No Breaking Changes

## Environment & Dependencies

| Type | Name | Change | Notes |
|------|------|--------|-------|
| Package | `.vscodeignore` | Removed `node_modules` exclusion | Runtime deps now bundled |
| VSIX | `node_modules/` | Now included | 2280 files, 12.7MB |

## Fixed

### Fixed: `src/extension.ts` - CLI History Loading

**Root Cause Identified**: The `c--HApps-mosaic` project folder contained:
- 199 total JSONL files
- 134 `agent-*.jsonl` files (filtered out by design)
- 65 remaining files, but most were **snapshot-only** (only `file-history-snapshot` entries)
- Only 7 files had actual `user`/`assistant` messages

The extension was showing all 65 non-agent files as "CLI Session xxx" with "0 messages" because they really had no messages.

**Changes**:

1. **Added skip filter for empty conversations** (line 1943-1947):
```typescript
if (messageCount === 0) {
  console.log(`[CLI Scan] Skipping ${filename}: no user/assistant messages (snapshot-only)`);
  continue;
}
```

2. **Added comprehensive debug logging** to `_loadCLIConversation`:
   - `[CLI Load] Processing X lines from <path>` - line count at start
   - `[CLI Load] Complete: X parsed, Y posted, Z errors` - summary
   - Error details on parse failures

3. **Added guard logging** to `_postMessage` when no webview found

4. **Added warning logging** to `_scanCLIConversations` for parse failures

### Fixed: `.vscodeignore` - VSIX Packaging

Extension failed to activate with `Cannot find module 'zod'` and `Cannot find module 'minimatch'` errors.

**Cause**: `.vscodeignore` excluded `node_modules`, but the services layer requires runtime dependencies that aren't bundled.

**Fix**: Removed `node_modules` exclusion so all dependencies are packaged in VSIX.

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/extension.ts` | Modified | +39 lines debug logging, filter for empty convos |
| `.vscodeignore` | Modified | Removed node_modules exclusion |

## Verification

**Command**: `npm run compile`
**Results**: ✅ Compiled successfully

**VSIX Package**:
- `npx vsce package --allow-missing-repository`
- 2372 files, 5.58 MB
- Includes all node_modules (2280 files)

**Install**: `code --install-extension claude-code-chat-1.1.0.vsix --force`

## Open Loops

### Known Issues
- VSIX is larger than ideal (12.7MB node_modules) - should bundle with esbuild in future
- The `[UriError]: Scheme contains illegal characters` error in logs is a VS Code internal issue, not from this extension

### What Snapshot-Only Files Are
These are **backup/undo tracking files** Claude CLI creates:
```json
{
  "type": "file-history-snapshot",
  "snapshot": {
    "trackedFileBackups": { ... }
  }
}
```
They enable file restoration but aren't actual conversations.

### Next Immediate Action
Test the extension by reloading VS Code and verifying:
1. Console shows `[CLI Scan] Skipping xxx.jsonl: no user/assistant messages`
2. History panel shows only conversations with actual messages
3. Clicking a conversation loads its content

### Resume Prompt
"Verify CLI history fix is working. Check console for `[CLI Scan] Skipping` messages. If still broken, check if extension is using the installed VSIX version."

## Context Manifest

Priority files for debugging:
- `src/extension.ts:1880-1960` - `_scanCLIConversations` with filter
- `src/extension.ts:2837-3000` - `_loadCLIConversation` with logging
- `.vscodeignore` - VSIX packaging config

## Git Commits This Session

```
886ea04 fix: add comprehensive debug logging for CLI history loading
4d8561e fix: filter out snapshot-only JSONL files from CLI history
64b54c3 fix: include zod dependency in VSIX package
121f464 fix: include all node_modules in VSIX for runtime dependencies
```
