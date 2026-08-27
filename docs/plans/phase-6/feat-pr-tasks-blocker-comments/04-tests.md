# Phase 4 — Tests

## Objective

Extend `test/schemas.test.mjs` to validate `listTasksShape` (state enum parsing, default value, rejection of invalid values), create a new `test/pull-requests.test.mjs` to unit-test the `listTasks` client method (pagination loop, state filtering, client-side fallback), and integrate both into the `pnpm test` command.

## Scope

### In Scope

- Add test cases for `listTasksShape` in `test/schemas.test.mjs`:
  - Accepts `{project, repo, prId, state: 'OPEN'}` → parsed as `'OPEN'`.
  - Accepts `{project, repo, prId, state: 'RESOLVED'}` → parsed as `'RESOLVED'`.
  - Accepts `{project, repo, prId, state: 'ALL'}` → parsed as `'ALL'`.
  - Accepts `{project, repo, prId}` (state omitted) → defaults to `'ALL'`.
  - Rejects `{project, repo, prId, state: 'INVALID'}` → zod validation error.
  - Rejects `{project, repo, prId, state: null}` → zod validation error.
- Create `test/pull-requests.test.mjs`:
  - Mock `BitbucketClient.requestJson` to simulate multi-page `/blocker-comments` responses.
  - Test pagination loop: 2-page response (page 1: 25 tasks, page 2: 10 tasks, isLastPage=true) → returns 35 tasks.
  - Test state query param: state='RESOLVED' → query includes `state=RESOLVED`.
  - Test state omitted → query excludes `state`.
  - Test client-side fallback filter: server returns mixed OPEN/RESOLVED tasks, client filters by state.
  - Test pagination safety: `isLastPage=false` but `nextPageStart=undefined` → logs warning, terminates loop.
- Wire `test/pull-requests.test.mjs` into `pnpm test` (already runs `node --test test/*.test.mjs`).

### Out of Scope

- Integration tests (MCP client ↔ server). Deferred to Phase 5 live verification.
- Tests for `setTaskState` / `deleteTask` (unchanged, already covered by existing manual testing).

## Implementation

### Step 4.1: Extend test/schemas.test.mjs for listTasksShape

**File**: `test/schemas.test.mjs`

Add the following test suite after the existing schema tests (approximately after line 100):

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { listTasksShape } from '../dist/tools/schemas.js';

describe('listTasksShape', () => {
  const schema = z.object(listTasksShape);

  it('parses valid OPEN state', () => {
    const input = { project: 'FOO', repo: 'bar', prId: 42, state: 'OPEN' };
    const result = schema.parse(input);
    assert.equal(result.state, 'OPEN');
    assert.equal(result.project, 'FOO');
    assert.equal(result.repo, 'bar');
    assert.equal(result.prId, 42);
  });

  it('parses valid RESOLVED state', () => {
    const input = { project: 'FOO', repo: 'bar', prId: 42, state: 'RESOLVED' };
    const result = schema.parse(input);
    assert.equal(result.state, 'RESOLVED');
  });

  it('parses valid ALL state', () => {
    const input = { project: 'FOO', repo: 'bar', prId: 42, state: 'ALL' };
    const result = schema.parse(input);
    assert.equal(result.state, 'ALL');
  });

  it('defaults to ALL when state is omitted', () => {
    const input = { project: 'FOO', repo: 'bar', prId: 42 };
    const result = schema.parse(input);
    assert.equal(result.state, 'ALL');
  });

  it('rejects invalid state value', () => {
    const input = { project: 'FOO', repo: 'bar', prId: 42, state: 'INVALID' };
    assert.throws(() => schema.parse(input), {
      name: 'ZodError',
    });
  });

  it('rejects null state', () => {
    const input = { project: 'FOO', repo: 'bar', prId: 42, state: null };
    assert.throws(() => schema.parse(input), {
      name: 'ZodError',
    });
  });

  it('accepts optional limit and start', () => {
    const input = { project: 'FOO', repo: 'bar', prId: 42, limit: 50, start: 25 };
    const result = schema.parse(input);
    assert.equal(result.limit, 50);
    assert.equal(result.start, 25);
    assert.equal(result.state, 'ALL'); // default
  });
});
```

**Rationale**:

- Tests cover all enum values (`'OPEN'`, `'RESOLVED'`, `'ALL'`), default behavior, rejection of invalid/null values.
- Uses Node's built-in `node:test` and `node:assert/strict` (zero deps).
- Imports from `dist/tools/schemas.js` (compiled output, matching existing test pattern).

### Step 4.2: Create test/pull-requests.test.mjs

**File**: `test/pull-requests.test.mjs` (new file)

```javascript
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PullRequestsApi } from '../dist/bitbucket/api/pull-requests.js';

