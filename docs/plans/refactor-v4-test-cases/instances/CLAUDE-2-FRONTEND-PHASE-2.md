# CLAUDE-2: Frontend (Webview) - Phase 2 (MEDIUM/LOW Priority)

**Role:** Frontend features, UI improvements, integrations
**Test Framework:** VS Code Native Testing (@vscode/test-cli, assert)
**Prerequisite:** Complete Phase 1 first

---

## Codebase Alignment Status (Updated 2026-01-04)

| Item | Status | Notes |
|------|--------|-------|
| Export Dialog | ❌ NOT DONE | `export-dialog.tsx` doesn't exist |
| Terminal Output | ❌ NOT DONE | `terminal-output.tsx` doesn't exist |
| Zustand DevTools | ⚠️ CHECK | May need conditional setup |
| Message Types | ✅ DONE | `src/types/messages.ts` comprehensive |

**Moved to Phase 1:** Context Window Viz, Collapsible Content, Search Panel, Think Mode Toggle, Concurrent Messages

---

## Phase 2 Scope

This phase covers **secondary features and polish**:
- Conversation Export UI (coordinate with CLAUDE-1)
- Terminal integration UI (coordinate with CLAUDE-3)
- Zustand DevTools conditional (M2)

**Note:** The following were moved to Phase 1 due to HIGH priority:
- ~~Context window visualization enhancements~~ → PHASE 1
- ~~Lazy loading for large tool outputs~~ → PHASE 1
- ~~Conversation Search UI~~ → PHASE 1
- ~~Think Mode "Disabled" Option~~ → PHASE 1
- ~~Concurrent Message Sending~~ → PHASE 1

---

## Context Window Visualization (Enhancement)

**Existing:** `src/webview/components/ui/token-display.tsx`
**Enhancement:** Add tooltip with detailed breakdown

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { Progress } from './progress';
import { cn } from '../../lib/utils';

interface ContextLevel {
  level: 'low' | 'medium' | 'high' | 'critical';
  color: string;
  bgColor: string;
}

const LEVEL_CONFIG: Record<string, ContextLevel> = {
  low: { level: 'low', color: 'text-green-600', bgColor: 'bg-green-500' },
  medium: { level: 'medium', color: 'text-yellow-600', bgColor: 'bg-yellow-500' },
  high: { level: 'high', color: 'text-orange-600', bgColor: 'bg-orange-500' },
  critical: { level: 'critical', color: 'text-red-600', bgColor: 'bg-red-500' }
};

