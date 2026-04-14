/*
 * MCP Server setup — tool registration and request routing.
 *
 * Each tool is registered by pairing its shared schema (from `tools/schemas.ts`)
 * with its handler. The SDK's `server.tool()` return type is a narrow content
 * variant we satisfy via a single wrapper helper rather than 19 inline casts.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { PullRequestApi } from './bitbucket/api/pull-requests.js';
import { RepositoryApi } from './bitbucket/api/repositories.js';
import { SearchApi } from './bitbucket/api/search.js';
import { log } from './logger.js';
import { createPrTools } from './tools/pr-tools.js';
import { createRepoTools } from './tools/repo-tools.js';
import {
  addPrCommentShape,
  addPrInlineCommentShape,
  getFileContentShape,
  listProjectsShape,
  listPullRequestsShape,
  prPaginatedShape,
  prRefShape,
  projectListShape,
  replyToCommentShape,
  repoPaginatedShape,
  repoRefShape,
  resolveCommentShape,
  searchCodeShape,
  searchCommitsShape,
  updateCommentShape,
} from './tools/schemas.js';
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

  const prApi = new PullRequestApi(client);
  const repoApi = new RepositoryApi(client);
  const searchApi = new SearchApi(client);

  const prTools = createPrTools(prApi, config, cache);
  const repoTools = createRepoTools(repoApi, config, cache);
  const searchTools = createSearchTools(searchApi, config);

  // --- PR Tools ---------------------------------------------------------
  server.tool(
    'bitbucket_list_pull_requests',
    'List pull requests for a repository',
    listPullRequestsShape,
    asSdkHandler(prTools.bitbucket_list_pull_requests)
  );
  server.tool(
    'bitbucket_get_pull_request',
    'Get detailed pull request information',
    prRefShape,
    asSdkHandler(prTools.bitbucket_get_pull_request)
  );
  server.tool(
    'bitbucket_get_pr_diff',
    'Get pull request diff/changes',
    prRefShape,
    asSdkHandler(prTools.bitbucket_get_pr_diff)
  );
  server.tool(
    'bitbucket_get_pr_commits',
    'Get commits in a pull request',
    prPaginatedShape,
    asSdkHandler(prTools.bitbucket_get_pr_commits)
  );
  server.tool(
    'bitbucket_get_pr_activities',
    'Get pull request comments and activities',
    prPaginatedShape,
    asSdkHandler(prTools.bitbucket_get_pr_activities)
  );
  server.tool(
    'bitbucket_add_pr_comment',
    'Add a general comment to a pull request',
    addPrCommentShape,
    asSdkHandler(prTools.bitbucket_add_pr_comment)
  );
  server.tool(
    'bitbucket_add_pr_inline_comment',
    'Add inline code comment on a pull request',
    addPrInlineCommentShape,
    asSdkHandler(prTools.bitbucket_add_pr_inline_comment)
  );
  server.tool(
    'bitbucket_reply_to_comment',
    'Reply to a comment on a pull request',
    replyToCommentShape,
    asSdkHandler(prTools.bitbucket_reply_to_comment)
  );
  server.tool(
    'bitbucket_resolve_comment',
    'Resolve a comment thread on a pull request',
    resolveCommentShape,
    asSdkHandler(prTools.bitbucket_resolve_comment)
  );
  server.tool(
    'bitbucket_update_comment',
    'Edit a comment on a pull request',
    updateCommentShape,
    asSdkHandler(prTools.bitbucket_update_comment)
  );
  server.tool(
    'bitbucket_approve_pr',
    'Approve a pull request',
    prRefShape,
    asSdkHandler(prTools.bitbucket_approve_pr)
  );

  // --- Repo Tools -------------------------------------------------------
  server.tool(
    'bitbucket_list_projects',
    'List accessible Bitbucket projects',
    listProjectsShape,
    asSdkHandler(repoTools.bitbucket_list_projects)
  );
  server.tool(
    'bitbucket_list_repositories',
    'List repositories in a project',
    projectListShape,
    asSdkHandler(repoTools.bitbucket_list_repositories)
  );
  server.tool(
    'bitbucket_get_repository',
    'Get repository details',
    repoRefShape,
    asSdkHandler(repoTools.bitbucket_get_repository)
  );
  server.tool(
    'bitbucket_get_branches',
    'List repository branches',
    repoPaginatedShape,
    asSdkHandler(repoTools.bitbucket_get_branches)
  );
  server.tool(
    'bitbucket_get_commits',
    'Get commit history for a repository',
    repoPaginatedShape,
    asSdkHandler(repoTools.bitbucket_get_commits)
  );
  server.tool(
    'bitbucket_get_file_content',
    'Get file content at a specific ref',
    getFileContentShape,
    asSdkHandler(repoTools.bitbucket_get_file_content)
  );

  // --- Search Tools -----------------------------------------------------
  server.tool(
    'bitbucket_search_code',
    'Search code across repositories in a project',
    searchCodeShape,
    asSdkHandler(searchTools.bitbucket_search_code)
  );
  server.tool(
    'bitbucket_search_commits',
    'Search commits by message',
    searchCommitsShape,
    asSdkHandler(searchTools.bitbucket_search_commits)
  );

  log('info', 'mcp tools registered', { operation: 'server_init', toolCount: 19 });

  return server;
}
