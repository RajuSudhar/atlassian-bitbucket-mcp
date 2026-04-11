/*
 * Centralized logger — all logging goes through here.
 * Output: structured JSON to stderr (stdout reserved for MCP stdio transport).
 * Future: swap internals to OpenTelemetry span events.
 */

import type { LogContext, LogLevel } from '@types';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Patterns that must never appear in log output */
const REDACT_KEYS = /token|authorization|auth_header|password|secret|credential/i;

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function redact(context: LogContext): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (REDACT_KEYS.test(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string' && REDACT_KEYS.test(value)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function log(level: LogLevel, message: string, context?: LogContext): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? redact(context) : {}),
  };

  process.stderr.write(JSON.stringify(entry) + '\n');
}
