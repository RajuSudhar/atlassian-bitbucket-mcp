# Phase 2 — Client: Pagination Loop + State Filter

## Objective

Rewrite `listTasks` in `src/bitbucket/api/pull-requests.ts` to call GET `/blocker-comments` with a full pagination loop (accumulating results across `isLastPage` / `nextPageStart`), accept an optional `state` parameter mapped to the query param, add client-side fallback filtering for DC versions that ignore the query param, and integrate logging per project conventions.

## Scope

### In Scope

- Replace `listTasks` method body (lines 198-211 in `src/bitbucket/api/pull-requests.ts`).
- Add optional `state?: 'OPEN' | 'RESOLVED'` parameter to `listTasks` signature.
- Implement full pagination loop: accumulate `values` arrays across pages until `isLastPage === true`.
- Map `state` param to `state` query parameter when present.
- Add client-side filter on `comment.state` as fallback for DC versions that accept but ignore the query param.
- Retain `collectBlockerComments` helper (lines 241-250) for nested-reply flattening if needed.
- Add `log()` calls for pagination start/page fetch/completion per `claude-ref/logger.md` conventions.
- Preserve `BitbucketComment[]` return type.

### Out of Scope

- Changes to `setTaskState` (lines 213-225) or `deleteTask` (lines 227-238).
- Endpoint fallback logic for Server/DC < 7.2 (404 handling deferred to future hardening).
- Cache integration (cache keys unchanged; TTL/invalidation handled by existing cache layer).

## Implementation

### Step 2.1: Update listTasks signature and body

**File**: `src/bitbucket/api/pull-requests.ts`

**Current code** (lines 198-211):

```typescript
async listTasks(
  project: string,
  repo: string,
  prId: number,
  limit = 25,
  start = 0
): Promise<BitbucketComment[]> {
  const activities = await this.getActivities(project, repo, prId, limit, start);
  const tasks: BitbucketComment[] = [];
  for (const activity of activities.values) {
    collectBlockerComments(activity.comment, tasks);
  }
  return tasks;
}
```

**New code** (replace lines 198-211):

