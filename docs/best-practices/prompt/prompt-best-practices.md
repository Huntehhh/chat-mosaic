Purpose: Establish key principles for crafting effective prompts across different tools and LLMs to ensure clarity, context, and high-quality outputs.

---

# 1. Zen MCP / External LLMs

## Principle 1.1: Never Reference Zen or Its Internal Features
### Rule
When sending prompts to external LLMs via Zen MCP (Grok, Gemini, DeepSeek, etc.), do NOT mention "Zen", "Zen MCP", or Zen-specific features. The LLM receives an API call and has no context about the orchestration layer.
### Why
External LLMs don't know what "Zen" is. Mentioning it creates confusion and reduces prompt clarity.
### Example ✅
- You are receiving 150 markdown files (full content provided via files parameter in this API call).
- ✅ "via files parameter in this API call"
- ✅ "Files are provided in this request"
- ✅ "Multi-step workflow"
### Anti-Example ❌
- You are receiving 150 markdown files (full content provided via Zen external file mode).
- ❌ "via Zen external file mode"
- ❌ "Zen will pass files to you"
- ❌ "Zen MCP orchestration"

---

## Principle 1.2: Always Include a Context Section
### Rule
Every prompt sent to an external LLM must start with a Context section. This section should appear before any task instructions or data descriptions.
### Why
Provides high-level orientation about the purpose of the API call, helping the LLM understand its role and the ultimate goal.
### Example ✅
Context

Your role is to analyze documentation files and identify gaps in coverage. You were selected for your cost-effectiveness in processing large document sets. Your output will guide which additional files should be loaded to complete the user's working context.

User query: "Im beginning a project about pgsql and cold email architecture... context..."

You are receiving 120 markdown files (full content provided via files parameter in this API call).

Your Mission

Analyze all files and recommend targeted expansions to fill knowledge gaps.
### Anti-Example ❌
Missing Context section entirely - jumps straight to task:

Analyze these 120 files and recommend expansions. User wants to know about authentication patterns.

---

## Principle 1.3: Start Context with High-Level Purpose (2-4 Sentences)
### Rule
The first paragraph of the Context section must provide a 2-4 sentence high-level explanation of:
- Why the LLM is being called
- What the ultimate goal is
- How the LLM's output will be used
- Why this LLM was chosen for the task
### Why
LLMs perform better when they understand the broader purpose, not just the immediate task. This "meta-context" helps them prioritize information and tailor their response appropriately.
### Example ✅
Your role is to help the user resume work on their project by analyzing a large collection of documentation files and providing a comprehensive synthesis. You were selected for this task because of your cost-effectiveness and ability to process extensive information (hundreds of files) while maintaining high-quality analysis. Your output will be used by the user to quickly understand the current state of their work, key decisions made, and what remains to be done. The goal is to restore their full working context without requiring them to manually re-read hundreds of documents.

User query: "authentication system implementation"

You are receiving 150 markdown files (full content provided via files parameter in this API call).

You also have a canvas file (visualizations/discovery-graph.canvas) showing relationship structure between entities.
### Anti-Example ❌
Missing high-level purpose:

User query: "authentication system implementation"

You are receiving 150 markdown files from Basic Memory (full content provided via Zen external file mode).

You also have the canvas file (visualizations/discovery-graph.canvas) showing relationship structure between entities.
### Structure Flow
- Context section starts with 2-4 sentence high-level purpose paragraph
- Followed by specific details: user query, data provided, tools available
- Then mission/task instructions

---

## Principle 1.4: Context Structure Template
### Rule
Follow this standardized structure for the Context section:

[HIGH-LEVEL PURPOSE: 2-4 sentences explaining why LLM is being called, the ultimate goal, how output will be used, and why this LLM was chosen]

User's request: "user query here"

Data provided:
- Description of files, count, format
- Description of additional data: canvas, references, etc.

Available tools/references:
- Tool documentation or reference files provided

Expected output:
- Format: JSON, markdown, etc.
- Usage: how this output will be consumed
### Example ✅
You are analyzing project documentation to identify knowledge gaps and recommend targeted expansions. Your role is critical: you'll determine which additional files should be loaded to give the user complete context on their work. Your recommendations will directly influence what information is retrieved, so precision and justification are essential. You were chosen for your analytical capabilities and cost-effectiveness in processing large document sets.

