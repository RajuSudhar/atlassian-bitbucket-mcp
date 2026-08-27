# feat-ci-helper-exports

Phase: 6 | Status: [x] done
Depends on: feat-project-repo-scoping (phase 6)
Ref: `claude-ref/typescript.md`, `claude-ref/client.md`, `claude-ref/testing.md`

## Goal

Expose the Bitbucket API layer as a programmatic library via a package
subpath export, so CI jobs can
`import { createBitbucketHelper } from 'atlassian-bitbucket-mcp/helper'` and
call functions directly — no MCP protocol, no server process.

## In scope

- New public entry point `src/helper.ts` exporting
  `createBitbucketHelper(options?: BitbucketHelperOptions)`:
  - Options (all optional): `url`, `token`, `defaultProject`, plus API
    passthroughs `requestTimeout`, `maxRetries`, `rateLimitDelay`. Explicit
    options override env; when all three required options are provided, the
    `Config` is built without touching `process.env`; otherwise
    `loadConfig()` runs and explicit options are overlaid on top.
  - Returned helper groups the API by resource with the client pre-bound:
    `helper.pullRequests` (`PullRequestApi`), `helper.repositories`
    (`RepositoryApi`), `helper.search` (`SearchApi`), plus `helper.client`
    (raw `request`/`requestJson` escape hatch) and `helper.config`.
  - Prototype methods are rebound onto each API instance so destructuring
    (`const { get } = helper.pullRequests`) keeps `this`.
  - Re-exports API/error classes and the relevant request/response types so
    CI code can be fully typed.
- `types/helper.ts` — new `BitbucketHelperOptions` type (`type` only),
  re-exported from `types/index.ts` per the existing pattern.
- `package.json` — `exports` map: `.` (existing index), `./helper` (new
  entry), `./package.json`. `main`/`bin` unchanged.
- `test/helper.test.mjs` — node:test unit tests against `dist/`, no network.

## Out of scope

- README / TRACK.md updates (owned by a follow-up docs pass).
- Permission gating (`requirePermission`) and project/repo scoping
  (`requireScope`) inside the helper — this is a direct library; the caller
  holds the token, so scoping is theirs to enforce.
- Cache wiring — the API layer never consults the `Cache`; the helper builds
  its `Config` with `cache.enabled: false` (safe for one-shot CI calls).
- Cloud-specific PR routing (same instance scope as the existing API layer).

## Design

- **Declaration-resolution constraint:** `src/helper.ts` is a published entry
  point whose emitted `.d.ts` must resolve for package consumers, and the
  `@types` path alias does not exist outside this repo. In `src/helper.ts`
  ONLY, types are imported by relative path
  (`import type { ... } from '../types/index.js'`), with a comment
  documenting the exception. Every other file keeps using `@types`.
- **Config resolution** (`resolveConfig`):
  - `url` + `token` + `defaultProject` all provided → `buildExplicitConfig`:
    HTTPS-validated and trailing-slash-normalized URL (same rules as
    `loadConfig`), all actions allowed, empty project/repo scope sets (= all
    allowed), cache disabled, `api` from options with `loadConfig`-matching
    defaults (30000 / 3 / 0), stdio transport defaults, `logLevel: 'info'`.
  - Otherwise → `loadConfig()` (zod-parses env, fails fast on missing
    required vars) then overlay any provided options; cache forced disabled.
- **No token exposure:** the helper never logs the token; the single debug
  log emits only `bitbucketUrl` and `defaultProject`.
- `package.json` `exports`:

  ```json
  "exports": {
    ".": { "types": "./dist/src/index.d.ts", "default": "./dist/src/index.js" },
    "./helper": { "types": "./dist/src/helper.d.ts", "default": "./dist/src/helper.js" },
    "./package.json": "./package.json"
  }
  ```

  `tsconfig` already emits `dist/src/helper.js` + `.d.ts` and
  `dist/types/*.d.ts` (rootDir `.`, declaration on), so the relative
  `../types/index.js` specifier in the emitted declaration resolves inside
  the published `dist/` tree.

## Tasks

- [x] `types/helper.ts` — `BitbucketHelperOptions`
- [x] `types/index.ts` — re-export `./helper.js`
- [x] `src/helper.ts` — `createBitbucketHelper`, `BitbucketHelper`, class /
      error / type re-exports, relative-path type imports with comment
- [x] `package.json` — `exports` map (`.`, `./helper`, `./package.json`)
- [x] `test/helper.test.mjs` — explicit-options construction, resource
      groups + bound functions, missing token + empty env throws, HTTPS
      rejection, env overlay, api passthroughs
- [x] typecheck + lint + tests pass

## Definition of done

- [x] `createBitbucketHelper({ url, token, defaultProject })` works with an
      empty environment (no env reads on the explicit path)
- [x] missing required option + empty env fails fast with a clear error
- [x] token never logged or emitted
- [x] typecheck + lint + tests pass
