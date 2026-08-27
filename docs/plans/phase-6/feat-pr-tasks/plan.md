# feat-pr-tasks

Phase: 6 | Status: [x] done
Depends on: feat-pr-tools (phase 4)
Ref: `claude-ref/tools.md`, `claude-ref/client.md`, `claude-ref/openapi.md`

## Goal

Add MCP tool support for Bitbucket Server/DC pull-request "tasks" (checklist
TODO items) — create a task, list tasks on a PR, and resolve/reopen or delete
a task.

## In scope

- Server/DC only. All existing PR operations in `PullRequestApi` are
  Server/DC-only today (Cloud PR support is unimplemented at the API layer);
  tasks follow the same instance scope rather than adding net-new Cloud PR
  support as a side effect.
- New tools:
  - `bitbucket_create_pr_task` — create a task (`write_pr` permission),
    optionally as a reply to an existing comment.
  - `bitbucket_list_pr_tasks` — list tasks on a PR (`read_pr` permission).
  - `bitbucket_resolve_pr_task` — set a task's state to `RESOLVED` or `OPEN`
    (`write_pr` permission).
  - `bitbucket_delete_pr_task` — delete a task (`write_pr` permission).

## Out of scope

- Bitbucket Cloud tasks (Cloud has no direct task concept — closest analog
  is a comment marker; not pursued here).

## API notes (Bitbucket Server/DC REST 1.0) — revised after live testing

The original design targeted the documented legacy `/rest/api/1.0/tasks`
resource (`RestTask`, anchored via `{ anchor: { id, type: COMMENT } }`). That
was implemented, built, deployed to the local launchd service, and
live-tested against `BZ/nimble` PR 3641 on `bitbucket.juspay.net` — the live
server rejected it:

```text
"Tasks are now managed using Comments with severity BLOCKER. Call
POST /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments
instead, passing the attribute 'severity' set to 'BLOCKER'."
```

This confirmed the newer Bitbucket Server/DC major versions (7.0+, which
juspay runs) have fully retired the legacy task resource server-side, not
just deprecated it as documentation suggested. The implementation was
reworked to model a task as a normal PR comment with `severity: BLOCKER`
instead — the existing `Comment` schema in `openapi/bitbucket-server.yaml`
already had `severity` (`NORMAL`/`BLOCKER`) and `state` (`OPEN`/`RESOLVED`)
fields, so **no OpenAPI schema changes were needed** for the final design.

| Operation    | Method | Path                                                                          |
| ------------ | ------ | ----------------------------------------------------------------------------- |
| Create task  | POST   | `/projects/{project}/repos/{repo}/pull-requests/{prId}/comments`              |
| List tasks   | GET    | `/projects/{project}/repos/{repo}/pull-requests/{prId}/activities` (filtered) |
| Resolve task | PUT    | `/projects/{project}/repos/{repo}/pull-requests/{prId}/comments/{commentId}`  |
| Delete task  | DELETE | `/projects/{project}/repos/{repo}/pull-requests/{prId}/comments/{commentId}`  |

Create request body: `{ "text": "...", "severity": "BLOCKER", "parent"?: { "id": <commentId> } }`.
Resolve/reopen body: `{ "state": "OPEN" | "RESOLVED", "version": <n> }` (same
pattern as `resolveComment`). Delete takes `?version={n}` as a query param.
There is no dedicated "list tasks" endpoint on Server/DC — tasks are
discovered by walking the PR activity feed and filtering comments (including
nested replies) whose `severity === 'BLOCKER'`.

## Design

- `PullRequestApi` (`src/bitbucket/api/pull-requests.ts`) gains:
  `createTask(project, repo, prId, text, parentCommentId?)`,
  `listTasks(project, repo, prId, limit?, start?)` (walks `getActivities`
  output via a local `collectBlockerComments` helper), `setTaskState(project,
repo, prId, commentId, state, version)`, `deleteTask(project, repo, prId,
commentId, version)`.
- `schemas.ts` gains `createPrTaskShape`, `resolvePrTaskShape`,
  `deletePrTaskShape` — `bitbucket_list_pr_tasks` reuses the existing
  `prPaginatedShape` (identical fields, no new shape needed). Resolve/delete
  require `version` (optimistic locking), matching `resolveComment`.
- `pr-tools.ts` gains four handlers following the existing execution
  contract (parse → `requirePermission` → `requireScope` → log start → call
  → cache invalidate on write → log end → `textResult`/`errorResult`). Cache
  invalidation reuses the existing `invalidatePrCache` prefix helper — PR
  tools don't cache reads today (only repo-tools does), so no new cache key
  was needed.
- `registry.ts` gains four entries, `bitbucket_` prefixed, alongside the
  existing PR tools.
- `types/bitbucket.ts` gains one addition: `BitbucketCommentState` (alias for
  the existing `CommentState` schema) — used by `setTaskState`'s parameter
  type. No new OpenAPI schemas.

## Tasks

- [x] `PullRequestApi.createTask` / `.listTasks` / `.setTaskState` /
      `.deleteTask`
- [x] `schemas.ts` — three new zod shapes
- [x] `pr-tools.ts` — four new handlers
- [x] `registry.ts` — four new entries
- [x] tests: `test/schemas.test.mjs` covering new shape parse/reject behavior
      (no `pr-tools.test.mjs` precedent exists for any PR tool handler yet —
      matches current test scope of config/permissions/cache/logger only)
- [x] `README.md` tool table updated
- [x] live-tested against `BZ/nimble` PR 3641 on the running Server/DC
      instance: create (anchored as a reply) → list (found the new task plus
      4 pre-existing repo-merge-check tasks) → resolve (state → `RESOLVED`,
      version bumped) → delete (confirmed gone from a re-list) → input
      validation (empty `text` rejected at the MCP layer)

## Definition of done

- [x] all four tools call `requirePermission` + `requireScope` before
      `client.*`
- [x] typecheck + lint + tests pass (41/41)
- [x] TRACK.md updated
- [x] verified end-to-end against a live Server/DC PR
- [x] rebuilt and redeployed to the `com.juspay.bitbucket-mcp` launchd
      service (`scripts/install-macos-service.sh`)
