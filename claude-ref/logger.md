# logger

```ts
log(level: 'debug'|'info'|'warn'|'error', message: string, context?: LogContext): void
```

`LogContext` keys: `operation`, `toolName`, `endpoint`, `method`, `statusCode`, `error`, `key`, `durationMs`, plus `[k: string]: unknown`.

## Required at

- server lifecycle: init start/end, shutdown, config load
- tool exec: start (toolName, args summary), end (durationMs), error
- every Bitbucket request (endpoint, method) and response (statusCode, durationMs)
- auth: attempt, success/fail, permission check
- cache: hit, miss, set, invalidate, clear
- all caught errors (with context)
- rate limit events, retry attempts
- slow ops (> 1000ms), large responses (> 1MB)

## Banned in context

- raw `BITBUCKET_TOKEN`, auth headers
- full request bodies, PII
- any secret / env var value

## Banned anywhere in product code

- `console.log`, `console.error`, `console.warn`, `console.debug`
- `process.stdout.write` for logging
