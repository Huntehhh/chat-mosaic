# Worktree 3: Frontend Logic

**Files:** `src/webview/hooks/*`, `src/webview/stores/*`, `src/webview/App.tsx`
**Sparse checkout:** `./scripts/wt add frontend-logic src/webview/hooks/ src/webview/stores/ src/webview/App.tsx`

---

## Hook Splitting (Priority)

### 1. Split useVSCodeMessaging.ts
- **Current:** 900 lines, 50+ switch cases
- **Target:** ~100 lines (dispatcher only)

Create handler files:
```
hooks/handlers/
├── useChatHandlers.ts      # userInput, output, toolUse, toolResult
├── useSessionHandlers.ts   # ready, sessionInfo, sessionCleared
├── useSettingsHandlers.ts  # settings, platformInfo, permissions
├── useTokenHandlers.ts     # updateTokens, updateTotals
├── useFileHandlers.ts      # workspaceFiles, checkpoints
└── useMcpHandlers.ts       # mcpServers, mcpServerSaved
```

### 2. Create Main Dispatcher
- **Location:** `hooks/useVSCodeMessaging.ts` (refactor)
- Map-based handler registry
- Import and combine all handler hooks
- Single `window.addEventListener` with routing

---

## Store Optimization

### 3. Zustand Atomic Selectors (Addendum #4)
- **Location:** `stores/chatStore.ts`, `App.tsx`
- Replace bulk destructuring with individual selectors
- Use `shallow` for related value groups
- 60-80% reduction in unnecessary re-renders

**Before:**
```typescript
const { chatName, isProcessing, todos, messages, ... } = useChatStore();
```

**After:**
```typescript
const chatName = useChatStore(state => state.chatName);
const isProcessing = useChatStore(state => state.isProcessing);
```

### 4. Session Branching Store (Feature 3.1)
- **Location:** `stores/branchStore.ts` (new)
- `BranchableMessage` interface
- `activeBranchId`, `branches` Map
- `editAndResubmit`, `switchBranch` actions

---

## New Hooks

### 5. useAdaptiveLayout (Feature 2.4)
- **Location:** `hooks/useAdaptiveLayout.ts` (new)
- ResizeObserver on document.body
- Return `{ isNarrow: width < 300, isCompact: width < 400 }`

### 6. useVirtualization (Feature 3.5)
- **Location:** `hooks/useVirtualization.ts` (new)
- Wrap `react-virtuoso` for 200+ message conversations
- Auto-scroll to bottom on new messages

---

## Slash Commands

### 7. Slash Command Templates (Feature 1.4)
- **Location:** `hooks/useSlashCommands.ts` (new or modify)
- Template expansion with `{selection}`, `{clipboard}`
- Pre-defined: `/explain`, `/refactor`, `/testgen`, `/fix`, `/review`

### 8. Template Config Storage
- **Location:** `stores/settingsStore.ts` (modify)
- User-customizable templates
- Load from VS Code settings

---

## App.tsx Cleanup

### 9. Extract Modal Handlers
- Move modal state to dedicated hook or component
- Reduce App.tsx complexity

### 10. Extract Chat Actions
- `useChatActions.ts` for send, cancel, retry
- Keep App.tsx as pure orchestrator

---

## Dependencies

```json
{
  "dependencies": {
    "react-virtuoso": "^4.x"
  },
  "devDependencies": {
    "zustand": "^4.x"  // already present
  }
}
```

---

## Task Checklist

| Task | Priority | Est. Lines Saved |
|------|----------|------------------|
| Split useVSCodeMessaging | High | 700+ |
| Atomic selectors | Medium | - (perf) |
| useAdaptiveLayout | Medium | - |
| useVirtualization | High | - (perf) |
| Slash command templates | High | - |
| Extract App.tsx handlers | Medium | 100+ |

---

## Verification

After each change:
```bash
npm run compile
```

Target: Reduce `useVSCodeMessaging.ts` from ~900 to <150 lines.
