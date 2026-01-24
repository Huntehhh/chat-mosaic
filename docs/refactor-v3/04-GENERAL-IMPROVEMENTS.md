# General Improvements - Multi-Model Consensus

> **Models Consulted**: Gemini 3 Pro, Grok 4.1 Fast, DeepSeek v3.2
> **Consensus Level**: Strong agreement on quality, safety, and testing needs
> **Generated**: 2025-12-21

---

## Executive Summary

Beyond modularization, architecture, and performance, all three models identified critical improvements needed for code quality, type safety, error handling, testing, security, and maintainability.

---

## Critical Priority

### 1. Full Zod Validation Everywhere

**The Problem**:
`extension.ts` (Line 956) processes raw JSON with manual type checking:
```
const parsed = JSON.parse(line)
if (parsed.type === 'assistant') { ... }  // No validation!
```

If the CLI changes its output format, the extension will crash or behave unexpectedly.

**Current State**:
- `CliSchemas.ts` (234 lines) exists with Zod schemas
- `ConversationManager.ts` uses schemas (Lines 20-137)
- BUT: Main parsing loop in `extension.ts` doesn't use them

**The Solution**:

Use `safeParse` with fallback handling:

**Pseudocode**:
```
import { CliMessageSchema } from './services/CliSchemas'

function parseCliOutput(line: string): CliMessage | null
  const result = CliMessageSchema.safeParse(JSON.parse(line))

  if not result.success
    // Log the validation error for debugging
    logger.warn('CLI output validation failed', {
      line: line.substring(0, 200),
      errors: result.error.issues
    })

    // Attempt graceful degradation
    try
      return createFallbackMessage(JSON.parse(line))
    catch
      return null

  return result.data

function createFallbackMessage(raw: unknown): CliMessage
  // Handle unknown message types gracefully
  return {
    type: 'unknown',
    content: JSON.stringify(raw),
    timestamp: Date.now()
  }
```

**Apply to**:
- `_handleProcessStdout` (Line 948)
- `_processJsonStreamData` (Line 1225)
- All JSONL parsing in `ConversationManager`
- Webview message handling

**Benefits**:
- Prevents runtime crashes from schema drift
- Self-documenting expected formats
- Graceful degradation for unknown types
- Easier debugging with validation errors

---

### 2. Comprehensive Unit Testing

**The Problem**:
No test infrastructure found in the codebase. Critical components are untested:
- ProcessManager - process lifecycle, WSL paths, heartbeat
- ConversationManager - JSONL parsing, atomic file operations
- PermissionsManager - pattern matching, blocked command detection
- StreamBuffer - JSON stream edge cases

**The Solution**:

Implement Vitest + MSW testing framework:

**Setup**:
```
// vitest.config.ts
export default {
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  }
}
```

**Mock VS Code API**:
```
// __mocks__/vscode.ts
export const workspace = {
  getConfiguration: vi.fn(() => ({
    get: vi.fn((key, defaultValue) => defaultValue)
  })),
  fs: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn()
  }
}

export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: 'file' }),
  parse: (uri: string) => ({ fsPath: uri, scheme: 'file' })
}

export const ExtensionContext = vi.fn()
```

**Example Test - ProcessManager**:
```
describe('ProcessManager', () => {
  let processManager: ProcessManager
  let mockProcess: MockChildProcess

  beforeEach(() => {
    mockProcess = createMockProcess()
    vi.spyOn(cp, 'spawn').mockReturnValue(mockProcess)
    processManager = new ProcessManager(config)
  })

  describe('spawn', () => {
    it('should spawn process with correct arguments', async () => {
      await processManager.spawn()

      expect(cp.spawn).toHaveBeenCalledWith(
        expect.stringContaining('claude'),
        expect.arrayContaining(['--output-format', 'stream-json']),
        expect.any(Object)
      )
    })

    it('should convert Windows paths to WSL paths when enabled', async () => {
      processManager = new ProcessManager({ ...config, wslEnabled: true })
      await processManager.spawn()

      expect(cp.spawn).toHaveBeenCalledWith(
        'wsl',
        expect.arrayContaining(['-e']),
        expect.any(Object)
      )
    })
  })

  describe('heartbeat', () => {
    it('should emit unresponsive after timeout', async () => {
      vi.useFakeTimers()
      const onUnresponsive = vi.fn()

      processManager = new ProcessManager({
        ...config,
        onUnresponsive
      })
      await processManager.spawn()

      vi.advanceTimersByTime(60001)

      expect(onUnresponsive).toHaveBeenCalled()
    })
  })
})
```

