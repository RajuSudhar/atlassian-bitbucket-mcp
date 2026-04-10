/*
 * In-memory TTL cache
 */

import { log } from './logger.js';

import type { CacheConfig } from '@types';
import type { CacheEntry, CacheStore } from '@types';

export function cacheKey(instanceUrl: string, resource: string, identifier: string): string {
  return `${instanceUrl}:${resource}:${identifier}`;
}

export class Cache {
  private readonly store: CacheStore = new Map();
  private readonly enabled: boolean;

  constructor(config: CacheConfig) {
    this.enabled = config.enabled;
  }

  get<T>(key: string): T | null {
    if (!this.enabled) return null;

    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      log('debug', 'cache miss', { operation: 'cache_miss', key });
      return null;
    }

    if (Date.now() > entry.timestamp + entry.ttl * 1000) {
      this.store.delete(key);
      log('debug', 'cache expired', { operation: 'cache_miss', key });
      return null;
    }

    log('debug', 'cache hit', { operation: 'cache_hit', key });
    return entry.data;
  }

  set<T>(key: string, data: T, ttl: number): void {
    if (!this.enabled) return;

    const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
    this.store.set(key, entry as CacheEntry<unknown>);
    log('debug', 'cache set', { operation: 'cache_set', key });
  }

  invalidate(prefix: string): void {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    if (count > 0) {
      log('debug', 'cache invalidated', { operation: 'cache_invalidate', key: prefix, count });
    }
  }

  clear(): void {
    const size = this.store.size;
    this.store.clear();
    log('info', 'cache cleared', { operation: 'cache_clear', count: size });
  }

  get size(): number {
    return this.store.size;
  }
}
