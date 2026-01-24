# OpenCode CLI Integration Plan

## Executive Summary

This document outlines the implementation plan for adding OpenCode CLI support to the Claude Code Chat VS Code extension, enabling seamless switching between Claude Code CLI and OpenCode CLI backends via a feature flag.

**Key Architectural Difference**:
- Claude Code CLI: Child process with stdin/stdout JSONL streaming
- OpenCode CLI: HTTP server (`opencode serve`) with REST API + SSE event streaming

---

## Table of Contents

1. [Backend Abstraction Layer](#1-backend-abstraction-layer)
2. [OpenCode Backend Implementation](#2-opencode-backend-implementation)
3. [Event System Normalization](#3-event-system-normalization)
4. [Provider & Model Support](#4-provider--model-support)
5. [Agent System Support](#5-agent-system-support)
6. [Permission System Adaptation](#6-permission-system-adaptation)
7. [Session Management](#7-session-management)
8. [Feature Flag & Configuration](#8-feature-flag--configuration)
9. [UI Modifications](#9-ui-modifications)
10. [Deferred Features](#10-deferred-features)
11. [Migration Path](#11-migration-path)
12. [File Change Summary](#12-file-change-summary)

---

## 1. Backend Abstraction Layer

### 1.1 Core Interface Definition

Create `src/services/backends/types.ts`:

```typescript
// Unified event types (normalized from both backends)
export type BackendEventType =
  | 'text'              // Text content streaming
  | 'text_delta'        // Incremental text update
  | 'reasoning'         // Extended thinking content
  | 'tool_pending'      // Tool call queued
  | 'tool_running'      // Tool execution started
  | 'tool_completed'    // Tool finished successfully
  | 'tool_error'        // Tool failed
  | 'permission_request'// Permission needed
  | 'session_status'    // Session state change (idle/busy/retry)
  | 'session_error'     // Session-level error
  | 'tokens'            // Token usage update
  | 'cost'              // Cost update
  | 'todo_updated'      // Todo list changed
  | 'file_edited'       // File was modified
  | 'done';             // Message complete

export interface BackendEvent {
  type: BackendEventType;
  sessionId: string;
  messageId?: string;
  partId?: string;
  data: unknown;
  timestamp: number;
}

// Normalized message content
export interface MessageContent {
  text?: string;
  images?: Array<{ data: string; mediaType: string }>;
  files?: Array<{ path: string; content?: string }>;
}

// Unified session representation
export interface BackendSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: 'idle' | 'busy' | 'retry';
  messageCount?: number;
  cost?: number;
  tokens?: { input: number; output: number };
}

// Unified model representation
export interface BackendModel {
  id: string;
  providerId: string;
  name: string;
  displayName: string;
  capabilities: {
    vision: boolean;
    reasoning: boolean;
    toolUse: boolean;
  };
  cost?: {
    inputPer1k: number;
    outputPer1k: number;
  };
}

// Unified provider representation
export interface BackendProvider {
  id: string;
  name: string;
  connected: boolean;
  models: BackendModel[];
}

// Unified agent representation
export interface BackendAgent {
  name: string;
  description?: string;
  mode: 'primary' | 'subagent' | 'all';
  isNative: boolean;
  isDefault: boolean;
  model?: { providerId: string; modelId: string };
  tools: Record<string, boolean>;
}

// Permission request
export interface BackendPermissionRequest {
  id: string;
  sessionId: string;
  type: string;           // 'bash', 'edit', 'external_directory', etc.
  title: string;          // User-facing description
  tool: string;           // Tool name
  input: Record<string, unknown>;
  patterns?: string[];    // Matching patterns for "always" approval
  metadata?: Record<string, unknown>;
}

export type PermissionResponse = 'once' | 'always' | 'reject';

// Spawn options
export interface BackendSpawnOptions {
  cwd: string;
  sessionId?: string;       // Resume existing session
  model?: string;           // provider/model format
  agent?: string;           // Agent name
  thinkingMode?: 'none' | 'think' | 'think-hard' | 'ultrathink';
}

// Backend interface
export interface IBackend {
  readonly name: 'claude' | 'opencode';
  readonly isConnected: boolean;

  // Lifecycle
  connect(options?: { cwd: string }): Promise<void>;
  disconnect(): Promise<void>;

  // Providers & Models
  getProviders(): Promise<BackendProvider[]>;
  getModels(): Promise<BackendModel[]>;
  getAgents(): Promise<BackendAgent[]>;

  // Sessions
  createSession(options?: { title?: string }): Promise<BackendSession>;
  listSessions(): Promise<BackendSession[]>;
  getSession(sessionId: string): Promise<BackendSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  abortSession(sessionId: string): Promise<void>;

  // Messaging - returns async generator for streaming
  sendMessage(
    sessionId: string,
    content: MessageContent,
    options?: BackendSpawnOptions
  ): AsyncGenerator<BackendEvent, void, unknown>;

  // Permissions
  getPendingPermissions(sessionId: string): Promise<BackendPermissionRequest[]>;
  respondToPermission(
    sessionId: string,
    permissionId: string,
    response: PermissionResponse
  ): Promise<void>;

  // Event subscription (for background events)
  subscribeToEvents(): AsyncGenerator<BackendEvent, void, unknown>;
  unsubscribeFromEvents(): void;
}
```

### 1.2 Backend Factory

Create `src/services/backends/BackendFactory.ts`:

```typescript
import { IBackend } from './types';
import { ClaudeBackend } from './ClaudeBackend';
import { OpenCodeBackend } from './OpenCodeBackend';

export type BackendType = 'claude' | 'opencode';

export interface BackendConfig {
  type: BackendType;
  cwd: string;
  // Claude-specific
  claude?: {
    wslEnabled?: boolean;
    wslDistro?: string;
    nodePath?: string;
    claudePath?: string;
  };
  // OpenCode-specific
  opencode?: {
    serverUrl?: string;      // Default: http://localhost:4096
    autoStart?: boolean;     // Start server if not running
    executablePath?: string; // Custom opencode binary path
  };
}

export class BackendFactory {
  static create(config: BackendConfig): IBackend {
    switch (config.type) {
      case 'opencode':
        return new OpenCodeBackend(config);
      case 'claude':
      default:
        return new ClaudeBackend(config);
    }
  }
}
```

### 1.3 Claude Backend Wrapper

Create `src/services/backends/ClaudeBackend.ts`:

This wraps existing `ProcessManager` and `StreamProcessor` to implement `IBackend`:

```typescript
// Wraps existing ProcessManager + StreamProcessor
// Maps JSONL events to BackendEvent format
// Implements IBackend interface

export class ClaudeBackend implements IBackend {
  readonly name = 'claude' as const;

  private _processManager: ProcessManager;
  private _streamProcessor: StreamProcessor;
  private _currentSessionId?: string;
  private _eventEmitter: EventEmitter;

  // ... implementation wrapping existing code

  async *sendMessage(
    sessionId: string,
    content: MessageContent,
    options?: BackendSpawnOptions
  ): AsyncGenerator<BackendEvent> {
    // Spawn process with buildClaudeArgs()
    // Parse JSONL from stdout
    // Yield normalized BackendEvents
  }
}
```

---

## 2. OpenCode Backend Implementation

### 2.1 HTTP Client

Create `src/services/backends/opencode/OpenCodeClient.ts`:

```typescript
interface OpenCodeClientConfig {
  baseUrl: string;         // e.g., http://localhost:4096
  directory: string;       // Working directory (sent as x-opencode-directory header)
  timeout?: number;        // Request timeout (default: 30000)
}

export class OpenCodeClient {
  private _config: OpenCodeClientConfig;
  private _abortController?: AbortController;

  constructor(config: OpenCodeClientConfig) {
    this._config = config;
  }

  private async _fetch<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this._config.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'x-opencode-directory': this._config.directory,
      ...options?.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
      signal: this._abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new OpenCodeError(error);
    }

    return response.json();
  }

  // Health check
  async health(): Promise<{ healthy: boolean; version: string }> {
    return this._fetch('/global/health');
  }

  // Sessions
  async listSessions(): Promise<Session[]> {
    return this._fetch('/session');
  }

  async createSession(options?: { title?: string }): Promise<Session> {
    return this._fetch('/session', {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    });
  }

  async getSession(sessionId: string): Promise<Session> {
    return this._fetch(`/session/${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this._fetch(`/session/${sessionId}`, { method: 'DELETE' });
  }

  async abortSession(sessionId: string): Promise<void> {
    await this._fetch(`/session/${sessionId}/abort`, { method: 'POST' });
  }

  // Messages
  async getMessages(sessionId: string): Promise<MessageWithParts[]> {
    return this._fetch(`/session/${sessionId}/message`);
  }

  async sendMessage(
    sessionId: string,
    input: PromptInput
  ): Promise<Response> {
    // Returns streaming response for SSE parsing
    const url = `${this._config.baseUrl}/session/${sessionId}/message`;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-opencode-directory': this._config.directory,
      },
      body: JSON.stringify(input),
    });
  }

  // Providers & Models
  async getProviders(): Promise<ProviderListResponse> {
    return this._fetch('/provider');
  }

  async getAgents(): Promise<Agent[]> {
    return this._fetch('/agent');
  }

  // Permissions
  async listPermissions(): Promise<Permission[]> {
    return this._fetch('/permission');
  }

  async respondToPermission(
    sessionId: string,
    permissionId: string,
    response: 'once' | 'always' | 'reject'
  ): Promise<void> {
    await this._fetch(`/session/${sessionId}/permissions/${permissionId}`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    });
  }

  // Config
  async getConfig(): Promise<Config> {
    return this._fetch('/config');
  }

  async updateConfig(config: Partial<Config>): Promise<Config> {
    return this._fetch('/config', {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  }

  // MCP
  async getMcpStatus(): Promise<Record<string, McpStatus>> {
    return this._fetch('/mcp');
  }

  async addMcpServer(name: string, config: McpConfig): Promise<void> {
    await this._fetch('/mcp', {
      method: 'POST',
      body: JSON.stringify({ name, config }),
    });
  }

  // Cleanup
  abort(): void {
    this._abortController?.abort();
  }
}
```

### 2.2 SSE Event Subscriber

Create `src/services/backends/opencode/OpenCodeEventStream.ts`:

```typescript
export class OpenCodeEventStream {
  private _eventSource?: EventSource;
  private _baseUrl: string;
  private _directory: string;
  private _listeners: Map<string, Set<(event: OpenCodeEvent) => void>>;

  constructor(baseUrl: string, directory: string) {
    this._baseUrl = baseUrl;
    this._directory = directory;
    this._listeners = new Map();
  }

  connect(): void {
    const url = `${this._baseUrl}/event?directory=${encodeURIComponent(this._directory)}`;
    this._eventSource = new EventSource(url);

    this._eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as OpenCodeEvent;
        this._dispatch(parsed);
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    this._eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Implement reconnection logic with exponential backoff
    };
  }

  disconnect(): void {
    this._eventSource?.close();
    this._eventSource = undefined;
  }

  on(eventType: string, callback: (event: OpenCodeEvent) => void): void {
    if (!this._listeners.has(eventType)) {
      this._listeners.set(eventType, new Set());
    }
    this._listeners.get(eventType)!.add(callback);
  }

  off(eventType: string, callback: (event: OpenCodeEvent) => void): void {
    this._listeners.get(eventType)?.delete(callback);
  }

  private _dispatch(event: OpenCodeEvent): void {
    // Dispatch to type-specific listeners
    this._listeners.get(event.type)?.forEach(cb => cb(event));
    // Also dispatch to wildcard listeners
    this._listeners.get('*')?.forEach(cb => cb(event));
  }
}
```

### 2.3 Server Lifecycle Manager

Create `src/services/backends/opencode/OpenCodeServerManager.ts`:

```typescript
import * as cp from 'child_process';

export class OpenCodeServerManager {
  private _process?: cp.ChildProcess;
  private _port: number;
  private _executablePath: string;
  private _cwd: string;

  constructor(options: {
    port?: number;
    executablePath?: string;
    cwd: string;
  }) {
    this._port = options.port ?? 4096;
    this._executablePath = options.executablePath ?? 'opencode';
    this._cwd = options.cwd;
  }

  async isRunning(): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${this._port}/global/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async start(): Promise<void> {
    if (await this.isRunning()) {
      return; // Already running
    }

    return new Promise((resolve, reject) => {
      this._process = cp.spawn(
        this._executablePath,
        ['serve', '--port', String(this._port)],
        {
          cwd: this._cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
        }
      );

      // Wait for server to be ready
      const checkReady = async (attempts = 0): Promise<void> => {
        if (attempts > 30) {
          reject(new Error('OpenCode server failed to start'));
          return;
        }

        if (await this.isRunning()) {
          resolve();
        } else {
          setTimeout(() => checkReady(attempts + 1), 500);
        }
      };

      this._process.on('error', reject);
      checkReady();
    });
  }

  async stop(): Promise<void> {
    if (this._process) {
      this._process.kill('SIGTERM');
      this._process = undefined;
    }
  }

  getUrl(): string {
    return `http://localhost:${this._port}`;
  }
}
```

### 2.4 OpenCode Backend Implementation

Create `src/services/backends/OpenCodeBackend.ts`:

```typescript
import { IBackend, BackendEvent, BackendSession, /* ... */ } from './types';
import { OpenCodeClient } from './opencode/OpenCodeClient';
import { OpenCodeEventStream } from './opencode/OpenCodeEventStream';
import { OpenCodeServerManager } from './opencode/OpenCodeServerManager';
import { OpenCodeEventMapper } from './opencode/OpenCodeEventMapper';

export class OpenCodeBackend implements IBackend {
  readonly name = 'opencode' as const;

  private _client?: OpenCodeClient;
  private _eventStream?: OpenCodeEventStream;
  private _serverManager?: OpenCodeServerManager;
  private _config: BackendConfig;
  private _connected = false;

  constructor(config: BackendConfig) {
    this._config = config;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  async connect(options?: { cwd: string }): Promise<void> {
    const cwd = options?.cwd ?? this._config.cwd;
    const serverUrl = this._config.opencode?.serverUrl ?? 'http://localhost:4096';

    // Start server if autoStart enabled
    if (this._config.opencode?.autoStart) {
      this._serverManager = new OpenCodeServerManager({
        port: parseInt(new URL(serverUrl).port),
        executablePath: this._config.opencode?.executablePath,
        cwd,
      });
      await this._serverManager.start();
    }

    // Initialize client
    this._client = new OpenCodeClient({
      baseUrl: serverUrl,
      directory: cwd,
    });

    // Verify connection
    const health = await this._client.health();
    if (!health.healthy) {
      throw new Error('OpenCode server is not healthy');
    }

    // Connect event stream
    this._eventStream = new OpenCodeEventStream(serverUrl, cwd);
    this._eventStream.connect();

    this._connected = true;
  }

  async disconnect(): Promise<void> {
    this._eventStream?.disconnect();
    this._client?.abort();
    // Note: We don't stop the server - it may be used by other clients
    this._connected = false;
  }

  async getProviders(): Promise<BackendProvider[]> {
    const response = await this._client!.getProviders();
    return response.all.map(p => ({
      id: p.id,
      name: p.name,
      connected: response.connected.includes(p.id),
      models: Object.entries(p.models).map(([id, m]) => ({
        id,
        providerId: p.id,
        name: m.name,
        displayName: `${p.name} / ${m.name}`,
        capabilities: {
          vision: m.attachment,
          reasoning: m.reasoning,
          toolUse: m.tool_call,
        },
        cost: m.cost ? {
          inputPer1k: m.cost.input,
          outputPer1k: m.cost.output,
        } : undefined,
      })),
    }));
  }

  async getModels(): Promise<BackendModel[]> {
    const providers = await this.getProviders();
    return providers.flatMap(p => p.models);
  }

  async getAgents(): Promise<BackendAgent[]> {
    const agents = await this._client!.getAgents();
    return agents.map(a => ({
      name: a.name,
      description: a.description,
      mode: a.mode,
      isNative: a.native ?? false,
      isDefault: a.default ?? false,
      model: a.model,
      tools: a.tools,
    }));
  }

  async createSession(options?: { title?: string }): Promise<BackendSession> {
    const session = await this._client!.createSession(options);
    return this._mapSession(session);
  }

  async listSessions(): Promise<BackendSession[]> {
    const sessions = await this._client!.listSessions();
    return sessions.map(s => this._mapSession(s));
  }

  async getSession(sessionId: string): Promise<BackendSession | null> {
    try {
      const session = await this._client!.getSession(sessionId);
      return this._mapSession(session);
    } catch {
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this._client!.deleteSession(sessionId);
  }

  async abortSession(sessionId: string): Promise<void> {
    await this._client!.abortSession(sessionId);
  }

  async *sendMessage(
    sessionId: string,
    content: MessageContent,
    options?: BackendSpawnOptions
  ): AsyncGenerator<BackendEvent> {
    // Build prompt input
    const parts: PromptPart[] = [];

    if (content.text) {
      parts.push({ type: 'text', text: content.text });
    }

    if (content.images) {
      for (const img of content.images) {
        parts.push({
          type: 'file',
          mime: img.mediaType,
          url: `data:${img.mediaType};base64,${img.data}`,
        });
      }
    }

    // Send message and get streaming response
    const response = await this._client!.sendMessage(sessionId, {
      parts,
      model: options?.model ? {
        providerID: options.model.split('/')[0],
        modelID: options.model.split('/')[1],
      } : undefined,
      agent: options?.agent,
    });

    // Parse SSE stream from response
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { type: 'done', sessionId, timestamp: Date.now(), data: null };
            return;
          }

          try {
            const event = JSON.parse(data);
            yield* OpenCodeEventMapper.mapToBackendEvents(event, sessionId);
          } catch (e) {
            console.error('Failed to parse event:', e);
          }
        }
      }
    }
  }

  async getPendingPermissions(sessionId: string): Promise<BackendPermissionRequest[]> {
    const permissions = await this._client!.listPermissions();
    return permissions
      .filter(p => p.sessionID === sessionId)
      .map(p => ({
        id: p.id,
        sessionId: p.sessionID,
        type: p.type,
        title: p.title,
        tool: p.type,
        input: p.metadata,
        patterns: Array.isArray(p.pattern) ? p.pattern : p.pattern ? [p.pattern] : undefined,
        metadata: p.metadata,
      }));
  }

  async respondToPermission(
    sessionId: string,
    permissionId: string,
    response: PermissionResponse
  ): Promise<void> {
    await this._client!.respondToPermission(sessionId, permissionId, response);
  }

  async *subscribeToEvents(): AsyncGenerator<BackendEvent> {
    // Create a channel to bridge callback-based events to async generator
    const events: BackendEvent[] = [];
    let resolver: (() => void) | null = null;

    const handler = (event: OpenCodeEvent) => {
      const mapped = OpenCodeEventMapper.mapToBackendEvents(event, event.properties?.sessionID ?? '');
      events.push(...mapped);
      resolver?.();
    };

    this._eventStream!.on('*', handler);

    try {
      while (this._connected) {
        if (events.length > 0) {
          yield events.shift()!;
        } else {
          await new Promise<void>(resolve => { resolver = resolve; });
        }
      }
    } finally {
      this._eventStream!.off('*', handler);
    }
  }

  unsubscribeFromEvents(): void {
    this._eventStream?.disconnect();
  }

  private _mapSession(session: OpenCodeSession): BackendSession {
    return {
      id: session.id,
      title: session.title,
      createdAt: session.time.created,
      updatedAt: session.time.updated,
      status: 'idle',
      messageCount: undefined, // Not available in list
      cost: undefined,
      tokens: undefined,
    };
  }
}
```

---

## 3. Event System Normalization

### 3.1 Event Mapper

Create `src/services/backends/opencode/OpenCodeEventMapper.ts`:

```typescript
import { BackendEvent, BackendEventType } from '../types';

// OpenCode event types from SDK
type OpenCodeEventType =
  | 'message.updated'
  | 'message.removed'
  | 'message.part.updated'
  | 'message.part.removed'
  | 'session.created'
  | 'session.updated'
  | 'session.deleted'
  | 'session.status'
  | 'session.idle'
  | 'session.error'
  | 'session.compacted'
  | 'permission.updated'
  | 'permission.replied'
  | 'todo.updated'
  | 'file.edited'
  | 'file.watcher.updated'
  | 'pty.created'
  | 'pty.updated'
  | 'pty.exited'
  | 'pty.deleted'
  | 'mcp.tools.changed'
  | 'lsp.client.diagnostics'
  | 'lsp.updated'
  | 'vcs.branch.updated'
  | 'project.updated'
  | 'installation.updated'
  | 'installation.update-available'
  | 'server.connected'
  | 'server.instance.disposed'
  | 'global.disposed'
  | 'command.executed'
  | 'tui.prompt.append'
  | 'tui.command.execute'
  | 'tui.toast.show';

export class OpenCodeEventMapper {
  static *mapToBackendEvents(
    event: { type: OpenCodeEventType; properties: unknown },
    sessionId: string
  ): Generator<BackendEvent> {
    const timestamp = Date.now();

    switch (event.type) {
      case 'message.part.updated': {
        const props = event.properties as MessagePartUpdatedProps;
        const part = props.part;

        switch (part.type) {
          case 'text':
            yield {
              type: props.delta ? 'text_delta' : 'text',
              sessionId: part.sessionID,
              messageId: part.messageID,
              partId: part.id,
              timestamp,
              data: {
                text: props.delta ?? part.text,
                fullText: part.text,
              },
            };
            break;

          case 'reasoning':
            yield {
              type: 'reasoning',
              sessionId: part.sessionID,
              messageId: part.messageID,
              partId: part.id,
              timestamp,
              data: { text: part.text },
            };
            break;

          case 'tool':
            yield* this._mapToolPart(part, timestamp);
            break;
        }
        break;
      }

      case 'session.status': {
        const props = event.properties as SessionStatusProps;
        yield {
          type: 'session_status',
          sessionId: props.sessionID,
          timestamp,
          data: { status: props.status.type },
        };
        break;
      }

      case 'session.error': {
        const props = event.properties as SessionErrorProps;
        yield {
          type: 'session_error',
          sessionId: props.sessionID ?? sessionId,
          timestamp,
          data: { error: props.error },
        };
        break;
      }

      case 'permission.updated': {
        const permission = event.properties as Permission;
        yield {
          type: 'permission_request',
          sessionId: permission.sessionID,
          timestamp,
          data: {
            id: permission.id,
            type: permission.type,
            title: permission.title,
            metadata: permission.metadata,
            patterns: permission.pattern,
          },
        };
        break;
      }

      case 'todo.updated': {
        const props = event.properties as TodoUpdatedProps;
        yield {
          type: 'todo_updated',
          sessionId: props.sessionID,
          timestamp,
          data: { todos: props.todos },
        };
        break;
      }

      case 'file.edited': {
        const props = event.properties as FileEditedProps;
        yield {
          type: 'file_edited',
          sessionId,
          timestamp,
          data: { file: props.file },
        };
        break;
      }

      case 'message.updated': {
        const props = event.properties as MessageUpdatedProps;
        const msg = props.info;

        // Extract token usage from assistant messages
        if (msg.role === 'assistant' && msg.tokens) {
          yield {
            type: 'tokens',
            sessionId: msg.sessionID,
            messageId: msg.id,
            timestamp,
            data: {
              input: msg.tokens.input,
              output: msg.tokens.output,
              reasoning: msg.tokens.reasoning,
              cacheRead: msg.tokens.cache.read,
              cacheWrite: msg.tokens.cache.write,
            },
          };

          if (msg.cost !== undefined) {
            yield {
              type: 'cost',
              sessionId: msg.sessionID,
              messageId: msg.id,
              timestamp,
              data: { cost: msg.cost },
            };
          }
        }
        break;
      }

      // Events we acknowledge but don't need to handle yet
      case 'session.created':
      case 'session.updated':
      case 'session.deleted':
      case 'session.idle':
      case 'session.compacted':
      case 'permission.replied':
      case 'message.removed':
      case 'message.part.removed':
      case 'file.watcher.updated':
      case 'pty.created':
      case 'pty.updated':
      case 'pty.exited':
      case 'pty.deleted':
      case 'mcp.tools.changed':
      case 'lsp.client.diagnostics':
      case 'lsp.updated':
      case 'vcs.branch.updated':
      case 'project.updated':
      case 'installation.updated':
      case 'installation.update-available':
      case 'server.connected':
      case 'server.instance.disposed':
      case 'global.disposed':
      case 'command.executed':
      case 'tui.prompt.append':
      case 'tui.command.execute':
      case 'tui.toast.show':
        // No-op for now, can be extended later
        break;
    }
  }

  private static *_mapToolPart(
    part: ToolPart,
    timestamp: number
  ): Generator<BackendEvent> {
    const base = {
      sessionId: part.sessionID,
      messageId: part.messageID,
      partId: part.id,
      timestamp,
    };

    switch (part.state.status) {
      case 'pending':
        yield {
          ...base,
          type: 'tool_pending',
          data: {
            tool: part.tool,
            callId: part.callID,
            input: part.state.input,
          },
        };
        break;

      case 'running':
        yield {
          ...base,
          type: 'tool_running',
          data: {
            tool: part.tool,
            callId: part.callID,
            input: part.state.input,
            title: part.state.title,
            metadata: part.state.metadata,
          },
        };
        break;

      case 'completed':
        yield {
          ...base,
          type: 'tool_completed',
          data: {
            tool: part.tool,
            callId: part.callID,
            input: part.state.input,
            output: part.state.output,
            title: part.state.title,
            metadata: part.state.metadata,
            duration: part.state.time.end! - part.state.time.start,
          },
        };
        break;

      case 'error':
        yield {
          ...base,
          type: 'tool_error',
          data: {
            tool: part.tool,
            callId: part.callID,
            input: part.state.input,
            error: part.state.error,
            metadata: part.state.metadata,
          },
        };
        break;
    }
  }
}
```

---

## 4. Provider & Model Support

### 4.1 Dynamic Model Loading

Modify `src/extension.ts` to load models dynamically:

```typescript
// Replace hardcoded model list
private async _loadModels(): Promise<void> {
  try {
    const models = await this._backend.getModels();
    const providers = await this._backend.getProviders();

    // Cache for UI
    this._availableModels = models;
    this._availableProviders = providers;

    // Send to webview
    this._postMessage({
      type: 'modelsLoaded',
      data: {
        models: models.map(m => ({
          id: `${m.providerId}/${m.id}`,
          name: m.displayName,
          providerId: m.providerId,
          capabilities: m.capabilities,
        })),
        providers: providers.map(p => ({
          id: p.id,
          name: p.name,
          connected: p.connected,
          modelCount: p.models.length,
        })),
      },
    });
  } catch (error) {
    console.error('Failed to load models:', error);
    // Fall back to basic model list
    this._availableModels = [];
  }
}
```

### 4.2 Model Selector Update

Modify `src/webview/components/organisms/model-selector-modal.tsx`:

```typescript
// Receive models from extension instead of hardcoding
const { models, providers, selectedModel, onSelectModel } = useModelStore();

// Group models by provider
const groupedModels = useMemo(() => {
  const groups: Record<string, BackendModel[]> = {};
  for (const model of models) {
    if (!groups[model.providerId]) {
      groups[model.providerId] = [];
    }
    groups[model.providerId].push(model);
  }
  return groups;
}, [models]);

// Render provider sections with models
return (
  <div>
    {Object.entries(groupedModels).map(([providerId, providerModels]) => {
      const provider = providers.find(p => p.id === providerId);
      return (
        <div key={providerId}>
          <h3>{provider?.name ?? providerId}</h3>
          {providerModels.map(model => (
            <ModelOption
              key={model.id}
              model={model}
              selected={selectedModel === `${providerId}/${model.id}`}
              onSelect={() => onSelectModel(`${providerId}/${model.id}`)}
            />
          ))}
        </div>
      );
    })}
  </div>
);
```

---

## 5. Agent System Support

### 5.1 Agent Store

Create `src/webview/stores/agentStore.ts`:

```typescript
import { create } from 'zustand';
import type { BackendAgent } from '../../services/backends/types';

interface AgentState {
  agents: BackendAgent[];
  selectedAgent: string | null;
  loading: boolean;
  error: string | null;

  setAgents: (agents: BackendAgent[]) => void;
  setSelectedAgent: (name: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  selectedAgent: null,
  loading: false,
  error: null,

  setAgents: (agents) => set({ agents, loading: false }),
  setSelectedAgent: (selectedAgent) => set({ selectedAgent }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}));
```

### 5.2 Agent Selector Component

Create `src/webview/components/organisms/agent-selector-modal.tsx`:

```typescript
import { useAgentStore } from '../../stores/agentStore';

export function AgentSelectorModal({ open, onClose }: Props) {
  const { agents, selectedAgent, setSelectedAgent } = useAgentStore();

  const primaryAgents = agents.filter(a => a.mode === 'primary' || a.mode === 'all');

  return (
    <Modal open={open} onClose={onClose} title="Select Agent">
      <div className="space-y-2">
        {primaryAgents.map(agent => (
          <button
            key={agent.name}
            onClick={() => {
              setSelectedAgent(agent.name);
              vscode.postMessage({ type: 'setAgent', agent: agent.name });
              onClose();
            }}
            className={cn(
              'w-full p-3 text-left rounded-lg border',
              selectedAgent === agent.name && 'border-primary bg-primary/10'
            )}
          >
            <div className="font-medium">{agent.name}</div>
            {agent.description && (
              <div className="text-sm text-muted-foreground">{agent.description}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {agent.isNative ? 'Built-in' : 'Custom'} · {agent.mode}
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
```

### 5.3 Agent in Chat Input

Modify chat input to show selected agent:

```typescript
// In ChatInput component
const { selectedAgent } = useAgentStore();

// Show agent badge near model selector
{selectedAgent && (
  <Badge variant="outline" className="mr-2">
    Agent: {selectedAgent}
  </Badge>
)}
```

---

## 6. Permission System Adaptation

### 6.1 Unified Permission Handler

Modify `src/services/PermissionsManager.ts` to support both response formats:

```typescript
export class PermissionsManager {
  // ... existing code ...

  /**
   * Respond to a permission request
   * @param backend The active backend
   * @param request The permission request
   * @param response User's response
   */
  async respond(
    backend: IBackend,
    request: BackendPermissionRequest,
    response: PermissionResponse
  ): Promise<void> {
    // Store "always" approvals for future auto-approval
    if (response === 'always' && request.patterns) {
      await this._storeAlwaysApproval(request.type, request.patterns);
    }

    // Send response to backend
    await backend.respondToPermission(
      request.sessionId,
      request.id,
      response
    );
  }

  /**
   * Check if a permission should be auto-approved
   */
  async shouldAutoApprove(request: BackendPermissionRequest): Promise<boolean> {
    // Check blocked patterns first (safety)
    if (this._isBlocked(request)) {
      return false;
    }

    // Check stored approvals
    const approvals = await this._getStoredApprovals();
    if (approvals[request.type] === true) {
      return true;
    }

    // Check pattern matches
    if (Array.isArray(approvals[request.type])) {
      const patterns = approvals[request.type] as string[];
      return patterns.some(pattern =>
        this._matchesPattern(request, pattern)
      );
    }

    return false;
  }
}
```

### 6.2 Permission Card Update

Modify `src/webview/components/molecules/permission-card.tsx`:

```typescript
interface PermissionCardProps {
  request: BackendPermissionRequest;
  onRespond: (response: PermissionResponse) => void;
}

export function PermissionCard({ request, onRespond }: PermissionCardProps) {
  return (
    <Card className="border-yellow-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Permission Required
        </CardTitle>
        <CardDescription>{request.title}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="text-sm">
          <span className="font-medium">Tool:</span> {request.tool}
        </div>
        {request.input && (
          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
            {JSON.stringify(request.input, null, 2)}
          </pre>
        )}
        {request.patterns && (
          <div className="mt-2 text-xs text-muted-foreground">
            Patterns: {request.patterns.join(', ')}
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        <Button variant="destructive" onClick={() => onRespond('reject')}>
          Deny
        </Button>
        <Button variant="outline" onClick={() => onRespond('once')}>
          Allow Once
        </Button>
        <Button variant="default" onClick={() => onRespond('always')}>
          Always Allow
        </Button>
      </CardFooter>
    </Card>
  );
}
```

---

## 7. Session Management

### 7.1 Session Store

Create `src/webview/stores/sessionStore.ts`:

```typescript
import { create } from 'zustand';
import type { BackendSession } from '../../services/backends/types';

interface SessionState {
  sessions: BackendSession[];
  currentSessionId: string | null;
  loading: boolean;

  setSessions: (sessions: BackendSession[]) => void;
  setCurrentSession: (id: string | null) => void;
  addSession: (session: BackendSession) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<BackendSession>) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  currentSessionId: null,
  loading: false,

  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (currentSessionId) => set({ currentSessionId }),
  addSession: (session) => set((state) => ({
    sessions: [session, ...state.sessions],
  })),
  removeSession: (id) => set((state) => ({
    sessions: state.sessions.filter(s => s.id !== id),
  })),
  updateSession: (id, updates) => set((state) => ({
    sessions: state.sessions.map(s =>
      s.id === id ? { ...s, ...updates } : s
    ),
  })),
}));
```

### 7.2 Session List Component

Create `src/webview/components/organisms/session-list.tsx`:

```typescript
export function SessionList() {
  const { sessions, currentSessionId, setCurrentSession } = useSessionStore();
  const vscode = useVSCode();

  const handleNewSession = () => {
    vscode.postMessage({ type: 'newSession' });
  };

  const handleLoadSession = (sessionId: string) => {
    vscode.postMessage({ type: 'loadSession', sessionId });
    setCurrentSession(sessionId);
  };

  const handleDeleteSession = (sessionId: string) => {
    vscode.postMessage({ type: 'deleteSession', sessionId });
  };

  return (
    <div className="space-y-2">
      <Button onClick={handleNewSession} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        New Session
      </Button>

      <div className="space-y-1">
        {sessions.map(session => (
          <div
            key={session.id}
            className={cn(
              'p-2 rounded cursor-pointer hover:bg-muted',
              currentSessionId === session.id && 'bg-muted'
            )}
            onClick={() => handleLoadSession(session.id)}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{session.title}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSession(session.id);
                }}
              >
                <Trash className="w-3 h-3" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(session.createdAt).toLocaleDateString()}
              {session.messageCount && ` · ${session.messageCount} messages`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 8. Feature Flag & Configuration

### 8.1 VS Code Settings Schema

Add to `package.json` contributes.configuration:

```json
{
  "claudeCodeChat.backend": {
    "type": "string",
    "enum": ["claude", "opencode"],
    "default": "claude",
    "description": "Select the AI backend to use"
  },
  "claudeCodeChat.opencode.serverUrl": {
    "type": "string",
    "default": "http://localhost:4096",
    "description": "OpenCode server URL"
  },
  "claudeCodeChat.opencode.autoStart": {
    "type": "boolean",
    "default": true,
    "description": "Automatically start OpenCode server if not running"
  },
  "claudeCodeChat.opencode.executablePath": {
    "type": "string",
    "default": "",
    "description": "Custom path to opencode executable (leave empty for default)"
  }
}
```

### 8.2 Backend Initialization

Modify `src/extension.ts`:

```typescript
export class ClaudeChatProvider implements vscode.WebviewViewProvider {
  private _backend?: IBackend;

  async activate(context: vscode.ExtensionContext): Promise<void> {
    // Load configuration
    const config = vscode.workspace.getConfiguration('claudeCodeChat');
    const backendType = config.get<'claude' | 'opencode'>('backend', 'claude');
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();

    // Create backend
    this._backend = BackendFactory.create({
      type: backendType,
      cwd,
      claude: {
        wslEnabled: config.get('wsl.enabled', false),
        wslDistro: config.get('wsl.distro', 'Ubuntu'),
        nodePath: config.get('wsl.nodePath', '/usr/bin/node'),
        claudePath: config.get('wsl.claudePath', '/usr/local/bin/claude'),
      },
      opencode: {
        serverUrl: config.get('opencode.serverUrl', 'http://localhost:4096'),
        autoStart: config.get('opencode.autoStart', true),
        executablePath: config.get('opencode.executablePath', ''),
      },
    });

    // Connect to backend
    try {
      await this._backend.connect({ cwd });

      // Load initial data
      await this._loadModels();
      await this._loadAgents();
      await this._loadSessions();

      // Start event subscription
      this._subscribeToEvents();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to connect to ${backendType} backend: ${error}`
      );
    }

    // Watch for configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('claudeCodeChat.backend')) {
          // Restart with new backend
          await this._reconnectWithNewBackend();
        }
      })
    );
  }

  private async _reconnectWithNewBackend(): Promise<void> {
    // Disconnect current backend
    await this._backend?.disconnect();

    // Re-initialize with new settings
    await this.activate(this._context);

    // Notify webview
    this._postMessage({ type: 'backendChanged', backend: this._backend!.name });
  }
}
```

### 8.3 Settings UI for Backend Selection

Add to `src/webview/components/organisms/settings-modal.tsx`:

```typescript
// Backend selection section
<SettingsSection title="Backend">
  <div className="space-y-4">
    <div>
      <Label>AI Backend</Label>
      <Select
        value={settings.backend}
        onValueChange={(value) => updateSetting('backend', value)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="claude">Claude Code CLI</SelectItem>
          <SelectItem value="opencode">OpenCode CLI</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground mt-1">
        Changing backend requires extension reload
      </p>
    </div>

    {settings.backend === 'opencode' && (
      <>
        <div>
          <Label>Server URL</Label>
          <Input
            value={settings.opencode?.serverUrl ?? 'http://localhost:4096'}
            onChange={(e) => updateSetting('opencode.serverUrl', e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={settings.opencode?.autoStart ?? true}
            onCheckedChange={(v) => updateSetting('opencode.autoStart', v)}
          />
          <Label>Auto-start server</Label>
        </div>
      </>
    )}
  </div>
</SettingsSection>
```

---

## 9. UI Modifications

### 9.1 Status Bar Updates

Modify status bar to show current backend:

```typescript
// In extension.ts
private _updateStatusBar(): void {
  const backendName = this._backend?.name === 'opencode' ? 'OpenCode' : 'Claude';
  const status = this._backend?.isConnected ? '$(check)' : '$(warning)';

  this._statusBarItem.text = `${status} ${backendName}`;
  this._statusBarItem.tooltip = `Connected to ${backendName} backend`;
}
```

### 9.2 Header Component Update

Show backend indicator in chat header:

```typescript
// In Header component
const { backendName, isConnected } = useBackendStore();

<div className="flex items-center gap-2">
  <Badge variant={isConnected ? 'default' : 'destructive'}>
    {backendName}
  </Badge>
  {selectedModel && (
    <Badge variant="outline">{selectedModel}</Badge>
  )}
  {selectedAgent && (
    <Badge variant="outline">Agent: {selectedAgent}</Badge>
  )}
</div>
```

---

## 10. Deferred Features

The following features are documented but deferred for later implementation:

### HIGH EFFORT - Deferred

| Feature | Description | Reason for Deferral |
|---------|-------------|---------------------|
| GitHub Integration | PR auto-agent, workflow installation | Complex, requires GitHub App setup |
| Session Sharing | opncd.ai URL sharing | Requires backend service |
| Web UI Server | Browser-based interface | Parallel to VS Code, lower priority |
| PTY Terminals | WebSocket-based terminals | Significant UI work |
| LSP Integration | Diagnostics display | Low priority for chat UI |
| Cost Analytics Dashboard | Token stats UI | Can use external tools |
| Custom Commands | Template-based commands | Nice-to-have |
| MCP OAuth Flow | Full OAuth UI | Can use CLI fallback |

### Implementation Notes for Deferred Features

**GitHub Integration (when implemented):**
- Use OpenCode's `/github/install` and `/github/run` endpoints
- Add GitHub Actions workflow file generation
- Support PR context extraction

**Session Sharing (when implemented):**
- Call `/session/{id}/share` to generate URL
- Display share button in session list
- Add import from URL feature

**PTY Terminals (when implemented):**
- WebSocket connection to `/pty/{id}/connect`
- xterm.js for terminal rendering
- Integrate with tool output for bash commands

---

## 11. Migration Path

### Phase 1: Foundation (Week 1-2)
1. Create backend abstraction layer (types.ts)
2. Implement ClaudeBackend wrapper around existing code
3. Add backend factory and configuration
4. Basic feature flag in settings

### Phase 2: OpenCode Core (Week 2-3)
1. Implement OpenCodeClient HTTP client
2. Implement OpenCodeEventStream SSE handler
3. Implement OpenCodeServerManager
4. Create OpenCodeBackend implementing IBackend

### Phase 3: Event Normalization (Week 3-4)
1. Create OpenCodeEventMapper
2. Map all essential events (messages, tools, permissions)
3. Update StreamProcessor to emit BackendEvents
4. Integrate with existing UI components

### Phase 4: Provider & Model Support (Week 4)
1. Dynamic model loading from backend
2. Update model selector UI
3. Support provider/model format
4. Handle model capabilities display

### Phase 5: Agent Support (Week 4-5)
1. Create agent store
2. Add agent selector component
3. Integrate agent selection with message sending
4. Display agent in chat header

### Phase 6: Permission Adaptation (Week 5)
1. Update PermissionsManager for unified format
2. Support once/always/reject responses
3. Update permission card UI
4. Add pattern-based approval storage

### Phase 7: Session Management (Week 5-6)
1. Create session store
2. Add session list component
3. Integrate with sidebar
4. Support session switching

### Phase 8: Polish & Testing (Week 6)
1. Settings UI for backend selection
2. Status bar updates
3. Error handling improvements
4. Cross-backend testing

---

## 12. File Change Summary

### New Files to Create

```
src/services/backends/
├── types.ts                    # Unified types and interfaces
├── BackendFactory.ts           # Factory for backend creation
├── ClaudeBackend.ts            # Wrapper for existing Claude code
├── OpenCodeBackend.ts          # OpenCode implementation
└── opencode/
    ├── OpenCodeClient.ts       # HTTP client for REST API
    ├── OpenCodeEventStream.ts  # SSE event subscriber
    ├── OpenCodeServerManager.ts # Server lifecycle
    └── OpenCodeEventMapper.ts  # Event normalization

src/webview/stores/
├── agentStore.ts               # Agent state management
├── sessionStore.ts             # Session state management
└── backendStore.ts             # Backend connection state

src/webview/components/organisms/
├── agent-selector-modal.tsx    # Agent selection UI
└── session-list.tsx            # Session management UI
```

### Files to Modify

```
src/extension.ts                # Backend initialization, message routing
src/services/ProcessManager.ts  # Minor refactoring for abstraction
src/services/StreamProcessor.ts # Emit BackendEvents
src/services/PermissionsManager.ts # Unified permission handling

src/webview/components/organisms/
├── model-selector-modal.tsx    # Dynamic model list
├── settings-modal.tsx          # Backend selection
└── chat-input.tsx              # Agent badge display

src/webview/components/molecules/
└── permission-card.tsx         # Updated response options

src/webview/App.tsx             # Backend state integration
src/webview/hooks/useVSCodeMessaging.ts # New message types

package.json                    # New settings schema
```

### Estimated Lines of Code

| Component | New Lines | Modified Lines |
|-----------|-----------|----------------|
| Backend types | ~300 | - |
| ClaudeBackend | ~200 | - |
| OpenCodeBackend | ~400 | - |
| OpenCode client/SSE | ~350 | - |
| Event mapper | ~250 | - |
| Stores (agent, session, backend) | ~150 | - |
| UI components | ~300 | ~200 |
| Extension integration | - | ~300 |
| **Total** | **~1,950** | **~500** |

---

## Appendix A: OpenCode CLI Command Reference

```bash
# Start server (required for VS Code extension)
opencode serve --port 4096

# Alternative: attach to running server
opencode tui:attach http://localhost:4096

# List available models
opencode models

# List agents
opencode agent list

# Create custom agent
opencode agent create --name "myagent" --description "..." --model "anthropic/claude-sonnet"

# Session management
opencode session list
opencode export <sessionId>
opencode import <file.json>

# MCP management
opencode mcp list
opencode mcp add <name>
opencode mcp auth <name>
```

## Appendix B: OpenCode Event Types Reference

Essential events to handle:
- `message.part.updated` - Text/tool streaming
- `session.status` - Busy/idle state
- `session.error` - Error conditions
- `permission.updated` - Permission requests
- `todo.updated` - Todo list changes
- `message.updated` - Token/cost info

Optional events (can be ignored initially):
- `file.edited`, `file.watcher.updated` - File changes
- `pty.*` - Terminal events
- `mcp.tools.changed` - MCP updates
- `lsp.*` - Language server events
- `vcs.*` - Git events
- `installation.*` - Update notifications
