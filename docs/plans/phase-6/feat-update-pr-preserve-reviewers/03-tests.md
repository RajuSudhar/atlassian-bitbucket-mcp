# Phase 3 — Tests

## Objective

Add comprehensive unit tests covering the updated `updatePullRequest` client logic (GET-then-PUT, reviewer+toRef preservation, version sourcing, 409 retry) in `test/pull-requests.test.mjs`, and update schema tests in `test/schemas.test.mjs` to assert `version` is now optional.

## In Scope

- Create `test/pull-requests.test.mjs` if it doesn't exist (follow existing test style from `test/permissions.test.mjs`, `test/schemas.test.mjs`).
- Test suite for `updatePullRequest`:
  1. Mock GET returning PR with reviewers+toRef, mock PUT success → assert PUT body includes reviewers+toRef verbatim.
  2. Assert title override: caller supplies title, fetched description is used.
  3. Assert description override: caller supplies description, fetched title is used.
  4. Assert both title+description override.
  5. Assert version sourcing: caller omits version → assert PUT uses fetched version.
  6. Assert version override: caller supplies version → assert PUT uses caller's version.
  7. Assert 409 retry: first PUT returns 409 → assert re-fetch GET called, second PUT with fresh version.
  8. Assert 409 exhaustion: second PUT returns 409 → assert error thrown (no third retry).
- Update `test/schemas.test.mjs`:
  - `describe('Unit: updatePullRequestShape', ...)` → update existing tests to assert version optional.
  - Add test: input without version parses successfully.
  - Preserve existing tests: title-only, description-only, both, missing version (should now PASS since version is optional), negative version.

## Out of Scope

- Integration tests against real Bitbucket Server/DC (live tests in Phase 4 verification).
- Handler-level tests (no `pr-tools.test.mjs` in this repo per precedent).

## Implementation

### File: `test/pull-requests.test.mjs`

**Create new file if absent.** Follow existing test file conventions:

- Use Node's built-in `node:test` + `node:assert`.
- ESM imports from `dist/` (tests run after `pnpm run build` via `pretest` script).
- Mock HTTP client using a simple stub (no external mocking library per project constraints).

**Structure:**

