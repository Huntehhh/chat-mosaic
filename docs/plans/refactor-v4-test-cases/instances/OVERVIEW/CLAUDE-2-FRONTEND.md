# CLAUDE-2: Frontend Overview

React components, Zustand stores, hooks, and UI logic for the VS Code webview.

---

## Phase 1: HIGH Priority (Core UI) ✅ MOSTLY DONE

### H6. Permission State Management ✅ DONE
```
chatStore.pendingPermissions[] → Add → Update → Remove
                                    ↓
                            UI renders permission prompt
```
Zustand store tracks permission requests with full lifecycle actions. Already implemented in `chatStore.ts:90`.

### ErrorBoundary Component ✅ DONE
```
React Error → ErrorBoundary.getDerivedStateFromError()
                    ↓
            Fallback UI + Stack trace + Reset button
```
Class component catches React errors, logs to console, displays user-friendly error UI with recovery option. `error-boundary.tsx:108` lines.

### Virtual Scrolling with Virtuoso ✅ DONE
```
MessageList → Virtuoso
                ↓
    [Load Older] ← Infinite scroll up
    Message 1
    Message 2       Auto-follow to bottom
    Message 3       when new message arrives
    ...
```
Efficient rendering with `startReached` for pagination, `followOutput` for auto-scroll, debounced position saving. Already in `MessageList.tsx`.

### Message Type System ✅ DONE
```typescript
WebviewToExtensionMessage = SendMessage | LoadConversation | ...
ExtensionToWebviewMessage = AssistantMessage | PermissionPrompt | ...
```
Comprehensive typed unions for all message passing between webview and extension. 300+ lines in `types/messages.ts`.

### Handler Organization ✅ DONE
```
hooks/handlers/
├── useChatHandlers.ts      # Chat operations
├── useFileHandlers.ts      # File/image handling
├── useMcpHandlers.ts       # MCP servers
├── useSessionHandlers.ts   # Session management
├── useSettingsHandlers.ts  # Settings
├── useTokenHandlers.ts     # Token tracking
└── useUiHandlers.ts        # UI state
```
Domain-organized handler hooks eliminate monolithic hook files. Already split into 7 files.

### Context Window Visualization ⚠️ ENHANCE
```
[████████░░] 80%  ← Hover for details
      ↓
Tooltip: "16,384 / 20,480 tokens used"
         "Context nearly full. Consider new session."
```
Enhances existing `token-display.tsx` with color-coded progress bar and detailed tooltip showing token counts and warnings.

### Lazy Loading for Tool Results ❌ NEW
```
Tool Output (50KB) → CollapsibleContent
                            ↓
                    Show first 10 lines (2000 chars)
                    [Show full output (48.6 KB)]
```
Collapses large tool outputs with preview and expand button showing formatted size. Prevents UI lag from massive outputs.

### Search Panel ❌ NEW
```
┌─ Search Conversations ───────────┐
│ [🔍 search text...        ] [×] │
├──────────────────────────────────┤
│ → Session 1: "...JWT auth..."   │
│ → Session 2: "...OAuth flow..."  │
│ → Session 3: "...user model..."  │
└──────────────────────────────────┘
```
UI for ConversationSearchService (requires CLAUDE-1 backend). Displays results with snippets, navigates to messages on click.

### Think Mode "Disabled" Option ❌ NEW
```
┌─ Thinking Mode ──────────────┐
│ Enable Thinking    [ON/OFF]  │
│                               │
│ Intensity Level: (when ON)   │
│ [Think] [Hard] [Harder] [Ultra] │
│                               │
│       [Confirm]               │
└───────────────────────────────┘
```
Adds toggle to completely disable thinking mode. Writes to `.claude/settings.local.json`, restarts Claude process to apply (coordinates with CLAUDE-1).

### Concurrent Message Sending ❌ NEW
```
Input: "Question 1" → [🛑 Stop] [⬆ Send]
           ↓
       Processing... (can still type)
           ↓
Input: "Question 2" → [🛑 Stop] [⬆ Send]
```
Moves stop button left of send button (both always visible). Removes input disabled state while processing. Tracks pending messages with unique IDs, handles queued responses.

**Key changes:**
- Stop button left, Send button right (both always visible)
- Remove `disabled={isProcessing}` from textarea
- Generate message ID (UUID) for each send
- Track pending messages in chatStore
- Handle messageAck from backend for status updates

---

## Phase 2: MEDIUM/LOW Priority (Features & Polish)

### Export Dialog ❌ NEW
```
┌─ Export Conversation ────┐
│ Format:                   │
│ ○ Markdown (.md)         │
│ ○ JSON (.json)           │
│ ○ HTML (.html)           │
│                           │
│     [Export]              │
└───────────────────────────┘
```
UI for ExportService (requires CLAUDE-1 backend). Selects format, triggers download/save of conversation.

### Terminal Output Component ❌ NEW
```
┌─ Terminal ──────────────────────────┐
│ npm test                [exit 0] 📋 │
├──────────────────────────────────────┤
│ > test                               │
│ All tests passed!                    │
└──────────────────────────────────────┘
```
Displays terminal command, output, and exit code. Copy button and "Run in Terminal" button for reproduction.

### M2. Zustand DevTools Conditional ❌ NEW
```typescript
isDev ? create(devtools(store)) : create(store)
```
Wraps stores with DevTools middleware only in development mode. Reduces production bundle size and overhead.

---

## Summary

**Phase 1 Status:** Core infrastructure complete + 5 HIGH priority UI features (context viz, lazy loading, search panel, think mode toggle, concurrent messages).

**Phase 2 Focus:** Secondary features (export UI, terminal output, DevTools conditional).

**Coordination Points:**
- Search/Export: Requires CLAUDE-1 backend services first
- Concurrent messages: Requires CLAUDE-1 message tracking
- Think mode toggle: Requires CLAUDE-1 settings + process restart handler
- Terminal output: Uses existing webview messaging (no new backend needed)
