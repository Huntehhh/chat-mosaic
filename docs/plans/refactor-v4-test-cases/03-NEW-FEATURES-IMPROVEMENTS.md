# New Features & Improvements

> **Analysis Sources**: Gemini 3 Pro Preview, Grok 4.1 Fast, Claude Opus 4.5
> **Date**: 2026-01-04
> **Categories**: Architecture | UX | Performance | Security | Developer Experience

---

## Executive Summary

This document consolidates feature recommendations and improvement suggestions from multi-model AI analysis. Features are prioritized based on user impact, implementation effort, and alignment with the goal of matching the official Claude Code VS Code extension.

---

## 1. Architecture Improvements

### 1.1 Modular Facade Architecture

**Current State**: `extension.ts` is 2700+ lines handling everything
**Recommendation**: Extract into domain-focused facades

```
src/
├── extension.ts              # Thin orchestrator (<300 lines)
├── facades/
│   ├── PanelFacade.ts       # Multi-panel lifecycle
│   ├── ProcessFacade.ts     # CLI process management
│   ├── PermissionsFacade.ts # Permission request handling
│   ├── ConversationFacade.ts # Session management
│   ├── McpFacade.ts         # MCP server configuration
│   └── WebviewFacade.ts     # Webview communication
├── services/                 # Core business logic (existing)
├── utils/                    # Shared utilities
└── types/                    # TypeScript interfaces
```

**Benefits**:
- Single Responsibility Principle
- Easier unit testing
- Reduced cognitive load
- Parallel development possible

**Effort**: Medium (3-4 days)
**Priority**: HIGH

---

### 1.2 Event-Driven Communication

**Current State**: Direct method calls between components
**Recommendation**: Implement event bus for loose coupling

```typescript
// src/utils/EventBus.ts
type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);
    return () => this.handlers.get(event)?.delete(handler as EventHandler);
  }

  emit<T>(event: string, data: T): void {
    this.handlers.get(event)?.forEach(h => h(data));
  }
}

// Usage:
eventBus.emit('process:spawned', { panelId, pid });
eventBus.emit('permission:requested', { requestId, toolName });
eventBus.emit('conversation:loaded', { sessionId, messageCount });
```

**Effort**: Low (1 day)
**Priority**: MEDIUM

---

### 1.3 Plugin System for Tool Handlers

**Current State**: Tool handling hardcoded in extension
**Recommendation**: Pluggable tool handler system

```typescript
// src/plugins/ToolPlugin.ts
export interface ToolPlugin {
  name: string;
  toolNames: string[];
  beforeExecute?(context: ToolContext): Promise<boolean>; // Return false to block
  afterExecute?(context: ToolContext, result: ToolResult): Promise<void>;
  renderOutput?(result: ToolResult): React.ReactNode;
}

// Example: Diff visualization plugin
export const DiffPlugin: ToolPlugin = {
  name: 'diff-visualizer',
  toolNames: ['Edit', 'Write'],
  renderOutput: (result) => <DiffViewer diff={result.diff} />
};
```

**Effort**: High (5+ days)
**Priority**: LOW (future enhancement)

---

## 2. User Experience Improvements

### 2.1 Conversation Search

**Feature**: Full-text search across conversation history

```typescript
// src/services/ConversationSearchService.ts
export class ConversationSearchService {
  private _index: Map<string, SearchableMessage[]> = new Map();

  async indexConversation(sessionId: string, messages: ConversationMessage[]): Promise<void> {
    const searchable = messages.map(m => ({
      id: m.id,
      text: this._extractText(m),
      timestamp: m.timestamp,
      type: m.type
    }));
    this._index.set(sessionId, searchable);
  }

  search(query: string, options?: SearchOptions): SearchResult[] {
    const results: SearchResult[] = [];
    const regex = new RegExp(query, 'gi');

    for (const [sessionId, messages] of this._index) {
      for (const msg of messages) {
        if (regex.test(msg.text)) {
          results.push({
            sessionId,
            messageId: msg.id,
            snippet: this._extractSnippet(msg.text, query),
            timestamp: msg.timestamp
          });
        }
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }
}
```

**UI Component**:
```tsx
<SearchPanel
  placeholder="Search conversations..."
  onSearch={(query) => searchService.search(query)}
  onResultClick={(result) => loadConversation(result.sessionId)}
/>
```

**Effort**: Medium (2-3 days)
**Priority**: HIGH

---

