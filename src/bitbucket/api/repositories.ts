/*
 * Repository & Project API operations
 */

import type { BitbucketClient } from '../client.js';
import type {
  BitbucketBranch,
  BitbucketCommit,
  BitbucketPagedResponse,
  BitbucketProject,
  BitbucketRepository,
} from '@types';

export class RepositoryApi {
  constructor(private readonly client: BitbucketClient) {}

  async listProjects(limit = 25, start = 0): Promise<BitbucketPagedResponse<BitbucketProject>> {
    return this.client.requestJson<BitbucketPagedResponse<BitbucketProject>>('/projects', {
      queryParams: { limit, start },
    });
  }

  async listRepositories(
    project: string,
    limit = 25,
    start = 0
  ): Promise<BitbucketPagedResponse<BitbucketRepository>> {
    return this.client.requestJson<BitbucketPagedResponse<BitbucketRepository>>(
      `/projects/${project}/repos`,
      { queryParams: { limit, start } }
    );
  }

  async getRepository(project: string, repo: string): Promise<BitbucketRepository> {
    return this.client.requestJson<BitbucketRepository>(`/projects/${project}/repos/${repo}`);
  }

  async getBranches(
    project: string,
    repo: string,
    limit = 25,
    start = 0
  ): Promise<BitbucketPagedResponse<BitbucketBranch>> {
    return this.client.requestJson<BitbucketPagedResponse<BitbucketBranch>>(
      `/projects/${project}/repos/${repo}/branches`,
      { queryParams: { limit, start } }
    );
  }

  async getCommits(
    project: string,
    repo: string,
    limit = 25,
    start = 0
  ): Promise<BitbucketPagedResponse<BitbucketCommit>> {
    return this.client.requestJson<BitbucketPagedResponse<BitbucketCommit>>(
      `/projects/${project}/repos/${repo}/commits`,
      { queryParams: { limit, start } }
    );
  }

  async getFileContent(
    project: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<unknown> {
    const queryParams: Record<string, string | undefined> = {};
    if (ref !== undefined && ref.length > 0) queryParams['at'] = ref;
    return this.client.requestJson<unknown>(`/projects/${project}/repos/${repo}/browse/${path}`, {
      queryParams,
    });
  }
}
