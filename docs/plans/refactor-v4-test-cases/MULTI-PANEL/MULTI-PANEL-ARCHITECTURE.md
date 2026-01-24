# Multi-Panel Architecture - Consolidated

> **Last Updated:** 2026-01-04 | **Status:** Production

## Overview

Each panel (sidebar or floating window) operates as an **independent Claude session** with complete state isolation. One ProcessRegistry manages all processes, routing messages via panelId captured in callback closures.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VS Code Extension Host                               │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      ClaudeChatProvider (Singleton)                     │ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │  PANEL TRACKING (extension.ts)                                    │  │ │
│  │  │  _panels: Map<panelId, PanelState>  ← Per-panel conversation/UI  │  │ │
│  │  │  _sessionOwners: Map<sessionId, panelId>  ← Ownership lock        │  │ │
│  │  │  _activePanelId: string  ← Current focus                          │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │  PROCESS REGISTRY (ProcessRegistry.ts)                            │  │ │
│  │  │  _processes: Map<panelId, ManagedProcess>  ← Per-panel processes │  │ │
│  │  │  Each ManagedProcess contains:                                    │  │ │
│  │  │    - ProcessManager (owns ChildProcess)                           │  │ │
│  │  │    - StreamBuffer (JSON parser)                                   │  │ │
│  │  │    - spawnGeneration (stale callback防止)                        │  │ │
│  │  │    - state (sessionId, isProcessing, lastActivity)                │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │  CONVERSATION MANAGER (ConversationManager.ts)                    │  │ │
│  │  │  _paginationCache: Map<filePath, PaginationState>                 │  │ │
│  │  │    ← Per-conversation cache prevents concurrent load collisions  │  │ │
│  │  │  _currentFilePath: string  ← Active conversation                 │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  WebviewPanel│  │  WebviewPanel│  │  WebviewPanel│  │ WebviewView  │   │
│  │  (Panel 1)   │  │  (Panel 2)   │  │  (Panel 3)   │  │  (Sidebar)   │   │
│  │  React UI    │  │  React UI    │  │  React UI    │  │  React UI    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                 │            │
│         ▼                 ▼                 ▼                 ▼            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │              Message Handler with panelId Routing                  │   │
│  │  panel.webview.onDidReceiveMessage((msg) =>                        │   │
│  │    MessageRouter.route(msg, panelId) ← panelId from closure)       │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ spawn claude
                                   ▼
          ┌─────────────────────────────────────────────────────────┐
          │            Per-Panel Claude CLI Processes                │
          │                                                          │
          │  PID 1000        PID 2000        PID 3000               │
          │  (panel-1)       (panel-2)       (sidebar)              │
          │  gen: 1          gen: 1          gen: 1                 │
          │  session: abc    session: def    session: ghi           │
          │  StreamBuffer    StreamBuffer    StreamBuffer           │
          │       │               │               │                 │
          └───────┼───────────────┼───────────────┼─────────────────┘
                  │               │               │
                  │  Callbacks capture panelId + gen in closure
                  │
                  ▼
          onStdout(panelId, gen, data) → Check gen → Route to panel
          onStderr(panelId, gen, data) → Check gen → Route to panel
          onClose(panelId, gen, code)  → Check gen → Cleanup
