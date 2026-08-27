# Checklist — feat-update-pr-preserve-reviewers

## Phase 1: Client read-modify-write with 409 retry

- [ ] Rewrite `PullRequestApi.updatePullRequest` in `src/bitbucket/api/pull-requests.ts` (lines 152-165)
  - [ ] Change signature: `version: number` → `version?: number` (optional)
  - [ ] Add GET call: `const currentPr = await this.get(project, repo, prId);`
  - [ ] Build PUT body echoing:
    - [ ] `version: updates.version ?? currentPr.version`
    - [ ] `title: updates.title ?? currentPr.title`
    - [ ] `description: updates.description ?? currentPr.description`
    - [ ] `toRef: currentPr.toRef` (verbatim)
    - [ ] `reviewers: currentPr.reviewers ?? []` (verbatim with fallback)
  - [ ] Implement helper function `attemptPut(versionOverride?)` for PUT logic
  - [ ] Add try-catch around first PUT call
  - [ ] On 409 error: log warning, re-fetch GET, retry PUT with fresh version
  - [ ] On second 409: throw immediately (no third retry)
- [ ] Verify imports: `log` from `../logger.ts`, `PullRequest` from `@types`
- [ ] Verify 409 error detection matches client error format
- [ ] No `any` types, no `as` type assertions
- [ ] Run `pnpm run typecheck` — zero errors
- [ ] Run `pnpm run lint:all` — zero errors in modified file

**Gate:** Phase 1 complete when all above checkboxes ticked and typecheck passes.

---

## Phase 2: Schema + handler updates

- [ ] Update `updatePullRequestShape` in `src/tools/schemas.ts` (lines 73-78)
  - [ ] Make `version` optional: add `.optional()` before `.describe()`
  - [ ] Update `description` field description: add "(reviewers are preserved)"
  - [ ] Update `version` field description: "(auto-fetched if omitted)"
- [ ] Update `src/tools/registry.ts`
  - [ ] Locate `bitbucket_update_pull_request` entry (~line 165-170)
  - [ ] Update description to: "Update PR title and/or description (Server/DC, auto-preserves reviewers, version optional)"
- [ ] Verify handler in `src/tools/pr-tools.ts` (lines 375-412)
  - [ ] No code change needed (type alignment only)
  - [ ] Confirm `.refine()` check still enforces "at least one of title/description"
- [ ] Run `pnpm run typecheck` — zero errors (confirm type alignment)
- [ ] Run `pnpm run lint:all` — zero errors

**Gate:** Phase 2 complete when all above checkboxes ticked and typecheck passes.

---

## Phase 3: Tests

### Client-level tests: `test/pull-requests.test.mjs`

- [ ] Create `test/pull-requests.test.mjs` if absent
- [ ] Use `node:test` + `node:assert/strict`
- [ ] Import from `dist/` (ESM after build)
- [ ] Implement `createMockPrApi` helper for mocking GET/PUT
- [ ] Test: "echoes reviewers and toRef verbatim in PUT body"
  - [ ] Mock GET returns PR with reviewers + toRef
  - [ ] Assert PUT body includes exact reviewer objects
  - [ ] Assert PUT body includes exact toRef object
- [ ] Test: "uses fetched description when caller supplies title only"
  - [ ] Assert PUT body.title = caller's title
  - [ ] Assert PUT body.description = fetched description
- [ ] Test: "uses fetched title when caller supplies description only"
  - [ ] Assert PUT body.title = fetched title
  - [ ] Assert PUT body.description = caller's description
- [ ] Test: "overrides both title and description when caller supplies both"
  - [ ] Assert PUT body.title = caller's title
  - [ ] Assert PUT body.description = caller's description
- [ ] Test: "uses fetched version when caller omits version"
  - [ ] Assert PUT body.version = fetched version (from GET)
- [ ] Test: "uses caller-supplied version when provided"
  - [ ] Assert PUT body.version = caller's version (override)
- [ ] Test: "retries once on 409 with fresh version"
  - [ ] Mock first PUT throws 409
  - [ ] Mock second GET returns fresh version
  - [ ] Mock second PUT succeeds
  - [ ] Assert GET called twice (initial + retry)
  - [ ] Assert PUT called twice (initial + retry)
- [ ] Test: "throws on second 409 without further retry"
  - [ ] Mock both PUTs throw 409
  - [ ] Assert error thrown
  - [ ] Assert GET called twice (initial + retry)
  - [ ] Assert PUT called twice (no third attempt)

### Schema tests: `test/schemas.test.mjs`

- [ ] Update `describe('Unit: updatePullRequestShape', ...)` block
- [ ] Test: "accepts title-only without version"
  - [ ] Assert `safeParse({project, repo, prId, title})` success
- [ ] Test: "accepts description-only without version"
  - [ ] Assert `safeParse({project, repo, prId, description})` success
- [ ] Test: "accepts both title and description with version"
  - [ ] Assert `safeParse({project, repo, prId, title, description, version})` success
- [ ] Test: "accepts input without version (auto-fetched)"
  - [ ] Assert `safeParse({project, repo, prId, title})` success
  - [ ] Assert `result.data.version === undefined`
