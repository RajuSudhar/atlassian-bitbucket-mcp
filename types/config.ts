/*
 * Configuration types
 */

import type { Seconds } from './common.js';
import type { LogLevel } from './logger.js';

export type Action =
  | 'read_pr'
  | 'write_pr'
  | 'manage_pr'
  | 'search_code'
  | 'read_repo'
  | 'read_project';

export type BitbucketFlavor = 'cloud' | 'server';

export type Config = {
  readonly bitbucketUrl: string;
  readonly bitbucketToken: string;
  readonly defaultProject: string;
  readonly allowedActions: ReadonlySet<Action>;
  /**
   * Allowed project keys (normalized lowercase). Empty set → all projects
   * allowed. Enforced by `requireScope` before any project-scoped call.
   */
  readonly allowedProjects: ReadonlySet<string>;
  /**
   * Allowed repositories (normalized lowercase). Entries are either
   * `project/repo` (fully qualified) or a bare `repo` slug matching under any
   * allowed project. Empty set → all repos allowed.
   */
  readonly allowedRepos: ReadonlySet<string>;
  readonly cache: CacheConfig;
  readonly api: ApiConfig;
  readonly logLevel: LogLevel;
};

export type CacheConfig = {
  readonly enabled: boolean;
  readonly ttlRepos: Seconds;
  readonly ttlRepoMeta: Seconds;
  readonly ttlUsers: Seconds;
};

export type ApiConfig = {
  readonly requestTimeout: number;
  readonly maxRetries: number;
  readonly rateLimitDelay: number;
};
