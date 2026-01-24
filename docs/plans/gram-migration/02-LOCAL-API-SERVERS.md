# Category 2: Local MCP Servers Using External APIs

## Overview

These servers run locally but call external REST APIs (Perplexity, Gemini, DeepSeek, etc.).
Migration involves creating OpenAPI specs or Gram Functions that call these APIs directly.

```
CURRENT STATE                          GRAM CONSOLIDATED
─────────────────                      ─────────────────

┌──────────────┐
│    Claude    │                       ┌──────────────┐
└──────┬───────┘                       │    Claude    │
       │                               └──────┬───────┘
       ▼                                      │
┌──────────────┐                              ▼
│  Local MCP   │                       ┌──────────────┐
│  Processes   │                       │ Gram Dynamic │
│              │      ────────►        │   Toolset    │
│ perplexity   │                       │              │
│ zen          │                       │ 3 meta-tools │
│ seq-thinking │                       └──────┬───────┘
│ apify        │                              │
│ postgres     │                              ▼
│ yt-transcript│                       ┌──────────────┐
└──────┬───────┘                       │ Gram Cloud   │
       │                               │              │
       ▼                               │ Calls APIs:  │
┌──────────────┐                       │ - Gemini     │
│ External APIs│                       │ - DeepSeek   │
│              │                       │ - Perplexity │
│ - Gemini     │                       │ - Apify      │
│ - DeepSeek   │                       │ - PostgreSQL │
│ - Perplexity │                       └──────────────┘
│ - Apify      │
└──────────────┘
```

---

## Server: perplexity

**Location:** `C:\OPEN-SOURCE-TOOLS\perplexity-mcp-zerver\`

**How It Works:**
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Claude    │───►│  Puppeteer  │───►│ Perplexity  │
│   calls     │    │  Browser    │    │   Website   │
│   tool      │    │  Automation │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

**Tools:** `search`, `chat_perplexity`, `extract_url_content`, `get_documentation`, `find_apis`, `check_deprecated_code`

**Migration Complexity:** HIGH
- Uses Puppeteer browser automation, not REST API
- Scrapes Perplexity.ai website directly
- Cannot easily convert to OpenAPI

**Migration Options:**
1. **Use Perplexity Official API** (if available) - create OpenAPI spec
2. **Keep as local MCP** - exclude from Gram consolidation
3. **Rewrite as Gram Function** - embed browser logic (complex)

**Recommendation:** Keep local OR switch to official Perplexity API if you have access.

---

## Server: zen

**Location:** `C:\MCP\zen-mcp-server\`

**How It Works:**
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Claude    │───►│  Zen MCP    │───►│  Gemini API │
│   calls     │    │  Python     │    │  OpenRouter │
│   tool      │    │  Server     │    │  Custom LLM │
└─────────────┘    └─────────────┘    └─────────────┘
```

**Tools (Enabled):**
- `chat` - General conversation with external LLM
- `thinkdeep` - Deep reasoning/analysis
- `codereview` - Code review with LLM
- `planner` - Planning assistance
- `consensus` - Multi-model consensus
- `challenge` - Challenge assumptions
- `apilookup` - API documentation lookup
- `listmodels` - List available models
- `version` - Server version info
- `clink` - CLI tool linking

**Underlying APIs:**
- Gemini API (`GEMINI_API_KEY`)
- OpenRouter API (`OPENROUTER_API_KEY`)
- Custom Ollama endpoint (`localhost:11434`)

**Migration Path:** MEDIUM complexity
- These are REST API calls - can create OpenAPI specs
- Tool logic is sophisticated - needs Gram Functions for full feature parity

**OpenAPI Approach:**
```yaml
# Simplified - actual would be more detailed
paths:
  /chat:
    post:
      summary: Chat with LLM
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                prompt: { type: string }
                model: { type: string }
      responses:
        200:
          description: LLM response
```

**Gram Functions Approach:**
```typescript
// Pseudocode for Gram Function
gram.tool({
  name: "zen_chat",
  description: "Chat with Gemini/OpenRouter",
  inputSchema: { prompt: z.string(), model: z.string().optional() },
  async execute(ctx, input) {
    const response = await fetch("https://generativelanguage.googleapis.com/...", {
      headers: { "Authorization": `Bearer ${ctx.env.GEMINI_API_KEY}` },
      body: JSON.stringify({ contents: [{ parts: [{ text: input.prompt }] }] })
    });
    return ctx.json(await response.json());
  }
});
```

