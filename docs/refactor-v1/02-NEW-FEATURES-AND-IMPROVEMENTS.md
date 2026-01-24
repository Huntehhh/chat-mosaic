# New Features & Improvements

**Project:** Claude Code Chat VS Code Extension
**Date:** 2025-12-19
**Source:** Multi-model analysis (Gemini 3 Pro, Gemini 3 Flash, Grok 4.1 Fast)

---

## Overview

This document catalogs all recommended new features, UI/UX improvements, and enhancements. Items are organized by implementation phase.

**Total Features:** 24

---

## Phase 1: Quick Wins (1-2 days each)

### 1.1 Collapsible Tool Output Cards

**Priority:** High | **Effort:** 1 day | **Source:** All models

**Description:** Tool outputs currently expand inline. Make them collapsible cards with smart summaries.

```tsx
interface ToolUseCardProps {
  toolName: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

const ToolUseCard = ({ toolName, input, result, isError }: ToolUseCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const summary = useMemo(() => {
    switch (toolName) {
      case 'Bash': return `Running '${(input.command as string).slice(0, 40)}...'`;
      case 'Read': return `Reading ${input.file_path}`;
      case 'Write': return `Writing to ${input.file_path}`;
      case 'Edit': return `Editing ${input.file_path}`;
      default: return `Executing ${toolName}`;
    }
  }, [toolName, input]);

  return (
    <div className={cn(
      "rounded-lg border",
      isError ? "border-red-500/50 bg-red-500/5" : "border-border bg-muted/30"
    )}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 p-3">
        <ToolIcon name={toolName} className="w-4 h-4" />
        <span className="text-sm font-medium">{summary}</span>
        <ChevronDown className={cn("ml-auto w-4 h-4", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="border-t p-3">
          <pre className="text-xs">{JSON.stringify(input, null, 2)}</pre>
          {result && <pre className="text-xs mt-2 pt-2 border-t">{result}</pre>}
        </div>
      )}
    </div>
  );
};
```

---

### 1.2 Skeleton Loaders for Tool Output

**Priority:** High | **Effort:** 0.5 days | **Source:** Gemini Flash

**Description:** Show animated placeholder while tool is executing.

```tsx
const ToolOutputSkeleton = () => (
  <div className="rounded-lg border bg-muted/30 p-3 animate-pulse">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-4 h-4 rounded bg-muted-foreground/20" />
      <div className="h-4 w-32 rounded bg-muted-foreground/20" />
    </div>
    <div className="space-y-2">
      <div className="h-3 w-full rounded bg-muted-foreground/10" />
      <div className="h-3 w-4/5 rounded bg-muted-foreground/10" />
      <div className="h-3 w-3/5 rounded bg-muted-foreground/10" />
    </div>
  </div>
);
```

---

### 1.3 Ghost Cursor During Streaming

**Priority:** Medium | **Effort:** 0.5 days | **Source:** Gemini Flash

**Description:** Blinking cursor at end of streaming text for typewriter effect.

```tsx
const StreamingCursor = () => (
  <span className="inline-block w-0.5 h-4 bg-foreground animate-blink ml-0.5" />
);

// CSS
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.animate-blink {
  animation: blink 1s step-end infinite;
}
```

---

### 1.4 Slash Command Templates

**Priority:** High | **Effort:** 1-2 days | **Source:** Grok 4.1 Fast

**Description:** Pre-defined prompt templates with variable substitution.

```json
{
  "templates": [
    {
      "command": "/explain",
      "label": "Explain Selection",
      "prompt": "Explain the following code in detail:\n\n```\n{selection}\n```",
      "requiresSelection": true
    },
    {
      "command": "/refactor",
      "label": "Refactor Code",
      "prompt": "Refactor this code to improve readability:\n\n```\n{selection}\n```",
      "requiresSelection": true
    },
    {
      "command": "/testgen",
      "label": "Generate Tests",
      "prompt": "Generate comprehensive unit tests for:\n\n```\n{selection}\n```",
      "requiresSelection": true
    },
    {
      "command": "/fix",
      "label": "Fix Error",
      "prompt": "Fix the following error:\n\n{clipboard}",
      "requiresClipboard": true
    },
    {
      "command": "/review",
      "label": "Code Review",
      "prompt": "Review this code for bugs and improvements:\n\n```\n{selection}\n```",
      "requiresSelection": true
    }
  ]
}
```

