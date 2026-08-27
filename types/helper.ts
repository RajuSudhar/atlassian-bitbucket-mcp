/*
 * Programmatic helper (library entry point) option types
 */

/**
 * Options for `createBitbucketHelper`. Every field is optional — explicit
 * options override environment variables; anything missing falls back to the
 * corresponding env var via `loadConfig`-compatible logic.
 */
export type BitbucketHelperOptions = {
  /** Bitbucket base URL (HTTPS only). Falls back to `BITBUCKET_URL`. */
  readonly url?: string;
  /** PAT / HTTP access token. Falls back to `BITBUCKET_TOKEN`. */
  readonly token?: string;
  /** Default project key. Falls back to `BITBUCKET_DEFAULT_PROJECT`. */
  readonly defaultProject?: string;
  /** Request timeout in ms. Falls back to `BITBUCKET_REQUEST_TIMEOUT` (30000). */
  readonly requestTimeout?: number;
  /** Max retry attempts. Falls back to `BITBUCKET_MAX_RETRIES` (3). */
  readonly maxRetries?: number;
  /** Delay before each request in ms. Falls back to `BITBUCKET_RATE_LIMIT_DELAY` (0). */
  readonly rateLimitDelay?: number;
};
