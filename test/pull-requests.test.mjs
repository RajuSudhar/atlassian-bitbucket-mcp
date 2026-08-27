import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { PullRequestApi } from '../dist/src/bitbucket/api/pull-requests.js';
import { BitbucketApiError } from '../dist/src/bitbucket/errors.js';

describe('PullRequestApi.listTasks', () => {
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

    const api = new PullRequestApi(mockClient);
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

    const api = new PullRequestApi(mockClient);
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

    const api = new PullRequestApi(mockClient);
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

    const api = new PullRequestApi(mockClient);
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

    const api = new PullRequestApi(mockClient);
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

    const api = new PullRequestApi(mockClient);
    const tasks = await api.listTasks('FOO', 'bar', 42, 'OPEN');

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, 1);
    assert.equal(tasks[0].state, 'OPEN');
  });
});

describe('Unit: PullRequestApi.updatePullRequest', () => {
  it('echoes reviewers and toRef verbatim in PUT body', async () => {
    let callCount = 0;
    const mockClient = {
      requestJson: mock.fn(async (path, opts) => {
        callCount++;
        if (callCount === 1) {
          return {
            id: 123,
            version: 10,
            title: 'old title',
            description: 'old desc',
            toRef: { id: 'refs/heads/main', repository: { slug: 'repo' } },
            reviewers: [{ user: { name: 'alice' }, approved: false }],
          };
        } else {
          assert.deepEqual(opts.body.reviewers, [{ user: { name: 'alice' }, approved: false }]);
          assert.deepEqual(opts.body.toRef, {
            id: 'refs/heads/main',
            repository: { slug: 'repo' },
          });
          assert.strictEqual(opts.body.version, 10);
          assert.strictEqual(opts.body.id, 123);
          assert.strictEqual(opts.body.description, 'new desc');
          assert.strictEqual(opts.body.title, 'old title');
          return {
            version: 11,
            title: 'old title',
            description: 'new desc',
            reviewers: [{ user: { name: 'alice' }, approved: false }],
          };
        }
      }),
    };

    const api = new PullRequestApi(mockClient);
    await api.updatePullRequest('proj', 'repo', 123, { description: 'new desc' });

    assert.equal(mockClient.requestJson.mock.calls.length, 2);
  });

  it('uses fetched description when caller supplies title only', async () => {
    let callCount = 0;
    const mockClient = {
      requestJson: mock.fn(async (path, opts) => {
        callCount++;
        if (callCount === 1) {
          return {
            id: 1,
            version: 5,
            title: 'old title',
            description: 'fetched desc',
            toRef: { id: 'refs/heads/main' },
            reviewers: [],
          };
        } else {
          assert.strictEqual(opts.body.title, 'new title');
          assert.strictEqual(opts.body.description, 'fetched desc');
          return { version: 6 };
        }
      }),
    };

    const api = new PullRequestApi(mockClient);
    await api.updatePullRequest('p', 'r', 1, { title: 'new title' });
    assert.equal(mockClient.requestJson.mock.calls.length, 2);
  });

  it('uses fetched title when caller supplies description only', async () => {
    let callCount = 0;
    const mockClient = {
      requestJson: mock.fn(async (path, opts) => {
        callCount++;
        if (callCount === 1) {
          return {
            id: 1,
            version: 5,
            title: 'fetched title',
            description: 'old desc',
            toRef: { id: 'refs/heads/main' },
            reviewers: [],
          };
        } else {
          assert.strictEqual(opts.body.title, 'fetched title');
          assert.strictEqual(opts.body.description, 'new desc');
          return { version: 6 };
        }
      }),
    };

    const api = new PullRequestApi(mockClient);
    await api.updatePullRequest('p', 'r', 1, { description: 'new desc' });
    assert.equal(mockClient.requestJson.mock.calls.length, 2);
  });

  it('overrides both title and description when caller supplies both', async () => {
    let callCount = 0;
    const mockClient = {
      requestJson: mock.fn(async (path, opts) => {
        callCount++;
        if (callCount === 1) {
          return {
            id: 1,
            version: 5,
            title: 'old title',
            description: 'old desc',
            toRef: { id: 'refs/heads/main' },
            reviewers: [],
          };
        } else {
          assert.strictEqual(opts.body.title, 'new title');
          assert.strictEqual(opts.body.description, 'new desc');
          return { version: 6 };
        }
      }),
    };

    const api = new PullRequestApi(mockClient);
    await api.updatePullRequest('p', 'r', 1, { title: 'new title', description: 'new desc' });
    assert.equal(mockClient.requestJson.mock.calls.length, 2);
  });

  it('uses fetched version when caller omits version', async () => {
    let callCount = 0;
    const mockClient = {
      requestJson: mock.fn(async (path, opts) => {
        callCount++;
        if (callCount === 1) {
          return {
            id: 1,
            version: 42,
            title: 't',
            description: 'd',
            toRef: { id: 'refs/heads/main' },
            reviewers: [],
          };
        } else {
          assert.strictEqual(opts.body.version, 42);
          return { version: 43 };
        }
      }),
    };

    const api = new PullRequestApi(mockClient);
    await api.updatePullRequest('p', 'r', 1, { title: 'new' });
    assert.equal(mockClient.requestJson.mock.calls.length, 2);
  });

  it('uses caller-supplied version when provided', async () => {
    let callCount = 0;
    const mockClient = {
      requestJson: mock.fn(async (path, opts) => {
        callCount++;
        if (callCount === 1) {
          return {
            id: 1,
            version: 10,
            title: 't',
            description: 'd',
            toRef: { id: 'refs/heads/main' },
            reviewers: [],
          };
        } else {
          assert.strictEqual(opts.body.version, 99);
          return { version: 100 };
        }
      }),
    };

    const api = new PullRequestApi(mockClient);
    await api.updatePullRequest('p', 'r', 1, { title: 'new', version: 99 });
    assert.equal(mockClient.requestJson.mock.calls.length, 2);
  });

  it('retries on 409 conflict and uses freshly fetched PR data', async () => {
    let callCount = 0;
    const mockClient = {
      requestJson: mock.fn(async (path, opts) => {
        callCount++;
        if (callCount === 1) {
          return {
            id: 123,
            version: 1,
            title: 'Title',
            description: 'Desc',
            toRef: { id: 'refs/heads/main', repository: { slug: 'repo' } },
            reviewers: [
              { user: { name: 'alice' }, approved: false },
              { user: { name: 'bob' }, approved: false },
            ],
          };
        } else if (callCount === 2) {
          throw new BitbucketApiError(
            409,
            '/projects/p/repos/r/pull-requests/123',
            'PUT',
            'Conflict: PR was updated'
          );
        } else if (callCount === 3) {
          return {
            id: 123,
            version: 2,
            title: 'Title',
            description: 'Desc',
            toRef: { id: 'refs/heads/main', repository: { slug: 'repo' } },
            reviewers: [
              { user: { name: 'alice' }, approved: false },
              { user: { name: 'bob' }, approved: false },
              { user: { name: 'charlie' }, approved: false },
            ],
          };
        } else if (callCount === 4) {
          assert.strictEqual(opts.body.version, 2, 'PUT#2 should use fresh version 2');
          assert.equal(
            opts.body.reviewers.length,
            3,
            'PUT#2 should use fresh reviewers with 3 members'
          );
          assert.strictEqual(opts.body.reviewers[0].user.name, 'alice');
          assert.strictEqual(opts.body.reviewers[1].user.name, 'bob');
          assert.strictEqual(opts.body.reviewers[2].user.name, 'charlie');
          return { version: 3 };
        }
        throw new Error(`Unexpected call count: ${callCount}`);
      }),
    };

    const api = new PullRequestApi(mockClient);
    const result = await api.updatePullRequest('p', 'r', 123, { description: 'Desc' });

    assert.equal(result.version, 3);
    assert.equal(
      mockClient.requestJson.mock.calls.length,
      4,
      'Expected exactly 4 calls: GET#1, PUT#1, GET#2, PUT#2'
    );
  });

  it('propagates 409 on second attempt without retry loop', async () => {
    let callCount = 0;
    const mockClient = {
      requestJson: mock.fn(async (_path, _opts) => {
        callCount++;
        if (callCount === 1) {
          return {
            id: 456,
            version: 5,
            title: 'Title',
            description: 'Desc',
            toRef: { id: 'refs/heads/main', repository: { slug: 'repo' } },
            reviewers: [],
          };
        } else if (callCount === 2) {
          throw new BitbucketApiError(
            409,
            '/projects/p/repos/r/pull-requests/456',
            'PUT',
            'Conflict in PUT#1'
          );
        } else if (callCount === 3) {
          return {
            id: 456,
            version: 6,
            title: 'Title',
            description: 'Desc',
            toRef: { id: 'refs/heads/main', repository: { slug: 'repo' } },
            reviewers: [],
          };
        } else if (callCount === 4) {
          throw new BitbucketApiError(
            409,
            '/projects/p/repos/r/pull-requests/456',
            'PUT',
            'Conflict in PUT#2'
          );
        }
        throw new Error(`Unexpected call count: ${callCount}, expected to stop after PUT#2 409`);
      }),
    };

    const api = new PullRequestApi(mockClient);
    await assert.rejects(
      async () => api.updatePullRequest('p', 'r', 456, { description: 'Desc' }),
      (err) => {
        assert(err instanceof BitbucketApiError, 'Should throw BitbucketApiError');
        assert.equal(err.statusCode, 409, 'Should propagate the 409 status code');
        return true;
      }
    );

    assert.equal(
      mockClient.requestJson.mock.calls.length,
      4,
      'Expected exactly 4 calls: GET#1, PUT#1, GET#2, PUT#2, then throw'
    );
  });

  it('does not leak undefined description in PUT body', async () => {
    let callCount = 0;
    const mockClient = {
      requestJson: mock.fn(async (path, opts) => {
        callCount++;
        if (callCount === 1) {
          return {
            id: 1,
            version: 5,
            title: 'old title',
            description: undefined,
            toRef: { id: 'refs/heads/main' },
            reviewers: [],
          };
        } else {
          const hasDescriptionKey = Object.prototype.hasOwnProperty.call(opts.body, 'description');
          if (hasDescriptionKey) {
            assert.notStrictEqual(
              opts.body.description,
              undefined,
              'description should not be undefined in body'
            );
          }
          return { version: 6 };
        }
      }),
    };

    const api = new PullRequestApi(mockClient);
    await api.updatePullRequest('p', 'r', 1, { title: 'new title' });
    assert.equal(mockClient.requestJson.mock.calls.length, 2);
  });
});