export function ContextWindowIndicator() {
  const contextPercentage = useChatStore(state => state.contextPercentage);
  const contextTokens = useChatStore(state => state.contextTokens);

  const level = contextPercentage > 90 ? 'critical'
    : contextPercentage > 75 ? 'high'
    : contextPercentage > 50 ? 'medium'
    : 'low';

  const config = LEVEL_CONFIG[level];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 cursor-help">
          <div className="relative w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full transition-all duration-300', config.bgColor)}
              style={{ width: `${contextPercentage}%` }}
            />
          </div>
          <span className={cn('text-xs font-medium', config.color)}>
            {contextPercentage}%
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="w-64">
        <div className="space-y-2 text-sm">
          <div className="font-medium">Context Window Usage</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tokens used:</span>
            <span>{contextTokens.toLocaleString()}</span>
          </div>
          {contextPercentage > 80 && (
            <div className="text-yellow-600 text-xs mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
              Context is nearly full. Consider starting a new session.
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
```

---

## Lazy Loading for Tool Results

**Note:** `collapsible-card.tsx` exists (121 lines, framer-motion based)
**Create if different behavior needed:** `src/webview/components/molecules/collapsible-content.tsx`

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CollapsibleContentProps {
  content: string;
  maxLines?: number;
  maxLength?: number;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CollapsibleContent({
  content,
  maxLines = 10,
  maxLength = 2000,
  className
}: CollapsibleContentProps) {
  const [expanded, setExpanded] = useState(false);

  const shouldCollapse = content.length > maxLength ||
    content.split('\n').length > maxLines;

  if (!shouldCollapse) {
    return <pre className={cn('whitespace-pre-wrap', className)}>{content}</pre>;
  }

  const preview = expanded
    ? content
    : content.slice(0, maxLength).split('\n').slice(0, maxLines).join('\n');

  return (
    <div className={className}>
      <pre className="whitespace-pre-wrap">
        {preview}
        {!expanded && '...'}
      </pre>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <>
            <ChevronDown className="w-4 h-4" />
            Show less
          </>
        ) : (
          <>
            <ChevronRight className="w-4 h-4" />
            Show full output ({formatBytes(content.length)})
          </>
        )}
      </button>
    </div>
  );
}
```

---

## Conversation Search UI

**Status:** ❌ NOT DONE
**Create:** `src/webview/components/organisms/search-panel.tsx`
**Dependency:** CLAUDE-1 must create ConversationSearchService first

```tsx
import { useState, useCallback, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { useVSCodeMessaging } from '../../hooks/useVSCodeMessaging';

interface SearchResult {
  sessionId: string;
  messageId: string;
  snippet: string;
  timestamp: number;
  chatName?: string;
}

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { postMessage } = useVSCodeMessaging();

  const handleSearch = useCallback(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    postMessage({ type: 'searchConversations', query: query.trim() });
  }, [query, postMessage]);

  // Wire up search results handler in useVSCodeMessaging
  // case 'searchResults': setResults(msg.data); setIsSearching(false);

  const handleSelectResult = (result: SearchResult) => {
    postMessage({
      type: 'loadConversation',
      sessionId: result.sessionId,
      scrollToMessage: result.messageId
    });
  };

  return (
    <div className="search-panel p-4 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search conversations..."
          className="pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {isSearching && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </div>
          <div className="space-y-1">
            {results.map((result) => (
              <button
                key={`${result.sessionId}-${result.messageId}`}
                onClick={() => handleSelectResult(result)}
                className="w-full text-left p-3 rounded-md hover:bg-muted transition-colors"
              >
                <div className="font-medium text-sm">{result.chatName || 'Untitled'}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {result.snippet}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Conversation Export UI

**Status:** ❌ NOT DONE
**Create:** `src/webview/components/molecules/export-dialog.tsx`
**Dependency:** CLAUDE-1 must create ExportService first

```tsx
import { useState } from 'react';
import { Download, FileText, Code, Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useVSCodeMessaging } from '../../hooks/useVSCodeMessaging';
import { useChatStore } from '../../stores/chatStore';
import { cn } from '../../lib/utils';

type ExportFormat = 'markdown' | 'json' | 'html';

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: React.ReactNode }[] = [
  { value: 'markdown', label: 'Markdown (.md)', icon: <FileText className="w-4 h-4" /> },
  { value: 'json', label: 'JSON (.json)', icon: <Code className="w-4 h-4" /> },
  { value: 'html', label: 'HTML (.html)', icon: <Globe className="w-4 h-4" /> },
];

export function ExportDialog() {
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [isExporting, setIsExporting] = useState(false);
  const { postMessage } = useVSCodeMessaging();
  const chatName = useChatStore(state => state.chatName);

  const handleExport = () => {
    setIsExporting(true);
    postMessage({
      type: 'exportConversation',
      format,
      filename: `${chatName || 'conversation'}.${format === 'markdown' ? 'md' : format}`
    });
    setTimeout(() => setIsExporting(false), 1000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Conversation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Format</label>
            <div className="grid grid-cols-1 gap-2">
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormat(option.value)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-md border transition-colors',
                    format === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  {option.icon}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleExport} disabled={isExporting} className="w-full">
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Terminal Integration UI

**Status:** ❌ NOT DONE
**Create:** `src/webview/components/molecules/terminal-output.tsx`
**Dependency:** CLAUDE-3 must implement TerminalFacade first

```tsx
import { useState } from 'react';
import { Terminal, Copy, ExternalLink, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useVSCodeMessaging } from '../../hooks/useVSCodeMessaging';

interface TerminalOutputProps {
  command: string;
  output: string;
  exitCode?: number;
  cwd?: string;
}

export function TerminalOutput({ command, output, exitCode, cwd }: TerminalOutputProps) {
  const [copied, setCopied] = useState(false);
  const { postMessage } = useVSCodeMessaging();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInTerminal = () => {
    postMessage({ type: 'openInTerminal', command, cwd });
  };

  const isSuccess = exitCode === 0;
  const isError = exitCode !== undefined && exitCode !== 0;

  return (
    <div className="terminal-output rounded-md border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <code className="text-sm font-mono">{command}</code>
        </div>
        <div className="flex items-center gap-1">
          {exitCode !== undefined && (
            <span className={cn(
              'px-2 py-0.5 rounded text-xs',
              isSuccess && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
              isError && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            )}>
              exit {exitCode}
            </span>
          )}
          <button onClick={handleCopy} className="p-1.5 rounded hover:bg-muted" title="Copy">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
          </button>
          <button onClick={handleOpenInTerminal} className="p-1.5 rounded hover:bg-muted" title="Run in terminal">
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
      <pre className="p-3 text-sm font-mono overflow-x-auto bg-zinc-900 text-zinc-100">
        {output}
      </pre>
    </div>
  );
}
```

---

## M2. Zustand DevTools Conditional

**Update:** `src/webview/stores/chatStore.ts`

```typescript
import { create, StateCreator } from 'zustand';
import { devtools } from 'zustand/middleware';

const isDev = process.env.NODE_ENV === 'development';

// Wrapper for conditional devtools
function createStore<T>(
  name: string,
  initializer: StateCreator<T>
) {
  return isDev
    ? create(devtools(initializer, { name }))
    : create(initializer);
}

export const useChatStore = createStore<ChatState>('chatStore', (set, get) => ({
  // ... state and actions
}));
```

**Apply same pattern to settingsStore.**

---

## Wire Up Message Types

**Add handlers in useVSCodeMessaging.ts:**

```typescript
// Search results from ConversationSearchService
case 'searchResults':
  // Update search panel state
  break;

// Export completion
case 'exportComplete':
  // Show success toast
  break;

// Terminal opened
case 'terminalOpened':
  // Optional: track terminal state
  break;
```

---

## Phase 2 Definition of Done

### Features to Create
- [ ] Context window visualization enhanced with tooltip
- [ ] CollapsibleContent component (if different from collapsible-card)
- [ ] SearchPanel component (after CLAUDE-1 creates ConversationSearchService)
- [ ] ExportDialog component (after CLAUDE-1 creates ExportService)
- [ ] TerminalOutput component (after CLAUDE-3 creates TerminalFacade)
- [ ] M2: Zustand DevTools conditional in both stores

### Message Handlers
- [ ] Wire searchResults handler
- [ ] Wire exportComplete handler
- [ ] Wire terminalOpened handler (optional)

### Testing
- [ ] Component tests for new UI
- [ ] All tests passing
- [ ] No TypeScript errors

**Coordinate with CLAUDE-1 for Search/Export service integration.**
**Coordinate with CLAUDE-3 for Terminal facade wiring.**

---

## NEW FEATURE: Think Modal "Disabled" Option

**Priority:** HIGH
**Status:** ❌ NOT DONE
**Files to modify:**
- `src/webview/components/molecules/think-intensity-slider.tsx`
- `src/webview/components/organisms/thinking-intensity-modal.tsx`
- `src/webview/stores/settingsStore.ts`
- `src/types/messages.ts` (add new message type)

### Overview

The current thinking modal allows selecting intensity levels (Think → Ultra). Need to add a "Disabled" option at the very beginning that completely turns off thinking mode. When toggled:
1. Update `.claude/settings.local.json` with `alwaysThinkingEnabled: false/true`
2. Close and reopen the Claude terminal process to apply the setting

### 1. Extend ThinkingIntensity Type

**File:** `src/webview/stores/settingsStore.ts`

```typescript
// Update type definition (around line 10)
export type ThinkingIntensity = 'disabled' | 'think' | 'think-hard' | 'think-harder' | 'ultrathink';

// Update default value if thinking is off
thinkingIntensity: 'think-hard',  // Keep existing default
```

### 2. Update Think Intensity Slider

**File:** `src/webview/components/molecules/think-intensity-slider.tsx`

Add a "Disabled" toggle/option BEFORE the slider:

```tsx
import { useState } from 'react';
import { cn } from '../../lib/utils';

// Extended levels (add disabled as level -1 conceptually, or use separate toggle)
type ThinkLevel = 0 | 1 | 2 | 3;

interface ThinkIntensitySliderProps {
  value: ThinkLevel;
  isDisabled: boolean;  // NEW: Whether thinking is completely disabled
  onChange: (value: ThinkLevel) => void;
  onDisabledChange: (disabled: boolean) => void;  // NEW: Toggle callback
  showConfirm?: boolean;
  onConfirm?: () => void;
}

export function ThinkIntensitySlider({
  value,
  isDisabled,
  onChange,
  onDisabledChange,
  showConfirm = true,
  onConfirm
}: ThinkIntensitySliderProps) {
  const labels = ['Think', 'Hard', 'Harder', 'Ultra'];

  return (
    <div className="space-y-4">
      {/* Disabled Toggle - NEW */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div>
          <div className="font-medium text-sm">Enable Thinking</div>
          <div className="text-xs text-muted-foreground">
            When disabled, Claude won't use extended thinking
          </div>
        </div>
        <button
          onClick={() => onDisabledChange(!isDisabled)}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors',
            isDisabled ? 'bg-muted' : 'bg-orange-500'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
              !isDisabled && 'translate-x-5'
            )}
          />
        </button>
      </div>

      {/* Intensity Slider - Only show when enabled */}
      {!isDisabled && (
        <>
          <div className="text-sm font-medium">Intensity Level</div>
          <div className="relative pt-2 pb-4">
            {/* Existing slider implementation */}
            <input
              type="range"
              min={0}
              max={3}
              value={value}
              onChange={(e) => onChange(Number(e.target.value) as ThinkLevel)}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #FFA344 0%, #FFA344 ${(value / 3) * 100}%, var(--muted) ${(value / 3) * 100}%, var(--muted) 100%)`
              }}
            />
            <div className="flex justify-between mt-2">
              {labels.map((label, i) => (
                <button
                  key={label}
                  onClick={() => onChange(i as ThinkLevel)}
                  className={cn(
                    'text-xs px-2 py-1 rounded transition-colors',
                    value === i
                      ? 'text-orange-600 font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Higher = deeper reasoning, more tokens
          </p>
        </>
      )}

      {showConfirm && (
        <button
          onClick={onConfirm}
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Confirm
        </button>
      )}
    </div>
  );
}
```

### 3. Update Thinking Intensity Modal

**File:** `src/webview/components/organisms/thinking-intensity-modal.tsx`

```tsx
// Update the modal to handle disabled state

import { useCallback, useState, useEffect } from 'react';
import { ThinkIntensitySlider } from '../molecules/think-intensity-slider';
import { useSettingsStore } from '../../stores/settingsStore';
import { useVSCodeMessaging } from '../../hooks/useVSCodeMessaging';

type ThinkLevel = 0 | 1 | 2 | 3;
type ThinkingIntensity = 'disabled' | 'think' | 'think-hard' | 'think-harder' | 'ultrathink';

const INTENSITY_TO_LEVEL: Record<ThinkingIntensity, ThinkLevel> = {
  'disabled': 0,  // Not used for slider, but mapped
  'think': 0,
  'think-hard': 1,
  'think-harder': 2,
  'ultrathink': 3,
};

const LEVEL_TO_INTENSITY: Record<ThinkLevel, ThinkingIntensity> = {
  0: 'think',
  1: 'think-hard',
  2: 'think-harder',
  3: 'ultrathink',
};

interface ThinkingIntensityModalProps {
  open: boolean;
  onClose: () => void;
  currentIntensity: ThinkingIntensity;
  onConfirm: (intensity: ThinkingIntensity) => void;
}

export function ThinkingIntensityModal({
  open,
  onClose,
  currentIntensity,
  onConfirm
}: ThinkingIntensityModalProps) {
  const { postMessage } = useVSCodeMessaging();

  const isCurrentlyDisabled = currentIntensity === 'disabled';
  const [isDisabled, setIsDisabled] = useState(isCurrentlyDisabled);
  const [level, setLevel] = useState<ThinkLevel>(
    isCurrentlyDisabled ? 1 : INTENSITY_TO_LEVEL[currentIntensity]
  );

  useEffect(() => {
    if (open) {
      setIsDisabled(currentIntensity === 'disabled');
      setLevel(currentIntensity === 'disabled' ? 1 : INTENSITY_TO_LEVEL[currentIntensity]);
    }
  }, [open, currentIntensity]);

  const handleConfirm = useCallback(() => {
    const newIntensity: ThinkingIntensity = isDisabled ? 'disabled' : LEVEL_TO_INTENSITY[level];
    onConfirm(newIntensity);

    // Send message to backend to update .claude/settings.local.json
    // and restart the Claude process
    postMessage({
      type: 'setThinkingDisabled',
      disabled: isDisabled,
      intensity: isDisabled ? undefined : LEVEL_TO_INTENSITY[level],
      restartProcess: true  // Signal to close and reopen Claude terminal
    });

    onClose();
  }, [isDisabled, level, onConfirm, onClose, postMessage]);

  const handleDisabledChange = useCallback((disabled: boolean) => {
    setIsDisabled(disabled);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border rounded-lg shadow-lg p-6 w-80 max-w-[90vw]">
        <h2 className="text-lg font-semibold mb-4">Thinking Mode</h2>
        <ThinkIntensitySlider
          value={level}
          isDisabled={isDisabled}
          onChange={setLevel}
          onDisabledChange={handleDisabledChange}
          showConfirm
          onConfirm={handleConfirm}
        />
      </div>
    </div>
  );
}
```

### 4. Add Message Type

**File:** `src/types/messages.ts`

```typescript
// Add to WebviewToExtensionMessage union
| {
    type: 'setThinkingDisabled';
    disabled: boolean;
    intensity?: ThinkingIntensity;
    restartProcess: boolean;
  }
```

### 5. Coordinate with CLAUDE-1

The backend needs to:
1. Handle `setThinkingDisabled` message
2. Write to `.claude/settings.local.json`:
   - Set `alwaysThinkingEnabled: false` when disabled
   - Set `alwaysThinkingEnabled: true` when enabled
3. Close and reopen the Claude terminal process

---

## NEW FEATURE: Concurrent Message Sending

**Priority:** HIGH
**Status:** ❌ NOT DONE
**Files to modify:**
- `src/webview/components/organisms/chat-input.tsx`
- `src/webview/stores/chatStore.ts`
- `src/webview/hooks/useChatActions.ts`
- `src/types/messages.ts`

### Overview

Currently, the UI blocks input while Claude is processing. Need to:
1. Move stop button to LEFT of send button (both always visible)
2. Allow typing and sending while Claude is still responding
3. Track in-flight messages with unique IDs
4. Claude CLI handles queued messages natively

### 1. Update Chat Input Component

**File:** `src/webview/components/organisms/chat-input.tsx`

```tsx
// Key changes:

// 1. Remove input disabled state (allow typing while processing)
// Line ~164: Change disabled={isProcessing} to disabled={false}

// 2. Reorder buttons: Stop button LEFT of Send button
// Lines 237-260: Update button layout

<div className="flex items-center gap-2">
  {/* Stop Button - Always visible on left */}
  <Button
    variant="ghost"
    size="icon"
    onClick={onStop}
    disabled={!isProcessing}  // Only enabled when processing
    className={cn(
      'transition-opacity',
      isProcessing ? 'opacity-100' : 'opacity-50'
    )}
    title="Stop Claude (Escape)"
  >
    <Icon name="stop" className="w-5 h-5 text-red-500" />
  </Button>

  {/* Send Button - Always visible on right */}
  <Button
    onClick={onSubmit}
    disabled={!value.trim()}  // Remove isProcessing check - allow send anytime
    className="bg-primary hover:bg-primary/90"
    title="Send message (Enter)"
  >
    <Icon name="arrow_upward" className="w-5 h-5" />
  </Button>
</div>

// 3. Update Enter key handler to allow sending during processing
// Line ~100-103: Remove isProcessing check
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (value.trim()) {  // Only check for non-empty, not isProcessing
      onSubmit();
    }
  }
  // ... rest of handler
};
```

### 2. Update Chat Actions Hook

**File:** `src/webview/hooks/useChatActions.ts`

```tsx
import { useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useVSCodeMessaging } from './useVSCodeMessaging';
import { v4 as uuidv4 } from 'uuid';  // Or use crypto.randomUUID()

export function useChatActions() {
  const inputValue = useChatStore(state => state.inputValue);
  const setInputValue = useChatStore(state => state.setInputValue);
  const pendingImages = useChatStore(state => state.pendingImages);
  const clearPendingImages = useChatStore(state => state.clearPendingImages);
  const setDraftMessage = useChatStore(state => state.setDraftMessage);
  const addPendingMessage = useChatStore(state => state.addPendingMessage);  // NEW
  const planMode = useSettingsStore(state => state.planMode);
  const thinkingMode = useSettingsStore(state => state.thinkingMode);
  // NOTE: Remove isProcessing check - allow concurrent sends

  const { sendMessage, stopProcess } = useVSCodeMessaging();

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim()) return;  // Only check for non-empty

    // Generate unique message ID for tracking
    const messageId = uuidv4();

    // Track this message as pending
    addPendingMessage({
      id: messageId,
      text: inputValue,
      sentAt: Date.now(),
      status: 'sending'
    });

    const images = pendingImages.map(img => ({
      id: img.id,
      path: img.path,
      position: img.position
    }));

    // Send with messageId for tracking
    sendMessage(inputValue, planMode, thinkingMode, images.length > 0 ? images : undefined, messageId);

    // Clear input immediately (don't wait for response)
    setInputValue('');
    setDraftMessage('');
    clearPendingImages();
  }, [inputValue, planMode, thinkingMode, pendingImages, sendMessage, setInputValue, setDraftMessage, clearPendingImages, addPendingMessage]);

  const handleStop = useCallback(() => {
    stopProcess();
  }, [stopProcess]);

  return {
    inputValue,
    setInputValue,
    handleSubmit,
    handleStop,
  };
}
```

### 3. Update Chat Store with Pending Messages

**File:** `src/webview/stores/chatStore.ts`

```typescript
// Add pending message tracking