### 2.2 Keyboard Shortcuts

**Current State**: Limited keyboard support
**Recommendation**: Comprehensive keyboard navigation

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Send message |
| `Ctrl+Shift+Enter` | Send with Plan mode |
| `Ctrl+N` | New conversation |
| `Ctrl+H` | Toggle history panel |
| `Ctrl+/` | Toggle command palette |
| `Escape` | Cancel pending permission |
| `Ctrl+K` | Clear conversation |
| `Ctrl+S` | Export conversation |
| `Ctrl+Up/Down` | Navigate message history |

**Implementation**:
```typescript
// src/webview/hooks/useKeyboardShortcuts.ts
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = `${e.ctrlKey ? 'ctrl+' : ''}${e.shiftKey ? 'shift+' : ''}${e.key.toLowerCase()}`;

      if (handlers[key]) {
        e.preventDefault();
        handlers[key]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
```

**Effort**: Low (1 day)
**Priority**: MEDIUM

---

### 2.3 Conversation Export

**Feature**: Export conversations in multiple formats

```typescript
// src/services/ExportService.ts
export class ExportService {
  async exportAsMarkdown(messages: ConversationMessage[]): Promise<string> {
    let md = '# Claude Code Conversation\n\n';
    for (const msg of messages) {
      if (msg.type === 'user') {
        md += `## User\n${msg.content}\n\n`;
      } else if (msg.type === 'assistant') {
        md += `## Claude\n${msg.content}\n\n`;
      }
    }
    return md;
  }

  async exportAsJSON(messages: ConversationMessage[]): Promise<string> {
    return JSON.stringify(messages, null, 2);
  }

  async exportAsHTML(messages: ConversationMessage[]): Promise<string> {
    // Render with syntax highlighting
  }
}
```

**Effort**: Low (1 day)
**Priority**: MEDIUM

---

### 2.4 Message Reactions & Bookmarks

**Feature**: Mark important messages for easy reference

```typescript
interface MessageReaction {
  messageId: string;
  type: 'bookmark' | 'thumbsUp' | 'important';
  timestamp: number;
}

// Store in per-project index
interface PerProjectIndexEntry {
  chatName?: string;
  reactions?: MessageReaction[];
}
```

**UI**:
```tsx
<MessageBlock>
  <ReactionBar>
    <ReactionButton icon={<Bookmark />} onClick={() => addReaction('bookmark')} />
    <ReactionButton icon={<Star />} onClick={() => addReaction('important')} />
  </ReactionBar>
</MessageBlock>
```

**Effort**: Low (1 day)
**Priority**: LOW

---

### 2.5 Context Window Visualization

**Current State**: Basic context percentage display
**Recommendation**: Rich visualization with breakdown

```tsx
<ContextWindowIndicator>
  <ProgressBar value={contextPercentage} />
  <Tooltip>
    <div>System Prompt: 15%</div>
    <div>Conversation: 45%</div>
    <div>Tool Results: 25%</div>
    <div>Available: 15%</div>
  </Tooltip>
  <WarningBadge visible={contextPercentage > 80}>
    Context nearly full - consider starting new session
  </WarningBadge>
</ContextWindowIndicator>
```

**Effort**: Low (1 day)
**Priority**: MEDIUM

---

## 3. Performance Improvements

### 3.1 Virtual Scrolling for Long Conversations

**Current State**: All messages rendered
**Recommendation**: Use react-virtuoso (already in deps)

```tsx
// src/webview/containers/MessageList.tsx
import { Virtuoso } from 'react-virtuoso';

export function MessageList() {
  const messages = useChatStore(s => s.messages);

  return (
    <Virtuoso
      data={messages}
      itemContent={(index, message) => (
        <MessageBlock key={message.id} message={message} />
      )}
      followOutput="smooth"
      increaseViewportBy={{ top: 500, bottom: 500 }}
    />
  );
}
```

**Effort**: Low (already have dependency)
**Priority**: HIGH for large conversations

---

### 3.2 Lazy Loading for Tool Results

**Current State**: All tool results rendered immediately
**Recommendation**: Collapse large results with expand on demand

```tsx
<ToolResultBlock>
  {result.length > 1000 ? (
    <>
      <CollapsedPreview lines={5} content={result} />
      <ExpandButton onClick={() => setExpanded(true)}>
        Show full output ({formatBytes(result.length)})
      </ExpandButton>
    </>
  ) : (
    <FullContent>{result}</FullContent>
  )}
