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

/** Key names whose values must never reach the log sink. */
const REDACT_KEYS = /token|authorization|auth_header|password|secret|credential/i;

/**
 * Value shapes that look like a credential and should be redacted regardless
 * of the key they appear under. Matches:
 *  - Bearer / Basic / Token schemes followed by a non-trivial token
 *  - JWT-style three-segment dotted tokens (header.payload.signature)
 *  - Standalone long opaque strings (≥ 32 chars of base64/hex/url-safe alphabet)
 *
 * Deliberately narrow so legitimate error messages ("BITBUCKET_TOKEN is
 * required") are not swallowed.
 */
const TOKEN_SHAPE =
  /(?:Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{16,}|\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b|\b[A-Za-z0-9._~+/=-]{32,}\b/;

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function redact(context: LogContext): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (REDACT_KEYS.test(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string' && TOKEN_SHAPE.test(value)) {
      result[key] = value.replace(new RegExp(TOKEN_SHAPE, 'g'), '[REDACTED]');
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
