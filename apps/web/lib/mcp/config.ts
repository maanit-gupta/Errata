/** MCP key expiry choices in days (create_mcp_key accepts 1-365). */
export const KEY_EXPIRY_DAYS = [30, 90, 365] as const;

/** The three client configs shown once after a key is created. */
export function mcpConfigs(endpoint: string, key: string) {
  return {
    cursor: JSON.stringify(
      { mcpServers: { errata: { url: endpoint, headers: { Authorization: `Bearer ${key}` } } } },
      null,
      2,
    ),
    claudeCode: `claude mcp add --transport http errata ${endpoint} --header "Authorization: Bearer ${key}"`,
    // Claude Desktop reaches remote servers through the mcp-remote bridge (needs Node).
    claudeDesktop: JSON.stringify(
      {
        mcpServers: {
          errata: {
            command: "npx",
            args: ["-y", "mcp-remote", endpoint, "--header", "Authorization:${ERRATA_MCP_AUTH}"],
            env: { ERRATA_MCP_AUTH: `Bearer ${key}` },
          },
        },
      },
      null,
      2,
    ),
  };
}