</ToolResultBlock>
```

**Effort**: Low (1 day)
**Priority**: MEDIUM

---

### 3.3 Web Worker for Heavy Operations

**Feature**: Offload JSON parsing and search to web worker

```typescript
// src/webview/workers/parse.worker.ts
self.onmessage = (e: MessageEvent<{ type: string; data: unknown }>) => {
  switch (e.data.type) {
    case 'parseJSONL':
      const lines = (e.data.data as string).split('\n');
      const parsed = lines.map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
      self.postMessage({ type: 'parsed', data: parsed });
      break;

    case 'search':
      // Full-text search
      break;
  }
};

// Usage:
const worker = new Worker(new URL('./workers/parse.worker.ts', import.meta.url));
worker.postMessage({ type: 'parseJSONL', data: largeJSONLContent });
```

**Effort**: Medium (2 days)
**Priority**: LOW (for future optimization)

---

## 4. Security Enhancements

### 4.1 Permission Audit Dashboard

**Feature**: View and manage permission history

```tsx
<SettingsModal>
  <PermissionAuditPanel>
    <AuditLog entries={auditEntries} />
    <Statistics>
      <Stat label="Approved" value={approvedCount} />
      <Stat label="Denied" value={deniedCount} />
      <Stat label="Auto-Approved" value={autoApprovedCount} />
    </Statistics>
    <ExportButton onClick={() => exportAuditLog()} />
  </PermissionAuditPanel>
</SettingsModal>
```

**Effort**: Medium (2 days)
**Priority**: MEDIUM

---

### 4.2 Allowlist Mode

**Feature**: Strict mode that only allows explicitly permitted commands

```typescript
// VS Code setting
"claudeCodeChat.permissions.mode": "blocklist" | "allowlist"

// In PermissionsManager
if (this._mode === 'allowlist') {
  // Only commands matching allowlist patterns are auto-approved
  // Everything else requires explicit permission
  return this._matchesAllowlist(command);
}
```

**Effort**: Low (1 day)
**Priority**: MEDIUM

---

### 4.3 Session Isolation

**Feature**: Sandboxed sessions with limited capabilities

```typescript
interface SessionCapabilities {
  allowFileSystem: boolean;
  allowNetwork: boolean;
  allowShell: boolean;
  workingDirectory?: string; // Restrict to subdirectory
}

// Per-session capability configuration
await startSession({
  capabilities: {
    allowFileSystem: true,
    allowNetwork: false,
    allowShell: false,
    workingDirectory: './src'
  }
});
```

**Effort**: High (5+ days)
**Priority**: LOW (advanced feature)

---

## 5. Developer Experience

### 5.1 Telemetry & Debugging

**Feature**: Opt-in telemetry for debugging production issues

```typescript
// src/services/TelemetryService.ts
export class TelemetryService {
  private _enabled: boolean;

  async trackEvent(name: string, properties?: Record<string, unknown>): Promise<void> {
    if (!this._enabled) return;

    const event = {
      name,
      properties,
      timestamp: Date.now(),
      sessionId: this._sessionId,
      version: this._extensionVersion
    };

    // Write to local log file (not sent anywhere)
    await this._writeToLog(event);
  }

  async exportDebugBundle(): Promise<string> {
    // Collect logs, settings (redacted), system info
    return JSON.stringify({
      logs: await this._getLogs(),
      system: this._getSystemInfo(),
      settings: this._getRedactedSettings()
    });
  }
}
```

**Effort**: Medium (2 days)
**Priority**: MEDIUM

---

### 5.2 Extension API

**Feature**: Expose API for other extensions to integrate

```typescript
// src/api/public-api.ts
export interface ClaudeChatAPI {
  sendMessage(text: string, options?: SendOptions): Promise<void>;
  getActiveSession(): SessionInfo | undefined;
  onMessage(callback: (message: Message) => void): Disposable;
  onPermissionRequest(callback: (request: PermissionRequest) => void): Disposable;
}

// Register in activate()
const api = createPublicAPI(provider);
return api; // Returned from activate()
```

**Effort**: Medium (2-3 days)
**Priority**: LOW

---

### 5.3 Configuration Profiles

**Feature**: Save and switch between configuration presets

```typescript
interface ConfigProfile {
  name: string;
  settings: {
    model: string;
    thinkingIntensity: string;
    yoloMode: boolean;
    permissions: PermissionsData;
  };
}

