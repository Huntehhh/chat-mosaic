# CLAUDE-2: Frontend (Webview) - Phase 1 (HIGH Priority)

**Role:** React components, Zustand stores, hooks, core UI
**Test Framework:** VS Code Native Testing (@vscode/test-cli, assert)
**Coordination:** Check `CLAUDE-HANDOFF.md` before starting and after completing tasks

---

## Codebase Alignment Status (Updated 2026-01-04)

| Item | Status | Notes |
|------|--------|-------|
| H6: Permission State in Store | ✅ DONE | chatStore has `pendingPermissions` array (line 90) with full actions |
| ErrorBoundary | ✅ DONE | `components/ui/error-boundary.tsx` (108 lines, class component) |
| Virtual Scrolling | ✅ DONE | MessageList uses Virtuoso with infinite scroll, auto-follow |
| Message Types | ✅ DONE | `src/types/messages.ts` has comprehensive typed unions |
| Handler Split | ✅ DONE | `hooks/handlers/` has 7 handler files |
| useModalHandlers | ⚠️ LARGE | 282 lines - functional but could split if growing |
| useKeyboardShortcuts | ❌ NOT DONE | Hook doesn't exist |
| MCP Manager Panel | ✅ DONE | `mcp-manager-panel.tsx` exists |
| collapsible-card | ✅ EXISTS | Different from spec but works (framer-motion based) |

---

## Phase 1 Scope (REVISED)

**Core infrastructure is complete.** Phase 1 now includes **HIGH PRIORITY UI features**:

### Already Complete ✅
- ~~Permission state cleanup~~ ✅ DONE
- ~~ErrorBoundary~~ ✅ DONE
- ~~Virtual scrolling~~ ✅ DONE

### New Critical Features (HIGH Priority)
- **Context Window Visualization**: Enhanced token display with color-coded progress bar and tooltip
- **Lazy Loading for Tool Results**: Collapsible large outputs with preview/expand
- **Search Panel**: UI for conversation search (requires CLAUDE-1 backend)
- **Think Mode "Disabled" Option**: Toggle in modal to enable/disable thinking (coordinates with CLAUDE-1)
- **Concurrent Message Sending**: Stop/Send button layout, allow typing while processing, track pending messages

### Optional
- Optional: Split `useModalHandlers.ts` (only if it grows past 350 lines)
- Optional: Add `useKeyboardShortcuts.ts` hook
- Add handlers for new message types (coordinate with CLAUDE-1)

---

## Your Files (You Own These)

```
src/webview/stores/
├── chatStore.ts          # ✅ Has pendingPermissions, 349 lines
└── settingsStore.ts      # ✅ Has permissions, yoloMode, mcp servers, 326 lines

src/webview/hooks/
├── useVSCodeMessaging.ts  # ✅ Handles incoming/outgoing messages
├── useModalHandlers.ts    # ⚠️ 282 lines - works but large
├── useAdaptiveLayout.ts   # ✅ Responsive layout
├── useChatActions.ts      # ✅ Chat operations
├── useFocusTrap.ts        # ✅ Focus management
├── useMarkdownCopy.ts     # ✅ Copy functionality
├── useKeyboardShortcuts.ts # ❌ MISSING
└── handlers/              # ✅ Well-organized (7 files)
    ├── index.ts
    ├── useChatHandlers.ts
    ├── useFileHandlers.ts
    ├── useMcpHandlers.ts
    ├── useSessionHandlers.ts
    ├── useSettingsHandlers.ts
    ├── useTokenHandlers.ts
    └── useUiHandlers.ts

src/webview/components/
├── ui/
│   ├── error-boundary.tsx  # ✅ Exists (108 lines)
│   └── [other ui components]
├── molecules/
│   ├── collapsible-card.tsx # ✅ Exists (121 lines, framer-motion)
│   └── [other molecules]
└── organisms/
    ├── mcp-manager-panel.tsx # ✅ Exists
    └── [other organisms]

src/webview/containers/
└── MessageList.tsx         # ✅ Uses Virtuoso with all features

src/types/
└── messages.ts             # ✅ Has typed message unions (300+ lines)
```

---

## What's Already Working

### 1. Permission State in chatStore ✅

