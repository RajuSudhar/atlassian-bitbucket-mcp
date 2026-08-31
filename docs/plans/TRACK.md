# TRACK — Atlassian Bitbucket MCP

Last updated: 2026-08-26

## Status legend

[x] done [~] wip [ ] todo [!] blocked

## Phases

### Phase 1 — Foundation

[x] feat-config → docs/plans/phase-1/feat-config/plan.md
[x] feat-logger → docs/plans/phase-1/feat-logger/plan.md
[x] feat-types-scaffold → docs/plans/phase-1/feat-types-scaffold/plan.md
[x] feat-openapi-codegen → docs/plans/phase-1/feat-openapi-codegen/plan.md

### Phase 2 — Bitbucket Client

[x] feat-client-core → docs/plans/phase-2/feat-client-core/plan.md
[x] feat-auth → docs/plans/phase-2/feat-auth/plan.md
[x] feat-retry-ratelimit → docs/plans/phase-2/feat-retry-ratelimit/plan.md
[x] feat-cloud-vs-server → docs/plans/phase-2/feat-cloud-vs-server/plan.md

### Phase 3 — Caching

[x] feat-cache → docs/plans/phase-3/feat-cache/plan.md

### Phase 4 — MCP Server & Tools

[x] feat-server-core → docs/plans/phase-4/feat-server-core/plan.md
[x] feat-permissions → docs/plans/phase-4/feat-permissions/plan.md
[x] feat-pr-tools → docs/plans/phase-4/feat-pr-tools/plan.md
[x] feat-repo-tools → docs/plans/phase-4/feat-repo-tools/plan.md
[x] feat-search-tools → docs/plans/phase-4/feat-search-tools/plan.md

### Phase 5 — Testing & Release

[ ] feat-unit-tests → docs/plans/phase-5/feat-unit-tests/plan.md
[ ] feat-ci → docs/plans/phase-5/feat-ci/plan.md
[ ] feat-npx-release → docs/plans/phase-5/feat-npx-release/plan.md

### Phase 6 — Deployment scoping (juspay Server/DC)

[x] feat-project-repo-scoping → docs/plans/phase-6/feat-project-repo-scoping/plan.md
— `BITBUCKET_ALLOWED_PROJECTS` / `BITBUCKET_ALLOWED_REPOS` allow-lists +
`requireScope` enforcement on every project/repo-scoped tool
[ ] feat-inline-comment-hardening — `diffType` on `bitbucket_add_pr_inline_comment`
[x] feat-http-transport → docs/plans/phase-6/feat-http-transport/plan.md —
Streamable HTTP transport (`MCP_TRANSPORT=http`), including TLS mode
(`MCP_TRANSPORT=https` + `MCP_HTTP_TLS_CERT_FILE`/`MCP_HTTP_TLS_KEY_FILE`)
[x] feat-ci-helper-exports → docs/plans/phase-6/feat-ci-helper-exports/plan.md —
`atlassian-bitbucket-mcp/helper` subpath export: `createBitbucketHelper()` for
direct typed API use in CI scripts (no MCP protocol, no permission gating)
[x] feat-pr-tasks → docs/plans/phase-6/feat-pr-tasks/plan.md — create/list/resolve/delete PR tasks
[~] feat-pr-tasks-blocker-comments → docs/plans/phase-6/feat-pr-tasks-blocker-comments/ — fix root BLOCKER task enumeration via /blocker-comments endpoint + add state filter (OPEN/RESOLVED/ALL)
[x] feat-update-pr → docs/plans/phase-6/feat-update-pr/plan.md — update PR title/description
[~] feat-update-pr-preserve-reviewers → docs/plans/phase-6/feat-update-pr-preserve-reviewers/ — fix reviewer-wipe bug via GET-then-PUT with auto version management
[x] feat-pr-review-sessions → docs/plans/phase-6/feat-pr-review-sessions/plan.md —
batched reviews (start/publish/discard) via `state: PENDING` comments +
`/pull-requests/{id}/review`; `pending` flag on the 4 comment/task tools

### Phase 7 — Response governance

[ ] feat-output-token-limits → docs/plans/phase-7/feat-output-token-limits/plan.md —
per-tool output-token-limit governor (config-file + env driven), ported from
plane-mcp: rejects oversize tool responses with an actionable guidance error
instead of truncating

## Done (across branches)

- Initial repo scaffold (package.json, tsconfig.json, eslint, prettier, husky, docs/)
- docs/plans/ phase directories created with plan.md for every feat
- scripts/ directory with git hooks and security validation

The following items are implemented on `feature/implement-mcp-server`:

- CLAUDE.md + claude-ref/ routing & reference docs authored
- types/ scaffold: common, logger, config, cache, bitbucket, mcp, errors, index
- src/config.ts with zod validation, HTTPS enforcement, masked summary
- src/logger.ts with redaction, level gating, structured JSON to stderr
- src/cache.ts with TTL, prefix invalidation, disabled mode
- src/bitbucket/ client with retry, backoff, jitter, rate-limit, Cloud/Server detection, auth
- src/bitbucket/api/ pull-requests, repositories, search resource modules
- src/permissions.ts with action enforcement
- src/tools/ pr-tools (11), repo-tools (6), search-tools (2) — 19 tools total
- src/server.ts MCP server with full tool registration
- src/index.ts entry point with stdio transport, graceful shutdown
- tsconfig updated: paths @types, bundler resolution, noUncheckedIndexedAccess
- typecheck passes with zero errors

The following items have landed on `main` since:

- src/tools/registry.ts — tool definitions extracted into a single registry,
  server.ts reduced to a thin wiring layer (#7)
- openapi/bitbucket-cloud.yaml + openapi/bitbucket-server.yaml authored as the
  source of truth for `types/generated/*.d.ts`
- scripts/gen-types.sh + scripts/check-types-drift.sh + `types:gen` /
  `types:check-drift` npm scripts
- pre-commit hook regenerates types and fails on drift when `openapi/*.yaml`
  is staged
- types/bitbucket.ts curated to re-export from generated declarations,
  preserving the existing `Bitbucket*` public names
- `src/permissions.ts` gains `requireScope`/`ScopeDeniedError`; every
  project/repo-scoped tool in `pr-tools.ts`, `repo-tools.ts`, `search-tools.ts`
  calls it after `requirePermission`; `test/permissions.test.mjs` +
  `test/config.test.mjs` added, run via `node --test test/*.test.mjs`
  (`pretest` builds `dist/` first)

## Decisions / deviations

- Test runner: used Node's built-in `node:test` + `node:assert` (zero new deps,
  ESM-native) instead of the Jest setup named in the phase-5 plan. The security
  policy (`security-check before add`) and offline install constraints made a
  dependency-free runner the pragmatic choice.

## Blockers / decisions pending

- Phase 5: testing, CI, NPX release — all pending
- `README.md` uses `docs/<description>` but branch standard is `doc/<description>` — reconcile
- `SECURITY.md` contains `[your-email]` placeholder
