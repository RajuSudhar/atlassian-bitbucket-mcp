# Phase 1 — Client read-modify-write with 409 retry

## Objective

Rewrite `PullRequestApi.updatePullRequest` in `src/bitbucket/api/pull-requests.ts` (lines 152-165) to implement GET-then-PUT pattern with automatic version management, reviewer+toRef preservation, and bounded single retry on optimistic lock conflict.

## In Scope

- Rewrite `updatePullRequest` method body.
- Call existing `this.get()` to fetch current PR.
- Build PUT body echoing `reviewers`, `toRef`, and all other required fields from fetched PR.
- Override `title`/`description` only when caller supplies them (undefined → use current value).
- Auto-fetch `version` from GET response; allow caller to override via optional `version` param.
- Add try-catch around PUT: if 409 error, re-fetch GET once, rebuild body with fresh version, retry PUT.
- If second 409, throw immediately (no infinite retry loop).
- Preserve project rules: `type` only, no `any`, no `as`, `log()` not `console.*`, never log token.

## Out of Scope

- Changes to `get()` method (already implemented, working).
- Schema changes (Phase 2).
- Handler changes (Phase 2).
- Tests (Phase 3).

## Implementation

### File: `src/bitbucket/api/pull-requests.ts`

**Location:** Lines 152-165 (current `updatePullRequest` method).

**Current code:**

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

**New code:**

```typescript
async updatePullRequest(
  project: string,
  repo: string,
  prId: number,
  updates: { title?: string; description?: string; version?: number }
): Promise<PullRequest> {
  const currentPr = await this.get(project, repo, prId);

  const body: Record<string, unknown> = {
    version: updates.version ?? currentPr.version,
    title: updates.title ?? currentPr.title,
    description: updates.description ?? currentPr.description,
    toRef: currentPr.toRef,
    reviewers: currentPr.reviewers ?? [],
  };

  const attemptPut = async (versionOverride?: number): Promise<PullRequest> => {
    const putBody = versionOverride !== undefined
      ? { ...body, version: versionOverride }
      : body;
    return this.client.requestJson<PullRequest>(
      `/projects/${project}/repos/${repo}/pull-requests/${prId}`,
      { method: 'PUT', body: putBody }
    );
  };

  try {
    return await attemptPut();
  } catch (err) {
    if (err instanceof Error && err.message.includes('409')) {
      log('warn', 'pr update conflict, retrying', {
        operation: 'updatePullRequest',
        project,
        repo,
        prId,
      });
      const freshPr = await this.get(project, repo, prId);
      return attemptPut(freshPr.version);
    }
    throw err;
  }
}
```

**Key changes:**

1. **Signature:** `version: number` → `version?: number` (optional).
2. **GET first:** `const currentPr = await this.get(project, repo, prId);` — fetch current PR state.
3. **Build body:**
   - `version`: Use caller's version if supplied, else `currentPr.version`.
   - `title`: Use caller's title if supplied, else `currentPr.title`.
   - `description`: Use caller's description if supplied, else `currentPr.description`.
   - `toRef`: Echo `currentPr.toRef` verbatim (required field, immutable target branch).
   - `reviewers`: Echo `currentPr.reviewers ?? []` verbatim (required field; fallback to empty array if undefined, though schema should guarantee it exists).
4. **Helper function:** `attemptPut(versionOverride?)` — abstracts PUT call, allows version override for retry.
5. **Retry logic:** Try PUT; if 409 error (optimistic lock conflict), re-fetch GET once, use fresh version, retry PUT. If second 409, throw.
6. **Logging:** `log('warn', ...)` on 409 retry (operation context for debugging).

**Imports check:**

- `log` from `../logger.ts` — already imported at top of file (line ~1-10).
- `PullRequest` type from `@types` — already imported.

**Error detection:**

- Bitbucket Server/DC returns 409 status code with error message containing "PullRequestOutOfDateException" or similar. The existing `client.requestJson` likely throws an error with message containing "409" or a structured error. Adjust the `err.message.includes('409')` check to match the actual error shape if needed.
- **CRITICAL:** Test the error shape in Phase 3 unit tests. If `client.requestJson` throws a structured error object (e.g., `{status: 409, ...}`), update the check to `(err as any).status === 409` (avoid `as` if possible; use type guard or instanceof check if client has custom error class).

**Type safety:**

- `body` is `Record<string, unknown>` matching existing pattern.
- All fields are sourced from strongly-typed `PullRequest` or caller input.
- No `any`, no type assertions (`as`).

**Logging:**

- Never log `BITBUCKET_TOKEN` (not present in this method).
- Log project/repo/prId for retry context (safe identifiers).

**Fallback for undefined reviewers:**

- `currentPr.reviewers ?? []` — defensive fallback if schema guarantees are violated at runtime. Schema says `reviewers?: Participant[]`, so it's optional. Bitbucket always returns it, but TypeScript requires the null check. Using `[]` is safe (Bitbucket interprets it as "no reviewers", which is correct if the field is truly absent).

## Verification (Phase 4)

- Typecheck passes: `pnpm run typecheck`.
- Lint passes: `pnpm run lint:all`.
- Unit tests (Phase 3) mock GET returning a PR with `reviewers: [{user: {name: 'alice'}}]`, assert PUT body includes that exact reviewer object.
- Unit tests mock 409 error, assert re-fetch + retry occurs exactly once.
- Live test: update PR with >=1 reviewer, confirm reviewers retained.

## Edge Cases

1. **Caller supplies version:** Use caller's version, not fetched version. This allows advanced callers to manage version explicitly (e.g., they cached the PR state and want to enforce that specific version).
2. **Caller supplies neither title nor description:** The handler (Phase 2) enforces "at least one of title/description" via `.refine()`, so this method will never receive a call with both undefined. If it did, the body would echo current title+description, effectively a no-op update (harmless).
3. **GET fails:** Throw immediately (no retry for GET failures; only PUT 409 triggers retry).
4. **PUT fails with non-409 error:** Throw immediately (no retry; only 409 is retryable).
5. **Second PUT returns 409:** Throw immediately (single retry exhausted; caller must handle).

## Dependencies

- `this.get(project, repo, prId)` — already implemented (`src/bitbucket/api/pull-requests.ts` line ~100-110), returns `Promise<PullRequest>`.
- `log()` from `src/logger.ts` — already imported.
- `PullRequest` type from `@types` — already imported.

## Phase Gate

- [ ] Code written matching snippet above exactly.
- [ ] Typecheck passes (`pnpm run typecheck`).
- [ ] No lint errors in modified file (`pnpm run lint:all`).
- [ ] Imports verified (log, PullRequest).
- [ ] Error shape checked (409 detection logic matches client error format).
