# Architecture Changes - Multi-Model Consensus

> **Models Consulted**: Gemini 3 Pro, Grok 4.1 Fast, DeepSeek v3.2
> **Consensus Level**: UNANIMOUS on critical architectural flaws
> **Generated**: 2025-12-21

---

## Executive Summary

All three models identify fundamental architectural issues that go beyond simple code organization. The codebase needs structural changes to design patterns, state management, and service communication.

---

## Critical Priority

### 1. Eliminate Split-Brain State

**The Problem**:
Two separate sources of truth for conversation state:
- `extension.ts` maintains `_currentConversation` (Line 183)
- `ConversationManager.ts` also maintains `_currentConversation` (Line 189)

Synchronization happens manually via methods like `loadInternalConversation`, creating risk where:
- UI displays data different from what's persisted to disk
- Logic layer operates on stale state
- Race conditions during rapid message updates

**The Solution**:

`extension.ts` should NOT hold state arrays. Delegate ALL conversation mutations to `ConversationManager`.

**Pattern - Event-Driven State Sync**:
```
ConversationManager
  - Owns _currentConversation (single source of truth)
  - Emits 'messageAdded' event when state changes
  - Emits 'conversationLoaded' event when loading complete

extension.ts (ClaudeChatProvider)
  - Subscribes to ConversationManager events
  - Forwards data to Webview on event
  - Never directly mutates conversation state

Pseudocode:
  conversationManager.on('messageAdded', (message) =>
    this._postMessage({ type: 'output', data: message })
  )
```

**Benefits**:
- Persistence Layer and Presentation Layer stay in sync
- No manual synchronization needed
- Easier to debug state issues
- Natural audit trail through events

---

### 2. Implement Dependency Injection

**The Problem**:
`ClaudeChatProvider` constructs all dependencies internally (Lines 247, 259):
```
this._processManager = new ProcessManager({ onStdout: ... })
this._conversationManager = new ConversationManager(context, { ... })
```

This creates:
- Tight coupling - cannot swap implementations
- Untestable code - cannot mock dependencies
- Hidden dependencies - not visible in constructor signature

**The Solution**:

Use constructor injection or factory pattern:

**Pseudocode - Constructor Injection**:
```
class ClaudeChatProvider
  constructor(
    context: ExtensionContext,
    processManager: IProcessManager,
    conversationManager: IConversationManager,
    permissionsManager: IPermissionsManager
  )
    this._processManager = processManager
    this._conversationManager = conversationManager
    this._permissionsManager = permissionsManager
```

**Pseudocode - Factory Pattern**:
```
class ServiceFactory
  static createServices(context: ExtensionContext): Services
    const processManager = new ProcessManager(...)
    const conversationManager = new ConversationManager(...)
    return { processManager, conversationManager, ... }

// In extension.ts activate()
const services = ServiceFactory.createServices(context)
const provider = new ClaudeChatProvider(context, services)
```

**Benefits**:
- Testable - mock ProcessManager in unit tests
- Swappable - easy to replace implementations
- Visible dependencies - constructor shows what's needed
- Lifecycle management - factory controls creation/disposal

---

### 3. Event-Driven Communication

**The Problem**:
Current architecture uses direct callbacks:
```
ProcessManager receives callbacks:
  onStdout: (data) => this._handleProcessStdout(data)
  onStderr: (data) => this._handleProcessStderr(data)
  onClose: (code, error) => this._handleProcessClose(code, error)
```

This creates:
- Tight coupling between producer and consumer
- Difficult to add new listeners
- Race conditions with streaming data
- Hard to trace data flow

**The Solution**:

Implement EventEmitter or pub/sub pattern:

**Pseudocode - EventEmitter Pattern**:
```
class StreamProcessor extends EventEmitter
  parse(chunk: string)
    const messages = this.extractMessages(chunk)
    for message in messages
      this.emit('jsonParsed', message)

    if hasIncompleteData
      this.emit('bufferUpdated', remainingData)

// Usage
streamProcessor.on('jsonParsed', (message) =>
  switch message.type
    case 'assistant': handleAssistantMessage(message)
    case 'tool_use': handleToolUse(message)
    case 'result': handleResult(message)
)
```

