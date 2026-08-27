import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { createBitbucketHelper } from '../dist/src/helper.js';

const EXPLICIT_OPTIONS = {
  url: 'https://bitbucket.juspay.net',
  token: 'BBDC-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  defaultProject: 'BZ',
};

const BASE_ENV = {
  BITBUCKET_URL: 'https://bitbucket.juspay.net',
  BITBUCKET_TOKEN: 'BBDC-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
  BITBUCKET_DEFAULT_PROJECT: 'ENV',
};

describe('Unit: createBitbucketHelper', () => {
  let saved;

  beforeEach(() => {
    saved = process.env;
    process.env = {};
  });

  afterEach(() => {
    process.env = saved;
  });

  it('should build a helper from explicit options without reading env', () => {
    const helper = createBitbucketHelper(EXPLICIT_OPTIONS);
    assert.equal(helper.config.bitbucketUrl, 'https://bitbucket.juspay.net');
    assert.equal(helper.config.defaultProject, 'BZ');
    assert.equal(helper.config.bitbucketToken, EXPLICIT_OPTIONS.token);
  });

  it('should expose the client and all resource groups', () => {
    const helper = createBitbucketHelper(EXPLICIT_OPTIONS);
    assert.ok(helper.client);
    assert.equal(typeof helper.client.requestJson, 'function');
    assert.ok(helper.pullRequests);
    assert.ok(helper.repositories);
    assert.ok(helper.search);
  });

  it('should expose bound resource functions safe to destructure', () => {
    const helper = createBitbucketHelper(EXPLICIT_OPTIONS);
    const expected = {
      pullRequests: ['list', 'get', 'getDiff', 'getCommits', 'getActivities', 'addComment'],
      repositories: ['listProjects', 'listRepositories', 'getRepository', 'getBranches'],
      search: ['searchCode', 'searchCommits'],
    };
    for (const [group, methods] of Object.entries(expected)) {
      for (const method of methods) {
        const fn = helper[group][method];
        assert.equal(typeof fn, 'function', `${group}.${method} should be a function`);
        assert.equal(fn.name, `bound ${method}`, `${group}.${method} should be bound`);
      }
    }
  });

  it('should throw when token is missing and env is empty', () => {
    assert.throws(() => createBitbucketHelper({ url: EXPLICIT_OPTIONS.url, defaultProject: 'BZ' }));
  });

  it('should throw when explicit options are given but env is empty and url is missing', () => {
    assert.throws(() =>
      createBitbucketHelper({ token: EXPLICIT_OPTIONS.token, defaultProject: 'BZ' })
    );
  });

  it('should reject a non-HTTPS explicit url', () => {
    assert.throws(
      () => createBitbucketHelper({ ...EXPLICIT_OPTIONS, url: 'http://bitbucket.juspay.net' }),
      /HTTPS/
    );
  });

  it('should strip trailing slashes from an explicit url', () => {
    const helper = createBitbucketHelper({
      ...EXPLICIT_OPTIONS,
      url: 'https://bitbucket.juspay.net///',
    });
    assert.equal(helper.config.bitbucketUrl, 'https://bitbucket.juspay.net');
  });

  it('should overlay explicit options on env-derived config', () => {
    process.env = { ...BASE_ENV };
    const helper = createBitbucketHelper({ defaultProject: 'BZ', requestTimeout: 5000 });
    assert.equal(helper.config.bitbucketUrl, BASE_ENV.BITBUCKET_URL);
    assert.equal(helper.config.bitbucketToken, BASE_ENV.BITBUCKET_TOKEN);
    assert.equal(helper.config.defaultProject, 'BZ');
    assert.equal(helper.config.api.requestTimeout, 5000);
  });

  it('should apply api passthrough options and safe defaults explicitly', () => {
    const helper = createBitbucketHelper({
      ...EXPLICIT_OPTIONS,
      requestTimeout: 1000,
      maxRetries: 0,
      rateLimitDelay: 250,
    });
    assert.equal(helper.config.api.requestTimeout, 1000);
    assert.equal(helper.config.api.maxRetries, 0);
    assert.equal(helper.config.api.rateLimitDelay, 250);
    assert.equal(helper.config.cache.enabled, false);
  });
});
