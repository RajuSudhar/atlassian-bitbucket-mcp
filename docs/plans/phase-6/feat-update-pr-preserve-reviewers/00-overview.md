# Overview — Fix bitbucket_update_pull_request reviewer-wipe bug

## Goal

Fix the critical data-loss bug in `bitbucket_update_pull_request` where updating a PR's title or description silently removes all reviewers due to Bitbucket Server/DC's full-object PUT semantics. Implement read-modify-write pattern with automatic GET-then-merge to preserve reviewers and target branch reference.

## Scope

### In Scope

1. Rewrite `updatePullRequest` in `src/bitbucket/api/pull-requests.ts` (lines 152-165) to implement GET-then-PUT pattern: fetch current PR, echo `reviewers` and `toRef` verbatim, override only `title`/`description` fields supplied by caller.
2. Auto-fetch `version` from GET response (caller no longer required to supply it), but preserve backward compatibility by accepting optional caller-supplied `version` as override.
3. Update `updatePullRequestShape` in `src/tools/schemas.ts` (lines 73-78): make `version` optional (was required), document that it's auto-fetched but can be overridden.
4. Add bounded single-retry logic for 409 PullRequestOutOfDateException: re-fetch version and retry PUT once.
5. Update tool description in `src/tools/registry.ts` to document that reviewers are now preserved.
6. Comprehensive unit tests in `test/pull-requests.test.mjs`: mock GET+PUT flow, assert reviewers+toRef echoed verbatim, assert title/description overrides, assert version sourcing (auto-fetched vs caller override), assert 409-retry path.
7. Schema tests in `test/schemas.test.mjs`: assert `version` is optional, other validations intact.
8. Verification: `pnpm validate` + `pnpm test`, then live test on real PR with >=1 reviewer confirming reviewers RETAINED after description update.

### Out of Scope

- Adding an optional `reviewers` input parameter to allow callers to deliberately change reviewers (documented as Alternative / future enhancement below).
- Bitbucket Cloud PR updates (no Cloud PR API in this codebase).
- Changes to other PR update operations (`approve`, `merge`, etc).
- Unbounded retry loops (strictly one retry on 409, then fail).

## Root Cause

Bitbucket Server/DC REST API 1.0 PR update is a **full-object PUT** operation — there is no PATCH endpoint in any version. Per Atlassian BSERV-19139 (closed "Not a bug", Feb 2024), omitting `reviewers` in the PUT body has the same effect as sending `reviewers: []` — it removes all reviewers. This is confirmed intended behavior.

Current implementation (`src/bitbucket/api/pull-requests.ts:152-165`):

```typescript
async updatePullRequest(
  project: string,
  repo: string,
  prId: number,
  updates: { title?: string; description?: string; version: number }
): Promise<PullRequest> {
  const body: Record<string, unknown> = { version: updates.version };
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.description !== undefined) body.description = updates.description;
  return this.client.requestJson<PullRequest>(
    `/projects/${project}/repos/{repo}/pull-requests/${prId}`,
    { method: 'PUT', body }
  );
}
```

**Problem:** The PUT body contains only `{version, title?, description?}`. It never includes `reviewers` or `toRef`, causing Bitbucket to remove all reviewers and potentially reset the target branch.

**Required PUT fields for safe update:**

- `version` (mandatory, optimistic lock; 409 if stale)
- `title` (effectively required)
- `description`
- `toRef` (target branch reference; omitting it may cause undefined behavior)
- `reviewers` (array of `Participant` objects; omitting removes all reviewers)

**Read-only fields (echo as-is):**

- `fromRef`, `author`, `participants` (immutable, but safe to echo)
- `reviewers[].approved`, `reviewers[].status` (read-only approval metadata, echo the objects verbatim)

## Success Criteria