**File:** `src/webview/stores/chatStore.ts:90`

Already implemented with:
- `pendingPermissions: PermissionRequest[]`
- `addPendingPermission(request)`
- `updatePermissionStatus(id, status)`
- `removePendingPermission(id)`
- `clearPendingPermissions()`

**No changes needed.**

---

### 2. ErrorBoundary ✅

**File:** `src/webview/components/ui/error-boundary.tsx` (108 lines)

Class component with:
- `getDerivedStateFromError` for catching errors
- `componentDidCatch` for logging
- Collapsible error details view
- Reset button to recover

**No changes needed.**

---

### 3. Virtual Scrolling with Virtuoso ✅

**File:** `src/webview/containers/MessageList.tsx`

Full implementation with:
- `startReached` for loading older messages (infinite scroll up)
- `atBottomStateChange` for auto-follow tracking
- `followOutput` for smooth auto-scroll on new messages
- Debounced scroll position saving (500ms)
- Loading indicator header
- `hasMoreMessages` pagination support

**No changes needed.**

---

### 4. Message Types ✅

**File:** `src/types/messages.ts` (300+ lines)

Comprehensive typed system:
- `WebviewToExtensionMessage` union (15+ request types)
- `ExtensionToWebviewMessage` union (all response types)
- `PermissionRequest` interface
- `StreamingMessageUpdate` interface
- All payload types defined

**No changes needed to structure.**

---

### 5. Handler Organization ✅

**Directory:** `src/webview/hooks/handlers/` (7 files)

Already split by domain:
- `useChatHandlers.ts` - Chat operations
- `useFileHandlers.ts` - File/image handling
- `useMcpHandlers.ts` - MCP server operations
- `useSessionHandlers.ts` - Session management
- `useSettingsHandlers.ts` - Settings operations
- `useTokenHandlers.ts` - Token/cost tracking
- `useUiHandlers.ts` - UI state management

**No changes needed.**

---

## Optional Improvements

### Split useModalHandlers.ts (Optional - Only if Growing)

**Current:** 282 lines - returns 27 handlers + state
**Threshold:** Consider splitting if grows past 350 lines

If splitting becomes necessary:
```
hooks/modal-handlers/
├── index.ts                    # Re-exports all
├── useHeaderModalHandlers.ts   # Settings, History, Rename
├── useSettingsModalHandlers.ts # WSL, paths, yolo mode
├── useMcpModalHandlers.ts      # MCP server operations
└── useHistoryModalHandlers.ts  # Conversation selection
```

**Decision:** Leave as-is unless it grows significantly.

---

### Add useKeyboardShortcuts.ts (Optional)

**Create if needed:** `src/webview/hooks/useKeyboardShortcuts.ts`

```typescript
import { useEffect, useCallback, useRef } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]): void {
  const handlersRef = useRef(shortcuts);
  handlersRef.current = shortcuts;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    for (const shortcut of handlersRef.current) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
      const shiftMatch = !!shortcut.shift === e.shiftKey;
      const altMatch = !!shortcut.alt === e.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        e.preventDefault();
        shortcut.handler();
        return;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
```

---

### Handle New Message Types from CLAUDE-3

**Add to useVSCodeMessaging.ts when facades are implemented:**

```typescript
case 'processExited':
  chatStore.setProcessingState(false);
  break;

case 'permissionDenied':
  chatStore.updatePermissionStatus(msg.requestId, 'denied');
  break;

case 'bufferOverflow':
  console.warn('Stream buffer overflow');
  // Could show toast notification
  break;
```

---

## Unit Tests

### Existing Tests Structure

```
src/test/
├── extension.test.ts        # Main extension tests
└── services/
    ├── StreamBuffer.test.ts
    ├── PermissionsManager.test.ts
    └── ConversationManager.test.ts
```

### Recommended Additional Tests (if implementing new features)

```typescript
// useKeyboardShortcuts.test.ts
describe('useKeyboardShortcuts', () => {
  test('should trigger handler on matching shortcut', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'k', ctrl: true, handler }
    ]));

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(handler).toHaveBeenCalled();
  });

  test('should not trigger on partial match', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'k', ctrl: true, shift: true, handler }
    ]));

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); // missing shift
    expect(handler).not.toHaveBeenCalled();
  });
});
```

