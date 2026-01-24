# Changelog - 2025-12-19 (Worktree 3 Frontend Logic)

## Hook Splitting & App.tsx Cleanup - Major Refactoring

- **Goal**: Split monolithic useVSCodeMessaging.ts and App.tsx into smaller, domain-specific hooks
- **Risk Level**: Medium - Major refactoring but backwards compatible

Reduced `useVSCodeMessaging.ts` from 891→415 lines and `App.tsx` from 523→256 lines by extracting handlers into domain-specific files with Map-based message dispatching.

---

## ⚠️ CRITICAL: Read the Plan First

**Plan file**: `C:\Users\casil\.claude\plans\concurrent-humming-cookie.md`

**Future Claude**: READ THIS PLAN before continuing. It contains:
- Full implementation specifications for all phases
- User decisions (breakpoints: 250/350, virtualization: always, branchStore: separate)
- BLOCKED tasks that depend on another worktree merging first
- Detailed code patterns for remaining work

---

## ✅ No Breaking Changes

All changes are additive refactoring. Existing APIs preserved.

---

## Quick-Scan Summary

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| `useVSCodeMessaging.ts` | 891 lines | 415 lines | **-53%** |
| `App.tsx` | 523 lines | 256 lines | **-51%** |
| Handler files | 0 | 8 | +8 new |
| Custom hooks | 1 | 5 | +4 new |
| Store files | 3 | 4 | +1 new |

---

## Environment & Dependencies

| Type | Name | Change | Notes |
|------|------|--------|-------|
| Dep | `react-virtuoso` | Added `^4.12.3` | For MessageList virtualization (blocked task) |

---

## Phase 1: Hook Splitting

### Added: `src/webview/hooks/handlers/`

New directory with 8 handler files implementing Map-based message dispatch:

| File | Message Types | Lines |
|------|---------------|-------|
| `useTokenHandlers.ts` | updateTokens, updateTotals | 25 |
| `useSettingsHandlers.ts` | settings, platformInfo, accountInfo | 36 |
| `useMcpHandlers.ts` | mcpServers, mcpServerSaved/Deleted | 41 |
| `useFileHandlers.ts` | workspaceFiles, checkpoints, conversations | 72 |
| `useSessionHandlers.ts` | ready, sessionInfo, newSession, chatRenamed | 78 |
| `useChatHandlers.ts` | userInput, output, toolUse, toolResult, permissions | 168 |
| `useUiHandlers.ts` | modals, toast, install, model selection | 69 |
| `index.ts` | Barrel export | 15 |

### Changed: `src/webview/hooks/useVSCodeMessaging.ts`

Replaced 503-line switch statement with Map-based dispatcher:

```typescript
const handlerMap = useMemo(() => new Map<string, (data: unknown) => void>([
  ['userInput', chatHandlers.userInput],
  ['output', chatHandlers.output],
  // ... 50+ message types mapped to handlers
]), [chatHandlers, sessionHandlers, ...]);

useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    const handler = handlerMap.get(msg.type);
    handler ? handler(msg.data) : console.log('Unknown:', msg.type);
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [handlerMap]);
```

---

## Phase 2: Store (Partial)

### Added: `src/webview/stores/branchStore.ts`

New Zustand store for session branching:

```typescript
interface BranchableMessage {
  id: string;
  parentId: string | null;
  branchId: string;
  content: string;
  type: 'user' | 'claude' | 'tool-use' | 'tool-result';
  timestamp: number;
  children: string[];
}

// Actions
createBranch(fromMessageId: string, name?: string): string
switchBranch(branchId: string): void
deleteBranch(branchId: string): void

// Atomic selectors
useActiveBranchId, useActiveBranch, useBranches, useBranchCount, useHasBranches
```

---

## Phase 3: New Hooks (Partial)

### Added: `src/webview/hooks/useAdaptiveLayout.ts`

ResizeObserver-based layout detection:

```typescript
// User-specified breakpoints (tighter than default)
const NARROW_BREAKPOINT = 250;  // was 300
const COMPACT_BREAKPOINT = 350; // was 400

function useAdaptiveLayout(): {
  layoutSize: 'narrow' | 'compact' | 'standard';
  isNarrow: boolean;
  isCompact: boolean;
  width: number;
  height: number;
}
```

---

## Phase 4: App.tsx Cleanup

### Added: `src/webview/hooks/useChatActions.ts`

```typescript
function useChatActions() {
  return {
    inputValue, isProcessing, planMode, thinkingMode,
    handleInputChange, handleSubmit, handleStop, handleNewChat, handleFileDrop
  };
}
```

