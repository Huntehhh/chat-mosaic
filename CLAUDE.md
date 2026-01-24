# Claude Code Chat Extension

VS Code extension providing a beautiful chat interface for Claude Code CLI.

## Project Goal

Make this extension look and function like the official Claude Code VS Code extension.

## CRITICAL STEPS - FOLLOW EVERY CHAT

## VSCODE EXTENSION PROCESS

Each time you recompile, you must always rebuild and reinstall the VS Code extension. 

## GITHUB Process

### Main Branch Protection

**NEVER corrupt `main`.** When merging to main and conflicts occur:

1. **STOP** — do not auto-resolve if there's ANY uncertainty
2. **SHOW** — display the conflict with surrounding context
3. **ASK** — present resolution options and let user decide
4. Trivial conflicts (whitespace, import order): resolve automatically, note what was done

### Key Files

- `src/extension.ts` - Backend logic, message handling
- `src/ui.ts` - HTML template
- `src/ui-styles.ts` - CSS styles
- `src/script.ts` - Frontend JavaScript

### Build Commands

```bash
npm run compile                    # Build
npx vsce package --allow-missing-repository  # Package VSIX
code --install-extension claude-code-chat-1.1.0.vsix --force
```

## Build Rules

- **JSDoc**: Never write `*/` inside comments (even in quoted strings) - breaks parser
- **Zod v4**: Use `z.record(z.string(), valueSchema)` not `z.record(valueSchema)`
- **Always**: Run `npm run compile` after editing `.ts` files

---

## Writing Rules

Whenever a user asks for "high-level documentation" Markdown Document, you shall always attempt to write with brevity, be succinct, and economical with your word choice; But still very detail-oriented and specific. Use visual diagrams to describe the problem from a high level when necessary,  And always keep it around 50 to 100 lines unless told otherwise.

## Git Rules

**Local only.** Never push to remote unless user explicitly asks.

### Sparse Checkout Workflow

**NEVER work directly on `main`.** Create a sparse worktree with ONLY the files you need.

**At session start:**

1. Ask user which files/folders you'll be working on
2. Create sparse worktree:

```bash
./scripts/wt add <name> <file1> [file2...]
cd .worktrees/<name>
```

**Note:** Worktrees branch from local `main`. Never rebase from remote—local is source of truth.

**Examples:**

```bash
wt add ui-work src/ui.ts src/ui-styles.ts
wt add backend src/extension.ts src/utils.ts
wt add docs docs/ CLAUDE.md
```

**Why sparse checkout:** You literally cannot touch files outside your checkout. When you merge, only YOUR files are in the diff. No accidental overwrites of other Claudes' work.

**Helper commands:**

- `wt add <name> <files...>` — Create sparse worktree
- `wt rm <name>` — Remove worktree and branch
- `wt list` — List all worktrees
- `wt files` — Show files in current sparse checkout

### Merge Process

1. Go to main and merge:

```bash
cd <main-repo>
git merge feature/<name>
```

2. Cleanup immediately:

```bash
./scripts/wt rm <name>
```

**Conflict handling:**

- If conflict is obvious (whitespace, import order): resolve automatically
- If ANY uncertainty: stop and ask user before resolving

### Commit Format

**Use conventional prefixes:**

- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructuring
- `docs:` — documentation only
- `chore:` — maintenance tasks

Example: `feat: add dark mode toggle to settings`

### Auto-Commit Triggers

Commit when:

- Every ~5 chat turns during active development
- User says "save", "backup", "checkpoint"
- Before risky operations
- After completing any feature or fix

### Session End

Always ask: *"Want me to commit and/or merge to main before we stop?"*