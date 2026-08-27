/*
 * Tool registry — the single source of truth pairing each MCP tool's
 * name, description, input shape, and handler.
 *
 * `server.ts` iterates this list once and calls `server.tool(...)` per entry.
 * Adding a tool is a single diff here; no edits to `server.ts`.
 */

import {
  addPrCommentShape,
  addPrInlineCommentShape,
  createPrTaskShape,
  deletePrTaskShape,
  discardPrReviewShape,
  getFileContentShape,
  getPrReviewShape,
  listProjectsShape,
  listPullRequestsShape,
  listTasksShape,
  prPaginatedShape,
  prRefShape,
  projectListShape,
  publishPrReviewShape,
  replyToCommentShape,
  repoPaginatedShape,
  repoRefShape,
  resolveCommentShape,
  resolvePrTaskShape,
  searchCodeShape,
  searchCommitsShape,
  startPrReviewShape,
  updateCommentShape,
  updatePullRequestShape,
} from './schemas.js';

import type { createPrTools } from './pr-tools.js';
import type { createRepoTools } from './repo-tools.js';
import type { createSearchTools } from './search-tools.js';
import type { McpToolResult } from '@types';
import type { ZodRawShape } from 'zod';

/** Bundle of instantiated tool handler factories consumed by the registry. */
export type ToolHandlers = {
  readonly pr: ReturnType<typeof createPrTools>;
  readonly repo: ReturnType<typeof createRepoTools>;
  readonly search: ReturnType<typeof createSearchTools>;
};

/** Declarative tool definition — consumed by server.ts to register with MCP. */
export type ToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly shape: ZodRawShape;
  readonly handler: (args: unknown) => Promise<McpToolResult>;
};

/**
 * Build the full MCP tool registry.
 *
 * Tools are ordered by category (PR, Repo, Search) to match existing
 * documentation and mental grouping; the order does not affect runtime.
 */
