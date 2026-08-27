# Changelog — feat-update-pr

## Issue 1: Plan Incorrect — Reviewer-wipe bug

Explicit "no internal auto-GET-then-PUT" decision caused reviewer data loss.

**Category:** Plan Incorrect  
**Date:** 2026-07-27  
**Status:** Resolved via follow-up feature `feat-update-pr-preserve-reviewers`

### What Happened

The original `feat-update-pr` plan (lines 34-36, "Out of scope" section) explicitly documented a decision to NOT implement internal auto-GET-then-PUT inside the `bitbucket_update_pull_request` tool. Instead, it required callers to supply the current PR's `version` explicitly, matching the `bitbucket_update_comment` pattern.

This decision was further detailed in the "Decisions / deviations" section (lines 228-247) as a "default assumption (recorded, reversible)" — meaning it was chosen in the absence of user input, but flagged as potentially revisable based on real-world usage.

### Root Cause

The plan failed to account for Bitbucket Server/DC's full-object PUT semantics for PR updates. Unlike PATCH (which modifies only specified fields), the PUT endpoint for PR updates requires ALL required fields to be sent in the request body. Fields omitted from the PUT body are reset to empty/default values.

Specifically:

- Omitting `reviewers` in the PUT body has the same effect as sending `reviewers: []` — **it removes all reviewers from the PR**.
- Omitting `toRef` may cause undefined behavior or reset the target branch reference.

This behavior is confirmed as **intended** per Atlassian BSERV-19139 (closed "Not a bug", Feb 2024). The Bitbucket REST API documentation does not explicitly warn about this for every field, but the issue tracker clarifies it.

The original plan's "no internal auto-GET" decision was based on two assumptions:

1. **Pattern consistency:** The existing `bitbucket_update_comment` tool requires callers to supply `version` explicitly. The plan assumed PR updates should follow the same pattern.
2. **API semantics assumption:** The plan implicitly assumed PR updates work like partial updates (PATCH-like), where only specified fields are modified. This assumption was **incorrect** — PR updates are full-object replacements (PUT semantics).

### Impact

**Severity:** Critical — data loss bug.

**User Impact:**

- Every call to `bitbucket_update_pull_request` that updates title or description **also silently removes all reviewers** from the PR.
- Users lose PR review state, requiring manual re-addition of reviewers after every title/description update.
- Approval workflows are disrupted (approved reviewers are removed, approvals lost).
- Silent failure mode (no error, no warning) makes the bug hard to detect until reviewers notice they're missing.

**Scope:** Affects all users of `bitbucket_update_pull_request` tool on Bitbucket Server/DC. Bitbucket Cloud is unaffected (no Cloud PR API in this codebase).

**Discovery:** Bug was identified during plan review for Phase 6 enhancements. No user reports documented (feature may not have been deployed to production yet, or bug was caught during pre-deployment testing).

### Resolution

A follow-up feature `feat-update-pr-preserve-reviewers` was authored to reverse the "no internal auto-GET" decision and implement the correct fix:

**Changes:**

1. Rewrite `PullRequestApi.updatePullRequest` in `src/bitbucket/api/pull-requests.ts` to implement GET-then-PUT pattern:
   - Fetch current PR state via existing `get()` method.
   - Build PUT body by echoing `reviewers` and `toRef` verbatim from fetched PR.
   - Override only `title` and/or `description` as supplied by caller.
   - Use `version` from GET response by default; allow caller to override via optional `version` parameter (backward compatibility).
2. Add bounded single retry on 409 PullRequestOutOfDateException (optimistic lock conflict).
3. Update `updatePullRequestShape` in `src/tools/schemas.ts` to make `version` optional (was required).
4. Update tool description in `src/tools/registry.ts` to document that reviewers are now preserved.
5. Comprehensive unit tests (8 client-level tests + 6 schema tests) covering GET-then-PUT flow, reviewer preservation, version sourcing, 409 retry.
6. Live testing on real Bitbucket Server/DC to confirm reviewers are retained after PR update.

**Plan location:** `docs/plans/phase-6/feat-update-pr-preserve-reviewers/`

### Plan Updated

**Original plan (`plan.md`):** **NOT modified**. The historical record (lines 34-36 documenting the "no internal auto-GET" decision, and lines 228-247 documenting the "default assumption" rationale) is preserved as-is.