```javascript
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('Unit: PullRequestApi.updatePullRequest', () => {
  it('echoes reviewers and toRef verbatim in PUT body', async () => {
    // Mock client: GET returns PR with reviewers, PUT succeeds
    const mockGet = mock.fn(async () => ({
      version: 10,
      title: 'old title',
      description: 'old desc',
      toRef: { id: 'refs/heads/main', repository: { slug: 'repo' } },
      reviewers: [{ user: { name: 'alice' }, approved: false }],
    }));
    const mockPut = mock.fn(async (path, opts) => {
      // Assert PUT body includes reviewers+toRef from GET
      assert.deepEqual(opts.body.reviewers, [{ user: { name: 'alice' }, approved: false }]);
      assert.deepEqual(opts.body.toRef, { id: 'refs/heads/main', repository: { slug: 'repo' } });
      assert.strictEqual(opts.body.version, 10); // version from GET
      return { version: 11, title: 'new title', description: 'old desc', reviewers: [...] };
    });

    const prApi = createMockPrApi({ get: mockGet, requestJson: mockPut });
    await prApi.updatePullRequest('proj', 'repo', 123, { title: 'new title' });

    assert.strictEqual(mockGet.mock.calls.length, 1);
    assert.strictEqual(mockPut.mock.calls.length, 1);
  });

  it('uses fetched description when caller supplies title only', async () => {
    const mockGet = mock.fn(async () => ({
      version: 5,
      title: 'old title',
      description: 'fetched desc',
      toRef: { id: 'refs/heads/main' },
      reviewers: [],
    }));
    const mockPut = mock.fn(async (path, opts) => {
      assert.strictEqual(opts.body.title, 'new title');
      assert.strictEqual(opts.body.description, 'fetched desc'); // from GET
      return { version: 6 };
    });

    const prApi = createMockPrApi({ get: mockGet, requestJson: mockPut });
    await prApi.updatePullRequest('p', 'r', 1, { title: 'new title' });
    assert.strictEqual(mockPut.mock.calls.length, 1);
  });

  it('uses fetched title when caller supplies description only', async () => {
    const mockGet = mock.fn(async () => ({
      version: 5,
      title: 'fetched title',
      description: 'old desc',
      toRef: { id: 'refs/heads/main' },
      reviewers: [],
    }));
    const mockPut = mock.fn(async (path, opts) => {
      assert.strictEqual(opts.body.title, 'fetched title'); // from GET
      assert.strictEqual(opts.body.description, 'new desc');
      return { version: 6 };
    });

    const prApi = createMockPrApi({ get: mockGet, requestJson: mockPut });
    await prApi.updatePullRequest('p', 'r', 1, { description: 'new desc' });
    assert.strictEqual(mockPut.mock.calls.length, 1);
  });

  it('overrides both title and description when caller supplies both', async () => {
    const mockGet = mock.fn(async () => ({
      version: 5,
      title: 'old title',
      description: 'old desc',
      toRef: { id: 'refs/heads/main' },
      reviewers: [],
    }));
    const mockPut = mock.fn(async (path, opts) => {
      assert.strictEqual(opts.body.title, 'new title');
      assert.strictEqual(opts.body.description, 'new desc');
      return { version: 6 };
    });

    const prApi = createMockPrApi({ get: mockGet, requestJson: mockPut });
    await prApi.updatePullRequest('p', 'r', 1, { title: 'new title', description: 'new desc' });
    assert.strictEqual(mockPut.mock.calls.length, 1);
  });

  it('uses fetched version when caller omits version', async () => {
    const mockGet = mock.fn(async () => ({
      version: 42,
      title: 't',
      description: 'd',
      toRef: { id: 'refs/heads/main' },
      reviewers: [],
    }));
    const mockPut = mock.fn(async (path, opts) => {
      assert.strictEqual(opts.body.version, 42); // from GET
      return { version: 43 };
    });

    const prApi = createMockPrApi({ get: mockGet, requestJson: mockPut });
    await prApi.updatePullRequest('p', 'r', 1, { title: 'new' }); // no version
    assert.strictEqual(mockPut.mock.calls.length, 1);
  });

  it('uses caller-supplied version when provided', async () => {
    const mockGet = mock.fn(async () => ({
      version: 10,
      title: 't',
      description: 'd',
      toRef: { id: 'refs/heads/main' },
      reviewers: [],
    }));
    const mockPut = mock.fn(async (path, opts) => {
      assert.strictEqual(opts.body.version, 99); // caller override
      return { version: 100 };
    });

    const prApi = createMockPrApi({ get: mockGet, requestJson: mockPut });
    await prApi.updatePullRequest('p', 'r', 1, { title: 'new', version: 99 });
    assert.strictEqual(mockPut.mock.calls.length, 1);
  });

  it('retries once on 409 with fresh version', async () => {
    const mockGet = mock.fn()
      .mockImplementationOnce(async () => ({
        version: 5,
        title: 't',
        description: 'd',
        toRef: { id: 'refs/heads/main' },
        reviewers: [],
      }))
      .mockImplementationOnce(async () => ({
        version: 6, // fresh version for retry
        title: 't',
        description: 'd',
        toRef: { id: 'refs/heads/main' },
        reviewers: [],
      }));

    const mockPut = mock.fn()
      .mockImplementationOnce(async () => {
        // First PUT: throw 409
        const err = new Error('Conflict: 409');
        throw err;
      })
      .mockImplementationOnce(async (path, opts) => {
        // Second PUT: assert fresh version used
        assert.strictEqual(opts.body.version, 6);
        return { version: 7 };
      });

    const prApi = createMockPrApi({ get: mockGet, requestJson: mockPut });
    await prApi.updatePullRequest('p', 'r', 1, { title: 'new' });

    assert.strictEqual(mockGet.mock.calls.length, 2); // initial + retry
    assert.strictEqual(mockPut.mock.calls.length, 2); // initial + retry
  });

  it('throws on second 409 without further retry', async () => {
    const mockGet = mock.fn()
      .mockImplementation(async () => ({
        version: 5,
        title: 't',
        description: 'd',
        toRef: { id: 'refs/heads/main' },
        reviewers: [],
      }));

    const mockPut = mock.fn(async () => {
      // Always throw 409
      throw new Error('Conflict: 409');
    });

    const prApi = createMockPrApi({ get: mockGet, requestJson: mockPut });

    await assert.rejects(
      async () => prApi.updatePullRequest('p', 'r', 1, { title: 'new' }),
      { message: /409/ }
    );

    assert.strictEqual(mockGet.mock.calls.length, 2); // initial + one retry
    assert.strictEqual(mockPut.mock.calls.length, 2); // initial + one retry (no third attempt)
  });
});

// Helper to create a mock PullRequestApi instance
function createMockPrApi(mocks) {
  // Simplified mock; real implementation would import PullRequestApi class
  // and inject a mock BitbucketClient. Since PullRequestApi is a class,
  // we need to either:
  // 1. Export a factory function from pull-requests.ts for testing, OR
  // 2. Mock the BitbucketClient dependency and instantiate PullRequestApi, OR
  // 3. Test via the handler (which is out of scope per plan).
  //
  // For this plan, assume option 1 (factory function) or option 2 (mock injection).
  // Actual code will use the dist/ build output and mock the client.

  // Placeholder return structure matching the test expectations:
  return {
    get: mocks.get,
    updatePullRequest: async (project, repo, prId, updates) => {
      // Simulate the real updatePullRequest logic using mocks
      const currentPr = await mocks.get(project, repo, prId);
      const body = {
        version: updates.version ?? currentPr.version,
        title: updates.title ?? currentPr.title,
        description: updates.description ?? currentPr.description,
        toRef: currentPr.toRef,
        reviewers: currentPr.reviewers ?? [],
      };
      try {
        return await mocks.requestJson(`/projects/${project}/repos/${repo}/pull-requests/${prId}`, {
          method: 'PUT',
          body,
        });
      } catch (err) {
        if (err.message.includes('409')) {
          const freshPr = await mocks.get(project, repo, prId);
          return await mocks.requestJson(`/projects/${project}/repos/${repo}/pull-requests/${prId}`, {
            method: 'PUT',
            body: { ...body, version: freshPr.version },
          });
        }
        throw err;
      }
    },
  };
}
```