- `pnpm run validate` passes (typecheck + lint).
- `pnpm test` passes (new unit tests in `test/pull-requests.test.mjs` + updated schema tests in `test/schemas.test.mjs`).
- Live test on real Bitbucket Server/DC instance:
  1. Create PR with >=1 reviewer assigned.
  2. Call `bitbucket_update_pull_request` with only `{project, repo, prId, description: "new desc"}` (no `version` supplied).
  3. Verify PR description updated AND reviewers list unchanged (no reviewers removed).
  4. Verify `toRef` unchanged.
- 409 retry test: simulate optimistic lock conflict (e.g., concurrent update), confirm single retry succeeds.

## Dependencies

- Existing `PullRequestApi.get()` method (`src/bitbucket/api/pull-requests.ts`) — already implemented, returns full `PullRequest` object including `reviewers?: Participant[]` and `toRef`.
- `PullRequest` type from `types/generated/bitbucket-server.d.ts` (via `types/bitbucket.ts`) — already includes `reviewers`, `toRef`, `version`.
- `openapi/bitbucket-server.yaml` — PullRequest schema (lines 199-239) already models `reviewers` array.

## Architecture

### Before (Buggy)

```text
bitbucket_update_pull_request {project, repo, prId, title?, description?, version}
  ↓
prApi.updatePullRequest(project, repo, prId, {title?, description?, version})
  ↓
PUT /projects/{p}/repos/{r}/pull-requests/{id}
  body: {version, title?, description?}
  ↓
Bitbucket Server/DC interprets omitted reviewers as []
  ↓
Response: PullRequest with reviewers=[] (ALL REVIEWERS REMOVED)
```

### After (Fixed)

```text
bitbucket_update_pull_request {project, repo, prId, title?, description?, version?}
  ↓
prApi.updatePullRequest(project, repo, prId, {title?, description?, version?})
  ↓
GET /projects/{p}/repos/{r}/pull-requests/{id}
  ↓ currentPr: PullRequest
Extract: currentPr.reviewers, currentPr.toRef, currentPr.version
  ↓
Build PUT body:
  {
    version: callerVersion ?? currentPr.version,  // caller override or auto-fetched
    title: callerTitle ?? currentPr.title,
    description: callerDescription ?? currentPr.description,
    toRef: currentPr.toRef,               // echo verbatim
    reviewers: currentPr.reviewers,       // echo verbatim
  }
  ↓
PUT /projects/{p}/repos/{r}/pull-requests/{id}
  ↓ (if 409 PullRequestOutOfDateException)
Re-fetch GET, rebuild body with fresh version, retry PUT ONCE
  ↓
Response: PullRequest with reviewers PRESERVED
```

## Decisions

### Primary Approach (Implemented)

**Auto GET-then-merge inside `updatePullRequest` client method.**

- `updatePullRequest` signature changes to accept `version?: number` (optional).
- Internal flow: always GET the current PR, build PUT body echoing `reviewers` + `toRef`, override only `title`/`description` when caller supplies them.
- Use `version` from GET response by default; if caller supplies `version`, use that instead (allows advanced callers to manage versioning explicitly).
- Single bounded retry on 409: if PUT fails with 409, re-fetch GET once, use fresh version, retry PUT. If second 409, fail immediately (no infinite retry loop).

**Rationale:**

- Eliminates the two-step GET-then-PUT burden from every caller.
- Matches the semantic expectation: "update title/description" should NOT mean "also remove all reviewers".
- Backward compatible: existing callers passing `version` continue to work (their version is used if supplied).

### Alternative Approach (Not Implemented, Future Enhancement)

**Add optional `reviewers` input parameter.**

```typescript
async updatePullRequest(
  project: string,
  repo: string,
  prId: number,
  updates: {
    title?: string;
    description?: string;
    version?: number;
    reviewers?: Participant[];  // NEW: optional explicit reviewer update
  }
): Promise<PullRequest>
```

- If caller supplies `reviewers`, use that array; otherwise fall back to fetched reviewers.
- Enables deliberate reviewer changes (add/remove reviewers) via same tool.