**Implementation:**
```typescript
expandTemplate: (template: Template, context: { selection?: string; clipboard?: string }) => {
  let prompt = template.prompt;
  prompt = prompt.replace('{selection}', context.selection || '');
  prompt = prompt.replace('{clipboard}', context.clipboard || '');
  return prompt;
}
```

---

### 1.5 VS Code CSS Variable Integration

**Priority:** Medium | **Effort:** 0.5 days | **Source:** Gemini Flash

**Description:** Map VS Code theme tokens to Tailwind-compatible CSS variables for perfect theme matching.

```css
:root {
  --background: var(--vscode-editor-background);
  --foreground: var(--vscode-editor-foreground);
  --muted: var(--vscode-input-background);
  --muted-foreground: var(--vscode-descriptionForeground);
  --border: var(--vscode-panel-border);
  --primary: var(--vscode-button-background);
  --primary-foreground: var(--vscode-button-foreground);
  --destructive: var(--vscode-errorForeground);
  --accent: var(--vscode-focusBorder);
}
```

---

## Phase 2: High Value (3-5 days each)

### 2.1 Context Pinning System

**Priority:** High | **Effort:** 3-5 days | **Source:** Gemini 3 Pro

**Description:** Drag-and-drop files to "pin" them as persistent context.

```tsx
interface PinnedFile {
  path: string;
  name: string;
  content?: string;
  tokens?: number;
}

const PinnedContextShelf = () => {
  const [pinnedFiles, setPinnedFiles] = useState<PinnedFile[]>([]);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer?.getData('text/uri-list');
    if (files) {
      vscode.postMessage({ type: 'getPinnedFileContents', paths: files.split('\n') });
    }
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={cn(
        "sticky top-0 z-10 bg-background/95 backdrop-blur border-b p-2",
        pinnedFiles.length === 0 && "border-dashed"
      )}
    >
      {pinnedFiles.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          Drag files here to pin context
        </p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {pinnedFiles.map(file => (
            <Badge key={file.path} variant="secondary" className="gap-1">
              <FileIcon className="w-3 h-3" />
              {file.name}
              <span className="text-muted-foreground">({file.tokens} tokens)</span>
              <button onClick={() => unpin(file.path)}><X className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

### 2.2 Apply to Editor Button

**Priority:** High | **Effort:** 2-3 days | **Source:** Gemini 3 Pro

**Description:** One-click apply code blocks to active editor.

```tsx
const CodeBlock = ({ code, language, filePath }: Props) => {
  const handleApply = () => {
    vscode.postMessage({
      type: 'applyCodeToEditor',
      code,
      filePath,
      mode: filePath ? 'replace' : 'insert'
    });
  };

  return (
    <div className="relative group">
      <pre><code>{code}</code></pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1">
        <Button size="icon" variant="ghost" onClick={handleCopy}><Copy /></Button>
        <Button size="icon" variant="ghost" onClick={handleApply}><FileInput /></Button>
      </div>
    </div>
  );
};
```

**Extension handler:**
```typescript
case 'applyCodeToEditor':
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    if (message.mode === 'insert') {
      editor.edit(b => b.insert(editor.selection.active, message.code));
    } else if (message.filePath) {
      const doc = await vscode.workspace.openTextDocument(message.filePath);
      const edit = new vscode.WorkspaceEdit();
      edit.replace(doc.uri, new vscode.Range(0, 0, doc.lineCount, 0), message.code);
      await vscode.workspace.applyEdit(edit);
    }
  }
  break;
