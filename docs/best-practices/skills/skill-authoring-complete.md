# Skill Authoring - Complete Reference

## Table of Contents
- [SKILL.md File Structure](#skillmd-file-structure)
- [YAML Frontmatter Fields](#yaml-frontmatter-fields)
- [Markdown Body Content](#markdown-body-content)
- [Progressive Disclosure & File Organization](#progressive-disclosure--file-organization)
- [Content Patterns](#content-patterns)
- [Code & Scripts in Skills](#code--scripts-in-skills)
- [Advanced Authoring Patterns](#advanced-authoring-patterns)
- [Sub-Agent Delegation Patterns](#sub-agent-delegation-patterns)
- [Best Practices](#best-practices)
- [Testing & Iteration](#testing--iteration)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
- [Checklist for Effective Skills](#checklist-for-effective-skills)

## SKILL.md File Structure

Every skill requires a `SKILL.md` file with two parts:

```markdown
---
name: skill-name
description: What it does and when to use it
---

# Markdown Instructions

[Skill body content]
```

**Frontmatter:** YAML metadata (required fields: `name`, `description`)
**Body:** Markdown instructions Claude receives when skill triggers

---

## YAML Frontmatter Fields

### Required Fields

**name** (required)
- Max 64 characters
- Lowercase letters, numbers, hyphens only
- No XML tags, no reserved words ("anthropic", "claude")
- Recommendation: Use gerund form (`processing-pdfs`, `analyzing-data`)

**description** (required)
- Max 1024 characters, non-empty, no XML tags
- **Critical for discovery:** Claude uses this to decide when to trigger skill
- Must include BOTH what skill does AND when to use it
- Write in third person: "Processes Excel files" NOT "I can help you"
- Be specific with triggers: mention file types, user actions, contexts

**Examples:**
```yaml
# Good - specific with clear triggers
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.

# Good - includes key terms and use cases
description: Analyze Excel spreadsheets, create pivot tables, generate charts. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files.

# Bad - too vague
description: Helps with documents

# Bad - first person
description: I can help you process files
```

**Note on `when_to_use` field:** An undocumented `when_to_use` field exists that appends to the description during skill selection. For compatibility and safety, embed this information directly in the `description` field rather than using a separate `when_to_use` field.

### Optional Fields

**allowed-tools** (optional)
- Comma-separated string of pre-approved tools (no user prompts)
- Use wildcards for scoping: `Bash(git:*)` allows all git commands
- Only include what skill actually needs—avoid listing every tool
- Examples:
  ```yaml
  # Specific git commands only
  allowed-tools: "Bash(git status:*),Bash(git diff:*),Read,Grep"

  # File operations only
  allowed-tools: "Read,Write,Edit,Glob,Grep"

  # Avoid unnecessary surface area
  allowed-tools: "Bash,Read,Write"  # Too broad if you only need file ops
  ```

**model** (optional)
- Override session model for this skill
- `inherit` (default) uses current session model
- Specify model for complex tasks: `claude-opus-4-20250514`

**version** (optional)
- Metadata for skill versioning (e.g., `1.0.0`)
- Used for tracking, not functional

**disable-model-invocation** (optional, boolean)
- `true` = skill excluded from Claude's automatic discovery
- Only invokable manually via `/skill-name`
- Use for dangerous operations, configuration commands, or interactive workflows

**mode** (optional, boolean)
- `true` = categorizes skill as "mode command"
- Appears in special "Mode Commands" section at top of skills list
- Use for skills that modify Claude's behavior context (debug-mode, review-mode)

---

## Markdown Body Content

### Core Principles

**Conciseness is critical:** Context window is shared with conversation history, other skills' metadata, and user requests. Only add context Claude doesn't already have.

**Default assumption:** Claude is very smart. Challenge each paragraph: "Does this justify its token cost?"

**Good (concise ~50 tokens):**
````markdown
## Extract PDF text

Use pdfplumber:
```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```
````

**Bad (verbose ~150 tokens):**
```markdown
PDF files are a common format containing text and images. To extract text,
you'll need a library. We recommend pdfplumber because it's easy to use.
First install it with pip, then use the code below...
```

### Recommended Structure

```markdown
---
# Frontmatter
---

# [Brief Purpose - 1-2 sentences]

## Overview
[What this skill does, when to use it]

## Prerequisites
[Required tools, files, or context]

## Instructions

### Step 1: [Action]
[Imperative instructions, examples if needed]

### Step 2: [Action]
[Imperative instructions]

## Output Format
[How to structure results]

## Resources
[Reference bundled scripts/, references/, assets/]
```

**Use imperative/infinitive form:** "Analyze code for..." NOT "You should analyze..."

**Keep under 500 lines:** If approaching this limit, split content into separate reference files.

---

## Progressive Disclosure & File Organization

### Why Progressive Disclosure

**Context window is shared:** Every token in SKILL.md competes with conversation history.

**Unbounded content via filesystem:** Bundled resources consume zero tokens until Claude reads them.

**LLM navigation:** Claude uses filesystem tools to read files on-demand.

### The Three Directories

```
my-skill/
├── SKILL.md              # Core instructions
├── scripts/              # Executable code (Python/Bash)
├── references/           # Documentation loaded into context
└── assets/               # Templates and binary files
```

**scripts/:** Executable code Claude runs via Bash tool
- Automation scripts, validators, code generators
- More reliable than generated code, saves tokens
- Claude executes without loading contents into context

**references/:** Text content Claude reads when referenced
- Markdown docs, JSON schemas, configuration templates
- Loaded into context only when needed
- For detailed documentation too verbose for SKILL.md

**assets/:** Files referenced by path, not loaded into context
- HTML/CSS templates, images, configuration boilerplate
- Claude sees path but doesn't read content
- Used for copying/modifying files

### Progressive Disclosure Patterns

**Pattern 1: High-level guide with references**
````markdown
# PDF Processing

## Quick start
Extract text with pdfplumber:
```python
import pdfplumber
```

## Advanced features
- **Form filling:** See [FORMS.md](FORMS.md)
- **API reference:** See [REFERENCE.md](REFERENCE.md)
````

**Pattern 2: Domain-specific organization**
```
bigquery-skill/
├── SKILL.md (overview + navigation)
└── reference/
    ├── finance.md (revenue, billing)
    ├── sales.md (pipeline, opportunities)
    ├── product.md (usage, features)
```

When user asks about sales, Claude only reads sales.md.

**Pattern 3: Conditional details**
```markdown
# DOCX Processing

## Creating documents
Use docx-js. See [DOCX-JS.md](DOCX-JS.md).

## Editing documents
For simple edits, modify XML directly.

**For tracked changes:** See [REDLINING.md](REDLINING.md)
**For OOXML details:** See [OOXML.md](OOXML.md)
```

### File Organization Rules

**Keep references one level deep:** All reference files link directly from SKILL.md. Deeply nested references cause Claude to partially read files, losing information.

**Good (one level deep):**
```markdown
# SKILL.md
**Basic usage:** [instructions in SKILL.md]
**Advanced:** See [advanced.md](advanced.md)
**Reference:** See [reference.md](reference.md)
```

**Bad (too deep):**
```markdown
# SKILL.md → advanced.md → details.md
```

**Table of contents for long files (>100 lines):**
```markdown
# API Reference

## Contents
- Authentication and setup
- Core methods
- Advanced features
- Error handling
```

**Use forward slashes (not backslashes):**
- ✓ Good: `scripts/helper.py`, `reference/guide.md`
- ✗ Bad: `scripts\helper.py`, `reference\guide.md`

**Name files descriptively:**
- Good: `form_validation_rules.md`, `finance_schemas.md`
- Bad: `doc2.md`, `file1.md`

---

## Content Patterns

### Template Pattern

For strict requirements (API responses, data formats):
````markdown
## Report structure

ALWAYS use this exact template:

```markdown
# [Analysis Title]

## Executive summary
[One-paragraph overview]

## Key findings
- Finding 1 with data
- Finding 2 with data

## Recommendations
1. Actionable recommendation
2. Actionable recommendation
```
````

For flexible guidance (when adaptation useful):
````markdown
## Report structure

Default format (adjust as needed):

```markdown
# [Analysis Title]

## Executive summary
[Overview]

## Key findings
[Adapt based on discovery]
```

Adjust sections for specific analysis type.
````

### Examples Pattern

Provide input/output pairs for quality-dependent tasks:
````markdown
## Commit message format

**Example 1:**
Input: Added user authentication with JWT tokens
Output:
```
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
```

**Example 2:**
Input: Fixed date bug in reports
Output:
```
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently
```

Follow style: type(scope): brief description, then detailed explanation.
````

### Workflow Patterns

**Sequential workflow:**
```markdown
## PDF form filling workflow

Copy checklist and track progress:

\```
- [ ] Step 1: Analyze form (run analyze_form.py)
- [ ] Step 2: Create field mapping (edit fields.json)
- [ ] Step 3: Validate mapping (run validate_fields.py)
- [ ] Step 4: Fill form (run fill_form.py)
- [ ] Step 5: Verify output (run verify_output.py)
\```

**Step 1: Analyze form**
Run: `python scripts/analyze_form.py input.pdf`

**Step 2: Create mapping**
Edit `fields.json` to add values.

**Step 3: Validate**
Run: `python scripts/validate_fields.py fields.json`
Fix errors before continuing.

**Step 4: Fill form**
Run: `python scripts/fill_form.py input.pdf fields.json output.pdf`

**Step 5: Verify**
Run: `python scripts/verify_output.py output.pdf`
If fails, return to Step 2.
```

**Conditional workflow:**
```markdown
## Document modification

1. Determine type:
   **Creating new?** → Creation workflow
   **Editing existing?** → Editing workflow

2. Creation workflow:
   - Use docx-js library
   - Build from scratch
   - Export to .docx

3. Editing workflow:
   - Unpack existing document
   - Modify XML directly
   - Validate after each change
   - Repack when complete
```

**Feedback loop pattern:**
```markdown
## Document editing

1. Make edits to `word/document.xml`
2. **Validate immediately:** `python scripts/validate.py unpacked_dir/`
3. If validation fails:
   - Review error message
   - Fix issues in XML
   - Run validation again
4. **Only proceed when validation passes**
5. Rebuild: `python scripts/pack.py unpacked_dir/ output.docx`
```

**Phased implementation with verification gates:**

For complex multi-file changes, structure work in phases with verification between each:

```markdown
## Implementation Plan

### Phase 1: Foundation
- [ ] Extend data models
- [ ] Add state management
- **Gate:** `npm run compile` must pass

### Phase 2: Core Components
- [ ] Create container components
- [ ] Wire to state stores
- **Gate:** `npm run compile` must pass

### Phase 3: Integration
- [ ] Connect all components
- [ ] Add event handlers
- **Gate:** `npm run compile` + manual smoke test

### Phase 4: Cutover
- [ ] Archive legacy code to `_legacy/` folder
- [ ] Update entry points
- **Gate:** Full build + runtime test
```

**Benefits:**
- Errors caught early, before cascading
- Clear progress visibility
- Safe rollback points at each gate
- User can pause/resume between phases

**User decision documentation:**

Capture key decisions at project start to prevent rework:

```markdown
## User Decisions (Captured Early)

| Decision | Options Presented | User Choice |
|----------|-------------------|-------------|
| Migration approach | Feature flag vs. hard switch | Hard switch |
| Legacy handling | Delete vs. archive | Archive to `_legacy/` |
| Priority | Full feature parity vs. core first | Core first |

These decisions guide all subsequent implementation.
```

---

## Code & Scripts in Skills

### When to Use Executable Code

**Use scripts for:**
- Complex multi-step operations
- Deterministic logic better expressed in code
- Data transformations and API interactions
- Tasks repeatedly rewritten the same way

**Benefits:**
- More reliable than generated code
- Save tokens (no code in context)
- Save time (no generation required)
- Ensure consistency across uses

### Script Patterns

**Make execution intent clear in SKILL.md:**

Execute script (most common):
```markdown
Run `analyze_form.py` to extract fields:
\```bash
python scripts/analyze_form.py input.pdf > fields.json
\```
```

Read as reference (for complex logic):
```markdown
See `analyze_form.py` for the field extraction algorithm.
```

**Script best practices:**

**Solve, don't punt to Claude:**
```python
# Good - handle errors explicitly
def process_file(path):
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        print(f"File {path} not found, creating default")
        with open(path, 'w') as f:
            f.write('')
        return ''
    except PermissionError:
        print(f"Cannot access {path}, using default")
        return ''

# Bad - punt to Claude
def process_file(path):
    return open(path).read()  # Just fail and let Claude figure it out
```

**Self-documenting constants (avoid "voodoo constants"):**
```python
# Good - justified values
# HTTP requests typically complete within 30 seconds
REQUEST_TIMEOUT = 30

# Three retries balances reliability vs speed
MAX_RETRIES = 3

# Bad - magic numbers
TIMEOUT = 47  # Why 47?
RETRIES = 5   # Why 5?
```

### Verifiable Intermediates

For complex operations, create plan files that get validated before execution:

```markdown
## Workflow: analyze → create plan → validate plan → execute → verify

**Step 1: Analyze**
Run: `python scripts/analyze.py form.pdf`

**Step 2: Create plan**
Edit `changes.json` with planned updates.

**Step 3: Validate plan**
Run: `python scripts/validate_plan.py changes.json`
Fix errors before executing.

**Step 4: Execute**
Run: `python scripts/apply_changes.py changes.json`

**Step 5: Verify**
Run: `python scripts/verify.py output.pdf`
```

**Why this works:**
- Catches errors before applying changes
- Machine-verifiable validation
- Reversible planning (iterate without touching originals)
- Specific error messages help Claude fix issues

### Package Dependencies

**Skill execution environments:**
- **claude.ai:** Can install from npm, PyPI, GitHub
- **Anthropic API:** No network access, no runtime installation

List required packages in SKILL.md and verify availability in [code execution tool docs](https://platform.claude.com/docs).

**Example:**
```markdown
## Prerequisites

Install required package:
\```bash
pip install pypdf
\```

Then use:
\```python
from pypdf import PdfReader
reader = PdfReader("file.pdf")
\```
```

### MCP Tool Integration

**MCP (Model Context Protocol) servers** provide external tools that skills can leverage. When referencing MCP tools in your skill instructions, always use the fully qualified naming convention:

**Naming Convention:**
- **Format:** `ServerName:tool_name`
- **Correct:** `Use BigQuery:bigquery_schema to retrieve table structure`
- **Incorrect:** `Use bigquery_schema` (missing server prefix)

**Platform Differences:**
- **claude.ai:** Can install packages from npm, PyPI, GitHub at runtime
- **Anthropic API:** No network access; no runtime package installation

**Example:**
```markdown
## Database Analysis

Query the database schema:
\```markdown
Use GitHub:search_repositories to find relevant examples
Use BigQuery:bigquery_schema to retrieve table structure
\```

Then analyze the results and generate recommendations.
```

**Note:** MCP tools are executed by the host environment, not within the skill's execution sandbox.

### Visual Analysis

When inputs can be rendered as images, leverage Claude's vision:
```markdown
## Form layout analysis

1. Convert PDF to images:
   \```bash
   python scripts/pdf_to_images.py form.pdf
   \```

2. Analyze each page image to identify form fields
3. Claude sees field locations and types visually
```

---

## Advanced Authoring Patterns

### Output Prefixes for Structured Responses

When you need Claude to produce structured output (JSON, specific formats), end your skill instructions with the start of the desired output format. This "primes" Claude to continue in that structure.

**Pattern:**
````markdown
## Generate Configuration

Create config.json with these settings:

Output the JSON configuration:
```json
{
````

**Example:**
````markdown
## API Response Schema

Generate the OpenAPI schema for this endpoint.

Output format:
```yaml
openapi: 3.0.0
info:
````

**Benefit:** Significantly improves format compliance by constraining the model's next token predictions.

### Skill Stacking and Composability

Design skills to work together seamlessly. Multiple skills can be active simultaneously if they don't conflict in output requirements.

**Principles:**
- **Modular outputs:** Avoid conversational filler; produce clean, reusable data
- **Domain boundaries:** Each skill owns a specific domain (e.g., SQL queries, data visualization, brand voice)
- **Composable workflows:** Skills can build on each other's outputs

**Example:**
```markdown
# User request: "Analyze our sales data and create a report"
# Workflow:
1. sql-expert skill: Generates and executes SQL query → returns data
2. data-viz skill: Creates charts from returned data → generates visualizations
3. brand-voice skill: Formats report in company style → polished output
```

**Authoring tip:** If your skill produces output that humans read, make it clean and structured so other skills can consume it as input.

### Self-Correction Pattern

For complex multi-step workflows, instruct Claude to validate its plan before execution.

**Pattern:**
```markdown
## Migration Workflow

1. **Draft migration plan:** Analyze current state and list required changes
2. **Validate plan:** Review for:
   - Missing dependencies
   - Irreversible operations
   - Potential data loss
3. **Execute only after validation passes**
4. **Verify results:** Run validation scripts
```

**Example:**
````markdown
## Database Schema Changes

### Step 1: Plan
Create migration plan in `migration_plan.md`:
- Tables to modify
- Data to migrate
- Rollback strategy

### Step 2: Self-Review
Before executing, verify:
- [ ] All foreign key constraints handled
- [ ] Data migration tested on sample
- [ ] Rollback procedure documented

### Step 3: Execute
\```bash
python scripts/migrate.py --plan migration_plan.md
\```
````

**Benefit:** Catches errors in reasoning before they cause irreversible changes.

---

## Sub-Agent Delegation Patterns

### When to Delegate to Sub-Agents

Sub-agents execute in **isolated context windows**, consuming zero tokens in the main conversation. Use sub-agents for tasks meeting these criteria:

| Criteria | Delegate to Sub-Agent When... |
|----------|-------------------------------|
| **Token Volume** | >3,000 input tokens OR operation requires >2 turns of interaction |
| **Parallelization** | Multiple independent sub-tasks can run concurrently (e.g., multi-domain analysis) |
| **Latency Tolerance** | Operation takes >30 seconds (users tolerate delay for background work) |
| **Isolation Need** | External API calls (Zen MCP, web research) that shouldn't pollute main context |
| **Noise Generation** | Produces verbose logs, compilation output, or intermediate artifacts |

**The Context Efficiency Rule:** If an operation involves reading >10 files, executing >3 external API calls, or generating >5K tokens of intermediate output, delegate it to a sub-agent.

### Pattern 1: Zen MCP Delegation (External Model Calls)

Use when consulting external models via Zen MCP to avoid context pollution from multi-turn conversations.

**Skill Instructions:**
````markdown
## External Model Analysis

When user requests analysis requiring external model expertise:

1. **Do NOT call Zen MCP directly** in main conversation
2. Delegate to sub-agent using Task tool
3. Sub-agent handles full conversation loop with external model
4. Sub-agent writes results to file with continuation ID
5. Main agent reads structured output only

**Delegation Template:**
```markdown
Use the Task tool to spawn a research sub-agent with this prompt:

"You are analyzing {topic} using Zen MCP.

Steps:
1. Craft optimal prompt following prompt-best-practices.md
2. Use mcp__zen__chat with model: {model_name}
3. Conduct 2-5 exchanges to gather comprehensive analysis
4. Write full analysis to analysis-results.md including:
   - Continuation ID from Zen response
   - Key findings summary
   - Detailed analysis
   - Recommendations
5. Return to main agent: 'Analysis complete. See analysis-results.md. Continuation ID: {id}'

Do NOT return full analysis text - file path only."
```

After sub-agent completes, read analysis-results.md and present findings to user.
````

**Token Savings Example:**
- Without sub-agent: 5,700 tokens in main context (query + 3 rounds of Zen responses)
- With sub-agent: 200 tokens in main context (delegation + file path return)
- **Savings: 96.5%**

### Pattern 2: File-Based Handoff (Structured Results)

Sub-agents should return **pointers to files**, not file contents, to preserve context isolation benefits.

**Anti-Pattern (Context Pollution):**
````markdown
# Bad: Sub-agent returns verbose content
Sub-agent: "I analyzed 50 files. File 1 had these issues: [2000 words of details]... File 50 was clean."
# Result: Main context immediately polluted with 2000+ tokens
````

**Best Practice (File Handoff):**
````markdown
# Good: Sub-agent writes to file, returns pointer
Sub-agent execution:
1. Performs heavy analysis (grep logs, diff files, run tests)
2. Writes findings to {baseDir}/temp/analysis-report.md
3. Returns: "Analysis complete. 12 critical issues found. See analysis-report.md"

Main skill:
1. Receives concise summary (50 tokens)
2. Reads analysis-report.md selectively (only sections needed)
3. Or simply references file for user to review
````

**File Format Recommendation:**
```json
{
  "status": "complete",
  "continuation_id": "abc123",
  "summary": "12 issues found across 3 categories",
  "details_file": "analysis-report.md",
  "metrics": {
    "files_analyzed": 50,
    "critical_issues": 3,
    "warnings": 9
  }
}
```

### Pattern 3: Parallel Analysis (Concurrent Sub-Agents)

Spawn multiple sub-agents concurrently for independent tasks, then aggregate results.

**Use Case:** Analyzing different domains in parallel (finance + sales + product data).

````markdown
## Multi-Domain Analysis

1. **Spawn concurrent sub-agents** (up to 10 with intelligent queuing):
   ```markdown
   Use Task tool three times in parallel:

   Task 1: "Analyze finance files in /data/finance/, write to finance-analysis.md"
   Task 2: "Analyze sales files in /data/sales/, write to sales-analysis.md"
   Task 3: "Analyze product files in /data/product/, write to product-analysis.md"
   ```

2. **Wait for completion** (all sub-agents finish independently)

3. **Aggregate results:**
   ```markdown
   Read all three analysis files
   Synthesize cross-domain insights
   Generate master report combining findings
   ```
````

**Benefits:**
- **Speed:** Parallel execution (3 domains in ~2 minutes vs. serial ~6 minutes)
- **Token Efficiency:** Each sub-agent's intermediate work stays isolated
- **Scalability:** Add more domains without impacting main context

### Pattern 4: Multi-Session Continuity

Complex tasks often exceed single-session context limits. Design skills to persist state across sessions.

**The Context Manifest Pattern:**
````markdown
## Session Handoff

When session approaches context limit or user requests save:

1. **Create changelog** in `docs/changelog/YYYY-MM-DD-{task}.md`:
   ```markdown
   # Changelog - {Date}

   ## Summary
   [What was accomplished]

   ## Files Modified
   | File | Status | Notes |
   |------|--------|-------|
   | path/to/file.ts | Modified | Brief description |

   ## Open Loops
   [What remains to be done]

   ## Context Manifest
   Priority files for next session:
   - `path/to/plan.md` - **READ FIRST**
   - `path/to/key-file.ts` - Source of truth

   ## Resume Prompt
   [Copy-paste prompt for next session to quickly restore context]
   ```

2. **Maintain plan file** with current state:
   - Phase status (complete/in-progress/pending)
   - User decisions made
   - Verification checklist
````

**Benefits:**
- Next session reads 2 files instead of reconstructing from scratch
- User decisions persist (no re-asking)
- Clear handoff reduces context reconstruction from ~5,000 tokens to ~500 tokens

### Pattern 5: Error Recovery & Fallback

Sub-agents can fail. Design for graceful degradation.

**Robust Delegation Pattern:**
````markdown
## Analysis with Fallback

1. **Attempt delegation:**
   ```markdown
   Spawn sub-agent: "Analyze codebase and write to report.md.
   Include status field: 'complete' or 'error' with error details."
   ```

2. **Check result status:**
   ```markdown
   Read report.md

   If status == "error":
     - Check error.log for details
     - Fall back to partial analysis in main context
     - Or retry with simplified scope

   If status == "complete":
     - Proceed with results
   ```
````

**Fallback File Structure:**
```json
{
  "status": "error",
  "error_type": "timeout",
  "error_message": "Analysis exceeded 60s limit",
  "partial_results": {
    "files_completed": 30,
    "files_remaining": 20
  },
  "continuation_id": null,
  "fallback_action": "retry_with_reduced_scope"
}
```

### Sub-Agent Best Practices

**DO:**
- ✓ Write comprehensive output to files (markdown, JSON, logs)
- ✓ Return only summary + file path to main agent
- ✓ Include continuation IDs for resumable operations
- ✓ Use status fields for error detection
- ✓ Leverage parallelization for independent tasks

**DON'T:**
- ✗ Return verbose content directly to main agent
- ✗ Assume sub-agent has access to main conversation history
- ✗ Nest sub-agents (not supported - will fail)
- ✗ Skip error handling (always check status)
- ✗ Over-delegate simple tasks (<2K tokens)

---

## Best Practices

### Degrees of Freedom

Match specificity to task fragility:

| Freedom | Use When | Example |
|---------|----------|---------|
| **High** | Multiple approaches valid, context-dependent decisions | Text-based code review, content analysis |
| **Medium** | Preferred pattern exists, some variation acceptable | Parameterized report generation, templated output |
| **Low** | Fragile operations, consistency critical | Database migrations, exact API calls, binary file manipulation |

### Consistent Terminology

Choose one term, use throughout:
- ✓ Always "API endpoint" (not mixing "URL", "API route", "path")
- ✓ Always "field" (not mixing "box", "element", "control")
- ✓ Always "extract" (not mixing "pull", "get", "retrieve")

### Avoid Time-Sensitive Information

**Bad (will become wrong):**
```markdown
If before August 2025, use old API.
After August 2025, use new API.
```

**Good (use "old patterns" section):**
```markdown
## Current method
Use v2 API: `api.example.com/v2/messages`

## Old patterns
<details>
<summary>Legacy v1 API (deprecated 2025-08)</summary>
The v1 API used: `api.example.com/v1/messages`
No longer supported.
</details>
```

### Test with All Models

Skills work differently with Haiku, Sonnet, Opus:
- **Haiku:** May need more detail
- **Sonnet:** Balance clarity and efficiency
- **Opus:** Avoid over-explaining

Test with all models you plan to use.

---

## Testing & Iteration

### Evaluation-Driven Development

**Create evaluations BEFORE extensive documentation:**

1. **Identify gaps:** Run Claude on tasks without skill, document failures
2. **Create evaluations:** Build 3 scenarios testing these gaps
3. **Establish baseline:** Measure performance without skill
4. **Write minimal instructions:** Just enough to pass evaluations
5. **Iterate:** Execute, compare, refine

**Example evaluation structure:**
```json
{
  "name": "pdf-text-extraction",
  "description": "Tests basic PDF text extraction workflow",
  "skills": ["pdf-processing"],
  "query": "Extract all text from this PDF and save to output.txt",
  "files": {
    "test-files/document.pdf": "base64_encoded_pdf_content_here"
  },
  "expected_behavior": [
    "Reads PDF using appropriate tool",
    "Extracts text from all pages",
    "Saves to output.txt in readable format"
  ],
  "success_criteria": {
    "file_created": "output.txt",
    "contains_text": "Expected content from PDF"
  }
}
```

**Standard Evaluation JSON Schema:**
```json
{
  "name": "unique-test-identifier",
  "description": "What this test validates",
  "skills": ["skill-name"],
  "query": "User request that triggers skill",
  "files": {
    "relative/path/file.ext": "base64_encoded_or_text_content"
  },
  "expected_behavior": [
    "Step 1 behavior",
    "Step 2 behavior"
  ],
  "success_criteria": {
    "metric_name": "expected_value"
  }
}
```

### Iterating with Claude

**Most effective development:** Work with one Claude instance to create skill, test with another instance.

**Creating new skill:**
1. Complete task with Claude using normal prompting
2. Notice what information you repeatedly provide
3. Ask Claude: "Create skill capturing this pattern"
4. Review for conciseness (remove unnecessary explanations)
5. Improve information architecture (split into reference files)
6. Test with fresh Claude instance
7. Iterate based on observation

**Improving existing skill:**
1. Use skill in real workflows
2. Observe where Claude struggles or succeeds
3. Return to authoring Claude with observations
4. Apply refinements
5. Test again with fresh instance

### Observing Claude's Navigation

Watch for:
- **Unexpected exploration paths:** Structure may not be intuitive
- **Missed connections:** References need to be more explicit
- **Overreliance on sections:** Content might belong in main SKILL.md
- **Ignored content:** File might be unnecessary or poorly signaled

Iterate based on observations, not assumptions.

---

## Anti-Patterns to Avoid

**❌ Windows-style paths:**
```markdown
Bad: scripts\helper.py
Good: scripts/helper.py
```

**❌ Too many equivalent options:**
```markdown
Bad: "Use pypdf, or pdfplumber, or PyMuPDF, or pdf2image, or..."
Good: "Use pdfplumber for text extraction. For scanned PDFs requiring OCR, use pytesseract instead."
```

**❌ Assuming packages installed:**
```markdown
Bad: "Use the pdf library to process the file."
Good: "Install: `pip install pypdf`. Then: `from pypdf import PdfReader`"
```

**❌ Vague descriptions:**
```yaml
Bad: description: Helps with documents
Good: description: Extract text from PDF files, fill forms, merge documents. Use when working with PDFs or document extraction tasks.
```

**❌ Deeply nested references:**
```markdown
Bad: SKILL.md → advanced.md → details.md → examples.md
Good: SKILL.md → advanced.md, reference.md, examples.md (all one level)
```

**❌ First-person descriptions:**
```yaml
Bad: description: I can help you process Excel files
Good: description: Processes Excel files and generates reports
```

---

## Checklist for Effective Skills

**Core Quality:**
- [ ] Description specific with key terms
- [ ] Description includes what it does AND when to use it
- [ ] SKILL.md body under 500 lines
- [ ] No time-sensitive information (or in "old patterns")
- [ ] Consistent terminology throughout
- [ ] Examples concrete, not abstract
- [ ] File references one level deep
- [ ] Workflows have clear steps

**Advanced Patterns:**
- [ ] Workflows decomposed with self-validation steps
- [ ] Output prefixes used for structured responses
- [ ] Skill designed for composability (clean, modular outputs)
- [ ] MCP tools use fully qualified names (ServerName:tool_name)
- [ ] Sub-agent delegation used for token-heavy operations (>3K tokens or >2 API turns)
- [ ] Sub-agents return file pointers, not verbose content
- [ ] Error recovery patterns included for sub-agent failures
- [ ] Phased implementation with verification gates for complex changes
- [ ] User decisions captured early and documented in plan
- [ ] Multi-session continuity via changelog + context manifest pattern

**Code & Scripts:**
- [ ] Scripts solve problems (don't punt to Claude)
- [ ] Explicit error handling
- [ ] No "voodoo constants" (all values justified)
- [ ] Required packages listed and verified
- [ ] No Windows-style paths
- [ ] Validation/verification for critical operations

**Testing:**
- [ ] Tested with target models (Haiku/Sonnet/Opus)
- [ ] Evaluations created before extensive documentation
- [ ] Observed Claude's actual navigation patterns
- [ ] Iterated based on real usage, not assumptions
