# Google Stitch Prompting Guide

> Compiled from Google's AI Developers Forum, community best practices, and expert tutorials (Dec 2025)

Google Stitch generates UI from natural language. This guide covers how to prompt it effectively.

---

## Three Golden Rules

### 1. Be Specific and Incremental
Generic prompts → generic results. Focus on one screen/component at a time.

```
❌ "Create a landing page"
✅ "Mobile-first product detail page for an herbal tea shop with image gallery,
   price, reviews, add-to-cart. Neutral Japandi palette, minimal typography,
   prominent primary CTA."
```

### 2. One Major Change Per Prompt
Multiple changes cause Stitch to "forget" or break existing layouts.

```
❌ "Add filters, change title alignment, and add a gear icon"
✅ Three separate prompts:
   1. "Add filter dropdowns above the task table"
   2. "Move page title to the left, aligned with the table"
   3. "Add gear icon to top-right for admin settings"
```

### 3. Use UI/UX Terminology
Standard vocabulary yields better results than generic descriptions.

| Category | Preferred Terms |
|----------|-----------------|
| **Layout** | navigation bar, sidebar, card layout, grid, sticky header, hero section |
| **Components** | CTA button, search bar, dropdown, modal, toast, accordion |
| **Behavior** | on click, hover state, loading spinner, empty state card |
| **Visuals** | full-width hero, ghost button, high-contrast CTA, dark theme |

---

## Prompt Structure

Follow this 5-part pattern for reliable results:

```
1. Context      → What the app/page is for
2. Users/Goals  → Who uses it and why
3. Layout       → Key structural components
4. Visual Style → Colors, typography, mood
5. Interactions → Behaviors and states (optional)
```

**Example:**
```
Design a mobile-first dashboard for warehouse managers to track shipments.
Summary card row at top (total orders, pending, shipped),
scrollable order list with status badges, sticky bottom action bar.
Industrial blue-gray palette, high-contrast status indicators.
Loading states show skeleton placeholders.
```

**Setting the vibe:** Adjectives shape colors, fonts, and imagery—"vibrant and encouraging," "minimalist and focused," "warm and inviting," "sleek and professional."

---

## Iteration Workflow

**The reliable process:**
1. **Initial prompt** — Define app concept, platform, core screens
2. **Screen-by-screen** — Focus on one screen, make incremental adjustments
3. **Theme polish** — Unify colors, fonts, spacing; check consistency
4. **Export** — Figma (Standard mode) or code generation

**Critical:** Screenshot after each successful change. Stitch can break layouts on edits.

**Targeting elements precisely:**
```
"On the homepage, add a search bar to the header."
"Change the primary CTA on login screen to larger, brand blue."
"In the product card, add wishlist heart icon to top-right corner."
```

---

## Theme & Visuals

**Colors** — Be specific or describe mood:
- Specific: `"Primary color #2563EB, accent #F59E0B"`
- Mood: `"Warm, inviting palette"` or `"Corporate navy and silver"`

**Typography & Shapes:**
- `"Playful sans-serif font"` / `"Serif headings, sans-serif body"`
- `"Fully rounded button corners"` / `"8px rounded corners on cards"`

**Images** — Coordinate with theme changes:
```
"Update theme to light orange. Ensure all images and icons match this scheme."
"Use lifestyle photography showing people using the product, not sterile shots."
```

---

## Prompt Templates

| Goal | Pattern | Example |
|------|---------|---------|
| **New app** | `[platform] app for [user] to [goal], screens for [flows], [style] language` | "Mobile app for busy parents to manage chores, screens for task assignment and calendar, cheerful visual language" |
| **Single page** | `[page type] for [context], including [components], [layout], [style]` | "Product detail page for Japandi tea store. Hero image, price, reviews, add-to-cart. Neutral colors, black buttons, elegant font" |
| **Refinement** | `On [screen], [add/change/remove] [component], keeping [constraints] same` | "On checkout, add promo code input below cart summary, keep existing layout" |
| **Interactions** | `[component] that on click shows [feedback], indicates [states]` | "Submit button shows loading spinner on click, green checkmark on success" |
| **Mobile adapt** | `Adapt to mobile-first: stack vertically, bottom nav for [items], larger tap targets` | "Adapt dashboard to mobile: stack sections, bottom nav with icons, increase tap targets" |
| **Localization** | `Switch all [content type] to [language]` | "Switch all product copy and buttons to Spanish" |

---

## Critical Pitfalls

### ASCII Diagrams Don't Work
Stitch interprets ASCII as literal text, not spatial relationships.

```
❌ Pasting this into a prompt:
┌────────────┬───────────────────────────┬──────────────┐
│  SIDEBAR   │       MAIN AREA           │  FILE TREE   │
│ ┌────────┐ │  ┌─────────────────────┐  │ 📁 src/      │
│ │Projects│ │  │  # Header           │  │ ├─ 📄 main   │
│ └────────┘ │  └─────────────────────┘  │ └─ 📁 lib/   │
└────────────┴───────────────────────────┴──────────────┘

✅ Plain language instead:
"Three-panel desktop layout:
- Left sidebar (280px): collapsible, project list and session history
- Center: scrollable chat with markdown rendering
- Right panel (toggleable): file tree browser
Dark theme, #0d1117 background."

✅ Or upload a sketch image in Experimental mode
```

