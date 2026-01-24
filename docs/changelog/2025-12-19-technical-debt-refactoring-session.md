# Changelog - 2025-12-19 (Technical Debt Refactoring Session)

## God Class Refactoring and Service Extraction

- **Goal**: Implement technical debt fixes #8-18 from multi-model code review
- **Risk Level**: High - Major refactoring of 3900-line extension.ts

Created 6 new services to decompose the God class pattern in `extension.ts`. Services are staged but extension.ts integration has a syntax error that needs manual fix.

## ⚠️ Current State: Merge Interrupted

The cherry-pick of services is staged but NOT committed. The git state is:
```bash
# Current branch: main (at 1730e31)
# Staged changes from cherry-pick a250982:
#   - 6 new service files
#   - modified src/services/index.ts
#   - modified src/webview/stores/uiStore.ts
#   - new src/webview/lib/messageHandlers.ts
```

### The Problem
The `sed` commands used in the worktree corrupted `extension.ts` at line 381. The helper methods `hasPanels()`, `closeAllPanels()`, and `_getActiveWebview()` were inserted on a single line instead of properly formatted.

### The Fix Required
After committing the staged services, manually add these methods to `extension.ts` around line 380 (after `_disposePanel`):

```typescript
	/**
	 * Check if any panels are open.
	 */
	public hasPanels(): boolean {
		return this._panels.size > 0;
	}

	/**
	 * Close all open panels.
	 */
	public closeAllPanels(): void {
		for (const [panelId, panelState] of this._panels) {
			panelState.panel.dispose();
		}
		this._panels.clear();
		this._activePanelId = undefined;
	}

	/**
	 * Get the active webview (from panels or sidebar).
	 */
	private _getActiveWebview(): vscode.Webview | undefined {
		if (this._activePanelId) {
			const panelState = this._panels.get(this._activePanelId);
			if (panelState?.panel?.webview) {
				return panelState.panel.webview;
			}
		}
		return this._webview;
	}
```

---

## Quick-Scan Summary

| Issue # | Description | Status | Files Created |
|---------|-------------|--------|---------------|
| #8 | God class refactoring | ✅ Services created | MessageRouter, PanelManager |
| #9 | Redundant process spawning | ⏳ Needs integration | - |
| #10 | Switch statement smell | ✅ MessageRouter pattern | MessageRouter.ts |
| #11 | State leakage | ✅ PanelManager created | PanelManager.ts |
| #12 | Legacy _panel removal | ⏳ Needs manual fix | - |
| #13 | Debounce stdout | ✅ Created | MessageDebouncer.ts |
| #14 | Virtualization | ⏳ Needs react-virtuoso | - |
| #15 | Blocking thinking overlay | ✅ ThinkingState added | uiStore.ts |
| #16 | Memory monitoring | ✅ Created | MemoryMonitor.ts |
| #17 | useVSCodeMessaging switch | ✅ Created | messageHandlers.ts |
| #18 | CLI schema validation | ✅ Created | CliSchemas.ts |

---

## ✅ No Breaking Changes (Yet)

The services are additive. Breaking changes will occur when extension.ts is updated to use them.

---

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/services/MessageRouter.ts` | **NEW** | Handler registry pattern for webview messages |
| `src/services/PanelManager.ts` | **NEW** | Centralized multi-panel state management |
| `src/services/CliSchemas.ts` | **NEW** | Zod schemas for CLI JSON output validation |
| `src/services/MessageDebouncer.ts` | **NEW** | Batches streaming messages to reduce re-renders |
| `src/services/MemoryMonitor.ts` | **NEW** | Periodic memory usage monitoring with thresholds |
| `src/services/index.ts` | Modified | Exports all new services |
| `src/webview/lib/messageHandlers.ts` | **NEW** | Frontend message handler registry |
| `src/webview/stores/uiStore.ts` | Modified | Added ThinkingState for inline indicator |

---

## Key Interfaces

### MessageRouter (Backend)
```typescript
export class MessageRouter {
  register<T>(type: string, handler: MessageHandler<T>): void;
  registerAll(handlers: Record<string, MessageHandler>): void;
  async route(message: { type: string }, panelId?: string): Promise<boolean>;
}
```

### PanelManager
```typescript
export class PanelManager {
  generatePanelId(): string;
  registerPanel(panelId: string, state: PanelState): void;
  getPanel(panelId: string): PanelState | undefined;
  closeAllPanels(): void;
  disposePanel(panelId: string): Promise<void>;
}
```

### ThinkingState (Frontend)
```typescript
export interface ThinkingState {
  isActive: boolean;
  isExpanded: boolean;  // For collapsible inline display
  content: string;
  startTime: number | null;
}
```

### CliSchemas (Zod)
```typescript
export const ControlRequestSchema = z.object({
  type: z.literal('control_request'),
  request_id: z.string(),
  tool_name: z.string(),
  input: z.record(z.unknown()),
});
export function parseCliMessage(json: unknown): { success: true; data: CliMessage } | { success: false; error: z.ZodError };
```

---

## Environment & Dependencies

| Type | Name | Change | Notes |
|------|------|--------|-------|
| Dep | `zod` | Already at `^4.2.1` | Used by CliSchemas.ts |
| Dep | `react-virtuoso` | **NOT ADDED** | Required for #14 virtualization |

---

## Verification

**Build Status**: ❌ Fails due to corrupted extension.ts (staged services are clean)

**To verify services compile:**
```bash
# Commit staged changes first
git commit -m "feat: add services for technical debt fixes"

