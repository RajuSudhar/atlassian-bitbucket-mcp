# Phase 4 — Verification

## Objective

Confirm the fix is complete via automated checks (`pnpm validate`, `pnpm test`) and live testing against a real Bitbucket Server/DC instance, verifying that reviewers are retained after a PR update.

## In Scope

- Run all automated validation: typecheck, lint, unit tests.
- Live test on real Bitbucket Server/DC:
  1. Create or identify a PR with >=1 reviewer assigned.
  2. Call `bitbucket_update_pull_request` with only description change (no version supplied).
  3. Verify reviewers list unchanged after update.
  4. Verify `toRef` unchanged.
- Confirm markdown files pass linting (code fence languages, table alignment).
- Update `docs/plans/TRACK.md` to mark this feature as in-progress.
- Create changelog entry in `docs/plans/phase-6/feat-update-pr/changelog.md`.

## Out of Scope

- Production deployment (verification is pre-deployment).
- Performance benchmarking (GET-then-PUT latency is acceptable for correctness).

## Automated Checks

### Typecheck

```bash
pnpm run typecheck
```

**Expected:** Zero errors. Confirm:

- `updatePullRequest` signature matches usage in handler.
- `updatePullRequestShape` types align with handler `.parse()` result.
- No `any` types introduced.

### Lint

```bash
pnpm run lint:all
```

**Expected:** Zero errors/warnings. Confirm:

- All modified files pass ESLint rules.
- Markdown files in `docs/plans/phase-6/feat-update-pr-preserve-reviewers/` pass markdown-lint (code fence languages, table alignment, no trailing whitespace).

**Common markdown-lint issues to check:**

- Code fences must have language tags: ` ```typescript `, not ` ``` `.
- Tables must have proper alignment (consistent column separators).
- No hard tabs (use spaces).

### Unit Tests

```bash
pnpm test
```

**Expected:** All tests pass. Specifically:

- `test/pull-requests.test.mjs` — all 8 new tests pass:
  - Reviewers+toRef echoed.
  - Title/description overrides.
  - Version auto-fetched vs caller override.
  - 409 retry once, exhaustion on second 409.
- `test/schemas.test.mjs` — updated `updatePullRequestShape` tests pass:
  - Version optional.
  - Refine enforced (at least one of title/description).

**If any test fails:**

1. Check error message for assertion failure details.
2. Verify Phase 1-3 implementations match plan exactly.
3. Adjust 409 error detection logic if client error format differs (see Phase 1 CRITICAL note).

## Live Test (Real Bitbucket Server/DC)

### Prerequisites

- Access to Bitbucket Server/DC instance (e.g., `bitbucket.juspay.net` or similar).
- Valid `BITBUCKET_TOKEN` with `write_pr` permission.
- Existing PR in allowed project/repo with >=1 reviewer assigned.

### Test Steps

#### Step 1: Identify Test PR

```bash
# Example: find a PR in project DEMO, repo test-repo
# Call bitbucket_get_pull_request to confirm current state
{
  "project": "DEMO",
  "repo": "test-repo",
  "prId": 42
}
```

**Expected response (example):**

```json
{
  "id": 42,
  "version": 10,
  "title": "Original PR Title",
  "description": "Original description",
  "toRef": {
    "id": "refs/heads/main",
    "repository": { "slug": "test-repo", "project": { "key": "DEMO" } }
  },
  "reviewers": [
    { "user": { "name": "alice" }, "approved": false, "status": "UNAPPROVED" },
    { "user": { "name": "bob" }, "approved": true, "status": "APPROVED" }
  ]
}
```

**Confirm:** PR has >=1 reviewer (e.g., alice, bob).

#### Step 2: Update PR Description (No Version Supplied)

```bash
# Call bitbucket_update_pull_request with only description change
{
  "project": "DEMO",
  "repo": "test-repo",
  "prId": 42,
  "description": "Updated description via MCP tool"
}
```

**Expected behavior:**

- Tool internally fetches current PR (GET).
- Tool builds PUT body echoing reviewers+toRef, overriding description, using version from GET.
- Tool sends PUT.
- Response: updated PR with incremented version.

**Expected response (example):**