interface PendingMessage {
  id: string;
  text: string;
  sentAt: number;
  status: 'sending' | 'processing' | 'completed' | 'error';
}

interface ChatState {
  // ... existing state
  pendingMessages: Map<string, PendingMessage>;

  // Actions
  addPendingMessage: (msg: PendingMessage) => void;
  updatePendingMessage: (id: string, status: PendingMessage['status']) => void;
  removePendingMessage: (id: string) => void;
  getPendingCount: () => number;
}

// Implementation
pendingMessages: new Map(),

addPendingMessage: (msg) => set((state) => {
  const newMap = new Map(state.pendingMessages);
  newMap.set(msg.id, msg);
  return { pendingMessages: newMap };
}),

updatePendingMessage: (id, status) => set((state) => {
  const newMap = new Map(state.pendingMessages);
  const msg = newMap.get(id);
  if (msg) {
    newMap.set(id, { ...msg, status });
  }
  return { pendingMessages: newMap };
}),

removePendingMessage: (id) => set((state) => {
  const newMap = new Map(state.pendingMessages);
  newMap.delete(id);
  return { pendingMessages: newMap };
}),

getPendingCount: () => get().pendingMessages.size,
```

### 4. Update Message Type with ID

**File:** `src/types/messages.ts`

```typescript
// Update SendMessageRequest to include messageId
interface SendMessageRequest {
  type: 'sendMessage';
  text: string;
  planMode?: boolean;
  thinkingMode?: boolean;
  images?: ImageData[];
  messageId: string;  // NEW: Unique ID for tracking
}

