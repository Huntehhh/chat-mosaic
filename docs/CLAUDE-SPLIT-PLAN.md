# Multi-Claude Work Split Plan

> **Goal**: Consolidate 134+ markdown files into 3 focused docs—one per Claude instance—with minimal overlap and a coordination mechanism for cross-cutting work.

---

## Overview: The Three Claudes

| Claude       | Domain              | Scope                                              | Primary Files                              |
| ------------ | ------------------- | -------------------------------------------------- | ------------------------------------------ |
| **Claude 1** | Backend/Services    | Extension lifecycle, process mgmt, CLI integration | `extension.ts`, `src/services/*`           |
| **Claude 2** | Frontend Components | React UI, atomic design, styling                   | `src/webview/components/*`, `containers/*` |
| **Claude 3** | State & Integration | Zustand stores, hooks, message routing             | `src/webview/hooks/*`, `stores/*`, `lib/*` |

### Why This Split Works

1. **No circular dependencies**: Services never import webview code; components only consume stores
2. **Clear file ownership**: Each Claude owns distinct diresctories
3. **Parallel-safe**: Changes in one domain rarely cause merge conflicts with others
4. **Natural data flow**: Backend → State → Components (one-way)

---

## File Ownership Map

### Claude 1: Backend/Services

```
src/extension.ts                    # Main orchestrator (OWNER)
src/services/
  ├── ConversationManager.ts        # OWNER
  ├── ProcessManager.ts             # OWNER
  ├── ProcessRegistry.ts            # OWNER
  ├── StreamBuffer.ts               # OWNER
  ├── PermissionsManager.ts         # OWNER
  ├── McpService.ts                 # OWNER
  ├── GitService.ts                 # OWNER
  ├── DiffService.ts                # OWNER
  ├── TerminalManager.ts            # OWNER
  ├── LogService.ts                 # OWNER
  ├── SettingsManager.ts            # OWNER
  ├── SnippetsService.ts            # OWNER
  ├── WorkspaceFileService.ts       # OWNER
  └── shared-types.ts               # OWNER
src/utils/                          # OWNER (all utilities)
src/constants.ts                    # OWNER
```

### Claude 2: Frontend Components

```
src/webview/components/
  ├── atoms/                        # OWNER (button, input, etc.)
  ├── molecules/                    # OWNER (cards, forms, lists)
  ├── organisms/                    # OWNER (modals, panels, headers)
  └── ui/                           # OWNER (shadcn components)
src/webview/containers/
  └── MessageList.tsx               # OWNER
src/webview/styles/
  └── globals.css                   # OWNER
```

### Claude 3: State & Integration

```
src/webview/stores/
  ├── chatStore.ts                  # OWNER
  ├── settingsStore.ts              # OWNER
  ├── uiStore.ts                    # OWNER
  └── branchStore.ts                # OWNER
src/webview/hooks/
  ├── handlers/                     # OWNER (all handler hooks)
  ├── useVSCodeMessaging.ts         # OWNER
  ├── useChatActions.ts             # OWNER
  ├── useModalHandlers.ts           # OWNER
  └── ...                           # OWNER (all hooks)
src/webview/lib/
  ├── vscode.ts                     # OWNER
  ├── conversationUtils.ts          # OWNER
  ├── messageUtils.ts               # OWNER
  └── mcp-formatter.ts              # OWNER
src/webview/App.tsx                 # SHARED (coordinate with Claude 2)
```

### Shared Files (Coordinate Before Modifying)

```
src/types/                          # READ-ONLY for all; Claude 1 owns changes
  ├── messages.ts                   # IPC protocol types
  ├── shared.ts                     # CLI message types
  ├── session.ts                    # Panel/conversation state
  └── process.ts                    # Process lifecycle types
package.json                        # Coordinate all changes
```

---

## Consolidated Markdown Files

### File 1: `CLAUDE-1-BACKEND.md`

**Purpose**: Everything Claude 1 needs to work on backend/services

**Content to consolidate from**:

