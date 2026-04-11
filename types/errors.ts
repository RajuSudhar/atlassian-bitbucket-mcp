/*
 * Error types
 */

export type BitbucketApiErrorInfo = {
  readonly statusCode: number;
  readonly endpoint: string;
  readonly method: string;
  readonly message: string;
};

export type NetworkErrorInfo = {
  readonly endpoint: string;
  readonly cause: string;
};

export type TimeoutErrorInfo = {
  readonly endpoint: string;
  readonly timeoutMs: number;
};
