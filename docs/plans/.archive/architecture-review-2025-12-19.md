# Architecture Code Review: Claude Code Chat Extension

**Date:** 2025-12-19
**Reviewed By:** Gemini 3 Pro Preview, Grok 4.1 Fast
**Consensus Confidence:** 9/10 (High)

---

## Executive Summary

The codebase requires immediate architectural refactoring to dismantle the "God Class" in `extension.ts` (~3000+ lines), eliminate logic duplication regarding process management, and segment the massive message handling switch statements on both ends. Without refactoring, maintainability will degrade rapidly as features are added.

---

## Current State Analysis

### Files Reviewed

| File | Size | Issues |
|------|------|--------|
| `extension.ts` | ~3000 lines | God Class - handles UI, processes, storage, backups, permissions, MCP, sessions |
| `useVSCodeMessaging.ts` | ~900 lines | Giant switch statement with 50+ cases |
| `App.tsx` | ~510 lines | Many inline handlers that could be extracted |
| `ProcessManager.ts` | ~298 lines | Good pattern - but unused by main provider |
| `chatStore.ts` | ~250 lines | Well-structured, no changes needed |
| `settingsStore.ts` | ~258 lines | Well-structured, no changes needed |

### Anti-Patterns Identified

1. **God Class**: `ClaudeChatProvider` acts as Controller, Service, and Repository simultaneously
2. **Redundant Code**: `extension.ts` re-implements process spawning (Lines 368-430) while `ProcessManager.ts` exists
3. **Switch Statement Smell**: Both backend and frontend use massive switch statements violating Open/Closed principle
4. **State Leakage**: Multi-panel state (`_panels` map) mixed with global extension state (`_conversationIndex`)
5. **Legacy Duplication**: `_panel` (Line 155) duplicates `_panels` Map (Line 205)

---

## Recommended Service Extractions

### From `extension.ts`

#### 1. ProcessService.ts
**Lines:** 368-520
**Responsibility:** Process spawning, killing, WSL support, stream parsing

```typescript
// Adapt existing ProcessManager.ts
export class ProcessService {
  private processManager: ProcessManager;
  private streamParser: StreamParser;

  spawn(config: ProcessConfig): void;
  kill(): Promise<void>;
  write(data: string): boolean;
  onMessage(handler: (msg: JsonMessage) => void): void;
}
```

#### 2. PermissionsService.ts
**Lines:** 2090-2276
**Responsibility:** Permission requests, always-allow logic, pattern matching

```typescript
export class PermissionsService {
  constructor(private storagePath: string);

  isToolPreApproved(toolName: string, input: Record<string, unknown>): Promise<boolean>;
  handleControlRequest(request: ControlRequest): Promise<void>;
  sendPermissionResponse(requestId: string, approved: boolean, alwaysAllow?: boolean): void;
  saveLocalPermission(toolName: string, input: Record<string, unknown>): Promise<void>;
  getCommandPattern(command: string): string;
}
```

#### 3. ConversationService.ts
**Lines:** 2778-3395
**Responsibility:** Conversation persistence, CLI history scanning, loading/saving

```typescript
export class ConversationService {
  constructor(
    private conversationsPath: string,
    private cliProjectsPath: string
  );

  saveCurrentConversation(conversation: ConversationData): Promise<void>;
  loadConversation(filename: string, source?: 'internal' | 'cli'): Promise<void>;
  scanCLIConversations(): Promise<ConversationListItem[]>;
  updateConversationIndex(filename: string, data: ConversationData): void;
  rebuildConversationIndex(): Promise<void>;
}
```

#### 4. BackupService.ts
**Lines:** 1602-1742
**Responsibility:** Git backup/restore operations

```typescript
export class BackupService {
  constructor(private backupRepoPath: string);

  initialize(workspacePath: string): Promise<void>;
  createBackupCommit(userMessage: string): Promise<CommitInfo>;
  restoreToCommit(commitSha: string): Promise<void>;
  getCommits(): CommitInfo[];
}
```

#### 5. McpService.ts
**Lines:** 1779-1827, 2557-2672
**Responsibility:** MCP server configuration and management

```typescript
export class McpService {
  constructor(private configPath: string);

  initialize(): Promise<void>;
  loadServers(): Promise<Record<string, McpServerConfig>>;
  saveServer(name: string, config: McpServerConfig): Promise<void>;
  deleteServer(name: string): Promise<void>;
  getConfigPath(): string;
}
```

