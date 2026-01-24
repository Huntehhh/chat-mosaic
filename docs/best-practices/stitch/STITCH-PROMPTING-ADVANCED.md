# Stitch Advanced: Build Orders & Design Systems

Production-grade prompting strategies for high-fidelity UI generation. Covers multi-prompt sequences, theme specifications, and component-level precision.

---

## The Build Order Pattern

Complex UIs require **decomposed prompt sequences**—not single mega-prompts. Break designs into numbered steps, each building on the previous.

### Standard Build Order
```
1. Complete App Layout (header + main area + input + status bar)
2. Chat Messages & Content Types (user, assistant, tool cards)
3. Input Controls & Popups (textarea, toggles, dropdowns)
4. Primary Modals (settings, configuration panels)
5. Secondary Modals (history, pickers, commands)
6. Specialized Components (permission dialogs, intensity selectors)
7. Visual Polish (diff viewer, loading states, micro-interactions)
```

**Key Insight:** Each prompt inherits context from the thread. Define foundations first, then layer details.

---

## Theme Reference Block

Stitch forgets context across prompts. **Repeat your theme block** at the start of every major prompt.

### Template
```
STYLE: [Reference aesthetic]. [Additional descriptors].

COLORS:
- Background: #[hex] ([name]), #[hex] ([name])
- Text: #[hex] (primary), #[hex] (muted), #[hex] (dim)
- Accent: #[hex] ([name]) - [usage description]
- Borders: #[hex], [width]

TYPOGRAPHY:
- UI: [font family]
- Code: [monospace family]
- Headings: weight [n], tracking [value]
- Body: [size]px, line-height [n]

RADIUS:
- Containers: [n]px ([description])
- Pills/Toggles: Full radius (rounded)
- Buttons: [circle/sharp/rounded]

EFFECTS:
- Shadows: [spec]
- Glows: [spec]
- Blur: [spec]
```

### Condensed Example
```
STYLE: Warp Terminal × Linear. OLED black, minimal, premium.
COLORS: #09090b (bg), #fafafa (text), #FFA344 (accent), #FF7369 (error)
TYPOGRAPHY: Inter/system sans, JetBrains Mono, 14px body
RADIUS: 0px containers (sharp), full radius pills
EFFECTS: No shadows, amber glow on active toggles
```

*Full template in STITCH-CHEATSHEET.md*

---

## Precision Prompting

### Dimension Specifications
Use exact measurements for predictable output:
```
HEADER - 48px height, 12px horizontal padding
- Left: Title text
- Right: Icon buttons (28px), gap 8px

INPUT AREA - 12px padding all sides
- Textarea: min-height 44px, max-height 200px
- Controls row: margin-top 8px, gap 6px
```

### Component Specifications
```
TOGGLE SWITCH:
- Track: 32px × 16px, background #222225, 8px radius
- Thumb: 12px circle, #fafafa
- Active: track #FFA344, thumb slides right
- Transition: 150ms ease

DROPDOWN BUTTON:
- Height: 28px, padding 0 8px
- Background: #171717, border 1px #222225
- Text: 11px, #a1a1a1
- Chevron: ▾ symbol, 10px, #52525b
- Hover: background #1f1f1f
```

### State Definitions
Always define multiple states for interactive components:
```
BUTTON STATES:
- Default: #171717 bg, #fafafa text
- Hover: brightness(1.1)
- Active/Press: scale(0.97)
- Disabled: opacity 0.5, cursor not-allowed
- Focus: 2px #FFA344 ring, 2px offset

STATUS INDICATOR:
- Ready: 6px dot #FFA344, "Ready" text #52525b
- Processing: Pulsing dot (opacity 1→0.3→1, 1.5s), "Processing..." text
- Error: 6px dot #FF7369, "Error" text #FF7369
```

---

## The Gap-Fill Technique

When adding to existing designs, **prevent recreation** by being explicit:

### Anti-Pattern ❌
```
Design the Settings Modal with WSL configuration options.
```
*(Stitch may redesign entire modal from scratch)*

### Correct Pattern ✅
```
Update the EXISTING Settings Modal. DO NOT recreate the entire modal.
Keep the same layout, just modify the "Display" section.

CHANGES TO "Display" SECTION:
1. RENAME "Hide MCP tool calls" → "Compact MCP tool calls"
2. ADD number input BESIDE the toggle:
   - Width: 60px
   - Label above: "Preview height"
   - Suffix: "px"

Keep all existing styling, colors, spacing from original modal.
```

### Isolated Component Generation
For complex components, generate in isolation then integrate:
```
Design TWO standalone UI components on a plain #09090b background.
DO NOT create full screens. Create ONLY the isolated components.

COMPONENT 1: IMAGE ATTACHMENT PREVIEW
[detailed specs...]

COMPONENT 2: THINKING OVERLAY
[detailed specs...]

Show both components on the canvas with subtle labels above each.
```

---

## Checkpointing

Add validation criteria after each major prompt:

```
**Checkpoint:** Verify the following before proceeding:
- OLED black canvas (#09090b)
- Amber accents on interactive elements
- Sharp corners on containers (0px radius)
- Rounded pills only on toggles and badges
- No shadows on cards
```

