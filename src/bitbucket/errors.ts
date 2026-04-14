/*
 * Typed errors for Bitbucket API interactions.
 *
 * All errors extend `BitbucketError` so callers can discriminate the client's
 * error surface from arbitrary runtime errors with a single `instanceof` check.
 */

export abstract class BitbucketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class BitbucketApiError extends BitbucketError {
  readonly statusCode: number;
  readonly endpoint: string;
  readonly method: string;

  constructor(statusCode: number, endpoint: string, method: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.method = method;
  }
}

export class NetworkError extends BitbucketError {
  readonly endpoint: string;
  readonly cause: unknown;

  constructor(endpoint: string, cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`Network error calling ${endpoint}: ${msg}`);
    this.endpoint = endpoint;
    this.cause = cause;
  }
}

export class TimeoutError extends BitbucketError {
  readonly endpoint: string;
  readonly timeoutMs: number;

  constructor(endpoint: string, timeoutMs: number) {
    super(`Request to ${endpoint} timed out after ${timeoutMs}ms`);
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }
}
