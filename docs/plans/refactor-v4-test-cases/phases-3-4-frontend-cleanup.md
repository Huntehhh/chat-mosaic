# Refactor Plan: Phases 3-4 (Frontend Store Simplification & Code Cleanup)

**Status**: Deferred until Phases 1-2 are fully tested
**Prerequisite**: Complete Phases 1-2 and verify panel independence

---

## Phase 3: Frontend Store Simplification

**Goal:** Reduce state duplication, simplify hooks

### Step 10: Consolidate Permission State

**Current:**
- `chatStore.pendingPermissions` - Active permission requests
- `settingsStore.permissions` - Allowed tool permissions

**Action:**
- Move all permission state to `settingsStore`
- Single `permissions` object with `allowed` + `pending` fields

**Files:**
- `src/webview/stores/chatStore.ts`
- `src/webview/stores/settingsStore.ts`

---

### Step 11: Split useModalHandlers (283 lines → multiple hooks)

**Current:** God hook with 28 handlers

**Action:** Create domain-specific hooks:
- `useSettingsModalHandlers()` - WSL, display settings (~10 handlers)
- `useHistoryModalHandlers()` - conversation selection (~8 handlers)
- `useModelSelectorHandlers()` - model selection (~4 handlers)
- `useMcpManagerHandlers()` - MCP server CRUD (~6 handlers)

**File:** `src/webview/hooks/useModalHandlers.ts`

---

### Step 12: Consolidate Duplicate Message Handlers

**Duplicates to merge:**
- `system` + `systemMessage` → `system`
- `permissionsList` + `permissionsData` → `permissionsData`
- `customSnippets` + `customSnippetsData` → `snippetsData`

**Files:**
- `src/webview/hooks/useVSCodeMessaging.ts`
- `src/webview/hooks/handlers/*.ts`

---

### Step 13: Create Message Handler Registry

**Current:** 100+ handlers in inline Map

**Action:**
```typescript
// Organize by domain
const handlerRegistry = {
  chat: { userInput, output, error, ... },
  session: { ready, sessionInfo, ... },
  settings: { settingsData, ... },
  permissions: { permissionRequest, permissionsData, ... },
  mcp: { mcpServers, mcpServerSaved, ... },
};
```

**File:** `src/webview/hooks/useVSCodeMessaging.ts`

---

## Phase 4: Code Cleanup

### Step 14: Type Safety Improvements

**Action:**
- Replace `any` in message handlers with typed interfaces
- Create `WebviewMessage` union type for all message types

**Example:**
```typescript
type WebviewMessage =
  | { type: 'userInput'; data: string }
  | { type: 'output'; data: string }
  | { type: 'toolUse'; data: ToolUseData }
  | { type: 'sessionInfo'; data: SessionInfoData }
  // ... etc
```

**Files:**
- `src/types/messages.ts`
- All message handler files

---

### Step 15: Pattern Improvements

**Replace Callbacks with EventEmitter:**
- Services currently use callback patterns
- Migrate to Node.js EventEmitter for consistency and better testability

**Remove Dead Code:**
- `CliIntegration.scanConversations()` - Never called (already deleted)
- Duplicate fork bomb pattern in PermissionsManager
- Unused exports in services/index.ts

---

## Files Summary

### Phase 3 Files
| File | Action |
|------|--------|
| `src/webview/stores/settingsStore.ts` | Add pending permissions |
| `src/webview/stores/chatStore.ts` | Remove pending permissions |
| `src/webview/hooks/useModalHandlers.ts` | Split into 4 domain hooks |
| `src/webview/hooks/useVSCodeMessaging.ts` | Create handler registry |
| `src/webview/hooks/handlers/*.ts` | Merge duplicate handlers |

### Phase 4 Files
| File | Action |
|------|--------|
| `src/types/messages.ts` | Create WebviewMessage union type |
| `src/services/*.ts` | Replace callbacks with EventEmitter |
| `src/services/index.ts` | Remove unused exports |
| `src/services/PermissionsManager.ts` | Remove duplicate pattern |

---

## Test Cases (After Phase 3-4)

1. **Settings modal** - All settings save correctly
2. **History panel** - Conversations load and display properly
3. **Model selector** - Model changes apply to new messages
4. **MCP manager** - Servers can be added/removed/edited
5. **Permissions** - Pending permissions resolve correctly
6. **TypeScript** - No `any` types in message handlers

---

## Success Criteria

1. **Reduced hook complexity:** `useModalHandlers` split into 4 smaller hooks
2. **No duplicate handlers:** Single handler for each message type
3. **Type safety:** All message handlers properly typed
4. **Cleaner patterns:** EventEmitter over callbacks where appropriate
5. **No dead code:** All exports and functions used
