# feat-retry-ratelimit

Phase: 2 | Status: [x] done
Depends on: feat-client-core
Ref: `claude-ref/client.md`, `claude-ref/logger.md`

## Goal

Robust retry with exponential backoff and rate-limit compliance.

## In scope

- Retry on 429, 5xx, network errors, timeouts.
- Honor `Retry-After` header.
- Inter-request delay `BITBUCKET_RATE_LIMIT_DELAY`.
- `BITBUCKET_MAX_RETRIES` cap.

## Out of scope

- Token bucket / adaptive rate limiting.
- Persistent request queue.

## Design

- Backoff: `min(base * 2^n + jitter, maxMs)`. base 200ms, max 30s.
- `Retry-After` overrides computed backoff when present.
- Each retry logged with attempt number + reason.
- Non-retryable: 4xx except 429, auth errors (401/403), validation errors.

## Tasks

- [x] `retry()` wrapper around `client.request`
- [x] parse `Retry-After` (seconds and HTTP-date forms)
- [x] jitter implementation
- [ ] unit tests: retries on 500/502/503/504/429, gives up at max, respects Retry-After, doesn't retry 404
- [x] log each attempt per logger contract

## Definition of done

- [ ] deterministic backoff via injectable clock
- [ ] ≥ 80% coverage
- [x] TRACK.md updated
