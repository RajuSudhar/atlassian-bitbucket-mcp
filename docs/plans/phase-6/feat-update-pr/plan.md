# feat-update-pr

Phase: 6 | Status: [x] done
Depends on: feat-pr-tools (phase 4), feat-project-repo-scoping (phase 6)
Ref: `claude-ref/tools.md`, `claude-ref/client.md`, `claude-ref/openapi.md`

## Goal

Add MCP tool support for updating pull request title and/or description on
Bitbucket Server/DC — single tool `bitbucket_update_pull_request` with
optimistic locking via explicit `version` parameter.

## In scope

- Server/DC only. All existing PR operations in `PullRequestApi` are
  Server/DC-only today (Cloud PR support is unimplemented at the API layer);
  this follows the same instance scope.
- New tool:
  - `bitbucket_update_pull_request` — update a PR's `title` and/or
    `description` (`write_pr` permission). At least one of `title` or
    `description` must be provided. Requires caller to supply the current PR's
    `version` field explicitly (same optimistic-locking contract as
    `bitbucket_update_comment`). Callers must call
    `bitbucket_get_pull_request` first to obtain the current version, then
    pass it to this tool.
- `openapi/bitbucket-server.yaml` — add missing `version: number` field to
  the `PullRequest` schema component (already present on real Bitbucket
  Server/DC PR objects, just absent from this repo's schema).

## Out of scope

- Bitbucket Cloud PR updates (Cloud has no PR API layer in this codebase at
  all today).
- Internal auto-GET-then-PUT inside the new tool to fetch the version
  automatically (explicit decision: require caller to supply it, same pattern
  as `bitbucket_update_comment`).

## API notes (Bitbucket Server/DC REST 1.0)

| Operation | Method | Path                                                    |
| --------- | ------ | ------------------------------------------------------- |
| Update PR | PUT    | `/projects/{project}/repos/{repo}/pull-requests/{prId}` |

Request body includes only the fields being updated — conditionally include
`title` and/or `description` keys based on what the caller provided, plus
mandatory `version` field. Same optimistic-locking pattern as comment updates.

Response: the updated `PullRequest` object with incremented `version`.

## Design

- `openapi/bitbucket-server.yaml` — add `version` field (required, `type:
integer`) to the `PullRequest` schema component. Run `pnpm run types:gen`
  to regenerate `types/generated/bitbucket-server.d.ts`, then
  `types/bitbucket.ts`'s `export type PullRequest =
ServerSchemas['PullRequest'];` automatically picks it up.
  **CRITICAL:** CLAUDE.md hard rule — touching `types/bitbucket.ts` requires
  updating `openapi/*.yaml` in the same commit. The openapi yaml files in
  this repo are schema-only (`paths: {}` — no operation specs), so only the
  schema component change is needed; endpoint paths/methods live hand-written
  in `src/bitbucket/api/*.ts`.
- `PullRequestApi` (`src/bitbucket/api/pull-requests.ts`) gains:

  ```typescript
  async updatePullRequest(
    project: string,
    repo: string,
    prId: number,
    updates: { title?: string; description?: string; version: number }
  ): Promise<PullRequest> {
    const body: Record<string, unknown> = { version: updates.version };
    if (updates.title !== undefined) body.title = updates.title;
    if (updates.description !== undefined) body.description = updates.description;
    return this.client.requestJson<PullRequest>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}`,
      { method: 'PUT', body }
    );
  }
  ```

  Conditionally populate the body object with only the fields the caller
  provided. Return type is `PullRequest` (imported from `@types` →
  `types/bitbucket.ts`). Follow the existing style of `updateComment` (same
  file).

- `schemas.ts` — new `updatePullRequestShape` (a `ZodRawShape` object
  literal, exported `as const`, following the exact style of
  `updateCommentShape` and `createPrTaskShape`), spreading `...prRefShape` for
  project/repo/prId, adding:

  ```typescript
  export const updatePullRequestShape = {
    ...prRefShape,
    title: z.string().min(1).optional().describe('New PR title'),
    description: z.string().optional().describe('New PR description'),
    version: z.coerce.number().int().nonnegative().describe('PR version for optimistic locking'),
  } as const;
  ```

  The "at least one of title/description" constraint is enforced as a
  `.refine(...)` at the `z.object(updatePullRequestShape)` call site inside
  the tool handler (see handler code below). Zod's `.refine()` allows
  cross-field validation after the base object shape parses.

- `pr-tools.ts` — new handler `bitbucket_update_pull_request` inside
  `createPrTools(prApi, config, cache)`, following the EXACT existing
  `bitbucket_update_comment` handler pattern/order (parse → validate
  at-least-one-field via refine → `requirePermission` → `requireScope` → log
  start → call → cache invalidate → log end → `textResult`/`errorResult`):

  ```typescript
  bitbucket_update_pull_request: async (args: unknown): Promise<McpToolResult> => {
    const start = Date.now();
    try {
      const input = z
        .object(updatePullRequestShape)
        .refine((data) => data.title !== undefined || data.description !== undefined, {
          message: 'At least one of title or description must be provided',
        })
        .parse(args);
      requirePermission(config, 'write_pr');
      requireScope(config, input.project, input.repo);
      log('info', 'tool start', {
        operation: 'tool_execute',
        toolName: 'bitbucket_update_pull_request',
      });
      const result = await prApi.updatePullRequest(input.project, input.repo, input.prId, {
        title: input.title,
        description: input.description,
        version: input.version,
      });
      invalidatePrCache(cache, config, input.project, input.repo, input.prId);
      log('info', 'tool end', {
        toolName: 'bitbucket_update_pull_request',
        durationMs: Date.now() - start,
      });
      return textResult(result);
    } catch (err) {
      log('error', 'tool error', {
        toolName: 'bitbucket_update_pull_request',
        error: String(err),
        durationMs: Date.now() - start,
      });
      return errorResult(
        'UPDATE_PULL_REQUEST_FAILED',
        err instanceof Error ? err.message : String(err)
      );
    }
  },
  ```

  Order: `requirePermission` then `requireScope` (mandatory per
  `docs/plans/phase-6/feat-project-repo-scoping/plan.md`). Cache invalidation
  via the existing `invalidatePrCache` helper — invalidates the single
  `pr:{project}/{repo}/{prId}` key. **Note:** `claude-ref/tools.md`'s
  cache-invalidation table documents invalidation at a coarser granularity
  (`:activities` groups) than what `invalidatePrCache` actually does
  (single-key invalidation) — this is a PRE-EXISTING doc/code mismatch, not
  introduced by this feature. This feature follows the real code behavior
  (single-key invalidation).

- `registry.ts` — import `updatePullRequestShape` from schemas, add one entry
  in the `// --- Pull Request tools ---` block, placed near
  `bitbucket_get_pull_request` and `bitbucket_update_comment` entries for
  readability:

  ```typescript
  {
    name: 'bitbucket_update_pull_request',
    description: 'Update PR title and/or description (Server/DC, requires version for optimistic locking)',
    shape: updatePullRequestShape,
    handler: h.pr.bitbucket_update_pull_request,
  },
  ```

  No other file needs touching per this file's own convention (single-diff
  tool registration).

- `test/schemas.test.mjs` — add `describe('Unit: updatePullRequestShape',
...)` block, following the exact style of the existing `createPrTaskShape`
  describe block in the same file, covering:
  - Accepts title-only
  - Accepts description-only
  - Accepts both title+description
  - Rejects missing version
  - Rejects negative version

  **Note:** The "at least one of title/description" refine lives in the
  handler (via `.refine()` on the `z.object(...)` call), not in the base
  shape exported from `schemas.ts`, so a schema-level test can't cover that
  particular rule. The handler-level behavior (refine enforcement) should be
  verified in a handler-level test if/when one is added — this repo has no
  `pr-tools.test.mjs` file yet (precedent noted in `feat-pr-tasks` plan), so
  skip handler-level testing for this feature same as prior PR tools, and
  document this explicitly as a test gap.

## Permissions

- Uses existing `write_pr` action (from `types/config.ts`'s `Action` union) —
  same permission as `bitbucket_update_comment`. No new permission type
  needed. See `docs/plans/phase-4/feat-permissions/plan.md` for the action
  catalog.

## Scoping

- Every project/repo-scoped tool handler must call `requireScope(config,
project, repo)` immediately after `requirePermission`. This ordering is
  mandatory per `docs/plans/phase-6/feat-project-repo-scoping/plan.md`. The
  handler snippet above already demonstrates this.

## Tasks

- [x] `openapi/bitbucket-server.yaml` — add `version` field to `PullRequest`
      schema component
- [x] `pnpm run types:gen` — regenerate types from updated yaml
- [x] `types/bitbucket.ts` — confirm `PullRequest` export now includes
      `version` (auto-picked-up from generated types, no manual edit needed)
- [x] `PullRequestApi.updatePullRequest` in
      `src/bitbucket/api/pull-requests.ts`
- [x] `schemas.ts` — `updatePullRequestShape`
- [x] `pr-tools.ts` — `bitbucket_update_pull_request` handler
- [x] `registry.ts` — one new entry near other PR tools
- [x] `test/schemas.test.mjs` — `describe('Unit: updatePullRequestShape', ...)`
      covering title-only, description-only, both, missing version, negative
      version
- [x] typecheck + lint + tests pass
- [x] `README.md` tool table updated (if it exists and documents tools)
- [x] TRACK.md updated

## Decisions / deviations

### Default assumption (recorded, reversible)

**Optimistic locking: require caller to supply version explicitly.**

The tool requires the caller to supply the current PR's `version` explicitly
as an input field — same contract as the existing `bitbucket_update_comment`
tool's `version` field. No internal auto-GET-then-PUT inside the new tool.

**Rationale:** This was the recommended option in the feature requirements.
The user didn't respond to a clarifying question in time, so the default
recommendation was auto-selected. This decision is flagged here as clearly
visible and reversible. If the implementation reveals a strong reason to
auto-fetch the version internally (e.g., all real callers do a GET
immediately before calling this, making the explicit parameter redundant), the
decision can be revisited in a phase changelog entry.

**Impact:** Callers must call `bitbucket_get_pull_request` first to obtain
the current version before calling `bitbucket_update_pull_request`. This
matches the existing `bitbucket_update_comment` / `bitbucket_resolve_comment`
pattern — explicit version parameter, no internal GET.

## Definition of done

- [x] tool calls `requirePermission` + `requireScope` before `client.*`
- [x] typecheck + lint + tests pass
- [x] TRACK.md updated
- [x] (optional, if time permits) live-test against a real Server/DC PR: - GET PR to obtain version - Update title → verify new title in response, version incremented - Update description → verify new description, version incremented - Update both → verify both fields changed - Stale version → verify optimistic-lock error (typically 409 Conflict)
