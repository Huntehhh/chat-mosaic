# Universal Changelog Generator

Create a detailed technical changelog for this session's work.

**Save location** (relative to current project root):
- If path provided: `$ARGUMENTS`
- Default (no args): `./docs/changelog/` or `./documentation/changelog/` (use whichever exists in the project, prefer `./docs/changelog/`)

**Filename format**: `YYYY-MM-DD-session-N.md` (e.g., `2024-01-15-session-1.md`)

---

## Core Philosophy

**Optimize for "Context Restoration"** - The next agent must be able to resume work immediately without hallucinating the codebase state.

**Treat this as a "Save Game" file** - Capture Code, State, and Intent. The next person (or AI) should reload context and continue without re-investigating.

**Audience**: Future you, teammates, AI assistants resuming work, anyone debugging at 2am
**Format**: Markdown - parseable by humans and machines alike

---

## Tone & Voice

- **Neutral and professional** - No marketing hype, minimal humor
- **Impact-first** - Lead with what's better/different, not implementation details
- **Action-oriented verbs** - "Adds", "Fixes", "Removes", "Migrates"
- **Past tense for entries** - "Fixed crash when..." not "Fix crash when..."
- **Third person** - No "I" or "we" in bullet points
- **Specific over vague** - "Reduces API calls from 12 to 3" not "Improves performance"
- **Stack-adaptive** - Use appropriate terminology (TS→`npm test`; Python→`pytest`; Rust→`cargo test`)

---

## Required Structure

### 1. Header & Metadata
```markdown
# Changelog - [Date] (Session N)

## [Impact-First Title - What's Better Now]

- **Goal**: [1 sentence goal of this session]
- **Risk Level**: [Low/Med/High] - [Brief justification]

[1-2 sentence summary: what changed and why it matters]
```

### 2. Quick-Scan Summary Table
Metrics table for instant comprehension (limit 2-3 tables total):
```markdown
| Metric/Component | Before | After | Change |
|------------------|--------|-------|--------|
```
Include: line counts, file counts, API calls, error rates, or any measurable delta.

### 3. Breaking Changes & API Signature Warnings
**Call these out FIRST and prominently.** If none exist, explicitly state it:
```markdown
## ⚠️ Breaking Changes

- `getSelectors()` now returns `SelectorDef[]` instead of `string[]`
- `UserService.create()` now requires `org_id` parameter
- Removed deprecated `legacyAuth()` - use `auth.v2` methods instead
```
Or if none:
```markdown
## ✅ No Breaking Changes
```
This forces exhaustive scanning and prevents handoff surprises.

### 4. Environment & Dependencies
Track state changes that affect runtime - code crashes if env doesn't match:
```markdown
## Environment & Dependencies

| Type | Name | Change | Notes |
|------|------|--------|-------|
| Dep | `playwright` | `1.40` → `1.41` | Security patch |
| Env | `DB_TIMEOUT` | Added | Default: 3000ms |
| Tool | `python` | Required `>=3.11` | For async features |
```

### 5. Categorized Change Sections
Use consistent category headings (include only those that apply):

```markdown
## Added
[New features, files, capabilities]

## Changed
[Modifications to existing behavior - still backward compatible]

## Fixed
[Bug fixes, error corrections]

## Removed
[Deleted code, deprecated features dropped]

## Security
[Vulnerability fixes, auth changes]
```

For phased work, nest under phases:
```markdown
## Phase 1: [Action Verb] [What]

### Added: `path/to/file.ext`
- Bullet points of specific additions

### Changed: `path/to/file.ext`
- What was modified and why
```

**Use Context Anchors** - mention key functions/classes by name:
```markdown
- Modified `combineAndDedupeSelectors()` to prioritize learned selectors
- Updated `AuthService.validateToken()` to check expiry before signature
```

### 6. Interface Contracts (Not Full Code)
Provide **signatures, types, and interfaces** - focus on how to USE the code, not how it works internally:
```markdown
## Key Interfaces

```typescript
// New function signature
export async function getSelectors(site: string, path: string): Promise<SelectorDef[]>

// Changed return type
export interface AuthResult {
  isValid: boolean;
  userId?: string;
  error?: string;
}
```
```
Keep to 10-20 lines max. Full implementations belong in the codebase, not the changelog.

