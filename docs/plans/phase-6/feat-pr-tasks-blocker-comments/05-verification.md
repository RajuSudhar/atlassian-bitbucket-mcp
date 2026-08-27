# Phase 5 — Verification

## Objective

Verify the implementation passes automated checks (`pnpm run validate`, `pnpm test`) and confirm live behavior against `bitbucket.juspay.net` for the specified test case: comment id 1273928 (system-user, severity BLOCKER, state RESOLVED) appears correctly via `bitbucket_list_pr_tasks` with state filters, and can be reopened via `bitbucket_resolve_pr_task` when `transitionable: true`.

## Scope

### In Scope

- Run `pnpm run validate` (typecheck + lint).
- Run `pnpm test` (unit tests).
- Live test against `bitbucket.juspay.net` using MCP client (Claude Desktop or custom client):
  - Call `bitbucket_list_pr_tasks` with `state: 'ALL'` → verify comment 1273928 is present.
  - Call `bitbucket_list_pr_tasks` with `state: 'RESOLVED'` → verify 1273928 is present.
  - Call `bitbucket_list_pr_tasks` with `state: 'OPEN'` → verify 1273928 is absent.
  - Call `bitbucket_resolve_pr_task` with `{taskId: 1273928, state: 'OPEN', version: <current>}` → verify reopen succeeds (when `transitionable: true`).
- Confirm pagination works for PRs with >25 tasks (if available in test environment).

### Out of Scope

- Production deployment.
- Performance benchmarking.
- Testing against Bitbucket Cloud (Server/DC-specific endpoint).

## Implementation

### Step 5.1: Automated checks

**Commands**:

```bash
pnpm run validate
pnpm test
```

**Expected output**:

- `pnpm run validate`:
  - `pnpm run typecheck` → "Found 0 errors."
  - `pnpm run lint:all` → No lint errors.
- `pnpm test`:
  - All tests pass (existing + new `listTasksShape` + `PullRequestsApi.listTasks` tests).
  - Test count: ~20+ tests (7 for `listTasksShape`, 6 for `PullRequestsApi.listTasks`, existing schema/config/permissions/cache/logger tests).

### Step 5.2: Live test setup

**Prerequisites**:

1. Bitbucket Server/DC instance: `bitbucket.juspay.net` (confirmed accessible, Server/DC 7.2+).
2. Test PR with comment id 1273928:
   - Author: `bitbucket.system-user` (or similar system account).
   - Severity: `BLOCKER`.
   - State: `RESOLVED` (or `OPEN` — adjust test expectations accordingly).
   - `permittedOperations.transitionable: true` (confirms reopen is allowed).
3. MCP server running with config:
   - `BITBUCKET_URL=https://bitbucket.juspay.net`
   - `BITBUCKET_TOKEN=<valid PAT with PR read/write permissions>`
   - `BITBUCKET_ALLOWED_PROJECTS` / `BITBUCKET_ALLOWED_REPOS` include the test PR's project/repo.
4. MCP client (Claude Desktop or CLI client) connected to the server.

**Identify test PR**:

- Navigate to `bitbucket.juspay.net` and locate a PR with comment id 1273928.
- Confirm PR ID, project key, repo slug.
- Example: `project=PLAT`, `repo=payment-service`, `prId=123`.

### Step 5.3: Live test — List tasks with state='ALL'

**MCP client call**:

```json
{
  "tool": "bitbucket_list_pr_tasks",
  "arguments": {
    "project": "PLAT",
    "repo": "payment-service",
    "prId": 123,
    "state": "ALL"
  }
}
```

**Expected response**:

- Returns JSON array of all BLOCKER comments (OPEN + RESOLVED).
- Comment 1273928 is present in the array with:
  - `"id": 1273928`
  - `"severity": "BLOCKER"`
  - `"state": "RESOLVED"` (or `"OPEN"` — match actual state)
  - `"author": {"name": "bitbucket.system-user", ...}` (or similar system account)

**Verification points**:

- [ ] Response includes comment 1273928.
- [ ] Response includes both OPEN and RESOLVED tasks (if both exist in the PR).
- [ ] Server logs (stderr) show `info` log with `totalTasks` count, `pagesRead` count, `state: 'ALL'`.

### Step 5.4: Live test — List tasks with state='RESOLVED'

**MCP client call**:

```json
{
  "tool": "bitbucket_list_pr_tasks",
  "arguments": {
    "project": "PLAT",
    "repo": "payment-service",
    "prId": 123,
    "state": "RESOLVED"
  }
}
```

**Expected response**:

- Returns JSON array of only RESOLVED BLOCKER comments.
- Comment 1273928 is present (assuming its state is RESOLVED).
- OPEN tasks are absent.

**Verification points**:

- [ ] Response includes comment 1273928 if its state is RESOLVED.
- [ ] Response excludes OPEN tasks.
- [ ] Server logs show `state: 'RESOLVED'` and `totalTasks` count matching filtered result.
- [ ] If client-side filter was applied (server ignored query param), logs show `debug` message "listTasks client-side filter applied" with before/after counts.

### Step 5.5: Live test — List tasks with state='OPEN'

**MCP client call**:

```json
{
  "tool": "bitbucket_list_pr_tasks",
  "arguments": {
    "project": "PLAT",
    "repo": "payment-service",
    "prId": 123,
    "state": "OPEN"
  }
}
```

**Expected response**:

- Returns JSON array of only OPEN BLOCKER comments.
- Comment 1273928 is absent (assuming its state is RESOLVED).

**Verification points**:

