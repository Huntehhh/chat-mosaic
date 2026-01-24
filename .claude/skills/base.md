# Base Skill - Universal Patterns

## Core Principle

Complexity is the enemy. Every line of code is a liability. The goal is software simple enough that any engineer (or AI) can understand the entire system in one session.

---

## Simplicity Rules (STRICTLY ENFORCED)

**CRITICAL: These limits are non-negotiable. Check and enforce these limits for EVERY file created or modified.**

### Function Level
- **Maximum 20 lines per function** - if longer, decompose IMMEDIATELY
- **Maximum 3 parameters per function** - if more, use an options object or decompose
- **Maximum 2 levels of nesting** - flatten with early returns or extract functions
- **Single responsibility** - each function does exactly one thing
- **Descriptive names over comments** - if you need a comment to explain what, rename it

### File Level
- **Maximum 200 lines per file** - if longer, split by responsibility BEFORE continuing
- **Maximum 10 functions per file** - keeps cognitive load manageable
- **One export focus per file** - a file should have one primary purpose

### Module Level
- **Maximum 3 levels of directory nesting** - flat is better than nested
- **Clear boundaries** - each module has a single public interface
- **No circular dependencies** - ever

### Enforcement Protocol

**Before completing ANY file:**
1. Count total lines - if > 200, STOP and split
2. Count functions - if > 10, STOP and split
3. Check each function length - if any > 20 lines, STOP and decompose
4. Check parameter counts - if any > 3, STOP and refactor

**Never defer refactoring.** Fix violations immediately, not "later".

---

## Architectural Patterns

### Functional Core, Imperative Shell
- Pure functions for business logic - no side effects, deterministic
- Side effects only at boundaries - API calls, database, file system at edges
- Data in, data out - functions transform data, they don't mutate state

### Composition Over Inheritance
- No inheritance deeper than 1 level - prefer interfaces/composition
- Small, composable utilities - build complex from simple
- Dependency injection - pass dependencies, don't import them directly

### Error Handling
- Fail fast, fail loud - errors surface immediately
- No silent failures - every error is logged or thrown
- Design APIs where misuse is impossible

---

## Testing Philosophy

- **80%+ coverage on business logic** - the functional core
- **Integration tests for boundaries** - API endpoints, database operations
- **No untested code merges** - CI blocks without passing tests
- **Test behavior, not implementation** - tests survive refactoring
- **Each test runs in isolation** - no interdependence

---

## Anti-Patterns (Never Do This)

- Global state
- Magic numbers/strings - use named constants
- Deep nesting - flatten or extract
- Long parameter lists - use objects
- Comments explaining "what" - code should be self-documenting
- Dead code - delete it, git remembers
- Copy-paste duplication - extract to shared function
- God objects/files - split by responsibility
- Circular dependencies
- Premature optimization
- Large PRs - small, focused changes only
- Mixing refactoring with features - separate commits

---

## Quality Gates (Non-Negotiable)

### Coverage Threshold
- **Minimum 80% code coverage** - CI must fail below this
- Business logic (core/) should aim for 100%
- Integration tests cover boundaries

### Pre-Commit Hooks
All projects must have pre-commit hooks that run:
1. Linting (auto-fix where possible)
2. Type checking
3. Tests (at minimum, affected tests)