### Long Prompts Cause Omissions

| Length | Risk |
|--------|------|
| < 500 chars | ✅ Safe — single component refinement |
| 500-2000 chars | ✅ Safe — full screen initial prompt |
| 2000-5000 chars | ⚠️ Caution — complex screen |
| > 5000 chars | ❌ Will omit content |

**Solution:** Start simple, add complexity incrementally per screen.

### Spec Documents Overwhelm Stitch
A 1000-line UI spec with 15+ components, ASCII diagrams, color palettes, and interaction tables will fail.

**Use specs as reference, not prompts:**
```
SPEC SECTION:
"### Collapsible Sidebar
Location: Left edge, full height
Default State: Expanded (280px)
Sections: Projects, Recent Sessions, New Project button"

CONVERTED TO STITCH PROMPT:
"Design collapsible left sidebar for developer tool.
Full height, 280px expanded. Contains:
- Search input at top
- PROJECTS section: folder icons, session counts
- RECENT SESSIONS: chat icons, titles, timestamps
- New Project button at bottom
Dark theme (#161b22 bg), light text (#e6edf3), blue accent (#58a6ff)."
```

### Layout Breaks on Edit
Adding features causes entire layout to regenerate.

**Solution:**
- One change per prompt
- Never combine layout + component changes
- Screenshot working states before each edit

### Technical Over-Specification
CSS variable names and implementation details add noise.

```
❌ "Use --bg-canvas: #0d1117 for Layer 0, --bg-default: #161b22 for Layer 1,
   box-shadow: 0 8px 24px rgba(0,0,0,0.4) on modals"

✅ "Deep dark background (#0d1117) with lighter surfaces for panels and cards.
   Modals feel elevated with subtle shadows. 4-step depth system."
```

### Other Common Issues
- **Generic results:** Add specific details about layout, colors, interactions
- **Inconsistent styling:** Reference existing elements: `"Add newsletter section using same card style as feature cards above"`
- **Markdown tables:** Convert to prose: `"App title 18px bold, headers 14px semibold, body 14px regular"`

---

## Visual Inputs (Experimental Mode)

| Situation | Use Image? |
|-----------|------------|
| Complex multi-panel layout | ✅ Upload sketch |
| Specific spatial relationships | ✅ Upload wireframe |
| Recreating existing UI | ✅ Upload screenshot |
| Simple single component | ❌ Text sufficient |
| Color/style refinement | ❌ Text better |

**Best results:** Image reference + descriptive prompt:
```
[Upload: wireframe.png]
"Based on this wireframe: three-panel desktop layout. Left sidebar collapsible
with project lists. Center is scrollable chat with markdown. Right is toggleable
file tree. Dark theme like VS Code, blue accents. Status bar at bottom."
```

**Have ASCII diagrams?** Render in fixed-width font → screenshot → upload to Experimental mode. Or use ASCII as guide to sketch a cleaner wireframe.

---

## Modes & Export

| Mode | Capabilities | Limitations |
|------|--------------|-------------|
| **Standard** | Clean UI, Figma export, code generation | No image input |
| **Experimental** | Image/sketch input, reference-based | No Figma export |

**Mode decision:**
```
Need image reference? → Experimental (no Figma)
Need Figma export?    → Standard (no images)
Need both?            → Use Experimental for layout, recreate in Standard for export
```

**Export notes:**
- Code may need reorganization to fit existing design systems
- Use Figma for final polish and component organization
- Stitch cannot import existing Figma files

---

## Quick Reference

**Do's ✅**
- One screen per session, one change per refinement
- Use UI/UX terminology (modal, CTA, card layout)
- Describe visual outcomes, not CSS implementation
- Upload sketches for complex layouts (Experimental mode)
- Reference elements specifically ("primary button on login form")
- Screenshot working states before every edit

**Don'ts ❌**
- Paste entire spec documents (>5000 chars fails)
- Include ASCII diagrams (interpreted as text)
- Multiple screens at once (inconsistent results)
- CSS variable names in prompts (noise)
- Combine layout + style changes (causes reset)
- Skip screenshots (lose working states)

---

## Resources

- [Official Stitch Prompt Guide](https://discuss.ai.google.dev/t/stitch-prompt-guide/83844) — Google AI Forum
- [Stitch Prompt Community](https://www.stitchprompt.com/) — Templates and examples
- [Codecademy Tutorial](https://www.codecademy.com/article/google-stitch-tutorial-ai-powered-ui-design-tool)
- [LogRocket Guide](https://blog.logrocket.com/google-stitch-tutorial/)

---

*v2.1 — Compressed edition with spec conversion guidance | December 17, 2025*
