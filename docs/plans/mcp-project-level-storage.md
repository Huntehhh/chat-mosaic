# MCP Project-Level Storage Plan

## Problem

MCP servers are being saved at the **global level** instead of **project level** in `~/.claude.json`.

### Current State

| Operation | Current Location | Expected Location |
|-----------|-----------------|-------------------|
| Load MCP | `~/.claude.json` → root `mcpServers` | `~/.claude.json` → `projects[projectPath].mcpServers` |
| Save MCP | `storageUri/mcp/mcp-servers.json` | `~/.claude.json` → `projects[projectPath].mcpServers` |
| Delete MCP | `storageUri/mcp/mcp-servers.json` | `~/.claude.json` → `projects[projectPath].mcpServers` |

**Double bug:**
1. Loading reads from global `mcpServers`, not project-level
2. Save/Delete write to extension storage, not `~/.claude.json`

## Target Structure

```
~/.claude.json
{
  "mcpServers": { ... },              ← GLOBAL (ignore for UI)
  "projects": {
    "C:/HApps/claude-code-chat": {
      "mcpServers": { ... },          ← PROJECT-LEVEL (use this)
      "disabledMcpServers": []
    }
  }
}
```

## Path Format Handling

The `.claude.json` has mixed path formats depending on shell used:
- PowerShell: `"C:\\HApps\\project"` (double backslash)
- Git Bash: `"C:/HApps/project"` (forward slash)

### Solution

```
_getProjectConfig(workspacePath)
├── 1. Try exact match: projects[workspacePath]
├── 2. Try forward slash: projects[path/with/fwd]
├── 3. Try backslash: projects[path\\with\\back]
└── 4. If none found → create new entry with VS Code's format
```

## Implementation Changes

File: `src/extension.ts`

### New Helper Methods

1. **`_normalizeProjectPath(path)`** - convert path to both formats for lookup
2. **`_getProjectConfig(workspacePath)`** - find project config regardless of slash style
3. **`_writeProjectConfig(workspacePath, config)`** - update project-specific config

### Modified Methods

4. **`_loadMCPServers()`** - read from `projects[projectPath].mcpServers`
5. **`_saveMCPServer(name, config)`** - write to `projects[projectPath].mcpServers`
6. **`_deleteMCPServer(name)`** - delete from `projects[projectPath].mcpServers`

## Files Affected

- `src/extension.ts` - main implementation
- `src/services/McpService.ts` - may need updates if used elsewhere
