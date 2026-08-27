import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PermissionDeniedError,
  ScopeDeniedError,
  requirePermission,
  requireScope,
} from '../dist/src/permissions.js';

function makeConfig(overrides = {}) {
  return {
    allowedActions: new Set(['read_pr', 'write_pr']),
    allowedProjects: new Set(),
    allowedRepos: new Set(),
    ...overrides,
  };
}

describe('Unit: requirePermission', () => {
  it('should permit an allowed action', () => {
    assert.doesNotThrow(() => requirePermission(makeConfig(), 'read_pr'));
  });

  it('should deny a disallowed action', () => {
    assert.throws(() => requirePermission(makeConfig(), 'manage_pr'), PermissionDeniedError);
  });
});

describe('Unit: requireScope', () => {
  it('should allow any project/repo when allow-lists are empty', () => {
    assert.doesNotThrow(() => requireScope(makeConfig(), 'ANY', 'thing'));
  });

  it('should allow a project in the allow-list (case-insensitive)', () => {
    const config = makeConfig({ allowedProjects: new Set(['bz']) });
    assert.doesNotThrow(() => requireScope(config, 'BZ'));
  });

  it('should deny a project outside the allow-list', () => {
    const config = makeConfig({ allowedProjects: new Set(['bz']) });
    assert.throws(() => requireScope(config, 'SECRET'), ScopeDeniedError);
  });

  it('should allow a fully qualified project/repo entry', () => {
    const config = makeConfig({ allowedRepos: new Set(['bz/nimble']) });
    assert.doesNotThrow(() => requireScope(config, 'BZ', 'nimble'));
  });

  it('should allow a bare repo slug under any project', () => {
    const config = makeConfig({ allowedRepos: new Set(['shared-lib']) });
    assert.doesNotThrow(() => requireScope(config, 'BZ', 'shared-lib'));
    assert.doesNotThrow(() => requireScope(config, 'OTHER', 'shared-lib'));
  });

  it('should deny a repo outside the allow-list', () => {
    const config = makeConfig({ allowedRepos: new Set(['bz/nimble']) });
    assert.throws(() => requireScope(config, 'BZ', 'other'), ScopeDeniedError);
  });

  it('should enforce project even when repo passes on bare slug', () => {
    const config = makeConfig({
      allowedProjects: new Set(['bz']),
      allowedRepos: new Set(['nimble']),
    });
    assert.throws(() => requireScope(config, 'FORBIDDEN', 'nimble'), ScopeDeniedError);
  });
});