```

---

### 2.3 Permission Request Sticky Banner

**Priority:** Medium | **Effort:** 1 day | **Source:** Gemini Flash

**Description:** Bottom sticky banner instead of inline message bubble.

```tsx
const PermissionBanner = ({ permission, onApprove, onDeny }: Props) => (
  <motion.div
    initial={{ y: 100, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: 100, opacity: 0 }}
    className={cn(
      "fixed bottom-20 left-4 right-4 z-50",
      "bg-yellow-500/10 border border-yellow-500/50 rounded-lg",
      "p-4 shadow-lg backdrop-blur-sm"
    )}
  >
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-yellow-500" />
      <div className="flex-1">
        <p className="font-medium text-sm">Permission Required</p>
        <p className="text-xs text-muted-foreground mt-1">
          {permission.tool}: {JSON.stringify(permission.input).slice(0, 100)}...
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onDeny}>Deny</Button>
        <Button size="sm" onClick={onApprove}>Allow</Button>
      </div>
    </div>
  </motion.div>
);
```

---

### 2.4 Responsive/Adaptive Layout

**Priority:** Medium | **Effort:** 2 days | **Source:** Gemini Flash

**Description:** Adapt UI for narrow sidebar widths (<300px).

```tsx
const useAdaptiveLayout = () => {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  return {
    isNarrow: width < 300,
    isCompact: width < 400,
  };
};

// Narrow mode: icons instead of text, bottom sheets for panels
const { isNarrow } = useAdaptiveLayout();
return isNarrow ? (
  <StatIcon icon={Coins} value={cost} tooltip="Total Cost" />
) : (
  <span>Cost: ${cost.toFixed(4)}</span>
);
```

---

### 2.5 Message Animations (Framer Motion)

**Priority:** Low | **Effort:** 1 day | **Source:** Gemini Flash

**Description:** Staggered entry animations for messages.

```tsx
import { motion } from 'framer-motion';

const MessageItem = ({ message, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{
      delay: index * 0.05,
      duration: 0.2,
      ease: "easeOut"
    }}
  >
    {/* message content */}
  </motion.div>
);
```

---

### 2.6 Inline Diff View for File Edits

**Priority:** High | **Effort:** 2 days | **Source:** All models

**Description:** Show side-by-side diff for Edit tool results.

```tsx
import { Diff, Hunk, parseDiff } from 'react-diff-view';
import 'react-diff-view/style/index.css';

const FileDiffView = ({ oldContent, newContent, filePath }: Props) => {
  const diff = useMemo(() => {
    const patch = createTwoFilesPatch(filePath, filePath, oldContent, newContent);
    return parseDiff(patch);
  }, [oldContent, newContent, filePath]);

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-muted px-3 py-2 text-sm font-medium border-b">{filePath}</div>
      <Diff viewType="split" diffType="modify" hunks={diff[0]?.hunks || []}>
        {(hunks) => hunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
      </Diff>
    </div>
  );
};
```

---

## Phase 3: Differentiators (1-2 weeks each)

### 3.1 Session Branching (Conversation Trees)

**Priority:** Medium | **Effort:** 1-2 weeks | **Source:** Gemini 3 Pro

**Description:** Edit and resubmit previous messages, creating conversation branches.

```typescript
interface BranchableMessage {
  id: string;
  parentId: string | null;
  branchId: string;
  content: string;
  type: 'user' | 'claude';
  timestamp: number;
  children: string[]; // IDs of branched messages
}

interface ChatState {
  messages: BranchableMessage[];
  activeBranchId: string;
  branches: Map<string, string[]>;

  editAndResubmit: (messageId: string, newContent: string) => void;
  switchBranch: (branchId: string) => void;
}
```

**UI Component:**
```tsx
const MessageBranchIndicator = ({ message }: { message: BranchableMessage }) => {
  if (message.children.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <GitBranch className="w-3 h-3" />
      <span>{message.children.length} branches</span>
      <select onChange={(e) => switchBranch(e.target.value)}>
        {message.children.map(childId => (
          <option key={childId} value={childId}>Branch {childId.slice(0, 6)}</option>
        ))}
      </select>
    </div>
  );
};
```

---

### 3.2 Time Travel Debugging (Git Checkpoints)

**Priority:** Medium | **Effort:** 1-2 weeks | **Source:** Gemini 3 Pro

**Description:** Auto-create git checkpoints on file writes, restore via slider.

```typescript
interface Checkpoint {
  id: string;
  messageIndex: number;
  timestamp: string;
  description: string;
  gitSha?: string;
  filesModified: string[];
}