```json
{
  "id": 42,
  "version": 11,
  "title": "Original PR Title",
  "description": "Updated description via MCP tool",
  "toRef": {
    "id": "refs/heads/main",
    "repository": { "slug": "test-repo", "project": { "key": "DEMO" } }
  },
  "reviewers": [
    { "user": { "name": "alice" }, "approved": false, "status": "UNAPPROVED" },
    { "user": { "name": "bob" }, "approved": true, "status": "APPROVED" }
  ]
}
```

**Verify:**

- `description` changed to "Updated description via MCP tool".
- `reviewers` array UNCHANGED (alice and bob still present with same approval status).
- `toRef` UNCHANGED.
- `version` incremented (10 → 11).

#### Step 3: Verify in Bitbucket UI

- Navigate to PR 42 in Bitbucket web UI.
- Confirm description shows "Updated description via MCP tool".
- Confirm reviewers list shows alice (unapproved) and bob (approved).
- Confirm target branch unchanged (e.g., still targeting `main`).

### Edge Case: Caller Supplies Version

**Optional test:** Call with explicit version to confirm caller override works.

```bash
{
  "project": "DEMO",
  "repo": "test-repo",
  "prId": 42,
  "title": "New Title",
  "version": 11
}
```

**Expected:**

- Tool uses caller's version (11) instead of fetching it.
- PUT body includes `version: 11`.
- Response: updated PR with version incremented (11 → 12).

### Edge Case: 409 Conflict

**Simulate:** Update PR concurrently (e.g., via Bitbucket UI) while MCP tool is executing.

**Expected:**

- First PUT returns 409.
- Tool logs warning: "pr update conflict, retrying".
- Tool re-fetches GET, uses fresh version, retries PUT.
- Second PUT succeeds (or fails with 409 again, in which case tool throws error).

**Verification:**

- Check logs for "pr update conflict, retrying" message.
- Confirm second PUT uses incremented version.

## Markdown Linting

Run markdown lint on all new plan files:

```bash
pnpm run lint:all
```

**Check:**

- All code fences have language tags (`typescript`, `bash`, `json`, `text`).
- Tables are properly aligned (consistent `|` separators).
- No trailing whitespace.

**Common fixes:**

- Add `typescript` to code fences: ` ```typescript `.
- Align table columns: use consistent spacing around `|`.
- Remove trailing spaces.

## Documentation Updates

### Update `docs/plans/TRACK.md`

Add entry for this feature in Phase 6:

```markdown
### Phase 6 — Deployment scoping (juspay Server/DC)

[x] feat-project-repo-scoping → docs/plans/phase-6/feat-project-repo-scoping/plan.md
[ ] feat-inline-comment-hardening — `diffType` on `bitbucket_add_pr_inline_comment`
[ ] feat-http-transport — Streamable HTTP transport
[x] feat-pr-tasks → docs/plans/phase-6/feat-pr-tasks/plan.md — create/list/resolve/delete PR tasks
[~] feat-pr-tasks-blocker-comments → docs/plans/phase-6/feat-pr-tasks-blocker-comments/
— fix root BLOCKER task enumeration via /blocker-comments endpoint

- add state filter (OPEN/RESOLVED/ALL)
  [x] feat-update-pr → docs/plans/phase-6/feat-update-pr/plan.md
  — update PR title/description
  [~] feat-update-pr-preserve-reviewers
  → docs/plans/phase-6/feat-update-pr-preserve-reviewers/
  — fix reviewer-wipe bug via GET-then-PUT with auto version management
```

**Key:** `[~]` (wip) indicates feature is in progress.

### Create Changelog Entry

**File:** `docs/plans/phase-6/feat-update-pr/changelog.md` (create if absent).

**Content:**

```markdown
# Changelog — feat-update-pr

## Issue 1: Plan Incorrect — Reviewer-wipe bug

Explicit "no internal auto-GET-then-PUT" decision caused reviewer data loss.

**Category:** Plan Incorrect  
**Date:** 2026-07-27  
**Status:** Resolved via follow-up feature `feat-update-pr-preserve-reviewers`

### What Happened

The original `feat-update-pr` plan (lines 34-36, "Out of scope" section) explicitly
documented a decision to NOT implement internal auto-GET-then-PUT inside the
`bitbucket_update_pull_request` tool. Instead, it required callers to supply the
current PR's `version` explicitly, matching the `bitbucket_update_comment` pattern.

### Root Cause

