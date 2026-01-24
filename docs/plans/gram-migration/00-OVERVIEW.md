# Gram Migration Plan - Overview

## Executive Summary

Consolidate 12 MCP servers (~80+ tools) into Gram dynamic toolsets.
Reduce Claude context token usage from ~120K to ~50K tokens (~60% savings).

---

## Current State

```
┌─────────────────────────────────────────────────────────────┐
│                    CLAUDE CONTEXT WINDOW                    │
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ github  │ │ shadcn  │ │context7 │ │perplexity│          │
│  │ 10 tools│ │ 5 tools │ │ 4 tools │ │ 6 tools │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  apify  │ │yt-trans │ │   zen   │ │seq-think│           │
│  │ 8 tools │ │ 2 tools │ │10 tools │ │ 3 tools │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │postgres │ │playwrigt│ │chrome-  │ │basic-   │           │
│  │ 4 tools │ │12 tools │ │mcp 10   │ │memory 4 │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                             │
│             TOTAL: ~80+ TOOLS = ~120K TOKENS                │
└─────────────────────────────────────────────────────────────┘
```

---

## Target State

```
┌─────────────────────────────────────────────────────────────┐
│                    CLAUDE CONTEXT WINDOW                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              GRAM DYNAMIC TOOLSET                   │   │
│  │                                                     │   │
│  │  search_tools   describe_tools   execute_tool      │   │
│  │                                                     │   │
│  │  Consolidates: github, shadcn, context7, apify,    │   │
│  │  youtube, zen-apis, deepseek, postgres-queries     │   │
│  │                                                     │   │
│  │                    ~8K TOKENS                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │playwrigt│ │chrome-  │ │basic-   │ │perplxty │           │
│  │12 tools │ │mcp 10   │ │memory 4 │ │(local)6 │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                             │
│        LOCAL-ONLY: ~32 TOOLS = ~40K TOKENS                  │
│                                                             │
│                TOTAL: ~48K TOKENS                           │
│                SAVINGS: ~60%                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Migration Categories

| Category | Servers | Tools | Migration Path |
|----------|---------|-------|----------------|
| 1. HTTP MCPs | github, shadcn, context7 | ~19 | Gram proxies HTTP endpoints |
| 2. API-based | apify, zen, seq-thinking, youtube, postgres | ~33 | OpenAPI specs + Gram Functions |
| 3. Local-only | playwright, chrome-mcp, basic-memory, perplexity | ~32 | Keep local (can't migrate) |

---

## Implementation Phases

### Phase 1: HTTP MCP Consolidation (Easiest)
```
Week 1: HTTP servers → Gram
────────────────────────────
1. Create Gram project "consolidated-tools"
2. Add github MCP as source (or GitHub OpenAPI)
3. Add shadcn MCP as source
4. Add context7 MCP as source
5. Create toolset, enable dynamic mode
6. Test with `gram install claude-code`
```

### Phase 2: OpenAPI-Based Migration
```
Week 2-3: Create OpenAPI specs
──────────────────────────────
1. Download Apify OpenAPI spec
2. Create DeepSeek chat OpenAPI spec
3. Create Exa search OpenAPI spec
4. Upload all to Gram
5. Add to consolidated toolset
```

### Phase 3: Gram Functions
```
Week 3-4: Custom tool logic
───────────────────────────
1. Create postgres query function
2. Create youtube transcript function
3. Create zen API wrapper functions
4. Deploy and add to toolset
```

### Phase 4: Final Config
```
Week 4: Hybrid setup
────────────────────
1. Update claude_desktop_config.json
2. Test all tools work via Gram
3. Verify local tools still function
4. Document final architecture
```

---

## File Structure

```
docs/plans/gram-migration/
├── 00-OVERVIEW.md          ← You are here
├── 01-HTTP-MCP-SERVERS.md  ← GitHub, shadcn, Context7
├── 02-LOCAL-API-SERVERS.md ← Apify, zen, seq-thinking, etc.
└── 03-LOCAL-ONLY-SERVERS.md ← Playwright, Chrome, Memory
```

---

## Success Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Tool definitions loaded | 80+ | 35 | -56% |
| Context tokens | ~120K | ~48K | -60% |
| Startup latency | High | Lower | Faster |
| API call efficiency | 1 per tool | Batched | Better |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gram doesn't support MCP proxying | Medium | High | Use OpenAPI approach instead |
| Auth header issues | Low | Medium | Configure in Gram env vars |
| Tool discovery latency | Low | Low | Dynamic lookup is fast |
| Local tools break | Low | High | Keep separate, test first |

---

## Next Steps

1. **Read detailed plans** in files 01, 02, 03
2. **Log into Gram dashboard** at https://app.getgram.ai
3. **Start with Phase 1** (HTTP MCPs are lowest risk)
4. **Iterate** through phases, testing each step

---

## Final Config Preview

```json
{
  "mcpServers": {
    "gram-tools": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://app.getgram.ai/mcp/consolidated-tools",
        "--header",
        "Authorization:Bearer YOUR_GRAM_API_KEY"
      ]
    },
    "playwright": { "...local config..." },
    "chrome-mcp": { "...local config..." },
    "basic-memory": { "...local config..." },
    "perplexity": { "...local config..." }
  }
}
```

One Gram MCP replaces 8 separate servers.
~50 tools hidden behind 3 meta-tools.
~60% token savings.