---

## Build & Test Commands

```bash
# Compile TypeScript
npm run compile

# Run tests
npm test

# Watch mode (if configured)
npm run watch
```

---

## Phase 1 Definition of Done

### Already Complete ✅
- [x] H6: Permission state in chatStore with full actions
- [x] ErrorBoundary component implemented (108 lines)
- [x] Virtual scrolling with Virtuoso (infinite scroll, auto-follow)
- [x] Typed message system in src/types/messages.ts
- [x] Handler modules organized in hooks/handlers/ (7 files)
- [x] MCP Manager Panel exists

### New Critical Features ❌
- [ ] Context Window Visualization: Enhance `token-display.tsx` with tooltip and color-coded bar
- [ ] Lazy Loading: Create `CollapsibleContent` component for large tool outputs
- [ ] Search Panel: Create `search-panel.tsx` (requires CLAUDE-1 ConversationSearchService)
- [ ] Think Mode Toggle: Update `think-intensity-slider.tsx` with disabled toggle
- [ ] Think Mode Toggle: Update `thinking-intensity-modal.tsx` to handle disabled state
- [ ] Think Mode Toggle: Add `setThinkingDisabled` message type
- [ ] Concurrent Messages: Update `chat-input.tsx` (stop button left, remove disabled state)
- [ ] Concurrent Messages: Update `useChatActions.ts` (generate message IDs, track pending)
- [ ] Concurrent Messages: Add pending message tracking to `chatStore.ts`
- [ ] Concurrent Messages: Handle `messageAck` in `useVSCodeMessaging.ts`

### Optional/Remaining
- [ ] Split useModalHandlers.ts if it grows past 350 lines
- [ ] Add useKeyboardShortcuts.ts if keyboard shortcuts needed
- [ ] No TypeScript errors (`npm run compile`)

---

## COMPREHENSIVE MODULARIZATION (From Codebase Analysis)

### CRITICAL: Split Large Components & Stores

#### 1. Split chatStore.ts (348 lines → 4 smaller stores)

**Problem:** Single store managing messages, conversations, tokens, todos, permissions (80+ actions)

**Solution:** Split by domain

```
src/webview/stores/
├── chatStore.ts (refactor to ~180 lines)
│   └─ messages, conversations, activeConversation only
├── tokenStore.ts (new - ~80 lines)
│   └─ totalTokensInput/Output, totalCost, context tracking
├── permissionStore.ts (new - ~70 lines)
│   └─ Pending permissions, status updates
└── conversationMetaStore.ts (new - ~100 lines)
    └─ History, conversation metadata, todos
```

**Action Items:**
- [ ] Create tokenStore.ts with token/cost state
- [ ] Create permissionStore.ts with pending permissions
- [ ] Create conversationMetaStore.ts with history/metadata
- [ ] Refactor chatStore.ts to only handle messages
- [ ] Update components to import from new stores

#### 2. Split settingsStore.ts (325 lines → 3 smaller stores)

**Problem:** Manages theme, thinking modes, tool preview, MCP servers, permissions (50+ actions)

**Solution:** Split by concern

```
src/webview/stores/
├── settingsStore.ts (refactor to ~150 lines)
│   └─ Display + UX settings only (theme, auto-scroll, etc.)
├── toolPreviewStore.ts (new - ~80 lines)
│   └─ Tool category + preview line config
└── mcpStore.ts (new - ~100 lines)
    └─ MCP server configs + enabled/disabled state
```

**Action Items:**
- [ ] Create toolPreviewStore.ts
- [ ] Create mcpStore.ts
- [ ] Refactor settingsStore.ts to only UI settings
- [ ] Update MCP components to use mcpStore

#### 3. Extract tool-use-block.tsx (491 lines → 5 subcomponents)

**Problem:** Handles 6+ tool types with different rendering (Bash, Read, Write, Edit, MCP, Task)

**Solution:** Create tool-specific blocks

```
src/webview/components/molecules/tool-blocks/
├── index.ts
├── BashToolBlock.tsx (~80 lines)
├── FileToolBlock.tsx (~100 lines - Read/Write/Edit)
├── McpToolBlock.tsx (~80 lines)
├── TaskToolBlock.tsx (~60 lines)
└── tool-use-block.tsx (main dispatcher, ~200 lines)
```