**Priority Test Files**:
1. `ProcessManager.test.ts` - Process lifecycle
2. `PermissionsManager.test.ts` - Pattern matching
3. `ConversationManager.test.ts` - JSONL parsing
4. `StreamBuffer.test.ts` - JSON stream edge cases
5. `MessageRouter.test.ts` - Message routing

**Target Coverage**: 80-90% on core services

---

## High Priority

### 3. Standardized Error Handling

**The Problem**:
Error handling is inconsistent:
- `console.error` used pervasively (no centralized logging)
- `_handleProcessError` (Line 1023) suppresses errors with boolean flag
- Early returns leave state inconsistent (Line 993-1017)
- No error classification (network vs file vs parsing)

**The Solution**:

**A. Create Logger Service**:
```
class Logger
  private outputChannel: OutputChannel

  constructor(channelName: string)
    this.outputChannel = window.createOutputChannel(channelName)

  info(message: string, context?: object)
    this.log('INFO', message, context)

  warn(message: string, context?: object)
    this.log('WARN', message, context)

  error(message: string, error?: Error, context?: object)
    this.log('ERROR', message, { ...context, error: error?.stack })

    // Also show user-facing notification for critical errors
    if this.isCritical(error)
      window.showErrorMessage(`Claude Code: ${message}`)

  private log(level: string, message: string, context?: object)
    const timestamp = new Date().toISOString()
    const contextStr = context ? JSON.stringify(context) : ''
    this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message} ${contextStr}`)
```

**B. Process State Machine**:
```
enum ProcessState
  IDLE = 'idle'
  STARTING = 'starting'
  RUNNING = 'running'
  STOPPING = 'stopping'
  STOPPED = 'stopped'
  ERROR = 'error'

class ProcessLifecycle
  private state: ProcessState = ProcessState.IDLE

  transition(to: ProcessState): boolean
    const validTransitions = {
      [ProcessState.IDLE]: [ProcessState.STARTING],
      [ProcessState.STARTING]: [ProcessState.RUNNING, ProcessState.ERROR],
      [ProcessState.RUNNING]: [ProcessState.STOPPING, ProcessState.ERROR],
      [ProcessState.STOPPING]: [ProcessState.STOPPED, ProcessState.ERROR],
      [ProcessState.STOPPED]: [ProcessState.STARTING],
      [ProcessState.ERROR]: [ProcessState.STARTING]
    }

    if validTransitions[this.state].includes(to)
      this.state = to
      this.emit('stateChanged', to)
      return true
    return false

  isIntentionallyStopping(): boolean
    return this.state === ProcessState.STOPPING
```

**C. Error Classification**:
```
enum ErrorCategory
  NETWORK = 'network'
  FILE_SYSTEM = 'file_system'
  PARSING = 'parsing'
  PROCESS = 'process'
  PERMISSION = 'permission'
  UNKNOWN = 'unknown'

function classifyError(error: Error): ErrorCategory
  if error instanceof SyntaxError
    return ErrorCategory.PARSING
  if error.code === 'ENOENT' or error.code === 'EACCES'
    return ErrorCategory.FILE_SYSTEM
  if error.code === 'ECONNREFUSED' or error.code === 'ETIMEDOUT'
    return ErrorCategory.NETWORK
  if error.message.includes('permission')
    return ErrorCategory.PERMISSION
  return ErrorCategory.UNKNOWN
```

---

### 4. Type Safety Improvements

**The Problem**:
Several `any` types and loose typing:
- `_pendingPermissionRequests` uses `Record<string, unknown>` (Line 176-182)
- `MessageRouter` uses `any` for payloads
- Webview message handlers cast to `any`

**The Solution**:

**A. Strict Permission Types**:
```
type ToolName = 'Bash' | 'Edit' | 'Write' | 'Read' | 'MultiEdit' | 'TodoWrite' | 'Glob' | 'Grep'

