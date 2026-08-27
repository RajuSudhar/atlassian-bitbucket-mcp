import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { z } from 'zod';

import {
  addPrCommentShape,
  addPrInlineCommentShape,
  createPrTaskShape,
  deletePrTaskShape,
  listTasksShape,
  publishPrReviewShape,
  replyToCommentShape,
  resolvePrTaskShape,
  updatePullRequestShape,
} from '../dist/src/tools/schemas.js';

describe('Unit: createPrTaskShape', () => {
  const schema = z.object(createPrTaskShape);

  // `pending` defaults to false — a task posts immediately unless it is
  // explicitly queued into a review session.
  it('should accept a top-level task (no parentCommentId)', () => {
    const input = { project: 'BZ', repo: 'nimble', prId: 3641, text: 'fix this' };
    assert.deepEqual(schema.parse(input), { ...input, pending: false });
  });

  it('should accept a task anchored to a parent comment', () => {
    const input = {
      project: 'BZ',
      repo: 'nimble',
      prId: 3641,
      text: 'fix this',
      parentCommentId: 42,
    };
    assert.deepEqual(schema.parse(input), { ...input, pending: false });
  });

  it('should reject empty task text', () => {
    assert.throws(() => schema.parse({ project: 'BZ', repo: 'nimble', prId: 3641, text: '' }));
  });

  it('should reject a non-positive parentCommentId', () => {
    assert.throws(() =>
      schema.parse({ project: 'BZ', repo: 'nimble', prId: 3641, text: 'x', parentCommentId: 0 })
    );
  });
});

describe('Unit: resolvePrTaskShape', () => {
  const schema = z.object(resolvePrTaskShape);

  it('should accept OPEN and RESOLVED states', () => {
    const base = { project: 'BZ', repo: 'nimble', prId: 3641, taskId: 7, version: 0 };
    assert.doesNotThrow(() => schema.parse({ ...base, state: 'OPEN' }));
    assert.doesNotThrow(() => schema.parse({ ...base, state: 'RESOLVED' }));
  });

  it('should reject an unknown state', () => {
    assert.throws(() =>
      schema.parse({
        project: 'BZ',
        repo: 'nimble',
        prId: 3641,
        taskId: 7,
        version: 0,
        state: 'DONE',
      })
    );
  });

  it('should reject a missing version', () => {
    assert.throws(() =>
      schema.parse({ project: 'BZ', repo: 'nimble', prId: 3641, taskId: 7, state: 'OPEN' })
    );
  });
});

describe('Unit: deletePrTaskShape', () => {
  const schema = z.object(deletePrTaskShape);

  it('should accept a valid delete input', () => {
    const input = { project: 'BZ', repo: 'nimble', prId: 3641, taskId: 7, version: 0 };
    assert.deepEqual(schema.parse(input), input);
  });

  it('should reject a missing taskId', () => {
    assert.throws(() => schema.parse({ project: 'BZ', repo: 'nimble', prId: 3641, version: 0 }));
  });

  it('should reject a missing version', () => {
    assert.throws(() => schema.parse({ project: 'BZ', repo: 'nimble', prId: 3641, taskId: 7 }));
  });
});

