# Session Management Skill

*Load with: base.md*

Session start protocol and decision logging. Forward-looking handoffs are handled by `docs/changelog/open-loops/`.

---

## Session Start Protocol

When starting a new session:

1. **Check for open loops**: `docs/changelog/open-loops/`
   - If files exist, read them — these are unfinished items
   - Follow the Resume Prompt in the relevant file

2. **Check recent changelogs**: `docs/changelog/`
   - Read the most recent session log for context
   - Note any references to open-loop files

3. **Check git state**: `git status` and recent commits
   - Useful if no changelog/open-loop exists

4. **Announce context**: "Resuming from: [summary]"
   - Confirm understanding before proceeding

---

## Decision Logging

Log significant decisions when:
- Choosing between architectural approaches
- Selecting libraries or patterns
- Making security-related choices
- Deviating from standard patterns

**Format** (inline in changelog or open-loop file):

```markdown
## [Date] Decision: [Title]

**Context**: Why this decision was needed
**Options**: What alternatives existed
**Choice**: What was chosen and why
**Trade-offs**: What we gave up
**References**: Related code locations (file:line)
```

---

## Phase Indicators

When documenting state in open-loops, use these phases:

| Phase | Description |
|-------|-------------|
| `exploring` | Investigating, reading code, understanding problem |
| `planning` | Designing approach, not yet coding |
| `implementing` | Writing code |
| `testing` | Writing/running tests, verifying behavior |
| `debugging` | Fixing issues found during testing |

---

## Quick Reference

| Need | Location |
|------|----------|
| What was done | `docs/changelog/[date]-session-N.md` |
| What's unfinished | `docs/changelog/open-loops/[topic].md` |
| Resume instructions | Open-loop file → "Resume Prompt" section |
| Architectural decisions | Inline in changelog or open-loop |