interface BashInput
  command: string
  timeout?: number

interface EditInput
  file_path: string
  old_string: string
  new_string: string

interface WriteInput
  file_path: string
  content: string

type ToolInput =
  | { tool: 'Bash'; input: BashInput }
  | { tool: 'Edit'; input: EditInput }
  | { tool: 'Write'; input: WriteInput }
  // ... other tools

interface PermissionRequest
  requestId: string
  toolName: ToolName
  input: ToolInput
  suggestions?: PermissionSuggestion[]
  toolUseId: string
```

**B. Generic MessageRouter**:
```
type MessageHandlerMap = {
  [K in WebviewToExtensionMessage['type']]: (
    msg: Extract<WebviewToExtensionMessage, { type: K }>
  ) => void
}

class TypedMessageRouter
  private handlers: Partial<MessageHandlerMap> = {}

  register<K extends keyof MessageHandlerMap>(
    type: K,
    handler: MessageHandlerMap[K]
  )
    this.handlers[type] = handler

  route(message: WebviewToExtensionMessage)
    const handler = this.handlers[message.type]
    if handler
      handler(message as any)  // Type-safe at registration
```

**C. Union Exhaustiveness Checks**:
```
function assertNever(x: never): never
  throw new Error(`Unexpected value: ${x}`)

function handleMessage(msg: WebviewToExtensionMessage)
  switch msg.type
    case 'sendMessage':
      // ...
    case 'newSession':
      // ...
    // ... all cases
    default:
      assertNever(msg)  // Compile error if case missing
```

---

### 5. Security Hardening

**The Problem**:
`getCommandPattern` function (Lines 2356-2448):
- No input sanitization
- No rate limiting for permission checks
- Wildcard patterns could be too permissive

**The Solution**:

**A. Input Sanitization**:
```
class CommandSanitizer
  private readonly maxLength: number = 10000
  private readonly dangerousPatterns: RegExp[] = [
    /\$\([^)]+\)/,  // Command substitution
    /`[^`]+`/,       // Backtick execution
    /;\s*rm\s+-rf/,  // Destructive chains
    />\s*\/dev\/sd/  // Disk writes
  ]

  sanitize(command: string): SanitizeResult
    // Length check
    if command.length > this.maxLength
      return { valid: false, reason: 'Command too long' }

    // Dangerous pattern check
    for pattern in this.dangerousPatterns
      if pattern.test(command)
        return { valid: false, reason: 'Dangerous pattern detected' }

    return { valid: true, sanitized: command.trim() }
```

**B. Rate Limiting**:
```
class PermissionRateLimiter
  private requests: Map<string, number[]> = new Map()
  private readonly windowMs: number = 60000  // 1 minute
  private readonly maxRequests: number = 100

  shouldAllow(toolName: string): boolean
    const now = Date.now()
    const requests = this.requests.get(toolName) || []

    // Remove old requests outside window
    const recentRequests = requests.filter(t => now - t < this.windowMs)

    if recentRequests.length >= this.maxRequests
      return false

    recentRequests.push(now)
    this.requests.set(toolName, recentRequests)
    return true
```

---

## Medium Priority

### 6. Structured Logging

**The Problem**:
Current logging uses `console.log` everywhere:
- No log levels
- No context (sessionId, panelId)
- Not persisted for debugging
- No way for users to share logs

**The Solution**:

Use structured logging with pino or similar:

**Pseudocode**:
```
import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    extensionVersion: '1.1.0'
  }
})

// Create child loggers with context
function createSessionLogger(sessionId: string)
  return logger.child({ sessionId })

// Usage
const sessionLogger = createSessionLogger(this._currentSessionId)
sessionLogger.info({ panelId }, 'Panel created')
sessionLogger.error({ error }, 'Process failed')

// Output:
// {"level":30,"time":1703123456789,"sessionId":"abc123","panelId":"panel1","msg":"Panel created"}
```

