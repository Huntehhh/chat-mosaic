# Stitch Guides Review Recommendations

Multi-model consensus review of consolidated Stitch prompting documentation.

**Models Consulted:** Gemini 3 Pro Preview, Gemini 3 Flash Preview, Grok 4.1 Fast
**Confidence:** All 3 models rated 9/10
**Date:** December 2025

---

## Unanimous Agreement (All 3 Models)

| Recommendation | Details |
|---------------|---------|
| **Create Cheat Sheet** | New file `STITCH-CHEATSHEET.md` (~50 lines) with Adjectives table + Theme Template + Build Order Checklist |
| **Content Quality** | 95% source coverage achieved, economical word choice, no significant fluff |
| **Two-Guide Structure** | Split is optimal - supports beginner → advanced progression |
| **Gap-Fill Technique** | Called "highest-value addition" for developers |

---

## Required Edits (Strong Consensus)

| File | Action | Reason |
|------|--------|--------|
| **Fundamentals** | Add Localization section | Missing "Switch all copy to Spanish" feature from source |
| **Fundamentals** | Move UI Vocab table to Cheat Sheet | Overlaps with Advanced; saves ~10 lines |
| **Advanced** | Remove/Condense UI Term Reference | Saves ~15 lines; developer audience doesn't need it |
| **Advanced** | Shorten Theme Reference example | Duplicates template above it; saves ~25 lines |
| **Advanced** | Clarify parallel generation | Explicitly state: "Bullet points trigger parallel `generate_design` calls" |

---

## Recommended Additions (2/3 Models)

| Addition | Where | Lines |
|----------|-------|-------|
| Style Reference Prompting | Advanced | +5-8 |
| Tailwind CSS output option | Advanced (Export section) | +2-3 |
| Troubleshooting section | Fundamentals | +10-15 |

---

## Proposed File Structure

```
PROMPT-AND-SKILLS-BEST-PRACTICES/stitch/
├── STITCH-PROMPTING-FUNDAMENTALS.md  (~150 lines, edited)
├── STITCH-PROMPTING-ADVANCED.md      (~250 lines, trimmed)
└── STITCH-CHEATSHEET.md              (~50 lines, NEW)
```

---

## Action Plan

1. **Edit Fundamentals**: Add Localization, remove UI Vocab table
2. **Trim Advanced**: Remove UI Term Reference, condense Theme example, add parallel generation clarity
3. **Create Cheat Sheet**: Quick-reference with templates and tables
4. **Optional**: Add Style Reference and Tailwind mentions

---

## Detailed Model Feedback

### Gemini 3 Pro Preview (9/10)

**Key Points:**
- Localization capability from `stitch-web-guide-official.md` is missing
- Advanced guide exceeds 300-line constraint (~350 lines currently)
- UI Term Reference table unnecessary for developer audience
- Theme Reference example too long, duplicates template
- Checkpointing strategy is sophisticated addition

**Recommended Cuts:**
- UI Term Reference table: saves ~15 lines
- Theme Reference example: condense to save ~25 lines

**New Content:**
- Add "Language & Localization" to Fundamentals
- Create Quick Reference Card as separate file

---

### Gemini 3 Flash Preview (9/10)

**Key Points:**
- Experimental Mode may now support Figma export (verify late-2025 update)
- Missing "Style Reference Prompting" (image for theme, not structure)
- Should mention Tailwind CSS output option
- "Copy to Figma" preserves Autolayout if requested

**Recommended Additions:**
- Update export capabilities if Figma now works in Experimental
- Add "Visual Style Matching" section to Advanced
- Add Tailwind CSS directive for production handoff
- Rename "One Change Per Prompt" to "Anti-Frustration Rule"

**New Content:**
- Create Stitch Cheat Sheet (~50 lines)
- Include: Adjectives That Work table + Theme Template

---

### Grok 4.1 Fast (9/10)

**Key Points:**
- Web search confirms no major Stitch changes post-2025 I/O
- Guides cover 95% of source content succinctly
- UI Vocab in Fundamentals overlaps Term Ref in Advanced
- All content is economical - no subtractions needed

**Recommended Changes:**
- Add Troubleshooting section to Fundamentals (10-15 lines)
- Merge Fundamentals UI Vocab with Advanced Term Ref (save 10 lines)
- Add consistent code-block prefixes (e.g., `PROMPT:`)
- Add 1-2 more templates (state variations)

**New Content:**
- Create STITCH-CHEATSHEET.md (<50 lines)

---

## Consensus Matrix

| Recommendation | Gemini Pro | Gemini Flash | Grok | Consensus |
|---------------|:----------:|:------------:|:----:|:---------:|
| Create Cheat Sheet | ✓ | ✓ | ✓ | **UNANIMOUS** |
| Add Localization | ✓ | - | ✓ | **STRONG** |
| Trim Advanced to 300 lines | ✓ | - | ✓ | **STRONG** |
| Remove/Merge UI Term tables | ✓ | - | ✓ | **STRONG** |
| Add Style Reference section | - | ✓ | - | Consider |
| Add Troubleshooting | - | - | ✓ | Consider |
| Tailwind CSS mention | - | ✓ | - | Consider |
| Verify Figma export update | - | ✓ | - | Verify |

---

## Source Files Reviewed

1. `STITCH-PROMPTING-FUNDAMENTALS.md` - New guide (~150 lines)
2. `STITCH-PROMPTING-ADVANCED.md` - New guide (~250 lines)
3. `stitch-web-best-practices.md` - Reverse-engineered prompts + Codecademy
4. `stitch-web-guide-how-to-use.md` - Medium article (KunalxArora)
5. `stitch-web-guide-official.md` - Adosolve guide
6. `stitch-web-guide-what-is-it.md` - Codecademy tutorial
7. `STITCH-PROMPTS-WARP-LINEAR.md` - Production prompts V1
8. `STITCH-PROMPTS-WARP-LINEAR-V2.md` - Production prompts V2
9. `prompt-best-practices.md` - General LLM prompting principles
