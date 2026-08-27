# Overview — Fix system/root BLOCKER task enumeration + task-state filter

## Goal

Replace the single-page `/activities` scan in `listTasks` with the correct, fully-paginated `/blocker-comments` endpoint to capture ALL BLOCKER comments (including root-level system-authored tasks beyond page 1), and add a `state` filter to `bitbucket_list_pr_tasks` enabling OPEN/RESOLVED/ALL filtering at the tool level.

## Scope

### In Scope

1. Add GET `/blocker-comments` endpoint to `openapi/bitbucket-server.yaml` with `state` query param; regen types.
2. Rewrite `listTasks` in `src/bitbucket/api/pull-requests.ts` to call `/blocker-comments` with full pagination loop (accumulate across `isLastPage` / `nextPageStart`), accept optional `state?: 'OPEN' | 'RESOLVED'` param mapped to query param with client-side fallback filtering for older DC versions.
3. Extend `src/tools/schemas.ts` with `listTasksShape` adding `state: z.enum(['OPEN','RESOLVED','ALL']).default('ALL')`; update `bitbucket_list_pr_tasks` handler in `src/tools/pr-tools.ts` to pass the state through (map 'ALL' to no filter); update `src/tools/registry.ts` tool description.
4. Extend `test/schemas.test.mjs` for state enum validation; add client-level unit test in `test/pull-requests.test.mjs` for pagination loop (mock 2+ pages with BLOCKER on page 2) and state filtering.
5. Verification checklist for typecheck, lint, unit tests, and live test against `bitbucket.juspay.net` confirming system-user task id 1273928 (RESOLVED BLOCKER) appears correctly.

### Out of Scope

- Changes to `/tasks` endpoint handling (deprecated for root-level tasks).
- Permission model changes (transitionable already enforced).
- `setTaskState` / `deleteTask` changes (already operate on correct `/comments/{id}` endpoint).
- `collectBlockerComments` removal (retained for nested-reply flattening if `/blocker-comments` returns threaded structures).

## Root Cause

`listTasks` (lines 198-211 in `src/bitbucket/api/pull-requests.ts`) calls `getActivities` ONCE with default `limit=25, start=0`, no pagination loop. Atlassian's legacy `/tasks` endpoint EXCLUDES root-level BLOCKER comments, which are typically authored by `bitbucket.system-user`. The correct endpoint is `/blocker-comments` (Server/DC 7.2+), returning ALL BLOCKER comments (root + reply) with pagination support and optional `state` query filter.

## Success Criteria

- `pnpm run validate` passes (typecheck + lint).
- `pnpm test` passes (new test/schemas.test.mjs + test/pull-requests.test.mjs tests).
- Live call to `bitbucket_list_pr_tasks` with `state: 'ALL'` returns comment id 1273928 (system-user, severity BLOCKER, state RESOLVED).
- Live call with `state: 'RESOLVED'` includes 1273928; `state: 'OPEN'` excludes it.
- `bitbucket_resolve_pr_task` can reopen task 1273928 via `{state: 'OPEN', version}` when `transitionable: true`.

## Dependencies

- Bitbucket Server/DC 7.2+ for `/blocker-comments` endpoint.
- `openapi/*.yaml` → `types/generated/*.d.ts` → `types/bitbucket.ts` roundtrip enforced by pre-commit hook.
- `pnpm run types:gen` (scripts/gen-types.sh) for type regeneration.

## Architecture

### Before (Buggy)

```text
bitbucket_list_pr_tasks
  ↓
prApi.listTasks(project, repo, prId, limit=25, start=0)
  ↓
GET /projects/{p}/repos/{r}/pull-requests/{id}/activities?limit=25&start=0
  ↓ (single page)
BitbucketPagedResponse<BitbucketActivity> { values: [...], isLastPage, nextPageStart }
  ↓
collectBlockerComments(activity.comment, tasks) → filter severity==='BLOCKER'
  ↓
Return BitbucketComment[] (max 25 tasks, root-level BLOCKER comments likely absent)
```

Root-level BLOCKER comments beyond page 1 are silently dropped; system-user tasks are typically root-level.

### After (Fixed)

```text
bitbucket_list_pr_tasks {state: 'ALL'|'OPEN'|'RESOLVED'}
  ↓
prApi.listTasks(project, repo, prId, state?: 'OPEN'|'RESOLVED', limit?, start?)
  ↓
GET /projects/{p}/repos/{r}/pull-requests/{id}/blocker-comments?state={state}&limit={limit}&start={start}
  ↓ (paginated loop until isLastPage===true)
BitbucketPagedResponse<BitbucketComment> { values: [...], isLastPage, nextPageStart }
  ↓ (accumulate across pages)
Optional client-side filter by comment.state (fallback for DC versions ignoring query param)
  ↓
Return BitbucketComment[] (all BLOCKER comments, root + reply, filtered by state)
```