describe('Unit: PullRequestApi pending comments', () => {
  const okComment = { id: 1, version: 0, text: 't', author: {}, createdDate: 0, updatedDate: 0 };

  it('should omit state when pending is not requested', async () => {
    const mockClient = { requestJson: mock.fn(async () => okComment) };
    const api = new PullRequestApi(mockClient);

    await api.addComment('FOO', 'bar', 42, 'hello');

    const [path, opts] = mockClient.requestJson.mock.calls[0].arguments;
    assert.equal(path, '/projects/FOO/repos/bar/pull-requests/42/comments');
    assert.equal(opts.method, 'POST');
    assert.deepEqual(opts.body, { text: 'hello' });
  });

  it('should send state PENDING on a general comment when pending is requested', async () => {
    const mockClient = { requestJson: mock.fn(async () => okComment) };
    const api = new PullRequestApi(mockClient);

    await api.addComment('FOO', 'bar', 42, 'hello', true);

    const [, opts] = mockClient.requestJson.mock.calls[0].arguments;
    assert.deepEqual(opts.body, { text: 'hello', state: 'PENDING' });
  });

  it('should send state PENDING alongside the anchor on an inline comment', async () => {
    const mockClient = { requestJson: mock.fn(async () => okComment) };
    const api = new PullRequestApi(mockClient);

    await api.addInlineComment(
      'FOO',
      'bar',
      42,
      'nit',
      { path: 'src/a.ts', line: 3, lineType: 'ADDED' },
      true
    );

    const [, opts] = mockClient.requestJson.mock.calls[0].arguments;
    assert.equal(opts.body.state, 'PENDING');
    assert.deepEqual(opts.body.anchor, {
      path: 'src/a.ts',
      line: 3,
      lineType: 'ADDED',
      diffType: 'EFFECTIVE',
    });
  });

  it('should send state PENDING alongside the parent on a reply', async () => {
    const mockClient = { requestJson: mock.fn(async () => okComment) };
    const api = new PullRequestApi(mockClient);

    await api.replyToComment('FOO', 'bar', 42, 7, 'agreed', true);

    const [, opts] = mockClient.requestJson.mock.calls[0].arguments;
    assert.deepEqual(opts.body, { text: 'agreed', parent: { id: 7 }, state: 'PENDING' });
  });

  it('should keep BLOCKER severity when a task is created as pending', async () => {
    const mockClient = { requestJson: mock.fn(async () => okComment) };
    const api = new PullRequestApi(mockClient);

    await api.createTask('FOO', 'bar', 42, 'fix this', 7, true);

    const [, opts] = mockClient.requestJson.mock.calls[0].arguments;
    assert.deepEqual(opts.body, {
      text: 'fix this',
      severity: 'BLOCKER',
      parent: { id: 7 },
      state: 'PENDING',
    });
  });
});

