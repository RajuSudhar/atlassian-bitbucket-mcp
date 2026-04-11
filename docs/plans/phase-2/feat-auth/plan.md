# feat-auth

Phase: 2  |  Status: [x] done
Depends on: feat-client-core
Ref: `claude-ref/client.md`, `claude-ref/security.md`, `claude-ref/logger.md`

## Goal
Inject `Authorization: Bearer <token>` on every request without leaking the token.

## In scope
- `src/bitbucket/auth.ts` — `buildAuthHeader(token)` + guard.
- Integration into `BitbucketClient.request`.
- Redaction in error paths and logs.

## Out of scope
- OAuth 2.0 flow.
- Token rotation.

## Design
- Header built fresh per request from `Config` (no caching of the token on instance).
- Tests assert that `JSON.stringify(error)` never contains the token value.
- Fuzz test: generate random tokens, assert absence from every log line in a mocked request cycle.

## Tasks
- [x] `buildAuthHeader` function
- [x] wire into `client.request`
- [x] reject non-HTTPS URL at request time (defense in depth)
- [ ] redaction test matrix
- [ ] fuzz test for token leakage

## Definition of done
- [ ] zero token leakage across 1000 fuzzed runs
- [x] HTTPS-only enforced
- [x] TRACK.md updated