State transitions (resolve/reopen) continue via existing `setTaskState` → PUT `/comments/{id}` {state, version}.

## Files Modified

| File                                    | Change                                                                                                                | Reason                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `openapi/bitbucket-server.yaml`         | Add `/blocker-comments` path, `state` query param, response schema                                                    | SSOT for types; enforce same-commit rule with types/bitbucket.ts |
| `types/generated/bitbucket-server.d.ts` | Auto-regenerated via `pnpm run types:gen`                                                                             | Derived from openapi/\*.yaml                                     |
| `types/bitbucket.ts`                    | (No change expected; BitbucketComment already exported)                                                               | Confirm existing export covers new endpoint response             |
| `src/bitbucket/api/pull-requests.ts`    | Rewrite `listTasks` body (lines 198-211) to call `/blocker-comments` with pagination loop, add optional `state` param | Fix root-level task enumeration + enable state filtering         |
| `src/tools/schemas.ts`                  | Add `listTasksShape` with `state: z.enum(['OPEN','RESOLVED','ALL']).default('ALL')`                                   | New input schema for list_pr_tasks                               |
| `src/tools/pr-tools.ts`                 | Update `bitbucket_list_pr_tasks` handler (~446-476) to parse `listTasksShape`, pass `state` to `prApi.listTasks`      | Wire state filter through tool layer                             |
| `src/tools/registry.ts`                 | Update `bitbucket_list_pr_tasks` entry: use `listTasksShape`, update description mentioning state filter              | Registry SSOT for tool definitions                               |
| `test/schemas.test.mjs`                 | Add tests for `listTasksShape` state enum (default 'ALL', rejects invalid)                                            | Schema validation coverage                                       |
| `test/pull-requests.test.mjs`           | New file: test pagination loop (mock 2-page response), test state filtering (query + fallback)                        | Client-level unit tests                                          |

## Files NOT Modified

| File                                                                  | Reason                                                                                  |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/bitbucket/api/pull-requests.ts` → `setTaskState` (lines 213-225) | Already uses correct `/comments/{id}` endpoint; version-based optimistic locking intact |
| `src/bitbucket/api/pull-requests.ts` → `deleteTask` (lines 227-238)   | Already uses correct `/comments/{id}` endpoint                                          |
| `src/permissions.ts`                                                  | No permission model changes (transitionable enforcement already correct)                |
| `src/config.ts`, `types/config.ts`                                    | No config schema changes required                                                       |
| `src/tools/pr-tools.ts` → other handlers                              | Only `bitbucket_list_pr_tasks` affected                                                 |

## Data Flow

```text
MCP Client
   ↓
bitbucket_list_pr_tasks {project, repo, prId, state: 'RESOLVED', limit: 50}
   ↓ (parse listTasksShape, requirePermission, requireScope)
src/tools/pr-tools.ts handler
   ↓ (map state: 'RESOLVED' → query param; 'ALL' → no query param)
prApi.listTasks(project, repo, prId, state='RESOLVED', limit=50, start=0)
   ↓
PullRequestsApi.listTasks
   ↓ (loop: start=0, 50, 100, ... until isLastPage)
GET /rest/api/1.0/projects/FOO/repos/bar/pull-requests/42/blocker-comments?state=RESOLVED&limit=50&start={start}
   ↓
Bitbucket Server/DC 7.2+ returns BitbucketPagedResponse<BitbucketComment>
   ↓ (accumulate values across pages)
Client-side fallback filter: comment.state === 'RESOLVED' (for DC versions ignoring query param)
   ↓
Return BitbucketComment[] (all RESOLVED BLOCKER comments, including root-level system tasks)
   ↓
McpToolResult {content: [{type: 'text', text: JSON.stringify(result)}]}
   ↓
MCP Client receives full task list
```

## Critical Notes

- **CRITICAL**: Every change to `types/bitbucket.ts` MUST update `openapi/*.yaml` in the SAME commit. Pre-commit hook enforces drift detection via `scripts/check-types-drift.sh`.
- **CRITICAL**: The `/blocker-comments` endpoint is version-gated (Server/DC 7.2+). For older deployments, the pagination fix is still valid but root-level task retrieval may remain incomplete if the instance lacks this endpoint. The client should log a warning if a 404 is encountered and fall back to `/activities` (future hardening, not in this phase).
- **IMPORTANT**: `collectBlockerComments` is retained for nested-reply flattening if `/blocker-comments` returns threaded comment structures. If the endpoint returns a flat array, `collectBlockerComments` becomes a no-op filter (severity check) applied after pagination.
- **IMPORTANT**: State filter client-side fallback ensures compatibility with DC versions that accept but ignore the `state` query param. The query param is an optimization; the client always validates `comment.state` against the requested filter.
