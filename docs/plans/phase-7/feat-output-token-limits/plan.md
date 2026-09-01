# feat-output-token-limits

Phase: 7 | Status: [ ] todo
Depends on: feat-http-transport (phase 6), feat-ci-helper-exports (phase 6)
Ref: `claude-ref/tools.md`, `claude-ref/security.md`, `claude-ref/packages.md`,
`claude-ref/testing.md`, `claude-ref/typescript.md`, `claude-ref/config.md` (new, Phase 06)

Source: ported from `plane-mcp`'s per-tool output-token-limit governor
(`8553199 → 593889c → ef63d28 → 124f8f0 → d7984fb → 802dca8 → 18fe7c5`,
2026-08-28), adapted to this repo's conventions.

## Goal

Reject oversize MCP tool responses with an actionable guidance error instead
of truncating them, so callers narrow the request (fewer fields, smaller
`per_page`, a tighter filter, a single-item tool) instead of receiving a
silently clipped payload. The limit is config-file- and env-driven, with a
per-tool override.

## Non-goals

- Tool allowlist / enable-disable. `BITBUCKET_ALLOWED_ACTIONS` (action-level)
  and `BITBUCKET_ALLOWED_PROJECTS` / `BITBUCKET_ALLOWED_REPOS` (scope-level)
  already gate tool availability and stay untouched by this feature.
- Cache TTL changes. `BITBUCKET_CACHE_TTL_*` and `src/cache.ts` invalidation
  keys are unmodified.
- Fixing the `type`-only-never-`interface` ESLint enforcement gap. Still a
  manual-review rule after this port; not addressed here.
- Any change to existing action/scope gating logic in `src/permissions.ts`.
- The pre-existing Phase-5 staleness noted in `docs/plans/TRACK.md`
  ("Blockers / decisions pending" — testing/CI/NPX release, the
  `docs/`-vs-`doc/` branch-prefix mismatch, the `SECURITY.md` placeholder
  email). Out of scope; not touched by any phase below.

## Open questions

None. (If a phase author surfaces one while implementing, tag it
`BLOCKS phase N` here and stop that phase short of `complete_planning`.)

## Design notes

### Naming: two config types coexist

This repo already has a `Config` type (`types/config.ts`) — the Bitbucket
connection/permissions/cache/transport config produced by `loadConfig()` and
threaded as the first parameter of `createServer(config, client, cache)`.
The ported governor introduces a second, unrelated type, `ServerConfig` (per
plane-mcp's naming — decision already made, not renamed here) — the
output-token-limit config produced by `loadServerConfig()`. They are never
merged into one type and never share a variable name:

- `Config` → connection/permission/cache/transport settings, param name
  `config` (unchanged).
- `ServerConfig` → output-token-limit settings only, param name `governor`
  wherever it is threaded (`createServer`, `startHttpTransport`, the
  registry wrapper). Never call a `ServerConfig` value `config` in new code —
  grep for accidental shadowing before each phase's commit.

### Env reads stay confined to `src/config.ts`

Hard rule: "Only `src/config.ts` reads `process.env`." plane-mcp's upstream
`src/paths.ts` reads `PLANE_MCP_CONFIG_DIR` / `XDG_CONFIG_HOME` directly —
that pattern is **not** ported as-is. In this repo, `src/paths.ts`'s
`getConfigDir()` takes its inputs as parameters and never touches
`process.env`; `src/config.ts` reads `BITBUCKET_MCP_CONFIG_DIR` and
`XDG_CONFIG_HOME` itself and passes them in. See Phase 01.

### Cache interaction (Decision #7)

The wrapper that enforces the token limit — `toolHandler(toolName, governor,
fn)` in `src/tools/registry.ts` — is the outermost layer around each tool's
existing handler and, by construction, is never given a `Cache` reference.
Cache invalidation on writes already happens **inside** the wrapped handler,
per the existing mandatory execution order in `claude-ref/tools.md` (step 5,
before step 6 log-end, before step 7 return) — that is unchanged by this
feature. By the time `toolHandler` inspects the result and decides whether
it is over-limit, any write-triggered invalidation for that call has already
happened or not happened exactly as it would without this feature. The
wrapper cannot invalidate, re-invalidate, or roll back a cache entry on the
over-limit path because it holds no cache handle at all — this is a
structural guarantee, not a runtime check. Reviewers verifying this decision
should confirm `toolHandler`'s signature has no `Cache` parameter (Phase 03)
and that the Phase 03 cache-spy test asserts the invalidate call count is
identical whether the same write's result is under or over the limit.

### Tool execution contract — where the check sits

`claude-ref/tools.md`'s 7-step order (validate → permission check → log
start → client call → cache invalidation on writes → log end → MCP-shaped
return) is unchanged **inside** every `*-tools.ts` handler — none of those
files are edited by this feature. The token-limit check is an additional
layer wrapped _around_ the already-complete MCP-shaped return: it runs after
the inner handler's own step 6/7 have finished, and before that result
reaches the MCP SDK. Conceptually this is "insert after log end, before the
outer return" at the registration boundary, not inside any handler body.