describe('Unit: PullRequestApi review sessions', () => {
  const emptyPage = { size: 0, limit: 25, start: 0, isLastPage: true, values: [] };

  it('should GET the review endpoint with pagination params', async () => {
    const mockClient = { requestJson: mock.fn(async () => emptyPage) };
    const api = new PullRequestApi(mockClient);

    await api.getReview('FOO', 'bar', 42, 50, 25);

    const [path, opts] = mockClient.requestJson.mock.calls[0].arguments;
    assert.equal(path, '/projects/FOO/repos/bar/pull-requests/42/review');
    assert.equal(opts.method, undefined);
    assert.deepEqual(opts.queryParams, { limit: 50, start: 25 });
  });

  it('should PUT an empty body when publishing without overview or verdict', async () => {
    const mockClient = { requestJson: mock.fn(async () => ({ publishedCommentCount: 3 })) };
    const api = new PullRequestApi(mockClient);

    const result = await api.publishReview('FOO', 'bar', 42);

    const [path, opts] = mockClient.requestJson.mock.calls[0].arguments;
    assert.equal(path, '/projects/FOO/repos/bar/pull-requests/42/review');
    assert.equal(opts.method, 'PUT');
    assert.deepEqual(opts.body, {});
    assert.equal(result.publishedCommentCount, 3);
  });

  it('should PUT overview text and participant status when supplied', async () => {
    const mockClient = { requestJson: mock.fn(async () => ({ publishedCommentCount: 1 })) };
    const api = new PullRequestApi(mockClient);

    await api.publishReview('FOO', 'bar', 42, {
      commentText: 'looks good overall',
      participantStatus: 'APPROVED',
    });

    const [, opts] = mockClient.requestJson.mock.calls[0].arguments;
    assert.deepEqual(opts.body, {
      commentText: 'looks good overall',
      participantStatus: 'APPROVED',
    });
  });

  it('should retry once with a lower-cased participant status on 400', async () => {
    const mockClient = {
      requestJson: mock.fn(async (path, opts) => {
        if (opts.body.participantStatus === 'NEEDS_WORK') {
          throw new BitbucketApiError(400, path, 'PUT', 'invalid participant status');
        }
        return { publishedCommentCount: 2 };
      }),
    };
    const api = new PullRequestApi(mockClient);

    const result = await api.publishReview('FOO', 'bar', 42, { participantStatus: 'NEEDS_WORK' });

    assert.equal(mockClient.requestJson.mock.calls.length, 2);
    const [, retryOpts] = mockClient.requestJson.mock.calls[1].arguments;
    assert.equal(retryOpts.body.participantStatus, 'needs_work');
    assert.equal(result.publishedCommentCount, 2);
  });

  it('should not retry a 400 when no participant status was sent', async () => {
    const mockClient = {
      requestJson: mock.fn(async (path) => {
        throw new BitbucketApiError(400, path, 'PUT', 'no review to finish');
      }),
    };
    const api = new PullRequestApi(mockClient);

    await assert.rejects(() => api.publishReview('FOO', 'bar', 42), BitbucketApiError);
    assert.equal(mockClient.requestJson.mock.calls.length, 1);
  });

  it('should DELETE the review endpoint when discarding', async () => {
    const mockClient = { request: mock.fn(async () => undefined) };
    const api = new PullRequestApi(mockClient);

    await api.discardReview('FOO', 'bar', 42);

    const [path, opts] = mockClient.request.mock.calls[0].arguments;
    assert.equal(path, '/projects/FOO/repos/bar/pull-requests/42/review');
    assert.equal(opts.method, 'DELETE');
  });
});
