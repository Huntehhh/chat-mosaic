# Plan: UI Components Implementation

**Worktree:** `components`
**Files:** `src/webview/components/**/*`, `src/webview/styles/globals.css`
**Sparse Checkout:** `./scripts/wt add components src/webview/components/ src/webview/styles/`

---

## New Dependency

```bash
npm install framer-motion
```

All new components will use framer-motion. Existing CSS animations will be migrated.

---

## Existing Assets (Leverage These)

| Existing Component | Location | Reusable For |
|-------------------|----------|--------------|
| `CollapsibleCard` | molecules/ | Tool cards, thinking blocks |
| `ToolUseBlock` | molecules/ | Enhance for collapse |
| `PixelLoader` | molecules/ | Running states |
| `DiffView` | molecules/ | Edit operations |
| `cn()` utility | lib/utils.ts | All components |
| CVA pattern | all components | Variants |

---

## Quick Wins (4 Items)

### 1. Tool Output Skeleton Loader
**File:** `src/webview/components/atoms/tool-output-skeleton.tsx`

```
┌─────────────────────────────────┐
│ ░░░░  ░░░░░░░░░░░░░░░░░       │ ← icon + title placeholder
├─────────────────────────────────┤
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│ ░░░░░░░░░░░░░░░░░░░░░░        │ ← content lines
│ ░░░░░░░░░░░░░░░               │
└─────────────────────────────────┘
```

**Implementation:**
- Wrap in `rounded-lg border bg-muted/30 p-3`
- Use framer-motion pulse animation
- Match dimensions of `ToolUseBlock`
- Props: `lines?: number` (default 3)

### 2. Streaming Cursor
**File:** `src/webview/components/atoms/streaming-cursor.tsx`

```tsx
import { motion } from 'framer-motion';

export const StreamingCursor = () => (
  <motion.span
    className="inline-block w-0.5 h-4 bg-foreground ml-0.5"
    animate={{ opacity: [1, 0] }}
    transition={{ duration: 0.8, repeat: Infinity, ease: "steps(2)" }}
  />
);
```

**Integration:** Add to `MessageBlock` when `isStreaming` prop is true

### 3. VS Code CSS Variable Integration
**File:** `src/webview/styles/globals.css` (modify existing)

**Add mapping block:**
```css
:root {
  /* VS Code → Tailwind bridge */
  --background: var(--vscode-editor-background, #09090b);
  --foreground: var(--vscode-editor-foreground, #fafafa);
  --muted: var(--vscode-input-background, #171717);
  --border: var(--vscode-panel-border, #222225);
  --primary: var(--vscode-button-background, #FFA344);
  --destructive: var(--vscode-errorForeground, #FF7369);
}
```

**Note:** Keep hardcoded fallbacks for consistency

### 4. Collapsible Tool Output Cards
**File:** `src/webview/components/molecules/tool-use-block.tsx` (modify existing)

**Current state:** Tool blocks show IN/OUT but aren't fully collapsible cards
**Enhancement:** Wrap in `CollapsibleCard` with smart summary

**Changes:**
1. Import `CollapsibleCard` from molecules
2. Add `collapsed` state (default: true)
3. Generate smart summary based on `toolName`:
   - `Bash`: "Running '{command.slice(0,40)}...'"
   - `Read`: "Reading {file_path}"
   - `Write`: "Writing to {file_path}"
   - `Edit`: "Editing {file_path}"
   - Default: "Executing {toolName}"
4. Show summary in header, full content when expanded

---

## High Value Components (4 Items)

### 5. Context Pinning Shelf
**File:** `src/webview/components/organisms/pinned-context-shelf.tsx`

```
┌────────────────────────────────────────────────────────┐
│ 📁 Drop files here to pin context                      │  ← empty state
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ [📄 utils.ts (245)] [📄 App.tsx (1.2k)] [✕]           │  ← with files
└────────────────────────────────────────────────────────┘
```

