# Changelog - 2025-12-18 (Session 2)

## Backend APIs Ready for STITCH UI Overhaul

- **Goal**: Prepare extension.ts backend to support all features in STITCH-PROMPTS-WARP-LINEAR.md before React UI switch
- **Risk Level**: Low - All changes are additive, no existing functionality modified

Added 4 new backend features (checkpoints API, todo panel state, compact settings, file extensions) to support the upcoming React/shadcn frontend rebuild. All features follow existing patterns and compile cleanly.

---

## Quick-Scan Summary

| Component | Before | After | Change |
|-----------|--------|-------|--------|
| Message handlers | 26 | 28 | +2 new handlers |
| Settings fields | 6 | 8 | +2 compact settings |
| File picker response | 3 fields | 4 fields | +extension field |
| Todo state tracking | None | Full | New panel support |

| File | Lines Changed |
|------|---------------|
| `src/extension.ts` | +47 |
| `package.json` | +10 |
| Total | +103 -36 |

---

## ✅ No Breaking Changes

All changes are additive. Existing message types and APIs unchanged.

---

## Environment & Dependencies

| Type | Name | Change | Notes |
|------|------|--------|-------|
| Config | `claudeCodeChat.compact.enabled` | **Added** | Default: `false` |
| Config | `claudeCodeChat.compact.previewHeight` | **Added** | Default: `150` (pixels) |

No npm dependency changes.

---

## Added

### `src/extension.ts`

**Checkpoint Browser API**
- Added `getCheckpoints` message handler (line 399)
- Added `_sendCheckpoints()` method (line 1333-1344)
- Exposes existing `_commits` array to UI for checkpoint browser feature

**To-do List Panel State**
- Added `_currentTodos` property (line 128) to track current todo list
- Updated TodoWrite tool handling (line 883-894) to store todos and send updates
- Added `getTodos` message handler (line 402-406)
- Sends `todosUpdated` message whenever TodoWrite tool runs

**Compact Tool Output Settings**
- Added `compact.enabled` and `compact.previewHeight` to `_sendCurrentSettings()` (lines 2930-2931)
- Settings auto-persist via existing `_updateSettings()` loop

**File Extension Field**
- Enhanced `_sendWorkspaceFiles()` (lines 2577-2587) to include `extension` field
- Extracts lowercase extension from filename (e.g., `'ts'`, `'js'`, `'py'`)

### `package.json`

- Added `claudeCodeChat.compact.enabled` configuration schema (lines 212-216)
- Added `claudeCodeChat.compact.previewHeight` configuration schema (lines 217-221)

---

## Key Interfaces

```typescript
// New message: UI → Backend
case 'getCheckpoints':
case 'getTodos':

// New message: Backend → UI
type: 'checkpoints'
data: Array<{
  sha: string;        // 7-char short SHA
  fullSha: string;    // Full commit SHA
  message: string;
  timestamp: string;
  id: string;
}>

type: 'todosUpdated'
data: Array<{
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}>

// Enhanced workspaceFiles response
type: 'workspaceFiles'
data: Array<{
  name: string;
  path: string;
  fsPath: string;
  extension: string;  // NEW: lowercase, e.g., 'ts', 'py'
}>

// Settings now include
'compact.enabled': boolean;
'compact.previewHeight': number;
```

---

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/extension.ts` | Modified | +4 features, +2 handlers, +1 property |
| `package.json` | Modified | +2 configuration schema entries |
| `STITCH-PROMPTS-WARP-LINEAR.md` | Modified | Reformatted (no functional change) |

---

## Verification

**Command**: `npm run compile`
**Results**: ✅ Build succeeded

```
> claude-code-chat@1.1.0 compile
> tsc -p ./ && node build/esbuild.webview.js

Webview built in 72ms
```

---

## Open Loops

### Known Issues
- None introduced by this session

### Features NOT Implemented (Frontend-Only)
- Popular MCP server templates → Hardcode in React frontend
- File type colored icons → Derive from `extension` field client-side
- Compact tool truncation → CSS `max-height` + React expand state

### Next Immediate Action
When React UI is ready:
1. Wire up `getCheckpoints` → Checkpoint Browser component
2. Wire up `getTodos` → Todo Panel component
3. Wire up `settingsData.compact.*` → Settings modal
4. Use `workspaceFiles[].extension` for colored file icons

### Resume Prompt
```
Resume backend prep for STITCH UI. Backend APIs complete:
- Checkpoints: getCheckpoints → checkpoints
- Todos: getTodos → todosUpdated (auto-updates on TodoWrite)
- Compact: settings now include compact.enabled/previewHeight
- Files: workspaceFiles now includes extension field

Run `npm run compile` to verify. Start React integration at webview components.
```

---

## Context Manifest

Priority files for next session:
- `src/extension.ts` - All backend changes (handlers at ~400, methods at ~1333, ~2577, ~2930)
- `package.json` - New config schema (lines 212-221)
- `STITCH-PROMPTS-WARP-LINEAR.md` - Full UI spec for React implementation
- `src/REACT-UI-SWITCH.md` - Instructions for switching to React UI
