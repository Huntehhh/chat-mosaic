# Key Services Reference

## ConversationManager
**File**: `src/services/ConversationManager.ts`
**Purpose**: Conversation storage and JSONL parsing

Key methods:
- `initialize()` - Load conversation index
- `loadJSONLConversation(path)` - Parse Claude's JSONL format
- `saveCurrentConversation()` - Persist current conversation
- `getAllConversations()` - Get indexed conversations
- `rebuildIndex()` - Rebuild conversation index

Schemas (Zod):
- `UserMessageSchema`, `AssistantMessageSchema`
- `ToolUseContentSchema`, `ToolResultContentSchema`
- `JSONLEntrySchema` - Union of all entry types

## CliIntegration
**File**: `src/services/CliIntegration.ts`
**Purpose**: Claude CLI conversation scanning

Key methods:
- `scanConversations()` - Find JSONL files in Claude's projects folder
- `loadConversation(sessionId)` - Load specific conversation
- `loadMoreMessages(offset, limit)` - Paginated loading

## PermissionsManager
**File**: `src/services/PermissionsManager.ts`
**Purpose**: Tool approval and audit logging

Key methods:
- `isToolPreApproved(toolName)` - Check if tool is auto-approved
- `addPermission(pattern)` - Add to allowed list
- `isCommandBlocked(command)` - Check dangerous command patterns
- `logPermissionDecision(action)` - Write to audit log

Constants:
- `BLOCKED_COMMAND_PATTERNS` - Dangerous commands (rm -rf, etc.)
- `WARNED_COMMAND_PATTERNS` - Commands needing confirmation

## StreamBuffer
**File**: `src/services/StreamBuffer.ts`
**Purpose**: Parse streaming JSON from Claude CLI

Key methods:
- `parse(chunk)` - Feed chunk, get complete JSON objects
- `parseWithFallback(chunk)` - Parse with error recovery
- `flush()` - Get any remaining buffered content
- `reset()` - Clear buffer state

## McpService
**File**: `src/services/McpService.ts`
**Purpose**: MCP server configuration management

Key methods:
- `loadServers()` - Read .mcp.json
- `saveServer(name, config)` - Add/update server
- `deleteServer(name)` - Remove server
- `getConfigPath()` - Get .mcp.json path

## ProcessManager
**File**: `src/services/ProcessManager.ts`
**Purpose**: Claude process lifecycle

Key methods:
- `spawn(args, options)` - Start Claude process
- `spawnWSL(args)` - Start in WSL
- `write(data)` - Write to stdin
- `kill()` - Terminate process
- `isRunning()` - Check process status

Features:
- Heartbeat monitoring
- WSL path conversion
- Graceful shutdown