describe('Unit: updatePullRequestShape', () => {
  const schema = z.object(updatePullRequestShape);

  // Note: The "at least one of title or description must be provided" constraint
  // is enforced via .refine() at the handler level (in src/tools/pr-tools.ts),
  // not in the Zod shape itself, so it is NOT covered by these schema-level tests.
  // Handler-level validation should be tested in pr-tools.test.mjs when that file
  // is added; this repo currently has no handler-level test file for any PR tools.

  it('should accept title-only without version', () => {
    const input = { project: 'BZ', repo: 'nimble', prId: 3641, title: 'Updated Title' };
    assert.deepEqual(schema.parse(input), input);
  });

  it('should accept description-only without version', () => {
    const input = { project: 'BZ', repo: 'nimble', prId: 3641, description: 'Updated description' };
    assert.deepEqual(schema.parse(input), input);
  });

  it('should accept both title and description with version', () => {
    const input = {
      project: 'BZ',
      repo: 'nimble',
      prId: 3641,
      title: 'New Title',
      description: 'New desc',
      version: 5,
    };
    assert.deepEqual(schema.parse(input), input);
  });

  it('should accept input without version (auto-fetched)', () => {
    const input = { project: 'BZ', repo: 'nimble', prId: 3641, title: 'new title' };
    const result = schema.parse(input);
    assert.strictEqual(result.version, undefined);
  });

  it('should reject negative version', () => {
    assert.throws(() =>
      schema.parse({ project: 'BZ', repo: 'nimble', prId: 3641, title: 'Updated', version: -1 })
    );
  });

  it('should reject missing both title and description (via handler refine)', () => {
    // Note: the .refine() lives in the handler, not the shape, so this test
    // applies the refine manually to simulate handler behavior.
    const schemaWithRefine = schema.refine(
      (data) => data.title !== undefined || data.description !== undefined,
      {
        message: 'At least one of title or description must be provided',
      }
    );

    const result = schemaWithRefine.safeParse({
      project: 'BZ',
      repo: 'nimble',
      prId: 3641,
      version: 5,
    });
    assert.strictEqual(result.success, false);
    assert.match(result.error.issues[0].message, /At least one of title or description/);
  });
});

describe('Unit: listTasksShape', () => {
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

describe('Unit: pending flag on comment shapes', () => {
  const base = { project: 'FOO', repo: 'bar', prId: 42, text: 'hello' };

  it('defaults pending to false so comments post immediately', () => {
    assert.equal(z.object(addPrCommentShape).parse(base).pending, false);
    assert.equal(z.object(createPrTaskShape).parse(base).pending, false);
    assert.equal(z.object(replyToCommentShape).parse({ ...base, commentId: 7 }).pending, false);
  });

  it('accepts pending true', () => {
    assert.equal(z.object(addPrCommentShape).parse({ ...base, pending: true }).pending, true);
  });

  it('rejects a non-boolean pending, including the string "false"', () => {
    assert.throws(() => z.object(addPrCommentShape).parse({ ...base, pending: 'false' }));
    assert.throws(() => z.object(addPrCommentShape).parse({ ...base, pending: 1 }));
  });

  it('carries pending on inline comments alongside the anchor fields', () => {
    const result = z.object(addPrInlineCommentShape).parse({
      ...base,
      path: 'src/a.ts',
      line: 3,
      lineType: 'ADDED',
      pending: true,
    });
    assert.equal(result.pending, true);
    assert.equal(result.lineType, 'ADDED');
  });
});

describe('Unit: publishPrReviewShape', () => {
  const schema = z.object(publishPrReviewShape);
  const base = { project: 'FOO', repo: 'bar', prId: 42 };

  it('accepts a bare publish with neither overview nor verdict', () => {
    const result = schema.parse(base);
    assert.equal(result.commentText, undefined);
    assert.equal(result.participantStatus, undefined);
  });

  it('accepts an overview comment and each participant status', () => {
    for (const participantStatus of ['UNAPPROVED', 'NEEDS_WORK', 'APPROVED']) {
      const result = schema.parse({ ...base, commentText: 'lgtm', participantStatus });
      assert.equal(result.participantStatus, participantStatus);
      assert.equal(result.commentText, 'lgtm');
    }
  });

  it('rejects an unknown or lower-cased participant status', () => {
    assert.throws(() => schema.parse({ ...base, participantStatus: 'MERGED' }));
    assert.throws(() => schema.parse({ ...base, participantStatus: 'approved' }));
  });

  it('rejects an empty overview comment', () => {
    assert.throws(() => schema.parse({ ...base, commentText: '' }));
  });
});