#### 6. PanelManager.ts
**Lines:** 87-208
**Responsibility:** Multi-panel state management

```typescript
export class PanelManager {
  private panels: Map<string, PanelState> = new Map();
  private panelProcesses: Map<string, PanelProcessInfo> = new Map();
  private activePanelId: string | undefined;

  createPanel(panel: vscode.WebviewPanel): string;
  disposePanel(panelId: string): void;
  getActivePanel(): PanelState | undefined;
  postMessage(panelId: string, message: unknown): void;
}
```

#### 7. MessageRouter.ts
**Lines:** 691-802
**Responsibility:** Replace switch statement with handler registry

```typescript
type MessageHandler = (message: WebviewMessage, panelId?: string) => void | Promise<void>;

export class MessageRouter {
  private handlers: Map<string, MessageHandler> = new Map();

  register(type: string, handler: MessageHandler): void;
  route(message: WebviewMessage, panelId?: string): Promise<void>;
}

// Usage in extension.ts
private registerHandlers() {
  this.messageRouter.register('sendMessage', (msg) => this.handleSendMessage(msg));
  this.messageRouter.register('restoreCommit', (msg) => this.backupService.restore(msg.commitSha));
  this.messageRouter.register('loadConversation', (msg) => this.conversationService.load(msg.filename));
  // ... etc
}
```

---

## Frontend Refactoring

### useVSCodeMessaging.ts Split

**Current:** 900 lines, 50+ switch cases
**Target:** ~100 lines main file + domain handlers

```
src/webview/hooks/
├── useVSCodeMessaging.ts        # Main orchestrator (~100 lines)
└── handlers/
    ├── useChatHandlers.ts       # userInput, output, thinking, error, toolUse, toolResult
    ├── useSessionHandlers.ts    # ready, sessionInfo, sessionCleared, newSession
    ├── useSettingsHandlers.ts   # settings, platformInfo, permissions, accountInfo
    ├── useTokenHandlers.ts      # updateTokens, updateTotals
    ├── useFileHandlers.ts       # workspaceFiles, checkpoints, imagePath
    ├── useMcpHandlers.ts        # mcpServers, mcpServerSaved, mcpServerDeleted
    └── useModalHandlers.ts      # showInstallModal, installComplete
```

**Example Handler:**

```typescript
// src/webview/hooks/handlers/useChatHandlers.ts
export function useChatHandlers() {
  const { addMessage, updateLastMessage } = useChatStore();

  return {
    userInput: (data: string) => {
      addMessage({ type: 'user', content: data, timestamp: Date.now() });
    },
    output: (data: string) => {
      addMessage({ type: 'claude', content: data, timestamp: Date.now() });
    },
    toolUse: (data: ToolUseData) => {
      addMessage({
        type: 'tool-use',
        content: data.toolInfo,
        toolName: data.toolName,
        toolInput: data.rawInput,
        timestamp: Date.now(),
      });
    },
    // ... more handlers
  };
}
```

**Main Dispatcher:**

```typescript
// src/webview/hooks/useVSCodeMessaging.ts
export function useVSCodeMessaging() {
  const chatHandlers = useChatHandlers();
  const sessionHandlers = useSessionHandlers();
  const settingsHandlers = useSettingsHandlers();
  // ... more handlers

  const handlerMap = useMemo(() => new Map([
    ['userInput', chatHandlers.userInput],
    ['output', chatHandlers.output],
    ['ready', sessionHandlers.ready],
    ['sessionCleared', sessionHandlers.sessionCleared],
    // ... register all handlers
  ]), [chatHandlers, sessionHandlers, settingsHandlers]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      const handler = handlerMap.get(msg.type);
      if (handler) {
        handler(msg.data);
      } else {
        console.log('[VSCode Messaging] Unknown message type:', msg.type);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handlerMap]);
}
```

### App.tsx Handler Extraction

Extract handlers into custom hooks:

