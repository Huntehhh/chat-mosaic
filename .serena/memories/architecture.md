# Architecture

## Directory Structure
```
src/
├── extension.ts          # Main entry, ClaudeChatProvider class
├── constants.ts          # Shared constants
├── ui-react.ts           # React webview HTML template
├── services/             # Business logic layer
│   ├── ConversationManager.ts   # JSONL parsing, conversation indexing
│   ├── CliIntegration.ts        # Claude CLI communication
│   ├── PermissionsManager.ts    # Tool approval, audit logging
│   ├── StreamBuffer.ts          # JSON stream parsing
│   ├── McpService.ts            # MCP server config management
│   ├── ProcessManager.ts        # Claude process lifecycle
│   ├── GitService.ts            # Checkpoint/backup commits
│   ├── MessageRouter.ts         # Message routing logic
│   ├── TerminalManager.ts       # Terminal integration
│   └── backends/                # Backend adapters
│       ├── ClaudeBackend.ts
│       └── OpenCodeBackend.ts
├── webview/              # React frontend
│   ├── App.tsx           # Main React component
│   ├── stores/           # Zustand state management
│   │   ├── chatStore.ts  # Chat state (messages, permissions)
│   │   ├── settingsStore.ts
│   │   ├── uiStore.ts
│   │   └── branchStore.ts
│   ├── components/       # Atomic design structure
│   │   ├── atoms/        # Basic elements
│   │   ├── molecules/    # Compound components
│   │   ├── organisms/    # Complex sections
│   │   └── ui/           # shadcn-style primitives
│   ├── hooks/            # React hooks
│   │   └── handlers/     # Message handler hooks
│   └── lib/              # Utilities
├── types/                # TypeScript interfaces
└── utils/                # Shared utilities
```

## Data Flow
```
User Input → Webview (React)
    ↓ postMessage
Extension Backend (ClaudeChatProvider)
    ↓ spawn/write
Claude CLI Process (--print-json-stream)
    ↓ stdout JSON events
StreamBuffer → MessageRouter
    ↓ postMessage
Webview (React) → Update UI
```

## Key Classes

### ClaudeChatProvider (extension.ts)
Main controller with 120+ methods. Manages:
- Webview lifecycle
- Claude process spawning
- Message routing between webview and CLI
- Conversation persistence
- Permission handling

### ConversationManager (services/)
Handles conversation storage:
- Parses Claude's native JSONL format
- Maintains conversation index
- Supports per-project indexing

### StreamBuffer (services/)
Parses streaming JSON from Claude CLI:
- Handles incomplete JSON fragments
- Brace-counting for object boundaries
- Fallback parsing for malformed input

### ProcessManager (services/)
Claude process lifecycle:
- Native and WSL spawning
- Heartbeat monitoring
- Graceful termination