**Benefits**:
- Structured JSON for log aggregation
- Context carried through logger hierarchy
- Configurable log levels
- Easy to export for debugging

---

### 7. Accessibility Compliance

**The Problem**:
Webview components lack accessibility features:
- No ARIA labels on modals
- No keyboard navigation for tool blocks
- No screen reader support for status indicators

**The Solution**:

**A. ARIA Labels**:
```
// Modal.tsx
function Modal({ title, children, onClose })
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <h2 id="modal-title">{title}</h2>
      <div id="modal-description">
        {children}
      </div>
      <button
        onClick={onClose}
        aria-label="Close dialog"
      >
        Close
      </button>
    </div>
  )
```

**B. Keyboard Navigation**:
```
// ToolUseBlock.tsx
function ToolUseBlock({ toolUse })
  return (
    <div
      role="article"
      tabIndex={0}
      onKeyDown={(e) => {
        if e.key === 'Enter' or e.key === ' '
          toggleExpanded()
        if e.key === 'c' and e.ctrlKey
          copyToClipboard()
      }}
      aria-expanded={expanded}
      aria-label={`${toolUse.toolName} tool execution`}
    >
      ...
    </div>
  )
```

**C. Status Indicators**:
```
// StatusIndicator.tsx
function StatusIndicator({ status })
  const statusText = {
    processing: 'Claude is thinking...',
    waiting: 'Waiting for input',
    error: 'An error occurred'
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span aria-hidden="true">{statusIcon}</span>
      <span class="sr-only">{statusText[status]}</span>
    </div>
  )
```

---

### 8. Documentation with JSDoc

**The Problem**:
Public APIs lack documentation:
- No parameter descriptions
- No return type explanations
- No usage examples

**The Solution**:

Add JSDoc to all public methods:

**Example**:
```
/**
 * Spawns a new Claude CLI process with the configured settings.
 *
 * The process will use WSL if enabled in configuration, otherwise
 * spawns directly. Heartbeat monitoring begins automatically after spawn.
 *
 * @throws {Error} If process is already running
 * @throws {Error} If WSL distro is not found (when WSL enabled)
 *
 * @example
 * ```typescript
 * const processManager = new ProcessManager(config);
 * await processManager.spawn();
 *
 * // Send a message
 * processManager.write(JSON.stringify({ type: 'user', content: 'Hello' }));
 *
 * // Clean shutdown
 * await processManager.kill();
 * ```
 */
async spawn(): Promise<void>

/**
 * Checks if a tool command is pre-approved for execution.
 *
 * Pre-approval is checked against:
 * 1. Blocked patterns (always denied)
 * 2. Session-approved patterns
 * 3. Persisted permission file
 * 4. YOLO mode (if enabled)
 *
 * @param toolName - The name of the tool (e.g., 'Bash', 'Edit')
 * @param input - The tool input containing command details
 * @returns Object with `approved` boolean and optional `reason` string
 *
 * @example
 * ```typescript
 * const result = await permissionsManager.isToolPreApproved('Bash', {
 *   command: 'npm install lodash'
 * });
 *
 * if (result.approved) {
 *   // Execute without prompting
 * } else {
 *   // Show permission dialog
 * }
 * ```
 */
async isToolPreApproved(
  toolName: string,
  input: Record<string, unknown>
): Promise<PreApprovalResult>
```

---

## Low Priority

### 9. Code Quality Tooling

**Recommendations**:

**A. ESLint Configuration**:
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "no-console": "warn"
  }
}
```

**B. Prettier Configuration**:
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

**C. Husky Pre-commit Hooks**:
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

---

### 10. Automated Type Generation

**Generate Types from Zod Schemas**:
```
// Instead of maintaining duplicate interfaces
// Use Zod inference

const CliMessageSchema = z.object({
  type: z.enum(['assistant', 'user', 'tool_use', 'tool_result']),
  content: z.string(),
  timestamp: z.number().optional()
})

