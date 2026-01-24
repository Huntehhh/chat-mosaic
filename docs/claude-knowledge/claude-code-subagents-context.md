## Summary: Claude Code Sub-Agents and Context

Based on my research, here's the definitive answer:

### Yes, Explore and Plan Mode Spin Up Sub-Agents

Both **Explore** and **Plan** modes run as **separate sub-agents** with their own isolated context windows. They are internal helper agents that Claude Code invokes automatically.

### How Context Works

```
┌─────────────────────────────────────────────────────────┐
│  MAIN AGENT (~200k context window)                      │
│  - Your conversation history                            │
│  - High-level instructions                              │
│  - Receives ONLY summarized results from sub-agents     │
└──────────────────┬──────────────────────────────────────┘
                   │ Spawns
       ┌───────────┴───────────┐
       ▼                       ▼
┌──────────────────┐   ┌──────────────────┐
│ EXPLORE AGENT    │   │ PLAN AGENT       │
│ (~200k separate) │   │ (~200k separate) │
│ - File reads     │   │ - Codebase scan  │
│ - Greps/searches │   │ - Architecture   │
│ - Analysis work  │   │ - Step planning  │
└────────┬─────────┘   └────────┬─────────┘
         │                      │
         └──────┬───────────────┘
                ▼
        Returns: Compact Summary (Z tokens)
        NOT: Full work history (X+Y tokens)
```

### Does It Save Main Agent Context?

**YES** — Sub-agents **save your main context** by:
- Operating in **completely isolated context windows**
- Doing all the verbose file reads, greps, and intermediate reasoning in their own space
- Returning only a **distilled summary** back to the main conversation

Example: A task requiring 50k tokens of file reads + 30k tokens of analysis = 80k tokens of work. Without sub-agents, all 80k goes into your main context. **With sub-agents**, only the ~2-5k token summary returns.

### The Trade-Off: Total Tokens vs Clean Context

| Metric | Without Sub-Agents | With Sub-Agents |
|--------|-------------------|-----------------|
| Main context used | High (all work) | Low (summaries only) |
| Total tokens billed | Lower | **3-4x higher** |
| Context cleanliness | Polluted | Clean & focused |
| Effective capacity | Limited by single window | Multiple 200k windows |

### Key Constraints

- **No recursive spawning**: Sub-agents cannot spawn other sub-agents
- **Concurrency cap**: Up to 10 sub-agents can run in parallel
- **Context rebuild cost**: Each sub-agent pays 10-20k tokens just to initialize

### Bottom Line

Sub-agents are a **context management strategy**, not a token-saving strategy. You're trading more total tokens for a cleaner, more reliable main conversation that won't hit context limits as quickly.

---

## Compression Ratio: How Much Context Does a Sub-Agent Return?

There's **no official published ratio** — it varies significantly by task. But here's what community data suggests:

### Rough Estimates

| Sub-Agent Work | Summary Returned | Compression Ratio |
|----------------|------------------|-------------------|
| 20k-30k tokens (light task) | ~1-3k tokens | **~10:1** |
| 50k-80k tokens (medium task) | ~2-5k tokens | **~15:1 to 20:1** |
| 100k+ tokens (heavy research) | ~3-8k tokens | **~15:1 to 30:1** |

### The X + Y + Z Model

The framework described in the docs:
```
X = Input context (instructions, files loaded) → 10-20k tokens
Y = Working context (tool calls, reasoning)   → 10-80k tokens
Z = Final answer/summary                      → 1-8k tokens

Sub-agent uses: X + Y + Z (full cost)
Main agent receives: Only Z
```

So if a sub-agent burns **100k tokens total**, the main agent might only receive **2-5k tokens** back — roughly **2-5% of the sub-agent's work**.

### Why It Varies

- **Task complexity**: Simple file search → tiny summary. Architecture analysis → longer summary.
- **Prompt design**: You can instruct sub-agents to be more or less verbose.
- **What's being returned**: Code snippets are larger than "file X contains the auth logic."

### Rule of Thumb

Based on the "3-4x more efficient" claim from multiple sources:

> **If you'd spend 100k tokens doing something in the main agent, using a sub-agent might cost 100k in the sub-agent but only add ~5-10k to your main context.**

Main context savings are typically **90-95%**, but you're still paying for all those sub-agent tokens on your bill.

---

**Sources:**
- [Claude Code Subagents Official Docs](https://code.claude.com/docs/en/sub-agents)
- [Context Management with Subagents - RichSnapp](https://www.richsnapp.com/article/2025/10-05-context-management-with-subagents-in-claude-code)
- [Claude Code Sub Agents - Burn Out Your Tokens](https://dev.to/onlineeric/claude-code-sub-agents-burn-out-your-tokens-4cd8)
- [How I Use Every Claude Code Feature - Shrivu Shankar](https://blog.sshh.io/p/how-i-use-every-claude-code-feature)
- [Claude Code Subagents Enable Modular AI Workflows - InfoQ](https://www.infoq.com/news/2025/08/claude-code-subagents/)
- [Managing Claude Code's Context - CometAPI](https://www.cometapi.com/managing-claude-codes-context/)
- [Anthropic Engineering Blog - Building Agents](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Claude Code Subagents - AI Crossroads](https://aicrossroads.substack.com/p/claude-code-subagents)
- [The Real Cost of Claude Code Subagents - Voidwire](https://labs.voidwire.info/posts/the-real-cost-of-claude-code-subagents/)
