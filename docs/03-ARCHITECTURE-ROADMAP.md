# Architecture Refactoring Roadmap

**Project:** Claude Code Chat VS Code Extension
**Date:** 2025-12-19
**Source:** Multi-model analysis (Gemini 3 Pro, Gemini 3 Flash, Grok 4.1 Fast)
**Consensus Confidence:** 9/10

---

## Executive Summary

The codebase requires architectural refactoring to dismantle the "God Class" in `extension.ts` (~3000 lines), eliminate logic duplication, and segment massive message handling switch statements. This document provides the implementation plan.

---

## Current vs Target State

### Current Architecture

```
src/
├── extension.ts              # 3000+ lines - MONOLITH
│   ├── ClaudeChatProvider    # Handles EVERYTHING
│   ├── DiffContentProvider   # Small, but mixed in
│   └── activate()            # Wires up monolith
├── services/
│   └── ProcessManager.ts     # EXISTS but UNUSED
└── webview/
    └── hooks/
        └── useVSCodeMessaging.ts  # 900 lines - MONOLITH
```

### Target Architecture

```
src/
├── extension.ts                    # ~300 lines (orchestrator only)
├── activate.ts                     # Extension activation
│
├── services/
│   ├── index.ts                    # Re-exports
│   ├── ProcessService.ts           # Extends ProcessManager
│   ├── PermissionsService.ts       # Permission logic
│   ├── ConversationService.ts      # Conversation I/O
│   ├── BackupService.ts            # Git backup/restore
│   ├── McpService.ts               # MCP configuration
│   └── PanelManager.ts             # Multi-panel state
│
├── controllers/
│   └── MessageRouter.ts            # Command pattern
│
├── providers/
│   ├── ClaudeChatProvider.ts       # Webview provider (lean)
│   └── DiffContentProvider.ts      # Extracted diff provider
│
├── types/
│   ├── index.ts
│   ├── session.ts                  # ConversationData, PanelState
│   ├── process.ts                  # ProcessConfig, callbacks
│   └── messages.ts                 # Webview message types
│
└── webview/
    ├── App.tsx                     # ~200 lines
    └── hooks/
        ├── useVSCodeMessaging.ts   # ~100 lines (dispatcher)
        ├── useVSCodeSender.ts      # Message senders
        └── handlers/
            ├── useChatHandlers.ts
            ├── useSessionHandlers.ts
            ├── useSettingsHandlers.ts
            ├── useTokenHandlers.ts
            ├── useFileHandlers.ts
            └── useMcpHandlers.ts
```

---

## Service Extraction Specifications

### 1. ProcessService.ts

**Source Lines:** `extension.ts` 368-520
**Responsibility:** Process spawning, killing, WSL, stream parsing

```typescript
import { ProcessManager, ProcessConfig, ProcessManagerCallbacks } from './ProcessManager';

export interface ProcessServiceCallbacks {
  onMessage: (msg: JsonMessage) => void;
  onError: (error: Error) => void;
  onClose: (code: number | null) => void;
}

export class ProcessService {
  private processManager: ProcessManager;
  private streamParser: StreamParser;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(private callbacks: ProcessServiceCallbacks) {
    this.processManager = new ProcessManager({
      onStdout: (data) => this.handleStdout(data),
      onStderr: (data) => this.handleStderr(data),
      onClose: (code, errorOutput) => this.callbacks.onClose(code),
      onError: (error) => this.callbacks.onError(error),
    });
    this.streamParser = new StreamParser();
  }

  spawn(config: ProcessConfig): void {
    this.processManager.spawn(config);
    this.startHeartbeat();
  }

  async kill(): Promise<void> {
    this.stopHeartbeat();
    await this.processManager.kill();
  }

  write(data: string): boolean {
    return this.processManager.write(data);
  }

  private handleStdout(data: string): void {
    const messages = this.streamParser.parse(data);
    for (const msg of messages) {
      this.callbacks.onMessage(msg);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this.processManager.isRunning()) {
        this.stopHeartbeat();
      }
      // Heartbeat logic...
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}
```

---

### 2. PermissionsService.ts

**Source Lines:** `extension.ts` 2090-2276
**Responsibility:** Permission checks, always-allow logic, pattern matching

