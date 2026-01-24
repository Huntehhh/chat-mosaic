# Worktree 2: UI Components

**Files:** `src/webview/components/**/*`
**Sparse checkout:** `./scripts/wt add components src/webview/components/`

---

## Quick Wins (High Impact, Low Effort)

### 1. Collapsible Tool Output Cards (Feature 1.1)
- **Location:** `components/molecules/tool-use-card.tsx` (new)
- Expand/collapse with smart summaries
- Icon per tool type, error state styling

### 2. Skeleton Loaders (Feature 1.2)
- **Location:** `components/atoms/tool-output-skeleton.tsx` (new)
- Animated placeholder during tool execution
- Match tool card dimensions

### 3. Ghost Cursor (Feature 1.3)
- **Location:** `components/atoms/streaming-cursor.tsx` (new)
- Blinking cursor at end of streaming text
- CSS animation, inline-block

### 4. VS Code CSS Variables (Feature 1.5)
- **Location:** `components/styles/` or global CSS
- Map VS Code theme tokens to Tailwind variables
- `--background`, `--foreground`, `--primary`, etc.

---

## High Value Components

### 5. Context Pinning Shelf (Feature 2.1)
- **Location:** `components/organisms/pinned-context-shelf.tsx` (new)
- Drag-and-drop file pinning
- Token count display per file
- Sticky header with backdrop blur

### 6. Permission Request Banner (Feature 2.3)
- **Location:** `components/molecules/permission-banner.tsx` (new)
- Bottom sticky banner (not inline bubble)
- Framer Motion slide-up animation
- Approve/Deny buttons

### 7. Inline Diff View (Feature 2.6)
- **Location:** `components/molecules/file-diff-view.tsx` (new)
- Use `react-diff-view` library
- Side-by-side or unified mode
- File path header

### 8. Collapsible Thinking Block (Feature 4.6)
- **Location:** `components/molecules/thinking-block.tsx` (new)
- Accordion-style expand/collapse
- Amber accent, pulsing indicator
- Max-height transition

---

## Animation & Polish

### 9. Message Entry Animations (Feature 2.5)
- **Location:** `components/molecules/message-item.tsx` (modify)
- Framer Motion staggered fade-in
- `initial`, `animate` props
- 50ms delay per message

### 10. Responsive Layout Components (Feature 2.4)
- **Location:** `components/atoms/stat-icon.tsx` (new)
- Icon-only mode for narrow widths (<300px)
- Tooltip on hover
- `useAdaptiveLayout` hook integration

---

## Complex Features

### 11. Session Branch Indicator (Feature 3.1)
- **Location:** `components/molecules/message-branch-indicator.tsx` (new)
- Git branch icon with child count
- Dropdown to switch branches
- Small, inline placement

---

## New Dependencies

```json
{
  "dependencies": {
    "framer-motion": "^10.x",
    "react-diff-view": "^3.x",
    "diff": "^5.x"
  }
}
```

---

## Component Checklist

| Component | Type | Priority | Deps |
|-----------|------|----------|------|
| ToolUseCard | molecule | High | - |
| ToolOutputSkeleton | atom | High | - |
| StreamingCursor | atom | Medium | - |
| PinnedContextShelf | organism | High | - |
| PermissionBanner | molecule | Medium | framer-motion |
| FileDiffView | molecule | High | react-diff-view |
| ThinkingBlock | molecule | High | - |
| MessageBranchIndicator | molecule | Medium | - |
| StatIcon | atom | Medium | - |

---

## Verification

After adding components:
```bash
npm run compile
```

Components should be self-contained. Props-based, no direct store access.