```

---

## Message Flow: User Sends "Hello" in Panel 2

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ USER ACTION                   EXTENSION                    CLAUDE PROCESS    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Panel 2: Type "Hello"                                                       │
│      │                                                                        │
│      ├─▶ postMessage({type:'sendMessage', text:'Hello'})                     │
│      │                                                                        │
│      └─▶ panel.webview.onDidReceiveMessage fires                             │
│          panelId = 'panel-2' (from closure)                                  │
│          │                                                                    │
│          ├─▶ MessageRouter.route(msg, 'panel-2')                             │
│          │   └─▶ 'sendMessage' handler                                       │
│          │                                                                    │
│          ├─▶ _sendMessageToClaude(text, ..., 'panel-2')                      │
│          │   │                                                                │
│          │   ├─▶ Get panelState for 'panel-2'                                │
│          │   ├─▶ sessionId = panelState.sessionId                            │
│          │   │                                                                │
│          │   ├─▶ IF sessionId exists:                                        │
│          │   │   ├─▶ _claimSessionOwnership(sessionId, 'panel-2')            │
│          │   │   │   └─▶ IF owned by other panel:                            │
│          │   │   │       ├─▶ Show modal: "Already open in [Panel X]"        │
│          │   │   │       ├─▶ Button: "Go to Panel" → activate Panel X       │
│          │   │   │       └─▶ ABORT (return early)                           │
│          │   │   └─▶ args.push('--resume', sessionId)                        │
│          │   │                                                                │
│          │   └─▶ ProcessRegistry.spawn('panel-2', {args})                    │
│          │       │                                                            │
│          │       ├─▶ Create StreamBuffer                                     │
│          │       ├─▶ gen = ++spawnGenerationCounter                          │
│          │       ├─▶ Create ProcessManager with callbacks:                   │
│          │       │   onStdout: (data) => _handleStdout('panel-2', gen, data) │
│          │       │                                                            │
│          │       └─▶ ProcessManager.spawn() ──────────▶  claude --resume X   │
│          │                                                  PID 2000          │
│          └─▶ ProcessRegistry.write('panel-2', JSON)  ──▶  stdin             │
│                                                              │                │
│                                                              ├─ process       │
│                                                              │                │
│                                                              ▼                │
│                                                        stdout: {"type":       │
│                                                                "assistant"..} │
│                                                              │                │
│          ┌───────────────────────────────────────────────────┘                │
│          │                                                                    │
│          ▼                                                                    │
│  onStdout('panel-2', gen=1, data)                                            │
│      │                                                                        │
│      ├─▶ managed = _processes.get('panel-2')                                 │
│      ├─▶ IF managed.gen !== gen: return (stale callback)                     │
│      ├─▶ IF !isPanelActive('panel-2'): return (panel closed)                 │
│      ├─▶ StreamBuffer.parse(data) → [JSON objects]                           │
│      └─▶ FOR EACH parsed:                                                    │
│          ├─▶ onMessage('panel-2', parsed)                                    │
│          │   └─▶ _processJsonStreamData(parsed, 'panel-2')                   │
│          │       └─▶ _sendAndSaveMessage(message, 'panel-2')                 │
│          │           └─▶ _postMessageToPanel('panel-2', message)             │
│          │               └─▶ panelState.panel.webview.postMessage(message)   │
│          │                                                                    │
│          └─▶ IF type='result' && session_id:                                 │
│              └─▶ _claimSessionOwnership(session_id, 'panel-2')               │
│                  └─▶ panelState.sessionId = session_id                       │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Critical Edge Cases & Solutions

### 1. ✅ Session Ownership Lock
**Problem:** Two panels resuming same session → JSONL corruption
**Solution:** `_sessionOwners` map tracks sessionId→panelId. Modal shown if conflict with "Go to Panel" button.

### 2. ✅ Processing State Contamination
**Problem:** Class-level `_isProcessing` synced between panels during focus switch
**Solution:** Removed class-level variable. Use only `panelState.isProcessing` + `_setProcessingState(panelId, bool)`.

### 3. ✅ Pagination Collision
**Problem:** Service-level `_parsedMessages` shared → Panel A loads conversation-A, Panel B loads conversation-B simultaneously → Panel A shows Panel B's messages
**Solution:** `_paginationCache: Map<filePath, PaginationState>` with per-conversation state.

### 4. ✅ Permission Modal Routing
**Problem:** Permission requests missing panelId → routed to sidebar
**Solution:** Pass panelId to `_sendAndSaveMessage()` in `_handleControlRequest()`. Modal shows in requesting panel only.

### 5. ✅ Stale Process Callbacks
**Problem:** Panel respawns → old process callbacks fire → update wrong entry
**Solution:** `spawnGeneration` counter. Callbacks check `if (managed.gen !== gen) return;`

### 6. ✅ Panel Disposed During Processing
**Problem:** Process outputs after panel closed → routing to disposed webview
**Solution:** `isPanelActive(panelId)` check in `_handleStdout()`. Messages dropped if panel gone.

---

## State Isolation Summary

| Layer | Isolation | Mechanism |
|-------|-----------|-----------|
| **Panel State** | ✅ Per-panel | `_panels: Map<panelId, PanelState>` |
| **Processes** | ✅ Per-panel | `ProcessRegistry._processes: Map<panelId, ManagedProcess>` |
| **Session IDs** | ✅ Per-panel + ownership lock | `_sessionOwners: Map<sessionId, panelId>` |
| **Conversations** | ✅ Per-file cached | `_paginationCache: Map<filePath, PaginationState>` |
| **Permissions** | ✅ Per-panel routing | `_handleControlRequest()` passes panelId |
| **JSONL Storage** | ✅ Per-sessionId | `~/.claude/projects/{workspace}/{sessionId}.jsonl` |

---

## Key Design Decisions

**Why One Process Per Panel?**
- Claude CLI expects single stdin writer
- Permission prompts are synchronous
- Independent conversation state

**Why spawnGeneration Counter?**
- Integer comparison faster than UUID
- Clear ordering (gen 3 > gen 2)
- Prevents old callbacks from affecting new processes

**Why Panel-Specific State?**
- Prevents cross-contamination during focus switches
- Enables concurrent operations
- Clean disposal without affecting other panels

---

## Test Scenarios

| Test | Expected Result |
|------|-----------------|
| Panel A has session, Panel B loads same → send in B | Modal: "Already open", "Go to Panel" activates A |
| Panel A requests Bash permission, switch to B | Modal hidden in B, reappears when switch back to A |
| Open 2 panels, load different conversations simultaneously | Both load correctly, no collision |
| Send in Panel A, while responding open Panel B, send in B | Both get correct isolated responses |
| Panel A processing, switch to Panel B | B shows idle, A shows processing |
| Close panel during response | Clean shutdown, ownership released, messages dropped |

---

## Related Files

- **extension.ts** - Panel state, session ownership, message routing
- **ProcessRegistry.ts** - Multi-process management, spawn generation
- **ProcessManager.ts** - Single process lifecycle, heartbeat, graceful shutdown
- **ConversationManager.ts** - Pagination cache, JSONL parsing
- **StreamBuffer.ts** - Per-process JSON parsing
