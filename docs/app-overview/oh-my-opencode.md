# Oh-My-OpenCode Overview

## What It Is

A plugin for OpenCode that transforms it into a multi-agent AI coding system. Instead of one AI model, you get a team of specialized agents working in parallel.

## Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SISYPHUS (Orchestrator)              │
│                    Claude Opus 4.5                      │
├─────────────┬─────────────┬─────────────┬──────────────┤
│   @oracle   │ @librarian  │  @frontend  │   @explore   │
│  Claude 4.5 │ Sonnet 4.5  │  Gemini 3   │     Grok     │
│ Architecture│Documentation│   UI/UX     │ Fast Search  │
└─────────────┴─────────────┴─────────────┴──────────────┘
```

## Key Benefits

| Feature | What It Does |
|---------|--------------|
| **Parallel Agents** | Gemini builds frontend while Claude handles backend simultaneously |
| **LSP Tools** | Agents get IDE features: refactoring, symbol nav, type info |
| **Auto-Completion** | Forces agents to finish all TODOs before stopping |
| **Token Efficiency** | Smart truncation, 50% context buffer, output capping |
| **Multi-Provider** | Use Claude, GPT, and Gemini together from one interface |

## Usage Examples

### Basic Commands
```bash
opencode                    # Start the interface
Ask @oracle about...        # Architecture/debugging questions
Ask @librarian to find...   # Documentation research
Ask @explore for...         # Fast codebase pattern search
Ask @frontend to build...   # UI component generation
```

### Magic Keywords (type these in chat)
```
ultrawork    → Maximum parallel orchestration mode
search       → Parallel explore + librarian search
analyze      → Deep analysis with expert consultation
```

### Real Workflow Examples

**1. Debug a complex issue:**
```
Ask @oracle to analyze why authentication fails after token refresh
```
Oracle (GPT) examines architecture while Librarian researches similar fixes.

**2. Build a feature with parallel agents:**
```
Build a user settings page with dark mode toggle
```
Frontend agent (Gemini) creates UI while Claude handles state logic.

**3. Research across codebases:**
```
Ask @librarian how rate limiting is implemented in popular Node.js APIs
```
Searches docs and open-source examples simultaneously.

**4. Fast codebase exploration:**
```
Ask @explore where error handling middleware is defined
```
Grok-powered fast pattern matching across your project.

## Your Current Setup

| Provider | Model | Status |
|----------|-------|--------|
| Claude Max20 | Opus 4.5 | ✓ Configured |
| Gemini | 2.5 Pro/Flash | ✓ API Key Set |
| ChatGPT | - | Not configured |

## Config Locations

- **Global**: `~/.config/opencode/opencode.json`
- **Plugin**: `~/.config/opencode/oh-my-opencode.json`
- **Project**: `.opencode/oh-my-opencode.json` (overrides global)

## Quick Tips

1. **Delegate heavy research** → `@librarian` or `@explore`
2. **UI work** → `@frontend` leverages Gemini's visual strengths
3. **Architecture decisions** → `@oracle` for strategic analysis
4. **Say "ultrawork"** → Unlocks full parallel agent mode
5. **Background tasks** → Agents work while you continue chatting

---

## Agent Strengths & When to Use Each

### @oracle (Claude Opus 4.5) — The Architect
**Excels at:** System design, debugging complex issues, code review, strategic decisions
**Use when:** You need to understand WHY something works (or doesn't)

```
Ask @oracle to review this PR for security vulnerabilities
Ask @oracle why this race condition occurs in the payment flow
Ask @oracle to design a caching strategy for our API
Ask @oracle what's the best way to structure this microservice
```

### @librarian (Claude Sonnet 4.5) — The Researcher
**Excels at:** Documentation lookup, finding patterns, implementation research
**Use when:** You need to know HOW something is done elsewhere

```
Ask @librarian how NextJS 14 handles server actions
Ask @librarian to find examples of WebSocket reconnection logic
Ask @librarian what's the recommended way to handle auth in tRPC
Ask @librarian to compare Zustand vs Jotai for this use case
```

### @frontend (Gemini 3 Pro) — The Designer-Developer
**Excels at:** UI components, layouts, animations, visual polish
**Use when:** Building user interfaces or anything visual

```
Ask @frontend to build a responsive pricing table with hover effects
Ask @frontend to create a modal with smooth enter/exit animations
Ask @frontend to refactor this form into accessible React components
Ask @frontend to add dark mode support to this component library
```

### @explore (Grok) — The Speed Searcher
**Excels at:** Fast pattern matching, finding files, codebase navigation
**Use when:** You need to FIND something quickly

```
Ask @explore where API routes are defined
Ask @explore for all files importing the AuthContext
Ask @explore to find usages of the deprecated fetchUser function
Ask @explore what middleware runs before the checkout endpoint
```

---

## Prompt Patterns by Task Type

### Debugging
```
ultrawork: Debug why tests fail only in CI but pass locally
Ask @oracle to trace the data flow from login to dashboard
Ask @explore where the error "InvalidToken" is thrown
```

### Feature Development
```
ultrawork: Add real-time notifications using WebSockets
Ask @frontend to build the notification dropdown UI
Ask @librarian how Slack implements notification batching
```

### Refactoring
```
Ask @oracle to identify code smells in the user service
ultrawork: Migrate from callbacks to async/await in the API layer
Ask @explore for all places using the old authentication pattern
```

### Performance
```
Ask @oracle to analyze why the dashboard loads slowly
Ask @librarian for React performance optimization techniques
ultrawork: Implement virtualization for the transaction list
```

### Learning a New Codebase
```
Ask @explore for the entry point and main routing logic
Ask @librarian to explain how the state management works here
Ask @oracle to map out the data flow between services
```

---

## Power Combos (Multi-Agent Workflows)

**Full-stack feature:**
```
ultrawork: Build a user profile page with avatar upload
```
→ Sisyphus delegates: @frontend builds UI, Claude handles API, @librarian researches S3 patterns

**Deep debugging:**
```
analyze: Why do payments occasionally fail with timeout errors
```
→ @oracle examines architecture, @explore finds related code, @librarian checks similar issues

**Code modernization:**
```
ultrawork: Convert this class component to hooks with TypeScript
```
→ Parallel type inference, hook migration, and test updates

### Combo Quick Reference

| Scenario | Trigger | Agents Used | Best For |
|----------|---------|-------------|----------|
| Full-stack build | `ultrawork:` | All | New features |
| Deep investigation | `analyze:` | @oracle + @explore + @librarian | Complex bugs |
| Research mode | `search:` | @librarian + @explore | Finding patterns |
| UI overhaul | `ultrawork:` + UI keywords | @frontend + @librarian | Visual work |
| Code review | `Ask @oracle to review` | @oracle solo | PR reviews |

### Detailed Combo Breakdowns

**1. Full-Stack Feature Build**
```
ultrawork: Build a user profile page with avatar upload
```
Step-by-step agent workflow:
1. **Sisyphus** analyzes requirements, creates task breakdown
2. **@explore** finds existing user components and API patterns
3. **@librarian** researches S3/cloud storage best practices
4. **@frontend** builds the UI components (runs in background)
5. **Claude** writes API endpoints and validation logic (parallel)
6. **Sisyphus** integrates all pieces, runs tests

**2. Production Bug Triage**
```
analyze: Users report intermittent 500 errors on checkout
```
Step-by-step agent workflow:
1. **@explore** finds all checkout-related code paths
2. **@oracle** analyzes error patterns and potential race conditions
3. **@librarian** checks if similar issues exist in related libraries
4. **Sisyphus** synthesizes findings into actionable fix

**3. API Development**
```
ultrawork: Create REST endpoints for user management with JWT auth
```
Step-by-step agent workflow:
1. **@librarian** researches JWT best practices and middleware patterns
2. **@oracle** designs the API structure and security model
3. **Claude** implements routes, validation, error handling
4. **@explore** verifies integration with existing auth system

**4. Test Suite Creation**
```
ultrawork: Add comprehensive tests for the payment module
```
Step-by-step agent workflow:
1. **@explore** maps all functions and edge cases in payment module
2. **@librarian** finds testing patterns for payment systems
3. **Claude** writes unit tests (parallel with integration tests)
4. **@oracle** reviews test coverage and suggests missing scenarios

**5. Code Review Pipeline**
```
Ask @oracle to review this PR for security, performance, and maintainability
```
Step-by-step agent workflow:
1. **@oracle** performs deep architectural review
2. **@explore** checks for pattern consistency across codebase
3. **@oracle** delivers consolidated feedback with priorities

---

## Background Task Patterns

### Starting Background Work
```
Ask @librarian to research authentication patterns (run in background)
Ask @frontend to prototype the dashboard layout (run in background)
```
You continue working while agents process in parallel.

### Checking Agent Progress
```
What's the status of background tasks?
Show me what @librarian found
```

### Combining Results
```
Combine the research from @librarian with @frontend's prototype
Take @oracle's security recommendations and apply them to the code
```

### Parallel Execution Example
```
ultrawork: Build the settings page
  → @frontend: UI components (background)
  → @librarian: Research accessibility patterns (background)
  → Claude: State management and API calls (foreground)
  → Results merge when all complete
