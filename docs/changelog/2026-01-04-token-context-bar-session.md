# Changelog - 2026-01-04 (Token & Context Bar Session)

## Token Display Fixed, Context Progress Bar Added

- **Goal**: Fix token counting bugs and add a visual context window progress bar
- **Risk Level**: Medium - Multiple bug fixes in token flow, new UI component

Fixed critical bug where token counts were always showing 0 despite cost tracking working. Root cause: Claude CLI returns token usage in `result.usage` (root level), not `assistant.message.usage`. Added new context progress bar component with tick marks at 25/50/75%.

---

## Quick-Scan Summary

| Metric | Before | After |
|--------|--------|-------|
| Token display | Always 0 | Correctly shows input/output tokens |
| Context calculation limit | 200,000 | 190,000 (10K safety buffer) |
| Context bar visibility | Hidden at 0% | Always visible |
| Token icon | Showed count number | Icon only (cleaner) |

---

## ✅ No Breaking Changes

All changes are backward compatible. Token handlers now support both incremental (`currentInputTokens`) and absolute (`setTokensInput`) modes.

---

## Environment & Dependencies

No changes to dependencies or environment variables.

---

## Added

### `src/webview/components/ui/context-progress-bar.tsx`
- New context window progress bar component
- Solid fill bar (120px × 14px) with tick marks at 25%, 50%, 75%
- Color-coded by level: green (0-50%), yellow (50-75%), red (75-100%)
- Tick lines extend through the bar with white labels below
- `overflow-visible` for tick labels that extend below bar
- `self-center` and `mb-[14px]` for vertical alignment with token icon

### `src/extension.ts` - Context calculation utility
- Added `calculateContextState()` helper function at module level
- Centralized context percentage and level calculation
- `MAX_CONTEXT_TOKENS = 190000` constant (10K buffer from 200K)

### Token extraction from `result.usage`
- Added code in `case 'result':` to extract tokens from `jsonData.usage`
- This is where Claude CLI actually puts token data (not in assistant messages)
- Sends `updateTokens` and `updateContext` messages to webview

---

## Changed

### `src/webview/components/ui/token-display.tsx`
- Removed token count number from badge (icon only now)
- Added `title` attribute for hover tooltip showing token count
- Icon size increased to 16px
- Added `group-hover:text-[#fafafa]` for hover effect

### `src/webview/components/organisms/chat-input.tsx`
- Progress bar now always visible (removed `> 0` check)
- Uses `contextPercentage ?? 0` for null safety

### `src/webview/hooks/handlers/useTokenHandlers.ts`
- `updateTokens` handler now supports dual mode:
  - `setTokensInput`/`setTokensOutput` → SET absolute values (restore mode)
  - `currentInputTokens`/`currentOutputTokens` → ADD incremental (streaming mode)
- `updateTotals` handler now processes `totalTokensInput`/`totalTokensOutput`
- Added verbose console logging for debugging

### `src/webview/hooks/handlers/useSessionHandlers.ts`
- Changed from `updateTokens` to `setTokens` for session restoration
- Prevents double-counting when restoring session state

### `src/extension.ts` - `_sendReadyMessage()`
- Now sends token totals on initialization via `updateTokens` message
- Uses `setTokensInput`/`setTokensOutput` fields for absolute restore

### `src/extension.ts` - Context calculation
- Changed limit from 200,000 → 190,000 (10K user buffer)
- Color thresholds: `< 50%` → low, `< 75%` → medium, `< 90%` → high, else critical
- Extracted duplicate calculation into `calculateContextState()` function

---

## Fixed

### Token counts always showing 0
- **Root cause**: Looking for `jsonData.message.usage` in assistant messages, but Claude CLI puts usage data at `jsonData.usage` in the `result` message
- **Fix**: Added token extraction in `case 'result':` handler
- Now correctly accumulates `input_tokens`, `output_tokens`, cache tokens

### Session restore double-counting
- **Root cause**: `useSessionHandlers` used `updateTokens()` (adds) instead of `setTokens()` (sets)
- **Fix**: Changed to use `setTokens()` for absolute value restoration

### `updateTotals` ignoring token fields
- **Root cause**: Handler only processed `totalCost` and `requestCount`
- **Fix**: Now also calls `setTokens()` when `totalTokensInput`/`totalTokensOutput` present

### Token data not sent on init
- **Root cause**: `_sendReadyMessage()` only sent a string, not token data
- **Fix**: Added `updateTokens` message with `setTokensInput`/`setTokensOutput` fields

---

## Key Interfaces

```typescript
// Token update data - supports both modes
interface TokenUpdateData {
  // Incremental (streaming)
  currentInputTokens?: number;
  currentOutputTokens?: number;
  // Absolute (restore)
  setTokensInput?: number;
  setTokensOutput?: number;
  totalCost?: number;
  requestCount?: number;
}

// Context calculation utility
function calculateContextState(contextTokens: number): {
  contextPercentage: number;
  contextLevel: ContextLevel; // 'low' | 'medium' | 'high' | 'critical'
}

// Context progress bar props
interface ContextProgressBarProps {
  percentage: number;        // 0-100
  level?: ContextLevel;      // Color coding
  isStreaming?: boolean;     // Glow/pulse effect
}
```

---

## Files Summary

| File | Status | Notes |
|------|--------|-------|
| `src/webview/components/ui/context-progress-bar.tsx` | Modified | Complete rewrite - solid bar with ticks |
| `src/webview/components/ui/token-display.tsx` | Modified | Removed number, icon only |
| `src/webview/components/organisms/chat-input.tsx` | Modified | Always show progress bar |
| `src/webview/hooks/handlers/useTokenHandlers.ts` | Modified | Dual-mode token handling |
| `src/webview/hooks/handlers/useSessionHandlers.ts` | Modified | Use setTokens for restore |
| `src/webview/hooks/handlers/useFileHandlers.ts` | Modified | Use filename as unique ID |
| `src/webview/App.tsx` | Modified | Use c.id for history conversations |
| `src/extension.ts` | Modified | Token extraction from result.usage, context calc utility |

---

## Verification

**Command**: `npm run compile`
**Results**: ✅ Compilation successful (extension + webview)

**Manual checks**:
- Token counts now update after Claude responds
- Progress bar visible at 0% and fills based on context usage
- Tick marks at 25/50/75 with white labels
- Token icon shows icon only, hover for count

---

## Debug Logging Added

Extensive logging added for token flow debugging (can be removed later):

- `[JSONL]` - All incoming JSONL messages with type/keys
- `[Token Debug]` - Backend token extraction and accumulation
- `[Token Handler]` - Frontend message receipt and processing

Look for these in VS Code Output panel ("Claude Code Chat") and Developer Tools Console.

---

## Research Notes

Token usage location discovered via web search and claude-code-guide agent:
- **`assistant` messages**: `message.usage` (per-response, but often empty in streaming)
- **`result` messages**: `usage` at root level (final totals - this is the reliable source)

Sources:
- [Claude Code Status Line Docs](https://code.claude.com/docs/en/statusline)
- [Claude Code Headless Mode](https://code.claude.com/docs/en/headless)
- [ccusage tool](https://github.com/ryoppippi/ccusage)
