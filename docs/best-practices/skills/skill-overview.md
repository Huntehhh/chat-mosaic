# Skill Overview - Conceptual Foundation

## Table of Contents
- [What Skills Are](#what-skills-are)
- [How Skills Work](#how-skills-work)
- [When to Use Skills](#when-to-use-skills)
- [Skills vs. Other Features](#skills-vs-other-features)
- [Key Principles](#key-principles)
- [Use Cases](#use-cases)

## What Skills Are

Skills are **prompt-based context modifiers**, not executable code. They are organized folders containing:
- `SKILL.md` file (required) with YAML frontmatter + markdown instructions
- Optional bundled resources: `scripts/`, `references/`, `assets/`

**Core architecture:** Skills inject specialized instructions into conversation context and modify execution context (tool permissions, model selection) when triggered.

## How Skills Work

**Progressive disclosure in 3 levels:**
1. **Metadata (always loaded):** Name + description (~100 words) pre-loaded into system prompt
2. **SKILL.md body (loaded when triggered):** Full instructions (<5k words ideal)
3. **Bundled resources (loaded as needed):** Scripts, references, assets accessed on-demand

**Triggering mechanism:** LLM reasoning, not algorithmic. Claude reads skill descriptions and decides which skill matches user intent through natural language understanding.

**Context modification:** Skills don't execute actions—they prepare Claude to solve problems by:
- Injecting instruction prompts into conversation history
- Pre-approving specific tools (via `allowed-tools` frontmatter)
- Optionally switching models (via `model` frontmatter)

## When to Use Skills

**Use skills for:**
- Specialized workflows repeated across sessions
- Domain-specific expertise and procedural knowledge
- Tool integrations requiring consistent patterns
- Company/project-specific conventions and schemas

**Don't use skills for:**
- One-time tasks (use direct prompts)
- Simple context (use Projects for persistent conversation context)
- Real-time data connections (use MCP servers, though skills can complement MCP for complex external workflows)
- Task scheduling (use Tasks)
- General knowledge about you (use Memories)
- External integrations (use Hooks/Plugins)

## Skills vs. Other Features

| Feature | Purpose | Persistence | Scope |
|---------|---------|-------------|-------|
| **Skills** | Workflow automation, procedural knowledge | Triggered per-task | Task-specific |
| **Projects** | Persistent context | Always active | Project-wide |
| **Tasks** | Scheduled actions | Scheduled execution | Single action |
| **Memories** | User knowledge | Always active | User preferences |
| **MCP Servers** | External data/tools | Always available | External systems |
| **Agents** | Autonomous workers | Independent execution | Delegated workflows |
| **Hooks/Plugins** | External integrations | Event-triggered | System extensions |

## Key Principles

**Composability (Skill Stacking):** Skills stack automatically because they are context modifiers. Claude can combine multiple skills seamlessly when tasks require it. A user request can trigger the `sql-expert` skill to fetch data, then immediately trigger the `data-viz` skill to render visualizations, with the `brand-voice` skill ensuring company-standard formatting. Multiple skills remain active if they don't conflict in output requirements.

**Context Isolation (Sub-Agent Delegation):** Skills can instruct Claude to spawn sub-agents (via the Task tool) for token-heavy operations. The sub-agent runs in an isolated context, performing complex analysis loops or large data processing, and returns only the final result or a path to a generated file. This keeps the main conversation lightweight and focused on orchestration, achieving up to 96% reduction in main context pollution for multi-turn external model calls.

**Context efficiency:** Unbounded content possible via progressive disclosure. Scripts execute without loading into context. References load only when needed.

**Discovery:** Skill selection depends entirely on `description` field quality. Be specific about what the skill does AND when to use it.

**Security:** Skills provide new capabilities through instructions and code. Install only from trusted sources. Audit bundled scripts and external connections before use.

## Use Cases

**Workflow automation:**
- Document processing pipelines (PDF extraction, form filling, validation)
- Report generation with company-specific formatting
- Code review checklists following team standards

**Domain expertise:**
- SQL query patterns for company database schemas
- Brand voice and style guide enforcement
- Technical writing following documentation standards

**Tool integration:**
- API interaction patterns with authentication
- Data transformation and validation scripts
- File format conversions with specific requirements

**Procedural knowledge:**
- Multi-step approval workflows
- Compliance checking procedures
- Quality assurance checklists

**Multi-session orchestration:**
- Complex migrations spanning multiple context windows
- Phased implementations with verification gates
- Context handoff patterns (changelogs, plan files, resume prompts)
