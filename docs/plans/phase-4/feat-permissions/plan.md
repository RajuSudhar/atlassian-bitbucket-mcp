# feat-permissions

Phase: 4  |  Status: [ ] todo
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

## Tasks
- [ ] `types/permissions.ts` — `Action` union
- [ ] parser + validation in `config.ts`
- [ ] `requirePermission` helper used by every tool
- [ ] tests: parse, reject unknown, enforce on each tool category

## Definition of done
- [ ] every tool calls `requirePermission` before `client.*`
- [ ] ≥ 80% coverage
- [ ] TRACK.md updated