// Auto-create on Write/Edit
private async _createCheckpoint(toolResult: ToolResult): Promise<void> {
  if (toolResult.toolName === 'Write' || toolResult.toolName === 'Edit') {
    const sha = await this._createGitTag(`checkpoint-${Date.now()}`);
    const checkpoint: Checkpoint = {
      id: crypto.randomUUID(),
      messageIndex: this._currentConversation.length,
      timestamp: new Date().toISOString(),
      description: `Modified ${toolResult.input.file_path}`,
      gitSha: sha,
      filesModified: [toolResult.input.file_path]
    };
    this._checkpoints.push(checkpoint);
  }
}
```

**Timeline Slider UI:**
```tsx
const CheckpointSlider = ({ checkpoints, onRestore }: Props) => {
  const [position, setPosition] = useState(checkpoints.length - 1);

  return (
    <div className="border-t p-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4" />
        <input type="range" min={0} max={checkpoints.length - 1} value={position}
          onChange={(e) => setPosition(Number(e.target.value))} className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => onRestore(checkpoints[position])}
          disabled={position === checkpoints.length - 1}>Restore</Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {checkpoints[position]?.description || 'Current state'}
      </p>
    </div>
  );
};
```

---

### 3.3 Smart Context Injection

**Priority:** Medium | **Effort:** 3-5 days | **Source:** Grok 4.1 Fast

**Description:** Auto-inject relevant context (selection, errors, git diff) into prompts.

```typescript
private async _buildContextEnhancedPrompt(userMessage: string): Promise<string> {
  const context: string[] = [];

  // 1. Active editor selection
  const editor = vscode.window.activeTextEditor;
  if (editor && !editor.selection.isEmpty) {
    const selection = editor.document.getText(editor.selection);
    if (selection.length < 5000) {
      context.push(`**Current Selection (${editor.document.fileName}):**\n\`\`\`\n${selection}\n\`\`\``);
    }
  }

  // 2. Current file diagnostics
  if (editor) {
    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
    if (errors.length > 0) {
      context.push(`**Current Errors:**\n${errors.map(e => `- Line ${e.range.start.line}: ${e.message}`).join('\n')}`);
    }
  }

  // 3. Recent git changes
  try {
    const { stdout } = await exec('git diff --stat HEAD~1');
    if (stdout.trim()) {
      context.push(`**Recent Git Changes:**\n\`\`\`\n${stdout.slice(0, 1000)}\n\`\`\``);
    }
  } catch {}

  return context.length > 0 ? `${context.join('\n\n')}\n\n---\n\n${userMessage}` : userMessage;
}
```

---

### 3.4 Workspace Integration Commands

**Priority:** Medium | **Effort:** 2-3 days | **Source:** Grok 4.1 Fast

**Description:** Special @ commands that inject dynamic content.

```typescript
private async _processAtCommands(message: string): Promise<string> {
  let processed = message;

  // @task <taskname> - Run VS Code task
  const taskMatch = message.match(/@task\s+(\S+)/);
  if (taskMatch) {
    const output = await this._runVSCodeTask(taskMatch[1]);
    processed = processed.replace(taskMatch[0], `**Task Output:**\n\`\`\`\n${output}\n\`\`\``);
  }

  // @git <command> - Run git command
  const gitMatch = message.match(/@git\s+(.+)/);
  if (gitMatch) {
    const { stdout } = await exec(`git ${gitMatch[1]}`, { cwd: this._workspaceRoot });
    processed = processed.replace(gitMatch[0], `**Git Output:**\n\`\`\`\n${stdout}\n\`\`\``);
  }

  // @file <path> - Inject file contents
  const fileMatch = message.match(/@file\s+(\S+)/);
  if (fileMatch) {
    const content = await vscode.workspace.fs.readFile(vscode.Uri.file(fileMatch[1]));
    processed = processed.replace(fileMatch[0], `**File:**\n\`\`\`\n${content.toString()}\n\`\`\``);
  }

  return processed;
}
```

---

### 3.5 React Virtualization for Long Chats

**Priority:** High | **Effort:** 1-2 days | **Source:** All models

**Description:** Use react-virtuoso for 200+ message conversations.

```tsx
import { Virtuoso } from 'react-virtuoso';