**Props Interface:**
```typescript
interface PinnedContextShelfProps {
  pinnedFiles: PinnedFile[];
  onDrop: (paths: string[]) => void;
  onUnpin: (path: string) => void;
}

interface PinnedFile {
  path: string;
  name: string;
  tokens?: number;
}
```

**Implementation:**
- Sticky header with `backdrop-blur`
- `onDragOver`, `onDrop` handlers
- File badges using existing `Badge` component
- Token count display per file
- X button to unpin
- **UI-only with mock data** (backend wiring later)

### 6. Permission Request Banner
**File:** `src/webview/components/molecules/permission-banner.tsx`

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Permission Required                                  │
│ Bash: rm -rf node_modules...                           │
│                                    [Deny] [Allow]       │
└─────────────────────────────────────────────────────────┘
```

**Props Interface:**
```typescript
interface PermissionBannerProps {
  permission: {
    id: string;
    tool: string;
    input: Record<string, unknown>;
  };
  onApprove: () => void;
  onDeny: () => void;
}
```

**Implementation with framer-motion:**
```tsx
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {permission && (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed bottom-20 left-4 right-4 z-50 bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4"
    >
      {/* content */}
    </motion.div>
  )}
</AnimatePresence>
```

- Truncate input display to 100 chars
- Use existing `Button` component for actions

### 7. Inline Diff View Enhancement
**File:** `src/webview/components/molecules/file-diff-view.tsx` (new wrapper)

**Wrap existing DiffView with file header:**
```
┌─ src/utils.ts ─────────────────────────────────────────┐
│ - const foo = 'old';                                   │
│ + const foo = 'new';                                   │
└────────────────────────────────────────────────────────┘
```

**Props Interface:**
```typescript
interface FileDiffViewProps {
  filePath: string;
  oldContent: string;
  newContent: string;
  viewType?: 'split' | 'unified';
}
```

**Implementation:**
- File path header with `bg-muted` styling
- Reuse existing `DiffView` component internally
- Add view type toggle if needed

### 8. Collapsible Thinking Block
**File:** `src/webview/components/molecules/thinking-block.tsx`

```
┌──────────────────────────────────────────────────────┐
│ 🟠 Thinking...                               [▼]     │  ← collapsed
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ 🟠 Thinking...                               [▲]     │
├──────────────────────────────────────────────────────┤
│ Let me analyze this problem step by step...          │  ← expanded
│ First, I'll consider the architecture...             │
└──────────────────────────────────────────────────────┘
```

**Props Interface:**
```typescript
interface ThinkingBlockProps {
  content: string;
  isExpanded?: boolean;
  onToggle?: () => void;
}
```

**Implementation:**
- Left amber border: `border-l-4 border-amber-500`
- Subtle background: `bg-amber-500/5`
- Pulsing indicator (use framer-motion)
- Max-height transition for smooth expand/collapse
- Chevron rotation on toggle


---

## Framer Motion Migration (Existing Animations)

### Animations to Migrate

| CSS Animation | File Using It | framer-motion Replacement |
|---------------|---------------|---------------------------|
| `modalEnter` | `Modal` | `initial={{ opacity: 0, scale: 0.95 }}` `animate={{ opacity: 1, scale: 1 }}` |
| `slideFromRight` | `MCPManagerPanel` | `initial={{ x: "100%" }}` `animate={{ x: 0 }}` |
| `statusPulse` | `StatusDot` | `animate={{ opacity: [1, 0.3, 1] }}` with `repeat: Infinity` |
| `pulseSubtle` | `CollapsibleCard` | `animate={{ opacity: [1, 0.7, 1] }}` with `repeat: Infinity` |
| `thinkingPulse` | `ThinkingOverlay` | `animate={{ opacity: [0.5, 1], scale: [0.98, 1] }}` |
| `pixelWave` | `PixelLoader` | Custom stagger with `motion.div` per pixel |
| `tinkeringSpin` | `TinkeringIndicator` | `animate={{ rotate: 360 }}` `transition={{ repeat: Infinity }}` |

### Migration Files

| File | Changes |
|------|---------|
| `organisms/modal.tsx` | Replace `animate-modal-enter` with `motion.div` |
| `organisms/mcp-manager-panel.tsx` | Replace `animate-slide-in` with `motion.div` |
| `ui/status-dot.tsx` | Add `motion.span` with opacity animation |
| `molecules/collapsible-card.tsx` | Add `motion.div` for running state |
| `organisms/thinking-overlay.tsx` | Replace CSS with `motion.div` |
| `molecules/pixel-loader.tsx` | Use `motion.div` with staggerChildren |
| `molecules/tinkering-indicator.tsx` | Use `motion.div` with rotate |

### Shared Animation Variants

Create `src/webview/lib/animations.ts`:
```typescript
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideUp = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 20, opacity: 0 },
};