// Add message acknowledgment type
interface MessageAcknowledgment {
  type: 'messageAck';
  messageId: string;
  status: 'received' | 'processing' | 'completed' | 'error';
  panelId: string;
}
```

### 5. Update useVSCodeMessaging

**File:** `src/webview/hooks/useVSCodeMessaging.ts`

```typescript
// Update sendMessage to include messageId
const sendMessage = useCallback((
  text: string,
  planMode?: boolean,
  thinkingMode?: boolean,
  images?: ImageData[],
  messageId?: string  // NEW
) => {
  vscode.postMessage({
    type: 'sendMessage',
    text,
    planMode,
    thinkingMode,
    images,
    messageId: messageId || crypto.randomUUID(),  // Generate if not provided
  });
}, []);

// Add handler for messageAck
case 'messageAck':
  const { messageId, status } = message.data;
  updatePendingMessage(messageId, status);
  if (status === 'completed' || status === 'error') {
    removePendingMessage(messageId);
  }
  break;
```

### Edge Cases to Handle

1. **Message ordering**: Messages queue in order, display in send order
2. **Stop behavior**: Stop only stops current processing, not queued messages
3. **Error handling**: If message fails, show error but don't block others
4. **UI feedback**: Show pending count or indicator for queued messages
5. **Panel isolation**: Each panel tracks its own pending messages

### Coordinate with CLAUDE-1 (Backend)

Backend needs to:
1. Accept `messageId` in sendMessage payload
2. Return `messageId` in all response messages
3. Send `messageAck` messages for status updates
4. Handle concurrent writes to Claude CLI stdin

---

## Updated Phase 2 Definition of Done

### Secondary Features
- [ ] ExportDialog component (after CLAUDE-1 creates ExportService)
- [ ] TerminalOutput component
- [ ] Zustand DevTools conditional setup (M2)

### Message Handlers
- [ ] Wire exportComplete handler (for ExportDialog)
- [ ] Wire terminalOutput handler (for TerminalOutput component)

### Testing
- [ ] Test export dialog with all formats (Markdown, JSON, HTML)
- [ ] Test terminal output display with copy functionality
- [ ] All tests passing
- [ ] No TypeScript errors

**Note:** See Phase 1 for Context Window Viz, Lazy Loading, Search Panel, Think Mode Toggle, and Concurrent Messages

---

## Code Cleanup & Migration Tasks (Added 2026-01-04)

These tasks were identified during Phase 1 completion review.

### 1. Dead Code Deletion

**Priority:** LOW
**Status:** ❌ NOT DONE

The following files exist but are never imported anywhere:

| File | Lines | Reason |
|------|-------|--------|
| `src/webview/utils/messageUtils.ts` | ~50 | Superseded by store actions |
| `src/webview/utils/conversationUtils.ts` | ~80 | Superseded by store actions |
| `src/webview/utils/messageHandlers.ts` | ~120 | Superseded by handler hooks |

**Action:** Delete these files after verifying no imports exist.

```bash
# Verification command
grep -r "messageUtils\|conversationUtils\|messageHandlers" src/webview/
```

---

### 2. Token Store Migration

**Priority:** MEDIUM
**Status:** ❌ NOT DONE
**Architecture Note Added:** `src/webview/stores/tokenStore.ts` (lines 3-14)

Currently:
- `tokenStore.ts` exists with proper state and actions
- `useTokenHandlers.ts` still imports from `chatStore` instead of `tokenStore`
- `chatStore` re-exports token state for compatibility

**Migration Steps:**
1. Update `useTokenHandlers.ts` to import from `./tokenStore` instead of `chatStore`
2. Update components reading token state to use `useTokenStore` directly
3. Remove duplicate token state from `chatStore`
4. Remove re-exports from `chatStore`

**Files to modify:**
- `src/webview/hooks/handlers/useTokenHandlers.ts`
- `src/webview/stores/chatStore.ts` (remove token state)
- Components using token state (grep for `useChatStore.*token`)

---

### 3. MCP Manager UI Integration

**Priority:** LOW
**Status:** ❌ NOT DONE
**Dependency:** CLAUDE-1's McpService must emit events

The MCP Manager modal exists but isn't wired to real-time McpService events.

**Enhancement needed:**
- Add handlers for MCP server status changes
- Show real-time connection status
- Display tool availability per server

**Message types to wire:**
```typescript
['mcpServerStatus', mcpHandlers.mcpServerStatus],      // Connection state
['mcpToolsUpdated', mcpHandlers.mcpToolsUpdated],      // Available tools
['mcpServerLog', mcpHandlers.mcpServerLog],            // Debug logs
```

---

### 4. Large File Splitting

**Priority:** MEDIUM
**Status:** ❌ NOT DONE

These files exceed 400 lines and should be split for maintainability:

| File | Lines | Suggested Split |
|------|-------|-----------------|
| `src/webview/utils/mcp-formatter.ts` | 574 | Extract tool-specific formatters into separate modules |
| `src/webview/components/organisms/tool-use-block.tsx` | 491 | Extract tool renderers by type into sub-components |

**Approach:**
- `mcp-formatter.ts`: Create `src/webview/utils/formatters/` directory with per-tool formatters
- `tool-use-block.tsx`: Create `src/webview/components/molecules/tool-renderers/` directory

---

## Updated Phase 2 Checklist

### Secondary Features
- [ ] ExportDialog component (after CLAUDE-1 creates ExportService)
- [ ] TerminalOutput component
- [ ] Zustand DevTools conditional setup (M2)

### Message Handlers
- [ ] Wire exportComplete handler
- [ ] Wire terminalOutput handler
- [ ] Wire MCP status handlers (mcpServerStatus, mcpToolsUpdated)

### Code Cleanup (from Phase 1 review)
- [ ] Delete dead code files (messageUtils, conversationUtils, messageHandlers)
- [ ] Complete token store migration
- [ ] Wire MCP Manager to McpService events
- [ ] Split large files (mcp-formatter.ts, tool-use-block.tsx)

### Testing
- [ ] Test export dialog with all formats
- [ ] Test terminal output display
- [ ] All tests passing
- [ ] No TypeScript errors