```typescript
import * as vscode from 'vscode';
import minimatch from 'minimatch';

interface PermissionDecision {
  approved: boolean;
  reason?: string;
}

export class PermissionsService {
  private readonly BLOCKED_PATTERNS = [
    'rm -rf /',
    'rm -rf ~',
    'sudo rm',
    'chmod 777',
    ':(){:|:&};:',
    'curl | bash',
  ];

  constructor(
    private storagePath: string,
    private context: vscode.ExtensionContext
  ) {}

  async isToolPreApproved(toolName: string, input: Record<string, unknown>): Promise<boolean> {
    // Check blocklist first
    if (toolName === 'Bash' && input.command) {
      const command = (input.command as string).trim();
      for (const blocked of this.BLOCKED_PATTERNS) {
        if (command.includes(blocked)) {
          console.warn(`Blocked dangerous command: ${command}`);
          return false;
        }
      }
    }

    // Load permissions
    const permissions = await this.loadPermissions();
    const toolPermission = permissions.alwaysAllow[toolName];

    if (toolPermission === true) return true;
    if (Array.isArray(toolPermission) && toolName === 'Bash') {
      const command = (input.command as string).trim();
      return toolPermission.some(pattern => this.matchesPattern(command, pattern));
    }

    return false;
  }

  private matchesPattern(command: string, pattern: string): boolean {
    if (pattern === command) return true;
    if (pattern.endsWith(' *') && command.startsWith(pattern.slice(0, -1))) return true;
    try { if (minimatch(command, pattern)) return true; } catch {}
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      try { if (new RegExp(pattern.slice(1, -1)).test(command)) return true; } catch {}
    }
    return false;
  }

  async addPermission(toolName: string, command: string | null): Promise<void> {
    // Implementation...
  }

  async removePermission(toolName: string, command: string | null): Promise<void> {
    // Implementation...
  }

  async logAudit(entry: AuditEntry): Promise<void> {
    const auditPath = path.join(this.storagePath, 'permissions', 'audit.jsonl');
    await fs.appendFile(auditPath, JSON.stringify(entry) + '\n');
  }

  private async loadPermissions(): Promise<PermissionsData> {
    // Implementation...
  }
}
```

---

### 3. ConversationService.ts

**Source Lines:** `extension.ts` 2778-3395
**Responsibility:** Conversation persistence, CLI history scanning

```typescript
import * as vscode from 'vscode';
import { z } from 'zod';

const UserMessageSchema = z.object({
  type: z.literal('user'),
  message: z.object({
    content: z.array(z.object({ type: z.literal('text'), text: z.string() }))
  }).optional()
});

export class ConversationService {
  private conversationIndex: ConversationIndexEntry[] = [];

  constructor(
    private conversationsPath: string,
    private cliProjectsPath: string
  ) {}

  async saveConversation(data: ConversationData): Promise<string> {
    const filename = this.generateFilename(data);
    const filePath = path.join(this.conversationsPath, filename);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(filePath),
      new TextEncoder().encode(JSON.stringify(data, null, 2))
    );
    this.updateIndex(filename, data);
    return filename;
  }

  async loadConversation(filename: string): Promise<ConversationData> {
    const filePath = path.join(this.conversationsPath, filename);
    const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    return JSON.parse(new TextDecoder().decode(content));
  }

  async loadCLIConversation(filePath: string): Promise<ConversationMessage[]> {
    // Stream-based loading for large files
    return new Promise((resolve, reject) => {
      const messages: ConversationMessage[] = [];
      const rl = createInterface({
        input: createReadStream(filePath),
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        if (!line.trim()) return;
        try {
          const parsed = this.parseJSONLEntry(line);
          if (parsed) messages.push(parsed);
        } catch {}
      });

      rl.on('close', () => resolve(messages));
      rl.on('error', reject);
    });
  }

  private parseJSONLEntry(line: string): ConversationMessage | null {
    const json = JSON.parse(line);
    const userResult = UserMessageSchema.safeParse(json);
    if (userResult.success) return { type: 'user', data: userResult.data };
    // ... other schemas
    return null;
  }

  async scanCLIConversations(): Promise<ConversationListItem[]> {
    // Implementation...
  }

  getConversationList(): ConversationIndexEntry[] {
    return this.conversationIndex;
  }
}
```

---

### 4. BackupService.ts

**Source Lines:** `extension.ts` 1602-1742
**Responsibility:** Git backup/restore operations

