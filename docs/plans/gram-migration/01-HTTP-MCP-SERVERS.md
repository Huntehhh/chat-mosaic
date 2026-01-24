# Category 1: HTTP-Based MCP Servers

## Overview

These servers are already hosted remotely but expose many tools directly to Claude's context.
Consolidating through Gram hides individual tools behind dynamic toolset meta-tools.

```
CURRENT STATE                          GRAM CONSOLIDATED
─────────────────                      ─────────────────

┌─────────────────┐                    ┌─────────────────┐
│  Claude Context │                    │  Claude Context │
│                 │                    │                 │
│  github:        │                    │  gram-toolset:  │
│   - repos       │                    │   - search_tools│
│   - pulls       │                    │   - describe    │
│   - issues      │     ────────►      │   - execute     │
│   - actions     │                    │                 │
│   - users       │                    │  (~8K tokens)   │
│   - gists       │                    │                 │
│   ... (10+)     │                    └────────┬────────┘
│                 │                             │
│  shadcn:        │                             ▼
│   - components  │                    ┌─────────────────┐
│   - registry    │                    │  Gram Platform  │
│   ... (5+)      │                    │                 │
│                 │                    │  Proxies to:    │
│  context7:      │                    │  - GitHub MCP   │
│   - lookup      │                    │  - shadcn MCP   │
│   - search      │                    │  - Context7 MCP │
│   ... (3+)      │                    │                 │
│                 │                    │  Dynamic lookup │
│  (~50K+ tokens) │                    │  on demand      │
└─────────────────┘                    └─────────────────┘
```

---

## Server: github

**Current Config:**
```json
{
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": { "Authorization": "Bearer github_pat_..." }
}
```

**Tools Exposed:** ~10+ (repos, pulls, issues, actions, users, gists, labels, projects, stargazers, support_docs)

**Migration Path:**
- GitHub Copilot MCP is an HTTP endpoint - Gram can proxy it directly.
- Create toolset in Gram dashboard pointing to GitHub's MCP URL.
- Configure auth header passthrough in Gram environment variables.

**Steps:**
1. In Gram dashboard → New Project → "GitHub Tools"
2. Add as "Remote MCP" source (if supported) OR recreate via OpenAPI
3. GitHub has OpenAPI specs at `api.github.com` - can upload those
4. Create toolset, enable dynamic mode

---

## Server: shadcn

**Current Config:**
```json
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "mcp-remote", "https://www.shadcn.io/api/mcp"]
}
```

**Tools Exposed:** ~5+ (get_component, list_components, search_registry, etc.)

**Migration Path:**
- shadcn MCP is HTTP-based, accessed via `mcp-remote` bridge.
- Gram can connect to the same endpoint directly.
- No auth required for public shadcn registry.

**Steps:**
1. In Gram dashboard → Add source → Remote MCP or HTTP endpoint
2. Point to `https://www.shadcn.io/api/mcp`
3. Gram will discover tools automatically
4. Add to consolidated toolset

---

## Server: context7

**Current Config:**
```json
{
  "type": "http",
  "url": "https://mcp.context7.com/mcp",
  "headers": { "CONTEXT7_API_KEY": "ctx7sk-..." }
}
```

**Tools Exposed:** ~3-5 (library lookup, documentation search, etc.)

**Migration Path:**
- Already HTTP MCP - straightforward Gram proxy.
- API key needs to be configured in Gram environment.

**Steps:**
1. In Gram dashboard → Add HTTP MCP source
2. Configure `CONTEXT7_API_KEY` in Gram environment variables
3. Add to consolidated toolset

---

## Consolidated Toolset Plan

```
┌─────────────────────────────────────────────────────┐
│                 GRAM TOOLSET                        │
│              "dev-assistant-tools"                  │
│                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────┐ │
│  │   GitHub    │ │   shadcn    │ │   Context7    │ │
│  │   Source    │ │   Source    │ │    Source     │ │
│  │             │ │             │ │               │ │
│  │  10+ tools  │ │  5+ tools   │ │   3+ tools    │ │
│  └──────┬──────┘ └──────┬──────┘ └───────┬───────┘ │
│         │               │                │         │
│         └───────────────┼────────────────┘         │
│                         ▼                          │
│              ┌─────────────────┐                   │
│              │ Dynamic Toolset │                   │
│              │    ENABLED      │                   │
│              └────────┬────────┘                   │
│                       │                            │
│                       ▼                            │
│         ┌─────────────────────────┐                │
│         │  3 Meta-Tools Exposed:  │                │
│         │  - search_tools         │                │
│         │  - describe_tools       │                │
│         │  - execute_tool         │                │
│         └─────────────────────────┘                │
└─────────────────────────────────────────────────────┘
```

**Token Savings Estimate:**
- Before: ~50K tokens (18+ tool definitions with full schemas)
- After: ~8K tokens (3 meta-tool definitions)
- Savings: **~84% reduction**

---

## Open Questions

1. **Does Gram support proxying existing MCP servers?**
   - Need to verify in dashboard if "Remote MCP" source type exists
   - Alternative: Use OpenAPI specs for GitHub API instead

2. **Auth Header Passthrough**
   - GitHub requires Bearer token
   - Context7 requires custom header
   - Gram environment variables should handle this

3. **Toolset Naming**
   - Suggest: `dev-tools` or `code-assistant`
   - Will appear as single MCP server in Claude config
