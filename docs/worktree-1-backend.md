# Worktree 1: Backend Services

**Files:** `src/extension.ts`, `src/services/*`, `src/types/*`, `src/controllers/*`

**Sparse checkout:** `./scripts/wt add backend src/extension.ts src/services/ src/types/ src/controllers/`

---

## Architecture Refactoring (Priority)

### 1. Extract ProcessService.ts

- **Source:** extension.ts:368-520
- Wrap existing `ProcessManager.ts` (currently unused)
- Add stream parser, heartbeat monitoring
- Fix race condition with mutex (Addendum #5)

### 2. Extract PermissionsService.ts

- **Source:** extension.ts:2090-2276
- Permission checks, always-allow logic, pattern matching
- Add blocklist for dangerous commands
- Add minimatch for glob patterns (Feature 4.5)

### 3. Extract ConversationService.ts

- **Source:** extension.ts:2778-3395
- Conversation save/load, CLI history scanning
- Add streaming for large JSONL files (Feature 3.6)
- Add Zod schema validation (Feature 4.4)
- Fix atomic writes for index corruption (Addendum #6)

### 4. Extract BackupService.ts

- **Source:** extension.ts:1602-1742
- Git checkpoint create/restore
- Time travel debugging support (Feature 3.2)

### 5. Extract McpService.ts

- **Source:** extension.ts:1779-1827, 2557-2672
- MCP server config management
- Load/save/delete operations

### 6. Create PanelManager.ts

- **Source:** extension.ts:87-208
- Multi-panel state tracking
- Replace legacy `_panel` property

### 7. Create MessageRouter.ts

- **Source:** extension.ts:691-802
- Handler registry pattern (Map-based)
- Replace 150-line switch statement

---

## Service Features

### 8. Robust Stream Buffer (Addendum #3)

- Replace simple `split('\n')` with brace-counting parser
- Handle mid-chunk JSON splits

### 9. WSL Path Edge Cases (Addendum #7)

- Handle UNC paths, special characters
- Prevent double-conversion

### 10. Memory Monitoring (Feature 3.7)

- Monitor heap usage
- Warn at 500MB, prompt restart at 1GB

---

## New Backend Features

### 11. Smart Context Injection (Feature 3.3)

- Auto-inject selection, errors, git diff into prompts
- Build context-enhanced prompt before sending

### 12. Workspace @ Commands (Feature 3.4)

- `@task <name>` - Run VS Code task
- `@git <cmd>` - Run git command
- `@file <path>` - Inject file contents

### 13. Apply to Editor Handler (Feature 2.2)

- Handle `applyCodeToEditor` message
- Insert at cursor or replace file

### 14. Auto-Debug Agent (Feature 4.1)

- Retry on tool errors with AI fixes
- Max 3 retries with different approaches

---

## Shared Types (Foundation)

### 15. Create src/types/shared.ts (Addendum #1)

- Single source of truth for message types
- `ServerMessage` and `ClientMessage` unions
- Import in both extension and webview

###  16. Create src/types/session.ts

- `ConversationData`, `PanelState` interfaces

### 17. Create src/types/process.ts

- `ProcessConfig`, callback interfaces

---

## Verification

After each extraction:

```bash
npm run compile
```

Target: Reduce `extension.ts` from ~3000 to <400 lines.