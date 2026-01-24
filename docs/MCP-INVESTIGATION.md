# MCP Command Investigation

## Overview

The `/mcp` slash command in Claude Code CLI opens an interactive menu requiring keyboard navigation. This creates challenges for the VS Code extension.

## Current Behavior

When `/mcp` is executed:
1. CLI displays an interactive TUI menu with MCP server options
2. User navigates with arrow keys (up/down)
3. User selects with Enter key
4. After selection, session reloads to update token counts

## Challenges

### 1. Interactive Menu
- The menu requires real-time keystroke streaming to the CLI process
- Current extension captures stdout but doesn't stream stdin interactively
- Arrow key sequences differ across terminals (ANSI escape codes)

### 2. Session State Changes
- MCP server changes affect available tools and token count
- Session must reload after MCP configuration changes
- UI needs to refresh tool list and token display

### 3. Terminal Emulation
- TUI menus expect ANSI-capable terminal
- VS Code webview is not a real terminal
- Escape sequence handling would be complex

## Potential Solutions

### Option A: Separate Terminal
Open VS Code integrated terminal for MCP management:
```typescript
vscode.commands.executeCommand('workbench.action.terminal.new');
// Then send: claude /mcp
```
**Pros**: Full terminal support, no custom handling needed
**Cons**: User leaves extension UI, loses chat context

### Option B: Custom MCP UI
Build native MCP server picker in extension:
1. Read `~/.claude/settings.json` for MCP server list
2. Present VS Code QuickPick with servers
3. Write changes directly to settings file
4. Reload CLI session

**Pros**: Native VS Code experience, no terminal needed
**Cons**: Must maintain parity with CLI settings format

### Option C: Headless Mode
Request headless/scriptable mode from Claude Code CLI:
```bash
claude mcp add <server-name>
claude mcp remove <server-name>
claude mcp list --json
```
**Pros**: Clean programmatic interface
**Cons**: Requires CLI changes (not in our control)

## Recommendation

Start with **Option A** (Separate Terminal) as immediate solution, then evaluate **Option B** (Custom MCP UI) for better integration.