**Pseudocode - Message Bus Pattern**:
```
class MessageBus
  private subscribers: Map<string, Set<Handler>>

  publish(topic: string, data: unknown)
    for handler in subscribers.get(topic)
      handler(data)

  subscribe(topic: string, handler: Handler): Unsubscribe
    subscribers.get(topic).add(handler)
    return () => subscribers.get(topic).delete(handler)

// Usage
messageBus.subscribe('cli:output', handleCliOutput)
messageBus.subscribe('cli:output', logCliOutput)  // Multiple subscribers!
messageBus.publish('cli:output', { content: '...' })
```

**Benefits**:
- Decouples CLI parsing from UI updates
- Handles streaming races naturally
- Multiple listeners per event
- Clear data flow through event names

---

## High Priority

### 4. Centralized Configuration Service

**The Problem**:
`vscode.workspace.getConfiguration` called in scattered locations:
- `_buildProcessConfig` (Line 425)
- `_sendMessageToClaude` (Line 1066)
- `_openUsageTerminal` (Line 3758)
- Many more...

**The Solution**:

Create `src/services/ConfigurationService.ts`:

**Pseudocode**:
```
class ConfigurationService
  private cache: Map<string, unknown>
  private disposables: Disposable[]

  constructor()
    // Listen for config changes
    workspace.onDidChangeConfiguration((e) =>
      if e.affectsConfiguration('claudeCode')
        this.invalidateCache()
        this.emit('configChanged')
    )

  getThinkingIntensity(): number
    return this.getCached('thinking.intensity', 0)

  getWslEnabled(): boolean
    return this.getCached('wsl.enabled', false)

  getWslDistro(): string
    return this.getCached('wsl.distro', '')

  private getCached<T>(key: string, defaultValue: T): T
    if not cache.has(key)
      const config = workspace.getConfiguration('claudeCode')
      cache.set(key, config.get(key, defaultValue))
    return cache.get(key)
```

**Benefits**:
- Single source of truth for configuration
- Caching reduces API calls
- Type-safe getters prevent errors
- Change notifications to subscribers

---

### 5. Panel Registry Pattern

**The Problem**:
Multi-panel state tracked across multiple maps:
```
private _panels: Map<string, PanelState> = new Map()
private _panelProcesses: Map<string, PanelProcessInfo> = new Map()
```

This creates:
- State inconsistency between maps
- Manual synchronization required
- No single point of access
- Difficult to enumerate all panel state

**The Solution**:

Create unified `PanelRegistry`:

**Pseudocode**:
```
interface Panel
  id: string
  state: PanelState
  process: PanelProcessInfo | null
  webview: WebviewPanel | null

class PanelRegistry
  private panels: Map<string, Panel>

  createPanel(webview: WebviewPanel): Panel
    const id = generateId()
    const panel: Panel = {
      id,
      state: { conversation: [], sessionId: null, ... },
      process: null,
      webview
    }
    this.panels.set(id, panel)
    this.emit('panelCreated', panel)
    return panel

  getPanel(id: string): Panel | undefined
    return this.panels.get(id)

  getActivePanel(): Panel | undefined
    return Array.from(this.panels.values())
      .find(p => p.webview?.active)

  attachProcess(panelId: string, process: PanelProcessInfo)
    const panel = this.getPanel(panelId)
    if panel
      panel.process = process
      this.emit('processAttached', { panelId, process })

  disposePanel(id: string)
    const panel = this.panels.get(id)
    if panel
      panel.process?.kill()
      panel.webview?.dispose()
      this.panels.delete(id)
      this.emit('panelDisposed', id)
```

**Benefits**:
- Single source of truth for all panel state
- Atomic operations across related data
- Event-driven for observers
- Cleaner lifecycle management

---

### 6. Layer Enforcement (SOLID Compliance)

**The Problem**:
Mixed abstraction levels in `extension.ts`:
- UI concerns (webview creation)
- Business logic (permission checking)
- Infrastructure (file I/O, process spawning)

**The Solution**:

Enforce clear layer boundaries:

