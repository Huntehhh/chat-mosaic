# Changelog - 2025-12-19 (Session 7)

## MCP Server Editor Components & Tool Display Improvements

- **Goal**: Build visual MCP server management UI components and fix tool display issues
- **Risk Level**: Low - New components, no breaking changes to existing functionality

Created full component library for MCP server management using atomic design (atoms → molecules → organisms). Also fixed CLI history path transformation and integrated DiffViewer for Edit operations.

---

## ✅ No Breaking Changes

All changes are additive - new components that aren't wired into the main app yet.

---

## Environment & Dependencies

| Type | Name | Change | Notes |
|------|------|--------|-------|
| None | - | - | No new dependencies |

---

## Added

### Atoms (`src/webview/components/ui/`)

| File | Purpose |
|------|---------|
| `status-dot.tsx` | **NEW** - Status indicator (active/disabled/error/warning) with glow effects |
| `chip.tsx` | **NEW** - Removable chips with X button + AddChip variant |
| `type-toggle.tsx` | **NEW** - Two-button toggle selector (stdio/sse) |

### Molecules (`src/webview/components/molecules/`)

| File | Purpose |
|------|---------|
| `mcp-server-card.tsx` | **NEW** - Server card with status, name, type badge, hover actions |
| `key-value-row.tsx` | **NEW** - Env var editor row (key/value inputs + delete) |
| `chip-input.tsx` | **NEW** - Chip collection with inline add functionality |
| `delete-confirm-dialog.tsx` | **NEW** - Delete confirmation modal with warning icon |

### Organisms (`src/webview/components/organisms/`)

| File | Purpose |
|------|---------|
| `mcp-server-list.tsx` | **NEW** - Full list panel with header, cards, empty state, footer |
| `mcp-editor-form.tsx` | **NEW** - Complete editor form with stdio/sse field switching |

### Documentation

| File | Purpose |
|------|---------|
| `docs/stitch-prompts/mcp-server-manager.md` | **NEW** - High-fidelity Stitch prompts for UI generation |

---

## Changed

### `src/webview/components/molecules/form-field.tsx`
- Added CVA variants for label styling
- New `labelVariant` prop: `'default'` | `'uppercase'`
- Uppercase variant matches MCP editor design (11px, tracking-wider)

### `src/webview/components/molecules/tool-use-block.tsx`
- Integrated DiffView for Edit operations
- Added `oldContent`/`newContent` props
- Renders diff with red/green highlighting when edit data available

### `src/extension.ts`
- Fixed merge conflicts from feature/multi-window-processes branch
- Kept case-insensitive CLI folder lookup (Windows compatibility)
- Kept tool_result filtering in user message parsing

---

## Key Interfaces

```typescript
// MCP Server type
interface McpServer {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  status: 'running' | 'disabled' | 'error';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

// Status dot variants
type StatusDotStatus = 'active' | 'disabled' | 'error' | 'warning';

// Type toggle (generic)
interface TypeToggleProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}
```

---

## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `src/webview/components/ui/status-dot.tsx` | **NEW** | CVA-based status indicator |
| `src/webview/components/ui/chip.tsx` | **NEW** | Chip + AddChip components |
| `src/webview/components/ui/type-toggle.tsx` | **NEW** | Generic toggle selector |
| `src/webview/components/molecules/mcp-server-card.tsx` | **NEW** | Server list item |
| `src/webview/components/molecules/key-value-row.tsx` | **NEW** | Env var row |
| `src/webview/components/molecules/chip-input.tsx` | **NEW** | Chip collection editor |
| `src/webview/components/molecules/delete-confirm-dialog.tsx` | **NEW** | Delete confirmation |
| `src/webview/components/molecules/form-field.tsx` | Modified | Added label variants |
| `src/webview/components/organisms/mcp-server-list.tsx` | **NEW** | List panel organism |
| `src/webview/components/organisms/mcp-editor-form.tsx` | **NEW** | Editor form organism |
| `docs/stitch-prompts/mcp-server-manager.md` | **NEW** | UI design prompts |

---

## Verification

**Command**: `npm run compile`
**Results**: ✅ Build succeeded

**Manual checks**:
- All components compile without errors
- CVA variants properly typed
- No TypeScript errors

---

## Open Loops

### Not Yet Wired
- MCP editor components exist but aren't integrated into main app
- Need to add routes/navigation to access MCP manager panel
- Backend MCP CRUD operations not implemented yet

### Source HTML Files
Located at `src/ui/MCP EDITOR/` - Stitch exports used as reference:
- `mcp_server_list_panel/`
- `mcp_server_list_empty_state_panel/`
- `mcp_server_editor_form_(stdio_type)_/`
- `delete_server_confirmation_dialog/`

### Next Immediate Actions
1. Wire MCP list panel into sidebar or modal
2. Implement backend `_loadMcpServers()` and `_saveMcpConfig()` in extension.ts
3. Add message handlers for MCP CRUD operations

### Resume Prompt
```
Resume MCP editor integration. Components built in src/webview/components/.
Next: Wire McpServerList into UI, add backend handlers in extension.ts.
Reference HTML in src/ui/MCP EDITOR/ for visual targets.
```

---

## Context Manifest

Priority files for next session:
- `src/webview/components/organisms/mcp-server-list.tsx` - Main list component
- `src/webview/components/organisms/mcp-editor-form.tsx` - Editor form
- `src/extension.ts` - Need to add MCP config handlers
- `docs/stitch-prompts/mcp-server-manager.md` - Design reference
