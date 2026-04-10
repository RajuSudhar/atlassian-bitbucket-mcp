# CLAUDE.md

TypeScript MCP server for Bitbucket Cloud + Server/DC. Node>=20, pnpm, PAT auth, in-memory cache, local-first NPX.

## Hard rules (always)

- `type` only, never `interface` (except class extend / decl merge)
- Types in `types/` at repo root; import via `@types`
- `log()` from `src/logger.ts`; no `console.*`
- Never log/emit `BITBUCKET_TOKEN`; HTTPS only
- No `any`, no emojis, no `--no-verify`
- Exact pinned deps; security-check before add; both lockfiles in sync
- Touching `types/bitbucket.ts` → update `openapi/*.yaml` in same commit

## Routing — read before acting

| Task | Ref |
|---|---|
| Adding/editing types, naming, imports | `claude-ref/typescript.md` |
| Any log statement, critical path | `claude-ref/logger.md` |
| New MCP tool / tool change | `claude-ref/tools.md` |
| Bitbucket HTTP, retry, auth, Cloud vs Server | `claude-ref/client.md` |
| Cache key, TTL, invalidation | `claude-ref/cache.md` |
| Writing/running tests | `claude-ref/testing.md` |
| Branch name, commit message | `claude-ref/branching.md` |
| Adding a dep, token handling | `claude-ref/security.md` |
| Lockfile ops, pnpm/npm | `claude-ref/packages.md` |
| OpenAPI edit, type generation | `claude-ref/openapi.md` |
| Starting a feature | `docs/plans/TRACK.md` → phase dir |

## Plans & track

- Roadmap: `docs/plans/TRACK.md` (done / in-progress / todo)
- Phase plans: `docs/plans/phase-<n>/feat-<slug>/plan.md`
- Never start a feature without opening its `plan.md` and updating `TRACK.md`

## Commands

```
pnpm install | build | watch | typecheck | lint:all | format:all | validate | sync:locks | branch:create
./scripts/check-package-security.sh <pkg>
pnpm run types:gen   # openapi → types (phase 1)
```

Source docs (human-readable, verbose): `README.md`, `docs/ARCHITECTURE.md`, `docs/CODING-STANDARDS.md`, `docs/BRANCH-MANAGEMENT.md`, `docs/SECURITY.md`, `docs/PACKAGE-MANAGERS.md`. Prefer `claude-ref/` for execution.
