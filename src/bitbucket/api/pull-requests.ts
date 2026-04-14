/*
 * Pull Request API operations
 *
 * NOTE: These paths target Server/DC (/projects/{key}/repos/{slug}/pull-requests).
 * Cloud uses /repositories/{workspace}/{repo_slug}/pullrequests with different
 * parameter shapes. Cloud-specific routing is deferred to feat-cloud-vs-server
 * follow-up; until then, Cloud instances will error at the API layer.
 */

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
    anchor: { path: string; line: number; lineType: string; fileType?: string }
  ): Promise<BitbucketComment> {
    return this.client.requestJson<BitbucketComment>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/comments`,
      { method: 'POST', body: { text, anchor } }
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

  async approve(project: string, repo: string, prId: number): Promise<BitbucketComment> {
    return this.client.requestJson<BitbucketComment>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/approve`,
      { method: 'POST' }
    );
  }
}
