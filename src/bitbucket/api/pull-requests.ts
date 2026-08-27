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
  PullRequest,
} from '@types';

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

  async addComment(
    project: string,
    repo: string,
    prId: number,
    text: string
  ): Promise<BitbucketComment> {
    return this.client.requestJson<BitbucketComment>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/comments`,
      { method: 'POST', body: { text } }
    );
  }

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
    }
  ): Promise<BitbucketComment> {
    // `diffType: EFFECTIVE` anchors the comment against the PR's overall diff
    // (the default view). Server/DC drops inline comments whose anchor omits it
    // when the PR spans multiple commits, so default it here.
    const resolvedAnchor = { ...anchor, diffType: anchor.diffType ?? 'EFFECTIVE' };
    return this.client.requestJson<BitbucketComment>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/comments`,
      { method: 'POST', body: { text, anchor: resolvedAnchor } }
    );
  }

  async replyToComment(
    project: string,
    repo: string,
    prId: number,
    commentId: number,
    text: string
  ): Promise<BitbucketComment> {
    return this.client.requestJson<BitbucketComment>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/comments`,
      { method: 'POST', body: { text, parent: { id: commentId } } }
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
}
