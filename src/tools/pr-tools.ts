/*
 * Pull Request MCP tools
 */

import { z } from 'zod';

import { log } from '../logger.js';
import { requirePermission, requireScope } from '../permissions.js';
import {
  addPrCommentShape,
  addPrInlineCommentShape,
  discardPrReviewShape,
  getPrReviewShape,
  listPullRequestsShape,
  prPaginatedShape,
  prRefShape,
  publishPrReviewShape,
  replyToCommentShape,
  resolveCommentShape,
  startPrReviewShape,
  updateCommentShape,
  updatePullRequestShape,
} from './schemas.js';

import type { PullRequestApi } from '../bitbucket/api/pull-requests.js';
import type { Cache } from '../cache.js';
import type { Config, McpToolResult } from '@types';

function textResult(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResult(code: string, message: string): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: { code, message } }) }],
    isError: true,
  };
}

function invalidatePrCache(
  cache: Cache,
  config: Config,
  project: string,
  repo: string,
  prId: number
): void {
  cache.invalidate(`${config.bitbucketUrl}:pr:${project}/${repo}/${prId}`);
}

export function createPrTools(prApi: PullRequestApi, config: Config, cache: Cache) {
  return {
    bitbucket_list_pull_requests: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(listPullRequestsShape).parse(args);
        requirePermission(config, 'read_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_list_pull_requests',
        });
        const result = await prApi.list(
          input.project,
          input.repo,
          input.state,
          input.limit,
          input.start
        );
        log('info', 'tool end', {
          toolName: 'bitbucket_list_pull_requests',
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_list_pull_requests',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult('LIST_PR_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_get_pull_request: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(prRefShape).parse(args);
        requirePermission(config, 'read_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_get_pull_request',
        });
        const result = await prApi.get(input.project, input.repo, input.prId);
        log('info', 'tool end', {
          toolName: 'bitbucket_get_pull_request',
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_get_pull_request',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult('GET_PR_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_get_pr_diff: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(prRefShape).parse(args);
        requirePermission(config, 'read_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_get_pr_diff' });
        const result = await prApi.getDiff(input.project, input.repo, input.prId);
        log('info', 'tool end', {
          toolName: 'bitbucket_get_pr_diff',
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_get_pr_diff',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult('GET_PR_DIFF_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_get_pr_commits: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(prPaginatedShape).parse(args);
        requirePermission(config, 'read_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_get_pr_commits',
        });
        const result = await prApi.getCommits(
          input.project,
          input.repo,
          input.prId,
          input.limit,
          input.start
        );
        log('info', 'tool end', {
          toolName: 'bitbucket_get_pr_commits',
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_get_pr_commits',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult(
          'GET_PR_COMMITS_FAILED',
          err instanceof Error ? err.message : String(err)
        );
      }
    },

    bitbucket_get_pr_activities: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(prPaginatedShape).parse(args);
        requirePermission(config, 'read_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_get_pr_activities',
        });
        const result = await prApi.getActivities(
          input.project,
          input.repo,
          input.prId,
          input.limit,
          input.start
        );
        log('info', 'tool end', {
          toolName: 'bitbucket_get_pr_activities',
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_get_pr_activities',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult(
          'GET_PR_ACTIVITIES_FAILED',
          err instanceof Error ? err.message : String(err)
        );
      }
    },

    bitbucket_add_pr_comment: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(addPrCommentShape).parse(args);
        requirePermission(config, 'write_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_add_pr_comment',
        });
        const result = await prApi.addComment(
          input.project,
          input.repo,
          input.prId,
          input.text,
          input.pending
        );
        invalidatePrCache(cache, config, input.project, input.repo, input.prId);
        log('info', 'tool end', {
          toolName: 'bitbucket_add_pr_comment',
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_add_pr_comment',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult('ADD_COMMENT_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_add_pr_inline_comment: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(addPrInlineCommentShape).parse(args);
        requirePermission(config, 'write_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_add_pr_inline_comment',
        });
        const result = await prApi.addInlineComment(
          input.project,
          input.repo,
          input.prId,
          input.text,
          {
            path: input.path,
            line: input.line,
            lineType: input.lineType,
            fileType: input.fileType,
            diffType: input.diffType,
          },
          input.pending
        );
        invalidatePrCache(cache, config, input.project, input.repo, input.prId);
        log('info', 'tool end', {
          toolName: 'bitbucket_add_pr_inline_comment',
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_add_pr_inline_comment',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult(
          'ADD_INLINE_COMMENT_FAILED',
          err instanceof Error ? err.message : String(err)
        );
      }
    },

    bitbucket_reply_to_comment: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(replyToCommentShape).parse(args);
        requirePermission(config, 'write_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_reply_to_comment',
        });
        const result = await prApi.replyToComment(
          input.project,
          input.repo,
          input.prId,
          input.commentId,
          input.text,
          input.pending
        );
        invalidatePrCache(cache, config, input.project, input.repo, input.prId);
        log('info', 'tool end', {
          toolName: 'bitbucket_reply_to_comment',
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_reply_to_comment',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult('REPLY_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_resolve_comment: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(resolveCommentShape).parse(args);
        requirePermission(config, 'manage_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_resolve_comment',
        });
        const result = await prApi.resolveComment(
          input.project,
          input.repo,
          input.prId,
          input.commentId,
          input.version
        );
        invalidatePrCache(cache, config, input.project, input.repo, input.prId);
        log('info', 'tool end', {
          toolName: 'bitbucket_resolve_comment',
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_resolve_comment',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult('RESOLVE_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_update_comment: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(updateCommentShape).parse(args);
        requirePermission(config, 'write_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_update_comment',
        });
        const result = await prApi.updateComment(
          input.project,
          input.repo,
          input.prId,
          input.commentId,
          input.text,
          input.version
        );
        invalidatePrCache(cache, config, input.project, input.repo, input.prId);
        log('info', 'tool end', {
          toolName: 'bitbucket_update_comment',
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_update_comment',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult(
          'UPDATE_COMMENT_FAILED',
          err instanceof Error ? err.message : String(err)
        );
      }
    },

    bitbucket_update_pull_request: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z
          .object(updatePullRequestShape)
          .refine((data) => data.title !== undefined || data.description !== undefined, {
            message: 'At least one of title or description must be provided',
          })
          .parse(args);
        requirePermission(config, 'write_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_update_pull_request',
        });
        const result = await prApi.updatePullRequest(input.project, input.repo, input.prId, {
          title: input.title,
          description: input.description,
          version: input.version,
        });
        invalidatePrCache(cache, config, input.project, input.repo, input.prId);
        log('info', 'tool end', {
          toolName: 'bitbucket_update_pull_request',
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_update_pull_request',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult(
          'UPDATE_PULL_REQUEST_FAILED',
          err instanceof Error ? err.message : String(err)
        );
      }
    },

    bitbucket_start_pr_review: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(startPrReviewShape).parse(args);
        requirePermission(config, 'read_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_start_pr_review',
        });
        // Bitbucket has no "start review" call — the session opens server-side
        // on the first pending comment. Report what is already in the session
        // so a caller resuming an abandoned review sees it before adding more.
        const review = await prApi.getReview(input.project, input.repo, input.prId);
        log('info', 'tool end', {
          toolName: 'bitbucket_start_pr_review',
          pendingThreadCount: review.values.length,
          durationMs: Date.now() - start,
        });
        return textResult({
          project: input.project,
          repo: input.repo,
          prId: input.prId,
          sessionActive: review.values.length > 0,
          pendingThreadCount: review.values.length,
          pendingThreads: review.values,
          next: [
            'Add feedback with pending: true on bitbucket_add_pr_comment, ' +
              'bitbucket_add_pr_inline_comment, bitbucket_reply_to_comment or bitbucket_create_pr_task.',
            'Review what is queued with bitbucket_get_pr_review.',
            'Send it to the author with bitbucket_publish_pr_review, or drop it with bitbucket_discard_pr_review.',
          ],
        });
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_start_pr_review',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult('START_REVIEW_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_get_pr_review: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(getPrReviewShape).parse(args);
        requirePermission(config, 'read_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_get_pr_review',
        });
        const result = await prApi.getReview(
          input.project,
          input.repo,
          input.prId,
          input.limit,
          input.start
        );
        log('info', 'tool end', {
          toolName: 'bitbucket_get_pr_review',
          pendingThreadCount: result.values.length,
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_get_pr_review',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult('GET_REVIEW_FAILED', err instanceof Error ? err.message : String(err));
      }
    },

    bitbucket_publish_pr_review: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(publishPrReviewShape).parse(args);
        requirePermission(config, 'write_pr');
        // Setting a verdict while publishing changes the caller's approval
        // state, so it carries the same gate as bitbucket_approve_pr.
        if (input.participantStatus !== undefined) {
          requirePermission(config, 'manage_pr');
        }
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_publish_pr_review',
          participantStatus: input.participantStatus,
        });
        const result = await prApi.publishReview(input.project, input.repo, input.prId, {
          commentText: input.commentText,
          participantStatus: input.participantStatus,
        });
        invalidatePrCache(cache, config, input.project, input.repo, input.prId);
        log('info', 'tool end', {
          toolName: 'bitbucket_publish_pr_review',
          publishedCommentCount: result.publishedCommentCount,
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_publish_pr_review',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult(
          'PUBLISH_REVIEW_FAILED',
          err instanceof Error ? err.message : String(err)
        );
      }
    },

    bitbucket_discard_pr_review: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(discardPrReviewShape).parse(args);
        requirePermission(config, 'write_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', {
          operation: 'tool_execute',
          toolName: 'bitbucket_discard_pr_review',
        });
        await prApi.discardReview(input.project, input.repo, input.prId);
        invalidatePrCache(cache, config, input.project, input.repo, input.prId);
        log('info', 'tool end', {
          toolName: 'bitbucket_discard_pr_review',
          durationMs: Date.now() - start,
        });
        return textResult({ discarded: true, prId: input.prId });
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_discard_pr_review',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult(
          'DISCARD_REVIEW_FAILED',
          err instanceof Error ? err.message : String(err)
        );
      }
    },

    bitbucket_approve_pr: async (args: unknown): Promise<McpToolResult> => {
      const start = Date.now();
      try {
        const input = z.object(prRefShape).parse(args);
        requirePermission(config, 'manage_pr');
        requireScope(config, input.project, input.repo);
        log('info', 'tool start', { operation: 'tool_execute', toolName: 'bitbucket_approve_pr' });
        const result = await prApi.approve(input.project, input.repo, input.prId);
        invalidatePrCache(cache, config, input.project, input.repo, input.prId);
        log('info', 'tool end', {
          toolName: 'bitbucket_approve_pr',
          durationMs: Date.now() - start,
        });
        return textResult(result);
      } catch (err) {
        log('error', 'tool error', {
          toolName: 'bitbucket_approve_pr',
          error: String(err),
          durationMs: Date.now() - start,
        });
        return errorResult('APPROVE_FAILED', err instanceof Error ? err.message : String(err));
      }
    },
  };
}