- [ ] Response excludes comment 1273928 if its state is RESOLVED.
- [ ] Response includes only OPEN tasks.
- [ ] Server logs show `state: 'OPEN'` and `totalTasks` count matching filtered result.

### Step 5.6: Live test — Reopen resolved task

**Prerequisite**:

- Comment 1273928 has `"state": "RESOLVED"` and `"permittedOperations": {"transitionable": true}`.
- Note the current `version` value from the previous `list_pr_tasks` response (e.g., `version: 5`).

**MCP client call**:

```json
{
  "tool": "bitbucket_resolve_pr_task",
  "arguments": {
    "project": "PLAT",
    "repo": "payment-service",
    "prId": 123,
    "taskId": 1273928,
    "state": "OPEN",
    "version": 5
  }
}
```

**Expected response**:

- Returns updated `BitbucketComment` object with:
  - `"id": 1273928`
  - `"state": "OPEN"`
  - `"version": 6` (incremented)

**Verification points**:

- [ ] Response shows `state: 'OPEN'` (task reopened).
- [ ] Response shows incremented `version`.
- [ ] Bitbucket UI reflects the reopened state.
- [ ] Server logs show `info` log for `bitbucket_resolve_pr_task` with `state: 'OPEN'`.

**Edge case**: If `transitionable: false`, expect error response with message indicating permission denied. Adjust test PR if needed to ensure `transitionable: true`.

### Step 5.7: Live test — Pagination (if applicable)

**Prerequisite**:

- Identify a PR with >25 BLOCKER comments (or create test comments to exceed one page).
- Example: `project=PLAT`, `repo=payment-service`, `prId=456` with 40 tasks.

**MCP client call**:

```json
{
  "tool": "bitbucket_list_pr_tasks",
  "arguments": {
    "project": "PLAT",
    "repo": "payment-service",
    "prId": 456,
    "state": "ALL",
    "limit": 25
  }
}
```

**Expected response**:

- Returns JSON array of all 40 tasks.

**Verification points**:

- [ ] Response includes all tasks (>25).
- [ ] Server logs show `pagesRead: 2` (or more, depending on limit and total count).
- [ ] `debug` logs show "listTasks page fetched" for each page with correct `start`, `pageSize`, `isLastPage`.

**If no PR with >25 tasks is available**:

- Skip this test case and note in verification summary.
- Pagination logic is covered by unit tests in Phase 4.

## Verification Summary Table

| Test Case                      | Expected Result                               | Status |
| ------------------------------ | --------------------------------------------- | ------ |
| `pnpm run validate`            | Passes (typecheck + lint)                     | [ ]    |
| `pnpm test`                    | All tests pass                                | [ ]    |
| List tasks `state: 'ALL'`      | Includes comment 1273928                      | [ ]    |
| List tasks `state: 'RESOLVED'` | Includes 1273928 (if RESOLVED)                | [ ]    |
| List tasks `state: 'OPEN'`     | Excludes 1273928 (if RESOLVED)                | [ ]    |
| Reopen task 1273928            | State transitions to OPEN, version increments | [ ]    |
| Pagination (if >25 tasks)      | Returns all tasks, logs multiple pages        | [ ]    |

## Acceptance Criteria

All verification gates must pass:

- [ ] `pnpm run validate` passes (typecheck + lint).
- [ ] `pnpm test` passes (all unit tests).
- [ ] Live test: `state: 'ALL'` returns comment 1273928.
- [ ] Live test: `state: 'RESOLVED'` includes 1273928; `state: 'OPEN'` excludes 1273928.
- [ ] Live test: Reopening task 1273928 succeeds, state changes to OPEN.
- [ ] Live test (if applicable): Pagination returns all tasks for PR with >25 tasks.
- [ ] Server logs show correct `operation`, `state`, `totalTasks`, `pagesRead` values.

## Rollback Plan

If verification fails:

1. **Typecheck/lint failures**: Fix errors in source code, re-run `pnpm run validate`.
2. **Unit test failures**: Fix logic in `src/bitbucket/api/pull-requests.ts` or `src/tools/pr-tools.ts`, update tests if assumptions were incorrect.
3. **Live test failures**:
   - If `/blocker-comments` endpoint returns 404: Confirm Bitbucket Server/DC version ≥7.2. Add fallback logic (future phase).
   - If state filter doesn't work: Confirm client-side fallback is applied (check `debug` logs). Adjust server version assumptions.
   - If pagination fails: Check `nextPageStart` / `isLastPage` values in server response, adjust loop logic if API behavior differs.
4. **Reopen fails**: Confirm `permittedOperations.transitionable: true`. If false, use a different test task or adjust test expectations.

## Critical Notes

- **CRITICAL**: Live testing must use a real Bitbucket Server/DC instance (≥7.2) with the `/blocker-comments` endpoint available. If unavailable, this phase is blocked.
- **IMPORTANT**: The test PR must have a system-authored BLOCKER comment (id 1273928) in RESOLVED state with `transitionable: true`. If this specific comment is unavailable, substitute with another root-level BLOCKER comment and update test expectations.
- **IMPORTANT**: Server logs (stderr) are essential for debugging. Monitor logs during live tests to confirm pagination, state filtering, and client-side fallback behavior.
- **IMPORTANT**: If client-side filter is applied (indicated by `debug` log), it confirms the server ignored the `state` query param. This is expected for older DC versions and validates the fallback logic.

## Cross-references

- Phase 1 added `/blocker-comments` to OpenAPI schema.
- Phase 2 implemented pagination loop and state filter in client.
- Phase 3 wired state parameter through tool handler.
- Phase 4 added unit tests for schemas and client logic.
- This phase confirms end-to-end behavior in live environment.
