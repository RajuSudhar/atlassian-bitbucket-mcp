/*
 * Cache types
 */

export type CacheEntry<T> = {
  readonly data: T;
  readonly timestamp: number;
  readonly ttl: number;
};

export type CacheStore = Map<string, CacheEntry<unknown>>;