**CRITICAL:** The `createMockPrApi` helper above is a simplified illustration. The actual test implementation must:

1. Import `PullRequestApi` from `dist/bitbucket/api/pull-requests.js` (after build).
2. Mock the `BitbucketClient` dependency (either by creating a stub class or using a factory pattern).
3. Instantiate `PullRequestApi` with the mocked client.
4. Verify the real implementation matches the plan.

If `PullRequestApi` doesn't support constructor injection of a mock client, add a static factory method or test via the handler (out of scope, but document as a test gap).

**Alternative approach (if direct unit testing of `PullRequestApi` is difficult):**

- Test via the handler in `pr-tools.ts` (requires mocking `prApi` in the handler factory).
- Document this as a pragmatic trade-off (handler-level tests vs client-level tests).

**For this plan, proceed with the client-level test structure above.** Phase 4 verification will confirm whether the test actually runs or needs adjustment.

### File: `test/schemas.test.mjs`

**Location:** Existing file, add to or update `describe('Unit: updatePullRequestShape', ...)` block.

**Current tests (from original plan):**

- Accepts title-only
- Accepts description-only
- Accepts both title+description
- Rejects missing version (this test will CHANGE — version is now optional)
- Rejects negative version

**Updated tests:**

```javascript
describe('Unit: updatePullRequestShape', () => {
  it('accepts title-only without version', () => {
    const result = z.object(updatePullRequestShape).safeParse({
      project: 'proj',
      repo: 'repo',
      prId: 1,
      title: 'new title',
    });
    assert.strictEqual(result.success, true);
  });

  it('accepts description-only without version', () => {
    const result = z.object(updatePullRequestShape).safeParse({
      project: 'proj',
      repo: 'repo',
      prId: 1,
      description: 'new desc',
    });
    assert.strictEqual(result.success, true);
  });

  it('accepts both title and description with version', () => {
    const result = z.object(updatePullRequestShape).safeParse({
      project: 'proj',
      repo: 'repo',
      prId: 1,
      title: 'new title',
      description: 'new desc',
      version: 5,
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.version, 5);
  });

  it('accepts input without version (auto-fetched)', () => {
    const result = z.object(updatePullRequestShape).safeParse({
      project: 'proj',
      repo: 'repo',
      prId: 1,
      title: 'new title',
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.version, undefined);
  });

  it('rejects negative version', () => {
    const result = z.object(updatePullRequestShape).safeParse({
      project: 'proj',
      repo: 'repo',
      prId: 1,
      title: 'new title',
      version: -1,
    });
    assert.strictEqual(result.success, false);
  });

  it('rejects missing both title and description (via handler refine)', () => {
    // Note: the .refine() lives in the handler, not the shape, so this test
    // applies the refine manually to simulate handler behavior.
    const schema = z
      .object(updatePullRequestShape)
      .refine((data) => data.title !== undefined || data.description !== undefined, {
        message: 'At least one of title or description must be provided',
      });

    const result = schema.safeParse({
      project: 'proj',
      repo: 'repo',
      prId: 1,
      version: 5,
    });
    assert.strictEqual(result.success, false);
    assert.match(result.error.issues[0].message, /At least one of title or description/);
  });
});
```