```typescript
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

export interface CommitInfo {
  sha: string;
  message: string;
  timestamp: string;
  filesModified: string[];
}

export class BackupService {
  private commits: CommitInfo[] = [];

  constructor(
    private backupRepoPath: string,
    private workspacePath: string
  ) {}

  async initialize(): Promise<void> {
    // Ensure backup repo exists
    try {
      await exec('git rev-parse --git-dir', { cwd: this.backupRepoPath });
    } catch {
      await exec('git init', { cwd: this.backupRepoPath });
    }
  }

  async createCheckpoint(description: string): Promise<CommitInfo> {
    await exec('git add -A', { cwd: this.workspacePath });

    const { stdout: status } = await exec('git status --porcelain', { cwd: this.workspacePath });
    if (!status.trim()) {
      throw new Error('No changes to checkpoint');
    }

    await exec(`git commit -m "${description}"`, { cwd: this.workspacePath });
    const { stdout: sha } = await exec('git rev-parse HEAD', { cwd: this.workspacePath });

    const commit: CommitInfo = {
      sha: sha.trim(),
      message: description,
      timestamp: new Date().toISOString(),
      filesModified: status.split('\n').map(line => line.slice(3))
    };

    this.commits.push(commit);
    return commit;
  }

  async restoreToCommit(sha: string): Promise<void> {
    await exec(`git checkout ${sha} -- .`, { cwd: this.workspacePath });
  }

  getCommits(): CommitInfo[] {
    return this.commits;
  }
}
```

---

### 5. McpService.ts

**Source Lines:** `extension.ts` 1779-1827, 2557-2672
**Responsibility:** MCP server configuration

```typescript
import * as vscode from 'vscode';

export interface McpServerConfig {
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export class McpService {
  constructor(private configPath: string) {}

  async loadServers(): Promise<Record<string, McpServerConfig>> {
    try {
      const content = await vscode.workspace.fs.readFile(vscode.Uri.file(this.configPath));
      const config = JSON.parse(new TextDecoder().decode(content));
      // Filter out internal servers
      return Object.fromEntries(
        Object.entries(config.mcpServers || {}).filter(([name]) => name !== 'internal')
      );
    } catch {
      return {};
    }
  }

  async saveServer(name: string, config: McpServerConfig): Promise<void> {
    const servers = await this.loadServers();
    servers[name] = config;
    await this.writeConfig({ mcpServers: servers });
  }

  async deleteServer(name: string): Promise<void> {
    const servers = await this.loadServers();
    delete servers[name];
    await this.writeConfig({ mcpServers: servers });
  }

  private async writeConfig(config: object): Promise<void> {
    const content = new TextEncoder().encode(JSON.stringify(config, null, 2));
    await vscode.workspace.fs.writeFile(vscode.Uri.file(this.configPath), content);
  }
}
```

---

### 6. PanelManager.ts

**Source Lines:** `extension.ts` 87-208
**Responsibility:** Multi-panel state management

```typescript
import * as vscode from 'vscode';

export interface PanelState {
  panel: vscode.WebviewPanel;
  conversationId?: string;
  processId?: string;
  isProcessing: boolean;
}

export class PanelManager {
  private panels: Map<string, PanelState> = new Map();
  private activePanelId: string | undefined;

  createPanel(panel: vscode.WebviewPanel): string {
    const panelId = crypto.randomUUID();
    this.panels.set(panelId, {
      panel,
      isProcessing: false,
    });
    this.activePanelId = panelId;
    return panelId;
  }

  disposePanel(panelId: string): void {
    const state = this.panels.get(panelId);
    if (state) {
      state.panel.dispose();
      this.panels.delete(panelId);
    }
    if (this.activePanelId === panelId) {
      this.activePanelId = this.panels.keys().next().value;
    }
  }

  getPanel(panelId: string): PanelState | undefined {
    return this.panels.get(panelId);
  }

  getActivePanel(): PanelState | undefined {
    if (!this.activePanelId) return undefined;
    return this.panels.get(this.activePanelId);
  }

  setActivePanel(panelId: string): void {
    if (this.panels.has(panelId)) {
      this.activePanelId = panelId;
    }
  }

  postMessage(panelId: string, message: unknown): void {
    const state = this.panels.get(panelId);
    if (state) {
      state.panel.webview.postMessage(message);
    }
  }

  postMessageToAll(message: unknown): void {
    for (const [, state] of this.panels) {
      state.panel.webview.postMessage(message);
    }
  }
}
```

---

### 7. MessageRouter.ts

**Source Lines:** `extension.ts` 691-802
**Responsibility:** Replace switch with handler registry

```typescript
type MessageHandler = (message: any, panelId?: string) => void | Promise<void>;

export class MessageRouter {
  private handlers: Map<string, MessageHandler> = new Map();

  register(type: string, handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  registerBulk(handlers: Record<string, MessageHandler>): void {
    for (const [type, handler] of Object.entries(handlers)) {
      this.register(type, handler);
    }
  }

  async route(message: { type: string; [key: string]: any }, panelId?: string): Promise<void> {
    const handler = this.handlers.get(message.type);

    if (handler) {
      try {
        await handler(message, panelId);
      } catch (error) {
        console.error(`Handler error for ${message.type}:`, error);
        throw error;
      }
    } else {
      console.warn(`No handler registered for message type: ${message.type}`);
    }
  }

  hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }
}
```