```
┌─────────────────────────────────────────────────────┐
│                   UI LAYER                          │
│  PanelManager, WebviewManager, MessageRouter        │
│  Responsibility: Presentation, user interaction     │
├─────────────────────────────────────────────────────┤
│                 DOMAIN LAYER                        │
│  PermissionsManager, ConversationManager,           │
│  SessionManager, StreamProcessor                    │
│  Responsibility: Business logic, rules              │
├─────────────────────────────────────────────────────┤
│               INFRASTRUCTURE LAYER                  │
│  ProcessManager, GitService, FileOperations,        │
│  ConfigurationService                               │
│  Responsibility: External systems, I/O              │
└─────────────────────────────────────────────────────┘

Rules:
- UI Layer can call Domain Layer
- Domain Layer can call Infrastructure Layer
- NO reverse dependencies (Infrastructure → Domain → UI)
- NO cross-layer skipping (UI directly to Infrastructure)
```

**Current Violations**:
- `extension.ts` Line 303-354: `_initializeMessageRouter` mixes UI routing with business logic
- `extension.ts` Line 948-979: `_handleProcessStdout` mixes parsing (infrastructure) with message handling (domain)

---

## Medium Priority

### 7. Strategy Pattern for Permissions

**The Problem**:
Permission logic is monolithic with complex conditionals:
```
_isToolPreApproved(toolName, input)
  if blocked patterns match → deny
  if pre-approved patterns match → allow
  if session-approved → allow
  else → prompt user
```

**The Solution**:

Implement Strategy pattern for extensible permission policies:

**Pseudocode**:
```
interface PermissionStrategy
  name: string
  evaluate(toolName: string, input: ToolInput): PermissionResult

class BlockedPatternStrategy implements PermissionStrategy
  evaluate(toolName, input)
    for pattern in BLOCKED_PATTERNS
      if matches(input.command, pattern)
        return { allowed: false, reason: 'Blocked pattern' }
    return { allowed: null }  // No opinion, continue chain

class PreApprovalStrategy implements PermissionStrategy
  evaluate(toolName, input)
    const permissions = this.loadPermissions()
    if permissions.hasApproval(toolName, input)
      return { allowed: true, reason: 'Pre-approved' }
    return { allowed: null }

class YoloModeStrategy implements PermissionStrategy
  evaluate(toolName, input)
    if this.isYoloModeEnabled()
      return { allowed: true, reason: 'YOLO mode' }
    return { allowed: null }

class PermissionChain
  private strategies: PermissionStrategy[]

  evaluate(toolName, input): PermissionResult
    for strategy in strategies
      const result = strategy.evaluate(toolName, input)
      if result.allowed !== null
        return result
    return { allowed: null, reason: 'Prompt user' }
```

**Benefits**:
- Easy to add new permission policies
- Each strategy is independently testable
- Clear precedence through chain order
- Auditable decision making

---

### 8. Redux-like State per Panel

**The Problem**:
Each panel's state is mutable and scattered, leading to:
- Shared mutable state bugs
- Difficult to track state changes
- No time-travel debugging

**The Solution**:

Implement reducer pattern per panel:

**Pseudocode**:
```
type PanelAction =
  | { type: 'MESSAGE_ADDED', payload: Message }
  | { type: 'SESSION_STARTED', payload: { sessionId: string } }
  | { type: 'PROCESSING_STARTED' }
  | { type: 'PROCESSING_STOPPED' }
  | { type: 'CONVERSATION_LOADED', payload: Conversation }

function panelReducer(state: PanelState, action: PanelAction): PanelState
  switch action.type
    case 'MESSAGE_ADDED':
      return { ...state, messages: [...state.messages, action.payload] }
    case 'SESSION_STARTED':
      return { ...state, sessionId: action.payload.sessionId, startTime: Date.now() }
    case 'PROCESSING_STARTED':
      return { ...state, isProcessing: true }
    // ...

class PanelStore
  private state: PanelState
  private listeners: Set<Listener>

  dispatch(action: PanelAction)
    this.state = panelReducer(this.state, action)
    for listener in listeners
      listener(this.state)

  getState(): PanelState
    return this.state
```

**Benefits**:
- Predictable state changes
- Easy to log/debug all actions
- Time-travel debugging possible
- State changes are explicit and traceable

---

## Low Priority

### 9. Facade Pattern for Complex Subsystems

