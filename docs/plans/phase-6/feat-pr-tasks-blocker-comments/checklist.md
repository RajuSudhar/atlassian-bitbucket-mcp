# Implementation Checklist

## Phase 1: OpenAPI + Types

- [ ] Add GET `/blocker-comments` path to `openapi/bitbucket-server.yaml` with `state` query param (enum: OPEN, RESOLVED)
- [ ] Confirm `Comment`, `CommentState`, `PagedResponseMeta` schemas exist in YAML (read-only verification)
- [ ] Run `pnpm run types:gen` to regenerate `types/generated/bitbucket-server.d.ts`
- [ ] Verify `types/bitbucket.ts` exports `BitbucketComment` and `BitbucketPagedResponse<T>` (no changes required)
- [ ] Run `pnpm run typecheck` → passes
- [ ] Commit OpenAPI changes atomically with Phase 2 client changes (same-commit rule)

## Phase 2: Client — Pagination Loop + State Filter

- [ ] Update `listTasks` signature in `src/bitbucket/api/pull-requests.ts` to add `state?: 'OPEN' | 'RESOLVED'` parameter
- [ ] Replace `listTasks` body (lines 198-211) with pagination loop:
  - [ ] Initialize `allTasks: BitbucketComment[]`, `currentStart`, `isLastPage`, `pageCount`
  - [ ] Loop while `!isLastPage`: call `/blocker-comments`, accumulate `page.values`, advance `currentStart` via `nextPageStart`
  - [ ] Include `state` in `queryParams` when `state !== undefined`
  - [ ] Add safety check: `isLastPage=false && nextPageStart=undefined` → log warning, break loop
- [ ] Add client-side fallback filter: `filter(comment.state === state)` when `state !== undefined`
- [ ] Add logging: `debug` for start/page/filter, `info` for completion with `totalTasks`, `pagesRead`
- [ ] Confirm `BitbucketPagedResponse` imported from `@types/bitbucket`
- [ ] Confirm `log` imported from `../logger.js`
- [ ] Retain `collectBlockerComments` helper (lines 241-250) unchanged
- [ ] Run `pnpm run typecheck` → passes
- [ ] Run `pnpm run lint:all` → passes

## Phase 3: Schema + Tool Integration

- [ ] Add `listTasksShape` to `src/tools/schemas.ts`:
  - [ ] Spread `prRefShape` (project, repo, prId)
  - [ ] Add `state: z.enum(['OPEN','RESOLVED','ALL']).default('ALL')`
  - [ ] Include `limit` and `start` (optional pagination fields)
  - [ ] Export as `const` (type: `ZodRawShape`)
- [ ] Update `bitbucket_list_pr_tasks` handler in `src/tools/pr-tools.ts`:
  - [ ] Parse `z.object(listTasksShape)` instead of `prPaginatedShape`
  - [ ] Map `input.state === 'ALL'` → `stateParam = undefined`, else pass `input.state`
  - [ ] Pass `stateParam` as 4th argument to `prApi.listTasks`
  - [ ] Log `state` in start/end messages
  - [ ] Log `resultCount` in end message
- [ ] Add `listTasksShape` to imports in `src/tools/pr-tools.ts`
- [ ] Update `bitbucket_list_pr_tasks` entry in `src/tools/registry.ts`:
  - [ ] Replace `inputSchema: prPaginatedShape` with `listTasksShape`
  - [ ] Update `description` to mention state filter (OPEN, RESOLVED, ALL)
- [ ] Add `listTasksShape` to imports in `src/tools/registry.ts`
- [ ] Run `pnpm run typecheck` → passes
- [ ] Run `pnpm run lint:all` → passes

## Phase 4: Tests

- [ ] Extend `test/schemas.test.mjs` with `listTasksShape` tests:
  - [ ] Accepts `state: 'OPEN'` → parsed as `'OPEN'`
  - [ ] Accepts `state: 'RESOLVED'` → parsed as `'RESOLVED'`
  - [ ] Accepts `state: 'ALL'` → parsed as `'ALL'`
  - [ ] Defaults to `'ALL'` when state omitted
  - [ ] Rejects `state: 'INVALID'` → ZodError
  - [ ] Rejects `state: null` → ZodError
  - [ ] Accepts optional `limit` and `start`
- [ ] Create `test/pull-requests.test.mjs` with `PullRequestsApi.listTasks` tests:
  - [ ] Pagination test: 2-page response (25 + 10 tasks) → returns 35 tasks, 2 requests
  - [ ] State query param test: `state='RESOLVED'` → query includes `state=RESOLVED`
  - [ ] State omitted test: `state=undefined` → query excludes `state`
  - [ ] Client-side filter test: server returns mixed states, client filters by state
  - [ ] Pagination safety test: `isLastPage=false && nextPageStart=undefined` → terminates loop
  - [ ] OPEN filter test: filters OPEN tasks correctly
- [ ] Run `pnpm test` → all tests pass (13 new + existing)

## Phase 5: Verification