- [ ] Test: "rejects negative version"
  - [ ] Assert `safeParse({..., version: -1})` failure
- [ ] Test: "rejects missing both title and description (via handler refine)"
  - [ ] Apply `.refine()` manually in test
  - [ ] Assert `safeParse({project, repo, prId, version})` failure
  - [ ] Assert error message matches "At least one of title or description"

### Run tests

- [ ] Run `pnpm test` — all tests pass
- [ ] Run `pnpm run lint:all` — test files linted

**Gate:** Phase 3 complete when all above checkboxes ticked and `pnpm test` passes.

---

## Phase 4: Verification

### Automated checks

- [ ] Run `pnpm run typecheck` — zero errors
- [ ] Run `pnpm run lint:all` — zero errors (code + markdown)
- [ ] Run `pnpm test` — all tests pass

### Markdown linting

- [ ] All code fences have language tags (`typescript`, `bash`, `json`, `text`)
- [ ] Tables properly aligned (consistent `|` separators)
- [ ] No trailing whitespace
- [ ] Files checked:
  - [ ] `00-overview.md`
  - [ ] `01-client-read-modify-write.md`
  - [ ] `02-schema-and-handler.md`
  - [ ] `03-tests.md`
  - [ ] `04-verification.md`
  - [ ] `checklist.md`

### Live test on real Bitbucket Server/DC

- [ ] Identify or create test PR with >=1 reviewer assigned
- [ ] Record initial state:
  - [ ] PR ID, project, repo
  - [ ] Current version number
  - [ ] Current title, description
  - [ ] Reviewers list (names, approval status)
  - [ ] Target branch (`toRef`)
- [ ] Call `bitbucket_update_pull_request` with only description change (no version)

  ```json
  {
    "project": "DEMO",
    "repo": "test-repo",
    "prId": 42,
    "description": "Updated description via MCP tool"
  }
  ```

- [ ] Verify response:
  - [ ] `description` changed to new value
  - [ ] `reviewers` array UNCHANGED (same reviewers, same approval status)
  - [ ] `toRef` UNCHANGED (same target branch)
  - [ ] `version` incremented by 1
- [ ] Verify in Bitbucket UI:
  - [ ] Navigate to PR in web UI
  - [ ] Confirm description shows new value
  - [ ] Confirm reviewers list unchanged
  - [ ] Confirm target branch unchanged

### Edge case: Caller supplies version

- [ ] Call `bitbucket_update_pull_request` with explicit version

  ```json
  {
    "project": "DEMO",
    "repo": "test-repo",
    "prId": 42,
    "title": "New Title",
    "version": 11
  }
  ```

- [ ] Verify PUT uses caller's version (not fetched version)
- [ ] Verify response: version incremented from caller's value

### Edge case: 409 conflict

- [ ] Simulate concurrent update (e.g., update PR via Bitbucket UI during MCP call)
- [ ] Verify logs show "pr update conflict, retrying"
- [ ] Verify second PUT uses fresh version from re-fetched GET
- [ ] Verify final result: PR updated successfully (or fails with error if second 409)

### Documentation updates

- [ ] Update `docs/plans/TRACK.md`:
  - [ ] Add entry for `feat-update-pr-preserve-reviewers` in Phase 6
  - [ ] Mark as `[~]` (wip) during implementation
  - [ ] Mark as `[x]` (done) after all checks pass
- [ ] Create `docs/plans/phase-6/feat-update-pr/changelog.md` (if absent)
- [ ] Add changelog entry:
  - [ ] Category: "Plan Incorrect"
  - [ ] Document original "no internal auto-GET" decision
  - [ ] Document root cause (Bitbucket PUT semantics misunderstood)
  - [ ] Document resolution (follow-up feature)
  - [ ] Reference BSERV-19139
  - [ ] Preserve original plan.md as-is (no rewrite)

**Gate:** Phase 4 complete when all above checkboxes ticked, all automated checks pass, and live test confirms reviewers preserved.

---

## Summary Table

| Phase   | Tasks                            | Tests                           | Verification                           |
| ------- | -------------------------------- | ------------------------------- | -------------------------------------- |
| Phase 1 | Client GET-then-PUT rewrite      | N/A (Phase 3)                   | Typecheck + lint                       |
| Phase 2 | Schema + registry updates        | N/A (Phase 3)                   | Typecheck + lint                       |
| Phase 3 | Unit tests (client + schema)     | 8 client tests + 6 schema tests | `pnpm test` passes                     |
| Phase 4 | Markdown lint + live test + docs | All prior tests                 | Live test confirms reviewers preserved |

**Total tasks:** ~40 checkboxes  
**Total tests:** 14 unit tests + 1 live test  
**Total files modified:** 5 source files + 2 test files + 7 doc files

---

## Final Definition of Done

✓ All Phase 1-4 checkboxes ticked  
✓ `pnpm run validate` passes (typecheck + lint)  
✓ `pnpm test` passes (14 unit tests)  
✓ Live test on real Bitbucket Server/DC confirms reviewers preserved  
✓ TRACK.md updated  
✓ Changelog entry created  
✓ All markdown files pass lint

**Feature ready for merge when all criteria met.**
