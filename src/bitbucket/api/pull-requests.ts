/*
 * Pull Request API operations
 *
 * NOTE: These paths target Server/DC (/projects/{key}/repos/{slug}/pull-requests).
 * Cloud uses /repositories/{workspace}/{repo_slug}/pullrequests with different
 * parameter shapes. Cloud-specific routing is deferred to feat-cloud-vs-server
 * follow-up; until then, Cloud instances will error at the API layer.
 */

import { log } from '../../logger.js';
import { BitbucketApiError } from '../errors.js';

import type { BitbucketClient } from '../client.js';
import type {
  BitbucketActivity,
  BitbucketComment,
  BitbucketCommit,
  BitbucketDiff,
  BitbucketPagedResponse,
  BitbucketParticipantStatus,
  BitbucketPublishReviewResult,
  BitbucketTaskState,
  PullRequest,
} from '@types';

/**
 * Comment state that puts a comment into the caller's unpublished review
 * ("Start review" in the UI). Server/DC 7.7+. Omitting it publishes the
 * comment immediately, which is the historical behaviour of every tool here.
 */
const PENDING_STATE = 'PENDING' as const;

export class PullRequestApi {
  constructor(private readonly client: BitbucketClient) {}

  async list(
    project: string,
    repo: string,
    state?: string,
    limit = 25,
    start = 0
  ): Promise<BitbucketPagedResponse<PullRequest>> {
    return this.client.requestJson<BitbucketPagedResponse<PullRequest>>(
      `/projects/${project}/repos/${repo}/pull-requests`,
      { queryParams: { state, limit, start } }
    );
  }

