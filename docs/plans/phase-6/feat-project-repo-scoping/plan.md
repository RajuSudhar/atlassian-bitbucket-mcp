# feat-project-repo-scoping

Phase: 6 | Status: [x] done
Depends on: feat-permissions (phase 4)
Ref: `claude-ref/tools.md`, `claude-ref/typescript.md`

## Goal

Let a single deployment restrict which Bitbucket projects/repos its tools may
touch, independent of the action-level `BITBUCKET_ALLOWED_ACTIONS` gate. Lands
first among the phase-6 features since every other phase-6 tool change builds
on top of the same `requireScope` call inserted into each handler.

## In scope

- `BITBUCKET_ALLOWED_PROJECTS` / `BITBUCKET_ALLOWED_REPOS` env vars, parsed by
  `parseScopeList()` in `src/config.ts` into normalized lowercase
  `ReadonlySet<string>`s. Empty (unset) → all allowed.
- `types/config.ts` — `Config.allowedProjects` / `Config.allowedRepos`.
- `requireScope(config, project, repo?)` + `ScopeDeniedError` in
  `src/permissions.ts`. A repo entry matches either a fully qualified
  `project/repo` or a bare `repo` slug (allowed under any permitted project).
  Comparison is case-insensitive.
- `requireScope` called immediately after `requirePermission` in every
  project/repo-scoped tool handler: all of `pr-tools.ts`, `repo-tools.ts`,
  `search-tools.ts`.

## Out of scope

- Any other phase-6 feature (PR tasks, inline-comment hardening, HTTP
  transport) — those land as their own branches/PRs on top of this one.

## Design

- `parseScopeList` mirrors the existing `parseAllowedActions` shape: split on
  comma, trim, lowercase, drop empties, dedupe via `Set`.
- `requireScope` throws `ScopeDeniedError` (mirrors `PermissionDeniedError`)
  naming the denied `project` or `project/repo` and the env var responsible,
  without leaking the full allow-list contents.
- Project check runs whenever a `project` argument exists; repo check only
  runs when both a `repo` argument is present and `allowedRepos` is non-empty.
- `configSummary()` reports `allowedProjects`/`allowedRepos` as `'all'` when
  the set is empty, matching the existing `allowedActions` summary style, so
  a masked startup log line stays readable without redacting anything
  sensitive (project/repo keys are not secrets).

## Tasks

- [x] `parseScopeList` + `BITBUCKET_ALLOWED_PROJECTS`/`_REPOS` in `config.ts`
- [x] `Config.allowedProjects` / `Config.allowedRepos` in `types/config.ts`
- [x] `requireScope` + `ScopeDeniedError` in `src/permissions.ts`
- [x] `requireScope` call added to every scoped handler in `pr-tools.ts`,
      `repo-tools.ts`, `search-tools.ts`
- [x] `test/permissions.test.mjs` — allow-list empty/allow/deny, qualified vs.
      bare repo match, project-denies-before-repo-check ordering
- [x] `test/config.test.mjs` — parsing + case-normalization of both env vars
- [x] `.env.example` / `README.md` — allow-list documentation

## Definition of done

- [x] every project/repo-scoped tool calls `requireScope` after
      `requirePermission`
- [x] typecheck + lint + tests pass
- [x] TRACK.md updated