**Action Items:**
- [ ] Create tool-blocks/ subfolder
- [ ] Extract BashToolBlock component
- [ ] Extract FileToolBlock component (handles Read/Write/Edit)
- [ ] Extract McpToolBlock component
- [ ] Extract TaskToolBlock component
- [ ] Refactor main tool-use-block.tsx to dispatch to subcomponents

#### 4. Split settings-modal.tsx (325 lines → 5 tab components)

**Problem:** Single modal with 4+ sections, 20+ props

**Solution:** Split by tab

```
src/webview/components/organisms/settings/
├── index.ts
├── SettingsModal.tsx (~100 lines - tab wrapper)
├── WslSettingsTab.tsx (~80 lines)
├── PermissionsTab.tsx (~100 lines)
├── DisplayTab.tsx (~80 lines)
└── McpTab.tsx (~80 lines)
```

**Action Items:**
- [ ] Create settings/ subfolder
- [ ] Extract WslSettingsTab component
- [ ] Extract PermissionsTab component
- [ ] Extract DisplayTab component
- [ ] Extract McpTab component
- [ ] Refactor SettingsModal to tab container

#### 5. Simplify App.tsx (318 lines → ~120 lines)

**Problem:** Initializes 5+ hooks, reads from 3 stores, renders 7+ modals

**Solution:** Extract layout and modal management

```
src/webview/components/
├── layouts/
│   └── ChatLayout.tsx (~80 lines - Header + MessageList + Input)
├── organisms/
│   └── ModalContainer.tsx (~100 lines - All 7 lazy modals + state)
└── App.tsx (refactor to ~120 lines - just hook init + Layout + ModalContainer)
```

**Action Items:**
- [ ] Create layouts/ChatLayout.tsx
- [ ] Create organisms/ModalContainer.tsx
- [ ] Refactor App.tsx to orchestrator only
- [ ] Move modal state management to ModalContainer

#### 6. Split mcp-formatter.ts (574 lines → 5 formatter files)

**Problem:** Single file handling JSON, HTML, text sanitization, Markdown

**Solution:** Split by format type

```
src/webview/lib/formatters/
├── index.ts
├── mcp-formatter.ts (main dispatcher, ~200 lines)
├── json-formatter.ts (~100 lines)
├── html-formatter.ts (~150 lines)
├── text-sanitizer.ts (~80 lines)
└── markdown-helpers.ts (~100 lines)
```

**Action Items:**
- [ ] Create lib/formatters/ subfolder
- [ ] Extract json-formatter.ts
- [ ] Extract html-formatter.ts
- [ ] Extract text-sanitizer.ts
- [ ] Extract markdown-helpers.ts
- [ ] Refactor main mcp-formatter.ts to dispatcher

---

### Reorganize Webview Components

#### 1. Rename ui/ to primitives/ (QUICK WIN)

**Current:** `src/webview/components/ui/` - confusing name
**Proposed:** `src/webview/components/primitives/` - clearer purpose

**Action Items:**
- [ ] Rename ui/ folder to primitives/
- [ ] Update all imports from '@/components/ui' to '@/components/primitives'
- [ ] Update barrel exports

#### 2. Organize molecules/ by domain (48 files → 7 subfolders)

**Current:** 32 molecules in flat structure
**Problem:** No domain grouping - hard to find related components

**Proposed Structure:**
```
src/webview/components/molecules/
├── index.ts
├── messaging/
│   ├── CodeBlock.tsx
│   ├── ImageAttachment.tsx
│   ├── ThinkingBlock.tsx
│   ├── TinkeringIndicator.tsx
│   └── index.ts
├── mcp/
│   ├── McpServerCard.tsx
│   ├── ServerCard.tsx
│   └── index.ts
├── permissions/
│   ├── PermissionBanner.tsx
│   ├── PermissionCard.tsx
│   └── index.ts
├── forms/
│   ├── FormField.tsx
│   ├── ChipInput.tsx
│   ├── SearchInput.tsx
│   ├── ThinkIntensitySlider.tsx
│   └── index.ts
├── cards/
│   ├── CollapsibleCard.tsx
│   ├── QuestionCard.tsx
│   ├── ConversationItem.tsx
│   └── index.ts
├── utils/
│   ├── FileMention.tsx
│   ├── SnippetButton.tsx
│   └── index.ts
└── legacy/ (deprecating)
    ├── DeleteConfirmDialog.tsx
    ├── TodoList.tsx
    └── index.ts
```

