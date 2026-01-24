# Stitch Quick Reference

Copy-paste templates and tables for rapid Stitch prompting.

---

## Adjectives That Work

| Category | Effective Adjectives |
|----------|---------------------|
| **Minimal** | Clean, simple, focused, sparse, uncluttered |
| **Premium** | Elegant, sophisticated, refined, polished, luxurious |
| **Energetic** | Vibrant, bold, dynamic, playful, punchy |
| **Professional** | Corporate, trustworthy, structured, formal |
| **Friendly** | Warm, inviting, approachable, casual, human |
| **Technical** | Modern, sleek, futuristic, high-tech, developer-focused |

---

## UI Component Vocabulary

| Term | What It Means |
|------|---------------|
| **Card** | Contained content block with border/shadow |
| **Pill** | Fully-rounded button or badge |
| **Ghost button** | Transparent with border only |
| **CTA** | Call-to-action primary button |
| **Nav bar** | Top or bottom navigation |
| **Carousel** | Horizontal scrollable section |
| **Grid** | Multi-column layout (2-column, 3-column) |
| **Hero** | Large featured section at top |
| **Modal** | Overlay dialog |
| **Toast** | Temporary notification message |
| **Backdrop-filter** | blur(Npx) for glassmorphism |
| **Skeleton loader** | Animated gradient placeholder |
| **Chip** | Small pill-shaped tag with remove button |
| **Drawer** | Slide-in panel from edge |
| **Popover** | Small floating panel anchored to trigger |

---

## Theme Reference Template

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

---

## Build Order Checklist

```
1. □ Complete App Layout (header + main + input + status)
2. □ Content Types (messages, cards, blocks)
3. □ Input Controls & Popups (textarea, toggles, dropdowns)
4. □ Primary Modals (settings, config)
5. □ Secondary Modals (history, pickers)
6. □ Specialized Components (dialogs, selectors)
7. □ Visual Polish (states, loading, micro-interactions)
```

---

## Prompt Checklist

- [ ] Platform specified (mobile/web)
- [ ] Screen purpose defined
- [ ] Key components listed
- [ ] Mood/style described
- [ ] One major request only
- [ ] Theme block included (for multi-prompt)

---

## Quick Rules

| Rule | Why |
|------|-----|
| One change per prompt | Prevents layout breakage |
| Repeat theme block | Stitch forgets context |
| Bullet points = multi-screen | Triggers parallel generation |
| 6-8 screens max | Per-generation limit |
| Standard for iteration | Save Experimental for fidelity |