// Automatically derived type
type CliMessage = z.infer<typeof CliMessageSchema>
```

**Benefits**:
- Single source of truth
- Runtime validation + compile-time types
- No type drift

---

## Implementation Checklist

### Immediate (This Sprint)
- [ ] Add Zod validation to `_handleProcessStdout`
- [ ] Create Logger service with OutputChannel
- [ ] Add ProcessState enum
- [ ] Set up Vitest configuration

### Short-term (Next 2 Sprints)
- [ ] Write tests for ProcessManager
- [ ] Write tests for PermissionsManager
- [ ] Add ARIA labels to modals
- [ ] Implement structured logging

### Medium-term (Next Month)
- [ ] Complete test coverage to 80%
- [ ] Add JSDoc to all public APIs
- [ ] Implement rate limiting
- [ ] Full accessibility audit

### Long-term (Next Quarter)
- [ ] TypeScript strict mode
- [ ] Zero `any` types
- [ ] WCAG 2.1 AA compliance
- [ ] Automated documentation generation

---

## Session 3 Updates: Quality & Testing Refinements

> **Source**: Individual model reviews (Gemini, Grok, DeepSeek)
> **Date**: 2025-12-21

### CRITICAL: Testing BEFORE Refactoring

**Priority**: P0 (Phase 0)

**The Problem**:
The original plan puts unit tests in Phase 5 (Week 9-10). This is **backwards**. You need tests **before** decomposing the God object to ensure you don't break functionality.

**New Testing Timeline**:
1. **Week 1**: Vitest + MSW setup with basic VS Code API mocks
2. **Week 1-2**: Write characterization tests for current `extension.ts` critical paths
3. **Week 2-3**: Begin refactoring with test safety net
4. **Ongoing**: Add tests for each extracted service

**Characterization Tests to Write First**:
```
// tests/extension.characterization.test.ts
describe('ClaudeChatProvider - Characterization', () => {
  it('should handle stdout stream with multi-line JSON', async () => {
    // Capture current behavior before refactoring
  })

  it('should handle permission request/response cycle', async () => {
    // Capture control protocol behavior
  })

  it('should save conversation on debounce timer', async () => {
    // Capture persistence behavior
  })

  it('should handle panel creation and disposal', async () => {
    // Capture lifecycle behavior
  })
})
```

---

### NEW: Error Boundary for Webview

**Priority**: P1

**The Problem**:
When React.lazy components fail to load (network issues, bundle corruption), the entire webview crashes with no recovery.

**Solution**:
```
// src/webview/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report to extension host
    vscode.postMessage({
      type: 'componentError',
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h3>Something went wrong</h3>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Usage in App.tsx
<ErrorBoundary>
  <Suspense fallback={<ModalSkeleton />}>
    {showSettings && <SettingsModal />}
  </Suspense>
</ErrorBoundary>
```

---

### NEW: Cache Invalidation Strategy

**Priority**: P1

**The Problem**:
The LRU cache proposal (03-PERFORMANCE) lacks cache invalidation triggers:
1. File changes on disk
2. Manual "reload conversation" user action
3. Extension restart

**Solution - Event-Driven Cache Invalidation**:
```
class CacheInvalidator {
  constructor(
    private cacheService: CacheService,
    private fileWatcher: FileSystemWatcher
  ) {
    // Invalidate on file changes
    fileWatcher.onDidChange((uri) => {
      if (uri.path.includes('conversations')) {
        cacheService.invalidate('conversations', uri.path)
      }
      if (uri.path.includes('diff')) {
        cacheService.invalidate('diff', uri.path)
      }
    })
  }

  // Manual invalidation for user actions
  invalidateConversation(conversationId: string) {
    this.cacheService.invalidate('conversations', conversationId)
    this.cacheService.invalidate('index', 'main')
  }

  // Full reset on extension restart
  reset() {
    this.cacheService.invalidateAll()
  }
}
```

---

### NEW: Zod Schemas for Control Protocol

**Priority**: High

**The Problem**:
The plan adds Zod for CLI messages, but we specifically need schemas for the `control_request` (permissions, init) and `control_response` structures.

**Solution**:
```
// src/types/control-protocol.ts
import { z } from 'zod'

const ControlRequestSchema = z.object({
  type: z.literal('control_request'),
  request_type: z.enum(['permission', 'init', 'account_info']),
  request_id: z.string(),
  payload: z.union([
    PermissionRequestPayloadSchema,
    InitRequestPayloadSchema,
    AccountInfoRequestPayloadSchema
  ])
})

const ControlResponseSchema = z.object({
  type: z.literal('control_response'),
  request_id: z.string(),
  status: z.enum(['approved', 'denied', 'error']),
  payload: z.unknown().optional()
})

// Type inference
type ControlRequest = z.infer<typeof ControlRequestSchema>
type ControlResponse = z.infer<typeof ControlResponseSchema>

// Validation helper
function parseControlMessage(data: unknown): ControlRequest | ControlResponse | null {
  const requestResult = ControlRequestSchema.safeParse(data)
  if (requestResult.success) return requestResult.data

  const responseResult = ControlResponseSchema.safeParse(data)
  if (responseResult.success) return responseResult.data

  return null
}
```

---

### NEW: Webview Message Validation

**Priority**: High

**The Problem**:
`messageHandlers.ts` (613 lines) processes webview messages with raw `JSON.parse`. No validation of incoming messages from webview.

**Risk**: Malformed IPC messages could crash the extension.

**Solution**:
```
// src/types/webview-messages.ts
const WebviewMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sendMessage'), content: z.string() }),
  z.object({ type: z.literal('newSession') }),
  z.object({ type: z.literal('stopProcess') }),
  z.object({ type: z.literal('respondToPermission'), requestId: z.string(), approved: z.boolean() }),
  // ... all message types
])