**Action Items:**
- [ ] Create domain subfolders (messaging/, mcp/, permissions/, forms/, cards/, utils/, legacy/)
- [ ] Move components to appropriate folders
- [ ] Update barrel exports
- [ ] Update all component imports

#### 3. Organize organisms/ by feature (16 files → 4 subfolders)

**Proposed Structure:**
```
src/webview/components/organisms/
├── index.ts
├── chat/
│   ├── ChatInput.tsx
│   ├── MessageBlock.tsx
│   └── index.ts
├── sidebar/
│   ├── AppHeader.tsx
│   ├── HistoryPanel.tsx
│   └── index.ts
├── modals/
│   ├── SettingsModal.tsx
│   ├── McpServersModal.tsx
│   ├── ModelSelectorModal.tsx
│   ├── ThinkingIntensityModal.tsx
│   ├── SlashCommandsModal.tsx
│   └── index.ts
└── panels/
    ├── McpManagerPanel.tsx
    ├── McpServerList.tsx
    ├── McpEditorForm.tsx
    ├── ThinkingOverlay.tsx
    └── index.ts
```

**Action Items:**
- [ ] Create feature subfolders (chat/, sidebar/, modals/, panels/)
- [ ] Move MessageList.tsx from containers/ to organisms/chat/
- [ ] Move components to appropriate folders
- [ ] Update barrel exports
- [ ] Update all component imports

---

### Remove Duplicate Code

#### 1. Remove Duplicate Handlers (15 lines saved)

**Problem:** Duplicate handlers in `useFileHandlers.ts`:

```typescript
customSnippets: (data) => setCustomSnippets(data),
customSnippetsData: (data) => setCustomSnippets(data),  // ← DUPLICATE

checkpoints: (data) => setCommits(data),
checkpointsList: (data) => setCommits(data),  // ← DUPLICATE
```

**Action Items:**
- [ ] Remove `customSnippetsData` handler
- [ ] Remove `checkpointsList` handler
- [ ] Update message type documentation

#### 2. Simplify useVSCodeMessaging.ts (435 lines → ~280 lines)

**Problem:** 30+ message handlers in single Map, registration logic mixed with handling

**Solution:** Extract handler registration

```
src/webview/hooks/messaging/
├── index.ts
├── useVSCodeMessaging.ts (refactor to ~150 lines - core listener only)
├── messageHandlers.ts (~80 lines - build handler map)
└── handlerRegistry.ts (~50 lines - registration logic)
```

**Action Items:**
- [ ] Create messaging/ subfolder
- [ ] Extract handler map building to messageHandlers.ts
- [ ] Extract registration logic to handlerRegistry.ts
- [ ] Refactor useVSCodeMessaging to core listener only

---

### Delete Dead Code

**Action Items:**
- [ ] Delete `src/ui/` folder (9.9 MB of Stitch design exports - NOT USED)
- [ ] Verify no imports from ui/ before deletion
- [ ] Remove from .gitignore if present

---

## Phase 1 Priority Summary

**Quick Wins (Do First):**
1. Rename ui/ to primitives/ (5 minutes, improves clarity)
2. Delete src/ui/ folder (5 minutes, saves 9.9 MB)
3. Remove duplicate handlers (15 minutes, saves 15 LOC)

**High Impact (Do Next):**
4. Split chatStore into 4 domain stores (3-4 hours, improves organization)
5. Extract tool-use-block into subcomponents (3-4 hours, reduces from 491 to ~200 lines)
6. Split settings-modal into tabs (2-3 hours, reduces from 325 to ~100 lines)
7. Organize molecules/ by domain (2-3 hours, 40% easier navigation)

**After Phase 1 completion, proceed to CLAUDE-2-FRONTEND-PHASE-2.md for secondary features.**
