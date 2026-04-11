# feat-client-core

Phase: 2  |  Status: [x] done
Depends on: feat-config, feat-logger, feat-openapi-codegen
Ref: `claude-ref/client.md`, `claude-ref/typescript.md`, `claude-ref/logger.md`

## Goal
Single `BitbucketClient` class that handles HTTP to Bitbucket with logging and typed responses.

## In scope
- `src/bitbucket/client.ts` — class with `request<T>(endpoint, opts)`.
- `src/bitbucket/api/{pull-requests,repositories,search}.ts` — resource modules.
- Response narrowing against curated `types/bitbucket.ts`.

## Out of scope
- Retry logic (feat-retry-ratelimit).
- Auth header (feat-auth).
- Instance detection (feat-cloud-vs-server).

## Design
- Constructor takes `Config` + `Logger`.
- `request<T>` returns `Promise<T>`, throws typed `BitbucketApiError`.
- Uses native `fetch` (Node 20+); no axios unless justified.
- Tools never import resource modules directly — go through `BitbucketClient` facade.

## Tasks
- [x] `types/bitbucket-errors.ts` — `BitbucketApiError`, `NetworkError`, `TimeoutError`
- [x] base `request<T>` with timeout via `AbortController`
- [x] log every req/res per `claude-ref/logger.md`
- [x] resource modules with typed returns
- [ ] unit tests with mocked fetch, covering success + each error class

## Definition of done
- [x] no `any`
- [ ] ≥ 80% coverage
- [x] all 20 MCP tool endpoints reachable via client methods
- [x] TRACK.md updated
