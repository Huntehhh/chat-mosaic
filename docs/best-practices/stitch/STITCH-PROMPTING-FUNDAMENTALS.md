# Stitch Prompting Fundamentals

Google Stitch is an AI-powered UI design tool that transforms text prompts or wireframe uploads into polished mobile/web interfaces with HTML/CSS export and Figma integration. Built on Gemini 2.5 models.

---

## The Stitch Mindset

Treat Stitch as a **conversational design partner**, not a command-line tool. Think "Let's evolve this dashboard together" rather than "Generate a screen."

### Core Principles

| Principle | Description |
|-----------|-------------|
| **One Change Per Prompt** | Never request multiple significant changes at once—focus prevents layout breakage |
| **Broad → Detailed** | Start with exploration prompts, then refine with specifics |
| **Platform Lock-in** | Threads are Mobile OR Desktop—you cannot switch mid-conversation |
| **Iterate Fast** | Generate 5 micro-prompts faster than perfecting 1 mega-prompt |

---

## Mode Selection

### Standard Mode (Gemini 2.5 Flash)
- **Quota:** 350 generations/month
- **Input:** Text prompts only
- **Best For:** Rapid iteration, exploration, basic concepts
- **Export:** Figma copy-paste supported

### Experimental Mode (Gemini 2.5 Pro)
- **Quota:** 50 generations/month
- **Input:** Wireframe/sketch uploads + text
- **Best For:** High-fidelity from references, screenshot replication
- **Export:** HTML/CSS only (no Figma)

**Decision Rule:** Use Standard for iteration. Save Experimental for reference-based work requiring fidelity.

---

## Prompt Structure

### Basic Template
```
[Platform] [Screen Type] for [App Name/Purpose].

MOOD: [2-3 adjectives describing feel]

KEY COMPONENTS:
- [Component 1]
- [Component 2]
- [Component 3]

STYLE: [Theme description]
```

### Example: Exploration Prompt
```
Mobile home screen for a minimalist coffee ordering app.

MOOD: Clean, warm, inviting

KEY COMPONENTS:
- Featured drink carousel
- Quick order buttons
- Nearby cafes map preview

STYLE: Light theme, rounded cards, soft shadows
```

---

## Use Case: Quick Wireframes

**Goal:** Rapid exploration without visual polish

**Strategy:**
1. Start broad: "Design an app for [purpose]"
2. Let Stitch suggest screen structure
3. Pick promising directions to refine

**Example Prompt:**
```
Design a mobile app for marathon runners to track runs, find partners, and discover races.

What screens would this need?
```

Stitch will propose 4-6 screens as bullet points. Confirm which to generate.

---

## Use Case: Reference-Based Design

**Goal:** Recreate or adapt existing UI from screenshot/wireframe

**Strategy:** Use Experimental Mode
1. Upload clear wireframe or screenshot
2. Add clarifying prompt describing desired changes

**Example Prompt (with uploaded wireframe):**
```
Convert this sketch into a dashboard layout.

STYLE: Sleek cards, neutral palette, data visualizations
Keep the general structure but make it modern and polished.
```

**Tips:**
- Cleaner wireframes = more accurate output
- Annotate sections if complex
- Specify what to keep vs. change

---

## Use Case: Theme Modifications

**Goal:** Adjust colors, fonts, or visual style

### Mood-Based (Guide 1 approach)
```
Make the design feel more playful and energetic.
Use brighter accent colors and rounded corners.
```

### Specific Adjustments
```
Change the primary button color to coral.
Update headings to use a serif font.
Make all cards have fully rounded corners.
```

**Rule:** One styling change per prompt for predictable results.

---

## Adjectives That Work

Stitch responds well to mood descriptors:

| Category | Effective Adjectives |
|----------|---------------------|
| **Minimal** | Clean, simple, focused, sparse, uncluttered |
| **Premium** | Elegant, sophisticated, refined, polished, luxurious |
| **Energetic** | Vibrant, bold, dynamic, playful, punchy |
| **Professional** | Corporate, trustworthy, structured, formal |
| **Friendly** | Warm, inviting, approachable, casual, human |
| **Technical** | Modern, sleek, futuristic, high-tech, developer-focused |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Stitch ignores specific requests | Rephrase with clearer terms, one change at a time |
| Wrong chart type generated | Explicitly specify: "Use a circular pie chart (not bar graph)" |
| Layout doesn't match vision | Upload wireframe in Experimental Mode |
| Inconsistent styling across prompts | Repeat key style constraints in each prompt |
| Icons appear as placeholders | Expected behavior—replace in Figma post-export |
| Stitch forgets your theme | Paste theme block at START of every prompt |
| Too many changes requested | Break into separate prompts (one change each) |
| Complex UI breaks apart | Use Build Order pattern (see Advanced guide) |
| Generation quota wasted | Use Gap-Fill technique for modifications |

---

## Quick Reference

### Iteration Loop
```
Foundation → Layout → Components → Style → Refinement
```

### Prompt Checklist
- [ ] Specified platform (mobile/web)
- [ ] Defined screen purpose
- [ ] Listed key components
- [ ] Described mood/style
- [ ] One major request only

### Generation Limits
- Max 6-8 screens per generation
- Bullet points trigger multi-screen logic
- Use parallel calls for efficiency

---

*See also:*
- *STITCH-PROMPTING-ADVANCED.md — Production-grade multi-prompt sequences and component specs*
- *STITCH-CHEATSHEET.md — Quick-reference tables and templates*
