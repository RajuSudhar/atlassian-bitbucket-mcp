/*
 * Typed errors for Bitbucket API interactions
 */

export class BitbucketApiError extends Error {
  readonly statusCode: number;
  readonly endpoint: string;
  readonly method: string;

  constructor(statusCode: number, endpoint: string, method: string, message: string) {
    super(message);
    this.name = 'BitbucketApiError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.method = method;
  }
}

export class NetworkError extends Error {
  readonly endpoint: string;
  readonly cause: unknown;

  constructor(endpoint: string, cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`Network error calling ${endpoint}: ${msg}`);
    this.name = 'NetworkError';
    this.endpoint = endpoint;
    this.cause = cause;
  }
}

export class TimeoutError extends Error {
  readonly endpoint: string;
  readonly timeoutMs: number;

  constructor(endpoint: string, timeoutMs: number) {
    super(`Request to ${endpoint} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }
}
