# Project Overview

## Identity
- **Name**: claude-code-chat (Display: "Claude Mosaic")
- **Type**: VS Code Extension
- **Version**: 1.1.0
- **Publisher**: FlameWithin
- **Fork of**: andrepimenta/claude-code-chat

## Purpose
VS Code extension providing a beautiful chat interface for Claude Code CLI. Allows users to interact with Claude directly within VS Code through a webview panel.

## Key Features
- Chat interface with Claude Code CLI
- Multiple chat windows support
- Conversation history with JSONL persistence
- MCP server configuration management
- Permission management with audit logging
- WSL integration support
- Multiple backend support (Claude CLI, OpenCode)
- Thinking mode intensity levels
- Git checkpoint/backup system

## Entry Points
- **Activation**: `onStartupFinished` (immediate on VS Code start)
- **Commands**:
  - `claude-code-chat.openChat` (Ctrl+Shift+C)
  - `claude-code-chat.newWindow` (Ctrl+Shift+N)
  - `claude-code-chat.renameChat`

## Configuration Options
Key settings in `contributes.configuration`:
- `claudeCodeChat.backend`: "claude" | "opencode"
- `claudeCodeChat.wsl.enabled`: WSL integration toggle
- `claudeCodeChat.thinking.intensity`: "think" | "think-hard" | "think-harder" | "ultrathink"
- `claudeCodeChat.permissions.yoloMode`: Skip permission checks
- `claudeCodeChat.compact.toolOutput`: Collapsed tool output display