User's request: "Load context on authentication system implementation"

Data provided:
- 120 markdown files (full content provided via files parameter in this API call)
- Canvas file (visualizes relationships between entities)

Available tools/references:
- Basic Memory tool documentation (search_notes, build_context, list_directory)

Expected output:
- JSON format with prioritized recommendations
- Each recommendation must include confidence score and justification
### Anti-Example ❌
No high-level purpose, mentions Zen:

User query: "Load context on authentication system"

You are receiving 120 files via Zen external mode. Analyze them.

---

## Principle 1.5: Preserve Technical Artifacts Verbatim
### Rule
Never summarize code snippets, commands, file paths, or configurations. Preserve them exactly as they appear, character-for-character.
### Why
A single wrong character in a command or path breaks everything. Technical artifacts must be verbatim for reproducibility.
### Example ✅
- `npm install @anthropic-ai/sdk@0.30.0`
- `C:\Users\name\project\src\auth\jwt-handler.ts`
- `git commit -m "fix: resolve token expiry issue"`
### Anti-Example ❌
- `npm install anthropic sdk` (summarized - missing exact package and version)
- `auth file in src` (summarized - loses exact path)
- `committed the fix` (summarized - loses exact command)

---

## Principle 1.6: Capture Conversational Evolution
### Rule
Document the journey (how we got here), not just the destination (final code). Include pivots, rationale, open questions, user clarifications, and lessons learned.
### Why
Future sessions need to understand WHY decisions were made, what was tried and failed, and what constraints influenced choices. The narrative preserves context that code alone cannot convey.
### Example ✅
- Initially planned Redis caching, switched to in-memory Maps due to 2-day cluster setup vs ship-tomorrow deadline
- User clarified need for real-time updates not batch - requires WebSocket not polling
- Open question: Should we use JWT or session cookies? Pending security team review
- Lesson: Discovered that connection pooling must be configured BEFORE first query or latency spikes to 200ms
### Anti-Example ❌
- Changed caching approach (no context - why changed? what was tried?)
- Updated authentication (no rationale - what decision was made?)
- Fixed performance issue (no lesson - what was learned for future?)
### Technical Artifacts as Evolution
Document technical artifacts (files, commands) both as a reference list AND within the narrative:
- Create a "Technical Reference" section (beginning or end) listing all files, commands, errors encountered
- Reference these artifacts throughout the journey narrative when describing pivots and decisions
- Don't just sprinkle artifacts randomly - organize them for findability while preserving their context in the story

---

