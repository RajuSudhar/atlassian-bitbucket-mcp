# config (src/config.ts, src/paths.ts)

## Two config types

- `Config` — connection/permission/cache/transport, from `loadConfig()`.
- `ServerConfig` — output-token-limit governor, from `loadServerConfig()`.
  Never merge them; never name a `ServerConfig` value `config` (call it `governor`).

## Discovery precedence (config file)

`BITBUCKET_MCP_CONFIG` env (absolute path, error if set but missing) →
`./bitbucket-mcp.config.json` (cwd) → `$XDG_CONFIG_HOME` or
`~/.config/bitbucket-mcp/config.json` → built-in defaults.

## Value precedence (per-tool limit)

- `tools.<name>.maxOutputTokens` (file)
- `BITBUCKET_MCP_MAX_OUTPUT_TOKENS` (env) — overrides only the default,
  never a per-tool value
- `defaults.maxOutputTokens` (file)
- `DEFAULT_MAX_OUTPUT_TOKENS` (`25000`)

## Env reads

`BITBUCKET_MCP_CONFIG`, `BITBUCKET_MCP_MAX_OUTPUT_TOKENS`, and
`BITBUCKET_MCP_CONFIG_DIR` are read only in `src/config.ts`, except inside
`src/init.ts`'s standalone CLI path (see Phase 05 note in the plan doc)
which never calls `loadConfig()` or `loadServerConfig()`.

## Enforcement wrapper

- Lives in `src/tools/registry.ts` as `toolHandler(toolName, governor, fn)`.
- Runs after every tool's `McpToolResult` is fully assembled by its inner
  handler (i.e. after validate/permission/log/cache-invalidate/log-end).
- Counts tokens via `countOutputTokens` (`src/tools/token-count.ts`,
  gpt-tokenizer o200k_base × 1.2 multiplier).
- Over limit → returns `{isError: true, content: [{type: 'text', text:
  buildTokenLimitGuidance(...)}]}`. Under limit → passes through
  byte-for-byte. Handler throws propagate unchanged.
- Holds no `Cache` reference; cache invalidation on writes happens inside
  the inner handler and is unaffected by whether the response passes or
  is withheld.

## Regenerating the JSON schema

- Committed at repo root as `bitbucket-mcp.config.schema.json`.
- Regenerate via `pnpm run schema:gen` after any change to
  `serverConfigSchema` in `src/config.ts`.
- `test/config-schema.test.mjs` diffs the committed schema against a
  fresh regeneration and fails CI on drift.
