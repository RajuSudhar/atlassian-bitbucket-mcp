/*
 * Bitbucket API Client — single entry point for all HTTP to Bitbucket.
 * Handles auth, retry, rate-limit, Cloud vs Server detection.
 */

import { log } from '../logger.js';
import { buildAuthHeaders } from './auth.js';
import { BitbucketApiError, NetworkError, TimeoutError } from './errors.js';

import type { BitbucketFlavor, Config } from '@types';

type RequestOptions = {
  readonly method?: string;
  readonly body?: unknown;
  readonly queryParams?: Record<string, string | number | undefined>;
};

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class BitbucketClient {
  private readonly config: Config;
  private flavor: BitbucketFlavor | null = null;

  constructor(config: Config) {
    this.config = config;
  }

  /** Detect Cloud vs Server/DC. Cached for process lifetime. */
  async detectFlavor(): Promise<BitbucketFlavor> {
    if (this.flavor) return this.flavor;

    const url = this.config.bitbucketUrl;
    if (url.includes('bitbucket.org') || url.includes('api.bitbucket.org')) {
      this.flavor = 'cloud';
      log('info', 'detected bitbucket flavor', { operation: 'detect_flavor', flavor: 'cloud' });
      return 'cloud';
    }

    // Probe Server/DC version endpoint
    try {
      const res = await this.rawFetch(
        `${url}/rest/api/1.0/application-properties`,
        { method: 'GET' },
        5000
      );
      if (res.ok) {
        this.flavor = 'server';
        log('info', 'detected bitbucket flavor', { operation: 'detect_flavor', flavor: 'server' });
        return 'server';
      }
    } catch {
      // probe failed — could still be Server with different path
    }

    // Default to server if self-hosted URL but probe failed
    this.flavor = 'server';
    log('warn', 'flavor probe failed, defaulting to server', { operation: 'detect_flavor' });
    return 'server';
  }

  getFlavor(): BitbucketFlavor | null {
    return this.flavor;
  }

  /** Build the full API base path per flavor */
  private apiBase(flavor: BitbucketFlavor): string {
    const url = this.config.bitbucketUrl;
    if (flavor === 'cloud') {
      return url.includes('api.bitbucket.org') ? url : 'https://api.bitbucket.org/2.0';
    }
    return `${url}/rest/api/1.0`;
  }

  /** Core request with retry + rate limit */
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const flavor = await this.detectFlavor();
    const base = this.apiBase(flavor);
    const method = options.method ?? 'GET';

    let fullUrl = `${base}${endpoint}`;
    if (options.queryParams) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(options.queryParams)) {
        if (v !== undefined) params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) fullUrl += `?${qs}`;
    }

    const { maxRetries, rateLimitDelay, requestTimeout } = this.config.api;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0 || rateLimitDelay > 0) {
        const delay = attempt > 0 ? this.backoffMs(attempt) : rateLimitDelay;
        await this.sleep(delay);
      }

      const start = Date.now();
      log('debug', 'bb req', { operation: 'api_request', endpoint, method });

      try {
        const response = await this.rawFetch(
          fullUrl,
          {
            method,
            body: options.body ? JSON.stringify(options.body) : undefined,
          },
          requestTimeout
        );

        const durationMs = Date.now() - start;
        log('debug', 'bb res', {
          operation: 'api_response',
          endpoint,
          method,
          statusCode: response.status,
          durationMs,
        });

        if (response.ok) {
          // 204 No Content
          if (response.status === 204) {
            return undefined as T;
          }
          const data: unknown = await response.json();
          return data as T;
        }

        // Non-retryable client errors (except 429)
        if (!RETRYABLE_STATUS.has(response.status)) {
          const body = await response.text().catch(() => '');
          log('error', 'bb err', {
            operation: 'api_error',
            endpoint,
            method,
            statusCode: response.status,
          });
          throw new BitbucketApiError(
            response.status,
            endpoint,
            method,
            body || response.statusText
          );
        }

        // Retryable — check Retry-After header
        if (response.status === 429) {
          const retryAfter = this.parseRetryAfter(response.headers.get('Retry-After'));
          if (retryAfter) {
            log('warn', 'rate limited', {
              operation: 'rate_limit',
              endpoint,
              retryAfterMs: retryAfter,
            });
            await this.sleep(retryAfter);
          }
        }

        if (attempt === maxRetries) {
          const body = await response.text().catch(() => '');
          throw new BitbucketApiError(
            response.status,
            endpoint,
            method,
            body || response.statusText
          );
        }

        log('warn', 'retrying request', {
          operation: 'retry',
          endpoint,
          attempt: attempt + 1,
          statusCode: response.status,
        });
      } catch (err) {
        if (err instanceof BitbucketApiError) throw err;
        if (err instanceof TimeoutError) {
          if (attempt === maxRetries) throw err;
          log('warn', 'retrying after timeout', {
            operation: 'retry',
            endpoint,
            attempt: attempt + 1,
          });
          continue;
        }
        if (attempt === maxRetries) {
          throw new NetworkError(endpoint, err);
        }
        log('warn', 'retrying after network error', {
          operation: 'retry',
          endpoint,
          attempt: attempt + 1,
        });
      }
    }

    // Unreachable, but TS needs it
    throw new NetworkError(endpoint, 'exhausted retries');
  }

  private async rawFetch(
    url: string,
    init: { method: string; body?: string },
    timeoutMs: number = this.config.api.requestTimeout
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: init.method,
        headers: buildAuthHeaders(this.config.bitbucketToken),
        body: init.body,
        signal: controller.signal,
      });
      return response;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new TimeoutError(url, timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private backoffMs(attempt: number): number {
    const base = 200;
    const max = 30000;
    const exponential = base * Math.pow(2, attempt);
    const jitter = Math.random() * base;
    return Math.min(exponential + jitter, max);
  }

  private parseRetryAfter(header: string | null): number | null {
    if (!header) return null;
    const seconds = Number(header);
    if (!Number.isNaN(seconds)) return seconds * 1000;
    // HTTP-date form
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