This creates a mental gate and helps catch deviations early.

---

## Multi-Screen Generation

### Triggering Multi-Screen Mode
Stitch interprets **bulleted lists as parallel `generate_design` calls**. Each bullet becomes a separate screen generated simultaneously:

```
Generate these 4 screens for the fitness app:

- Welcome screen with feature highlights
- User registration form
- Dashboard with activity stats
- Settings with notification preferences
```

**How it works:** Stitch's backend calls `generate_design` 4 times in PARALLEL, producing all screens in one generation.

### Limits
- Maximum 6-8 screens per generation
- If >6 screens needed, split into multiple prompts
- Bullet format is required—numbered lists may not trigger parallel mode

---

## Advanced Templates

### Multi-Prompt Build Sequence
```
## PROMPT [N]: [Component Name]

[Paste Theme Reference Block]

RULES:
- [Constraint 1]
- [Constraint 2]
- [What NOT to include]

LAYOUT ([description]):

1. [SECTION NAME] - [dimensions]
   - [Element]: [specs]
   - [Element]: [specs]

2. [SECTION NAME] - [dimensions]
   - [Element]: [specs]

**Checkpoint:** [Validation criteria]
```

### Modal Template
```
[MODAL NAME] MODAL ([width] wide):
- Header: "[Title]"
- Scrollable content, padding [n]px

"[Section Name]" section:
- Section header ([size], uppercase, #[hex])
- [Control type]: [specs]
- [Control type]: [specs]
- Helper text below ([size], #[hex])

"[Section Name]" section:
- [Contents...]

Footer:
- [Button specs]
```

### State Variation Template
```
Show [N] different states for [component]:

STATE 1: [NAME] (default)
- [Visual specs...]

STATE 2: [NAME] (active/hover)
- [Visual changes from default...]

STATE 3: [NAME] (error/disabled)
- [Visual changes...]

Show all states [stacked vertically / side-by-side] for comparison.
```

---

## Style Reference Prompting

Use images purely for **aesthetic matching** without copying layout structure:

```
Use the uploaded image as a STYLE REFERENCE only.
Match its color palette, typography feel, and visual tone.
DO NOT copy the layout or component structure.

Apply this aesthetic to: [your screen description]
```

**When to use:**
- Brand UI exists but you need different screens
- Mood board images that capture desired aesthetic
- Competitor designs you want to echo (not clone)

**Distinct from wireframes:** Wireframes define structure; style references define only visual language.

---

## Export Handoff

### Figma Integration (Standard Mode Only)
1. Click "Copy to Figma" on generated design
2. Open Figma file, select target frame
3. Paste (Ctrl/Cmd + V)
4. Replace placeholder icons with actual assets
5. Adjust spacing if needed

### HTML/CSS Export
1. Click generated design preview
2. Select "Code" tab
3. Copy to IDE

**Clean Export Tips:**
- Semantic HTML: "Use semantic tags like `<nav>`, `<main>`, `<section>`"
- Accessibility: "Include ARIA labels for interactive elements"
- BEM classes: "Use BEM naming convention for CSS classes"
- Tailwind CSS: "Output using Tailwind utility classes" (better for production)

---

## Accessibility Prompting

Add to prompts for accessible output:
```
ACCESSIBILITY:
- Ensure WCAG AA color contrast (4.5:1 for text)
- Include focus states for all interactive elements
- Use semantic HTML structure
- Add ARIA labels for icons and buttons
```

---

## UI Term Reference

| Term | Specification Example |
|------|----------------------|
| Ghost button | Transparent bg, 1px border, text color matches border |
| Pill toggle | Full radius ends, slides thumb on activation |
| Backdrop-filter | blur([n]px) for glassmorphism effects |
| Skeleton loader | Animated gradient placeholder during loading |
| Toast | Temporary notification, auto-dismiss after [n]s |
| Chip | Small pill-shaped tag with optional remove button |
| Drawer | Slide-in panel from edge (left/right/bottom) |
| Popover | Small floating panel anchored to trigger element |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Stitch ignores hex codes | Paste Theme Reference at prompt START, not end |
| Inconsistent styling | Include full theme block in EVERY prompt |
| Wrong component layout | Use Experimental Mode with wireframe upload |
| Generation count wasted | Use Gap-Fill technique for modifications |
| Complex UI breaks | Decompose into Build Order sequence |
| States not matching | Show all states on same canvas for reference |

---

## Quota Management

| Task Type | Recommended Mode | Rationale |
|-----------|------------------|-----------|
| Exploration/ideation | Standard (Flash) | Fast iteration, 350/month |
| Wireframe conversion | Experimental (Pro) | Higher fidelity, reference-based |
| Component iteration | Standard | Micro-changes don't need Pro |
| Final polish | Experimental | Worth the credit for precision |
| State variations | Standard | Generate all states in one prompt |

---

*See also:*
- *STITCH-PROMPTING-FUNDAMENTALS.md — Core concepts and beginner patterns*
- *STITCH-CHEATSHEET.md — Quick-reference tables and templates*
