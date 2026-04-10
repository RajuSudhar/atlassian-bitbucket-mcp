# TRACK — Atlassian Bitbucket MCP

Last updated: 2026-04-10

## Status legend

[x] done  [~] in-progress  [ ] todo  [!] blocked

## Phases

### Phase 1 — Foundation

[x] feat-config         → docs/plans/phase-1/feat-config/plan.md
[x] feat-logger         → docs/plans/phase-1/feat-logger/plan.md
[x] feat-types-scaffold → docs/plans/phase-1/feat-types-scaffold/plan.md
[ ] feat-openapi-codegen → docs/plans/phase-1/feat-openapi-codegen/plan.md

### Phase 2 — Bitbucket Client

[x] feat-client-core    → docs/plans/phase-2/feat-client-core/plan.md
[x] feat-auth           → docs/plans/phase-2/feat-auth/plan.md
[x] feat-retry-ratelimit → docs/plans/phase-2/feat-retry-ratelimit/plan.md
[x] feat-cloud-vs-server → docs/plans/phase-2/feat-cloud-vs-server/plan.md

### Phase 3 — Caching

[x] feat-cache          → docs/plans/phase-3/feat-cache/plan.md

### Phase 4 — MCP Server & Tools

[x] feat-server-core    → docs/plans/phase-4/feat-server-core/plan.md
[x] feat-permissions    → docs/plans/phase-4/feat-permissions/plan.md
[x] feat-pr-tools       → docs/plans/phase-4/feat-pr-tools/plan.md
[x] feat-repo-tools     → docs/plans/phase-4/feat-repo-tools/plan.md
[x] feat-search-tools   → docs/plans/phase-4/feat-search-tools/plan.md

### Phase 5 — Testing & Release

[ ] feat-unit-tests     → docs/plans/phase-5/feat-unit-tests/plan.md
[ ] feat-ci             → docs/plans/phase-5/feat-ci/plan.md
[ ] feat-npx-release    → docs/plans/phase-5/feat-npx-release/plan.md

## Done

- Initial repo scaffold (package.json, tsconfig.json, eslint, prettier, husky, docs/)
- CLAUDE.md + claude-ref/ routing & reference docs authored
- docs/plans/ phase directories created with plan.md for every feat
- scripts/ directory with git hooks and security validation
- types/ scaffold: common, logger, config, cache, bitbucket, mcp, errors, index
- src/config.ts with zod validation, HTTPS enforcement, masked summary
- src/logger.ts with redaction, level gating, structured JSON to stderr
- src/cache.ts with TTL, prefix invalidation, disabled mode
- src/bitbucket/ client with retry, backoff, jitter, rate-limit, Cloud/Server detection, auth
- src/bitbucket/api/ pull-requests, repositories, search resource modules
- src/permissions.ts with action enforcement
- src/tools/ pr-tools (11), repo-tools (6), search-tools (2) — all 20 tools implemented
- src/server.ts MCP server with full tool registration
- src/index.ts entry point with stdio transport, graceful shutdown
- tsconfig updated: paths @types, bundler resolution, noUncheckedIndexedAccess
- typecheck passes with zero errors

## Blockers / decisions pending

- feat-openapi-codegen: yaml files + openapi-typescript + drift check — not yet done
- Phase 5: testing, CI, NPX release — all pending
- `README.md` uses `docs/<description>` but branch standard is `doc/<description>` — reconcile
- `SECURITY.md` contains `[your-email]` placeholder
