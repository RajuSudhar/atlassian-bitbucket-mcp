/*
 * Repository & Project MCP tools
 */

import { z } from 'zod';

import { cacheKey } from '../cache.js';
import { log } from '../logger.js';
import { requirePermission } from '../permissions.js';

import type { Cache } from '../cache.js';
import type { RepositoryApi } from '../bitbucket/api/repositories.js';
import type { Config, McpToolResult } from '@types';

function textResult(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResult(code: string, message: string): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: { code, message } }) }], isError: true };
}

export function createRepoTools(repoApi: RepositoryApi, config: Config, cache: Cache) {
  return {
    bitbucket_list_projects: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'read_project');
        const input = z.object({
          limit: z.coerce.number().int().positive().optional(),
          start: z.coerce.number().int().nonnegative().optional(),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_list_projects' });

        const ck = cacheKey(config.bitbucketUrl, 'projects', `${input.limit ?? 25}:${input.start ?? 0}`);
        const cached = cache.get(ck);
        if (cached) {
          log('info', 'tool end (cached)', { toolName: 'bitbucket_list_projects', durationMs: Date.now() - start });
          return textResult(cached);
        }

        const result = await repoApi.listProjects(input.limit, input.start);
        cache.set(ck, result, config.cache.ttlRepos as number);
        log('info', 'tool end', { toolName: 'bitbucket_list_projects', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_list_projects', error: String(err), durationMs: Date.now() - start });
        return errorResult('LIST_PROJECTS_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_list_repositories: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'read_repo');
        const input = z.object({
          project: z.string().min(1),
          limit: z.coerce.number().int().positive().optional(),
          start: z.coerce.number().int().nonnegative().optional(),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_list_repositories' });

        const ck = cacheKey(config.bitbucketUrl, 'repos', `${input.project}:${input.limit ?? 25}:${input.start ?? 0}`);
        const cached = cache.get(ck);
        if (cached) {
          log('info', 'tool end (cached)', { toolName: 'bitbucket_list_repositories', durationMs: Date.now() - start });
          return textResult(cached);
        }

        const result = await repoApi.listRepositories(input.project, input.limit, input.start);
        cache.set(ck, result, config.cache.ttlRepos as number);
        log('info', 'tool end', { toolName: 'bitbucket_list_repositories', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_list_repositories', error: String(err), durationMs: Date.now() - start });
        return errorResult('LIST_REPOS_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_get_repository: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'read_repo');
        const input = z.object({
          project: z.string().min(1),
          repo: z.string().min(1),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_get_repository' });

        const ck = cacheKey(config.bitbucketUrl, 'repo', `${input.project}/${input.repo}`);
        const cached = cache.get(ck);
        if (cached) {
          log('info', 'tool end (cached)', { toolName: 'bitbucket_get_repository', durationMs: Date.now() - start });
          return textResult(cached);
        }

        const result = await repoApi.getRepository(input.project, input.repo);
        cache.set(ck, result, config.cache.ttlRepoMeta as number);
        log('info', 'tool end', { toolName: 'bitbucket_get_repository', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_get_repository', error: String(err), durationMs: Date.now() - start });
        return errorResult('GET_REPO_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_get_branches: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'read_repo');
        const input = z.object({
          project: z.string().min(1),
          repo: z.string().min(1),
          limit: z.coerce.number().int().positive().optional(),
          start: z.coerce.number().int().nonnegative().optional(),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_get_branches' });
        const result = await repoApi.getBranches(input.project, input.repo, input.limit, input.start);
        log('info', 'tool end', { toolName: 'bitbucket_get_branches', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_get_branches', error: String(err), durationMs: Date.now() - start });
        return errorResult('GET_BRANCHES_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_get_commits: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'read_repo');
        const input = z.object({
          project: z.string().min(1),
          repo: z.string().min(1),
          limit: z.coerce.number().int().positive().optional(),
          start: z.coerce.number().int().nonnegative().optional(),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_get_commits' });
        const result = await repoApi.getCommits(input.project, input.repo, input.limit, input.start);
        log('info', 'tool end', { toolName: 'bitbucket_get_commits', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_get_commits', error: String(err), durationMs: Date.now() - start });
        return errorResult('GET_COMMITS_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_get_file_content: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'read_repo');
        const input = z.object({
          project: z.string().min(1),
          repo: z.string().min(1),
          path: z.string().min(1),
          ref: z.string().optional(),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_get_file_content' });
        const result = await repoApi.getFileContent(input.project, input.repo, input.path, input.ref);
        log('info', 'tool end', { toolName: 'bitbucket_get_file_content', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_get_file_content', error: String(err), durationMs: Date.now() - start });
        return errorResult('GET_FILE_FAILED', err instanceof Error ? err.message : String(err));
      }
    },
  };
}
