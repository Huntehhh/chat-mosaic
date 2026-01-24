# OpenCode Integration Test Plan

## Prerequisites

### 1. Install OpenCode CLI
```bash
# Install via go (recommended)
go install github.com/opencode-ai/opencode@latest

# Or download from releases
# https://github.com/opencode-ai/opencode/releases
```

### 2. Configure OpenCode
```bash
# Initialize config (creates ~/.config/opencode/config.json)
opencode init

# Add at least one provider API key
# Example for OpenAI:
opencode config set provider.openai.api_key "sk-..."

# Or for Anthropic:
opencode config set provider.anthropic.api_key "sk-ant-..."
```

### 3. Verify OpenCode Works Standalone
```bash
# Test server starts
opencode serve --port 4096

# In another terminal, test health endpoint
curl http://localhost:4096/global/health
# Expected: {"healthy":true,"version":"x.x.x"}

# Stop server (Ctrl+C)
```

---

## Test Scenarios

### Phase 1: Backend Switching (UI)

#### Test 1.1: Enable OpenCode Backend
1. Open VS Code with the extension
2. Open Settings Modal (gear icon or Cmd+,)
3. Find "Backend" section
4. Click "OpenCode" button
5. **Expected**: Button highlights orange, OpenCode settings appear

#### Test 1.2: Configure OpenCode Settings
1. With OpenCode selected, verify:
   - Server URL field shows `http://localhost:4096`
   - "Auto-start server" toggle is ON
2. **Expected**: Settings are editable

#### Test 1.3: Switch Back to Claude
1. Click "Claude CLI" button
2. **Expected**:
   - Claude button highlights
   - OpenCode settings disappear
   - WSL settings reappear (if on Windows)

---

### Phase 2: OpenCode Connection (Requires ENV VAR)

#### Test 2.1: Enable OpenCode via Environment
```powershell
# PowerShell (Windows)
[Environment]::SetEnvironmentVariable("OPENCODE_ENABLED", "true", "User")

# Then restart VS Code completely
```

#### Test 2.2: Verify Connection Logs
1. Open VS Code Developer Tools: `Help > Toggle Developer Tools`
2. Go to Console tab
3. Open Claude Code Chat panel
4. **Expected logs**:
   ```
   [ClaudeChatProvider] OpenCode backend ENABLED via OPENCODE_ENABLED env var
   [ClaudeChatProvider] BackendAdapter initialized for OpenCode
   [OpenCodeServerManager] Starting server on port 4096...
   [OpenCodeServerManager] Server started successfully
   [OpenCodeClient] GET /global/health - OK in Xms
   [OpenCodeBackend] Connected to OpenCode vX.X.X
   [BackendAdapter] Connected to opencode backend
   [BackendAdapter] Starting background event listener
   ```

#### Test 2.3: Verify Server Health
```bash
# While extension is running
curl http://localhost:4096/global/health
```
**Expected**: `{"healthy":true,"version":"..."}`

---

### Phase 3: Basic Messaging

#### Test 3.1: Send Simple Message
1. Type "Hello, what's 2+2?" in chat input
2. Press Enter or click Send
3. **Expected logs**:
   ```
   [BackendAdapter] sendMessage START - backend=opencode, text="Hello, what's 2+2?..."
   [BackendAdapter] No session, creating new one...
   [OpenCodeClient] POST /session - OK in Xms
   [BackendAdapter] Created session: <session-id>
   [BackendAdapter] Sending to session <id> with options...
   [OpenCodeClient] POST /session/<id>/message - starting...
   [BackendAdapter] Event #1: text
   [BackendAdapter] Event #2: text_delta
   ...
   [BackendAdapter] Event #N: done
   [BackendAdapter] sendMessage COMPLETE - N events in Xms
   ```
4. **Expected UI**: Response appears in chat

#### Test 3.2: Send Follow-up Message
1. Without refreshing, send another message
2. **Expected**: Uses same session (no "creating new one" log)

#### Test 3.3: Test Streaming
1. Ask a longer question: "Explain quantum computing in detail"
2. **Expected**: Text appears incrementally, not all at once

---

### Phase 4: Tool Use

#### Test 4.1: File Read Tool
1. Ask: "Read the package.json file"
2. **Expected logs**:
   ```
   [BackendAdapter] Event #X: tool_running
   [BackendAdapter] Event #Y: tool_completed
   ```
3. **Expected UI**: Tool use block shows, file content displayed

#### Test 4.2: File Edit Tool
1. Ask: "Add a comment to the top of package.json"
2. **Expected**:
   - Permission request appears (if not in yolo mode)
   - After approval, diff shows in tool result

