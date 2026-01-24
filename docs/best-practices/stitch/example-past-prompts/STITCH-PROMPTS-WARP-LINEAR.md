# Claude Code Chat - Stitch Prompts (Warp/Linear Style)

**Style:** Warp Terminal × Linear App × Claude.ai - terminal aesthetic, premium SaaS
**Accent Colors:** Amber (#FFA344) and Coral (#FF7369) - NO GREEN

---

## Build Order (7 Prompts)

1. **Prompt 1:** Complete app layout (header + chat container + input area + status bar)
2. **Prompt 2:** Chat messages (user messages + Claude responses + tool cards + code blocks)
3. **Prompt 3:** Input controls and modes (textarea + toggles + dropdowns + popups)
4. **Prompt 4:** Primary modals (settings + MCP servers + model selector)
5. **Prompt 5:** Secondary modals (history panel + slash commands + file picker)
6. **Prompt 6:** Permission system (permission dialog + thinking intensity + install modal)
7. **Prompt 7:** Visual polish (diff viewer + todo panel + loading states + error states)

---

## PROMPT 1: Complete App Layout

```
Dark sidebar panel for "Claude Code Chat" - an AI coding assistant.

STYLE: Warp Terminal meets Claude.ai. OLED black, minimal, premium developer tool.

COLORS:
- Background: #09090b (black), #0f0f0f (panels), #171717 (inputs)
- Text: #fafafa (primary), #8b8b94 (muted), #52525b (dim)
- Accent: #FFA344 (amber/orange) - use for buttons and active states
- Borders: #222225, 1px only

RULES:
- Sharp corners on all rectangles (0px radius)
- Pills/toggles stay rounded
- Compact layout, minimal padding
- No shadows, no suggestion cards, no icons in welcome area

LAYOUT (top to bottom):

1. HEADER - Dark bar, 48px height, 12px padding
   - Left: Title "Claude Code Chat"
   - Right: Settings icon, History icon, "New" button (amber #FFA344)

2. MAIN AREA - Black #09090b, centered content
   - "Ready" heading
   - "Type a message below" subtext
   - Empty otherwise

3. INPUT AREA - Dark panel #0f0f0f, 12px padding
   - Text input box (sharp corners, #171717 background)
   - CONTROLS ROW (below textarea, 8px gap): "Plan" pill toggle, "Think" pill toggle on left; Send button (amber circle) on right

4. STATUS BAR - SEPARATE row at very bottom, 28px height, border-top 1px #222225
   - Left: "ASK BEFORE EDITS" plain text (11px, #8b8b94, uppercase) - NOT a toggle
   - Right: "78% CONTEXT" plain text (11px, #52525b)
```

**Checkpoint:** OLED black, amber accents, sharp rectangles, rounded pills.

---

## PROMPT 2: Chat Messages & Tool Cards

```
Add chat messages to the MAIN AREA. Same colors/style as Prompt 1.

MESSAGE TYPES:

1. USER MESSAGE
   - Text on black background, 14px #fafafa
   - Long messages truncate with "Show more" link
   - @file references show as amber pills
   - Images show as thumbnails (max 200px)

2. CLAUDE MESSAGE
   - Left border: 2px amber #FFA344
   - Bullet "•" before text
   - Full markdown: bold, italic, lists, code blocks

3. THINKING BLOCK (collapsible)
   - Header: "Thinking" + chevron ▼
   - Collapsed by default, click to expand
   - Content: italic, #8b8b94

4. TOOL CARDS (collapsible, various types):
   All tools have: icon, name, chevron, "Click to expand"

   - **Read** - Document icon, shows file path (clickable)
   - **Edit** - Pencil icon, shows diff preview (red/green lines)
   - **Bash** - Terminal icon, shows command + output
   - **Glob** - Folder icon, shows "Found X files"
   - **Grep** - Search icon, shows pattern + matches
   - **MCP tools** - Puzzle icon, shows IN (JSON input) and OUT (result)

   Expanded state shows:
   - IN section: input parameters in monospace
   - OUT section: result/output, truncated with expand
   - File paths are clickable (#FFA344)
   - Error state: red #FF7369 text

5. DIFF VIEWER (inside Edit tool cards)
   - File path header (clickable)
   - Line numbers on left
   - Removed lines: red background, "−" prefix, strikethrough
   - Added lines: green background, "+" prefix
   - "Click to expand" for long diffs

6. CODE BLOCK
   - Dark container #0f0f0f, sharp corners
   - Header: language label + copy button
   - Syntax highlighting (amber keywords, coral numbers)
```

**Checkpoint:** Messages, collapsible thinking, tool cards with IN/OUT, diff viewer.

---

## PROMPT 3: Input Controls & Popups

```
Enhance INPUT AREA with full controls and popup overlays.

MODE TOGGLES (above textarea, margin-bottom 8px):
- Two toggles side by side, gap 12px
- Label: 11px, #8b8b94, margin-right 6px
- Track: 32px × 16px, background #222225, 8px radius
- Thumb: 12px circle, #fafafa
- Active: track #FFA344, thumb slides right, box-shadow: 0 0 8px rgba(245,158,11,0.2) (amber glow)
- Transition: 150ms ease
- "Plan" toggle and "Think" toggle (Think opens intensity modal when enabled)

TEXTAREA:
- Background: #171717
- Border: 1px #222225
- Border-radius: 0px (SHARP corners)
- Padding: 12px
- Font: monospace, 14px
- Placeholder: "Message..." (#52525b)
- Min-height: 44px, auto-expands with content
- Max-height: 200px, then scroll
- Focus: border #FFA344, box-shadow 0 0 0 2px rgba(255,163,68,0.1)
- Drag-over state: dashed border #FFA344, semi-transparent overlay with "Drop file" text centered

IMAGE ATTACHMENT PREVIEW (when image staged before send):
- Thumbnail: 48px × 48px, SHARP corners, border 1px #222225
- Position: inside textarea, bottom-left, margin 8px
- Remove button: 16px circle, #FF7369 bg, white "×", top-right of thumbnail
- Multiple images stack horizontally with 6px gap

CONTROLS ROW (below textarea, margin-top 8px, flex justify-between):
- Left group (gap 6px):
  - Model dropdown: "Opus ▾" (#171717 bg, #a1a1a1 text, SHARP corners, 11px)
  - MCP dropdown: "MCP ▾" (same style)
- Right group (gap 6px):
  - "/" button (ghost, 28px square, #8b8b94, hover #171717 bg)
  - "@" button (same)
  - Image button "🖼" (same)
  - Send button: 32px circle, #FFA344 amber background, white "↑" icon

FILE PICKER POPUP (triggered by @ or @ button):
- Floating above input, 100% width of input area
- Background #0f0f0f, border 1px #222225, SHARP corners
- Shadow: 0 4px 16px rgba(0,0,0,0.4)
- Max-height: 300px, scrollable
- Header: Search input "Search files..." (#171717 bg, magnifier icon)
- File list items:
  - File icon (colorful by type: JS=#F7DF1E, TS=#3178C6, PY=#3776AB)
  - Filename (14px, #fafafa, weight 500)
  - Path below (12px, #52525b)
  - Hover: #171717 background
  - Selected: left border 2px #FFA344
- Empty state: "No files found" centered, 13px, #52525b, subtle file icon above
- Footer: "↑↓ Navigate • Enter Select • Esc Close" (10px, #52525b)
- Keyboard navigation: arrows, enter, escape

SLASH COMMANDS POPUP (triggered by / or / button):
- Same floating style, 300px width
- "/" badge in search input
- Commands grouped:
  - "Custom" section header
  - "Built-in" section header
- Each command: emoji + name (14px) + description (12px, #8b8b94)
- Hover: #171717 background
- Selected: #FFA344 text
```

**Checkpoint:** Verify toggles, textarea states, both popup overlays with keyboard nav.

---

## PROMPT 4: Primary Modals

```
Design three primary modal dialogs.

MODAL BACKDROP: rgba(0,0,0,0.7), backdrop-filter blur(4px), click outside to close.

MODAL SHELL:
- Centered, max-width varies by modal
- Background #0f0f0f, border 1px #222225, SHARP corners
- Shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.05) (top lip lighting)
- Header: Title (16px, weight 500), X close button (ghost, #8b8b94)
- Animation: fade + scale from 0.95 to 1.0, 150ms ease

SETTINGS MODAL (340px wide, max 80vh):
- Header: "Settings"
- Scrollable content, padding 12px

"WSL Configuration" section:
- Section header (12px, uppercase, #8b8b94, tracking 0.5px)
- Toggle row: "Enable WSL" with switch
- When enabled, show inputs:
  - WSL Distribution (text input)
  - Node.js Path (text input)
  - Claude Path (text input)
- Helper text below each (11px, #52525b)

"Permissions" section:
- Empty state: Lock icon, "No permissions set" (#52525b)
- Permission list (max 200px scroll):
  - Each row: Tool badge (uppercase, #171717 bg, 10px) + pattern (mono) + trash icon
- "Add Rule" button (#FFA344 text, ghost)
- "Enable YOLO Mode" toggle at bottom (warning: #FF7369 tint when on)

"Display" section:
- "Compact tool output" toggle + number input beside it:
  - Number input: 60px wide, label "Preview height", suffix "px"
  - Sets how tall compacted previews are before truncation (e.g., 150px)
- "Compact MCP tool calls" toggle (semi-compact, click to expand fully)
- "Show to-do list" toggle

MCP SERVERS MODAL (340px wide):
- Header: "MCP Servers"
- Server list:
  - Each: Icon + Name (14px) + Type badge (HTTP/SSE/stdio) + Toggle + Menu "⋯"
  - Type badges: HTTP=#FFA344, SSE=#a1a1a1, stdio=#8b8b94
- "Add Server" button expands inline form:
  - Name input
  - Type dropdown
  - Conditional: URL (http/sse) or Command + Args (stdio)
  - Save/Cancel buttons
- "Popular Servers" section:
  - 2-column grid of cards
  - Each: Emoji (24px) + Name + Description (11px)
  - Cards: 📚 Context7, 🧠 Memory, 🔗 Sequential, 🎭 Puppeteer, 🌐 Fetch, 📁 Filesystem
  - Click to auto-add
- "Config Files" section at bottom:
  - 2x2 grid of ghost link buttons (#8b8b94 text, hover #fafafa)
  - "Local MCP Config" | "Global MCP Config"
  - "Local Settings" | "Global Settings"
  - Each opens respective JSON config file

MODEL SELECTOR MODAL (300px wide):
- Header: "Select Model"
- Three radio card options, stacked:
  - "Opus" - Most capable (description below)
  - "Sonnet" - Fast & capable
  - "Default" - Your configured model + "Configure" link
- Selected: left border #FFA344, #171717 fill
- Radio circle: #222225 border, #FFA344 fill when selected
```

**Checkpoint:** All three modals with proper sections and controls.

---

## PROMPT 5: Secondary Modals

```
Design three secondary overlays.

CONVERSATION HISTORY PANEL:
- Slide-in from right, 320px wide, full height
- Background #0f0f0f, left border 1px #222225
- Shadow: -4px 0 16px rgba(0,0,0,0.3), inset 1px 0 0 0 rgba(255,255,255,0.03) (left edge lighting)
- Animation: slide from right, 200ms ease
- Header: "History" (16px), X close button (#8b8b94)
- Search input below header (#171717 bg, border 1px #222225)
- Conversation list (scrollable):
  - Each item: padding 12px, hover #171717
  - Title (14px, weight 500, truncate)
  - Meta row: Source badge + timestamp + message count
  - Source badges: "CLI" (#9A6DD7 tint), "Chat" (#FFA344 tint)
  - Preview text (12px, #8b8b94, 2 lines max)
  - Active item: left border 2px #FFA344
- Click loads conversation

CHECKPOINT BROWSER (inside history panel, per conversation):
- Expandable section below each conversation item
- Header: "⏪ Checkpoints" with count badge, chevron toggle
- Checkpoint list (nested, indented 12px):
  - Each: Git SHA (monospace, 7 chars, #8b8b94) + message (truncate) + relative time
  - Hover: #171717 background
  - "Restore" button appears on hover (ghost, #FFA344 text)
- Empty state: "No checkpoints yet" (12px, #52525b)
- NOTE: UI placeholder - functionality coming soon

SLASH COMMANDS MODAL (340px wide):
- Header: "Commands"
- Sticky search with "/" prefix badge

"Custom Commands" section:
- Grid of existing custom command pills
- "➕ Add" card with dashed border
- Add form (when expanded):
  - Command name input with "/" prefix
  - Prompt textarea
  - Save/Cancel buttons

"Built-in Snippets" section:
- Grid: ⚡Performance, 🔒Security, 🔍Review, 📖Explain, 🐛Debug, 🔄Refactor, 🧪Test, 📝Document

"CLI Commands" section:
- Scrollable list of 23 commands
- Each: emoji + /name + description
- Commands: /clear, /compact, /config, /cost, /doctor, /help, /init, /login, /logout, /mcp, /memory, /model, /permissions, /review, /status, /usage, etc.
- Click opens terminal with command

FILE PICKER MODAL (320px wide):
- Header: "Select File"
- Large search input with magnifier
- File list:
  - Colorful file type icons (JS yellow, TS blue, PY green, MD gray)
  - Filename (14px, weight 500)
  - Path (12px, #52525b)
  - Images show 32px thumbnail
- Keyboard: ↑↓ arrows, Enter select, Esc close
- Click outside closes
```

**Checkpoint:** History panel sliding in, slash commands with sections, file picker.

---

## PROMPT 6: Permission Dialog & Install Modal

```
Design three NEW components (not the status bar - these are separate UI elements).

---

COMPONENT 1: PERMISSION REQUEST DIALOG

This is an INLINE CARD that appears INSIDE THE CHAT MESSAGE AREA when Claude needs permission to run a tool. It is NOT the "ASK BEFORE EDITS" status text - this is a separate popup card.

Container:
- Appears inline between messages in the chat
- Margin: 8px 0 12px
- Background: rgba(255,163,68,0.06) (subtle amber tint)
- Border: 1px rgba(255,163,68,0.2)
- Border-radius: 8px
- Padding: 14px

Header row:
- Left: ⚠️ Warning icon (#FFA344) + "Permission needed" text (14px, weight 500)
- Right: "⋯" menu button (opens dropdown with "🚀 Enable YOLO Mode", "📋 Copy command")

Content area:
- Tool badge: uppercase pill (e.g., "BASH"), #171717 bg, #FFA344 text, full rounded
- Command preview: monospace text showing the command (e.g., "npm install lodash"), #0f0f0f bg, 1px #222225 border, SHARP corners

Action buttons (row, right-aligned, gap 8px):
- "Deny" button (ghost style, #FF7369 text)
- "Allow" button (#171717 bg, #fafafa text)
- "Always Allow" button (#FFA344 bg, white text)

Show TWO states:
1. PENDING state: As described above with all three buttons
2. APPROVED state: Background rgba(255,163,68,0.08), shows "✓ Allowed" badge instead of buttons

---

COMPONENT 2: THINKING INTENSITY MODAL (300px wide)

- Header: "Thinking Depth"
- Description: "Higher = deeper reasoning, more tokens" (12px, #8b8b94)
- Horizontal slider:
  - Track: 4px height, #222225, full width
  - Thumb: 20px circle, #fafafa, shadow
  - Active portion: #FFA344 with glow (box-shadow 0 0 8px rgba(245,158,11,0.2))
  - 4 stop positions (0-3)
- Labels below track (evenly spaced):
  - "Think" | "Hard" | "Harder" | "Ultra"
  - Active label: #fafafa, weight 500
  - Inactive labels: #8b8b94
  - Labels are clickable
- Footer: "Confirm" button (full width, #FFA344 background, SHARP corners)

---

COMPONENT 3: INSTALL MODAL (300px wide, centered)
- Close X button top-right (#8b8b94)

Initial state:
- Download icon (40px, #FFA344)
- "Install Claude Code" (18px, weight 500)
- "Required for this extension" (13px, #8b8b94)
- "Install Now" button (full width, #FFA344 background, 44px height, SHARP corners)
- "View documentation" link below (#8b8b94, hover #fafafa)

Progress state:
- Circular progress ring (40px, #FFA344, animated rotation)
- "Installing..." (14px)
- "This may take a minute" (12px, #8b8b94)

Success state:
- Checkmark in circle (40px, #FFA344, animated draw)
- "Installation Complete" (18px, weight 500)
- "Start chatting" (13px, #8b8b94)
```

**Checkpoint:** Permission dialog (pending + approved states), thinking intensity modal, install modal (initial + progress + success states).

---

## PROMPT 7: Diff Viewer, Todo Panel & Loading States

```
IMPORTANT: Use the ORIGINAL "Claude Code Chat Main Interface" from Prompts 1-2.
DO NOT create a new layout. NO left sidebar, NO workspace tree, NO "RECENT" section.
The original design has: header bar, black main area, input at bottom, status bar.

Final components for visual polish - add these to the ORIGINAL interface:

DIFF VIEWER (inside messages, for file changes):
- Container: background #0f0f0f, border 1px #222225, SHARP corners
- Header bar: padding 8px 12px, border-bottom 1px #222225
  - Left: File path (monospace, 12px, #a1a1a1), clickable
  - Right: "Open Diff" button (ghost, #8b8b94, hover #fafafa)
- Diff content:
  - Line numbers gutter (24px wide, #171717 bg, #52525b text)
  - Added lines "+": background rgba(255,163,68,0.1), #FFA344 prefix
  - Removed lines "-": background rgba(255,115,105,0.1), #FF7369 prefix
  - Context lines: #a1a1a1 text, 60% opacity
  - Monospace font, 13px
- Collapsible: "Show X more lines" button for hidden context
- Max height 300px, then scroll

TO-DO LIST PANEL (collapsible, above input area when enabled):
- Container: background #0f0f0f, border 1px #222225, SHARP corners
- Margin: 0 12px 8px
- Header (clickable to collapse):
  - 📋 icon
  - "To-do" label (13px, weight 500)
  - Count badge (pill, #171717 bg, #FFA344 text, full radius)
  - Chevron ▼ (rotates to ▶ when collapsed)
- Content (max-height 150px, scroll):
  - To-do items as list
  - Each: Status icon + Task text (13px)
  - Status icons:
    - ⏳ Pending (#8b8b94)
    - ✳ In-progress (#FFA344, subtle pulse animation)
    - ✅ Completed (#8b8b94, strikethrough text)
- Collapsed: only header visible

STATUS BAR STATES:
- Ready: Small dot (#FFA344) + "Ready" (#52525b)
- Processing: Pulsing dot (#FFA344 with animation) + "Processing..." + Stop button appears
- Error: Red dot (#FF7369) + "Error" text

LOADING STATES:

"Tinkering" indicator (when Claude is responding):
- Inline after last message
- "✳ Tinkering..." (14px, italic, #8b8b94)
- Asterisk has subtle rotation animation (2s linear infinite)
- NO dots, NO spinner

Tool execution indicator:
- Inside tool card: "Running..." with subtle pulse
- "Running Read..." or "Running Edit..." based on tool

Full thinking overlay (rare, for long operations):
- Semi-transparent #09090b at 85% covers messages
- NOT covering input area
- Centered: Pulsing asterisk ✳ (32px, #FFA344) + "Claude is thinking..." text

MICRO-INTERACTIONS:
- All buttons: 150ms ease transitions
- Hover: brightness(1.1) or background shift
- Active/Press: scale(0.97)
- Focus rings: 2px #FFA344 with 2px offset
- Cards: hover background #171717 → #1f1f1f
- Tooltips: #171717 bg, #fafafa text, SHARP corners, arrow, fade in 100ms
- Success flash: brief #FFA344 border pulse
- Error shake: brief horizontal shake animation
- Selection highlight: rgba(255,163,68,0.2) background
```

**Checkpoint:** Diff viewer with +/- lines, to-do list panel states, all loading animations.

---

## Theme Reference

**Backgrounds:**
- #09090b — Canvas (OLED black)
- #0f0f0f — Surface (panels, modals)
- #171717 — Card (inputs, hover)
- #1c1c1f — Inline code background
- #1f1f1f — Elevated hover
- #222225 — Border (slightly darker than zinc)
- #2d2d30 — Inline code border

**Text:**
- #fafafa — Primary
- #e4e4e7 — Body
- #a1a1a1 — Secondary
- #8b8b94 — Muted (slightly lighter for readability)
- #52525b — Dim/Disabled

**Accents (NO GREEN):**
- #FFA344 — Amber (primary)
- #FFB366 — Amber hover
- #FF7369 — Coral (errors, warnings)
- #FF8A80 — Coral light
- Send button: linear-gradient(135deg, #FFA344, #FF7369)

**Effects:**
- Selection: rgba(255,163,68,0.2) background
- Active toggle glow: box-shadow 0 0 8px rgba(245,158,11,0.2)
- Top lip lighting: inset 0 1px 0 0 rgba(255,255,255,0.05)
- Glassmorphism: backdrop-filter blur(12px) on header/status

**Code Syntax:**
- Keywords: #FFA344
- Strings: #a1a1a1
- Comments: #52525b (italic)
- Numbers: #FF7369
- Functions: #fafafa

**Typography:**
- UI: -apple-system, "Inter", "Segoe UI", sans-serif
- Code: 'JetBrains Mono', 'SF Mono', monospace
- Headings: weight 500, tracking -0.02em
- Body: 14px, line-height 1.5
- Small: 11-12px
- Status: 10px, uppercase, tracking 0.5px
- Font features: font-feature-settings: "cv11", "ss01"

**Radius:**
- Rectangular containers (inputs, cards, modals): 0px (sharp corners)
- Pills/Toggles: Full radius (rounded ends)
- Circular buttons: Full circle

---

*Style: Warp Terminal × Claude.ai × Linear App*
*Accent: Amber/Coral (NO GREEN)*
*Version: 1.1 - December 18, 2025*
