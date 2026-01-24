# Worktree 3: Frontend Logic Refactoring Plan

**Scope:** Hook Splitting, Store Optimization, New Hooks, App.tsx Cleanup
**Target:** Reduce useVSCodeMessaging.ts from 891→150 lines, App.tsx from 510→200 lines

## User Decisions
- **branchStore**: Separate file (not merged into chatStore)
- **Breakpoints**: 250/350 (tighter than default 300/400)
- **Virtualization**: Always enabled (not conditional)

---

## Phase 0: Foundation Setup

### Tasks
1. `npm install react-virtuoso`
2. Create `src/webview/hooks/handlers/` directory
3. Create `src/webview/hooks/index.ts` barrel export

**Verification:** `npm run compile` passes

---

## Phase 1: Hook Splitting

### 1.1 Create Handler Files

**Directory:** `src/webview/hooks/handlers/`

| File | Message Types | Lines |
|------|---------------|-------|
| `useTokenHandlers.ts` | updateTokens, updateTotals | ~30 |
| `useSettingsHandlers.ts` | settings, platformInfo, accountInfo | ~50 |
| `useMcpHandlers.ts` | mcpServers, mcpServerSaved, mcpServerDeleted | ~40 |
| `useFileHandlers.ts` | workspaceFiles, checkpoints, conversationList/History | ~60 |
| `useSessionHandlers.ts` | ready, sessionInfo, sessionCleared, newSession, chatRenamed | ~60 |
| `useChatHandlers.ts` | userInput, output, toolUse, toolResult, streaming, error, thinking | ~80 |

**Pattern:** Each handler file exports a hook returning a memoized object of handlers:
```typescript
export function useChatHandlers() {
  const { addMessage, updateLastMessage } = useChatStore();
  return useMemo(() => ({
    userInput: (data) => addMessage({type: 'user', content: data}),
    output: (data) => addMessage({type: 'claude', content: data}),
    // ...
  }), [addMessage, updateLastMessage]);
}
```

### 1.2 Refactor useVSCodeMessaging.ts

Replace 503-line switch with Map-based dispatcher:
```typescript
const handlerMap = useMemo(() => new Map([
  ['userInput', chatHandlers.userInput],
  ['output', chatHandlers.output],
  // ... all 58 types
]), [chatHandlers, sessionHandlers, ...]);

useEffect(() => {
  const handleMessage = (event) => {
    const { type, data } = event.data;
    handlerMap.get(type)?.(data) ?? console.log('Unknown:', type);
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [handlerMap]);
```

**Target:** useVSCodeMessaging.ts < 150 lines

---

## Phase 2: Store Optimization

### 2.1 Add Atomic Selectors

**chatStore.ts additions:**
```typescript
export const useChatName = () => useChatStore(s => s.chatName);
export const useIsProcessing = () => useChatStore(s => s.isProcessing);
export const useMessages = () => useChatStore(s => s.messages);
export const useTotalCost = () => useChatStore(s => s.totalCost);
export const useTodos = () => useChatStore(s => s.todos);
export const useConversations = () => useChatStore(s => s.conversations);
export const usePendingPermissions = () => useChatStore(s => s.pendingPermissions);
```

**settingsStore.ts additions:**
```typescript
export const usePlanMode = () => useSettingsStore(s => s.planMode);
export const useThinkingMode = () => useSettingsStore(s => s.thinkingMode);
export const useYoloMode = () => useSettingsStore(s => s.yoloMode);
export const useSelectedModel = () => useSettingsStore(s => s.selectedModel);
export const useMcpServersState = () => useSettingsStore(s => s.mcpServers);
```

### 2.2 Create branchStore.ts (~100 lines)

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

interface BranchState {
  activeBranchId: string;
  branches: Map<string, string[]>;
  branchPoints: Map<string, string[]>;

  createBranch: (fromMessageId: string) => string;
  switchBranch: (branchId: string) => void;
  editAndResubmit: (messageId: string, newContent: string) => void;
}
```

---

## Phase 3: New Hooks

### 3.1 useAdaptiveLayout.ts (~40 lines)

```typescript
type LayoutSize = 'narrow' | 'compact' | 'standard';

// BREAKPOINTS: 250/350 (tighter, per user preference)
const NARROW_BREAKPOINT = 250;
const COMPACT_BREAKPOINT = 350;

export function useAdaptiveLayout(): {
  layoutSize: LayoutSize;
  isNarrow: boolean;
  isCompact: boolean;
} {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const layoutSize: LayoutSize = width < NARROW_BREAKPOINT ? 'narrow'
    : width < COMPACT_BREAKPOINT ? 'compact' : 'standard';
  return { layoutSize, isNarrow: width < NARROW_BREAKPOINT, isCompact: width < COMPACT_BREAKPOINT };
}
```

### 3.2 useVirtualization.ts (~60 lines)

```typescript
import { VirtuosoHandle } from 'react-virtuoso';

export function useVirtualization(itemCount: number) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth') => {
    virtuosoRef.current?.scrollToIndex({ index: itemCount - 1, behavior });
  }, [itemCount]);

  useEffect(() => {
    if (isAtBottom) scrollToBottom();
  }, [itemCount, isAtBottom, scrollToBottom]);

  return { virtuosoRef, scrollToBottom, isAtBottom, setIsAtBottom };
}
```

### 3.3 Update MessageList.tsx

Replace `.map()` with `<Virtuoso>` component (always enabled, not conditional):

```tsx
import { Virtuoso } from 'react-virtuoso';

