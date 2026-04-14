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
