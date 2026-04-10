/*
 * Configuration loader — the ONLY file that reads process.env.
 */

import { z } from 'zod';

import type { Action, Config } from '@types';
import type { Seconds } from '@types';

const VALID_ACTIONS: ReadonlyArray<Action> = [
  'read_pr',
  'write_pr',
  'manage_pr',
  'search_code',
  'read_repo',
  'read_project',
];

const envSchema = z.object({
  BITBUCKET_URL: z
    .string()
    .url()
    .refine((url) => url.startsWith('https://'), { message: 'BITBUCKET_URL must use HTTPS' }),
  BITBUCKET_TOKEN: z.string().min(1, 'BITBUCKET_TOKEN is required'),
  BITBUCKET_DEFAULT_PROJECT: z.string().min(1, 'BITBUCKET_DEFAULT_PROJECT is required'),
  BITBUCKET_ALLOWED_ACTIONS: z.string().optional().default(''),
  BITBUCKET_CACHE_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v === 'true'),
  BITBUCKET_CACHE_TTL_REPOS: z.coerce.number().int().positive().optional().default(3600),
  BITBUCKET_CACHE_TTL_REPO_META: z.coerce.number().int().positive().optional().default(1800),
  BITBUCKET_CACHE_TTL_USERS: z.coerce.number().int().positive().optional().default(3600),
  BITBUCKET_REQUEST_TIMEOUT: z.coerce.number().int().positive().optional().default(30000),
  BITBUCKET_MAX_RETRIES: z.coerce.number().int().nonnegative().optional().default(3),
  BITBUCKET_RATE_LIMIT_DELAY: z.coerce.number().int().nonnegative().optional().default(0),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
});

function parseAllowedActions(raw: string): ReadonlySet<Action> {
  if (!raw.trim()) {
    return new Set(VALID_ACTIONS);
  }

  const actions = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const action of actions) {
    if (!VALID_ACTIONS.includes(action as Action)) {
      throw new Error(`Unknown action "${action}". Valid: ${VALID_ACTIONS.join(', ')}`);
    }
  }

  return new Set(actions as Action[]);
}

export function loadConfig(): Config {
  const parsed = envSchema.parse(process.env);

  const config: Config = {
    bitbucketUrl: parsed.BITBUCKET_URL.replace(/\/+$/, ''),
    bitbucketToken: parsed.BITBUCKET_TOKEN,
    defaultProject: parsed.BITBUCKET_DEFAULT_PROJECT,
    allowedActions: parseAllowedActions(parsed.BITBUCKET_ALLOWED_ACTIONS),
    cache: {
      enabled: parsed.BITBUCKET_CACHE_ENABLED,
      ttlRepos: parsed.BITBUCKET_CACHE_TTL_REPOS as Seconds,
      ttlRepoMeta: parsed.BITBUCKET_CACHE_TTL_REPO_META as Seconds,
      ttlUsers: parsed.BITBUCKET_CACHE_TTL_USERS as Seconds,
    },
    api: {
      requestTimeout: parsed.BITBUCKET_REQUEST_TIMEOUT,
      maxRetries: parsed.BITBUCKET_MAX_RETRIES,
      rateLimitDelay: parsed.BITBUCKET_RATE_LIMIT_DELAY,
    },
    logLevel: parsed.LOG_LEVEL,
  };

  return config;
}

/** Mask config for safe logging — strips token */
export function configSummary(config: Config): Record<string, unknown> {
  return {
    bitbucketUrl: config.bitbucketUrl,
    defaultProject: config.defaultProject,
    hasToken: Boolean(config.bitbucketToken),
    allowedActions: [...config.allowedActions],
    cache: config.cache,
    api: config.api,
    logLevel: config.logLevel,
  };
}
