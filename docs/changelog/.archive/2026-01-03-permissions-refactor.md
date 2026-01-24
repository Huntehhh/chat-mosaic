# Service Extraction & Permissions Refactoring - 2026-01-03

## Overview

Major modularization session: extracted 3 new services from `extension.ts`, consolidated permissions with enhanced security, and added LRU caching for memory efficiency.

## Changes Made

### 1. PermissionsManager Enhancements

**Added panelId support for multi-panel process routing:**
```typescript
export interface PermissionRequest {
  panelId?: string;  // NEW: For multi-panel process routing
}
```

**Added panel-aware cancellation:**
```typescript
cancelPendingRequestsForPanel(panelId: string): string[]
```

**Merged command patterns from both implementations:**
- Added 15+ new patterns from extension.ts
- Now includes: docker push, cargo install, mvn subcommands, gradle subcommands
- System commands: curl, wget, ssh, scp, rsync, tar, zip, unzip
- Runtime: node, python, python3, bundle, gem, composer

### 2. Extension.ts Wiring

**Replaced with PermissionsManager calls:**
| Old Method | Replacement |
|------------|-------------|
| `_isToolPreApproved()` | `_permissionsManager.isToolPreApproved()` |
| `_matchesPattern()` | (internal to PermissionsManager) |
| `getCommandPattern()` | `_permissionsManager.getCommandPattern()` |
| `_saveLocalPermission()` | `_permissionsManager.saveLocalPermission()` |
| `_sendPermissions()` | `_permissionsManager.getPermissions()` |
| `_removePermission()` | `_permissionsManager.removePermission()` |
| `_addPermission()` | `_permissionsManager.addPermission()` |
| `_cancelPendingPermissionRequests()` | `_permissionsManager.cancelPendingRequestsForPanel()` |

### 3. Edge Cases Handled

**Pattern Matching (PermissionsManager has superior implementation):**
- Exact match
- Trailing wildcard (`npm install *`)
- Regex patterns (`/^npm (install|i) /`)
- Minimatch glob patterns (`git {add,commit} *`)
- Case-insensitive matching via minimatch

**Blocked Commands (CRITICAL SECURITY - was MISSING in extension.ts):**
- Destructive: `rm -rf /`, `rm -rf ~`, `rm -rf *`
- Privilege escalation: `sudo su`, `sudo bash`, `sudo -i`
- System destruction: `mkfs`, `dd if=*/of=/dev/*`
- Fork bombs: `:(){:|:&};:`
- Dangerous permissions: `chmod 777 /`, `chown -R * /`
- Remote code execution: `curl | bash`, `wget | sh`
- History manipulation: `history -c`, `rm ~/.bash_history`

**Audit Logging (was MISSING in extension.ts):**
- All permission decisions logged to JSONL
- O(1) atomic appends using `fs.appendFile`
- Tracks: timestamp, action, toolName, command, pattern, reason
- Retrievable via `getRecentAuditEntries(limit)`

**Command Pattern Generation (merged from both):**
- Default for unknown commands with args: `${baseCmd} *` (better than exact match)
- Single-word commands: returned as-is

### 4. Lines Removed from extension.ts

| Method | Lines | Status |
|--------|-------|--------|
| `_isToolPreApproved()` | ~40 | ✅ DELETED |
| `_matchesPattern()` | ~15 | ✅ DELETED |
| `getCommandPattern()` | ~95 | ✅ DELETED |
| `_saveLocalPermission()` | ~50 | ✅ DELETED |
| `_pendingPermissionRequests` property | ~8 | ✅ DELETED |
| `_sendPermissions()` | ~32 → 13 | ✅ SIMPLIFIED |
| `_removePermission()` | ~45 → 5 | ✅ SIMPLIFIED |
| `_addPermission()` | ~65 → 5 | ✅ SIMPLIFIED |
| `_cancelPendingPermissionRequests()` | ~18 → 4 | ✅ SIMPLIFIED |

**Actual reduction: 303 lines** (3,444 → 3,141)

### 5. Features Now Available

1. **Blocked command detection** - Dangerous commands ALWAYS prompt
2. **Audit logging** - All decisions logged for debugging/compliance
3. **Rich pattern matching** - Regex, glob, wildcards all supported
4. **Panel isolation** - Each panel's permissions tracked separately
5. **Warned commands** - `sudo *`, `chmod 777 *`, `rm -rf *` trigger warnings

## Testing Checklist

- [ ] Permission prompts appear for blocked commands
- [ ] Auto-approve works for pre-approved patterns
- [ ] "Always allow" saves to local permissions
- [ ] Remove permission works from settings
- [ ] Add permission works from settings
- [ ] Multi-panel permission isolation works
- [ ] Audit log written on permission decisions

## Build Status

- [x] `npm run compile` passes

## Line Count Progress