  async get(project: string, repo: string, prId: number): Promise<PullRequest> {
    return this.client.requestJson<PullRequest>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}`
    );
  }

  async getDiff(project: string, repo: string, prId: number): Promise<BitbucketDiff> {
    return this.client.requestJson<BitbucketDiff>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/diff`
    );
  }

  async getCommits(
    project: string,
    repo: string,
    prId: number,
    limit = 25,
    start = 0
  ): Promise<BitbucketPagedResponse<BitbucketCommit>> {
    return this.client.requestJson<BitbucketPagedResponse<BitbucketCommit>>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/commits`,
      { queryParams: { limit, start } }
    );
  }

  async getActivities(
    project: string,
    repo: string,
    prId: number,
    limit = 25,
    start = 0
  ): Promise<BitbucketPagedResponse<BitbucketActivity>> {
    return this.client.requestJson<BitbucketPagedResponse<BitbucketActivity>>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/activities`,
      { queryParams: { limit, start } }
    );
  }

  /** `pending: true` holds the comment in the caller's unpublished review. */
  async addComment(
    project: string,
    repo: string,
    prId: number,
    text: string,
    pending = false
  ): Promise<BitbucketComment> {
    return this.client.requestJson<BitbucketComment>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/comments`,
      { method: 'POST', body: { text, ...(pending ? { state: PENDING_STATE } : {}) } }
    );
  }

  /** `pending: true` holds the comment in the caller's unpublished review. */
  async addInlineComment(
    project: string,
    repo: string,
    prId: number,
    text: string,
    anchor: {
      path: string;
      line: number;
      lineType: string;
      fileType?: string;
      diffType?: string;
    },
    pending = false
  ): Promise<BitbucketComment> {
    // `diffType: EFFECTIVE` anchors the comment against the PR's overall diff
    // (the default view). Server/DC drops inline comments whose anchor omits it
    // when the PR spans multiple commits, so default it here.
    const resolvedAnchor = { ...anchor, diffType: anchor.diffType ?? 'EFFECTIVE' };
    return this.client.requestJson<BitbucketComment>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/comments`,
      {
        method: 'POST',
        body: {
          text,
          anchor: resolvedAnchor,
          ...(pending ? { state: PENDING_STATE } : {}),
        },
      }
    );
  }

  /** `pending: true` holds the reply in the caller's unpublished review. */
  async replyToComment(
    project: string,
    repo: string,
    prId: number,
    commentId: number,
    text: string,
    pending = false
  ): Promise<BitbucketComment> {
    return this.client.requestJson<BitbucketComment>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/comments`,
      {
        method: 'POST',
        body: {
          text,
          parent: { id: commentId },
          ...(pending ? { state: PENDING_STATE } : {}),
        },
      }
    );
  }

  async resolveComment(
    project: string,
    repo: string,
    prId: number,
    commentId: number,
    version: number
  ): Promise<BitbucketComment> {
    return this.client.requestJson<BitbucketComment>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/comments/${commentId}`,
      { method: 'PUT', body: { state: 'RESOLVED', version } }
    );
  }

  async updateComment(
    project: string,
    repo: string,
    prId: number,
    commentId: number,
    text: string,
    version: number
  ): Promise<BitbucketComment> {
    return this.client.requestJson<BitbucketComment>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/comments/${commentId}`,
      { method: 'PUT', body: { text, version } }
    );
  }

  async updatePullRequest(
    project: string,
    repo: string,
    prId: number,
    updates: { title?: string; description?: string; version?: number }
  ): Promise<PullRequest> {
    const currentPr = await this.get(project, repo, prId);

    // Helper to build the PUT body from a PR snapshot, applying caller overrides
    // for title and description while using echoed fields from the snapshot.
    // The version is passed explicitly to allow first attempt to use updates.version,
    // and retry to use the fresh snapshot's version.
    const buildUpdateBody = (pr: PullRequest, version: number): Record<string, unknown> => {
      const body: Record<string, unknown> = {
        id: pr.id,
        version,
        title: updates.title ?? pr.title,
        toRef: pr.toRef,
        reviewers: pr.reviewers ?? [],
      };

      // Only include description if it resolves to a defined value
      const resolvedDescription = updates.description ?? pr.description;
      if (resolvedDescription !== undefined) {
        body.description = resolvedDescription;
      }

      return body;
    };

    try {
      const body = buildUpdateBody(currentPr, updates.version ?? currentPr.version);
      return await this.client.requestJson<PullRequest>(
        `/projects/${project}/repos/${repo}/pull-requests/${prId}`,
        { method: 'PUT', body }
      );
    } catch (err) {
      if (err instanceof BitbucketApiError && err.statusCode === 409) {
        log('warn', 'pr update conflict, retrying', {
          operation: 'updatePullRequest',
          project,
          repo,
          prId,
          reviewersPreservedCount: (currentPr.reviewers ?? []).length,
        });
        const freshPr = await this.get(project, repo, prId);
        const body = buildUpdateBody(freshPr, freshPr.version);
        return await this.client.requestJson<PullRequest>(
          `/projects/${project}/repos/${repo}/pull-requests/${prId}`,
          { method: 'PUT', body }
        );
      }
      throw err;
    }
  }

  async approve(project: string, repo: string, prId: number): Promise<BitbucketComment> {
    return this.client.requestJson<BitbucketComment>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/approve`,
      { method: 'POST' }
    );
  }

  // Bitbucket Server/DC deprecated the legacy `/tasks` resource in favor of
  // modeling tasks as comments with severity BLOCKER (confirmed live: the
  // legacy endpoint 400s with "Tasks are now managed using Comments with
  // severity BLOCKER"). A "task" is therefore just a comment whose severity
  // is BLOCKER; state transitions and deletion reuse the comment resource.
  /** `pending: true` holds the task in the caller's unpublished review. */
  async createTask(
    project: string,
    repo: string,
    prId: number,
    text: string,
    parentCommentId?: number,
    pending = false
  ): Promise<BitbucketComment> {
    return this.client.requestJson<BitbucketComment>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/comments`,
      {
        method: 'POST',
        body: {
          text,
          severity: 'BLOCKER',
          ...(parentCommentId !== undefined ? { parent: { id: parentCommentId } } : {}),
          ...(pending ? { state: PENDING_STATE } : {}),
        },
      }
    );
  }

  /** Blocker-severity comments (tasks), fetched via dedicated blocker-comments endpoint with pagination. */
  async listTasks(
    project: string,
    repo: string,
    prId: number,
    state?: 'OPEN' | 'RESOLVED',
    limit = 25,
    start = 0
  ): Promise<BitbucketComment[]> {
    const MAX_PAGES = 100;

    log('debug', 'listTasks start', {
      operation: 'list_blocker_comments',
      project,
      repo,
      prId,
      state: state ?? 'ALL',
      limit,
    });

    const allTasks: BitbucketComment[] = [];
    let currentStart = start;
    let isLastPage = false;
    let pageCount = 0;

    while (!isLastPage) {
      if (pageCount >= MAX_PAGES) {
        log('warn', 'listTasks pagination circuit breaker triggered', {
          operation: 'list_blocker_comments',
          maxPages: MAX_PAGES,
          currentPage: pageCount,
          issue: 'max page limit reached, terminating loop',
        });
        break;
      }

      const queryParams: Record<string, string | number> = { limit, start: currentStart };
      if (state !== undefined) {
        queryParams.state = state;
      }

      const page = await this.client.requestJson<BitbucketPagedResponse<BitbucketComment>>(
        `/projects/${project}/repos/${repo}/pull-requests/${prId}/blocker-comments`,
        { queryParams }
      );

      pageCount++;
      log('debug', 'listTasks page fetched', {
        operation: 'list_blocker_comments',
        page: pageCount,
        pageSize: page.values.length,
        start: currentStart,
        isLastPage: page.isLastPage,
      });

      allTasks.push(...page.values.filter((comment) => comment.severity === 'BLOCKER'));
      isLastPage = page.isLastPage;
      currentStart = page.nextPageStart ?? currentStart;

      if (!isLastPage && page.nextPageStart === undefined) {
        log('warn', 'listTasks pagination inconsistency', {
          operation: 'list_blocker_comments',
          issue: 'isLastPage=false but nextPageStart undefined, terminating loop',
        });
        break;
      }
    }

    let filtered = allTasks;
    if (state !== undefined) {
      const preFilterCount = filtered.length;
      filtered = filtered.filter((comment) => comment.state === state);
      if (filtered.length < preFilterCount) {
        log('debug', 'listTasks client-side filter applied', {
          operation: 'list_blocker_comments',
          state,
          beforeCount: preFilterCount,
          afterCount: filtered.length,
        });
      }
    }

    log('info', 'listTasks complete', {
      operation: 'list_blocker_comments',
      project,
      repo,
      prId,
      state: state ?? 'ALL',
      totalTasks: filtered.length,
      pagesRead: pageCount,
    });

    return filtered;
  }

  async setTaskState(
    project: string,
    repo: string,
    prId: number,
    commentId: number,
    state: BitbucketTaskState,
    version: number
  ): Promise<BitbucketComment> {
    return this.client.requestJson<BitbucketComment>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/comments/${commentId}`,
      { method: 'PUT', body: { state, version } }
    );
  }

  async deleteTask(
    project: string,
    repo: string,
    prId: number,
    commentId: number,
    version: number
  ): Promise<void> {
    await this.client.request<void>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/comments/${commentId}`,
      { method: 'DELETE', queryParams: { version } }
    );
  }

  // --- Review sessions (batched review) — Server/DC 7.7+ -------------------
  //
  // There is no "start review" endpoint. Bitbucket opens the session the first
  // time the caller creates a comment with `state: PENDING`, and closes it on
  // publish (PUT) or discard (DELETE). The session lives on the server, keyed
  // by (pull request, authenticated user), so it survives MCP restarts and is
  // shared with the Bitbucket web UI.

  /** Comment threads holding the caller's unpublished (PENDING) comments. */
  async getReview(
    project: string,
    repo: string,
    prId: number,
    limit = 25,
    start = 0
  ): Promise<BitbucketPagedResponse<BitbucketComment>> {
    return this.client.requestJson<BitbucketPagedResponse<BitbucketComment>>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/review`,
      { queryParams: { limit, start } }
    );
  }

  /**
   * Publish every PENDING comment in the caller's review in one batch,
   * optionally with an overview comment and a participant status.
   *
   * Atlassian's reference spells the participant status lower-cased
   * (`"approved"`) in its example while every other Bitbucket API spells the
   * enum upper-cased (`APPROVED`). Send the canonical upper-case form and fall
   * back once to the documented lower-case form on 400 — the status this
   * endpoint returns for an invalid participant status.
   */
  async publishReview(
    project: string,
    repo: string,
    prId: number,
    options: { commentText?: string; participantStatus?: BitbucketParticipantStatus } = {}
  ): Promise<BitbucketPublishReviewResult> {
    const endpoint = `/projects/${project}/repos/${repo}/pull-requests/${prId}/review`;

    // The endpoint 400s on a missing body, so always send an object — an empty
    // one publishes the pending comments without touching participant status.
    const buildBody = (participantStatus?: string): Record<string, unknown> => ({
      ...(options.commentText !== undefined ? { commentText: options.commentText } : {}),
      ...(participantStatus !== undefined ? { participantStatus } : {}),
    });

    try {
      return await this.client.requestJson<BitbucketPublishReviewResult>(endpoint, {
        method: 'PUT',
        body: buildBody(options.participantStatus),
      });
    } catch (err) {
      const status = options.participantStatus;
      if (err instanceof BitbucketApiError && err.statusCode === 400 && status !== undefined) {
        log('warn', 'review publish rejected participant status, retrying lower-cased', {
          operation: 'publishReview',
          project,
          repo,
          prId,
          participantStatus: status,
        });
        return await this.client.requestJson<BitbucketPublishReviewResult>(endpoint, {
          method: 'PUT',
          body: buildBody(status.toLowerCase()),
        });
      }
      throw err;
    }
  }

  /** Delete every PENDING comment in the caller's review; the author is not notified. */
  async discardReview(project: string, repo: string, prId: number): Promise<void> {
    await this.client.request<void>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/review`,
      { method: 'DELETE' }
    );
  }
}