const MessageList = ({ messages }) => {
  const { virtuosoRef, setIsAtBottom } = useVirtualization(messages.length);

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={messages}
      itemContent={(index, message) => <MessageBlock message={message} />}
      followOutput="smooth"
      atBottomStateChange={setIsAtBottom}
    />
  );
};
```

---

## Phase 4: App.tsx Cleanup

### 4.1 Create useChatActions.ts (~50 lines)

Extract from App.tsx lines 135-158:
- handleInputChange
- handleSubmit
- handleStop
- handleNewChat
- handleFileDrop

### 4.2 Create useModalHandlers.ts (~120 lines)

Extract from App.tsx lines 164-350:
- Settings handlers (10)
- History handlers (2)
- Model handlers (2)
- MCP handlers (3)
- Slash command handlers (2)
- Install handlers (2)

### 4.3 Refactor App.tsx

```typescript
function App() {
  useVSCodeMessaging();
  const sender = useVSCodeSender();
  const chatActions = useChatActions();
  const modalHandlers = useModalHandlers();
  const { isNarrow, isCompact } = useAdaptiveLayout();

  // Atomic selectors (no destructuring)
  const activeModal = useActiveModal();
  const isProcessing = useIsProcessing();
  const messages = useMessages();

  useEffect(() => { sender.requestReady(); }, []);

  return (
    <div className={cn('app', isNarrow && 'narrow')}>
      <Header {...} />
      <MessageList messages={messages} />
      <ChatInput {...} />
      {/* Modals */}
    </div>
  );
}
```

**Target:** App.tsx < 250 lines

---

## Files Summary

### New Files (11)
- `src/webview/hooks/handlers/useChatHandlers.ts`
- `src/webview/hooks/handlers/useSessionHandlers.ts`
- `src/webview/hooks/handlers/useSettingsHandlers.ts`
- `src/webview/hooks/handlers/useTokenHandlers.ts`
- `src/webview/hooks/handlers/useFileHandlers.ts`
- `src/webview/hooks/handlers/useMcpHandlers.ts`
- `src/webview/hooks/handlers/index.ts`
- `src/webview/hooks/useAdaptiveLayout.ts`
- `src/webview/hooks/useVirtualization.ts`
- `src/webview/hooks/useChatActions.ts`
- `src/webview/stores/branchStore.ts`

### Modified Files (6)
- `package.json` (add react-virtuoso)
- `src/webview/hooks/useVSCodeMessaging.ts`
- `src/webview/stores/chatStore.ts`
- `src/webview/stores/settingsStore.ts`
- `src/webview/App.tsx`
- `src/webview/containers/MessageList.tsx`

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| useVSCodeMessaging.ts | 891 lines | <150 lines |
| App.tsx | 510 lines | <250 lines |
| Handler files | 0 | 6 |
| Atomic selectors | 15 | 30+ |
| Virtualization | None | react-virtuoso |
| Adaptive layout | None | useAdaptiveLayout |

---

## Verification

After each phase:
```bash
npm run compile
```

Test extension in VS Code to verify all message types work correctly.

---

## Phase 5: Port Features from Main

After refactoring, port these features that were added to main:

### 5.1 ThinkingIntensityModal
- New component: `src/webview/components/organisms/thinking-intensity-modal.tsx`
- Add to `useModalHandlers.ts`:
  - `handleOpenThinkingModal`
  - `handleConfirmThinkingIntensity`
- Add to `settingsStore.ts`:
  - `thinkingIntensity` state
  - `setThinkingIntensity` action
- Update `App.tsx` to render modal and wire up handlers

### 5.2 toolUseId Tracking
- Add `toolUseId` field to toolUse/toolResult handlers in `useChatHandlers.ts`
- Enables matching tool results to their corresponding tool calls

### 5.3 Chat Name Improvements
- `chatNameUpdated` handler in `useSessionHandlers.ts`
- Update conversation name logic: prefer `chatName || firstUserMessage`

---

## Phase 6: Backend Integration (from backend-services session)

These tasks were completed in a prior session but require extension.ts integration:

### 6.1 Wire ProcessManager into extension.ts
**Source:** extension.ts lines 457-620
**Target:** Use existing `ProcessManager` class from `src/services/ProcessManager.ts`

Changes needed:
- Replace inline `_spawnPanelProcess` with `ProcessManager.spawn()`
- Replace inline `_setupPanelProcessHandlers` with ProcessManager callbacks
- Import types from `src/types/process.ts`
- Preserve `--resume` logic and `_hasConfigChanged` logic

**Prerequisites completed:**
- ✅ `src/types/process.ts` - ProcessConfig, callbacks interfaces
- ✅ `src/services/ProcessManager.ts` - Updated with mutex, WSL paths, type imports
- ✅ `async-mutex` installed

### 6.2 Extract MCP Code to McpService
**Source:** extension.ts lines 1779-2671
**Target:** Move to `src/services/McpService.ts` (shell already created)

Functions to move:
- `_initializeMCPConfig()` → `McpService.initialize()`
- `_loadMCPServers()` → `McpService.loadServers()`
- `_saveMCPServer()` → `McpService.saveServer()`
- `_deleteMCPServer()` → `McpService.deleteServer()`

**Prerequisites completed:**
- ✅ `src/services/McpService.ts` - Shell with interfaces and atomic write pattern

---

## Status: RESET

Previous worktree (`feature/wt3-frontend-logic`) abandoned due to conflicts with main.
Starting fresh from current main branch.