**Observation**:
Git operations are split between `GitService` and `BackupService`. Create a unified facade:

**Pseudocode**:
```
class GitOperationsFacade
  constructor(
    private gitService: GitService,
    private backupService: BackupService
  )

  async createCheckpoint(message: string): Promise<CommitInfo>
    // Coordinates both services
    const commit = await this.gitService.createCommit(message)
    this.backupService.trackCommit(commit)
    return commit

  async restoreCheckpoint(sha: string): Promise<void>
    const commit = this.backupService.findCommit(sha)
    if not commit
      throw new Error('Checkpoint not found')
    await this.gitService.restore(sha)
    this.backupService.markRestored(sha)

  async listCheckpoints(): Promise<CommitInfo[]>
    return this.backupService.getTrackedCommits()
```

---

## Architecture Diagram (Target State)

```
┌────────────────────────────────────────────────────────────────────┐
│                         EXTENSION HOST                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐      ┌──────────────────┐                     │
│  │ ClaudeChatProvider│◄────│ ServiceFactory   │                     │
│  │ (Orchestrator)   │      └──────────────────┘                     │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                      MESSAGE BUS                            │    │
│  │  Events: cli:output, message:added, permission:request      │    │
│  └────────────────────────────────────────────────────────────┘    │
│           │                                                         │
│     ┌─────┴─────┬─────────────┬─────────────┐                      │
│     ▼           ▼             ▼             ▼                      │
│  ┌──────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐              │
│  │Panel │  │ Stream   │  │Conversa- │  │Permission │              │
│  │Regis-│  │Processor │  │tion      │  │ Chain     │              │
│  │try   │  │          │  │Manager   │  │           │              │
│  └──────┘  └──────────┘  └──────────┘  └───────────┘              │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                 INFRASTRUCTURE LAYER                        │    │
│  │  ProcessManager | GitService | ConfigService | FileOps      │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ IPC Messages
┌────────────────────────────────────────────────────────────────────┐
│                          WEBVIEW                                    │
│  ┌─────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐         │
│  │ App.tsx │──│ chatStore │──│ Handlers  │──│ VSCode    │         │
│  │         │  │ uiStore   │  │           │  │ Bridge    │         │
│  └─────────┘  └───────────┘  └───────────┘  └───────────┘         │
└────────────────────────────────────────────────────────────────────┘
```

---

## Migration Strategy

1. **Phase 1**: Add interfaces for existing services (non-breaking)
2. **Phase 2**: Implement dependency injection in activate()
3. **Phase 3**: Add EventEmitter to key services
4. **Phase 4**: Migrate callbacks to event subscriptions
5. **Phase 5**: Consolidate state to single sources of truth
6. **Phase 6**: Add layer enforcement through linting rules

---

## Session 3 Updates: Architecture Refinements

> **Source**: Individual model reviews (Gemini, Grok, DeepSeek)
> **Date**: 2025-12-21

### CONFLICT RESOLVED: Event-Driven vs Redux

**Original Conflict**:
- Section 3 proposes: Event-driven state sync (ConversationManager emits events)
- Section 8 proposes: Redux-like reducer pattern per panel

**Resolution**: **Use event-driven pattern ONLY**

**Rationale**:
- VS Code extensions already use event patterns (`EventEmitter`)
- Panel state is not complex enough to warrant Redux patterns
- Adding Redux introduces unnecessary abstraction and learning curve
- Event emission from `ConversationManager` to panel listeners is sufficient

**Recommendation**: Remove Redux-like state proposal from implementation plan.

---

### NEW: Disposable Pattern for Dependency Injection

**The Problem**:
The architecture document proposes dependency injection but misses **VS Code extension lifecycle**. VS Code extensions must dispose of resources properly.

**Current Pattern**:
```
// No cleanup
this._processManager = new ProcessManager()
```

**Required Pattern**:
```
interface IDisposableService extends Disposable {
  dispose(): void
}

class ClaudeChatProvider {
  constructor(
    private context: ExtensionContext,
    private processManager: IProcessManager,
    private conversationManager: IConversationManager
  ) {
    // Must register disposables
    context.subscriptions.push(
      processManager,
      conversationManager
    )
  }
}
```