const ChatMessages = () => {
  const messages = useChatStore(state => state.messages);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
  }, [messages.length]);

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={messages}
      itemContent={(index, message) => <MessageBlock key={message.timestamp} message={message} />}
      followOutput="smooth"
      initialTopMostItemIndex={messages.length - 1}
    />
  );
};
```

---

### 3.6 Stream Processing for Large JSONL

**Priority:** High | **Effort:** 1 day | **Source:** All models

**Description:** Stream-parse large conversation files instead of loading into memory.

```typescript
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

async loadJSONLConversationStreaming(filePath: string): Promise<ConversationMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: ConversationMessage[] = [];
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      if (!line.trim()) return;
      try {
        messages.push(JSON.parse(line));
      } catch {}
    });

    rl.on('close', () => resolve(messages));
    rl.on('error', reject);
  });
}
```

---

### 3.7 Memory Monitoring

**Priority:** Low | **Effort:** 0.5 days | **Source:** All models

**Description:** Monitor extension memory usage, warn on high consumption.

```typescript
private _startMemoryMonitoring(): void {
  this._memoryCheckInterval = setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;

    if (heapUsedMB > 500) {
      console.warn(`High memory usage: ${heapUsedMB.toFixed(2)} MB`);
    }

    if (heapUsedMB > 1000) {
      vscode.window.showWarningMessage(
        'Claude Code Chat is using high memory. Consider restarting.',
        'Restart'
      ).then(action => {
        if (action === 'Restart') {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      });
    }
  }, 60000);
}
```

---

## Phase 4: Innovative (2-3 weeks each)

### 4.1 Auto-Debug Agent

**Priority:** Low | **Effort:** 1 week | **Source:** Grok 4.1 Fast

**Description:** Auto-retry on tool errors with AI-generated fixes.

```typescript
private async _handleToolError(error: ToolError, retryCount: number = 0): Promise<void> {
  const MAX_RETRIES = 3;

  if (retryCount >= MAX_RETRIES) {
    this._postMessage({ type: 'error', data: `Failed after ${MAX_RETRIES} attempts` });
    return;
  }

  const fixPrompt = `The previous command failed:\n\`\`\`\n${error.stderr || error.message}\n\`\`\`\n\nPlease try a different approach.`;

  this._postMessage({ type: 'autoRetry', data: { attempt: retryCount + 1, maxAttempts: MAX_RETRIES } });
  await this._sendMessage(fixPrompt, { isAutoRetry: true });
}
```

---

### 4.2 Multi-Agent Swarm

**Priority:** Low | **Effort:** 2-3 weeks | **Source:** Grok 4.1 Fast

**Description:** Orchestrate multiple Claude processes for parallel tasks.

```typescript
interface AgentTask {
  id: string;
  role: 'planner' | 'coder' | 'tester' | 'reviewer';
  prompt: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

class SwarmOrchestrator {
  private agents: Map<string, ProcessManager> = new Map();