- [ ] Run `pnpm run validate` → passes (typecheck + lint)
- [ ] Run `pnpm test` → all tests pass
- [ ] Live test setup:
  - [ ] Confirm Bitbucket Server/DC instance: `bitbucket.juspay.net` (≥7.2)
  - [ ] Identify test PR with comment 1273928 (system-user, BLOCKER, RESOLVED)
  - [ ] Configure MCP server with valid `BITBUCKET_URL`, `BITBUCKET_TOKEN`, scope allow-lists
  - [ ] Connect MCP client (Claude Desktop or CLI)
- [ ] Live test: `bitbucket_list_pr_tasks` with `state: 'ALL'` → includes comment 1273928
- [ ] Live test: `bitbucket_list_pr_tasks` with `state: 'RESOLVED'` → includes 1273928
- [ ] Live test: `bitbucket_list_pr_tasks` with `state: 'OPEN'` → excludes 1273928
- [ ] Live test: `bitbucket_resolve_pr_task` with `{taskId: 1273928, state: 'OPEN', version}` → reopens task
- [ ] Live test (if applicable): PR with >25 tasks → pagination returns all tasks, logs show multiple pages
- [ ] Confirm server logs (stderr) show correct `operation`, `state`, `totalTasks`, `pagesRead`

## Auxiliary Tasks

- [ ] Update `docs/plans/TRACK.md`:
  - [ ] Add `[~] feat-pr-tasks-blocker-comments → docs/plans/phase-6/feat-pr-tasks-blocker-comments/plan.md` under Phase 6
- [ ] Create `docs/plans/phase-6/feat-pr-tasks-blocker-comments/changelog.md`:
  - [ ] Document superseding the `/activities`-scanning approach from `feat-pr-tasks`
  - [ ] Category: Plan Incorrect / External Dependency (legacy endpoint limitation + pagination gap)
  - [ ] Note: Root-level BLOCKER comments missed due to single-page `/activities` scan; `/blocker-comments` endpoint (Server/DC 7.2+) is authoritative

## Verification Summary

| Check                 | Command                                       | Expected Result          |
| --------------------- | --------------------------------------------- | ------------------------ |
| Typecheck             | `pnpm run typecheck`                          | Found 0 errors           |
| Lint                  | `pnpm run lint:all`                           | No lint errors           |
| Unit tests            | `pnpm test`                                   | All tests pass (~20+)    |
| Build                 | `pnpm run build`                              | Completes without errors |
| Live test: ALL        | `bitbucket_list_pr_tasks {state: 'ALL'}`      | Includes comment 1273928 |
| Live test: RESOLVED   | `bitbucket_list_pr_tasks {state: 'RESOLVED'}` | Includes 1273928         |
| Live test: OPEN       | `bitbucket_list_pr_tasks {state: 'OPEN'}`     | Excludes 1273928         |
| Live test: Reopen     | `bitbucket_resolve_pr_task {state: 'OPEN'}`   | Task reopened            |
| Live test: Pagination | `bitbucket_list_pr_tasks` (PR >25 tasks)      | All tasks returned       |

## Commit Strategy

**Single atomic commit** (Phases 1-4):

- OpenAPI schema update (`openapi/bitbucket-server.yaml`)
- Type regeneration (`types/generated/bitbucket-server.d.ts`)
- Client implementation (`src/bitbucket/api/pull-requests.ts`)
- Schema definition (`src/tools/schemas.ts`)
- Tool handler update (`src/tools/pr-tools.ts`)
- Registry update (`src/tools/registry.ts`)
- Tests (`test/schemas.test.mjs`, `test/pull-requests.test.mjs`)

**Commit message**:

```text
feat(pr-tasks): fix BLOCKER task enumeration + add state filter

Replace single-page /activities scan in listTasks with fully-paginated
/blocker-comments endpoint to capture ALL BLOCKER comments (including
root-level system-authored tasks). Add state filter (OPEN/RESOLVED/ALL)
to bitbucket_list_pr_tasks.

Fixes: Root-level BLOCKER comments beyond page 1 silently dropped.
Endpoint: GET /blocker-comments (Server/DC 7.2+) with state query param.
Fallback: Client-side filter for DC versions ignoring query param.

- openapi: add /blocker-comments GET path with state enum
- client: listTasks pagination loop (isLastPage/nextPageStart)
- schema: listTasksShape with state enum (default: ALL)
- tool: map state='ALL' to undefined, pass OPEN/RESOLVED to API
- tests: schema validation + pagination + state filter unit tests

Supersedes /activities-scanning approach from feat-pr-tasks.
```

**Second commit** (Phase 5 + docs):

- TRACK.md update
- changelog.md

**Commit message**:

```text
docs: add feat-pr-tasks-blocker-comments to TRACK + changelog

Track follow-up feature fixing BLOCKER task enumeration.
Changelog documents Plan Incorrect category (legacy endpoint + pagination gap).
```

## Notes

- Phase 1-4 MUST be committed atomically (OpenAPI + types same-commit rule).
- Phase 5 is verification-only (no code changes).
- TRACK.md and changelog.md can be committed separately after code lands.
- Live testing requires Bitbucket Server/DC ≥7.2 with `/blocker-comments` endpoint.
- If endpoint unavailable (404), future hardening phase adds fallback to `/activities`.
