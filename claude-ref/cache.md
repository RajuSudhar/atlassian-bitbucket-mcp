# cache (src/cache.ts)

## Shape

```ts
type CacheEntry<T> = { data: T; timestamp: number; ttl: number };
type CacheStore = Map<string, CacheEntry<unknown>>;
```

## Key format

`${instanceUrl}:${resource}:${identifier}`

Examples: `https://bitbucket.org:repos:PROJ`, `https://bb.corp:pr:PROJ/REPO/123`.

## TTLs (seconds)

- repos list: `BITBUCKET_CACHE_TTL_REPOS` (default 3600)
- repo metadata: `BITBUCKET_CACHE_TTL_REPO_META` (default 1800)
- users: `BITBUCKET_CACHE_TTL_USERS` (default 3600)

## Rules

- Gate all reads/writes on `BITBUCKET_CACHE_ENABLED`.
- Cache read-heavy static-ish data only. Never cache write responses, secrets, or auth state.
- Every write tool invalidates affected keys (see `tools.md` invalidation map).
- Log hit / miss / set / invalidate with `{ operation, key }`.
- `get<T>` returns `T | null`; `null` on miss or expired.
- `invalidate(pattern)` supports prefix match.