  async executeSwarm(goal: string): Promise<void> {
    // 1. Planner creates task breakdown
    const tasks = await this.runAgent('planner', `Break down: ${goal}`);

    // 2. Execute with parallelism (concurrency: 3)
    const queue = new PQueue({ concurrency: 3 });
    for (const task of tasks) {
      queue.add(async () => {
        await this.waitForDependencies(task.dependencies);
        task.result = await this.runAgent(task.role, task.prompt);
      });
    }

    await queue.onIdle();
  }
}
```

---

### 4.3 Plugin System (Contribution Points)

**Priority:** Low | **Effort:** 2 weeks | **Source:** Grok 4.1 Fast

**Description:** Allow other extensions to contribute templates, tools, themes.

**package.json:**
```json
{
  "contributes": {
    "claudeCodeChat.templates": {
      "type": "array",
      "description": "Custom prompt templates"
    },
    "claudeCodeChat.tools": {
      "type": "array",
      "description": "Custom MCP tools"
    },
    "claudeCodeChat.themes": {
      "type": "object",
      "description": "Custom chat themes"
    }
  }
}
```

**Discovery:**
```typescript
async discoverPlugins(): Promise<Plugin[]> {
  const plugins: Plugin[] = [];
  for (const ext of vscode.extensions.all) {
    const pkg = ext.packageJSON;
    if (pkg.contributes?.['claudeCodeChat.templates']) {
      plugins.push({ type: 'templates', extension: ext.id, data: pkg.contributes['claudeCodeChat.templates'] });
    }
  }
  return plugins;
}
```

---

### 4.4 Zod Schema Validation for CLI Output

**Priority:** Medium | **Effort:** 2 days | **Source:** Gemini 3 Pro

**Description:** Replace brittle if/else parsing with schema validation.

```typescript
import { z } from 'zod';

const UserMessageSchema = z.object({
  type: z.literal('user'),
  message: z.object({
    content: z.array(z.object({ type: z.literal('text'), text: z.string() }))
  }).optional()
});

const AssistantMessageSchema = z.object({
  type: z.literal('assistant'),
  message: z.object({
    content: z.array(z.union([
      z.object({ type: z.literal('text'), text: z.string() }),
      z.object({ type: z.literal('tool_use'), name: z.string(), input: z.record(z.unknown()) })
    ]))
  }).optional()
});

private _parseJSONLEntry(line: string): ParsedEntry | null {
  const json = JSON.parse(line);
  const userResult = UserMessageSchema.safeParse(json);
  if (userResult.success) return { type: 'user', data: userResult.data };

  const assistantResult = AssistantMessageSchema.safeParse(json);
  if (assistantResult.success) return { type: 'assistant', data: assistantResult.data };

  return null;
}
```

---

### 4.5 Enhanced Permission Patterns (Minimatch)

**Priority:** Medium | **Effort:** 1 day | **Source:** All models

**Description:** Support glob patterns and regex in permission rules.

```typescript
import minimatch from 'minimatch';

private _matchesPattern(command: string, pattern: string): boolean {
  if (pattern === command) return true;

  // Simple wildcard (backwards compatible)
  if (pattern.endsWith(' *')) {
    if (command.startsWith(pattern.slice(0, -1))) return true;
  }

  // Glob pattern
  try {
    if (minimatch(command, pattern)) return true;
  } catch {}

  // Regex (prefixed with /)
  if (pattern.startsWith('/') && pattern.endsWith('/')) {
    try {
      if (new RegExp(pattern.slice(1, -1)).test(command)) return true;
    } catch {}
  }

  return false;
}
```

---

### 4.6 Collapsible Thinking Block (Accordion)

**Priority:** High | **Effort:** 1 day | **Source:** All models

**Description:** Replace blocking overlay with inline collapsible block.

```tsx
const ThinkingBlock = ({ content, isExpanded, toggle }) => (
  <div className={cn(
    "border-l-4 border-amber-500 bg-amber-500/5",
    "transition-all duration-300",
    isExpanded ? "max-h-[500px]" : "max-h-12",
    "overflow-hidden cursor-pointer"
  )}>
    <div className="flex items-center gap-2 p-3" onClick={toggle}>
      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
      <span className="text-sm text-muted-foreground">Thinking...</span>
      <ChevronDown className={cn("ml-auto transition-transform", isExpanded && "rotate-180")} />
    </div>
    {isExpanded && (
      <div className="p-3 pt-0 text-xs font-mono opacity-70">{content}</div>
    )}
  </div>
);
```

---

## Summary by Phase

| Phase | Items | Effort |
|-------|-------|--------|
| Quick Wins | 5 | 3-5 days |
| High Value | 6 | 10-14 days |
| Differentiators | 7 | 3-5 weeks |
| Innovative | 6 | 6-8 weeks |

---

## Cross-References

- **Bug fixes required before some features:** `01-TECHNICAL-DEBT-AND-BUGS.md`
- **Architecture changes enabling features:** `03-ARCHITECTURE-ROADMAP.md`

---

*Generated from multi-model analysis on 2025-12-19*