```typescript
// src/webview/hooks/useChatActions.ts
export function useChatActions() {
  const { sendMessage, stopProcess, newSession } = useVSCodeSender();
  const { setDraftMessage } = useChatStore();

  const handleSubmit = useCallback((inputValue: string, planMode: boolean, thinkingMode: boolean) => {
    if (!inputValue.trim()) return;
    sendMessage(inputValue, planMode, thinkingMode);
    setDraftMessage('');
  }, [sendMessage, setDraftMessage]);

  return { handleSubmit, handleStop: stopProcess, handleNewChat: newSession };
}

// src/webview/hooks/useModalHandlers.ts
export function useModalHandlers() {
  const { openModal, closeModal } = useUIStore();
  // ... modal-specific logic
}
```

---

## Target Architecture

```
src/
├── extension.ts                    # ~300 lines (orchestrator only)
├── activate.ts                     # Extension activation (optional split)
│
├── services/
│   ├── index.ts                    # Re-exports
│   ├── ProcessService.ts           # Extends ProcessManager
│   ├── PermissionsService.ts
│   ├── ConversationService.ts
│   ├── BackupService.ts
│   ├── McpService.ts
│   └── PanelManager.ts
│
├── controllers/
│   └── MessageRouter.ts            # Command pattern for messages
│
├── providers/
│   ├── ClaudeChatProvider.ts       # Main webview provider
│   └── ClaudeChatWebviewProvider.ts # Sidebar provider
│
├── types/
│   ├── index.ts
│   ├── session.ts                  # ConversationData, PanelState
│   ├── process.ts                  # ProcessConfig, ProcessCallbacks
│   └── messages.ts                 # WebviewMessage types
│
└── webview/
    ├── App.tsx                     # ~200 lines with extracted hooks
    ├── stores/
    │   ├── chatStore.ts            # No changes
    │   ├── settingsStore.ts        # No changes
    │   └── uiStore.ts              # No changes
    └── hooks/
        ├── useVSCodeMessaging.ts   # ~100 lines
        ├── useVSCodeSender.ts      # Extracted from messaging
        ├── useChatActions.ts
        ├── useModalHandlers.ts
        └── handlers/
            ├── useChatHandlers.ts
            ├── useSessionHandlers.ts
            ├── useSettingsHandlers.ts
            ├── useTokenHandlers.ts
            ├── useFileHandlers.ts
            └── useMcpHandlers.ts
```

---

## Implementation Plan

### Phase 1: Foundation (2-3 days)
1. Move all interfaces to `src/types/`
2. Create `src/services/index.ts` for re-exports
3. Add ESLint rule: `max-lines: 400`

### Phase 2: Stateless Services (3-4 days)
1. Extract `BackupService.ts` (easiest, no dependencies)
2. Extract `McpService.ts`
3. Wire up existing `ProcessManager.ts` to replace duplicate spawn logic

### Phase 3: Message Router (3-5 days)
1. Create `MessageRouter.ts` with handler registry
2. Migrate switch cases one by one
3. Test each handler in isolation

### Phase 4: Stateful Services (4-5 days)
1. Extract `PermissionsService.ts`
2. Extract `ConversationService.ts`
3. Create `PanelManager.ts`

### Phase 5: Frontend (3-5 days)
1. Split `useVSCodeMessaging.ts` into domain handlers
2. Extract `App.tsx` handlers to custom hooks
3. Update imports and test

### Phase 6: Cleanup (2-3 days)
1. Remove legacy `_panel` references
2. Delete unused code
3. Add integration tests for multi-panel sync
4. Documentation updates

**Total Estimated Effort:** 2-4 weeks

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Multi-panel sync breaking | Medium | High | Add integration tests before refactoring Lines 539-598 |
| Circular dependencies | Low | Medium | Move types first, use dependency injection |
| Incomplete extraction | Medium | Medium | Enforce ESLint max-lines=400, code review gates |
| Regression in permissions | Medium | High | Unit test PermissionsService before extraction |

---

## Success Metrics

- [ ] `extension.ts` reduced to <400 lines
- [ ] `useVSCodeMessaging.ts` reduced to <150 lines
- [ ] No file exceeds 400 lines
- [ ] Test coverage >80% on extracted services
- [ ] All existing functionality preserved
- [ ] Multi-panel support verified

---

## References

- **Industry Examples:** GitLens, PowerShell Extension, GitHub Copilot Chat
- **Patterns Used:** Service Extraction, Command Pattern, Dependency Injection
- **VS Code Best Practices:** [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
