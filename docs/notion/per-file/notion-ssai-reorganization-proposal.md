# SSAI - Prospect Mint Reorganization Proposal

## CURRENT ISSUES

❌ **Scattered utilities**: Hotkeys, port commands, CMD helpers spread across main page
❌ **Inconsistent naming**: "Claude Helpers" vs "Claude Code Helpers" sections
❌ **Inline prompts**: 2000+ lines of prompts embedded in dropdowns on main page
❌ **Mixed content**: Navigation links + inline content + quick reference all jumbled
❌ **No clear hierarchy**: Hard to find what you need quickly

---

## PROPOSED STRUCTURE

```
💲 SSAI - Prospect Mint
│
├── 📊 Project Overview
│   ├── SSAI Project Tracking
│   ├── Prompt Engineering
│   ├── MVP Frontend Diagram
│   └── Client Data Collection Flow
│
├── 📖 Documentation
│   ├── Executive Level
│   │   ├── Table Architecture Overview
│   │   ├── Data Onboarding Pipeline v3
│   │   ├── Running the App
│   │   └── Data Collection Architecture Notes
│   │
│   ├── Technical Details
│   │   ├── Client Archetype Fields
│   │   ├── Lead Intelligence Fields
│   │   ├── Lead Targeting & Outreach Filters
│   │   └── Field Relationships Matrix
│   │
│   └── Implementation Guides
│       ├── Initial Client Onboarding Pipeline
│       ├── Data Collection Phase 1
│       ├── 2-Phase Client Collection Approach
│       └── First Claude Creation Prompt
│
├── 🤖 Claude Workflows
│   ├── Prompt Libraries
│   │   ├── Compact Prompts (Technical/Coding)
│   │   ├── Compact Prompts (Writing/Research)
│   │   ├── Research Documentation Framework
│   │   └── Basic Memory Templates
│   │
│   ├── Desktop Claude Helpers
│   │   ├── MCP Analysis Prompt
│   │   ├── Project-Specific Helpers
│   │   └── Markdown Continuation Prompts
│   │
│   └── Claude Code Helpers
│       ├── MCP Integration (Zen, Proxy, Helpers)
│       ├── Initialize Chat Workflow
│       └── Ultimate Claude Code Prompt
│
├── 🛠️ Developer Utilities
│   ├── Quick Reference
│   │   ├── Keyboard Shortcuts (WIN+SHIFT+/, emoji, zoom, ruler, paste history)
│   │   ├── Port Management (nuke-ports commands)
│   │   └── CMD Helpers (Port Analysis/Kill)
│   │
│   └── MCP Tools Reference
│       ├── MCP List (ONLINE!)
│       ├── Simple Scraper
│       └── Apify Web Scraper Setup
│
├── 📚 Research Frameworks
│   ├── Lead Scraping w/ Apify Guide
│   ├── Deep Company Research Layout
│   └── Prompt Fields Analysis (phase 1 vs 2)
│
└── 📋 Backlog & Tasks
    └── Pending Tasks
```

---

## KEY CHANGES

### 1. **Developer Utilities** (NEW folder)
**Consolidates scattered quick-reference items**:
- Moves inline hotkeys → Quick Reference sub-page
- Moves inline port commands → Quick Reference sub-page
- Groups CMD helpers with other utilities
- All MCP tool references in one place

### 2. **Claude Workflows** (RENAMED & REORGANIZED)
**Merges "Claude Helpers" + "Claude Code Helpers"**:
- Separates by use case (Desktop vs Code vs Prompt Libraries)
- All compact prompt variations → single organized sub-page
- Research documentation framework → dedicated sub-page
- Clear distinction: Desktop Claude vs Claude Code workflows

### 3. **Documentation** (NEW hierarchy)
**Three-tier organization**:
- **Executive**: High-level overviews, architecture, pipelines
- **Technical Details**: Field definitions, schemas, table structures
- **Implementation Guides**: Step-by-step workflows, setup instructions

### 4. **Main Page Cleanup**
**Becomes pure navigation**:
- Remove ALL inline content (hotkeys, commands, prompts)
- Move to appropriate sub-pages
- Main page = organized links only
- Estimated: 800+ lines → ~50 lines

---

## WHAT GETS MOVED

| Current Location | New Location | Why |
|-----------------|--------------|-----|
| Inline hotkeys (main page) | Developer Utilities > Quick Reference | Utilities, not navigation |
| Inline port commands (main page) | Developer Utilities > Quick Reference | Utilities, not navigation |
| Compact Prompts dropdowns (main page) | Claude Workflows > Prompt Libraries | Organize variations |
| Research doc dropdowns (main page) | Claude Workflows > Prompt Libraries | Move to dedicated page |
| Claude Helpers + Claude Code Helpers | Claude Workflows | Merge inconsistent sections |
| Executive docs (flat list) | Documentation > Executive Level | Add hierarchy |
| Table structure pages (flat list) | Documentation > Technical Details | Group related content |

---

## MAIN PAGE PREVIEW (AFTER)

```
💲 SSAI - Prospect Mint

Quick Links:
→ Running the App
→ Keyboard Shortcuts & Utilities
→ Initialize New Chat

📊 Project Overview
📖 Documentation
🤖 Claude Workflows
🛠️ Developer Utilities
📚 Research Frameworks
📋 Backlog & Tasks
```

Clean, scannable, organized by purpose.

---

## BENEFITS

✅ **Find things faster**: Clear categories by use case
✅ **Less cognitive load**: Main page is simple navigation hub
✅ **Consistent naming**: No more "Helpers" vs "Code Helpers" confusion
✅ **Better maintenance**: Related items grouped together
✅ **Scalable**: Easy to add new prompts, utilities, docs to right place
