# MCP Server Manager - Stitch Build Order

High-fidelity UI prompts for Google Stitch to create an MCP server management interface.

## Overview

- **Purpose**: Visual editor for managing MCP servers from .mcp.json
- **Location**: VS Code extension sidebar panel
- **Mode**: High-fidelity (use Experimental if available)
- **Style**: VS Code dark theme, amber accents (#FFA344)

---

## Prompt 1: List View + Empty State (2 screens)

```
Generate two states for MCP Server Manager panel in VS Code extension:

=== SCREEN 1: Server List (with servers) ===

Dark sidebar panel for managing MCP (Model Context Protocol) servers.

STYLE: VS Code dark theme, minimal, developer tool aesthetic.

COLORS:
- Background: #0f0f0f
- Cards: #171717 with 1px #222225 border
- Text: #fafafa (primary), #8b8b94 (secondary), #52525b (dim)
- Accent: #FFA344 (amber) for buttons and active states
- Status: #22c55e (active), #52525b (disabled)

LAYOUT (top to bottom):
1. HEADER - 48px height
   - Left: "MCP Servers" title, 16px #fafafa bold
   - Right: "+ Add" button, #FFA344 bg, #0f0f0f text, 8px radius, 12px padding

2. SERVER LIST - Scrollable, 8px gap between cards
   - Each card: #171717 bg, 1px #222225 border, 8px radius, 12px padding
   - Card layout (horizontal):
     - Left: Status dot (8px circle), server name (14px #fafafa bold)
     - Center: Type badge "stdio" or "sse" (#222225 bg, #8b8b94 text, pill shape)
     - Right: Hover-reveal icons (edit pencil, toggle switch, trash) 16px #52525b

STATES:
- Card hover: Border brightens to #333333
- Trash hover: Icon turns #FF7369
- Disabled server: Card 50% opacity

=== SCREEN 2: Empty State ===

Same panel shell, but MAIN AREA shows empty state.

LAYOUT:
- Centered vertically in list area
- Icon: Server/database outline, 48px, #52525b
- Title: "No servers configured" 14px #8b8b94
- Subtitle: "Add an MCP server to extend Claude's capabilities" 12px #52525b
- Button: "Add Server" ghost button, 1px #222225 border, #8b8b94 text, 8px radius
```

---

## Prompt 2: Editor Form - stdio Type

```
MCP server editor form for stdio-type configuration in VS Code extension.

STYLE: VS Code dark theme. Same colors as server list (#0f0f0f bg, #FFA344 accent).

LAYOUT (top to bottom):

1. HEADER - 48px height
   - Left: Back arrow icon (16px #8b8b94), "Edit Server" title (16px #fafafa)
   - Right: Delete button (trash icon, 16px #FF7369) - only for existing servers

2. FORM SECTIONS - 24px gap between sections, 12px padding sides

   SECTION: Server Name
   - Label: "SERVER NAME" 11px #52525b uppercase tracking-wide
   - Input: Full-width, #171717 bg, 1px #222225 border, 8px radius
   - Placeholder: "my-server" 14px #52525b

   SECTION: Type Selector
   - Label: "TYPE" 11px #52525b uppercase
   - Toggle: Two-button pill, 100% width
   - "stdio" selected: #FFA344 bg, #0f0f0f text
   - "sse" unselected: #222225 bg, #8b8b94 text

   SECTION: Command
   - Label: "COMMAND" 11px #52525b uppercase
   - Input: Full-width, monospace font, #171717 bg, 1px #222225 border
   - Placeholder: "npx" 14px #52525b

   SECTION: Arguments
   - Label: "ARGUMENTS" 11px #52525b uppercase
   - Chip row: Horizontal wrap, 6px gap
   - Each chip: #222225 bg, #8b8b94 text, 6px 12px padding, pill shape, X icon right
   - Last chip: "+ Add" with dashed border #333333

   SECTION: Environment Variables
   - Label: "ENVIRONMENT VARIABLES" 11px #52525b uppercase
   - Each row: Two inputs side-by-side (Key | Value), trash icon right
   - Key input: 120px width, placeholder "KEY"
   - Value input: Flex-1, placeholder "value"
   - "+ Add Variable" link below, #FFA344 text, 12px

3. FOOTER - Fixed bottom, 60px height, #0f0f0f bg, border-top 1px #222225
   - Left: "Cancel" ghost button, #8b8b94 text
   - Right: "Save" button, #FFA344 bg, #0f0f0f text, 8px radius

STATES:
- Input focus: Border #FFA344 with subtle glow
- Chip X hover: Background #FF7369
- Save disabled (muted) until name + command filled
```

---

## Prompt 3: Editor Form - sse Type

```
Update EXISTING editor form. DO NOT recreate header or footer.

When "sse" type is selected in the type toggle:

CHANGES TO FORM SECTIONS:

1. TYPE SELECTOR - "sse" now selected
   - "sse" button: #FFA344 bg, #0f0f0f text
   - "stdio" button: #222225 bg, #8b8b94 text

2. HIDE these sections (not visible):
   - Command
   - Arguments
   - Environment Variables

3. SHOW new section after Type Selector:

   SECTION: Server URL
   - Label: "SERVER URL" 11px #52525b uppercase
   - Input: Full-width, #171717 bg, 1px #222225 border, 8px radius
   - Placeholder: "http://localhost:3000/sse" 14px #52525b
   - Helper text below: "SSE endpoint URL" 11px #52525b

Keep all existing styling, footer buttons, header unchanged.

STATES:
- Invalid URL: Border #FF7369, helper text "Invalid URL format" in #FF7369
```

---

## Prompt 4: Delete Confirmation Modal

```
Delete confirmation dialog for MCP server in VS Code extension.

STYLE: VS Code dark theme, same palette (#0f0f0f, #171717, #FFA344).

LAYOUT:
- Backdrop: rgba(0,0,0,0.7) covering full panel
- Modal: Centered, 280px wide, #171717 bg, 1px #222225 border, 12px radius
- Shadow: 0 8px 32px rgba(0,0,0,0.5)
- Padding: 24px

MODAL CONTENT (vertical stack, centered):
1. Icon: Warning triangle, 32px, #FFA344
2. Title: "Delete Server?" 16px #fafafa bold, 12px margin-top
3. Message: "This will remove zen-mcp from your configuration." 13px #8b8b94, 8px margin-top
4. Button row: 16px margin-top, 12px gap, full-width buttons
   - "Cancel" button: #222225 bg, #8b8b94 text, 8px radius, flex-1
   - "Delete" button: #FF7369 bg, #fafafa text, 8px radius, flex-1

STATES:
- Delete hover: Background darkens to #E5544A
- Cancel hover: Background #333333
- Escape key or backdrop click closes modal
- Animation: fade in 150ms, scale 0.95→1.0
```

---

## Build Instructions

1. **Use High-fidelity mode** in Stitch (Experimental if available)
2. **Generate Prompt 1 first** - establishes visual foundation
3. **One prompt per generation** - verify output before next
4. **Refinement tips** for tweaks after generation:
   - "Add subtle box-shadow: 0 2px 8px rgba(0,0,0,0.3) to server cards"
   - "Make type toggle pill-shaped with 16px radius"
   - "Add loading spinner to Save button when submitting"

## Component Mapping (for React implementation)

| Stitch Element | React Component | Location |
|----------------|-----------------|----------|
| Server list | `McpServerList` | containers/ |
| Server card | `McpServerCard` | molecules/ |
| Type toggle | `TypeSelector` | atoms/ |
| Chip input | `ChipInput` | atoms/ |
| Key-value editor | `KeyValueEditor` | molecules/ |
| Delete modal | `ConfirmDialog` | molecules/ |

## Color Reference

| Token | Hex | Usage |
|-------|-----|-------|
| bg-base | #0f0f0f | Panel background |
| bg-card | #171717 | Cards, inputs |
| border | #222225 | All borders |
| text-primary | #fafafa | Main text |
| text-secondary | #8b8b94 | Labels, hints |
| text-dim | #52525b | Placeholders |
| accent | #FFA344 | Buttons, active states |
| error | #FF7369 | Delete, errors |
| success | #22c55e | Active status |