describe('PullRequestsApi.listTasks', () => {
  it('paginates across multiple pages', async () => {
    const mockClient = {
      requestJson: mock.fn(async (path, opts) => {
        const start = opts?.queryParams?.start ?? 0;
        if (start === 0) {
          return {
            values: Array.from({ length: 25 }, (_, i) => ({
              id: i + 1,
              version: 1,
              text: `Task ${i + 1}`,
              severity: 'BLOCKER',
              state: 'OPEN',
              author: { name: 'user1', emailAddress: 'user1@example.com', displayName: 'User 1' },
            })),
            size: 25,
            limit: 25,
            isLastPage: false,
            start: 0,
            nextPageStart: 25,
          };
        } else if (start === 25) {
          return {
            values: Array.from({ length: 10 }, (_, i) => ({
              id: i + 26,
              version: 1,
              text: `Task ${i + 26}`,
              severity: 'BLOCKER',
              state: 'OPEN',
              author: { name: 'user1', emailAddress: 'user1@example.com', displayName: 'User 1' },
            })),
            size: 10,
            limit: 25,
            isLastPage: true,
            start: 25,
          };
        }
        throw new Error('Unexpected start value');
      }),
    };

    const api = new PullRequestsApi(mockClient);
    const tasks = await api.listTasks('FOO', 'bar', 42);

    assert.equal(tasks.length, 35);
    assert.equal(mockClient.requestJson.mock.calls.length, 2);
    assert.equal(tasks[0].id, 1);
    assert.equal(tasks[24].id, 25);
    assert.equal(tasks[25].id, 26);
    assert.equal(tasks[34].id, 35);
  });

  it('includes state query param when state is defined', async () => {
    const mockClient = {
      requestJson: mock.fn(async () => ({
        values: [
          {
            id: 1,
            version: 1,
            text: 'Task 1',
            severity: 'BLOCKER',
            state: 'RESOLVED',
            author: { name: 'user1', emailAddress: 'user1@example.com', displayName: 'User 1' },
          },
        ],
        size: 1,
        limit: 25,
        isLastPage: true,
        start: 0,
      })),
    };

    const api = new PullRequestsApi(mockClient);
    await api.listTasks('FOO', 'bar', 42, 'RESOLVED');

    assert.equal(mockClient.requestJson.mock.calls.length, 1);
    const call = mockClient.requestJson.mock.calls[0];
    assert.equal(call.arguments[0], '/projects/FOO/repos/bar/pull-requests/42/blocker-comments');
    assert.equal(call.arguments[1]?.queryParams?.state, 'RESOLVED');
  });

  it('omits state query param when state is undefined', async () => {
    const mockClient = {
      requestJson: mock.fn(async () => ({
        values: [],
        size: 0,
        limit: 25,
        isLastPage: true,
        start: 0,
      })),
    };

    const api = new PullRequestsApi(mockClient);
    await api.listTasks('FOO', 'bar', 42, undefined);

    assert.equal(mockClient.requestJson.mock.calls.length, 1);
    const call = mockClient.requestJson.mock.calls[0];
    assert.equal(call.arguments[1]?.queryParams?.state, undefined);
  });

  it('applies client-side state filter when server returns mixed states', async () => {
    const mockClient = {
      requestJson: mock.fn(async () => ({
        values: [
          {
            id: 1,
            version: 1,
            text: 'Task 1',
            severity: 'BLOCKER',
            state: 'OPEN',
            author: { name: 'user1', emailAddress: 'user1@example.com', displayName: 'User 1' },
          },
          {
            id: 2,
            version: 1,
            text: 'Task 2',
            severity: 'BLOCKER',
            state: 'RESOLVED',
            author: { name: 'user1', emailAddress: 'user1@example.com', displayName: 'User 1' },
          },
          {
            id: 3,
            version: 1,
            text: 'Task 3',
            severity: 'BLOCKER',
            state: 'OPEN',
            author: { name: 'user1', emailAddress: 'user1@example.com', displayName: 'User 1' },
          },
        ],
        size: 3,
        limit: 25,
        isLastPage: true,
        start: 0,
      })),
    };

    const api = new PullRequestsApi(mockClient);
    const tasks = await api.listTasks('FOO', 'bar', 42, 'RESOLVED');

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, 2);
    assert.equal(tasks[0].state, 'RESOLVED');
  });

  it('terminates pagination loop on isLastPage=false with undefined nextPageStart', async () => {
    const mockClient = {
      requestJson: mock.fn(async () => ({
        values: [
          {
            id: 1,
            version: 1,
            text: 'Task 1',
            severity: 'BLOCKER',
            state: 'OPEN',
            author: { name: 'user1', emailAddress: 'user1@example.com', displayName: 'User 1' },
          },
        ],
        size: 1,
        limit: 25,
        isLastPage: false,
        start: 0,
        nextPageStart: undefined,
      })),
    };

    const api = new PullRequestsApi(mockClient);
    const tasks = await api.listTasks('FOO', 'bar', 42);

    assert.equal(tasks.length, 1);
    assert.equal(mockClient.requestJson.mock.calls.length, 1);
  });

  it('filters OPEN tasks correctly', async () => {
    const mockClient = {
      requestJson: mock.fn(async () => ({
        values: [
          {
            id: 1,
            version: 1,
            text: 'Task 1',
            severity: 'BLOCKER',
            state: 'OPEN',
            author: { name: 'user1', emailAddress: 'user1@example.com', displayName: 'User 1' },
          },
          {
            id: 2,
            version: 1,
            text: 'Task 2',
            severity: 'BLOCKER',
            state: 'RESOLVED',
            author: { name: 'user1', emailAddress: 'user1@example.com', displayName: 'User 1' },
          },
        ],
        size: 2,
        limit: 25,
        isLastPage: true,
        start: 0,
      })),
    };

    const api = new PullRequestsApi(mockClient);
    const tasks = await api.listTasks('FOO', 'bar', 42, 'OPEN');

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, 1);
    assert.equal(tasks[0].state, 'OPEN');
  });
});
```

**Rationale**:

- **Pagination test**: Mocks 2-page response (page 1: 25 tasks, page 2: 10 tasks), verifies `listTasks` accumulates 35 tasks and makes 2 requests.
- **State query param test**: Verifies `state='RESOLVED'` is passed as query param.
- **State omitted test**: Verifies `state=undefined` omits the query param.
- **Client-side filter test**: Server returns mixed OPEN/RESOLVED tasks; client filters to only RESOLVED tasks.
- **Pagination safety test**: Server returns `isLastPage=false` with `nextPageStart=undefined`; client terminates loop (1 request, 1 task).
- **OPEN filter test**: Additional coverage for filtering OPEN tasks.
- Uses `node:test` mock.fn for zero-dependency mocking.

### Step 4.3: Verify test command integration

**File**: `package.json`

Confirm the `test` script exists and runs `node --test test/*.test.mjs`:

```json
{
  "scripts": {
    "pretest": "pnpm run build",
    "test": "node --test test/*.test.mjs"
  }
}
```

No changes required; `test/pull-requests.test.mjs` will be picked up automatically by the glob pattern.

### Step 4.4: Run tests

**Command**:

```bash
pnpm test
```

**Expected output**:

- All `listTasksShape` tests pass (7 tests).
- All `PullRequestsApi.listTasks` tests pass (6 tests).
- Total: 13 new tests + existing schema tests.

## Verification Gates

- [ ] `pnpm test` passes.
- [ ] `test/schemas.test.mjs` includes 7 tests for `listTasksShape` (all pass).
- [ ] `test/pull-requests.test.mjs` includes 6 tests for `PullRequestsApi.listTasks` (all pass).
- [ ] Pagination test verifies 2-page accumulation (35 tasks).
- [ ] State query param test verifies `state=RESOLVED` included in query.
- [ ] Client-side filter test verifies fallback filtering when server returns mixed states.
- [ ] Pagination safety test verifies loop termination on `isLastPage=false && nextPageStart=undefined`.

## Files Modified

| File                          | Lines Added | Description                                                |
| ----------------------------- | ----------- | ---------------------------------------------------------- |
| `test/schemas.test.mjs`       | ~60 lines   | Add `listTasksShape` test suite (7 tests)                  |
| `test/pull-requests.test.mjs` | ~230 lines  | New file: `PullRequestsApi.listTasks` unit tests (6 tests) |

## Files NOT Modified

| File                                                                                               | Reason                                           |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `package.json`                                                                                     | Test command already runs `test/*.test.mjs` glob |
| `test/config.test.mjs`, `test/permissions.test.mjs`, `test/cache.test.mjs`, `test/logger.test.mjs` | Unrelated to this feature                        |

## Critical Notes

- **CRITICAL**: Tests run against compiled output (`dist/`). The `pretest` script ensures `pnpm run build` runs before tests.
- **IMPORTANT**: Mock responses include all required `BitbucketComment` fields (`id`, `version`, `text`, `severity`, `state`, `author`) to match the real API shape.
- **IMPORTANT**: The pagination test verifies both `isLastPage` flag and `nextPageStart` value advancement.
- **IMPORTANT**: Client-side filter test simulates a DC version that ignores the `state` query param (returns all states), confirming the client-side fallback works.

## Cross-references

- Phase 3 defined `listTasksShape` schema consumed by these tests.
- Phase 2 implemented `listTasks` pagination loop and state filter tested here.
- Phase 5 will perform live verification against `bitbucket.juspay.net`, confirming real-world behavior matches unit test assumptions.
