# feat-permissions

Phase: 4 | Status: [x] done
Depends on: feat-server-core
Ref: `claude-ref/tools.md`, `claude-ref/security.md`

## Goal

Declarative permission gate evaluated before any tool calls the client.

## In scope

- `src/permissions.ts` — parses `BITBUCKET_ALLOWED_ACTIONS` into `Set<Action>`.
- Tool decorator / helper `requirePermission(action)`.

## Out of scope

- Role-based multi-user perms.
- Dynamic permission updates.

## Design

- `type Action = 'read_pr'|'write_pr'|'manage_pr'|'search_code'|'read_repo'|'read_project'`.
- Empty / unset env var → all allowed.
- Comma-separated, whitespace-tolerant parser with strict membership check.
- Unknown action in env var → fail-fast at config load.

## Follow-up (phase 6): project/repo scoping

- `BITBUCKET_ALLOWED_PROJECTS` / `BITBUCKET_ALLOWED_REPOS` parsed in `config.ts`
  into normalized lowercase sets (empty = all allowed).
- `requireScope(config, project, repo?)` + `ScopeDeniedError` in
  `src/permissions.ts`, called after `requirePermission` in every
  project/repo-scoped tool. Repo entries match `project/repo` or a bare `repo`.

## Tasks

- [x] `types/permissions.ts` — `Action` union
- [x] parser + validation in `config.ts`
- [x] `requirePermission` helper used by every tool
- [x] tests: parse, reject unknown, enforce permission + scope
      (`test/config.test.mjs`, `test/permissions.test.mjs`)

## Definition of done

- [x] every tool calls `requirePermission` before `client.*`
- [ ] ≥ 80% coverage
- [x] TRACK.md updated