export const slideFromRight = {
  initial: { x: "100%" },
  animate: { x: 0 },
  exit: { x: "100%" },
};

export const modalVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const pulseVariants = {
  animate: {
    opacity: [1, 0.5, 1],
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
  }
};
```

### CSS Cleanup

After migration, remove from `globals.css`:
- `@keyframes modalEnter`
- `@keyframes slideFromRight`
- `@keyframes statusPulse`
- `@keyframes pulseSubtle`
- `@keyframes thinkingPulse`
- `@keyframes tinkeringSpin`
- `.animate-*` classes for above

**Keep:** `@keyframes pixelWave` if complex stagger is too verbose in JS

---

## Implementation Order

1. **Setup:**
   - `npm install framer-motion`
   - Create `src/webview/lib/animations.ts`

2. **New Atoms:**
   - `streaming-cursor.tsx`
   - `tool-output-skeleton.tsx`

3. **New Molecules:**
   - `thinking-block.tsx`
   - `permission-banner.tsx`
   - `file-diff-view.tsx`
   - Modify `tool-use-block.tsx`

4. **New Organisms:**
   - `pinned-context-shelf.tsx` (UI-only, mock data)

5. **Migrate Existing (in order of complexity):**
   - `modal.tsx` (simple fade+scale)
   - `mcp-manager-panel.tsx` (slide)
   - `status-dot.tsx` (pulse)
   - `tinkering-indicator.tsx` (spin)
   - `thinking-overlay.tsx` (pulse+scale)
   - `collapsible-card.tsx` (conditional pulse)
   - `pixel-loader.tsx` (stagger - most complex)

6. **CSS Cleanup:**
   - Remove migrated keyframes from globals.css

7. **VS Code Variables:**
   - Update globals.css with VS Code → Tailwind mapping

---

## Files Changed Summary

| File | Action | Lines Est. |
|------|--------|------------|
| `lib/animations.ts` | NEW | ~40 |
| `atoms/streaming-cursor.tsx` | NEW | ~15 |
| `atoms/tool-output-skeleton.tsx` | NEW | ~30 |
| `molecules/thinking-block.tsx` | NEW | ~50 |
| `molecules/permission-banner.tsx` | NEW | ~60 |
| `molecules/file-diff-view.tsx` | NEW | ~40 |
| `molecules/tool-use-block.tsx` | MODIFY | +30 |
| `organisms/pinned-context-shelf.tsx` | NEW | ~80 |
| `organisms/modal.tsx` | MODIFY | ~10 |
| `organisms/mcp-manager-panel.tsx` | MODIFY | ~10 |
| `ui/status-dot.tsx` | MODIFY | ~10 |
| `molecules/tinkering-indicator.tsx` | MODIFY | ~15 |
| `organisms/thinking-overlay.tsx` | MODIFY | ~15 |
| `molecules/collapsible-card.tsx` | MODIFY | ~15 |
| `molecules/pixel-loader.tsx` | MODIFY | ~30 |
| `styles/globals.css` | MODIFY | -50 (remove), +25 (VS Code vars) |

**Total:** 8 new files, 8 modified files, ~420 lines added, ~50 removed

---

## Verification

After each component:
```bash
npm run compile
```

After all components:
- Test in VS Code webview
- Verify animations work
- Check responsive behavior
- Confirm CSS keyframes removed don't break anything