**New Interface Required**:
```
// src/types/services.ts
interface IDisposableService extends vscode.Disposable {
  dispose(): void
}

// All services must implement
class ProcessManager implements IProcessManager, IDisposableService {
  dispose() {
    this.killAllProcesses()
    this.clearHeartbeat()
  }
}
```

---

### NEW: Prespawn Logic Preservation

**The Problem**:
`extension.ts` contains sophisticated "pre-spawn" optimization logic (Line 2948 `_prespawnClaudeProcess`) that makes the chat feel snappy.

**Risk**:
Simply moving process spawning to `ProcessManager` might lose this optimization.

**Solution**:
`SessionController` (proposed in 01-MODULARIZATION) must explicitly handle the "pre-spawn" strategy:

```
class SessionController
  private prespawnedProcess: ChildProcess | null = null

  async prepareSession()
    // Start process before user types
    this.prespawnedProcess = await this.processManager.spawn({ silent: true })

  async startSession(message: string)
    // Use prespawned process if available
    const process = this.prespawnedProcess ?? await this.processManager.spawn()
    this.prespawnedProcess = null
    return process
```

---

### NEW: Per-Panel Permission Isolation

**The Problem**:
`_pendingPermissionRequests` is shared across all panels (Line 176-182 in extension.ts).

**Risk**:
Permission requests from Panel A could be responded to by Panel B, causing security issues.

**Solution**:
```
class PanelRegistry
  private panels: Map<string, Panel>

  getPermissionRequests(panelId: string): PermissionRequest[]
    return this.panels.get(panelId)?.pendingPermissions ?? []

  addPermissionRequest(panelId: string, request: PermissionRequest)
    const panel = this.panels.get(panelId)
    if (panel) {
      panel.pendingPermissions.push(request)
    }
```

---

### CONFLICT RESOLVED: Layer Enforcement vs Circular Dependencies

**Original Conflict**:
Strict layer enforcement (Infrastructure → Domain → UI) is proposed, but current codebase has circular dependencies.

**Example**: `ProcessManager` (Infrastructure) needs to notify UI (`extension.ts`), but UI layer shouldn't depend on Infrastructure layer directly.

**Resolution**: Use EventBus that all layers can subscribe to:

```
// src/services/EventBus.ts
class EventBus
  private subscribers: Map<string, Set<Handler>>

  // All layers can publish
  publish(event: string, data: unknown)

  // All layers can subscribe
  subscribe(event: string, handler: Handler): Unsubscribe

// Usage - no direct dependencies
// Infrastructure publishes
processManager.on('stdout', (data) => eventBus.publish('cli:output', data))

// UI subscribes
eventBus.subscribe('cli:output', (data) => this.updateWebview(data))
```

---

### UPDATED: State Management - Hot State Requirement

**The Problem**:
Architecture Item 1 (Single Source of Truth in `ConversationManager`) conflicts with performance needs.

`extension.ts` (Orchestrator) needs immediate access to message data for UI commands (Diffs, Retry). If `ConversationManager` is purely disk-backed or async, this introduces latency.

**Resolution**: `ConversationManager` should keep an in-memory "Hot State":

```
class ConversationManager
  // Hot state - synchronous read
  private _hotState: {
    currentConversation: Conversation | null
    recentMessages: Message[]  // Last 100 messages
  }

  // Cold state - async read
  private _persistence: ConversationPersistence

  getMessageSync(index: number): Message | null
    return this._hotState.currentConversation?.messages[index] ?? null

  async loadFullHistory(): Message[]
    return await this._persistence.loadAll()
```

---

### Updated Migration Strategy

1. **Phase 0 (NEW)**: Set up testing + fix StreamBuffer usage everywhere
2. **Phase 1**: Add interfaces for existing services (non-breaking)
3. **Phase 2**: Create ConversationFacade for safe split-brain migration
4. **Phase 3**: Implement dependency injection with Disposable support
5. **Phase 4**: Add EventBus for decoupled communication
6. **Phase 5**: Migrate all 47+ references to use facade (2-3 days)
7. **Phase 6**: Remove extension.ts state copy, simplify facade
8. **Phase 7**: Add layer enforcement through ESLint rules
