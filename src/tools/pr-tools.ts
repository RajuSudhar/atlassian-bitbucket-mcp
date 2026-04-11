/*
 * Pull Request MCP tools
 */

import { z } from 'zod';

import { log } from '../logger.js';
import { requirePermission } from '../permissions.js';

import type { Cache } from '../cache.js';
import type { PullRequestApi } from '../bitbucket/api/pull-requests.js';
import type { Config, McpToolResult } from '@types';

const projectRepoSchema = z.object({
  project: z.string().min(1),
  repo: z.string().min(1),
});

const prIdSchema = projectRepoSchema.extend({
  prId: z.coerce.number().int().positive(),
});

function textResult(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResult(code: string, message: string): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: { code, message } }) }], isError: true };
}

export function createPrTools(prApi: PullRequestApi, config: Config, cache: Cache) {
  return {
    bitbucket_list_pull_requests: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'read_pr');
        const input = projectRepoSchema.extend({
          state: z.string().optional(),
          limit: z.coerce.number().int().positive().optional(),
          start: z.coerce.number().int().nonnegative().optional(),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_list_pull_requests' });
        const result = await prApi.list(input.project, input.repo, input.state, input.limit, input.start);
        log('info', 'tool end', { toolName: 'bitbucket_list_pull_requests', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_list_pull_requests', error: String(err), durationMs: Date.now() - start });
        return errorResult('LIST_PR_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_get_pull_request: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'read_pr');
        const input = prIdSchema.parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_get_pull_request' });
        const result = await prApi.get(input.project, input.repo, input.prId);
        log('info', 'tool end', { toolName: 'bitbucket_get_pull_request', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_get_pull_request', error: String(err), durationMs: Date.now() - start });
        return errorResult('GET_PR_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_get_pr_diff: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'read_pr');
        const input = prIdSchema.parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_get_pr_diff' });
        const result = await prApi.getDiff(input.project, input.repo, input.prId);
        log('info', 'tool end', { toolName: 'bitbucket_get_pr_diff', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_get_pr_diff', error: String(err), durationMs: Date.now() - start });
        return errorResult('GET_PR_DIFF_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_get_pr_commits: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'read_pr');
        const input = prIdSchema.extend({
          limit: z.coerce.number().int().positive().optional(),
          start: z.coerce.number().int().nonnegative().optional(),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_get_pr_commits' });
        const result = await prApi.getCommits(input.project, input.repo, input.prId, input.limit, input.start);
        log('info', 'tool end', { toolName: 'bitbucket_get_pr_commits', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_get_pr_commits', error: String(err), durationMs: Date.now() - start });
        return errorResult('GET_PR_COMMITS_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_get_pr_activities: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'read_pr');
        const input = prIdSchema.extend({
          limit: z.coerce.number().int().positive().optional(),
          start: z.coerce.number().int().nonnegative().optional(),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_get_pr_activities' });
        const result = await prApi.getActivities(input.project, input.repo, input.prId, input.limit, input.start);
        log('info', 'tool end', { toolName: 'bitbucket_get_pr_activities', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_get_pr_activities', error: String(err), durationMs: Date.now() - start });
        return errorResult('GET_PR_ACTIVITIES_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_add_pr_comment: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'write_pr');
        const input = prIdSchema.extend({ text: z.string().min(1) }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_add_pr_comment' });
        const result = await prApi.addComment(input.project, input.repo, input.prId, input.text);
        cache.invalidate(`${config.bitbucketUrl}:pr:${input.project}/${input.repo}/${input.prId}`);
        log('info', 'tool end', { toolName: 'bitbucket_add_pr_comment', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_add_pr_comment', error: String(err), durationMs: Date.now() - start });
        return errorResult('ADD_COMMENT_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_add_pr_inline_comment: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'write_pr');
        const input = prIdSchema.extend({
          text: z.string().min(1),
          path: z.string().min(1),
          line: z.coerce.number().int().positive(),
          lineType: z.enum(['ADDED', 'REMOVED', 'CONTEXT']),
          fileType: z.enum(['FROM', 'TO']).optional(),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_add_pr_inline_comment' });
        const result = await prApi.addInlineComment(input.project, input.repo, input.prId, input.text, {
          path: input.path,
          line: input.line,
          lineType: input.lineType,
          fileType: input.fileType,
        });
        cache.invalidate(`${config.bitbucketUrl}:pr:${input.project}/${input.repo}/${input.prId}`);
        log('info', 'tool end', { toolName: 'bitbucket_add_pr_inline_comment', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_add_pr_inline_comment', error: String(err), durationMs: Date.now() - start });
        return errorResult('ADD_INLINE_COMMENT_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_reply_to_comment: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'write_pr');
        const input = prIdSchema.extend({
          commentId: z.coerce.number().int().positive(),
          text: z.string().min(1),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_reply_to_comment' });
        const result = await prApi.replyToComment(input.project, input.repo, input.prId, input.commentId, input.text);
        cache.invalidate(`${config.bitbucketUrl}:pr:${input.project}/${input.repo}/${input.prId}`);
        log('info', 'tool end', { toolName: 'bitbucket_reply_to_comment', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_reply_to_comment', error: String(err), durationMs: Date.now() - start });
        return errorResult('REPLY_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_resolve_comment: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'manage_pr');
        const input = prIdSchema.extend({
          commentId: z.coerce.number().int().positive(),
          version: z.coerce.number().int().nonnegative(),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_resolve_comment' });
        const result = await prApi.resolveComment(input.project, input.repo, input.prId, input.commentId, input.version);
        cache.invalidate(`${config.bitbucketUrl}:pr:${input.project}/${input.repo}/${input.prId}`);
        log('info', 'tool end', { toolName: 'bitbucket_resolve_comment', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_resolve_comment', error: String(err), durationMs: Date.now() - start });
        return errorResult('RESOLVE_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_update_comment: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'write_pr');
        const input = prIdSchema.extend({
          commentId: z.coerce.number().int().positive(),
          text: z.string().min(1),
          version: z.coerce.number().int().nonnegative(),
        }).parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_update_comment' });
        const result = await prApi.updateComment(input.project, input.repo, input.prId, input.commentId, input.text, input.version);
        cache.invalidate(`${config.bitbucketUrl}:pr:${input.project}/${input.repo}/${input.prId}`);
        log('info', 'tool end', { toolName: 'bitbucket_update_comment', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_update_comment', error: String(err), durationMs: Date.now() - start });
        return errorResult('UPDATE_COMMENT_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_approve_pr: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        requirePermission(config, 'manage_pr');
        const input = prIdSchema.parse(args);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_approve_pr' });
        const result = await prApi.approve(input.project, input.repo, input.prId);
        cache.invalidate(`${config.bitbucketUrl}:pr:${input.project}/${input.repo}/${input.prId}`);
        log('info', 'tool end', { toolName: 'bitbucket_approve_pr', durationMs: Date.now() - start });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', { toolName: 'bitbucket_approve_pr', error: String(err), durationMs: Date.now() - start });
        return errorResult('APPROVE_FAILED', err instanceof Error ? err.message : String(err));
      }
    },
  };
}
