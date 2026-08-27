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
  readonly transport: TransportConfig;
  readonly logLevel: LogLevel;
};

export type TransportMode = 'stdio' | 'http';

export type TransportConfig = {
  readonly mode: TransportMode;
  /** Port for the HTTP transport (ignored in stdio mode). */
  readonly httpPort: number;
  /** Bind address for the HTTP transport; defaults to loopback only. */
  readonly httpHost: string;
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