The plan failed to account for Bitbucket Server/DC's full-object PUT semantics
for PR updates. Unlike PATCH, the PUT endpoint requires ALL fields to be sent
in the request body, or they are reset to empty/default values. Specifically:

- Omitting `reviewers` in the PUT body has the same effect as sending
  `reviewers: []` — it removes all reviewers.
- Omitting `toRef` may cause undefined behavior (target branch reset).

This is confirmed intended behavior per Atlassian BSERV-19139 (closed "Not a bug", Feb 2024).

The original plan's "no internal auto-GET" decision was based on the assumption
that PR updates work like comment updates (PATCH semantics), where only specified
fields are modified. This assumption was incorrect.

### Impact

**Severity:** Critical — data loss bug.

**User Impact:**

- Every call to `bitbucket_update_pull_request` that updates title or description
  ALSO silently removes all reviewers from the PR.
- Users lose PR review state, requiring manual re-addition of reviewers.
- Approval workflows disrupted.

**Discovery:** Reported by user or discovered during live testing (document actual discovery path if known).

### Resolution

A follow-up feature `feat-update-pr-preserve-reviewers` was authored to reverse
the "no internal auto-GET" decision and implement the correct fix:

1. Rewrite `updatePullRequest` client to implement GET-then-PUT pattern.
2. Build PUT body by fetching current PR state, echoing `reviewers` and `toRef`
   verbatim, and overriding only `title`/`description` as supplied by caller.
3. Auto-fetch `version` from GET response (caller no longer required to supply it,
   but can override).
4. Add bounded single retry on 409 PullRequestOutOfDateException.

See `docs/plans/phase-6/feat-update-pr-preserve-reviewers/` for full plan.

### Plan Updated

**Original plan (`plan.md`):** NOT modified. The historical record (lines 34-36
documenting the "no internal auto-GET" decision) is preserved as-is.

**Rationale:** The original plan correctly documented a deliberate decision. That
decision was later discovered to be incorrect due to a misunderstanding of
Bitbucket's API semantics. Rather than rewriting history, this changelog entry
captures the mistake and points to the fix.

### Deviation

**Deviation Level:** Major — architectural change (single-request PUT → GET-then-PUT).

**Confidence Impact:** The original plan's decision was made with medium confidence
(flagged as "default assumption, reversible" in lines 228-247). This changelog
entry closes that open question with a definitive reversal.

### Lessons Learned

1. **API semantics matter:** Always verify whether an update endpoint is PATCH
   (partial update) or PUT (full-object replacement). Assume nothing.
2. **Default assumptions must be tested early:** The original plan flagged the
   "no internal auto-GET" decision as reversible but did not mandate live testing
   before merge. Future plans should require live test verification for any
   "default assumption" decision.
3. **Consult API documentation and issue trackers:** BSERV-19139 clearly documents
   the "omitting reviewers removes them" behavior. This should have been discovered
   during plan authoring.

### Follow-up Actions

- [x] Authored follow-up plan `feat-update-pr-preserve-reviewers` (2026-07-27).
- [ ] Implement follow-up plan (in progress).
- [ ] Live test on real Bitbucket Server/DC with reviewers (verification step).
- [ ] Add regression test to prevent re-introduction of reviewer-wipe bug.
```

**Note:** If `changelog.md` already exists, append the above as a new section. If it doesn't exist, create it with the above content.

## Phase Gate

- [ ] `pnpm run typecheck` passes.
- [ ] `pnpm run lint:all` passes (code + markdown).
- [ ] `pnpm test` passes (all unit tests).
- [ ] Live test on real Bitbucket Server/DC confirms reviewers preserved.
- [ ] `docs/plans/TRACK.md` updated (feature marked `[~]` wip).
- [ ] `docs/plans/phase-6/feat-update-pr/changelog.md` created with "Plan Incorrect" entry.
- [ ] All plan markdown files (00-overview.md, 01-client-read-modify-write.md, 02-schema-and-handler.md, 03-tests.md, 04-verification.md, checklist.md) pass markdown-lint.

## Success Criteria (Final)

All checks pass AND live test confirms:

✓ PR description updated  
✓ Reviewers list unchanged (no reviewers removed)  
✓ Target branch (`toRef`) unchanged  
✓ Version incremented correctly  
✓ Logs show "pr update conflict, retrying" on 409 (if triggered)  
✓ No errors, no data loss

Feature is ready for merge when all above criteria are met.