```

---

## Anti-Patterns (What NOT to Do)

### Wrong Agent for the Job

| Don't Do This | Why It Fails | Do This Instead |
|---------------|--------------|-----------------|
| `Ask @explore to design the architecture` | Explore is fast but shallow | `Ask @oracle to design...` |
| `Ask @frontend to write the database schema` | Frontend = UI only | `Ask @oracle` or main Claude |
| `Ask @oracle to find all usages of X` | Oracle is slow for search | `Ask @explore to find...` |
| `Ask @librarian to fix this bug` | Librarian researches, doesn't code | `Ask @oracle to analyze...` |

### When to Use Single vs. Multi-Agent

**Use single agent when:**
- Quick lookups (`Ask @explore where...`)
- Focused research (`Ask @librarian how...`)
- Code review (`Ask @oracle to review...`)
- Simple UI component (`Ask @frontend to build a button`)

**Use multi-agent (ultrawork) when:**
- Full features spanning frontend + backend
- Complex debugging requiring multiple perspectives
- Large refactors touching many files
- Tasks requiring both research AND implementation

### Avoid Over-Delegation
```
# Too fragmented - slows things down
Ask @explore for file A
Ask @explore for file B
Ask @explore for file C

# Better - batch the request
Ask @explore to map all files related to user authentication
```

### Don't Mix Concerns in One Request
```
# Confusing - agents don't know who should lead
Ask @frontend and @oracle to build a secure login page

# Clear - let Sisyphus orchestrate
ultrawork: Build a secure login page with proper validation
```
