/*
 * Code & Commit Search MCP tools
 */

import { z } from 'zod';

import { log } from '../logger.js';
import { requirePermission } from '../permissions.js';

import type { SearchApi } from '../bitbucket/api/search.js';
import type { Config, McpToolResult } from '@types';

function textResult(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResult(code: string, message: string): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: { code, message } }) }], isError: true };
}

export function createSearchTools(searchApi: SearchApi, config: Config) {
  return {
    bitbucket_search_code: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'search_code');
        const input = z.object({
          project: z.string().min(1),
          query: z.string().min(1).max(500),
          limit: z.coerce.number().int().positive().optional(),
          start: z.coerce.number().int().nonnegative().optional(),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_search_code' });
        const result = await searchApi.searchCode(input.project, input.query, input.limit, input.start);
        log('info', 'tool end', { toolName: 'bitbucket_search_code', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_search_code', error: String(err), durationMs: Date.now() - start });
        return errorResult('SEARCH_CODE_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_search_commits: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'search_code');
        const input = z.object({
          project: z.string().min(1),
          repo: z.string().min(1),
          query: z.string().min(1).max(500),
          limit: z.coerce.number().int().positive().optional(),
          start: z.coerce.number().int().nonnegative().optional(),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_search_commits' });
        const result = await searchApi.searchCommits(input.project, input.repo, input.query, input.limit, input.start);
        log('info', 'tool end', { toolName: 'bitbucket_search_commits', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_search_commits', error: String(err), durationMs: Date.now() - start });
        return errorResult('SEARCH_COMMITS_FAILED', err instanceof Error ? err.message : String(err));
      }
    },
  };
}