---

## Server: sequential-thinking

**Location:** Python package `mcp-server-mas-sequential-thinking`

**Underlying APIs:**
- DeepSeek API (`DEEPSEEK_API_KEY`)
- Exa API (`EXA_API_KEY`) - search/research

**Migration Path:** MEDIUM
- DeepSeek has OpenAPI-compatible REST API
- Exa has documented REST API
- Can create OpenAPI specs for both

**DeepSeek OpenAPI Structure:**
```yaml
openapi: 3.1.0
info:
  title: DeepSeek Chat API
  version: 1.0.0
servers:
  - url: https://api.deepseek.com/v1
paths:
  /chat/completions:
    post:
      summary: Create chat completion
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ChatRequest'
```

---

## Server: apify-online

**Package:** `@apify/actors-mcp-server`

**Underlying API:** Apify REST API (well-documented)

**Migration Path:** EASY
- Apify has official OpenAPI specification
- Download from: `https://docs.apify.com/api/v2`
- Upload directly to Gram

**Steps:**
1. Download Apify OpenAPI spec
2. Upload to Gram dashboard
3. Configure `APIFY_TOKEN` in Gram environment
4. Create toolset, enable dynamic mode

---

## Server: youtube-transcript

**Package:** `@kimtaeyoon83/mcp-server-youtube-transcript`

**How It Works:**
- Uses `youtube-captions-scraper` library
- Scrapes YouTube captions, not official API

**Migration Path:** MEDIUM
- Could use YouTube Data API v3 (requires API key)
- Or create Gram Function that embeds scraper logic

**Gram Function Approach:**
```typescript
gram.tool({
  name: "youtube_transcript",
  description: "Get transcript from YouTube video",
  inputSchema: {
    videoId: z.string(),
    language: z.string().optional()
  },
  async execute(ctx, input) {
    // Call YouTube timedtext endpoint
    const response = await fetch(
      `https://www.youtube.com/api/timedtext?v=${input.videoId}&lang=${input.language || 'en'}`
    );
    return ctx.json({ transcript: await response.text() });
  }
});
```

---

## Server: postgres

**Current Config:**
```json
{
  "command": "npx",
  "args": ["@henkey/postgres-mcp-server", "--connection-string", "postgresql://..."]
}
```

**Migration Path:** GRAM FUNCTIONS
- Cannot expose database directly via OpenAPI (security)
- Create Gram Functions that execute specific queries
- Limit to read-only operations or approved write patterns

**Gram Function Example:**
```typescript
gram.tool({
  name: "postgres_query",
  description: "Execute read-only SQL query",
  inputSchema: { query: z.string() },
  async execute(ctx, input) {
    // Validate query is SELECT only
    if (!input.query.trim().toLowerCase().startsWith('select')) {
      return ctx.fail({ error: "Only SELECT queries allowed" });
    }
    // Use pg client to execute
    const result = await pgClient.query(input.query);
    return ctx.json(result.rows);
  }
});
```

**Security Considerations:**
- Never expose raw SQL execution
- Use parameterized queries
- Limit to specific tables/views
- Consider connection pooling

---

## Migration Priority Matrix

```
                    COMPLEXITY
              Low         Medium        High
         ┌──────────┬──────────────┬──────────┐
    High │  apify   │ zen          │          │
         │          │ seq-thinking │          │
  VALUE  ├──────────┼──────────────┼──────────┤
         │ postgres │ youtube      │perplexity│
    Low  │          │              │          │
         └──────────┴──────────────┴──────────┘

RECOMMENDED ORDER:
1. apify-online (easy win, well-documented API)
2. sequential-thinking (DeepSeek/Exa have OpenAPI)
3. zen (partial - just the API calls)
4. youtube-transcript (Gram Function)
5. postgres (Gram Function with security)
6. perplexity (keep local or use official API)
```

---

## Token Savings Estimate

**Current local servers expose:** ~25-30 tools
**After Gram consolidation:** 3 meta-tools

**Before:** ~60K tokens (tool definitions + schemas)
**After:** ~8K tokens (dynamic toolset)
**Savings:** **~87% reduction**
