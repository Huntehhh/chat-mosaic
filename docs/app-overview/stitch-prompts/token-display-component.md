# Token Usage Display Component - Stitch Prompts

## Context

Compact token counter for VS Code extension chat interface. Displays AI token consumption inline with chat controls, expandable for detailed breakdown.

## Data Available

```
totalTokensInput: number
totalTokensOutput: number
cacheCreationTokens: number
cacheReadTokens: number
```

---

## Prompt (Single Generation - 2 Screens)

```
Generate two screens for Claude Code Chat token display:

=== SCREEN 1: Token Badge (Inline + Popover) ===

Compact token counter badge with expandable popover for VS Code chat extension.

STYLE: VS Code dark theme, #0f0f0f background, #FFA344 accent.

BADGE (collapsed state):
- Pill shape, 24px height, min-width 56px, inline in controls row
- Left: token/coin icon, 14px, #FFA344
- Center: count text "12.4k" format, 11px monospace #8b8b94
- Right: chevron-down, 8px
- Background: #171717, border 1px #222225
- Hover: border #FFA344/50, text #fafafa
- Active: border #FFA344, background #1a1a1a
- Placement: 12px gap, between context % and send button

POPOVER (expanded state, anchored below badge):
- Width: 220px, #0f0f0f bg, 1px #2a2a2e border, sharp corners
- Shadow: 0 8px 24px rgba(0,0,0,0.6)
- Header: "Token Usage" 11px uppercase #8b8b94 + X close 16px
- Separator: 1px #222225
- Stats grid (12px padding, 8px row gap):
  - "INPUT" → "8,234"
  - "OUTPUT" → "4,102"
  - "CACHE WRITE" → "1,024"
  - "CACHE READ" → "2,048"
  - Labels: 10px uppercase #52525b, Values: 13px monospace #fafafa
- Footer: separator + "TOTAL" #8b8b94 → "15,408" 14px bold #FFA344

=== SCREEN 2: Processing State Badge ===

Token badge during active AI streaming with animated elements.

SAME STRUCTURE as Screen 1 badge (24px pill, icon + count + chevron).

VISUAL CHANGES:
- Border: pulsing #FFA344 opacity 30%→60%, 1.5s cycle
- Text: #FFA344 instead of #8b8b94
- Icon: gentle pulse scale 100%→110%
- Glow: box-shadow 0 0 8px rgba(255,163,68,0.2), pulsing
- Count: number incrementing in real-time as tokens stream

RETURN TO IDLE:
- Animations fade out 300ms when streaming stops
- Border returns to #222225, text to #8b8b94
```

---

## Implementation Notes

**Number Formatting:**
```
< 1,000      → "847"
1,000-9,999  → "2.4k"
10,000-99,999 → "24.1k"
100,000+     → "124k"
```

**Component Hierarchy:**
```
TokenDisplay
├── TokenBadge (collapsed)
│   ├── TokenIcon
│   ├── TokenCount
│   └── ChevronIndicator
└── TokenPopover (expanded)
    ├── PopoverHeader
    ├── StatsList
    └── TotalFooter
```

**Z-Index:** Popover at z-100+ to float above chat elements.
