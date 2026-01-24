import { useMemo } from 'react';
import { useSettingsStore, type McpServer } from '../../stores/settingsStore';
import type { MCPServerConfig } from '../../../types/messages';

/**
 * Handlers for MCP server management
 * Message types: mcpServers, mcpServerSaved, mcpServerDeleted, mcpServerError
 */
export function useMcpHandlers() {
  const { setMcpServers } = useSettingsStore();

  return useMemo(() => ({
    mcpServers: (data: Record<string, MCPServerConfig>) => {
      const servers: McpServer[] = Object.entries(data).map(([name, config]) => ({
        id: name,
        name,
        type: config.type,
        enabled: true,
        command: config.command,
        args: config.args,
        url: config.url,
        env: config.env,
      }));
      setMcpServers(servers);
    },

    mcpServerSaved: () => {
      // Refresh MCP servers list after save
      // The list is typically refreshed automatically via mcpServers message
    },

    mcpServerDeleted: () => {
      // Refresh MCP servers list after delete
      // The list is typically refreshed automatically via mcpServers message
    },

    mcpServerError: (data: { error: string }) => {
      console.error('[MCP Server Error]', data.error);
    },
  }), [setMcpServers]);
}