| Session | Lines | Change |
|---------|-------|--------|
| Before Session 4 | 3,592 | - |
| After ProcessRegistry | 3,444 | -148 |
| After Permissions Refactor | 3,141 | -303 |
| After SnippetsService | 3,081 | -60 |
| After DiffService | **2,981** | **-100** |
| **Total Session 4** | - | **-611 lines** |

---

## New Services Extracted

### 6. SnippetsService (NEW)

**File:** `src/services/SnippetsService.ts` (~120 lines)

Custom prompt snippet management with enhanced features:

```typescript
export class SnippetsService {
  async getAll(): Promise<Record<string, Snippet>>
  async get(snippetId: string): Promise<Snippet | undefined>
  async sendAll(): Promise<void>
  async save(snippet: Snippet): Promise<boolean>
  async delete(snippetId: string): Promise<boolean>
  async import(snippets: Record<string, Snippet>): Promise<number>
  async export(): Promise<Record<string, Snippet>>
  async clear(): Promise<boolean>
}
```

**Features:**
- CRUD operations for custom prompt snippets
- Timestamp metadata (createdAt, updatedAt)
- Batch import/export support
- VS Code globalState persistence

**Extension.ts changes:**
| Old Method | Replacement |
|------------|-------------|
| `_sendCustomSnippets()` | `_snippetsService.sendAll()` |
| `_saveCustomSnippet()` | `_snippetsService.save()` |
| `_deleteCustomSnippet()` | `_snippetsService.delete()` |

**Lines removed:** 60

---

### 7. DiffService with LRU Cache (NEW)

**File:** `src/services/DiffService.ts` (~230 lines)

Diff editor management with memory-efficient LRU caching:

```typescript
export class LRUCache<K, V> {
  constructor(maxSize: number = 50)
  get(key: K): V | undefined
  set(key: K, value: V): void
  delete(key: K): boolean
  has(key: K): boolean
  get size(): number
  clear(): void
}

export class DiffService {
  getContentProvider(): vscode.TextDocumentContentProvider
  async openDiffByMessageIndex(messageIndex: number): Promise<void>
  async openDiffEditor(oldContent: string, newContent: string, filePath: string): Promise<void>
  getCacheSize(): number
  clearCache(): void
  dispose(): void
}
```

**Features:**
- LRU cache prevents unbounded memory growth (max 50 entries default)
- Automatic eviction of oldest entries when capacity reached
- Callback pattern for conversation access
- Disposed state tracking for safe cleanup

**P2 Performance Improvement:**
- Before: Unbounded `Map<string, string>` for diff content
- After: `LRUCache<string, string>` with configurable max size
- Memory savings: O(1) bounded memory instead of O(n) growth

**Extension.ts changes:**
| Old Component | Replacement |
|---------------|-------------|
| `diffContentStore` (global Map) | `LRUCache` inside DiffService |
| `DiffContentProvider` (class) | `DiffContentProvider` inside DiffService |
| `_openDiffByMessageIndex()` | `_diffService.openDiffByMessageIndex()` |
| `_openDiffEditor()` | `_diffService.openDiffEditor()` |

**Lines removed:** 100

---

## Services Now Available

| Service | Location | Purpose |
|---------|----------|---------|
| BackupService | services/BackupService.ts | Git backup management |
| CliIntegration | services/CliIntegration.ts | CLI conversation handling |
| CliSchemas | services/CliSchemas.ts | Zod message validation |
| ConversationManager | services/ConversationManager.ts | Conversation persistence |
| **DiffService** | services/DiffService.ts | **Diff editor + LRU cache** |
| GitService | services/GitService.ts | Git operations |
| McpService | services/McpService.ts | MCP server management |
| MemoryMonitor | services/MemoryMonitor.ts | Memory tracking |
| MessageDebouncer | services/MessageDebouncer.ts | Message batching |
| MessageRouter | services/MessageRouter.ts | Webview message routing |
| MetricsService | services/MetricsService.ts | Usage metrics |
| PanelManager | services/PanelManager.ts | Panel state management |
| PermissionsManager | services/PermissionsManager.ts | Permission handling + audit |
| ProcessManager | services/ProcessManager.ts | Process lifecycle |
| ProcessRegistry | services/ProcessRegistry.ts | Multi-panel process registry |
| SessionManager | services/SessionManager.ts | Session management |
| SettingsManager | services/SettingsManager.ts | VS Code settings |
| **SnippetsService** | services/SnippetsService.ts | **Custom prompt snippets** |
| StreamBuffer | services/StreamBuffer.ts | JSONL stream parsing |
| StreamProcessor | services/StreamProcessor.ts | Stdout processing |
| TerminalManager | services/TerminalManager.ts | Terminal operations |
| WorkspaceFileService | services/WorkspaceFileService.ts | File operations |

**Total services:** 22
