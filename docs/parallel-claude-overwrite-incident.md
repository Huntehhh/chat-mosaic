# Parallel Claude Overwrite Incident - 2025-12-19

## What Happened

```
Timeline:
  Claude A: Implements persistent process mode → commits ec3b32f
  Claude B: Working in parallel, unaware of A's changes
  Claude B: Commits CLI fixes → overwrites extension.ts → loses A's code
  Result: Persistent process code vanished from main
```

The code wasn't deleted—it exists in git history (`git show ec3b32f:src/extension.ts`). But main's HEAD no longer has it.

## Why Worktrees Didn't Help

Worktrees isolate **working directories**, not branches. When Claude B merged to main, it overwrote the file. Worktrees can't prevent this.

## Root Cause

No coordination mechanism between parallel Claude instances editing the same file.

## Prevention Strategies

| Strategy | How |
|----------|-----|
| **Lock files** | Create `.claude-editing-extension.ts.lock` before major edits |
| **Atomic features** | Complete feature → merge → delete branch before starting new work |
| **Rebase before merge** | Always `git fetch && git rebase origin/main` before merging |
| **Diff before commit** | Run `git diff main` to see what you're changing |
| **Protected methods** | Comment `// CRITICAL: Do not remove - persistent process mode` |
| **Feature flags** | Use config flags so features can coexist |

## Recovery

```bash
# The code still exists:
git show ec3b32f:src/extension.ts > /tmp/old-extension.ts
# Compare and manually merge, or cherry-pick specific hunks
```

## Lesson

Git worktrees provide isolation for *your* work, not protection from *others'* merges. When multiple agents edit the same file, coordinate or lose code.
