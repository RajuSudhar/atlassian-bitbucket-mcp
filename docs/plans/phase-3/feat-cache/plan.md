# feat-cache

Phase: 3  |  Status: [ ] todo
Depends on: feat-config, feat-logger
Ref: `claude-ref/cache.md`, `claude-ref/typescript.md`

## Goal
In-memory TTL cache layer with typed get/set and pattern invalidation.

## In scope
- `src/cache.ts` — `Cache` class over `Map<string, CacheEntry<unknown>>`.
- Integration into `BitbucketClient` read methods.
- Invalidation hooks for tool writes.

## Out of scope
- Persistent cache (Redis/disk).
- LRU eviction (start with pure TTL; revisit if RSS grows).

## Design
- `get<T>(key): T | null`, `set<T>(key, data, ttl)`, `invalidate(prefix)`, `clear()`.
- Lazy expiry on `get` (check `timestamp + ttl*1000 < now`).
- Disabled mode: `get` returns null, `set` is no-op.
- Key builder helper: `cacheKey(instanceUrl, resource, id)`.

## Tasks
- [ ] types in `types/cache.ts`
- [ ] `Cache` class + key helper
- [ ] wire into client read paths (repos, repo meta, users)
- [ ] TTLs from config
- [ ] invalidation map in tool layer (see `claude-ref/tools.md`)
- [ ] log hit/miss/set/invalidate
- [ ] unit tests: hit, miss, expiry, disabled, invalidate prefix, clear

## Definition of done
- [ ] ≥ 80% coverage
- [ ] hit/miss metric loggable
- [ ] TRACK.md updated