# Build should pass for services, fail for extension.ts
npm run compile
```

---

## Open Loops

### Known Issues
1. **extension.ts line 381 corrupted** - sed inserted methods on single line
2. **Feature branch deleted** - commits `a713683`, `2eea960`, `8ef4ea6` are orphaned but accessible by SHA
3. **Merge was reset** - `git reset --hard HEAD~1` removed merge commit `918298d`

### Orphaned Commits (Still Accessible)
```
a713683 feat: integrate MemoryMonitor for memory tracking
2eea960 refactor: integrate MessageRouter to replace switch statement
8ef4ea6 refactor: remove legacy _panel property from ClaudeChatProvider
a250982 feat: add services for technical debt fixes  <-- CLEAN, cherry-picked
```

### What's Left To Do

1. **Commit staged services** (from cherry-pick a250982)
2. **Fix extension.ts manually**:
   - Remove legacy `public _panel` property (line ~155)
   - Add helper methods (hasPanels, closeAllPanels, _getActiveWebview)
   - Update ClaudeChatWebviewProvider to use `hasPanels()` and `closeAllPanels()`
   - Update `_postMessage` to remove legacy `_panel` fallback
   - Update `showInWebview` and `dispose` methods
3. **Integrate MessageRouter** (can reference commit 2eea960 for guidance):
   - Add `import { MessageRouter, getMemoryMonitor } from './services';`
   - Add `private _messageRouter: MessageRouter = new MessageRouter();`
   - Add `_initializeMessageRouter()` method with all handlers
   - Replace switch statement in `_handleWebviewMessage`
4. **Integrate MemoryMonitor**:
   - Call `getMemoryMonitor().start()` in constructor
   - Call `getMemoryMonitor().stop()` in dispose
5. **#14 Virtualization** - Add react-virtuoso dependency

### Resume Prompt
```
Resume technical debt refactoring. Current state:
- Services staged from cherry-pick a250982 (NOT committed)
- extension.ts needs manual fixes for helper methods
- Reference orphaned commit 2eea960 for MessageRouter integration pattern

Start: Commit staged files, then fix extension.ts:380 with helper methods.
Run: npm run compile to verify.
```

---

## Context Manifest

Priority files for next session:
- `src/extension.ts` - Needs manual fixes at line ~155 and ~380
- `src/services/MessageRouter.ts` - Integration pattern reference
- `src/services/index.ts` - All exports ready
- `src/webview/stores/uiStore.ts` - ThinkingState already integrated
- Orphaned commit `2eea960` - Has working MessageRouter integration code

---

## Git State Summary

```bash
# Current HEAD
git log --oneline -1
# 1730e31 fix: add passthrough to Zod schemas for JSONL parsing

# Staged changes (from cherry-pick)
git status
# Changes to be committed:
#   new file:   src/services/CliSchemas.ts
#   new file:   src/services/MemoryMonitor.ts
#   new file:   src/services/MessageDebouncer.ts
#   new file:   src/services/MessageRouter.ts
#   new file:   src/services/PanelManager.ts
#   modified:   src/services/index.ts
#   new file:   src/webview/lib/messageHandlers.ts
#   modified:   src/webview/stores/uiStore.ts

# Orphaned feature commits (accessible by SHA)
git show a250982 --stat  # Clean services commit
git show 2eea960 --stat  # MessageRouter integration (has sed corruption)
git show 8ef4ea6 --stat  # Legacy _panel removal (has sed corruption)
git show a713683 --stat  # MemoryMonitor integration (has sed corruption)
```