export function buildToolRegistry(h: ToolHandlers): ReadonlyArray<ToolDefinition> {
  return [
    // --- Pull Request tools ---
    {
      name: 'bitbucket_list_pull_requests',
      description: 'List pull requests for a repository',
      shape: listPullRequestsShape,
      handler: h.pr.bitbucket_list_pull_requests,
    },
    {
      name: 'bitbucket_get_pull_request',
      description: 'Get detailed pull request information',
      shape: prRefShape,
      handler: h.pr.bitbucket_get_pull_request,
    },
    {
      name: 'bitbucket_get_pr_diff',
      description: 'Get pull request diff/changes',
      shape: prRefShape,
      handler: h.pr.bitbucket_get_pr_diff,
    },
    {
      name: 'bitbucket_get_pr_commits',
      description: 'Get commits in a pull request',
      shape: prPaginatedShape,
      handler: h.pr.bitbucket_get_pr_commits,
    },
    {
      name: 'bitbucket_get_pr_activities',
      description: 'Get pull request comments and activities',
      shape: prPaginatedShape,
      handler: h.pr.bitbucket_get_pr_activities,
    },
    {
      name: 'bitbucket_add_pr_comment',
      description:
        'Add a general comment to a pull request; set pending: true to queue it in the current review session instead of posting it immediately',
      shape: addPrCommentShape,
      handler: h.pr.bitbucket_add_pr_comment,
    },
    {
      name: 'bitbucket_add_pr_inline_comment',
      description:
        "Add a per-file, per-line inline code comment on any author's pull request; set pending: true to queue it in the current review session",
      shape: addPrInlineCommentShape,
      handler: h.pr.bitbucket_add_pr_inline_comment,
    },
    {
      name: 'bitbucket_reply_to_comment',
      description:
        'Reply to a comment on a pull request; set pending: true to queue the reply in the current review session',
      shape: replyToCommentShape,
      handler: h.pr.bitbucket_reply_to_comment,
    },
    {
      name: 'bitbucket_resolve_comment',
      description: 'Resolve a comment thread on a pull request',
      shape: resolveCommentShape,
      handler: h.pr.bitbucket_resolve_comment,
    },
    {
      name: 'bitbucket_update_comment',
      description: 'Edit a comment on a pull request',
      shape: updateCommentShape,
      handler: h.pr.bitbucket_update_comment,
    },
    {
      name: 'bitbucket_update_pull_request',
      description:
        'Update PR title and/or description (Server/DC, auto-preserves reviewers, version optional)',
      shape: updatePullRequestShape,
      handler: h.pr.bitbucket_update_pull_request,
    },
    {
      name: 'bitbucket_approve_pr',
      description: 'Approve a pull request',
      shape: prRefShape,
      handler: h.pr.bitbucket_approve_pr,
    },
    {
      name: 'bitbucket_create_pr_task',
      description:
        'Create a checklist task (blocker) on a pull request, optionally as a reply to an existing comment; set pending: true to queue it in the current review session',
      shape: createPrTaskShape,
      handler: h.pr.bitbucket_create_pr_task,
    },
    {
      name: 'bitbucket_list_pr_tasks',
      description:
        'List all BLOCKER-severity tasks (comments) for a pull request, with optional state filter (OPEN, RESOLVED, or ALL)',
      shape: listTasksShape,
      handler: h.pr.bitbucket_list_pr_tasks,
    },
    {
      name: 'bitbucket_resolve_pr_task',
      description: 'Set a pull request task to OPEN or RESOLVED',
      shape: resolvePrTaskShape,
      handler: h.pr.bitbucket_resolve_pr_task,
    },
    {
      name: 'bitbucket_delete_pr_task',
      description: 'Delete a pull request task',
      shape: deletePrTaskShape,
      handler: h.pr.bitbucket_delete_pr_task,
    },

    // --- PR review sessions (batched review, Server/DC 7.7+) ---
    {
      name: 'bitbucket_start_pr_review',
      description:
        'Begin a batched review of a pull request: reports any comments already pending in your review session and how to add more. Bitbucket opens the session on the first pending comment, so no state is created here',
      shape: startPrReviewShape,
      handler: h.pr.bitbucket_start_pr_review,
    },
    {
      name: 'bitbucket_get_pr_review',
      description:
        'List the pending, unpublished comments in your current review session for a pull request (visible only to you until published)',
      shape: getPrReviewShape,
      handler: h.pr.bitbucket_get_pr_review,
    },
    {
      name: 'bitbucket_publish_pr_review',
      description:
        'Publish every pending comment in your review session in one batch, optionally with an overview comment and a reviewer verdict (UNAPPROVED, NEEDS_WORK, APPROVED)',
      shape: publishPrReviewShape,
      handler: h.pr.bitbucket_publish_pr_review,
    },
    {
      name: 'bitbucket_discard_pr_review',
      description:
        'Discard your review session: deletes every pending comment on the pull request without notifying the author',
      shape: discardPrReviewShape,
      handler: h.pr.bitbucket_discard_pr_review,
    },

    // --- Repository tools ---
    {
      name: 'bitbucket_list_projects',
      description: 'List accessible Bitbucket projects',
      shape: listProjectsShape,
      handler: h.repo.bitbucket_list_projects,
    },
    {
      name: 'bitbucket_list_repositories',
      description: 'List repositories in a project',
      shape: projectListShape,
      handler: h.repo.bitbucket_list_repositories,
    },
    {
      name: 'bitbucket_get_repository',
      description: 'Get repository details',
      shape: repoRefShape,
      handler: h.repo.bitbucket_get_repository,
    },
    {
      name: 'bitbucket_get_branches',
      description: 'List repository branches',
      shape: repoPaginatedShape,
      handler: h.repo.bitbucket_get_branches,
    },
    {
      name: 'bitbucket_get_commits',
      description: 'Get commit history for a repository',
      shape: repoPaginatedShape,
      handler: h.repo.bitbucket_get_commits,
    },
    {
      name: 'bitbucket_get_file_content',
      description: 'Get file content at a specific ref',
      shape: getFileContentShape,
      handler: h.repo.bitbucket_get_file_content,
    },

    // --- Search tools ---
    {
      name: 'bitbucket_search_code',
      description: 'Search code across repositories in a project',
      shape: searchCodeShape,
      handler: h.search.bitbucket_search_code,
    },
    {
      name: 'bitbucket_search_commits',
      description: 'Search commits by message',
      shape: searchCommitsShape,
      handler: h.search.bitbucket_search_commits,
    },
  ];
}
