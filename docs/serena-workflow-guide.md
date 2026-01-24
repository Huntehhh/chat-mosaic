# Serena MCP Workflow Guide

## Auto vs Manual Updates

| Component | Auto? | Location |
|-----------|-------|----------|
| Symbol Index | ✅ | LSP-powered, always current |
| Symbol Cache | ✅ | `.serena/cache/` |
| Memories | ❌ | `.serena/memories/*.md` |
| Config | ❌ | `.serena/project.yml` |

---

## Daily Workflow (No Action Needed)

Symbol queries always reflect current code state:
```
"Find the ProcessManager class"
"Show all methods in ConversationManager"
"Find references to StreamBuffer"
```

---

## After Architectural Changes

**Trigger:** New service, restructured directories, changed patterns

**Examples:**
```
"Update Serena memories to include the new AuthService"
"Add the new hooks/validators/ directory to architecture memory"
"Update key-services.md with the new CacheManager class"
"Reflect the Redux→Zustand migration in webview-frontend.md"
```

---

## Session Handoffs

**Trigger:** Pausing mid-task, switching contexts, long-running work

**Examples:**
```
"Save current progress on the permissions refactor to a Serena memory"
"Create a handoff memory for the MCP integration work"
"Write a memory summarizing what's left to do on the streaming fix"
"Document the current state of the WebSocket implementation"
```

**To resume:**
```
"Read the permissions-refactor memory and continue"
"What was the status of the MCP integration work?"
```

---

## Periodic Maintenance

**Trigger:** Every few weeks, or after major releases

**Examples:**
```
"Review all Serena memories and update outdated sections"
"Rebuild the architecture memory from current codebase"
"Check if any new directories should be added to ignored_paths"
"Audit memories for accuracy against current code"
```

---

## Config Updates (project.yml)

**When to update `ignored_paths`:**
- New build output directories
- New vendored/external code
- Generated files
- Large asset directories

**Example additions:**
```yaml
ignored_paths:
  - "dist/**"           # New build output
  - "generated/**"      # Auto-generated code
  - "vendor/**"         # Third-party code
```

---

## Quick Commands Reference

| Situation | Command |
|-----------|---------|
| Find code | `"Find the [ClassName] class"` |
| Understand file | `"Get symbols overview of [file.ts]"` |
| Track references | `"Find all references to [Symbol]"` |
| Update docs | `"Update [memory-name].md with [changes]"` |
| Save progress | `"Create a memory for [task] progress"` |
| Resume work | `"Read the [task] memory and continue"` |
| Full refresh | `"Rebuild all Serena memories"` |

---

## File Locations

```
.serena/
├── project.yml          # Config: languages, ignored paths
├── cache/               # Auto-managed symbol cache
└── memories/            # Your documentation snapshots
    ├── project-overview.md
    ├── architecture.md
    ├── build-and-test.md
    ├── key-services.md
    └── webview-frontend.md
```

---

## Key Insight

> **Symbol understanding = always live** (via LSP)
> **Memories = documentation snapshots** (update like READMEs)
