/*
 * CLI help text builder and printer for atlassian-bitbucket-mcp.
 */

export function buildHelpText(): string {
  return `atlassian-bitbucket-mcp — MCP server for Bitbucket Cloud + Server/DC

Usage:
  atlassian-bitbucket-mcp                 Run the stdio MCP server (default)
  atlassian-bitbucket-mcp init [options]  Scaffold a starter config file
  atlassian-bitbucket-mcp help, --help, -h  Show this help

init options:
  --config-path <path>       Config file location (default:
                              ~/.config/bitbucket-mcp/config.json, or
                              $XDG_CONFIG_HOME/bitbucket-mcp/config.json)
  --max-output-tokens <n>    Default per-tool output-token limit written
                              to the scaffolded config (default: 25000)
  -y                         Skip the overwrite-confirmation prompt

Behavior config (bitbucket-mcp.config.json):
  Discovery order: BITBUCKET_MCP_CONFIG env (absolute path) >
  ./bitbucket-mcp.config.json (cwd) >
  $XDG_CONFIG_HOME or ~/.config/bitbucket-mcp/config.json > built-in
  defaults (25000 tokens/tool)
  Shape: {"defaults": {"maxOutputTokens": N}, "tools": {"<tool_name>":
  {"maxOutputTokens": N}}}
  Env override: BITBUCKET_MCP_MAX_OUTPUT_TOKENS overrides
  defaults.maxOutputTokens (never overrides a per-tool value)

Environment variables:
  BITBUCKET_URL              Bitbucket server URL (required, HTTPS only)
  BITBUCKET_TOKEN            Personal access token (required)
  BITBUCKET_DEFAULT_PROJECT  Default project key (required)
  BITBUCKET_MCP_CONFIG       Absolute path to config file
  BITBUCKET_MCP_MAX_OUTPUT_TOKENS  Override defaults.maxOutputTokens
  BITBUCKET_MCP_CONFIG_DIR   Override XDG config directory
  MCP_TRANSPORT              Transport mode: stdio (default), http, https
  LOG_LEVEL                  Logging level: debug, info, warn, error

See README section 'Per-tool output-token limits' for details.
`;
}

export function printHelp(write?: (chunk: string) => void): void {
  const writeOut = write ?? process.stdout.write.bind(process.stdout);
  writeOut(buildHelpText());
}