// Quick switch command
vscode.commands.registerCommand('claude-code-chat.switchProfile', async () => {
  const profiles = await getProfiles();
  const selected = await vscode.window.showQuickPick(profiles.map(p => p.name));
  if (selected) {
    await applyProfile(profiles.find(p => p.name === selected)!);
  }
});
```

**Effort**: Low (1 day)
**Priority**: LOW

---

## 6. Integration Improvements

### 6.1 Git Integration Enhancements

**Current State**: Basic backup/restore
**Recommendation**: Deep integration

```typescript
// Features:
// - Auto-commit on significant changes
// - Branch per conversation
// - Diff viewer inline with tool results
// - Stash integration

interface GitIntegration {
  autoCommit: boolean;
  branchPerSession: boolean;
  commitMessagePrefix: string;
}
```

**Effort**: Medium (3 days)
**Priority**: MEDIUM

---

### 6.2 Terminal Integration

**Feature**: Inline terminal output in chat

```tsx
<MessageBlock type="tool-result" toolName="Bash">
  <TerminalOutput
    command={command}
    output={output}
    exitCode={exitCode}
    actions={[
      { label: 'Copy', onClick: () => copyToClipboard(output) },
      { label: 'Run in Terminal', onClick: () => openInTerminal(command) }
    ]}
  />
</MessageBlock>
```

**Effort**: Low (1 day)
**Priority**: MEDIUM

---

### 6.3 MCP Server Manager UI

**Feature**: Visual MCP server configuration

```tsx
<McpManagerPanel>
  <ServerList>
    {servers.map(server => (
      <ServerCard
        key={server.name}
        server={server}
        status={serverStatuses[server.name]}
        onEdit={() => editServer(server)}
        onDelete={() => deleteServer(server.name)}
        onRestart={() => restartServer(server.name)}
      />
    ))}
  </ServerList>
  <AddServerButton onClick={() => openServerWizard()} />
</McpManagerPanel>
```

**Effort**: Medium (2-3 days)
**Priority**: HIGH (MCP is important feature)

---

## Feature Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Facade Architecture | High | Medium | P1 |
| Conversation Search | High | Medium | P1 |
| Virtual Scrolling | Medium | Low | P1 |
| MCP Manager UI | High | Medium | P1 |
| Keyboard Shortcuts | Medium | Low | P2 |
| Context Visualization | Medium | Low | P2 |
| Export Functionality | Medium | Low | P2 |
| Terminal Integration | Medium | Low | P2 |
| Permission Audit | Medium | Medium | P2 |
| Lazy Tool Results | Medium | Low | P2 |
| Event Bus | Low | Low | P3 |
| Allowlist Mode | Medium | Low | P3 |
| Telemetry | Medium | Medium | P3 |
| Message Reactions | Low | Low | P3 |
| Git Enhancements | Medium | Medium | P3 |
| Config Profiles | Low | Low | P4 |
| Extension API | Low | Medium | P4 |
| Session Isolation | High | High | P4 |
| Plugin System | Low | High | P4 |
| Web Workers | Low | Medium | P4 |

---

## Implementation Roadmap

### Phase 1: Core Quality (Weeks 1-2)
- Facade architecture refactor
- Virtual scrolling
- Keyboard shortcuts

### Phase 2: User Experience (Weeks 3-4)
- Conversation search
- Export functionality
- Context visualization
- Lazy tool results

### Phase 3: Integration (Weeks 5-6)
- MCP Manager UI
- Terminal integration
- Permission audit dashboard

### Phase 4: Advanced Features (Weeks 7+)
- Event bus architecture
- Git enhancements
- Allowlist mode
- Telemetry service

---

## Claude's Additional Recommendations

Based on my analysis of the codebase and the patterns used:

1. **Type Safety Enhancement**: Consider using branded types for IDs (PanelId, SessionId, RequestId) to prevent mixing them up at compile time.

2. **Testing Strategy**: Implement snapshot testing for the React components to catch unintended UI changes.

3. **State Machine for Process Lifecycle**: Replace the current boolean flags with a state machine (xstate) for clearer process state management.

4. **Offline Support**: Add conversation caching for offline viewing and pending message queue for reconnection.

5. **Accessibility**: Add ARIA labels and keyboard navigation throughout the UI for screen reader support.

---

*Generated by multi-model analysis: Gemini 3 Pro Preview + Grok 4.1 Fast + Claude Opus 4.5*