#### Test 4.3: Bash Tool
1. Ask: "Run `ls -la` in the current directory"
2. **Expected**:
   - Permission request (first time)
   - Output shows in tool result block

---

### Phase 5: Background Events

#### Test 5.1: Todo Updates
1. Ask: "Create a todo list with 3 items for testing"
2. **Expected logs**:
   ```
   [BackendAdapter] Background event #1: todo_updated (session: ...)
   ```
3. **Expected UI**: Todo list appears/updates

#### Test 5.2: File Edit Notifications
1. Ask Claude to edit a file
2. **Expected**: `file_edited` event in logs (if OpenCode emits it)

---

### Phase 6: Error Handling

#### Test 6.1: Server Not Running
1. Stop any running opencode server
2. Disable auto-start in settings
3. Restart VS Code
4. Try to send a message
5. **Expected**: Error message about connection failure

#### Test 6.2: Invalid API Key
1. Configure OpenCode with invalid API key
2. Send a message
3. **Expected**: Error message about authentication

#### Test 6.3: Network Timeout
1. Set very short timeout in code (for testing)
2. **Expected**: Timeout error with duration in logs

---

### Phase 7: Cleanup & Lifecycle

#### Test 7.1: Clean Disconnect
1. Close the chat panel
2. **Expected logs**:
   ```
   [BackendAdapter] Stopped background event listener
   [OpenCodeBackend] Stopping server we started...
   [OpenCodeServerManager] Stopping server...
   [OpenCodeServerManager] Server stopped
   [BackendAdapter] Disconnected
   ```

#### Test 7.2: Verify No Orphan Processes
```bash
# After closing extension
ps aux | grep opencode  # Linux/Mac
tasklist | findstr opencode  # Windows
```
**Expected**: No opencode processes running (if we started it)

#### Test 7.3: Shared Server Mode
1. Start opencode server manually: `opencode serve --port 4096`
2. Open extension (with OPENCODE_ENABLED=true)
3. **Expected log**: Should NOT say "we started"
4. Close extension
5. **Expected**: Server still running (we didn't start it)

---

### Phase 8: Multi-Provider (OpenCode Feature)

#### Test 8.1: List Providers
1. Check logs for provider info
2. Or call API directly:
   ```bash
   curl http://localhost:4096/provider
   ```
3. **Expected**: List of configured providers

#### Test 8.2: Switch Models (if UI supports)
1. If model selector exists, try different providers
2. **Expected**: Different models work

---

## Debugging Commands

### View All Logs
1. Open Developer Tools: `Help > Toggle Developer Tools`
2. Console tab shows all `[OpenCode*]` and `[BackendAdapter]` logs

### Check Extension Host Logs
1. Command Palette: `Developer: Show Logs`
2. Select "Extension Host"

### Manual API Testing
```bash
# Health
curl http://localhost:4096/global/health

# List sessions
curl -H "x-opencode-directory: /path/to/project" http://localhost:4096/session

# List providers
curl http://localhost:4096/provider

# Create session
curl -X POST -H "Content-Type: application/json" \
  -H "x-opencode-directory: /path/to/project" \
  http://localhost:4096/session

# Send message (replace SESSION_ID)
curl -X POST -H "Content-Type: application/json" \
  -H "x-opencode-directory: /path/to/project" \
  -d '{"parts":[{"type":"text","text":"Hello"}]}' \
  http://localhost:4096/session/SESSION_ID/message
```

---

## Rollback to Claude Backend

```powershell
# Remove environment variable
[Environment]::SetEnvironmentVariable("OPENCODE_ENABLED", $null, "User")

# Restart VS Code
```

---

## Log Prefixes Reference

| Prefix | Component |
|--------|-----------|
| `[ClaudeChatProvider]` | Main extension |
| `[BackendAdapter]` | Event bridge layer |
| `[OpenCodeBackend]` | OpenCode backend impl |
| `[OpenCodeClient]` | HTTP API client |
| `[OpenCodeEventStream]` | SSE connection |
| `[OpenCodeServerManager]` | Server lifecycle |
| `[OpenCodeEventMapper]` | Event normalization |
| `[ClaudeBackend]` | Claude CLI backend |

---

## Success Criteria

- [ ] Backend switching works in UI
- [ ] OpenCode server auto-starts when enabled
- [ ] Messages send and receive correctly
- [ ] Streaming text works
- [ ] Tool use (Read, Edit, Bash) works
- [ ] Permissions work
- [ ] Background events received
- [ ] Clean disconnect (no orphan processes)
- [ ] Error messages are clear
- [ ] Fallback to Claude works
