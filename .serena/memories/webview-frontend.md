# Webview Frontend

## Technology Stack
- **React 18** with TypeScript
- **Zustand** for state management
- **Tailwind CSS** with custom theme
- **Framer Motion** for animations
- **Lucide React** for icons
- **markdown-to-jsx** for rendering

## State Management (Zustand)

### chatStore.ts
Primary chat state:
```typescript
interface ChatState {
  messages: Message[]
  isProcessing: boolean
  pendingPermissions: PermissionRequest[]
  pendingImages: PendingImage[]
  conversations: Conversation[]
  todos: TodoItem[]
  totalCost: number
  totalTokensInput: number
  totalTokensOutput: number
  // ... actions
}
```

### settingsStore.ts
Settings and preferences:
- Model selection
- Thinking mode
- WSL configuration
- Display options

### uiStore.ts
UI state:
- Active modal
- Sidebar visibility
- Theme preferences

## Component Structure (Atomic Design)

### Atoms (`components/atoms/`)
- `streaming-cursor.tsx` - Typing indicator
- `toast.tsx` - Notifications
- `tool-output-skeleton.tsx` - Loading state

### Molecules (`components/molecules/`)
- `code-block.tsx` - Syntax highlighted code
- `diff-view.tsx` - File diff display
- `tool-use-block.tsx` - Tool execution display
- `permission-card.tsx` - Permission requests
- `thinking-block.tsx` - Thinking mode display
- `todo-list.tsx` - Task list component

### Organisms (`components/organisms/`)
- `app-header.tsx` - Top navigation
- `chat-input.tsx` - Message input area
- `message-block.tsx` - Individual messages
- `settings-modal.tsx` - Settings dialog
- `mcp-servers-modal.tsx` - MCP configuration

### UI (`components/ui/`)
shadcn-style primitives:
- button, input, textarea
- badge, chip, dropdown
- toggle, separator

## Hooks

### Message Handlers (`hooks/handlers/`)
- `useChatHandlers.ts` - Message sending/receiving
- `useSessionHandlers.ts` - Session management
- `useTokenHandlers.ts` - Token usage tracking
- `useMcpHandlers.ts` - MCP operations

### Utility Hooks
- `useVSCodeMessaging.ts` - VS Code communication
- `useChatActions.ts` - Chat action composers
- `useModalHandlers.ts` - Modal state management

## Communication with Extension
Uses VS Code webview messaging:
```typescript
// Send to extension
vscode.postMessage({ type: 'sendMessage', text: '...' })

// Receive from extension
window.addEventListener('message', (event) => {
  const message = event.data
  // Handle message.type
})
```