## Deviations changelog

1. **Phase 01 seal — commit body wrap** — repo policy hooks blocked both
   `git commit -F <file>` (shell-runner cannot write to `/tmp` under this
   environment's permission profile) and `git commit -F -` heredoc syntax
   (git-ops policy: "unparseable quoting"). The only workable seal path is
   `git commit -m <subject> -m <para1> -m <para2> -m <para3>`, which
   places each body paragraph on a single unwrapped line. This violates
   the plan's implicit 72-column body-wrap style for every phase from 01
   onward. Behavior and content unchanged; presentation only.

2. **Phase 02 combined commit — infra + feature** — adding
   `gpt-tokenizer@4.0.0` regenerated `pnpm-lock.yaml` with `catalog:`
   protocol, which the local Node-20 + npm-10 environment cannot parse.
   `scripts/sync-lock-files.sh` accordingly failed to regenerate
   `package-lock.json`, and hand-crafting one would have violated
   `claude-ref/packages.md`'s "never hand-edit lockfiles" rule. User
   approved converting the repo to pnpm-only: `package-lock.json` and
   `scripts/sync-lock-files.sh` were removed, `package.json`'s
   `sync:locks` script and its pre-commit invocation were removed, and
   `CLAUDE.md` / `claude-ref/packages.md` were rewritten to drop the
   "both lockfiles in sync" hard rule. Landed as a single
   `feat(tools): add gpt-tokenizer output token counter` commit because
   the infra pivot was causally forced by the dep addition and could not
   land independently.

3. **Phase 04 scope-creep — eslint.config.js** — `scripts/**/*.mjs` had
   no ESLint globals block, so the new `scripts/generate-config-schema.mjs`
   tripped `no-undef` on `process` and `URL`. `eslint.config.js` gained a
   matching globals block additive-only; no rules removed or weakened.
   Not in Phase 04's Files-to-touch list, judged LOW by review.

4. **Phase 05 — `deps.exit` injection point** — the plan's `RunInitDeps`
   did not include an `exit` field. User-input errors in `runInit` call
   `process.exit(1)` to produce a single stderr line + non-zero exit;
   tests need to intercept that without killing the test process, so
   `RunInitDeps` gained `exit?: (code: number) => never` as the sole
   injection point. Defaults to `process.exit` in production; tests
   substitute a throwing mock. Structural addition to the type, not a
   behavior change.

5. **Post-commit hook drift, waived** — the repo's pre-commit hook chain
   (prettier + related) reformats `docs/plans/phase-7/feat-output-token-
   limits/plan.md`, `test/token-limit.test.mjs`, and both
   `types/generated/bitbucket-*.d.ts` files after every commit. The plan
   doc reformats are cosmetic; the generated-type reformats are the
   known "commit raw gen output, not prettier's reformat" case flagged in
   the user's persistent memory. Every phase seal from 00 onward has
   restored these files from HEAD via `git checkout HEAD -- <paths>`
   before staging phase files, per user's standing "discard drift and
   proceed" waiver from the Phase 00 seal cycle. Not a per-phase
   deviation; a session-wide operating norm.

---

## Phase 01 — types + config loader + XDG paths

Goal: land the `ServerConfig` type family and a fully-tested config loader
with file discovery, without touching any runtime tool-registration code.

### Files touched

- `types/config.ts` — extend (add `ToolSettings`, `ServerConfig`,
  `LoadServerConfigDeps`)
- `types/index.ts` — no edit needed (already `export type * from
'./config.js'`; new types are picked up automatically)
- `src/config.ts` — extend (add `loadServerConfig`, `resolveConfigPath`,
  `resolveMaxOutputTokens`, `serverConfigSchema`, `DEFAULT_MAX_OUTPUT_TOKENS`)
- `src/paths.ts` — new
- `test/config.test.mjs` — extend (existing file; do not create a second
  config test file)

### Steps

1. In `types/config.ts`, add (matching this file's existing `readonly`
   convention):

   ```ts
   export type ToolSettings = {
     readonly maxOutputTokens?: number;
   };

   export type ServerConfig = {
     readonly defaults: ToolSettings;
     readonly tools: Readonly<Record<string, ToolSettings>>;
   };

   export type LoadServerConfigDeps = {
     readonly readFile?: (filePath: string) => Promise<string>;
     readonly fileExists?: (filePath: string) => Promise<boolean>;
   };
   ```

   No edit to `types/bitbucket.ts` — confirm no `openapi/*.yaml` drift check
   is triggered by this phase (it isn't; that check only fires on
   `types/bitbucket.ts` changes).

2. Add `src/paths.ts`:

   ```ts
   /*
    * XDG config directory resolution for the output-token-limit governor's
    * config file. Takes all inputs as parameters — process.env is read only
    * in src/config.ts, per the project's env-read rule.
    */

   import * as os from 'node:os';
   import * as path from 'node:path';

   export type ConfigDirOverrides = {
     readonly configDirOverride?: string;
     readonly xdgConfigHome?: string;
   };

   export function getConfigDir(overrides: ConfigDirOverrides = {}): string {
     if (overrides.configDirOverride) {
       return overrides.configDirOverride;
     }
     const base = overrides.xdgConfigHome ?? path.join(os.homedir(), '.config');
     return path.join(base, 'bitbucket-mcp');
   }
   ```

3. In `src/config.ts`, add the constant, zod schemas, and functions. Read
   the three new env vars only here:

   ```ts
   const DEFAULT_MAX_OUTPUT_TOKENS = 25000;

   const toolSettingsSchema = z
     .object({
       maxOutputTokens: z.number().int().positive().optional(),
     })
     .strict();

   const serverConfigSchema = z
     .object({
       // Allowed so "$schema": "..." can sit in a real config file for
       // editor IntelliSense without tripping .strict(); never read for
       // behavior.
       $schema: z.string().optional(),
       defaults: toolSettingsSchema.optional(),
       tools: z.record(z.string(), toolSettingsSchema).optional(),
     })
     .strict();
   ```

   `resolveConfigPath` (reads `BITBUCKET_MCP_CONFIG` and, for the XDG
   fallback, `BITBUCKET_MCP_CONFIG_DIR` / `XDG_CONFIG_HOME`, passing them to
   `getConfigDir`):

   ```ts
   async function resolveConfigPath(
     fileExists: (p: string) => Promise<boolean>
   ): Promise<string | null> {
     const explicit = process.env.BITBUCKET_MCP_CONFIG;
     if (explicit) {
       if (!path.isAbsolute(explicit)) {
         throw new Error(`BITBUCKET_MCP_CONFIG must be an absolute path, got: ${explicit}`);
       }
       if (!(await fileExists(explicit))) {
         throw new Error(`BITBUCKET_MCP_CONFIG points to a file that does not exist: ${explicit}`);
       }
       return explicit;
     }

     const cwdConfig = path.join(process.cwd(), 'bitbucket-mcp.config.json');
     if (await fileExists(cwdConfig)) {
       return cwdConfig;
     }

     const configDir = getConfigDir({
       configDirOverride: process.env.BITBUCKET_MCP_CONFIG_DIR,
       xdgConfigHome: process.env.XDG_CONFIG_HOME,
     });
     const xdgConfig = path.join(configDir, 'config.json');
     if (await fileExists(xdgConfig)) {
       return xdgConfig;
     }

     return null;
   }
   ```

   `loadServerConfig(deps?)` mirrors the discovery → parse → strict-validate
   → precedence flow: env override (`BITBUCKET_MCP_MAX_OUTPUT_TOKENS`) beats
   `defaults.maxOutputTokens` from the file, which beats
   `DEFAULT_MAX_OUTPUT_TOKENS`. Invalid JSON or a schema failure throws with
   the offending path in the message; never logs the file contents (avoids
   any chance of leaking a stray secret pasted into a config file).

   `resolveMaxOutputTokens(cfg: ServerConfig, toolName?: string): number` —
   per-tool `tools[toolName].maxOutputTokens` wins over
   `cfg.defaults.maxOutputTokens`, which falls back to
   `DEFAULT_MAX_OUTPUT_TOKENS`. `toolName` is optional only so the function
   can report the resolved default in `help`/`init` output before a tool
   name is known; every runtime call site (Phase 03) passes a tool name.

   Export `serverConfigSchema` and `DEFAULT_MAX_OUTPUT_TOKENS` for reuse by
   Phase 04's schema generator and Phase 05's `init`.

4. Extend `test/config.test.mjs` with a new `describe('Unit: loadServerConfig
/ resolveMaxOutputTokens', ...)` block (do not touch the existing
   `describe('Unit: loadConfig', ...)` block above it). Import from
   `../dist/src/config.js`, matching every other test in this file.

### Verification

```bash
pnpm run validate
pnpm run build && node --test test/config.test.mjs
```

### Acceptance criteria

- [ ] `BITBUCKET_MCP_CONFIG` set to a missing absolute path → `loadServerConfig`
      rejects with a message naming the path.
- [ ] `BITBUCKET_MCP_CONFIG` unset, cwd `bitbucket-mcp.config.json` present →
      it wins over the XDG path even when both exist.
- [ ] `BITBUCKET_MCP_MAX_OUTPUT_TOKENS` overrides `defaults.maxOutputTokens`
      from the file.
- [ ] A `tools.<name>.maxOutputTokens` entry overrides both the env var and
      the file default for that tool only.
- [ ] An unknown top-level or per-tool key is rejected (`.strict()`).
- [ ] A `$schema` key at the top level is accepted and ignored.
- [ ] `getConfigDir` never reads `process.env` directly (grep `src/paths.ts`
      for `process.env` — zero matches).
- [ ] `pnpm run validate` and the full `pnpm run test` pass with no
      regressions in the pre-existing `loadConfig` tests.

---

## Phase 02 — tokenizer dependency + output counter

Goal: add the pinned tokenizer dependency and a pure function that counts a
tool result's estimated Claude token cost.

### Files touched

- `package.json` — add `gpt-tokenizer` (exact-pinned dependency)
- `pnpm-lock.yaml`, `package-lock.json` — synced
- `src/tools/token-count.ts` — new
- `test/token-count.test.mjs` — new
- `docs/SECURITY.md` — extend with a dependency review entry

### Steps

1. Run `./scripts/check-package-security.sh gpt-tokenizer` and `pnpm audit`.
   Capture both outputs for the commit body (per `claude-ref/security.md`,
   "justify every new dep in the PR").
2. `pnpm add gpt-tokenizer@4.0.0` (exact version, no `^`/`~`). Run `pnpm run
sync:locks`; commit both lockfiles in this same commit.
3. Add `src/tools/token-count.ts`:

   ```ts
   /*
    * Estimated token count of an outgoing MCP tool result, used by the
    * output-token-limit governor (src/tools/registry.ts). gpt-tokenizer's
    * o200k_base (GPT-4o family) encoding undercounts actual Claude token
    * usage by roughly 15-20% on typical JSON payloads — a fixed multiplier
    * keeps the enforced limit conservative without a second,
    * Claude-specific tokenizer dependency.
    *
    * Unlike plane-mcp's ToolResult, this project's McpToolResult carries no
    * structuredContent field — every tool returns text-only content — so
    * only `content` is counted.
    */

   import { encode } from 'gpt-tokenizer/model/gpt-4o';

   import type { McpToolResult } from '@types';

   export const TOKEN_COUNT_MULTIPLIER = 1.2;

   export function countOutputTokens(result: McpToolResult): number {
     const payload = result.content
       .filter((part) => part.type === 'text')
       .map((part) => part.text)
       .join('');
     return Math.ceil(encode(payload).length * TOKEN_COUNT_MULTIPLIER);
   }
   ```

4. Add `test/token-count.test.mjs` (import from `../dist/src/tools/token-count.js`).
5. Add an entry to `docs/SECURITY.md` under "Dependency Management" — package
   name, exact pinned version, `pnpm audit` result summary, why an exact pin
   (tokenizer output must stay reproducible across installs — a minor bump
   that changes vocabulary/merge rules would silently shift the enforced
   limit), and the review date.

### Verification

```bash
pnpm run validate
pnpm run build && node --test test/token-count.test.mjs
pnpm audit
```

### Acceptance criteria

- [ ] `package.json` pins `gpt-tokenizer` to an exact version (no range).
- [ ] `pnpm-lock.yaml` and `package-lock.json` both reference the same
      resolved version.
- [ ] `pnpm audit` reports no new high/critical advisories introduced by this
      dependency.
- [ ] `countOutputTokens({ content: [] })` → `0`.
- [ ] A known short string's count matches `Math.ceil(encode(str).length *
  1.2)` exactly (pins the multiplier behavior).
- [ ] `docs/SECURITY.md` has the new dependency entry with audit result and
      review date.

---

## Phase 03 — enforcement wrapper + config threading

Goal: wrap every registered tool with the token-limit check and thread
`ServerConfig` from both server entrypoints down to that wrapper, without
modifying any `*-tools.ts` handler factory.

### Files touched

- `src/tools/registry.ts` — extend (`toolHandler` wrapper)
- `src/server.ts` — extend (`createServer` gains a `governor: ServerConfig`
  parameter; wraps each registry entry before `asSdkHandler`)
- `src/http.ts` — extend (`startHttpTransport` gains a `governor` parameter,
  passed through to each per-session `createServer` call)
- `src/index.ts` — extend (loads `ServerConfig` at bootstrap, threads it to
  both the stdio and HTTP/HTTPS branches)
- `test/token-limit.test.mjs` — new

### Steps

1. In `src/tools/registry.ts`, add the wrapper next to `ToolDefinition`. It
   takes no `Cache` parameter (see "Cache interaction" in Design notes
   above):

   ```ts
   import { countOutputTokens } from './token-count.js';
   import { resolveMaxOutputTokens } from '../config.js';
   import { log } from '../logger.js';

   import type { ServerConfig, McpToolResult } from '@types';

   function buildTokenLimitGuidance(toolName: string, tokenCount: number, limit: number): string {
     return (
       `Tool "${toolName}" result was withheld: the response is an estimated ` +
       `${tokenCount} tokens, exceeding the configured limit of ${limit} for ` +
       `this tool. Narrow the request and try again — for example: pass a ` +
       `"fields" argument if the tool supports it, reduce "per_page", filter ` +
       `by project or repository, or call the single-item retrieval tool ` +
       `instead of a list/search tool. Raise this limit via a ` +
       `"${toolName}" entry under "tools" in your bitbucket-mcp config file, ` +
       `or the BITBUCKET_MCP_MAX_OUTPUT_TOKENS env var.`
     );
   }

   export function toolHandler(
     toolName: string,
     governor: ServerConfig,
     fn: (args: unknown) => Promise<McpToolResult>
   ): (args: unknown) => Promise<McpToolResult> {
     return async (args: unknown): Promise<McpToolResult> => {
       const result = await fn(args);

       if (result.isError) {
         // Already an error — pass through unchanged, never counted or
         // reinterpreted as a token-limit rejection.
         return result;
       }

       const tokenCount = countOutputTokens(result);
       const limit = resolveMaxOutputTokens(governor, toolName);

       if (tokenCount > limit) {
         log('warn', 'tool output exceeded configured token limit; result withheld', {
           operation: 'tool_execute',
           toolName,
           tokenCount,
           limit,
         });
         return {
           content: [{ type: 'text', text: buildTokenLimitGuidance(toolName, tokenCount, limit) }],
           isError: true,
         };
       }

       return result;
     };
   }
   ```

   The inner handler already performs its own `log('info', 'tool start' /
'tool end', ...)` per `claude-ref/tools.md`; the wrapper adds only a
   `warn` log on the rejection path, never logs response content or the
   Bitbucket token.

2. In `src/server.ts`, change `createServer`'s signature to
   `createServer(config: Config, client: BitbucketClient, cache: Cache,
governor: ServerConfig): McpServer` and compose the wrapper before the
   existing SDK-shape narrowing:

   ```ts
   for (const tool of registry) {
     const limited = toolHandler(tool.name, governor, tool.handler);
     server.tool(tool.name, tool.description, tool.shape, asSdkHandler(limited));
   }
   ```

3. In `src/http.ts`, add a `governor: ServerConfig` parameter to
   `startHttpTransport` (after `cache`) and pass it through at the single
   `createServer(config, client, cache)` call site inside the `initialize`
   branch → `createServer(config, client, cache, governor)`.

4. In `src/index.ts`'s `bootstrap()`, call `await loadServerConfig()` once,
   right after `loadConfig()`, and pass the result as `governor` into both
   branches:
   - stdio: `createServer(config, client, cache, governor)`
   - http/https: `startHttpTransport(config, client, cache, governor)`

   A `loadServerConfig()` failure (bad JSON, schema violation, missing
   `BITBUCKET_MCP_CONFIG` file) must fail bootstrap the same way a
   `loadConfig()` failure does today — caught by the existing
   `bootstrap().catch(...)` at the bottom of `src/index.ts`. No new
   try/catch needed.

5. Add `test/token-limit.test.mjs` (import `toolHandler` from
   `../dist/src/tools/registry.js`).

### Verification

```bash
pnpm run validate
pnpm run build && node --test test/token-limit.test.mjs
pnpm run test
```

### Acceptance criteria

- [ ] Under-limit result passes through `toolHandler` byte-for-byte
      unchanged.
- [ ] Over-limit result is replaced with `{ isError: true, content: [...] }`
      whose text includes the tool name, the estimated count, the limit, and
      at least one narrowing suggestion plus both ways to raise the limit.
- [ ] A `tools.<name>.maxOutputTokens` entry on `governor` changes the
      threshold used for that call, verified via a fake `fn` sized to fall on
      each side of the per-tool value.
- [ ] `fn` throwing propagates unchanged through `toolHandler` (the wrapper
      adds no try/catch of its own — the existing per-tool error handling
      inside `*-tools.ts` is untouched).
- [ ] A result that already has `isError: true` is returned unchanged and is
      never passed to `countOutputTokens`.
- [ ] Cache-spy test: a fake write-tool handler that calls a mock
      `cache.invalidate` once, wrapped by `toolHandler`, shows the same
      single invalidate call whether the handler's result is under or over
      the configured limit — proving the wrapper performs zero cache
      operations of its own.
- [ ] `createServer` and `startHttpTransport` both compile with the new
      `governor` parameter; `src/index.ts` passes it on both branches.

---

## Phase 04 — example config + generated JSON Schema

Goal: ship a starter config file and a generated JSON Schema for editor
validation, generated from `serverConfigSchema` rather than hand-maintained.

### Files touched

- `bitbucket-mcp.config.example.json` — new, repo root
- `scripts/generate-config-schema.mjs` — new
- `bitbucket-mcp.config.schema.json` — new (generated output, committed)
- `package.json` — add `schema:gen` script
- `test/config-schema.test.mjs` — new

### Steps

1. Add `bitbucket-mcp.config.example.json` at repo root:

   ```json
   {
     "$schema": "./bitbucket-mcp.config.schema.json",
     "defaults": {
       "maxOutputTokens": 25000
     },
     "tools": {
       "bitbucket_list_pull_requests": {
         "maxOutputTokens": 10000
       },
       "bitbucket_search_code": {
         "maxOutputTokens": 10000
       }
     }
   }
   ```

2. `scripts/generate-config-schema.ts` is not portable as-is: plane-mcp runs
   it directly under bun. This repo has no TS-runtime (`bun`/`ts-node`/`tsx`)
   and its `tsconfig.json` `include` covers only `src/**/*` and
   `types/**/*`, not `scripts/**/*`. Add a plain ESM script instead, run
   post-build against the compiled output — the same pattern every file in
   `test/*.test.mjs` already uses:

   ```js
   #!/usr/bin/env node
   // Regenerates bitbucket-mcp.config.schema.json from serverConfigSchema.
   // Run after `pnpm run build` (imports the compiled dist output, not TS
   // source directly — this repo has no TS runtime for standalone scripts).
   import { writeFile } from 'node:fs/promises';
   import { z } from 'zod';

   import { serverConfigSchema } from '../dist/src/config.js';

   export function buildSchemaDocument() {
     const jsonSchema = z.toJSONSchema(serverConfigSchema, { target: 'draft-7' });
     return {
       $schema: 'http://json-schema.org/draft-07/schema#',
       title: 'atlassian-bitbucket-mcp server config',
       description:
         'Validated behavior config for atlassian-bitbucket-mcp: per-tool output-token limits.',
       ...jsonSchema,
     };
   }

   if (import.meta.url === `file://${process.argv[1]}`) {
     const target = new URL('../bitbucket-mcp.config.schema.json', import.meta.url);
     await writeFile(target, JSON.stringify(buildSchemaDocument(), null, 2) + '\n');
   }
   ```

3. Add to `package.json` scripts: `"schema:gen": "pnpm run build && node
scripts/generate-config-schema.mjs"`.
4. Run `pnpm run schema:gen` once to produce and commit
   `bitbucket-mcp.config.schema.json`.
5. Add `test/config-schema.test.mjs`: import `buildSchemaDocument` from
   `../scripts/generate-config-schema.mjs` (valid after `pnpm run build` has
   populated `dist/src/config.js`, which the script itself imports), write
   its output to a temp file, and `assert.deepEqual` against the parsed
   contents of the committed `bitbucket-mcp.config.schema.json` — this is
   the "regenerate in a temp dir and diff-compare" check for this phase, run
   as a unit test rather than a separate CI step (CI wiring for drift
   detection is out of scope for this phase; a future CI phase can add a
   `git diff --exit-code` step mirroring `types:check-drift`).
6. Validate `bitbucket-mcp.config.example.json` parses against
   `serverConfigSchema` — cover this in the same test file.

### Verification

```bash
pnpm run validate
pnpm run schema:gen
git diff --stat bitbucket-mcp.config.schema.json # expect no diff after step 4's commit
node --test test/config-schema.test.mjs
```

### Acceptance criteria

- [ ] `bitbucket-mcp.config.example.json` parses successfully against
      `serverConfigSchema`.
- [ ] `bitbucket-mcp.config.schema.json` is committed and regenerating it via
      `pnpm run schema:gen` produces byte-identical output (no working-tree
      diff).
- [ ] `test/config-schema.test.mjs` fails if `serverConfigSchema` changes
      without regenerating the committed schema file.

---

## Phase 05 — CLI: `init` + `help`

Goal: add `bitbucket-mcp help` / `--help` / `-h` and `bitbucket-mcp init` as
one-shot CLI paths that never start the MCP server, plus a scaffolding
command for the config file.

### Files touched

- `src/help.ts` — new
- `src/init.ts` — new
- `src/index.ts` — extend (argv dispatch before `bootstrap()`)
- `test/cli.test.mjs` — new

### Steps

1. Add `src/help.ts` — `buildHelpText()` returns the full reference (usage,
   `init` flags, config discovery order, config JSON shape, env var table,
   pointer to the README section added in Phase 06); `printHelp(write?)`
   writes it to stdout by default, injectable for tests.

   Unlike plane-mcp's `help.ts`, this repo has no keychain/instance/workspace
   concepts — the usage block is:

   ```text
   atlassian-bitbucket-mcp — MCP server for Bitbucket Cloud + Server/DC

   Usage:
     atlassian-bitbucket-mcp                 Run the stdio MCP server (default)
     atlassian-bitbucket-mcp init [options]  Scaffold a starter config file
     atlassian-bitbucket-mcp help, --help, -h  Show this help

   init options:
     --config-path <path>       Config file location (default:
                                 ~/.config/bitbucket-mcp/config.json, or
                                 $XDG_CONFIG_HOME/bitbucket-mcp/config.json)
     --max-output-tokens <n>    Default per-tool output-token limit written
                                 to the scaffolded config (default: 25000)
     -y                         Skip the overwrite-confirmation prompt

   Behavior config (bitbucket-mcp.config.json):
     Discovery order: BITBUCKET_MCP_CONFIG env (absolute path) >
     ./bitbucket-mcp.config.json (cwd) >
     $XDG_CONFIG_HOME or ~/.config/bitbucket-mcp/config.json > built-in
     defaults (25000 tokens/tool)
     Shape: {"defaults": {"maxOutputTokens": N}, "tools": {"<tool_name>":
     {"maxOutputTokens": N}}}
     Env override: BITBUCKET_MCP_MAX_OUTPUT_TOKENS overrides
     defaults.maxOutputTokens (never overrides a per-tool value)
   ```

2. Add `src/init.ts` — `runInit(args, deps?)`:
   - Parses `--config-path <path>`, `--max-output-tokens <n>`, `-y`.
   - Target path: `--config-path` if given, else
     `path.join(getConfigDir({ configDirOverride: process.env.BITBUCKET_MCP_CONFIG_DIR,
xdgConfigHome: process.env.XDG_CONFIG_HOME }), 'config.json')`. Reading
     these two env vars here (inside `src/init.ts`, not `src/config.ts`) is a
     deliberate, narrow exception matching how `init` is a standalone CLI
     entrypoint that never calls `loadConfig()`/`loadServerConfig()` at all —
     flag this explicitly in the PR description so a reviewer checking the
     "only `src/config.ts` reads `process.env`" rule sees the justification
     inline rather than reopening it as a bug.
   - If the target file already exists and `-y` was not passed, print a
     warning to stderr and exit without overwriting (no interactive
     TTY-prompt machinery is needed here — this repo's `init` scaffolds a
     config file only, not a secret, so there is nothing sensitive to gate
     behind a hidden prompt like plane-mcp's key entry).
   - Writes `{ "$schema": "./bitbucket-mcp.config.schema.json", "defaults": {
"maxOutputTokens": N }, "tools": {} }` (`N` = `--max-output-tokens` or
     `DEFAULT_MAX_OUTPUT_TOKENS`).
   - Prints the `BITBUCKET_MCP_CONFIG` env line to add to the MCP client's
     server definition, but only when the file exists after this run
     (created now, or already present) — never print a path to a file that
     was not written.
3. In `src/index.ts`, add argv dispatch before `bootstrap()` is called:

   ```ts
   const [, , command, ...rest] = process.argv;

   if (command === 'help' || command === '--help' || command === '-h') {
     printHelp();
   } else if (command === 'init') {
     await runInit(rest);
   } else {
     await bootstrap();
   }
   ```

   Preserve the existing GPL header block and the existing
   `bootstrap().catch(...)` error handling — wrap the new dispatch in the
   same top-level pattern so `help`/`init` failures also exit non-zero
   without printing a stack trace.

4. Add `test/cli.test.mjs` covering `printHelp` output shape and `runInit`
   with injected `deps` (fake `fileExists`/`writeConfig`) — no real
   filesystem writes in the test.

### Verification

```bash
pnpm run validate
pnpm run build
node dist/src/index.js help # prints expected usage text
node --test test/cli.test.mjs
```

### Acceptance criteria

- [ ] `atlassian-bitbucket-mcp help` / `--help` / `-h` all print the same
      text and never start the server (no `loadConfig()`/`BitbucketClient`
      construction reached).
- [ ] `atlassian-bitbucket-mcp init -y` in a temp cwd creates a config file
      that parses against `serverConfigSchema`.
- [ ] Running `init` twice without `-y` on an already-scaffolded path does
      not overwrite the existing file.
- [ ] Running the bin with no arguments still boots the server exactly as
      before this phase (stdio default unchanged).

---

## Phase 06 — docs

Goal: document the feature for both end users (README) and future
contributors (`claude-ref/`), and close out the roadmap entry.

### Files touched

- `README.md` — new "Configure per-tool output-token limits" section
- `claude-ref/config.md` — new
- `CLAUDE.md` — add one row to the Routing table
- `.env.example` — add the three new env vars (commented, with guidance)
- `docs/plans/TRACK.md` — flip `feat-output-token-limits` to `[x]`

### Steps

1. Add a README section (placed after "## Configuration" /
   "### Environment Variables", before "## Available MCP Tools" — matches
   this repo's existing heading order) covering: why responses can be
   withheld, discovery precedence, the three env vars, the JSON config
   shape, a worked per-tool example, and what the guidance error looks like.
2. Add `claude-ref/config.md`:

   ```markdown
   # config (src/config.ts, src/paths.ts)

   ## Two config types

   - `Config` — connection/permission/cache/transport, from `loadConfig()`.
   - `ServerConfig` — output-token-limit governor, from `loadServerConfig()`.
     Never merge them; never name a `ServerConfig` value `config`.

   ## Discovery precedence (config file)

   `BITBUCKET_MCP_CONFIG` env (absolute path, error if set but missing) →
   `./bitbucket-mcp.config.json` (cwd) → `$XDG_CONFIG_HOME` or
   `~/.config/bitbucket-mcp/config.json` → built-in defaults.

   ## Value precedence (per-tool limit)

   `tools.<name>.maxOutputTokens` (file) > `BITBUCKET_MCP_MAX_OUTPUT_TOKENS`
   (env) > `defaults.maxOutputTokens` (file) > `DEFAULT_MAX_OUTPUT_TOKENS`
   (25000). The env var overrides only the default, never a per-tool value.

   ## Env reads

   `BITBUCKET_MCP_CONFIG`, `BITBUCKET_MCP_MAX_OUTPUT_TOKENS`,
   `BITBUCKET_MCP_CONFIG_DIR` are read only in `src/config.ts`, except inside
   `src/init.ts`'s standalone CLI path (see Phase 05 note) which never calls
   `loadConfig()`/`loadServerConfig()`.
   ```

3. Add a row to `CLAUDE.md`'s Routing table:
   `| Output-token-limit config, discovery, precedence | claude-ref/config.md |`
4. Add three commented entries to `.env.example`, in the existing style
   (matching the "=== Optional - ... ===" section headers already used for
   Transport):

   ```text
   # === Optional - Output-token-limit governor ===

   # Absolute path to a bitbucket-mcp config file (per-tool output-token
   # limits). Errors at startup if set but the file does not exist.
   # BITBUCKET_MCP_CONFIG=/absolute/path/to/bitbucket-mcp.config.json

   # Overrides defaults.maxOutputTokens from the config file. Never
   # overrides a per-tool tools.<name>.maxOutputTokens entry.
   # BITBUCKET_MCP_MAX_OUTPUT_TOKENS=25000

   # Overrides the XDG config directory used for the fallback config path
   # (~/.config/bitbucket-mcp by default, or $XDG_CONFIG_HOME/bitbucket-mcp).
   # BITBUCKET_MCP_CONFIG_DIR=/absolute/path/to/config/dir
   ```

5. In `docs/plans/TRACK.md`, change only the `feat-output-token-limits` line
   under "Phase 7 — Response governance" from `[ ]` to `[x]` (added by the
   orchestrator in Phase 0 of this rollout — see repo-root task instructions;
   this phase does not create that heading, only flips the checkbox). Do not
   touch any other line in `TRACK.md`, including the pre-existing Phase-5
   staleness notes.

### Verification

```bash
pnpm run lint:all
```

Manual: read through the new README section end-to-end for accuracy against
the shipped behavior from Phases 01–05.

### Acceptance criteria

- [ ] README section present, in the correct location, covers discovery
      precedence, all three env vars, the JSON shape, and the guidance-error
      example.
- [ ] `claude-ref/config.md` exists and `CLAUDE.md`'s Routing table has the
      new row.
- [ ] `.env.example` has the three new vars, commented out, with no real
      values.
- [ ] `docs/plans/TRACK.md` shows `feat-output-token-limits` as `[x]` and is
      otherwise byte-identical to before this phase.
- [ ] `pnpm run lint:all` (includes markdownlint) passes.

---

## Cross-phase verification (run once, after Phase 06)

```bash
pnpm run validate
pnpm run build
pnpm run test
pnpm audit
pnpm run schema:gen && git diff --exit-code bitbucket-mcp.config.schema.json
```