// In extension.ts
private _handleWebviewMessage(message: unknown) {
  const result = WebviewMessageSchema.safeParse(message)

  if (!result.success) {
    this._logger.warn('Invalid webview message', {
      errors: result.error.issues,
      message: JSON.stringify(message).slice(0, 200)
    })
    return
  }

  // Type-safe handling
  this._messageRouter.route(result.data)
}
```

---

### UPDATED: Accessibility Priority Upgrade

**Priority**: P0 (upgraded from P3)

**The Problem**:
6+ modals missing focus traps and ARIA labels is a **blocking accessibility issue**, not a nice-to-have.

**Immediate Fixes Required**:

1. **Focus Trap for All Modals**:
```
// src/webview/hooks/useFocusTrap.ts
function useFocusTrap(isOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    firstElement?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
      if (e.key === 'Escape') {
        // Close modal
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return containerRef
}
```

2. **ARIA Labels for All Modals**:
```
// Template for all modals
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">{title}</h2>
  <div id="modal-description">{children}</div>
</div>
```

**Modals to Update**:
- settings-modal.tsx
- mcp-servers-modal.tsx
- slash-commands-modal.tsx
- model-selector-modal.tsx
- thinking-intensity-modal.tsx
- history-panel.tsx (if modal-like)

---

### REVISED Implementation Checklist

### Phase 0 - Safety Net (Week 1) ← NEW
- [ ] Set up Vitest with VS Code API mocks
- [ ] Write characterization tests for extension.ts
- [ ] Fix StreamBuffer usage in ALL handlers
- [ ] Add focus traps to all modals
- [ ] Add ARIA labels to all modals

### Phase 1 - Foundation (Week 2-3)
- [ ] Add Zod validation to `_handleProcessStdout`
- [ ] Add Zod validation to webview messages
- [ ] Add Zod schemas for Control Protocol
- [ ] Create Logger service with OutputChannel
- [ ] Add ProcessState enum
- [ ] Create ErrorBoundary component

### Phase 2 - Testing (Ongoing)
- [ ] Write tests for ProcessManager
- [ ] Write tests for PermissionsManager
- [ ] Write tests for StreamBuffer edge cases
- [ ] Implement structured logging

### Phase 3 - Quality (After Refactoring)
- [ ] Complete test coverage to 80%
- [ ] Add JSDoc to all public APIs
- [ ] Implement rate limiting
- [ ] Add CacheInvalidator service

### Phase 4 - Long-term
- [ ] TypeScript strict mode
- [ ] Zero `any` types
- [ ] WCAG 2.1 AA compliance
- [ ] Automated documentation generation
