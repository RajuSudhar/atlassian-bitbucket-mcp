/*
 * Programmatic library entry point — `atlassian-bitbucket-mcp/helper`.
 *
 * Lets CI jobs and scripts call the Bitbucket API layer directly, with no MCP
 * protocol, no server, and no permission gating (the caller holds the token):
 *
 *   import { createBitbucketHelper } from 'atlassian-bitbucket-mcp/helper';
 *   const helper = createBitbucketHelper({ url, token, defaultProject });
 *   const pr = await helper.pullRequests.get('BZ', 'nimble', 42);
 *
 * NOTE ON IMPORTS: this file is a published entry point whose emitted `.d.ts`
 * must resolve for package consumers, and the repo's `@types` path alias does
 * not exist outside this repo. Types are therefore imported by RELATIVE path
 * here — the one deliberate exception to the repo-wide `@types` rule.
 */

import { PullRequestApi } from './bitbucket/api/pull-requests.js';
import { RepositoryApi } from './bitbucket/api/repositories.js';
import { SearchApi } from './bitbucket/api/search.js';
import { BitbucketClient } from './bitbucket/client.js';
import { loadConfig } from './config.js';
import { log } from './logger.js';

import type { Action, BitbucketHelperOptions, Config, Seconds } from '../types/index.js';

// Re-export the API surface so CI code can type parameters and use
// `instanceof` on the client's error hierarchy.
export { PullRequestApi, RepositoryApi, SearchApi, BitbucketClient };
export {
  BitbucketError,
  BitbucketApiError,
  NetworkError,
  TimeoutError,
} from './bitbucket/errors.js';
export type {
  Action,
  ApiConfig,
  BitbucketActivity,
  BitbucketBranch,
  BitbucketComment,
  BitbucketCommit,
  BitbucketDiff,
  BitbucketFlavor,
  BitbucketHelperOptions,
  BitbucketPagedResponse,
  BitbucketParticipantStatus,
  BitbucketProject,
  BitbucketPublishReviewResult,
  BitbucketRepository,
  BitbucketSearchResult,
  BitbucketTaskState,
  Config,
  PullRequest,
} from '../types/index.js';

/** All permission actions — the helper is a direct library, nothing is gated. */
const ALL_ACTIONS: ReadonlyArray<Action> = [
  'read_pr',
  'write_pr',
  'manage_pr',
  'search_code',
  'read_repo',
  'read_project',
];

const DEFAULT_REQUEST_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RATE_LIMIT_DELAY = 0;

export type BitbucketHelper = {
  /** Escape hatch for raw REST calls: `helper.client.requestJson(endpoint, opts)`. */
  readonly client: BitbucketClient;
  /** Resolved effective configuration. Holds the token — never log or emit it. */
  readonly config: Config;
  readonly pullRequests: PullRequestApi;
  readonly repositories: RepositoryApi;
  readonly search: SearchApi;
};

function normalizeUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  if (!trimmed.startsWith('https://')) {
    throw new Error('Bitbucket URL must use HTTPS');
  }
  return trimmed;
}

function requireNonEmpty(value: string, name: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

/** Build a Config purely from explicit options — never touches process.env. */
function buildExplicitConfig(
  url: string,
  token: string,
  defaultProject: string,
  options: BitbucketHelperOptions
): Config {
  return {
    bitbucketUrl: normalizeUrl(url),
    bitbucketToken: requireNonEmpty(token, 'token'),
    defaultProject: requireNonEmpty(defaultProject, 'defaultProject'),
    allowedActions: new Set(ALL_ACTIONS),
    allowedProjects: new Set<string>(),
    allowedRepos: new Set<string>(),
    // The API layer never consults the cache; disabled keeps one-shot CI
    // usage honest. TTLs mirror loadConfig defaults for consistency.
    cache: {
      enabled: false,
      ttlRepos: 3600 as Seconds,
      ttlRepoMeta: 1800 as Seconds,
      ttlUsers: 3600 as Seconds,
    },
    api: {
      requestTimeout: options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      rateLimitDelay: options.rateLimitDelay ?? DEFAULT_RATE_LIMIT_DELAY,
    },
    // Transport settings are irrelevant to library usage; safe defaults.
    transport: { mode: 'stdio', httpPort: 3900, httpHost: '127.0.0.1' },
    logLevel: 'info',
  };
}

function resolveConfig(options: BitbucketHelperOptions): Config {
  const { url, token, defaultProject } = options;

  // All required options provided explicitly → build without touching env.
  if (url !== undefined && token !== undefined && defaultProject !== undefined) {
    return buildExplicitConfig(url, token, defaultProject, options);
  }

  // Otherwise fall back to env via loadConfig and overlay explicit options.
  const base = loadConfig();
  return {
    ...base,
    bitbucketUrl: url !== undefined ? normalizeUrl(url) : base.bitbucketUrl,
    bitbucketToken: token !== undefined ? requireNonEmpty(token, 'token') : base.bitbucketToken,
    defaultProject:
      defaultProject !== undefined
        ? requireNonEmpty(defaultProject, 'defaultProject')
        : base.defaultProject,
    cache: { ...base.cache, enabled: false },
    api: {
      requestTimeout: options.requestTimeout ?? base.api.requestTimeout,
      maxRetries: options.maxRetries ?? base.api.maxRetries,
      rateLimitDelay: options.rateLimitDelay ?? base.api.rateLimitDelay,
    },
  };
}

/**
 * Rebind every prototype method onto the instance so consumers can safely
 * destructure (`const { get } = helper.pullRequests`) without losing `this`.
 */
function bindMethods<T extends object>(instance: T): T {
  const record = instance as Record<string, unknown>;
  const proto = Object.getPrototypeOf(instance) as object;
  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === 'constructor') continue;
    const value = record[name];
    if (typeof value === 'function') {
      record[name] = value.bind(instance);
    }
  }
  return instance;
}

/**
 * Create a Bitbucket helper: the API layer grouped by resource, with the
 * client pre-bound. Explicit options override env; missing options fall back
 * to the same env vars `loadConfig` reads.
 */
export function createBitbucketHelper(options: BitbucketHelperOptions = {}): BitbucketHelper {
  const config = resolveConfig(options);
  const client = new BitbucketClient(config);

  log('debug', 'helper created', {
    operation: 'helper_init',
    bitbucketUrl: config.bitbucketUrl,
    defaultProject: config.defaultProject,
  });

  return {
    client,
    config,
    pullRequests: bindMethods(new PullRequestApi(client)),
    repositories: bindMethods(new RepositoryApi(client)),
    search: bindMethods(new SearchApi(client)),
  };
}
