# OpenCode Integration Summary

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VS Code Extension                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    ClaudeChatProvider (Orchestrator)                   │  │
│  │                              │                                         │  │
│  │         ┌────────────────────┴────────────────────┐                   │  │
│  │         ▼                                         ▼                   │  │
│  │  ┌─────────────┐                          ┌─────────────┐             │  │
│  │  │ Feature Flag│  claudeCodeChat.backend  │  Settings   │             │  │
│  │  │   "claude"  │◄─────────────────────────│  "opencode" │             │  │
│  │  └──────┬──────┘                          └──────┬──────┘             │  │
│  │         │                                        │                    │  │
│  │         ▼                                        ▼                    │  │
│  │  ┌─────────────────┐                    ┌─────────────────┐           │  │
│  │  │  ClaudeBackend  │                    │ OpenCodeBackend │           │  │
│  │  │  (IBackend)     │                    │  (IBackend)     │           │  │
│  │  └────────┬────────┘                    └────────┬────────┘           │  │
│  │           │                                      │                    │  │
│  └───────────┼──────────────────────────────────────┼────────────────────┘  │
│              │                                      │                       │
└──────────────┼──────────────────────────────────────┼───────────────────────┘
               │                                      │
               ▼                                      ▼
    ┌─────────────────────┐              ┌─────────────────────────┐
    │   Claude Code CLI   │              │   OpenCode CLI Server   │
    │                     │              │                         │
    │  ┌───────────────┐  │              │  ┌─────────────────┐    │
    │  │ child_process │  │              │  │ HTTP REST API   │    │
    │  │ stdin/stdout  │  │              │  │ localhost:4096  │    │
    │  │ JSONL stream  │  │              │  └─────────────────┘    │
    │  └───────────────┘  │              │  ┌─────────────────┐    │
    │                     │              │  │ SSE /event      │    │
    │                     │              │  │ Real-time stream│    │
    │                     │              │  └─────────────────┘    │
    └─────────────────────┘              └─────────────────────────┘
```

## What We're Implementing

### Core Features ✅

| Feature | Description |
|---------|-------------|
| **Backend Abstraction** | `IBackend` interface supporting both CLIs seamlessly |
| **Real-time Streaming** | SSE events for text, tools, permissions (token-by-token) |
| **20+ AI Providers** | Anthropic, OpenAI, Google, Groq, Mistral, etc. |
| **Agent System** | Select/switch agents with custom tools and models |
| **Dynamic Models** | Query available models from backend at runtime |
| **Session Management** | Create, list, switch, delete sessions |
| **Permission Handling** | once/always/reject with pattern matching |
| **Abort/Interrupt** | Stop generation mid-response |
| **Tool Progress** | Real-time tool state (pending→running→completed) |
| **Feature Flag** | Switch backends via VS Code settings |

### Event Mapping

```
OpenCode SSE Event          →    Unified BackendEvent    →    UI Component
─────────────────────────────────────────────────────────────────────────────
message.part.updated        →    text_delta              →    Streaming text
message.part.updated (tool) →    tool_running/completed  →    Tool block
permission.updated          →    permission_request      →    Permission card
session.status              →    session_status          →    Status indicator
todo.updated                →    todo_updated            →    Todo list
```

## What We're Deferring

| Feature | Reason |
|---------|--------|
| GitHub Integration | Requires GitHub App setup, complex workflow |
| Session Sharing (URLs) | Requires opncd.ai backend service |
| PTY Terminals | Interactive shell embedding, significant UI work |
| Web UI Server | Parallel interface, VS Code is primary |
| LSP Diagnostics | Low priority for chat functionality |
| Cost Analytics Dashboard | Can use external tools |
| Custom Commands | Template system, nice-to-have |
| MCP OAuth UI | Can fall back to CLI for auth |

## Configuration

```json
{
  "claudeCodeChat.backend": "claude" | "opencode",
  "claudeCodeChat.opencode.serverUrl": "http://localhost:4096",
  "claudeCodeChat.opencode.autoStart": true
}
```

## File Structure

```
src/services/backends/
├── types.ts              # IBackend, BackendEvent, unified types
├── BackendFactory.ts     # Creates backend based on config
├── ClaudeBackend.ts      # Wraps existing ProcessManager
├── OpenCodeBackend.ts    # HTTP client + SSE subscriber
└── opencode/
    ├── OpenCodeClient.ts      # REST API calls
    ├── OpenCodeEventStream.ts # SSE connection
    ├── OpenCodeServerManager.ts # Auto-start server
    └── OpenCodeEventMapper.ts # Event normalization
```

## Implementation Phases

```
Phase 1: Foundation ────────► Phase 2: OpenCode ────────► Phase 3: Polish
   │                              │                           │
   ├─ IBackend interface          ├─ HTTP client              ├─ Settings UI
   ├─ ClaudeBackend wrapper       ├─ SSE streaming            ├─ Status bar
   └─ BackendFactory              ├─ Event mapper             └─ Testing
                                  ├─ Provider/Model API
                                  └─ Agent system
```

## Key Metrics

| Metric | Value |
|--------|-------|
| New code | ~2,000 lines |
| Modified code | ~500 lines |
| New files | 10 |
| Modified files | 12 |
| Estimated effort | 4-6 weeks |
