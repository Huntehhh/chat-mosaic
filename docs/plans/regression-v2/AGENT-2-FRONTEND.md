# Agent 2: Frontend React Improvements

> **Project**: `C:\HApps\claude-code-chat` (VS Code Extension)
> **Scope**: `src/webview/**/*` ONLY
> **Worktree**: Create with `git worktree add .worktrees/frontend-agent main`
> **Mode**: `--dangerously-skip-permissions` recommended for speed

---

## CRITICAL: Coordination Protocol

**Every 15-20 minutes**, check and update: `docs/plans/v2-regression/COORDINATION.md`

```bash
# Check for messages from other agents
cat docs/plans/v2-regression/COORDINATION.md

# Log your progress (append, don't overwrite)
echo "[$(date -Iseconds)] [AGENT_2] STATUS: Working on Task X" >> docs/plans/v2-regression/COORDINATION.md
```

---

## Your Mission

You are the **Frontend Specialist**. You have SOLE ownership of `src/webview/`. No other agent will touch these files. Your job is to:
1. Add ErrorBoundary for crash protection
2. Add accessibility (ARIA labels, focus traps) to all 6 modals
3. Wire setThinkingIntensity to send messages to backend
4. (Optional) Add React.lazy for performance

---

## Pre-Flight Checklist

```bash
# 1. Create isolated worktree
git worktree add .worktrees/frontend-agent -b feature/frontend-improvements main
cd .worktrees/frontend-agent

# 2. Verify your scope
ls src/webview/

# 3. Log start to coordination file
echo "[$(date -Iseconds)] [AGENT_2] STATUS: STARTED" >> docs/plans/v2-regression/COORDINATION.md
```

---

## Tasks (In Order)

### Task 1: Create ErrorBoundary Component (P1 Critical)

**Create**: `src/webview/components/ui/error-boundary.tsx`

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary-fallback" role="alert">
          <h2>Something went wrong</h2>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.message}</pre>
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Add export** in `src/webview/components/ui/index.ts`:
```typescript
export { ErrorBoundary } from './error-boundary';
```

### Task 2: Wrap App with ErrorBoundary

**Location**: `src/webview/App.tsx`

```typescript
import { ErrorBoundary } from './components/ui/error-boundary';

export function App() {
  return (
    <ErrorBoundary>
      {/* existing app content */}
    </ErrorBoundary>
  );
}
```

### Task 3: Add ARIA Labels to Modals

For EACH modal file, add accessibility attributes:

**Files to update**:
- `src/webview/components/settings-modal.tsx`
- `src/webview/components/mcp-servers-modal.tsx`
- `src/webview/components/slash-commands-modal.tsx`
- `src/webview/components/model-selector-modal.tsx`
- `src/webview/components/thinking-intensity-modal.tsx`
- `src/webview/components/history-panel.tsx`

**Pattern for each modal**:
```tsx
// Add to the modal container div:
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title-{name}"
  aria-describedby="modal-description-{name}"
>
  <h2 id="modal-title-{name}">Modal Title</h2>
  <p id="modal-description-{name}">Description of what this modal does</p>
  {/* existing content */}
</div>
```

### Task 4: Create useFocusTrap Hook

**Create**: `src/webview/hooks/useFocusTrap.ts`

```typescript
import { useEffect, useRef, useCallback } from 'react';

export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
    );
  }, []);

  useEffect(() => {
    if (!isActive) return;

    // Save current focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore previous focus
      previousFocusRef.current?.focus();
    };
  }, [isActive, getFocusableElements]);

  return containerRef;
}
```

### Task 5: Apply useFocusTrap to All Modals

**Example for settings-modal.tsx**:
```tsx
import { useFocusTrap } from '../hooks/useFocusTrap';

export function SettingsModal({ isOpen, onClose }) {
  const focusTrapRef = useFocusTrap(isOpen);

  if (!isOpen) return null;

  return (
    <div
      ref={focusTrapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <h2 id="settings-modal-title">Settings</h2>
      {/* existing content */}
    </div>
  );
}
```

Apply this pattern to all 6 modal files.

### Task 6: Add React.lazy for Modals (Optional Performance)

**Location**: `src/webview/App.tsx`

```typescript
import React, { Suspense, lazy } from 'react';

// Lazy load modals
const SettingsModal = lazy(() => import('./components/settings-modal'));
const McpServersModal = lazy(() => import('./components/mcp-servers-modal'));
const SlashCommandsModal = lazy(() => import('./components/slash-commands-modal'));

// In render:
<Suspense fallback={<div>Loading...</div>}>
  {showSettings && <SettingsModal />}
  {showMcp && <McpServersModal />}
</Suspense>
```

### Task 7: Wire setThinkingIntensity to Backend

**Location**: `src/webview/stores/settingsStore.ts` around line 158

```typescript
setThinkingIntensity: (intensity) => {
  set({ thinkingIntensity: intensity });

  // Also notify backend to persist
  const vscode = (window as any).vscode;
  if (vscode) {
    vscode.postMessage({
      type: 'setThinkingIntensity',
      intensity
    });
  }
},
```

---

## DO NOT TOUCH

- `src/extension.ts` - Agent 1's domain
- `src/services/**/*` - Agent 3's domain
- Any files not in `src/webview/`

---

## Completion Checklist

- [ ] Task 1: ErrorBoundary component created at `src/webview/components/ui/error-boundary.tsx`
- [ ] Task 1b: Export added to `src/webview/components/ui/index.ts`
- [ ] Task 2: App.tsx wrapped with ErrorBoundary
- [ ] Task 3: ARIA labels added to all 6 modals
- [ ] Task 4: useFocusTrap hook created at `src/webview/hooks/useFocusTrap.ts`
- [ ] Task 5: Focus trap applied to all 6 modals
- [ ] Task 6: (Optional) React.lazy added for modals
- [ ] Task 7: setThinkingIntensity wired to backend in settingsStore.ts
- [ ] Code compiles: `npm run compile`

---

## When Done

```bash
# 1. Log completion to coordination file
echo "[$(date -Iseconds)] [AGENT_2] COMPLETED: All tasks finished" >> docs/plans/v2-regression/COORDINATION.md

# 2. Commit your changes
git add src/webview/
git commit -m "feat: add accessibility (ARIA, focus traps) and ErrorBoundary"

# 3. Verify build
npm run compile

# 4. Log final status
echo "[$(date -Iseconds)] [AGENT_2] STATUS: Build verified, ready for merge" >> docs/plans/v2-regression/COORDINATION.md
```

**DO NOT** remove the worktree yet - wait for all agents to complete and coordinate merge order.

---

## Coordination File

All agents read/write to: `docs/plans/v2-regression/COORDINATION.md`

**Check it every 15-20 minutes** for:
- Questions from other agents
- Interface changes from Agent 1 (backend message types)
- Blockers to report

**Log format**:
```
[TIMESTAMP] [AGENT_2] STATUS: message
[TIMESTAMP] [AGENT_2] COMPLETED: task description
[TIMESTAMP] [AGENT_2] BLOCKED: description
[TIMESTAMP] [AGENT_2] [TO: AGENT_1] Q: question about backend handler
```

---

## Important Notes

- The `setThinkingIntensity` message you send (Task 7) will be received by the handler that Agent 1 creates (their Task 5)
- If Agent 1 asks about message format, the payload is: `{ type: 'setThinkingIntensity', intensity: 'think' | 'think_hard' | 'ultrathink' | 'none' }`
