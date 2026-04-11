/*
 * MCP Server setup — tool registration and request routing.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { PullRequestApi } from './bitbucket/api/pull-requests.js';
import { RepositoryApi } from './bitbucket/api/repositories.js';
import { SearchApi } from './bitbucket/api/search.js';
import { log } from './logger.js';
import { createPrTools } from './tools/pr-tools.js';
import { createRepoTools } from './tools/repo-tools.js';
import { createSearchTools } from './tools/search-tools.js';

import type { BitbucketClient } from './bitbucket/client.js';
import type { Cache } from './cache.js';
import type { Config, McpToolResult } from '@types';

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

  // -- PR Tools --
  server.tool('bitbucket_list_pull_requests', 'List pull requests for a repository', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    state: z.string().optional().describe('PR state filter: OPEN, MERGED, DECLINED'),
    limit: z.number().optional().describe('Max results'),
    start: z.number().optional().describe('Pagination start'),
  }, async (args) => await prTools.bitbucket_list_pull_requests(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_get_pull_request', 'Get detailed pull request information', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    prId: z.number().describe('Pull request ID'),
  }, async (args) => await prTools.bitbucket_get_pull_request(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_get_pr_diff', 'Get pull request diff/changes', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    prId: z.number().describe('Pull request ID'),
  }, async (args) => await prTools.bitbucket_get_pr_diff(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_get_pr_commits', 'Get commits in a pull request', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    prId: z.number().describe('Pull request ID'),
    limit: z.number().optional().describe('Max results'),
    start: z.number().optional().describe('Pagination start'),
  }, async (args) => await prTools.bitbucket_get_pr_commits(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_get_pr_activities', 'Get pull request comments and activities', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    prId: z.number().describe('Pull request ID'),
    limit: z.number().optional().describe('Max results'),
    start: z.number().optional().describe('Pagination start'),
  }, async (args) => await prTools.bitbucket_get_pr_activities(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_add_pr_comment', 'Add a general comment to a pull request', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    prId: z.number().describe('Pull request ID'),
    text: z.string().describe('Comment text'),
  }, async (args) => await prTools.bitbucket_add_pr_comment(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_add_pr_inline_comment', 'Add inline code comment on a pull request', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    prId: z.number().describe('Pull request ID'),
    text: z.string().describe('Comment text'),
    path: z.string().describe('File path'),
    line: z.number().describe('Line number'),
    lineType: z.string().describe('ADDED, REMOVED, or CONTEXT'),
    fileType: z.string().optional().describe('FROM or TO'),
  }, async (args) => await prTools.bitbucket_add_pr_inline_comment(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_reply_to_comment', 'Reply to a comment on a pull request', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    prId: z.number().describe('Pull request ID'),
    commentId: z.number().describe('Parent comment ID'),
    text: z.string().describe('Reply text'),
  }, async (args) => await prTools.bitbucket_reply_to_comment(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_resolve_comment', 'Resolve a comment thread on a pull request', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    prId: z.number().describe('Pull request ID'),
    commentId: z.number().describe('Comment ID to resolve'),
    version: z.number().describe('Comment version for optimistic locking'),
  }, async (args) => await prTools.bitbucket_resolve_comment(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_update_comment', 'Edit a comment on a pull request', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    prId: z.number().describe('Pull request ID'),
    commentId: z.number().describe('Comment ID to edit'),
    text: z.string().describe('Updated comment text'),
    version: z.number().describe('Comment version for optimistic locking'),
  }, async (args) => await prTools.bitbucket_update_comment(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_approve_pr', 'Approve a pull request', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    prId: z.number().describe('Pull request ID'),
  }, async (args) => await prTools.bitbucket_approve_pr(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  // -- Repo Tools --
  server.tool('bitbucket_list_projects', 'List accessible Bitbucket projects', {
    limit: z.number().optional().describe('Max results'),
    start: z.number().optional().describe('Pagination start'),
  }, async (args) => await repoTools.bitbucket_list_projects(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_list_repositories', 'List repositories in a project', {
    project: z.string().describe('Project key'),
    limit: z.number().optional().describe('Max results'),
    start: z.number().optional().describe('Pagination start'),
  }, async (args) => await repoTools.bitbucket_list_repositories(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_get_repository', 'Get repository details', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
  }, async (args) => await repoTools.bitbucket_get_repository(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_get_branches', 'List repository branches', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    limit: z.number().optional().describe('Max results'),
    start: z.number().optional().describe('Pagination start'),
  }, async (args) => await repoTools.bitbucket_get_branches(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_get_commits', 'Get commit history for a repository', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    limit: z.number().optional().describe('Max results'),
    start: z.number().optional().describe('Pagination start'),
  }, async (args) => await repoTools.bitbucket_get_commits(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_get_file_content', 'Get file content at a specific ref', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    path: z.string().describe('File path'),
    ref: z.string().optional().describe('Branch, tag, or commit ref'),
  }, async (args) => await repoTools.bitbucket_get_file_content(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  // -- Search Tools --
  server.tool('bitbucket_search_code', 'Search code across repositories in a project', {
    project: z.string().describe('Project key'),
    query: z.string().describe('Search query'),
    limit: z.number().optional().describe('Max results'),
    start: z.number().optional().describe('Pagination start'),
  }, async (args) => await searchTools.bitbucket_search_code(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  server.tool('bitbucket_search_commits', 'Search commits by message', {
    project: z.string().describe('Project key'),
    repo: z.string().describe('Repository slug'),
    query: z.string().describe('Search query'),
    limit: z.number().optional().describe('Max results'),
    start: z.number().optional().describe('Pagination start'),
  }, async (args) => await searchTools.bitbucket_search_commits(args) as McpToolResult & { content: Array<{ type: "text"; text: string }> });

  log('info', 'mcp tools registered', { operation: 'server_init', toolCount: 20 });

  return server;
}
