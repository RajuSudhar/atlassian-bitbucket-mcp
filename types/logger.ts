/*
 * Logging types
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = {
  readonly operation?: string;
  readonly toolName?: string;
  readonly userId?: string;
  readonly endpoint?: string;
  readonly method?: string;
  readonly statusCode?: number;
  readonly error?: string;
  readonly key?: string;
  readonly durationMs?: number;
  readonly [key: string]: unknown;
};