```typescript
async listTasks(
  project: string,
  repo: string,
  prId: number,
  state?: 'OPEN' | 'RESOLVED',
  limit = 25,
  start = 0
): Promise<BitbucketComment[]> {
  log('debug', 'listTasks start', {
    operation: 'list_blocker_comments',
    project,
    repo,
    prId,
    state: state ?? 'ALL',
    limit,
  });

  const allTasks: BitbucketComment[] = [];
  let currentStart = start;
  let isLastPage = false;
  let pageCount = 0;

  while (!isLastPage) {
    const queryParams: Record<string, string | number> = { limit, start: currentStart };
    if (state !== undefined) {
      queryParams.state = state;
    }

    const page = await this.client.requestJson<BitbucketPagedResponse<BitbucketComment>>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}/blocker-comments`,
      { queryParams }
    );

    pageCount++;
    log('debug', 'listTasks page fetched', {
      operation: 'list_blocker_comments',
      page: pageCount,
      pageSize: page.values.length,
      start: currentStart,
      isLastPage: page.isLastPage,
    });

    allTasks.push(...page.values);
    isLastPage = page.isLastPage;
    currentStart = page.nextPageStart ?? currentStart;

    if (!isLastPage && page.nextPageStart === undefined) {
      log('warn', 'listTasks pagination inconsistency', {
        operation: 'list_blocker_comments',
        issue: 'isLastPage=false but nextPageStart undefined, terminating loop',
      });
      break;
    }
  }

  let filtered = allTasks;
  if (state !== undefined) {
    const preFilterCount = filtered.length;
    filtered = filtered.filter((comment) => comment.state === state);
    if (filtered.length < preFilterCount) {
      log('debug', 'listTasks client-side filter applied', {
        operation: 'list_blocker_comments',
        state,
        beforeCount: preFilterCount,
        afterCount: filtered.length,
      });
    }
  }

  log('info', 'listTasks complete', {
    operation: 'list_blocker_comments',
    project,
    repo,
    prId,
    state: state ?? 'ALL',
    totalTasks: filtered.length,
    pagesRead: pageCount,
  });

  return filtered;
}
```

**Rationale**:

- **Pagination loop**: Accumulates `page.values` into `allTasks` until `isLastPage === true`. Advances `currentStart` via `page.nextPageStart`.
- **State query param**: Included in `queryParams` only when `state !== undefined` (allows omitting the param when caller passes `state: undefined` to retrieve all states).
- **Client-side fallback filter**: After pagination completes, filters `allTasks` by `comment.state === state` (if `state` is defined). Logs when filtering reduces the count, indicating the server ignored the query param.
- **Pagination safety**: Checks for `isLastPage=false` but `nextPageStart=undefined` (Bitbucket API inconsistency edge case); logs warning and terminates loop to prevent infinite loop.
- **Logging**: `debug`-level logs for start/page/filter, `info`-level log for completion with summary metrics. Follows `claude-ref/logger.md` conventions (never log tokens, structured key-value pairs).

### Step 2.2: Add import for log

**File**: `src/bitbucket/api/pull-requests.ts`

Confirm the following import exists at the top of the file (should already be present from existing code):

```typescript
import { log } from '../logger.js';
```

If absent, add it after existing imports.

### Step 2.3: Retain collectBlockerComments (verification)

**File**: `src/bitbucket/api/pull-requests.ts` (lines 241-250)

**Current code**:

```typescript
function collectBlockerComments(
  comment: BitbucketComment | undefined,
  out: BitbucketComment[]
): void {
  if (comment === undefined) return;
  if (comment.severity === 'BLOCKER') out.push(comment);
  for (const reply of comment.comments ?? []) {
    collectBlockerComments(reply, out);
  }
}
```

**Action**: Keep unchanged. The `/blocker-comments` endpoint returns a flat array of all BLOCKER comments (root + reply), so this helper is no longer invoked by `listTasks`. However, if future endpoints or testing utilities need nested-reply flattening, this helper remains available. The endpoint's behavior (flat vs. threaded) will be confirmed during verification; if threaded, `collectBlockerComments` can be reintroduced into the pagination loop.

**Verification note**: During Phase 5 live testing, if `/blocker-comments` returns a threaded structure (root comments with nested `comments` arrays), apply `collectBlockerComments` inside the pagination loop:

```typescript
// Inside pagination loop, after page fetch:
for (const rootComment of page.values) {
  collectBlockerComments(rootComment, allTasks);
}
```

For now, assume flat array per Atlassian Server/DC 7.2+ docs.

### Step 2.4: Update import for BitbucketPagedResponse

**File**: `src/bitbucket/api/pull-requests.ts`

Confirm the following import exists near the top:

```typescript
import type {
  BitbucketActivity,
  BitbucketComment,
  BitbucketCommentState,
  BitbucketPagedResponse,
  PullRequest,
} from '@types/bitbucket';
```

If `BitbucketPagedResponse` is missing, add it to the import list.

## Type Safety Notes

- `BitbucketComment` type already includes `state: BitbucketCommentState` (`'OPEN' | 'RESOLVED'`), enforced by `types/generated/bitbucket-server.d.ts`.
- `BitbucketPagedResponse<BitbucketComment>` is typed as `PagedResponseMeta & { values: readonly BitbucketComment[] }`.
- `state` parameter type `'OPEN' | 'RESOLVED'` matches `BitbucketCommentState` enum values.
- Client-side filter uses strict equality check (`comment.state === state`), type-safe.

## Performance Considerations

- **Pagination overhead**: Each page requires an HTTP round-trip. For PRs with >25 tasks, multiple requests are unavoidable. Default `limit=25` balances latency and memory.
- **Client-side filtering**: Applied in-memory after all pages are fetched. If the server ignores the `state` query param, the client may fetch OPEN tasks when only RESOLVED tasks are requested. This is acceptable given the typical task count (usually <100 per PR).
- **Memory**: `allTasks` array accumulates all BLOCKER comments. For pathological PRs with thousands of tasks, this could consume significant memory, but Bitbucket's API limits (max 1000 per page) and typical PR task counts (<100) make this a non-issue.

## Verification Gates

- [ ] `pnpm run typecheck` passes.
- [ ] `pnpm run lint:all` passes.
- [ ] `listTasks` signature includes `state?: 'OPEN' | 'RESOLVED'` parameter.
- [ ] Pagination loop accumulates across pages until `isLastPage === true`.
- [ ] `state` query param is included only when `state !== undefined`.
- [ ] Client-side filter is applied when `state !== undefined`.
- [ ] Logging includes debug/info-level messages with operation, project, repo, prId, state, pageCount, totalTasks.

## Files Modified

| File                                 | Lines Changed                              | Description                                                      |
| ------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------- |
| `src/bitbucket/api/pull-requests.ts` | Replace lines 198-211 (~80 lines new code) | Rewrite `listTasks` with pagination loop, state filter, logging  |
| `src/bitbucket/api/pull-requests.ts` | Verify import (line ~5)                    | Ensure `BitbucketPagedResponse` imported from `@types/bitbucket` |
| `src/bitbucket/api/pull-requests.ts` | Verify import (line ~3)                    | Ensure `log` imported from `../logger.js`                        |

## Files NOT Modified

| File                                                            | Reason                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/bitbucket/api/pull-requests.ts` → `setTaskState`           | Correct endpoint already (`/comments/{id}`), no changes needed           |
| `src/bitbucket/api/pull-requests.ts` → `deleteTask`             | Correct endpoint already (`/comments/{id}`), no changes needed           |
| `src/bitbucket/api/pull-requests.ts` → `collectBlockerComments` | Retained for potential future use; not invoked by new `listTasks`        |
| `src/cache.ts`                                                  | Cache key construction unchanged; caller (tool handler) passes same keys |

## Critical Notes

- **CRITICAL**: The `state` parameter is OPTIONAL. When `undefined`, the query param is omitted, and the client-side filter is skipped. This maps the tool's `state: 'ALL'` input to "fetch all states."
- **IMPORTANT**: The client-side filter is a fallback, not a replacement for the query param. Always pass the `state` query param when defined; the client-side filter ensures correctness for DC versions that ignore it.
- **IMPORTANT**: The pagination loop includes a safety check for `isLastPage=false && nextPageStart=undefined` to prevent infinite loops. This edge case has been observed in Bitbucket Server APIs with certain query param combinations.
- **IMPORTANT**: All logging uses structured key-value pairs; never logs sensitive tokens per `claude-ref/logger.md`.

## Cross-references

- Phase 3 will wire the `state` parameter through the tool handler (`bitbucket_list_pr_tasks`).
- Phase 4 will add unit tests mocking multi-page responses and state filtering.
- Phase 5 verification will confirm live behavior against `bitbucket.juspay.net`.