### 7. Files Summary Table
```markdown
## Files Summary

| File Path | Status | Notes |
|-----------|--------|-------|
| `path/file.ts` | **NEW** | Brief purpose |
| `path/file.ts` | Modified | What changed |
| `path/file.ts` | **DELETED** | Why removed |
```

### 8. Verification & Proof
```markdown
## Verification

**Command**: `npm test` / `pytest` / `cargo test`
**Results**: 24/24 tests passed ✅
**Manual checks**: Verified selector loading from PostgreSQL works
```

### 9. Open Loops (Separate File)

**Do NOT include open loops, resume prompts, or next-session context in the changelog.**

The changelog is for **completed work only**. If there are unfinished items, debugging hypotheses, or handoff context, create a **separate file** in `docs/changelog/open-loops/`:

**Filename**: `[topic-slug].md` (e.g., `mcp-persistence.md`, `auth-refactor.md`)

**Open-loop file format**:
```markdown
# [Issue/Topic Name]
Created: YYYY-MM-DD (Session N)
Status: investigating | blocked | ready-to-fix | in-progress

## Context
[What was happening when this was discovered]

## Problem
[Clear problem statement]

## Investigation So Far
[What's been tried, what's been ruled out]

## Hypothesis
[Current theory]

## Next Actions
- [ ] Action 1
- [ ] Action 2

## Resume Prompt
[Copy-paste prompt for next session]

## Relevant Files
- `path/to/file.ts:123` - description
```

**Rules**:
- One topic per file (keeps handoffs focused)
- Update existing file if topic already has an open-loop file
- Delete the file when the issue is fully resolved
- In the changelog, simply reference: `See open-loops/[topic].md`

---

## What to Include

- **User-visible behavior changes** - API surface, CLI flags, config keys
- **Operational impact** - Migrations needed, performance changes, resource usage
- **Risk and action** - What consumers must do, watch for, or test
- **Architecture decisions** - Why this approach over alternatives (briefly)
- **Context anchors** - Name the key functions/classes central to changes
- **Environment state** - Any `.env`, dependency, or tooling changes

## What to Exclude

- Raw git commit messages
- Failed debugging attempts
- Trivial internal refactors with no external impact
- Every typo fix or comment update
- Full function implementations (signatures only)
- **Open loops, resume prompts, next-session context** (these go in `open-loops/`)

---

## Formatting Quick Reference

| Element | Use For |
|---------|---------|
| Tables | Before/after comparisons, file lists, metrics (max 2-3) |
| Bullets | Individual changes within a category |
| Code blocks | Signatures, commands, configuration (not full implementations) |
| **Bold** | File statuses (NEW, DELETED), key terms |
| `backticks` | File paths, function names, CLI commands |
| ⚠️ | Breaking changes, API signature changes |
| ✅ | Completed items, passed tests, no breaking changes |
| Links | Related changelogs, docs, tickets, PRs |

---

## Anti-Patterns to Avoid

- **Vague entries**: "Various improvements" or "Bug fixes"
- **Implementation dumps**: Full function bodies instead of signatures
- **Missing context**: What changed without why it matters
- **Inconsistent detail**: Some releases verbose, others sparse
- **Buried breaking changes**: These go at the TOP, clearly marked
- **Open loops in changelog**: These belong in `open-loops/` folder, not here
- **Over-table-ization**: More than 3 tables becomes noise
- **Missing env state**: Code changes without dependency/config changes

---

## Stack-Agnostic Rules

- **Metrics**: Git stats first (`+123 -456`), then domain metrics (coverage, benchmarks)
- **Verification**: Always include exact command used, not just results
- **Terminology**: Adapt to stack (Go→"structs", Python→"ABC", Rust→"traits", TS→"interfaces")
- **Dependencies**: Check manifest files (`package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`)

---

## Example Entry Quality

**Bad**: "Updated database code"

**Good**: "Migrated selector storage from JSON files to PostgreSQL JSONB - eliminates file I/O, enables SQL queries on selector metadata, reduces startup time from 2.3s to 0.4s"

**Bad**: "Fixed bug"

**Good**: "Fixed race condition in `learnSelector()` where concurrent workers could overwrite each other's changes (affects multi-process scraping)"

**Bad**: "Refactored auth"

**Good**: "⚠️ API Change: `AuthService.validate()` now returns `Promise<AuthResult>` instead of `boolean` - all callers must await and check `.isValid`"
