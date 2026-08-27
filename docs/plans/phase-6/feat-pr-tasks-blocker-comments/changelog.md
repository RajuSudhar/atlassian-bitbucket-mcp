# Changelog — feat-pr-tasks-blocker-comments

## Context

This feature supersedes the `/activities`-based task enumeration approach from `feat-pr-tasks` (docs/plans/phase-6/feat-pr-tasks/plan.md). The original plan scanned PR activities to extract BLOCKER-severity comments but suffered from two critical issues:

1. **Pagination gap**: `listTasks` made a single call to `getActivities` with default `limit=25, start=0`, never looping over `nextPageStart` / `isLastPage`. BLOCKER comments beyond the first page were silently dropped.
2. **Endpoint limitation**: The legacy `/tasks` endpoint (Bitbucket Server/DC <7.2) EXCLUDES root-level BLOCKER comments. System-authored tasks (e.g., `bitbucket.system-user`) are typically root-level, making them invisible via `/activities` + `/tasks`.

Atlassian documentation confirms the correct endpoint is:

- **GET** `/rest/api/1.0/projects/{p}/repos/{r}/pull-requests/{id}/blocker-comments` (Server/DC 7.2+)
- Returns ALL BLOCKER comments (root + nested), properly paginated.
- Supports optional `state` query parameter (`OPEN`, `RESOLVED`).

This plan rewrites `listTasks` to use `/blocker-comments` with full pagination and adds a `state` filter to the `bitbucket_list_pr_tasks` tool.

## Category

- **Plan Incorrect**: Original plan assumed `/activities` enumeration would capture all tasks; missed root-level comment exclusion.
- **External Dependency**: Legacy endpoint (`/tasks`) limitation not documented in initial research; `/blocker-comments` endpoint requires Server/DC 7.2+.

## Issues Addressed

### Issue 1: Single-page activity scan

**What happened**: `listTasks` (src/bitbucket/api/pull-requests.ts, lines 198-211) called `getActivities` once with `limit=25, start=0`, never looping for additional pages. PRs with >25 BLOCKER comments lost data.

**Root cause**: Original plan (feat-pr-tasks) spec'd activity enumeration but omitted pagination loop. Implementer followed spec literally, unaware of typical pagination patterns in the codebase.

**Resolution**: Phase 2 replaces `listTasks` body with full pagination loop (accumulate `values` arrays across pages until `isLastPage === true`), following `nextPageStart` advancement pattern used by other paginated APIs in the codebase.

**Deviation**: Major — changes data retrieval flow from single-page to multi-page accumulation.

**Plan updated**: Yes — Phase 2 includes complete pagination loop implementation with safety checks (`nextPageStart=undefined` guard).

### Issue 2: Root-level BLOCKER comment exclusion

**What happened**: System-authored BLOCKER tasks (e.g., comment id 1273928, author `bitbucket.system-user`) were absent from `listTasks` results even on a fresh PR with <25 activities.

**Root cause**: The `/activities` endpoint returns activity objects where `activity.comment` is present only for COMMENT-type activities. Root-level tasks authored by system accounts often lack corresponding activities or are filtered server-side. The legacy `/tasks` endpoint explicitly excludes root-level tasks per Atlassian docs.

**Resolution**: Phase 1 adds `/blocker-comments` GET path to OpenAPI schema. Phase 2 switches `listTasks` from `GET /activities` to `GET /blocker-comments`, which returns ALL BLOCKER comments (root + nested) directly as a flat array (or threaded structure flattened by `collectBlockerComments`).

**Deviation**: Major — changes endpoint from `/activities` to `/blocker-comments`, altering API surface and response shape.

**Plan updated**: Yes — Phase 1 and Phase 2 documents new endpoint, pagination, and client-side fallback filtering.

### Issue 3: Missing state filter

**What happened**: Original `bitbucket_list_pr_tasks` tool returned all BLOCKER comments (OPEN + RESOLVED) with no filtering capability. Users needing only unresolved tasks had to filter client-side.