**Why not implemented now:**

- Scope creep: the immediate bug is reviewers being wiped unintentionally. Adding reviewer management is a separate feature.
- Security consideration: modifying reviewers may require distinct permission (`manage_pr_reviewers` or similar), not just `write_pr`.
- Can be added in a follow-up feature if user demand emerges.

**Documentation note:** This alternative is captured here for visibility. If a future user requests the ability to update reviewers programmatically, revisit this decision and add the `reviewers` parameter with appropriate permission checks.

## Files Modified

| File                                 | Change                                                                                                                                                                                                        | Reason                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `src/bitbucket/api/pull-requests.ts` | Rewrite `updatePullRequest` (lines 152-165) to GET current PR, build PUT body echoing `reviewers`+`toRef`, override `title`/`description`, auto-fetch `version` (with caller override support), add 409 retry | Fix reviewer-wipe bug, implement read-modify-write  |
| `src/tools/schemas.ts`               | Change `updatePullRequestShape.version` from `z.coerce.number()...` (required) to `.optional()` (lines 73-78)                                                                                                 | Version now auto-fetched; caller can still override |
| `src/tools/pr-tools.ts`              | Update `bitbucket_update_pull_request` handler (lines 375-412) to handle optional version in input (no logic change needed; pass through to client)                                                           | Schema change propagation                           |
| `src/tools/registry.ts`              | Update `bitbucket_update_pull_request` description to note reviewers are preserved, version is optional                                                                                                       | Tool documentation                                  |
| `test/pull-requests.test.mjs`        | Add comprehensive unit tests: mock GET+PUT, assert reviewers+toRef echoed, assert title/description overrides, assert version sourcing (auto vs override), assert 409 retry                                   | Client-level behavior coverage                      |
| `test/schemas.test.mjs`              | Update `updatePullRequestShape` tests: assert version optional, assert refine (at least one of title/description) still enforced                                                                              | Schema validation coverage                          |

## Files NOT Modified

| File                                    | Reason                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `openapi/bitbucket-server.yaml`         | PullRequest schema (lines 199-239) already models `reviewers`; no schema changes needed |
| `types/generated/bitbucket-server.d.ts` | No openapi changes → no regeneration needed                                             |
| `types/bitbucket.ts`                    | PullRequest export already includes reviewers field; no type changes                    |
| `src/permissions.ts`                    | No new permissions; continues using `write_pr`                                          |
| `src/cache.ts`                          | No cache logic changes; existing `invalidatePrCache` call in handler remains            |

## Risks

1. **Bitbucket version compatibility:** GET endpoint must return `reviewers` + `toRef`. Confirmed present in Server/DC 7.0+ (types match production).
2. **Performance:** Every update now incurs a GET roundtrip. Mitigation: GET is fast (single PR fetch), and correctness trumps minor latency.
3. **Race condition:** Concurrent PR updates can still trigger 409. Mitigation: single retry with fresh version catches common cases; if conflict persists, fail fast (bounded retry prevents loops).
4. **Breaking change (minor):** Caller-supplied `version` is now optional. Impact: existing callers passing `version` continue to work; new callers can omit it. No functional breakage.

## Definition of Done

- [ ] Phase 1 complete: `updatePullRequest` client rewrite, 409 retry logic.
- [ ] Phase 2 complete: Schema + handler updates, version optional.
- [ ] Phase 3 complete: Unit tests pass (GET+PUT mocking, reviewers echoed, 409 retry).
- [ ] Phase 4 complete: Verification checklist (typecheck, lint, unit tests, live test).
- [ ] All markdown files pass `pnpm run lint:all` (correct code fence languages, table alignment).
- [ ] TRACK.md updated with this feature marked in-progress.
- [ ] Changelog entry added to `docs/plans/phase-6/feat-update-pr/changelog.md` noting the decision reversal.
