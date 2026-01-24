# Git Workflow

*Load with: base.md*

---

## Core Rules

- **Never push** unless user explicitly asks
- **Never work directly on main** — use worktrees or feature branches
- **Conventional prefixes**: `feat:` | `fix:` | `refactor:` | `docs:` | `chore:`

---

## Commit Thresholds

Commit when any threshold is exceeded:
- **>5 files** changed
- **>200 lines** total (insertions + deletions)
- **>30 minutes** since last commit

Quick check:
```bash
git diff --shortstat HEAD
# Example output: 8 files changed, 180 insertions(+), 45 deletions(-)
```

---

## Splitting Large Changes

When changes exceed thresholds, split by:

**By layer:**
```
1. Database migration
2. Model/types
3. API/service
4. Frontend/UI
5. Tests
```

**By feature slice:**
```
1. Create functionality
2. Read functionality
3. Update functionality
4. Delete functionality
```

**Refactor first:**
```
1. Extract/rename (no behavior change) — commit
2. Add new feature using extracted code — commit
```

Use `git add -p` to stage partial changes interactively.

---

## Pre-Commit Checklist

Before ANY commit:
```bash
git status                    # What's modified?
git diff --shortstat HEAD     # Size check
git branch --no-merged main   # Unmerged work?
```

If unmerged branches exist → merge first OR confirm with user.

---

## Conflict Resolution

- **Trivial** (whitespace, imports): Auto-resolve, note what was done
- **Uncertain**: STOP → show conflict with context → ask user

---

## Worktree Workflow

```bash
# Create worktree with only needed files
./scripts/wt add <name> <file1> [file2...]
cd .worktrees/<name>

# Merge and cleanup
cd <main-repo>
git merge feature/<name>
./scripts/wt rm <name>
```

---

## Session End

Always ask: "Commit and/or merge to main before we stop?"
