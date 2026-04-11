# bitbucket client (src/bitbucket/*)

## Structure

- `client.ts` — `BitbucketClient` (single entry)
- `auth.ts` — header builder
- `api/pull-requests.ts`, `api/repositories.ts`, `api/search.ts` — per-resource calls

## Instance detection

1. Domain check: `api.bitbucket.org` → Cloud.
2. Else probe version endpoint (Server/DC `/rest/api/1.0/application-properties`).
3. Cache result for process lifetime.

Branch Cloud vs Server/DC differences INSIDE the client. Tools must remain instance-agnostic.

## Auth

- Header: `Authorization: Bearer ${BITBUCKET_TOKEN}`.
- Token read only via `src/config.ts`. Never via `process.env` elsewhere.
- HTTPS only. Reject `http://` URLs at config load.

## Retry / rate limit

- Retry on 429, 5xx, network errors.
- Exponential backoff with jitter. Cap at `BITBUCKET_MAX_RETRIES`.
- Honor `Retry-After` header when present.
- Respect `BITBUCKET_RATE_LIMIT_DELAY` between requests.
- Honor `BITBUCKET_REQUEST_TIMEOUT`.

## Logging (every call)

- Request: `log('debug', 'bb req', { endpoint, method })`
- Response: `log('debug', 'bb res', { endpoint, statusCode, durationMs })`
- Error: `log('error', 'bb err', { endpoint, statusCode, error })` — never the token.

## Response handling

- Validate shape at boundary before returning. Type as the `types/bitbucket.ts` definition.
- Strip unknown fields only if API contract is unclear; prefer total types.
