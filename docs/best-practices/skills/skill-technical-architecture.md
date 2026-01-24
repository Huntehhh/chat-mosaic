# Skill Technical Architecture - Implementation Deep-Dive

## Table of Contents
- [Core Architecture Principle](#core-architecture-principle)
- [The Meta-Tool Design](#the-meta-tool-design)
- [Conversation Context Injection](#conversation-context-injection)
- [Execution Context Modification](#execution-context-modification)
- [Skill Selection Mechanism](#skill-selection-mechanism)
- [Progressive Disclosure Implementation](#progressive-disclosure-implementation)
- [Filesystem-Based Navigation](#filesystem-based-navigation)
- [Message Structure & Flow](#message-structure--flow)
- [Skills vs. System Prompts](#skills-vs-system-prompts)
- [Token Budget & Optimization](#token-budget--optimization)
- [Internal Objects & Data Structures](#internal-objects--data-structures)
- [Design Rationale](#design-rationale)
- [Security Implications](#security-implications)
- [Performance Characteristics](#performance-characteristics)

## Core Architecture Principle

Skills are **prompt-based meta-tools** that modify both conversation context and execution context. They do not execute code directly—they inject instructions and change permissions.

**Key distinction:**

| Traditional Tools | Skills |
|-------------------|--------|
| Execute actions, return results | Inject prompts, modify context |
| Synchronous operations | Context transformation |
| Example: `Read`, `Write`, `Bash` | Example: `pdf`, `skill-creator` |

---

## The Meta-Tool Design

### Skill Tool as Dispatcher

The `Skill` tool (capital S) is a meta-tool that manages all individual skills.

**API request structure:**
```json
{
  "model": "claude-sonnet-4-5-20250929",
  "system": "You are Claude Code...",
  "messages": [...],
  "tools": [
    {
      "name": "Skill",  // ← Meta-tool
      "description": "Execute a skill...\n\n<skills_instructions>...\n\n<available_skills>\n...",
      "input_schema": {
        "type": "object",
        "properties": {
          "command": {
            "type": "string",
            "description": "The skill name"  // ← Individual skill
          }
        }
      }
    },
    {
      "name": "Bash",
      "description": "Execute bash commands..."
    },
    {
      "name": "Read",
      "description": "Read files..."
    }
  ]
}
```

**Skills live in tools array, NOT system prompt.** Individual skill names appear as `command` parameter options in Skill tool's input schema.

### Dynamic Prompt Generation

The Skill tool's `description` field is generated dynamically at runtime:

```javascript
async function generateSkillToolPrompt() {
  let skills = await loadAllSkills();
  let skillList = skills.map(s =>
    `"${s.name}": ${s.description}`
  ).join("\n");

  return `Execute a skill within the main conversation

<skills_instructions>
When users ask you to perform tasks, check if any available skills below can help.
Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke using this tool with skill name only (no arguments)
- When invoked, you'll see <command-message>The "{name}" skill is loading</command-message>
- Skill's prompt will expand with detailed instructions

Important:
- Only use skills listed in <available_skills>
- Do not invoke skill already running
</skills_instructions>

<available_skills>
${skillList}
</available_skills>`;
}
```

**Progressive disclosure:** Only metadata (name + description) loads initially. Full skill prompt loads after Claude selects it.

**Token budget:** Skill list limited to ~15,000 characters to avoid overwhelming context.

---

## Conversation Context Injection

### Two-Message Pattern

When skill executes, system injects **two user messages:**

**Message 1: Metadata (visible to user, isMeta: false)**
```xml
<command-message>The "pdf" skill is loading</command-message>
<command-name>pdf</command-name>
<command-args>report.pdf</command-args>
```

- 50-200 characters
- XML tags enable frontend rendering
- Provides transparency without detail

**Message 2: Skill Prompt (hidden from UI, isMeta: true)**
```markdown
You are a PDF processing specialist.

Your task is to extract text from PDF documents using pdftotext.

## Process
1. Validate PDF exists
2. Run pdftotext command
3. Read output file
4. Present extracted text

## Tools Available
- Bash(pdftotext:*) - For extraction
- Read - For reading output
- Write - For saving results

Base directory: /path/to/skill
User arguments: report.pdf
```

- 500-5,000 words typical
- Full instructional content
- Sent to API but hidden from user transcript

**Why two messages?**
- Single message would force choice: clutter UI with internal instructions OR hide everything
- Separate messages enable transparency (user sees skill activated) without information overload (user doesn't see full prompt)

### isMeta Flag Behavior

```javascript
// Message 1: Visible (isMeta defaults to false)
messages.push({
  content: metadata
  // isMeta: false (default, visible in UI)
});

// Message 2: Hidden (explicit isMeta: true)
messages.push({
  content: fullSkillPrompt,
  isMeta: true  // Hidden from UI, sent to API
});
```

**isMeta: false** → Renders in conversation transcript
**isMeta: true** → Sent to Claude's context but hidden from user

---

## Execution Context Modification

### Context Modifier Function

Skills don't just inject prompts—they modify the execution environment:

```javascript
yield {
  type: "result",
  data: { success: true, commandName: skillName },
  newMessages: [metadataMsg, skillPromptMsg, permissionsMsg],

  // Context modification function
  contextModifier(context) {
    let modified = context;

    // 1. Inject allowed tools
    if (allowedTools.length > 0) {
      modified = {
        ...modified,
        async getAppState() {
          const state = await context.getAppState();
          return {
            ...state,
            toolPermissionContext: {
              ...state.toolPermissionContext,
              alwaysAllowRules: {
                ...state.toolPermissionContext.alwaysAllowRules,
                command: [
                  ...state.toolPermissionContext.alwaysAllowRules.command || [],
                  ...allowedTools  // Pre-approve these tools
                ]
              }
            }
          };
        }
      };
    }

    // 2. Override model
    if (modelOverride) {
      modified = {
        ...modified,
        options: {
          ...modified.options,
          mainLoopModel: modelOverride
        }
      };
    }

    return modified;
  }
};
```

**Two types of context modification:**
1. **Tool permissions:** Pre-approve tools from `allowed-tools` frontmatter (no user prompts)
2. **Model selection:** Override session model with skill's `model` frontmatter

### Execution Flow Comparison

**Normal tool execution:**
```
User request
→ Claude invokes Read tool
→ Read executes, returns file contents
→ Claude continues with results
```

**Skill execution:**
```
User request
→ Claude invokes Skill tool
→ Skill injects: metadata message (visible) + prompt message (hidden)
→ Skill modifies context: tool permissions + model override
→ Claude receives modified context with new instructions
→ Claude uses pre-approved tools following skill's workflow
→ Claude completes task
```

---

## Skill Selection Mechanism

### Pure LLM Reasoning

**No algorithmic matching:**
- No regex patterns
- No keyword matching
- No embeddings or semantic search
- No intent classification ML models

**Skill filtering criteria:**
Skills are excluded from the `<available_skills>` list if:
- `disableModelInvocation: true` (manual invocation only via `/skill-name`)
- `type ≠ "prompt"` (non-prompt command types)
- Missing `description` field (required for discovery)

**Selection process:**
1. All skill metadata formatted into Skill tool's `description`
2. Claude reads `<available_skills>` list during inference
3. Claude's language model matches user intent to skill descriptions
4. Decision happens in transformer's forward pass (pure reasoning)

**Example internal reasoning (hypothetical):**
```
User: "Extract text from report.pdf"
Claude's reasoning:
- User wants to "extract text from report.pdf"
- This is PDF processing
- Looking at skills...
- "pdf": Extract text from PDF documents - when user wants PDF extraction
- This matches! User wants text extraction from PDF
- Decision: Invoke Skill tool with command="pdf"
```

**Implications for authoring:**
- Description quality = discovery accuracy
- Include specific triggers and keywords
- Be explicit about when to use skill

### Why Not Algorithmic?

**Benefits of LLM reasoning:**
- Handles synonyms and paraphrasing naturally
- Understands context and intent
- Adapts to new phrasing without updates
- Leverages model's semantic understanding

**Trade-offs:**
- No guaranteed determinism (model-dependent)
- Requires good description writing
- Can't easily debug failures

---

## Progressive Disclosure Implementation

### Three-Level Loading

**Level 1: Metadata (always loaded)**
```javascript
// At startup: load ALL skill metadata
const skills = await getAllSkills();
const metadata = skills.map(s => ({
  name: s.name,
  description: s.description
}));

// Inject into Skill tool's description
const skillToolDescription = formatSkillList(metadata);
```

**Level 2: SKILL.md body (loaded when triggered)**
```javascript
// When Claude invokes Skill tool with command="pdf"
const skill = getSkill("pdf");
const skillPrompt = await readFile(`${skill.baseDir}/SKILL.md`);
const { frontmatter, body } = parseFrontmatter(skillPrompt);

// Inject as isMeta: true message
messages.push({
  content: body,
  isMeta: true
});
```

**Level 3: Bundled resources (loaded as needed)**
```javascript
// Claude decides to read reference file
// Uses Read tool: Read({baseDir}/references/forms.md)
// File contents loaded into context only when explicitly read
```

### Context Window Impact

**Progressive loading prevents context bloat:**

```
Scenario: 100 installed skills, each with 2000-word SKILL.md

Traditional approach (load all):
100 skills × 2000 words = 200,000 words in context (impossible)

Progressive disclosure:
- Metadata: 100 skills × 100 words = 10,000 words (always loaded)
- SKILL.md: 1 skill × 2000 words = 2,000 words (when triggered)
- References: 0-5,000 words (only specific files read)

Total: 12,000-17,000 words vs. 200,000 words
```

---

## Filesystem-Based Navigation

### Runtime Environment

Skills run in code execution environment with:
- Filesystem access via Bash tools
- Code execution (Python, JavaScript)
- No hardcoded paths (uses `{baseDir}` variable)

**How Claude accesses skills:**
1. **Metadata pre-loaded** at startup (name + description from frontmatter)
2. **Files read on-demand** via Read tool when skill triggers
3. **Scripts executed** via Bash without loading contents
4. **No context penalty** for large reference files until read

### File Path Resolution

**{baseDir} variable:**
```markdown
# In SKILL.md
Run the analyzer: `python {baseDir}/scripts/analyze.py`
See form guide: Read {baseDir}/references/forms.md
```

**At runtime:**
```javascript
// System resolves {baseDir} to actual path
const resolvedPath = skillPrompt.replace(
  /{baseDir}/g,
  skill.installationPath
);

// Claude sees:
// Run the analyzer: `python /Users/name/.claude/skills/pdf/scripts/analyze.py`
```

**Why this matters:**
- Skills are portable across installations
- No hardcoded absolute paths
- Works across different user environments

---

## Message Structure & Flow

### Complete Execution Lifecycle

**Phase 1: Skill Discovery**
```
1. User sends message
2. Claude receives tools array with Skill tool
3. Skill tool description contains all skill metadata
4. Claude reads <available_skills> and selects match
5. Claude returns tool_use for Skill with command="skill-name"
```

**Phase 2: Skill Tool Execution**
```
1. Validate input (skill exists, not disabled, type=prompt)
2. Check permissions (allow/deny/ask based on rules)
3. Load SKILL.md and parse frontmatter + body
4. Generate metadata message (visible)
5. Generate skill prompt message (hidden)
6. Generate permissions message (if allowed-tools specified)
7. Create context modifier function
8. Yield result with newMessages + contextModifier
```

**Phase 3: Context Injection**
```
1. Append metadata message (isMeta: false)
2. Append skill prompt message (isMeta: true)
3. Append permissions message (only if allowed-tools or model specified)
4. Append attachment messages (optional, for diagnostics or additional files)
5. Apply context modifier (tool permissions + model override)
6. Send to Anthropic API with modified context
```

**Note:** The permissions message and attachment messages are conditional. Permissions only appear if `allowed-tools` or `model` frontmatter fields are present. Attachment messages are used for passing diagnostic information or bundled files when needed.

**Phase 4: Claude Execution**
```
1. Claude receives response with injected context
2. Skill prompt transforms Claude's behavior
3. Claude uses pre-approved tools (no user prompts)
4. Claude follows skill's workflow instructions
5. Claude completes task and responds
```

### Complete Message Array Example

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Extract text from report.pdf"
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "tool_use",
          "id": "toolu_123",
          "name": "Skill",
          "input": { "command": "pdf" }
        }
      ]
    },
    {
      "role": "user",
      "content": "<command-message>The \"pdf\" skill is loading</command-message>\n<command-name>pdf</command-name>"
      // isMeta: false (default) - VISIBLE
    },
    {
      "role": "user",
      "content": "You are a PDF processing specialist...[full skill prompt]",
      "isMeta": true  // HIDDEN from UI
    },
    {
      "role": "user",
      "content": {
        "type": "command_permissions",
        "allowedTools": ["Bash(pdftotext:*)", "Read", "Write"]
      }
    }
  ]
}
```

---

## Skills vs. System Prompts

### Why Skills Don't Live in System Prompts

**System prompts:**
- Global context, persists across entire conversation
- Higher authority than user instructions
- Affects all subsequent turns
- Used by some systems (e.g., ChatGPT's tools)

**Skills use user messages instead:**
- Temporary, scoped behavior
- Skill-specific context for current task
- Returns to normal after skill completes
- No residual behavioral modification

**Example:** The `pdf` skill should only affect PDF processing tasks, not transform Claude into permanent PDF specialist for rest of session.

**Message role semantics:**
```
role: "system"  → Global, persistent, high authority
role: "user"    → Temporary, task-specific, normal authority
role: "user" + isMeta: true → Hidden instructions for current task
```

---

## Token Budget & Optimization

### Skill List Token Budget

**Default limit:** ~15,000 characters for `<available_skills>` section

**Why limit exists:**
- Prevent Skill tool description from overwhelming model context
- Ensure room for conversation history and user request
- Force skill authors to write concise descriptions

**Optimization strategies:**
- Write concise descriptions (<1024 chars)
- Use specific triggers to improve discovery
- Avoid duplicate information across skills

### Context Window Distribution

**Typical context allocation:**
```
System prompt:           ~5,000 tokens
Skill metadata (100):    ~2,000 tokens
Conversation history:    ~20,000 tokens
User request:            ~500 tokens
SKILL.md (if triggered): ~3,000 tokens
Reference files:         ~5,000 tokens (selective)
Available for response:  ~165,000 tokens (200K model)
```

**Progressive disclosure impact:**
- Without: All SKILL.md files loaded = context overflow
- With: Only triggered skill + selective references = manageable

---

## Internal Objects & Data Structures

### Skill Object Schema

```typescript
interface Skill {
  type: "prompt";  // Always "prompt" for skills
  name: string;
  description: string;
  whenToUse?: string;  // Undocumented, may be deprecated
  allowedTools?: string[];
  model?: string;
  version?: string;
  disableModelInvocation?: boolean;
  mode?: boolean;
  isSkill: true;
  promptContent: string;  // SKILL.md body
  baseDir: string;  // Installation path
  source: "user" | "plugin" | "project" | "builtin";
}
```

### Skill Tool Structure

```typescript
interface SkillTool {
  name: "Skill";

  inputSchema: {
    command: string;  // Skill name
  };

  outputSchema: {
    success: boolean;
    commandName: string;
  };

  // Dynamic prompt generator
  prompt: () => Promise<string>;

  // Validation
  validateInput: (input, context) => Promise<ValidationResult>;

  // Permission checking
  checkPermissions: (input, context) => Promise<PermissionResult>;

  // Execution
  call: (input, context) => AsyncGenerator<SkillResult>;
}
```

### Context Modifier Return Type

```typescript
interface SkillResult {
  type: "result";
  data: {
    success: boolean;
    commandName: string;
  };
  newMessages: Message[];
  contextModifier?: (context: ExecutionContext) => ExecutionContext;
}
```

---

## Design Rationale

### Why Meta-Tool Architecture?

**Alternatives considered:**

**Option 1: Each skill as separate tool**
- ✗ Tools array would have 100+ entries (overwhelming)
- ✗ No clear way to group related skills
- ✗ Difficult to manage skill discovery

**Option 2: Skills in system prompt**
- ✗ System prompt would be massive (>100K tokens)
- ✗ No progressive disclosure
- ✗ Global, persistent behavior (not task-specific)

**Option 3: Meta-tool with dynamic description ✓**
- ✓ Single tool in array (clean)
- ✓ Progressive disclosure via metadata
- ✓ Task-specific activation
- ✓ Scalable to hundreds of skills

### Why Conversation Context Injection?

**Alternatives:**

**Option 1: Modify system prompt**
- ✗ Persistent global behavior
- ✗ Can't easily reset after task

**Option 2: Function calling with code execution**
- ✗ Requires hardcoded skill logic
- ✗ No flexibility for natural language instructions
- ✗ Difficult to customize per-skill

**Option 3: User message injection ✓**
- ✓ Temporary, task-scoped behavior
- ✓ Natural language instructions (flexible)
- ✓ Easy to reset (conversation moves on)

---

## Security Implications

### Trust Model

**Skills have elevated privileges:**
- Pre-approved tool access (bypass user confirmation)
- Code execution via bundled scripts
- Potential for data exfiltration or unintended actions

**Security recommendations:**
- Install skills only from trusted sources
- Audit SKILL.md and bundled scripts before use
- Review `allowed-tools` for excessive permissions
- Check for untrusted network connections in code

### Permission Scoping

**Good security practice:**
```yaml
# Minimal necessary permissions
allowed-tools: "Bash(git status:*),Bash(git diff:*),Read"

# Avoid overly broad permissions
allowed-tools: "Bash,Read,Write,WebFetch"  # Too much
```

**Wildcard scoping:**
```yaml
# Good - specific git commands
allowed-tools: "Bash(git:*)"

# Risky - all bash commands
allowed-tools: "Bash(*)"
```

---

## Performance Characteristics

**Skill invocation overhead:**
- Message generation: ~50ms
- File reading (SKILL.md): ~100-200ms
- Context modification: ~10ms
- Total: ~200-300ms additional latency

**Token overhead per skill:**
- Metadata (always): ~100 tokens
- SKILL.md (when triggered): ~500-2,000 tokens
- References (selective): ~0-5,000 tokens

**Sub-Agent Efficiency (Context Isolation):**
- **Main Context Impact:** ~150 tokens (Task invocation + result summary)
- **Sub-Agent Context:** Absorbs the "work" (e.g., 20K tokens of analysis/searches)
- **Net Benefit:** Main context remains pristine; intermediate tokens discarded when sub-agent terminates
- **Example:** Multi-turn Zen MCP call saves 96.5% of main context (5,700 tokens → 200 tokens)

**Comparison to direct prompting:**
- Skills: More latency, but reusable and consistent
- Direct prompts: Faster, but requires retyping each time
- Skills + Sub-Agents: Best of both - reusable patterns with minimal context impact

**Optimization opportunities:**
- Cache SKILL.md contents after first load
- Pre-parse frontmatter at startup
- Lazy-load reference files only when actually read
- Delegate token-heavy operations to sub-agents (>3K tokens or >2 API turns)