**Usage in refactored ClaudeChatProvider:**

```typescript
export class ClaudeChatProvider {
  private messageRouter: MessageRouter;
  private processService: ProcessService;
  private conversationService: ConversationService;
  private permissionsService: PermissionsService;
  // ... other services

  constructor(context: vscode.ExtensionContext) {
    // Initialize services
    this.processService = new ProcessService({ /* callbacks */ });
    this.conversationService = new ConversationService(/* paths */);
    this.permissionsService = new PermissionsService(/* paths */);

    // Initialize router
    this.messageRouter = new MessageRouter();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.messageRouter.registerBulk({
      'sendMessage': (msg, panelId) => this.handleSendMessage(msg, panelId),
      'newSession': (msg, panelId) => this.handleNewSession(panelId),
      'loadConversation': (msg) => this.conversationService.loadConversation(msg.filename),
      'restoreCommit': (msg) => this.backupService.restoreToCommit(msg.commitSha),
      'loadMCPServers': () => this.mcpService.loadServers(),
      'permissionResponse': (msg) => this.permissionsService.handleResponse(msg),
      // ... all other handlers
    });
  }

  // Panel message handler is now clean
  private _handleWebviewMessage(message: any, panelId?: string): void {
    this.messageRouter.route(message, panelId);
  }
}
```

---

## Frontend Hook Splitting

### Current State
- `useVSCodeMessaging.ts`: 900 lines with 50+ switch cases

### Target State

```
hooks/
├── useVSCodeMessaging.ts       # ~100 lines - dispatcher
├── useVSCodeSender.ts          # Message senders (already separate)
└── handlers/
    ├── useChatHandlers.ts      # userInput, output, toolUse, toolResult
    ├── useSessionHandlers.ts   # ready, sessionInfo, sessionCleared
    ├── useSettingsHandlers.ts  # settings, platformInfo, permissions
    ├── useTokenHandlers.ts     # updateTokens, updateTotals
    ├── useFileHandlers.ts      # workspaceFiles, checkpoints
    └── useMcpHandlers.ts       # mcpServers, mcpServerSaved
```

### Example Handler

```typescript
// hooks/handlers/useChatHandlers.ts
export function useChatHandlers() {
  const { addMessage, updateLastMessage, setProcessing } = useChatStore();

  return useMemo(() => ({
    userInput: (data: string | { content: string }) => {
      const content = typeof data === 'string' ? data : data.content;
      addMessage({ type: 'user', content, timestamp: Date.now() });
    },

    output: (data: string | { content: string }) => {
      const content = typeof data === 'string' ? data : data.content;
      addMessage({ type: 'claude', content, timestamp: Date.now() });
    },

    streamingMessage: (data: { content: string }) => {
      updateLastMessage(data.content);
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

    toolResult: (data: ToolResultData) => {
      addMessage({
        type: 'tool-result',
        content: data.result,
        toolName: data.toolName,
        isError: data.isError,
        timestamp: Date.now(),
      });
    },

    setProcessing: (data: { isProcessing: boolean }) => {
      setProcessing(data.isProcessing);
    },
  }), [addMessage, updateLastMessage, setProcessing]);
}
```

### Main Dispatcher

```typescript
// hooks/useVSCodeMessaging.ts
export function useVSCodeMessaging() {
  const chatHandlers = useChatHandlers();
  const sessionHandlers = useSessionHandlers();
  const settingsHandlers = useSettingsHandlers();
  const tokenHandlers = useTokenHandlers();
  const fileHandlers = useFileHandlers();
  const mcpHandlers = useMcpHandlers();

  const handlerMap = useMemo(() => new Map<string, (data: any) => void>([
    // Chat
    ['userInput', chatHandlers.userInput],
    ['output', chatHandlers.output],
    ['streamingMessage', chatHandlers.streamingMessage],
    ['toolUse', chatHandlers.toolUse],
    ['toolResult', chatHandlers.toolResult],
    ['setProcessing', chatHandlers.setProcessing],

    // Session
    ['ready', sessionHandlers.ready],
    ['sessionInfo', sessionHandlers.sessionInfo],
    ['sessionCleared', sessionHandlers.sessionCleared],
    ['newSession', sessionHandlers.newSession],

    // Settings
    ['settings', settingsHandlers.settings],
    ['platformInfo', settingsHandlers.platformInfo],
    ['permissionsData', settingsHandlers.permissions],

    // Tokens
    ['updateTokens', tokenHandlers.updateTokens],
    ['updateTotals', tokenHandlers.updateTotals],

    // Files
    ['workspaceFiles', fileHandlers.workspaceFiles],
    ['checkpoints', fileHandlers.checkpoints],

    // MCP
    ['mcpServers', mcpHandlers.mcpServers],
    ['mcpServerSaved', mcpHandlers.mcpServerSaved],
    ['mcpServerDeleted', mcpHandlers.mcpServerDeleted],
  ]), [chatHandlers, sessionHandlers, settingsHandlers, tokenHandlers, fileHandlers, mcpHandlers]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data;
      const handler = handlerMap.get(type);

      if (handler) {
        handler(data);
      } else {
        console.log('[VSCode Messaging] Unknown message type:', type);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handlerMap]);
}
```