- `docs/app-overview/cli-communication-flow.md` (CLI protocol)
- `docs/app-overview/claude-cli-jsonl-format.md` (JSONL format)
- `docs/app-overview/commands-and-tools-flow.md` (MCP/tools)
- `docs/plans/refactor-v3/00-CONSENSUS-SUMMARY.md` (priorities)
- `docs/plans/refactor-v3/02-ARCHITECTURE-CHANGES.md` (architecture)
- `docs/plans/opencode/OPENCODE-INTEGRATION-PLAN.md` (OpenCode backend)
- `docs/code-review-2026-01-03.md` (Issues #1, #3, #5, #6, #7, #9, #10, #12, #15)
- Recent changelogs for services (Agent 1, Agent 3 services sessions)

**Sections**:

1. **Your Scope**: Files you own, files to coordinate
2. **Architecture Overview**: Extension lifecycle, service dependencies
3. **CLI Protocol**: JSONL format, message types, control flow
4. **Critical Issues to Fix**: From code review (backend-specific)
5. **Current State**: Recent changes, open loops
6. **Handoff Protocol**: How to communicate with Claude 2/3

---

### File 2: `CLAUDE-2-FRONTEND.md`

**Purpose**: Everything Claude 2 needs for React components

**Content to consolidate from**:

- `docs/best-practices/stitch/` (UI generation guides)
- `docs/plans/refactor-v3/03-PERFORMANCE-IMPROVEMENTS.md` (virtualization)
- `docs/plans/refactor-v3/04-GENERAL-IMPROVEMENTS.md` (accessibility)
- `docs/code-review-2026-01-03.md` (Issues #4, #8 - React perf)
- `docs/app-overview/stitch-prompts/` (component prompts)
- Recent changelogs for frontend components

**Sections**:

1. **Your Scope**: Components you own, atomic design rules
2. **Component Architecture**: Atoms → Molecules → Organisms → Containers
3. **Styling Guide**: Tailwind, globals.css, shadcn/ui patterns
4. **Critical Issues to Fix**: React performance, accessibility
5. **Current State**: Recent changes, component inventory
6. **Handoff Protocol**: How to request store changes from Claude 3

---

### File 3: `CLAUDE-3-STATE.md`

**Purpose**: Everything Claude 3 needs for state & integration

**Content to consolidate from**:

- `docs/app-overview/cli-communication-flow.md` (webview side)
- `docs/plans/refactor-v3/02-ARCHITECTURE-CHANGES.md` (split-brain state)
- `docs/code-review-2026-01-03.md` (Issues #4, #8, #11 - state issues)
- `src/types/messages.ts` reference (IPC types)
- Recent changelogs for hooks/stores

**Sections**:

1. **Your Scope**: Stores, hooks, message routing
2. **State Architecture**: Zustand stores, selectors, subscriptions
3. **IPC Protocol**: Message handlers, postMessage patterns
4. **Critical Issues to Fix**: Split-brain state, stale closures
5. **Current State**: Recent changes, handler inventory
6. **Handoff Protocol**: How to coordinate type changes with Claude 1

---

## Coordination Mechanism: Handoff Files

### Location: `docs/handoff/`

Each Claude writes to their own outbound file when they need another Claude to make changes:

```
docs/handoff/
  ├── claude-1-requests.md    # Claude 1 writes requests FOR Claude 2/3
  ├── claude-2-requests.md    # Claude 2 writes requests FOR Claude 1/3
  ├── claude-3-requests.md    # Claude 3 writes requests FOR Claude 1/2
  └── HANDOFF-LOG.md          # Completed handoffs (append-only)
```

### Handoff File Format

```markdown
# Handoff Requests from Claude X

## Active Requests

### [PENDING] Request ID: 2026-01-04-001
**From**: Claude 1 (Backend)
**To**: Claude 3 (State)
**Priority**: HIGH
**Summary**: Add new message type `toolProgress` to useVSCodeMessaging

**Details**:
I'm adding progress events to ProcessManager that emit { type: 'toolProgress', progress: number }.
Need Claude 3 to:
1. Add handler in `useVSCodeMessaging.ts` for 'toolProgress' message
2. Add `toolProgress: number | null` to chatStore
3. Export selector for components to consume

**Files I'm Modifying**:
- src/services/ProcessManager.ts (adding emit)
- src/types/messages.ts (adding type)

**Interface Contract**:
```typescript
// Extension → Webview message
{ type: 'toolProgress', progress: number } // 0-100
```

**Status**: PENDING

**Created**: 2026-01-04T10:30:00Z

---

### [COMPLETED] Request ID: 2026-01-04-000

...

```

### Handoff Rules

1. **Write to YOUR requests file** when you need work from another Claude
2. **Check OTHER Claudes' requests files** before starting new work
3. **Mark as COMPLETED** when done and move to HANDOFF-LOG.md
4. **Include interface contracts** so the other Claude knows exact types
5. **List files you're modifying** to prevent merge conflicts

---

## Quick Reference: Critical Issues by Claude

### Claude 1 Must Fix (Backend)
| Issue | Severity | File | Line |
|-------|----------|------|------|
| ProcessRegistry race condition | CRITICAL | ProcessRegistry.ts | 98 |
| StreamBuffer unbounded growth | CRITICAL | StreamBuffer.ts | 56 |
| Audit log data loss | HIGH | PermissionsManager.ts | 122 |
| Path traversal vulnerability | HIGH | extension.ts | ~2287 |
| ReDoS in pattern matching | HIGH | PermissionsManager.ts | 287 |
| File handle leak | MEDIUM | ConversationManager.ts | 630 |
| Process map memory leak | MEDIUM | ProcessRegistry.ts | 84 |

### Claude 2 Must Fix (Components)
| Issue | Severity | File | Line |
|-------|----------|------|------|
| React performance bottleneck | HIGH | App.tsx | 63 |
| Missing useShallow selectors | HIGH | Multiple components | - |
| Modal accessibility (focus traps) | HIGH | All modals | - |
| Missing ARIA labels | MEDIUM | Multiple components | - |

### Claude 3 Must Fix (State)
| Issue | Severity | File | Line |
|-------|----------|------|------|
| Split-brain state sync | CRITICAL | chatStore + ConversationManager | - |
| Stale closure in useEffect | MEDIUM | App.tsx | 84 |
| Inconsistent state reset | MEDIUM | chatStore.ts | 289 |
| Missing dependencies in hooks | MEDIUM | Multiple hooks | - |

---

## Implementation Steps

### Step 1: Create the Three Consolidated Files
1. Create `docs/CLAUDE-1-BACKEND.md` with all backend content
2. Create `docs/CLAUDE-2-FRONTEND.md` with all frontend component content
3. Create `docs/CLAUDE-3-STATE.md` with all state/integration content

### Step 2: Set Up Handoff Directory
```bash
mkdir -p docs/handoff
touch docs/handoff/claude-1-requests.md
touch docs/handoff/claude-2-requests.md
touch docs/handoff/claude-3-requests.md
touch docs/handoff/HANDOFF-LOG.md
```

### Step 3: Archive Old Docs

Move all consolidated docs to `docs/.archive/pre-split/` for reference.

### Step 4: Update CLAUDE.md

Add reference to the three main docs and handoff protocol.

---

## Workflow: Running Three Claudes in Parallel

### Setup

1. Open 3 terminal sessions
2. Each Claude reads their consolidated doc:

   - `Read docs/CLAUDE-1-BACKEND.md`
   - `Read docs/CLAUDE-2-FRONTEND.md`
   - `Read docs/CLAUDE-3-STATE.md`

### During Work

1. Each Claude works only on their owned files
2. Before modifying shared files (`src/types/*`), write to handoff file
3. Check handoff files periodically for incoming requests
4. Complete handoff requests before starting new work

### End of Session

1. Each Claude writes session summary to their consolidated doc
2. Move completed handoffs to HANDOFF-LOG.md
3. Commit changes with clear scope prefix:

   - `feat(backend): ...`
   - `feat(frontend): ...`
   - `feat(state): ...`

---

## Next Steps

1. **Create the three consolidated markdown files** (I can do this now)
2. **Set up handoff directory structure**
3. **Archive redundant docs**
4. **Test the workflow with a sample task**

Would you like me to proceed with creating these three consolidated files now?