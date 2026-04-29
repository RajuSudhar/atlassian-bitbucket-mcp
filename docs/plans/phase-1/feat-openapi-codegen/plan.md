# feat-openapi-codegen

Phase: 1 | Status: [x] done
Depends on: feat-types-scaffold
Ref: `claude-ref/openapi.md`, `claude-ref/typescript.md`, `claude-ref/security.md`

## Goal

Generate TS types from `openapi/*.yaml` so YAML is the single source of truth for Bitbucket API shapes.

## In scope

- Author initial `openapi/bitbucket-cloud.yaml` + `openapi/bitbucket-server.yaml` for the resources we consume (repos, PRs, comments, branches, commits, users, search).
- Tooling: `openapi-typescript` (security-checked, exact pinned).
- `pnpm run types:gen` → writes `types/generated/*.d.ts`.
- Curated re-exports in `types/bitbucket.ts` as `type` aliases.
- `pnpm run openapi:lint` via `@redocly/cli` or `swagger-cli`.
- Pre-commit hook: on YAML change, run `types:gen` and fail on drift.

## Out of scope

- Full API coverage (only what tools use).
- Runtime schema validation (phase 2 client will narrow responses).

## Design

- Generated file `types/generated/bitbucket-cloud.d.ts` is committed (deterministic output).
- `types/bitbucket.ts` pattern:

  ```ts
  import type { components } from './generated/bitbucket-cloud';
  export type PullRequest = components['schemas']['PullRequest'];
  export type PullRequestState = 'OPEN' | 'MERGED' | 'DECLINED';
  ```

- Cloud vs Server differences isolated into two generated files, union/alias at curation layer.
- String enums from YAML → refined TS unions in curation layer.

## Tasks

- [x] run `./scripts/check-package-security.sh openapi-typescript`
- [x] `pnpm add -D openapi-typescript@7.13.0`
- [x] author minimal `openapi/bitbucket-cloud.yaml` covering: Repository, PullRequest, Comment, Activity, Branch, Commit, User, SearchResult
- [x] author minimal `openapi/bitbucket-server.yaml` for same resources (REST 1.0)
- [x] validate both YAMLs (parsed by openapi-typescript without error)
- [x] add `scripts/gen-types.sh` + `types:gen` npm script
- [x] add drift-check script (`types:gen && git diff --exit-code types/generated`)
- [x] pre-commit hook: run drift check on YAML change
- [x] curate `types/bitbucket.ts` re-exports
- [ ] unit test: curated types compile and match shape expectations (deferred to feat-unit-tests, contract tests)

## Definition of done

- [x] `pnpm run types:gen` idempotent
- [x] drift check wired into pre-commit (CI hook lands with feat-ci)
- [x] both YAMLs parse cleanly via `openapi-typescript`
- [x] curated `types/bitbucket.ts` exports only `type` aliases (the lone `interface components` lives in the auto-generated `.d.ts` and is not user-authored)
- [x] `types/bitbucket.ts` only exports `type`
- [x] TRACK.md updated

## Notes

- Curated re-exports preserve the existing `Bitbucket*` / `PullRequest` /
  `PullRequestState` names that `src/` consumers import, so this feature is a
  behaviour-preserving change.
- OpenAPI 3 has no native generic for paged responses; `BitbucketPagedResponse<T>`
  composes `PagedResponseMeta` (from YAML) with `readonly values: ReadonlyArray<T>`.
- `@redocly/cli` / `swagger-cli` lint not added — `openapi-typescript` already
  rejects malformed specs, and adding another dep is deferred until contract
  tests need it (feat-unit-tests).

## Open questions

- Keep two separate generated files vs merge with `oneOf`? → keep separate, curate union.
- Runtime validation lib (zod/valibot) now or phase 2? → phase 2 client.