---

## Implementation Phases

### Phase 1: Foundation (2-3 days)

1. **Move interfaces to `src/types/`**
   - Create `session.ts`, `process.ts`, `messages.ts`
   - Update imports across codebase

2. **Create `src/services/index.ts`**
   - Re-export pattern for clean imports

3. **Add ESLint rules**
   - `max-lines: 400` per file
   - `max-lines-per-function: 50`

---

### Phase 2: Stateless Services (3-4 days)

1. **Extract `BackupService.ts`**
   - Easiest, no dependencies on other services
   - Lines 1602-1742

2. **Extract `McpService.ts`**
   - Self-contained config management
   - Lines 1779-1827, 2557-2672

3. **Wire up `ProcessManager.ts`**
   - Replace duplicate spawn logic (Lines 368-430)
   - Add heartbeat monitoring

---

### Phase 3: Message Router (3-5 days)

1. **Create `MessageRouter.ts`**
   - Handler registry pattern
   - Error handling wrapper

2. **Migrate switch cases incrementally**
   - Start with simple handlers
   - Test each handler in isolation

3. **Remove original switch**
   - Replace with router call
   - Verify all message types work

---

### Phase 4: Stateful Services (4-5 days)

1. **Extract `PermissionsService.ts`**
   - Add Zod schemas
   - Add audit logging
   - Add blocklist

2. **Extract `ConversationService.ts`**
   - Add streaming for large files
   - Add Zod validation

3. **Create `PanelManager.ts`**
   - Consolidate panel state
   - Remove legacy `_panel` property

---

### Phase 5: Frontend (3-5 days)

1. **Split `useVSCodeMessaging.ts`**
   - Create handler files
   - Create dispatcher

2. **Extract `App.tsx` handlers**
   - `useChatActions.ts`
   - `useModalHandlers.ts`

3. **Update imports and test**

---

### Phase 6: Cleanup (2-3 days)

1. **Remove legacy code**
   - Delete `_panel` references
   - Remove unused private methods

2. **Add integration tests**
   - Multi-panel sync tests
   - Message routing tests

3. **Documentation updates**
   - Update CLAUDE.md
   - Add architecture diagram

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Multi-panel sync breaks | Medium | High | Add integration tests before refactoring Lines 539-598 |
| Circular dependencies | Low | Medium | Move types first, use dependency injection |
| Incomplete extraction | Medium | Medium | Enforce ESLint max-lines=400, PR reviews |
| Regression in permissions | Medium | High | Unit test PermissionsService before extraction |
| Message handling breaks | Medium | High | Test each handler individually before removing switch |

---

## Success Metrics

- [ ] `extension.ts` reduced from ~3000 to <400 lines
- [ ] `useVSCodeMessaging.ts` reduced from ~900 to <150 lines
- [ ] No file exceeds 400 lines
- [ ] All services have >80% test coverage
- [ ] ESLint passes with max-lines rule
- [ ] All existing functionality preserved
- [ ] Multi-panel support verified
- [ ] No zombie processes in persistent mode

---

## Dependencies

```json
{
  "dependencies": {
    "zod": "^3.22.0",
    "minimatch": "^9.0.0"
  },
  "devDependencies": {
    "@types/minimatch": "^5.1.0"
  }
}
```

---

## Cross-References

- **Issues being fixed:** `01-TECHNICAL-DEBT-AND-BUGS.md`
- **Features enabled by refactoring:** `02-NEW-FEATURES-AND-IMPROVEMENTS.md`

---

*Generated from multi-model analysis on 2025-12-19*