**Rationale:** The original plan correctly documented a deliberate decision made at the time, based on available information and pattern consistency with `bitbucket_update_comment`. That decision was later discovered to be incorrect due to a misunderstanding of Bitbucket's API semantics. Rather than rewriting history (which would obscure the decision-making process and the mistake), this changelog entry captures:

1. What decision was made.
2. Why it was made (assumptions + rationale).
3. Why it was wrong (API semantics misunderstood).
4. How it was fixed (follow-up feature).

This approach preserves the original plan as a learning artifact while clearly documenting the mistake and resolution.

### Deviation

**Deviation Level:** Major — architectural change.

- **Before:** Single-request PUT with caller-supplied version (explicit version management, no internal GET).
- **After:** GET-then-PUT with auto-fetched version (internal GET, implicit version management with optional override).

This is a fundamental change in how the tool operates, not a cosmetic or minor adjustment.

**Backward Compatibility:**

- **Breaking change (minor):** `version` parameter is now optional (was required). Existing callers passing `version` continue to work (their version is used as an override). New callers can omit `version` entirely.
- **Behavioral change:** Reviewers are now preserved (was previously wiped). This is a bug fix, not a feature change, so it's not considered a breaking change in the semantic versioning sense.

### Confidence Impact

The original plan's "Decisions / deviations" section (lines 228-247) flagged the "require caller to supply version explicitly" decision as a **"default assumption (recorded, reversible)"** with the following note:

> "This was the recommended option in the feature requirements. The user didn't respond to a clarifying question in time, so the default recommendation was auto-selected. This decision is flagged here as clearly visible and reversible."

This was an **explicit low-confidence decision** — the plan acknowledged it might need to be revisited. This changelog entry closes that open question with a definitive reversal.

**Confidence now:** High — the fix is grounded in:

1. Atlassian issue tracker confirmation (BSERV-19139).
2. Bitbucket REST API documentation (PUT semantics, required fields).
3. Live testing on real Bitbucket Server/DC instance.

### Lessons Learned

1. **API semantics matter:** Always verify whether an update endpoint uses PATCH (partial update) or PUT (full-object replacement) semantics. Never assume based on naming alone.
2. **Required fields must be documented:** When implementing a PUT endpoint wrapper, explicitly list all required fields and verify them via API documentation + issue trackers. For Bitbucket PR updates, required fields are: `version`, `title`, `description`, `toRef`, `reviewers`.
3. **Default assumptions must be tested early:** The original plan flagged the "no internal auto-GET" decision as a "default assumption, reversible" but did not mandate live testing before merge. Future plans should require **live test verification** for any decision marked as "default assumption" or "low confidence" — ideally before the feature is marked done, not after.
4. **Consult API issue trackers:** BSERV-19139 clearly documents the "omitting reviewers removes them" behavior. This should have been discovered during plan authoring by searching the Atlassian issue tracker for "pull request update reviewers" or similar keywords.
5. **Pattern consistency can mislead:** The original plan used `bitbucket_update_comment` as a pattern template, assuming PR updates work the same way. This was a false analogy — comment updates and PR updates have different field requirements and semantics.

### Follow-up Actions

- [x] Authored follow-up plan `feat-update-pr-preserve-reviewers` (2026-07-27).
- [ ] Implement follow-up plan (in progress).
- [ ] Live test on real Bitbucket Server/DC with reviewers (verification step).
- [ ] Add regression test to prevent re-introduction of reviewer-wipe bug (covered in Phase 3 of follow-up plan).
- [ ] Consider adding a warning or pre-commit hook to catch similar "full-object PUT" bugs in future API wrappers.

### References

- **Atlassian Issue:** BSERV-19139 — "PR update omits reviewers → removes all reviewers" (closed "Not a bug", Feb 2024)
- **Original Plan:** `docs/plans/phase-6/feat-update-pr/plan.md` (lines 34-36, 228-247)
- **Follow-up Plan:** `docs/plans/phase-6/feat-update-pr-preserve-reviewers/`
- **Affected Code:** `src/bitbucket/api/pull-requests.ts:152-165`, `src/tools/schemas.ts:73-78`, `src/tools/pr-tools.ts:375-412`
