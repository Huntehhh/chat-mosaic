# Category 3: Local-Only MCP Servers

## Overview

These servers require local system access (browser, files, databases).
They cannot be migrated to Gram's cloud-hosted platform.

```
WHY THESE STAY LOCAL
────────────────────

┌─────────────────────────────────────────────────────┐
│                  YOUR MACHINE                       │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Playwright  │  │ Chrome MCP  │  │Basic Memory │ │
│  │             │  │             │  │             │ │
│  │ Controls    │  │ DevTools    │  │ Local Files │ │
│  │ Browser     │  │ Protocol    │  │ & State     │ │
│  │ Instance    │  │ Access      │  │             │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │        │
│         ▼                ▼                ▼        │
│  ┌─────────────────────────────────────────────┐   │
│  │              LOCAL RESOURCES                │   │
│  │  - Chrome/Browser windows                   │   │
│  │  - File system                              │   │
│  │  - Network localhost                        │   │
│  │  - Project directories                      │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
         │
         │  CANNOT GO TO CLOUD
         │  (no network path to local resources)
         ▼
    ┌─────────┐
    │  Gram   │  ──── X ────  No access to your
    │  Cloud  │               local browser/files
    └─────────┘
```

---

## Server: playwright

**Current Config:**
```json
{
  "command": "npx",
  "args": [
    "@playwright/mcp@latest",
    "--browser=chrome",
    "--storage-state=C:\\MCP\\BROWSER-AUTOMATION-CONFIG\\...",
    "--viewport-size=1920x1080"
  ]
}
```

**What It Does:**
- Controls a local Chrome browser instance
- Takes screenshots, navigates pages
- Interacts with DOM elements
- Runs on YOUR machine's display

**Why It Can't Migrate:**
```
Gram Cloud Server                Your Machine
─────────────────                ────────────
       │                              │
       │   "click button #submit"     │
       │ ────────────────────────────►│
       │                              │
       │   Which browser?             │
       │   Gram has no browser!       │
       │                              │
       X   BLOCKED                    │
```

**Tools Exposed:** ~10-15 (navigate, click, screenshot, fill, evaluate, etc.)

**Recommendation:** Keep in local config, separate from Gram toolset.

---

## Server: chrome-mcp

**Current Config:**
```json
{
  "command": "node",
  "args": ["C:\\...\\mcp-chrome-bridge\\dist\\mcp\\mcp-server-stdio.js"]
}
```

**What It Does:**
- Connects to Chrome DevTools Protocol
- Inspects network requests, console logs
- Debugs JavaScript, profiles performance
- Requires Chrome running on YOUR machine

**Why It Can't Migrate:**
- DevTools Protocol connects to `localhost:9222`
- Gram cloud cannot reach your localhost
- Even if it could, it's YOUR browser session

**Tools Exposed:** ~8-12 (network, console, debugger, profiler, etc.)

**Recommendation:** Keep local, essential for frontend debugging.

---

## Server: basic-memory

**Current Config:**
```json
{
  "command": "uvx",
  "args": ["basic-memory", "mcp", "--project", "ssai-hotel"]
}
```

**What It Does:**
- Persists conversation/project memory locally
- Stores data in local files/SQLite
- Project-specific context (`ssai-hotel`)

**Why It Can't Migrate:**
- Memory files are on YOUR filesystem
- Project context is local
- Would need cloud storage to migrate (different product)

**Tools Exposed:** ~3-5 (save, recall, search, clear, etc.)

**Recommendation:** Keep local for project continuity.

---

## Handling Local Servers with Gram

Since these can't be consolidated, your final config will be hybrid:

```
┌─────────────────────────────────────────────────────┐
│              CLAUDE DESKTOP CONFIG                  │
│                                                     │
│  GRAM TOOLSET (Dynamic - 3 meta-tools):             │
│  ┌───────────────────────────────────────────────┐  │
│  │  gram-consolidated:                           │  │
│  │    url: https://app.getgram.ai/mcp/your-slug  │  │
│  │    (contains: github, shadcn, context7,       │  │
│  │     apify, zen-apis, deepseek, etc.)          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  LOCAL SERVERS (Full tool exposure):                │
│  ┌───────────────────────────────────────────────┐  │
│  │  playwright:     ~12 tools                    │  │
│  │  chrome-mcp:     ~10 tools                    │  │
│  │  basic-memory:   ~4 tools                     │  │
│  │  perplexity:     ~6 tools (if kept local)     │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  TOTAL CONTEXT LOAD:                                │
│  - Gram: ~8K tokens (3 meta-tools)                  │
│  - Local: ~40K tokens (26 tools)                    │
│  - TOTAL: ~48K tokens                               │
│                                                     │
│  vs CURRENT: ~120K+ tokens (all tools exposed)      │
│  SAVINGS: ~60%                                      │
└─────────────────────────────────────────────────────┘
```

---

## Alternative: Reduce Local Tool Exposure

Even without Gram, you can reduce local tool token usage:

**Option 1: Disable Unused Tools**
```json
// In MCP server configs, some support tool filtering
"playwright": {
  "args": ["--tools=navigate,click,screenshot"]  // Only expose 3
}
```

**Option 2: Conditional Loading**
- Only enable browser tools when doing frontend work
- Use different Claude profiles for different tasks

**Option 3: Custom Wrapper**
- Create a "meta-MCP" that proxies local servers
- Implements dynamic toolset pattern locally
- More complex but possible

---

## Summary

| Server | Tools | Can Migrate? | Action |
|--------|-------|--------------|--------|
| playwright | ~12 | NO | Keep local |
| chrome-mcp | ~10 | NO | Keep local |
| basic-memory | ~4 | NO | Keep local |

**Total local tools that MUST stay:** ~26

**With Gram consolidating the rest:** You save ~60-70% token usage overall.

---

## Future Consideration

If Gram adds support for:
- **Local MCP proxying** (agent on your machine)
- **Tunnel connections** (like ngrok for MCP)

Then these could potentially be consolidated too.

For now, accept the hybrid approach as the optimal solution.
