/*
 * MCP Server setup — thin wiring only.
 *
 * All tool definitions (name, description, input shape, handler) live in
 * `tools/registry.ts`. This file:
 *   1. Instantiates the API clients and per-category tool factories.
 *   2. Builds the registry.
 *   3. Iterates the registry and registers each tool with the SDK.
 *
 * Adding a new tool means editing only `registry.ts` + the relevant
 * `tools/*-tools.ts`. No changes here.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { PullRequestApi } from './bitbucket/api/pull-requests.js';
import { RepositoryApi } from './bitbucket/api/repositories.js';
import { SearchApi } from './bitbucket/api/search.js';
import { log } from './logger.js';
import { createPrTools } from './tools/pr-tools.js';
import { buildToolRegistry } from './tools/registry.js';
import { createRepoTools } from './tools/repo-tools.js';
import { createSearchTools } from './tools/search-tools.js';

import type { BitbucketClient } from './bitbucket/client.js';
import type { Cache } from './cache.js';
import type { Config, McpToolResult } from '@types';

/** Narrow SDK-compatible tool result (content must be text blocks). */
type SdkToolResult = McpToolResult & { content: Array<{ type: 'text'; text: string }> };

/** Wrap a tool handler to narrow its result to the SDK's text-content form. */
function asSdkHandler(
  handler: (args: unknown) => Promise<McpToolResult>
): (args: unknown) => Promise<SdkToolResult> {
  return async (args: unknown) => (await handler(args)) as SdkToolResult;
}

export function createServer(config: Config, client: BitbucketClient, cache: Cache): McpServer {
  const server = new McpServer({
    name: 'atlassian-bitbucket-mcp',
    version: '0.1.0',
  });

  const registry = buildToolRegistry({
    pr: createPrTools(new PullRequestApi(client), config, cache),
    repo: createRepoTools(new RepositoryApi(client), config, cache),
    search: createSearchTools(new SearchApi(client), config),
  });

  for (const tool of registry) {
    server.tool(tool.name, tool.description, tool.shape, asSdkHandler(tool.handler));
  }

  log('info', 'mcp tools registered', {
    operation: 'server_init',
    toolCount: registry.length,
  });

  return server;
}