**Root cause**: Original plan did not specify state filtering; tool schema used generic `prPaginatedShape` without state field.

**Resolution**: Phase 3 adds `listTasksShape` with `state: z.enum(['OPEN','RESOLVED','ALL']).default('ALL')`. Handler maps `'ALL'` to `undefined` (omit query param), passes `'OPEN'`/`'RESOLVED'` directly to `prApi.listTasks`. Client-side fallback filter ensures correctness for DC versions that ignore the query param.

**Deviation**: Minor — new feature (state filter) not in original plan, but additive (backward-compatible default of `'ALL'`).

**Plan updated**: Yes — Phase 3 and Phase 4 document schema, handler logic, and tests.

## Changes Summary

| Phase | Files Modified                                                           | Nature of Change                                            |
| ----- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 1     | `openapi/bitbucket-server.yaml`, `types/generated/bitbucket-server.d.ts` | Add `/blocker-comments` path, regenerate types              |
| 2     | `src/bitbucket/api/pull-requests.ts`                                     | Rewrite `listTasks` (pagination loop, state param, logging) |
| 3     | `src/tools/schemas.ts`, `src/tools/pr-tools.ts`, `src/tools/registry.ts` | Add `listTasksShape`, update handler, update registry       |
| 4     | `test/schemas.test.mjs`, `test/pull-requests.test.mjs`                   | Schema validation + pagination + state filter tests         |
| 5     | (verification only)                                                      | Live testing against `bitbucket.juspay.net`                 |

## Confidence Assessment

- **Pre-implementation**: Medium — relied on `/activities` endpoint per Bitbucket REST API docs, unaware of root-level task exclusion.
- **Post-research**: High — Atlassian support confirmed `/blocker-comments` is authoritative for Server/DC 7.2+; endpoint tested live.
- **Risk**: Low for Server/DC 7.2+ deployments; Medium for older versions (endpoint unavailable, 404). Future hardening phase can add fallback to `/activities` with root-level task caveat documented.

## Lessons Learned

1. **Pagination default assumption**: Always implement pagination loops for Bitbucket paged responses; single-page fetches are almost never correct for production use.
2. **Endpoint versioning**: Verify endpoint availability across target Bitbucket versions (Cloud vs. Server/DC, version-gated features). `/blocker-comments` is Server/DC 7.2+; older deployments lack this endpoint.
3. **System-user tasks**: Root-level tasks authored by `bitbucket.system-user` (build failures, automated checks) are a common use case. Test plans must include system-authored tasks, not just human-authored comments.
4. **Client-side filtering**: When adding query param filters, always include client-side fallback for API versions that ignore query params. Bitbucket Server/DC query param support varies by version.

## Superseded Plan Sections

The following sections from `docs/plans/phase-6/feat-pr-tasks/plan.md` are superseded:

- **Phase 2: Implement listTasks client method** → replaced by this plan's Phase 2 (different endpoint, pagination loop).
- **Phase 3: Wire list_pr_tasks tool** → replaced by this plan's Phase 3 (different schema with state filter).

The following sections remain valid:

- **Phase 1: Add createTask** → unchanged, uses `/comments` POST endpoint.
- **Phase 4: Implement resolve/delete** → unchanged, uses `/comments/{id}` PUT/DELETE endpoints.

## Status

- **Plan file**: `docs/plans/phase-6/feat-pr-tasks-blocker-comments/*.md`
- **Status**: Not Started
- **Blocked by**: None
- **Blocks**: None (additive feature, no downstream dependencies)

## Verification Criteria

See `05-verification.md` for full live test plan. Summary:

- Comment id 1273928 (system-user, BLOCKER, RESOLVED) appears via `bitbucket_list_pr_tasks` with `state='ALL'` and `state='RESOLVED'`.
- Comment 1273928 absent when `state='OPEN'`.
- Reopen via `bitbucket_resolve_pr_task` succeeds when `transitionable: true`.
- Pagination works for PRs with >25 tasks (logs show multiple pages).