## Principle 1.7: Filter Noise (Focus on WHAT and WHY, not HOW)
### Rule
Abstraction level = Feature or higher. Capture decisions and strategic insights, filter implementation minutiae.
### Why
Prevents information overload. Future sessions need to understand system design and rationale, not every keystroke.
### Example ✅
- Added user_preferences table to store personalization settings (strategic - explains PURPOSE)
- Chose X over Y because of constraint Z (decision - explains RATIONALE)
- Implemented retry with exponential backoff to handle API rate limits (pattern - explains WHAT and WHY)
### Anti-Example ❌
- Added varchar(255) column with NOT NULL constraint (implementation detail - lacks PURPOSE)
- Changed variable name from userPrefs to userPreferences (trivial - no strategic value)
- Fixed typo in comment (noise - doesn't help future understanding)
### Filter OUT (Noise)
General trivia:
- Greetings, small talk, clarifications
- Obvious/well-documented information
- Temporary debugging output
- Simple acknowledgments

Code-level trivia:
- Variable/function renames (unless part of major refactor)
- Import additions/removals
- Debug console.log / print statements
- Code formatting/indentation fixes
- Comment updates (unless documenting complex logic)
- Minor dependency version bumps (unless breaking changes)

Database trivia:
- Individual column details (capture table PURPOSE, not schema minutiae)
- SQL syntax details (capture query STRATEGY, not exact WHERE clauses)
- Index creation (unless solving specific performance issue)
### INCLUDE (Signal)
Strategic level:
- Database table additions with PURPOSE: "Added user_preferences to store personalization settings"
- Architectural decisions: "Chose X over Y because of [specific rationale]"
- Security implementations: "Added rate limiting to prevent brute force attacks"
- Performance patterns: "Implemented Redis caching strategy for user lookups"
- Integration connections: "Connected authentication service to audit logging via middleware"

Implementation level (if substantial):
- Complex algorithms with reusable patterns
- Error handling strategies that apply project-wide
- API integration patterns
- Testing approaches for difficult-to-test code
### Abstraction Rule
Focus on WHAT and WHY, not HOW. Feature level or higher. If it helps future sessions understand the system, include it. If it's one-time implementation detail, filter it.

---

## Principle 1.8: Use Output Prefixes to Guide Response Format
### Rule
Add a prefix phrase at the end of your prompt that signals the expected output format or structure. The LLM will continue from this prefix.
### Why
Output prefixes reduce ambiguity about response format and help the model "start" its response correctly, especially for structured outputs.
### Example ✅
Classify the following entities by size:

- Elephant
- Mouse
- Snail

Output in JSON format:
```
{
### Anti-Example ❌
Classify the following entities by size: Elephant, Mouse, Snail

Return the result in JSON format.

(No prefix provided - model must invent entire JSON structure from scratch, higher chance of format variation)
### When to use
- Structured outputs (JSON, CSV, tables)
- Classification tasks with specific label format
- Continuation/completion tasks

---

# 2. Claude / Haiku Sub-Agents

## Principle 2.1: [To be defined]
### Rule
[TBD - principles for Task tool delegation to Haiku]

---

# 3. General Principles (All LLMs)

## Principle 3.1: Thematic Organization Over Sequential Dumps
### Rule
Group synthesis output by theme (Authentication Patterns, Database Optimization), not by file/timestamp sequence.
### Why
Easier to understand patterns, connections, and knowledge gaps. Reveals system structure rather than obscuring it with chronology.
### Example ✅
Authentication Patterns

Three approaches discovered across the codebase:
- JWT tokens with 1-hour expiry (patterns/jwt-auth.md) - stateless, scales horizontally
- OAuth2 for third-party integrations (patterns/oauth-integration.md) - supports Google, GitHub
- API key validation for service-to-service (solutions/api-key-middleware.md) - high performance

All three share common rate limiting strategy (patterns/rate-limiting.md).
### Anti-Example ❌
File-by-file dump (obscures patterns, hard to extract insights):

patterns/jwt-auth.md said: "Use JWT tokens with 1-hour expiry for authentication"

patterns/oauth-integration.md said: "OAuth2 is used for third-party providers like Google"

solutions/api-key-middleware.md said: "API keys are validated using middleware"

patterns/rate-limiting.md said: "Rate limiting applies to all authentication methods"
### Additional Examples ✅
Database Optimization

Implemented three-tier caching strategy:
- L1: In-memory Maps (sub-millisecond, limited to 1000 entries)
- L2: Redis (5ms avg, distributed, 10GB capacity)
- L3: Postgres with connection pooling (50ms avg, source of truth)

Pattern: Cache invalidation via pub/sub prevents stale reads.
### Additional Anti-Examples ❌
Chronological dump (reveals timeline, not architecture):

First, we created the database schema on 2025-10-15.
Then, we added Redis caching on 2025-10-18.
Later, we implemented Maps caching on 2025-10-22.
Finally, we added pub/sub invalidation on 2025-10-25.

---

## Principle 3.2: Single-Purpose Document Design
### Rule
When generating multi-document outputs, assign each document a single clear purpose rather than duplicating information across documents.
### Why
Reduces redundancy, improves findability, prevents conflicting information, optimizes token usage. Users can quickly locate specific information without parsing irrelevant content.
### Example ✅
Multi-document workflow output:

Continuation document (200-300 tokens):
"Next steps: Fix 3 remaining security issues in authentication middleware. Invoke resume-chat to load context on auth-security-audit entities."

Entity files (400-500 tokens each):
- solutions/xss-vulnerability-fix.md - Detailed code changes, sanitization approach, test cases
- decisions/auth-approach-jwt.md - Why JWT chosen over sessions, trade-offs, performance implications
- knowledge/security-first-development.md - Multi-pass review pattern extracted from this work

Separation achieved: Continuation = what to do next, Entities = how we got here.
### Anti-Example ❌
Single bloated continuation document (2000 tokens):

Contains everything: full code snippets from all 3 fixes, detailed implementation history, complete entity list, mechanics explanations, relationship details, next steps, AND handoff instructions.

Result: User must parse 2000 tokens to find the 50 tokens of actionable next steps (4000% overhead).
### Document Separation Pattern
From old compact-chat skill (handoff-template.md lines 95-106):

Removed from continuation (moved to entities):
- Multiple redundant instructions
- Detailed code changes
- Complete entity lists
- Implementation mechanics explanations
- File reference lists

Kept in continuation (signal):
- Single clear instruction
- High-level accomplishments
- Pending tasks
- Next steps

Token savings: 50-65% reduction (600-800 tokens → 200-300 tokens)
### When This Applies
This principle applies when a SKILL or WORKFLOW generates multiple output documents as part of a single operation:
- Compact-Chat skill: Creates entities + continuation doc
- Report generation: Creates summary + detailed appendices
- Code review: Creates overview + per-file analysis
- Documentation: Creates index + topic pages

---

## Principle 3.3: Instruct Model to Validate Its Own Response
### Rule
For complex or high-stakes tasks, explicitly ask the model to review, critique, or validate its own output before finalizing the response.
### Why
Self-criticism prompts activate iterative reasoning, helping models catch errors, improve accuracy, and provide more thoughtful responses. Particularly effective for tasks requiring correctness over speed.
### Example ✅
Task: Calculate the total cost including 15% tax.

Base price: $250

After calculating, review your work:
- Did you apply the correct tax rate?
- Is the arithmetic correct?
- Rate your confidence (1-10) in this answer.
### Anti-Example ❌
Calculate the total cost including 15% tax. Base price: $250.

(No validation step - model provides answer without self-review, higher error rate on complex calculations)
### Techniques
- "Before providing your final answer, review your reasoning for errors"
- "Rate your confidence in this response on a scale of 1-10"
- "List potential issues with your proposed solution"
- "Check if your answer satisfies all the stated constraints"
### When to use
- Complex reasoning tasks (math, logic, multi-step analysis)
- High-stakes outputs (medical coding, legal analysis, financial calculations)
- When accuracy is more important than latency

---

## Principle 3.4: Decompose Complex Tasks Into Sequential Prompts
### Rule
Break complex tasks into multiple sequential prompts where each prompt handles one clear sub-task. Chain prompts together so output from one becomes input to the next.
### Why
Models handle focused, single-purpose tasks better than trying to juggle multiple objectives simultaneously. Decomposition improves accuracy, reduces errors, and makes debugging easier.
### Example ✅
Task: Analyze customer feedback and generate action items

Prompt 1 (Classification):
"Classify these reviews by sentiment: positive, negative, neutral"

Prompt 2 (Extraction):
"From the negative reviews, extract the top 3 complaint themes"

Prompt 3 (Action Items):
"For each complaint theme, suggest one concrete action item to address it"

Each prompt has single focus, outputs feed forward sequentially.
### Anti-Example ❌
Single mega-prompt:

"Analyze these customer reviews, classify sentiment, identify themes in negative feedback, and generate action items to address complaints."

(Multiple objectives in one prompt - model may skip steps, conflate tasks, or produce lower-quality analysis)
### Decomposition Strategies
- **Sequential chaining**: Output of Prompt N becomes input of Prompt N+1
- **Parallel aggregation**: Run different analyses on different data portions, then aggregate results
- **Hierarchical breakdown**: Break task into sub-tasks, then break sub-tasks further if needed
### When to use
- Multi-step analysis tasks
- When intermediate outputs need validation before proceeding
- When task clarity degrades with too many instructions
- In agent architectures (like our V3 5-phase workflow)

---

# Template: External LLM Prompt Structure

[HIGH-LEVEL PURPOSE: 2-4 sentences]
- Why this LLM is being called
- Ultimate goal of the task
- How the output will be used
- Why this LLM was selected

User's request: "user query here"

Data provided:
- File count, format, source
- Additional data

Available tools/references:
- Tool docs, references

Expected output:
- Format specification
- Usage context

Your Mission:
- Detailed task instructions

Output Format:
- Exact format specification with examples

---

Last Updated: 2025-11-19
Status: Section 1 (Zen MCP / External LLMs) complete with Principles 1.1-1.8, Section 3 (General Principles) complete with Principles 3.1-3.4, Section 2 (Claude/Haiku Sub-Agents) pending
