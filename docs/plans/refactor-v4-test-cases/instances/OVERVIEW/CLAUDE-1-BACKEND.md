# CLAUDE-1: Backend Overview

Backend services layer handling process management, security, and data persistence.

---

## Phase 1: HIGH Priority (Security & Stability)

### C1. Shell Wrapper Bypass Prevention ❌ CRITICAL
```
User Input → bash -c "rm -rf /" → PermissionsManager
                                         ↓
                                  [BLOCKED] ✗
```
Detects shell wrappers (`bash -c`, `sh -c`), command chaining (`;`, `&&`, `||`), and command substitution (`$()`, backticks). Prevents dangerous commands from bypassing security checks by nesting.

### C2. SIGKILL Timeout ✅ DONE
```
Process Shutdown: stdin close → SIGTERM → SIGKILL
                   500ms        2s         3s (timeout)
```
Three-stage graceful shutdown prevents zombie processes. Already implemented in ProcessManager:406-469.

### C3. CLI Argument Injection ⚠️ PARTIAL
```
Settings: nodePath="/usr/bin/node; rm -rf /" → isValidShellPath()
                                                      ↓
                                               Validation Error ✗
```
Validates config paths against shell metacharacters before spawning processes. Utility exists in `shell.ts`, needs wiring to ProcessManager.

### C4. Path Traversal Prevention ⚠️ PARTIAL
```
File Path: /projects/../../../etc/passwd
                    ↓
        fs.realpath() → /etc/passwd
                    ↓
        Outside projects directory → [BLOCKED] ✗
```
Upgrades from `path.resolve()` to `fs.realpath()` to resolve symlinks, preventing escapes from projects directory.

### H2. Memory-Efficient Pagination ✅ DONE
```
JSONL File (500MB) → readline.createInterface()
                            ↓
                     Stream 100 lines at a time
                            ↓
                     No full file load in memory
```
Uses streaming readline with PAGE_SIZE=100 to load conversations without memory spikes.

### H3. Race Condition Protection ✅ DONE
```
Panel A spawn → Mutex Lock → Process Creation → Unlock
Panel B spawn → [WAITS]    ↑                      ↓
                            └──────────────────────┘
```
Uses `async-mutex` to prevent concurrent process management operations from corrupting state.

### H4. WSL Path Conversion ✅ DONE
```
Windows: C:\Users\name\project
              ↓
WSL: /mnt/c/Users/name/project
```
Centralized utilities in `src/utils/paths.ts` handle cross-platform path conversions.

### M1. Structured Logging ❌ NEW
```
console.log("Process started") → Logger.info("Process spawned", { pid, panelId })
                                       ↓
                                  [2025-01-04T10:30:00Z] [INFO] [ProcessManager] Process spawned
```
Centralized logger with log levels, timestamps, component tags, and structured data fields.

### Conversation Search Service ❌ NEW
```
Query: "authentication" → Search JSONL files → Results with snippets
                                ↓
                        [ session-1: "JWT auth implementation..." ]
                        [ session-2: "Added OAuth flow..." ]
```
Full-text search across all conversations with snippet extraction and relevance ranking.

### Think Mode Settings & Process Restart ❌ NEW
```
Toggle thinking disabled → Write .claude/settings.local.json
                                ↓
                        Kill Claude process → Respawn → Settings applied
```
Handles thinking mode toggle from UI, updates project settings file, restarts process to apply changes.

### Concurrent Message Support ❌ NEW
```
Message A (id:1) → [Received] → [Processing] → [Completed]
Message B (id:2) → [Received] → [Processing] → [Completed]
                        ↓
            Track message IDs, send status acks
```
Tracks multiple in-flight messages with unique IDs. Sends acknowledgments for status updates (received, processing, completed, error).

### MCP Terminal Process Restart ❌ NEW
```
MCP Terminal closed → onMCPTerminalClosed callback
                            ↓
                    Restart Claude process → Apply MCP changes
```
Automatically restarts background Claude process when MCP terminal closes to pick up configuration changes.

---

## Phase 2: MEDIUM/LOW Priority (Features & Quality)

### M3. Model Constants ❌ NEW
```typescript
SUPPORTED_MODELS = ['opus', 'sonnet', 'haiku', 'default']
DEFAULT_MODEL = 'sonnet'
```
Eliminates hardcoded model strings. Centralizes model configuration in `constants.ts`.

### M4. Buffer Overflow Callback ❌ NEW
```
StreamBuffer (5MB limit) → Overflow detected → onOverflow callback
                                                      ↓
                                               Notify UI: "Stream too large"
```
Adds notification when stream buffer exceeds MAX_BUFFER_SIZE. Currently just logs and resets.

### File Locking ❌ NEW
```
Window A: Save index → Acquire lock → Write → Release
Window B: Save index → [WAITS]     ↑           ↓
                          └────────────────────┘
```
Uses `proper-lockfile` to prevent race conditions when multiple windows edit per-project index.

### Export Service ❌ NEW
```
Conversation → ExportService → [Markdown | JSON | HTML]
                    ↓
            conversation.md / conversation.json / conversation.html
```
Exports conversations to multiple formats with syntax highlighting and proper escaping.

### Allowlist Mode ❌ NEW
```
Blocklist: Allow all, block dangerous (default)
Allowlist: Block all, allow only approved (restrictive)
```
Adds restrictive permission mode that blocks everything except explicitly approved patterns.

---

## Summary

**Phase 1 Focus:** Security (C1, C3, C4), structured logging, conversation search, concurrent messaging, think mode settings, and MCP terminal integration.

**Phase 2 Focus:** Code quality improvements (model constants, async return types), export service, allowlist mode, and reliability enhancements (file locking).

**Already Complete:** C2 (graceful shutdown), H2 (pagination), H3 (mutex), H4 (WSL paths).
