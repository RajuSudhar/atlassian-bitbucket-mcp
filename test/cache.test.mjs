import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Cache, cacheKey } from '../dist/src/cache.js';

describe('Unit: cacheKey', () => {
  it('should compose an instance-scoped key', () => {
    assert.equal(
      cacheKey('https://bitbucket.juspay.net', 'repo', 'BZ/nimble'),
      'https://bitbucket.juspay.net:repo:BZ/nimble'
    );
  });
});

describe('Unit: Cache', () => {
  it('should store and retrieve a value within TTL', () => {
    const cache = new Cache({ enabled: true });
    cache.set('k', { v: 1 }, 60);
    assert.deepEqual(cache.get('k'), { v: 1 });
  });

  it('should return null for a missing key', () => {
    const cache = new Cache({ enabled: true });
    assert.equal(cache.get('nope'), null);
  });

  it('should expire entries past their TTL', () => {
    const cache = new Cache({ enabled: true });
    cache.set('k', 'val', -1); // already expired
    assert.equal(cache.get('k'), null);
  });

  it('should be a no-op when disabled', () => {
    const cache = new Cache({ enabled: false });
    cache.set('k', 'val', 60);
    assert.equal(cache.get('k'), null);
    assert.equal(cache.size, 0);
  });

  it('should invalidate by prefix', () => {
    const cache = new Cache({ enabled: true });
    cache.set('pr:1', 'a', 60);
    cache.set('pr:2', 'b', 60);
    cache.set('repo:1', 'c', 60);
    cache.invalidate('pr:');
    assert.equal(cache.get('pr:1'), null);
    assert.equal(cache.get('pr:2'), null);
    assert.equal(cache.get('repo:1'), 'c');
  });

  it('should clear all entries', () => {
    const cache = new Cache({ enabled: true });
    cache.set('a', 1, 60);
    cache.set('b', 2, 60);
    cache.clear();
    assert.equal(cache.size, 0);
  });
});