### Added: `src/webview/hooks/useModalHandlers.ts`

Extracted 21 modal handlers organized by domain:
- Header handlers (settings, history, rename)
- Settings modal handlers (10 handlers)
- History panel handlers
- Model selector handlers
- MCP server handlers
- Slash command handlers
- Install modal handlers

### Changed: `src/webview/App.tsx`

```typescript
// Now uses extracted hooks
const chatActions = useChatActions();
const modalHandlers = useModalHandlers();
const { isNarrow, isCompact } = useAdaptiveLayout();
```

---

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `package.json` | Modified | Added react-virtuoso |
| `src/webview/hooks/handlers/index.ts` | **NEW** | Barrel export |
| `src/webview/hooks/handlers/useChatHandlers.ts` | **NEW** | 168 lines |
| `src/webview/hooks/handlers/useFileHandlers.ts` | **NEW** | 72 lines |
| `src/webview/hooks/handlers/useMcpHandlers.ts` | **NEW** | 41 lines |
| `src/webview/hooks/handlers/useSessionHandlers.ts` | **NEW** | 78 lines |
| `src/webview/hooks/handlers/useSettingsHandlers.ts` | **NEW** | 36 lines |
| `src/webview/hooks/handlers/useTokenHandlers.ts` | **NEW** | 25 lines |
| `src/webview/hooks/handlers/useUiHandlers.ts` | **NEW** | 69 lines |
| `src/webview/hooks/useAdaptiveLayout.ts` | **NEW** | ~90 lines |
| `src/webview/hooks/useChatActions.ts` | **NEW** | ~60 lines |
| `src/webview/hooks/useModalHandlers.ts` | **NEW** | ~240 lines |
| `src/webview/hooks/useVSCodeMessaging.ts` | Modified | 891→415 lines |
| `src/webview/stores/branchStore.ts` | **NEW** | ~180 lines |
| `src/webview/App.tsx` | Modified | 523→256 lines |

---

## Verification

**Commit**: `4ee6338` on branch `feature/wt3-frontend-logic`
**Worktree**: `C:\HApps\claude-code-chat\.worktrees\wt3-frontend-logic`

Cannot compile in sparse worktree (stores not checked out). Compile after merge.

---

## Open Loops

### BLOCKED Tasks (Conflict with Another Worktree)

Another Claude is working on:
- `src/webview/stores/chatStore.ts`
- `src/webview/stores/settingsStore.ts`
- `src/webview/containers/MessageList.tsx`

**After their merge, complete these from the plan:**

1. **Add atomic selectors to chatStore.ts**
2. **Add atomic selectors to settingsStore.ts**
3. **Create useVirtualization.ts** (react-virtuoso wrapper)
4. **Update MessageList.tsx with Virtuoso** (always enabled per user decision)

### User Decisions (From Plan)

| Decision | Value |
|----------|-------|
| branchStore location | Separate file |
| Breakpoints | 250/350 (tighter) |
| Virtualization | Always enabled |

---

## Context Manifest

Read in this order:
1. **Plan**: `C:\Users\casil\.claude\plans\concurrent-humming-cookie.md` - **READ FIRST**
2. `src/webview/hooks/useVSCodeMessaging.ts` - Refactored dispatcher
3. `src/webview/hooks/handlers/` - New handler files
4. `src/webview/App.tsx` - Uses new hooks
5. `src/webview/stores/branchStore.ts` - New branching store

---

## Resume Prompt

```
Resume Worktree 3 Frontend Logic.

FIRST: Read the plan at C:\Users\casil\.claude\plans\concurrent-humming-cookie.md

Completed:
- Hook splitting (useVSCodeMessaging 891→415 lines)
- branchStore.ts
- useAdaptiveLayout.ts (250/350 breakpoints)
- useChatActions.ts + useModalHandlers.ts
- App.tsx refactor (523→256 lines)

BLOCKED (waiting for other worktree):
- Atomic selectors for chatStore.ts and settingsStore.ts
- useVirtualization.ts
- MessageList.tsx virtualization

Worktree: C:\HApps\claude-code-chat\.worktrees\wt3-frontend-logic
Branch: feature/wt3-frontend-logic
Commit: 4ee6338
```

---

## Git State

```bash
# Worktree location
C:\HApps\claude-code-chat\.worktrees\wt3-frontend-logic

# Branch
feature/wt3-frontend-logic

# To merge to main (after other worktree merges):
cd C:\HApps\claude-code-chat
git merge feature/wt3-frontend-logic
./scripts/wt rm wt3-frontend-logic
```
