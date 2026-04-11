# feat-openapi-codegen

Phase: 1  |  Status: [ ] todo
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
- [ ] run `./scripts/check-package-security.sh openapi-typescript`
- [ ] `pnpm add -D openapi-typescript@<exact>`
- [ ] author minimal `openapi/bitbucket-cloud.yaml` covering: Repository, PullRequest, Comment, Activity, Branch, Commit, User, SearchResult
- [ ] author minimal `openapi/bitbucket-server.yaml` for same resources (REST 1.0)
- [ ] validate both YAMLs
- [ ] add `scripts/gen-types.sh` + `types:gen` npm script
- [ ] add drift-check script (`types:gen && git diff --exit-code types/generated`)
- [ ] pre-commit hook: run drift check on YAML change
- [ ] curate `types/bitbucket.ts` re-exports
- [ ] unit test: curated types compile and match shape expectations

## Definition of done
- [ ] `pnpm run types:gen` idempotent
- [ ] drift check wired into pre-commit and CI
- [ ] both YAMLs lint-clean
- [ ] no `interface` in generated or curated files
- [ ] `types/bitbucket.ts` only exports `type`
- [ ] TRACK.md updated

## Open questions
- Keep two separate generated files vs merge with `oneOf`? → keep separate, curate union.
- Runtime validation lib (zod/valibot) now or phase 2? → phase 2 client.
