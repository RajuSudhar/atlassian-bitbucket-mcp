/*
 * Code & commit search API operations
 */

import type { BitbucketClient } from '../client.js';

import type { BitbucketPagedResponse, BitbucketSearchResult } from '@types';

export class SearchApi {
  constructor(private readonly client: BitbucketClient) {}

  async searchCode(
    project: string,
    query: string,
    limit = 25,
    start = 0,
  ): Promise<BitbucketSearchResult> {
    return this.client.request<BitbucketSearchResult>(
      `/projects/${project}/search/code`,
      { queryParams: { query, limit, start } },
    );
  }

  async searchCommits(
    project: string,
    repo: string,
    query: string,
    limit = 25,
    start = 0,
  ): Promise<BitbucketPagedResponse<{ readonly id: string; readonly message: string }>> {
    return this.client.request(
      `/projects/${project}/repos/${repo}/commits`,
      { queryParams: { query, limit, start } },
    );
  }
}
