import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { loadConfig } from '../dist/src/config.js';

const BASE_ENV = {
  BITBUCKET_URL: 'https://bitbucket.juspay.net',
  BITBUCKET_TOKEN: 'BBDC-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  BITBUCKET_DEFAULT_PROJECT: 'BZ',
};

describe('Unit: loadConfig', () => {
  let saved;

  beforeEach(() => {
    saved = process.env;
    process.env = { ...BASE_ENV };
  });

  afterEach(() => {
    process.env = saved;
  });

  it('should load the required Server/DC config', () => {
    const config = loadConfig();
    assert.equal(config.bitbucketUrl, 'https://bitbucket.juspay.net');
    assert.equal(config.defaultProject, 'BZ');
    assert.equal(config.bitbucketToken, BASE_ENV.BITBUCKET_TOKEN);
  });

  it('should strip trailing slashes from the URL', () => {
    process.env.BITBUCKET_URL = 'https://bitbucket.juspay.net///';
    assert.equal(loadConfig().bitbucketUrl, 'https://bitbucket.juspay.net');
  });

  it('should reject non-HTTPS URLs', () => {
    process.env.BITBUCKET_URL = 'http://bitbucket.juspay.net';
    assert.throws(() => loadConfig());
  });

  it('should default to all actions when unset', () => {
    const config = loadConfig();
    for (const action of [
      'read_pr',
      'write_pr',
      'manage_pr',
      'search_code',
      'read_repo',
      'read_project',
    ]) {
      assert.ok(config.allowedActions.has(action));
    }
  });

  it('should parse a restricted, whitespace-tolerant action list', () => {
    process.env.BITBUCKET_ALLOWED_ACTIONS = ' read_pr , write_pr ';
    const config = loadConfig();
    assert.ok(config.allowedActions.has('read_pr'));
    assert.ok(config.allowedActions.has('write_pr'));
    assert.ok(!config.allowedActions.has('manage_pr'));
  });

  it('should fail fast on an unknown action', () => {
    process.env.BITBUCKET_ALLOWED_ACTIONS = 'read_pr,delete_everything';
    assert.throws(() => loadConfig(), /Unknown action/);
  });

  it('should default allowed projects and repos to empty (all allowed)', () => {
    const config = loadConfig();
    assert.equal(config.allowedProjects.size, 0);
    assert.equal(config.allowedRepos.size, 0);
  });

  it('should parse and normalize allowed projects/repos to lowercase', () => {
    process.env.BITBUCKET_ALLOWED_PROJECTS = 'BZ, PLATFORM';
    process.env.BITBUCKET_ALLOWED_REPOS = 'BZ/Nimble, shared-lib';
    const config = loadConfig();
    assert.ok(config.allowedProjects.has('bz'));
    assert.ok(config.allowedProjects.has('platform'));
    assert.ok(config.allowedRepos.has('bz/nimble'));
    assert.ok(config.allowedRepos.has('shared-lib'));
  });
});
