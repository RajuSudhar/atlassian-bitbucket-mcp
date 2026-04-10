# feat-config

Phase: 1  |  Status: [ ] todo
Depends on: —
Ref: `claude-ref/typescript.md`, `claude-ref/security.md`, `claude-ref/logger.md`

## Goal
Single typed source of truth for all env config with fail-fast validation.

## In scope
- `src/config.ts` — reads `process.env` once, validates, exports frozen `Config`.
- `types/config.ts` — `type Config = { ... }`.
- `.env.example` with placeholders.

## Out of scope
- Dynamic reloading.
- Secret stores / vaults.

## Design
- `loadConfig(): Config` — called once from `src/index.ts`.
- Parse with zod (or hand-rolled) — reject on missing required, wrong types, `http://` urls.
- Required: `BITBUCKET_URL`, `BITBUCKET_TOKEN`, `BITBUCKET_DEFAULT_PROJECT`.
- Optional with defaults: `BITBUCKET_ALLOWED_ACTIONS` (all), `BITBUCKET_CACHE_ENABLED` (true), `BITBUCKET_CACHE_TTL_*`, `BITBUCKET_REQUEST_TIMEOUT` (30000), `BITBUCKET_MAX_RETRIES` (3), `BITBUCKET_RATE_LIMIT_DELAY` (0).
- Token field marked non-enumerable or wrapped in `readonly brand` to prevent accidental serialization.
- NO other file may read `process.env`.

## Tasks
- [ ] define `type Config` in `types/config.ts`
- [ ] implement `loadConfig` with validation + HTTPS enforcement
- [ ] log masked summary on load (`log('info', 'config loaded', { url, hasToken: true })`)
- [ ] add zod (security-check, pin exact) or justify hand-rolled
- [ ] unit tests: missing vars, bad url scheme, invalid ints, defaults applied
- [ ] ESLint rule forbidding `process.env` outside `src/config.ts`

## Definition of done
- [ ] `pnpm typecheck` clean
- [ ] ≥ 80% coverage on `config.ts`
- [ ] token never appears in any log line (verified by test)
- [ ] TRACK.md updated