**Import check:**

```javascript
import { updatePullRequestShape } from '../dist/tools/schemas.js'; // adjust path if needed
import { z } from 'zod';
```

**Verification:**

- Run `pnpm test` → all tests pass.
- Specifically assert the "accepts input without version" test passes (confirms optional version).

## Test Coverage Summary

| Test                            | File                     | Assertion                                           |
| ------------------------------- | ------------------------ | --------------------------------------------------- |
| Reviewers+toRef echoed verbatim | `pull-requests.test.mjs` | PUT body includes exact reviewer objects from GET   |
| Title override                  | `pull-requests.test.mjs` | Caller title used, fetched description used         |
| Description override            | `pull-requests.test.mjs` | Caller description used, fetched title used         |
| Both title+description override | `pull-requests.test.mjs` | Both caller values used                             |
| Version auto-fetched            | `pull-requests.test.mjs` | PUT uses version from GET when caller omits version |
| Version caller override         | `pull-requests.test.mjs` | PUT uses caller version when supplied               |
| 409 retry once                  | `pull-requests.test.mjs` | Re-fetch + retry on first 409                       |
| 409 exhaustion                  | `pull-requests.test.mjs` | Throw on second 409, no third attempt               |
| Version optional in schema      | `schemas.test.mjs`       | Parse succeeds without version field                |
| Refine enforced                 | `schemas.test.mjs`       | Rejects input with neither title nor description    |

## Phase Gate

- [ ] `test/pull-requests.test.mjs` created with all 8 client-level tests.
- [ ] `test/schemas.test.mjs` updated: version optional test added, refine test updated.
- [ ] `pnpm test` passes (all existing + new tests).
- [ ] `pnpm run lint:all` passes (test files linted).
- [ ] Code coverage confirms GET-then-PUT flow, retry logic, version sourcing.
