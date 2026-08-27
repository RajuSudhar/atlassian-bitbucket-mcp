# Phase 2 — Schema + handler updates

## Objective

Update `updatePullRequestShape` in `src/tools/schemas.ts` to make `version` optional (was required), update the handler in `src/tools/pr-tools.ts` to pass through the optional version, and update the tool description in `src/tools/registry.ts` to document that reviewers are now preserved.

## In Scope

- Change `updatePullRequestShape.version` field from required to optional.
- Confirm `.refine()` validation (at least one of title/description) remains intact in handler.
- Update `bitbucket_update_pull_request` handler to handle optional version (no logic change needed, just type alignment).
- Update tool description in `registry.ts` to note reviewers are preserved.

## Out of Scope

- Client changes (Phase 1).
- Tests (Phase 3).
- Verification (Phase 4).

## Implementation

### File: `src/tools/schemas.ts`

**Location:** Lines 73-78 (current `updatePullRequestShape`).

**Current code:**

```typescript
export const updatePullRequestShape = {
  ...prRefShape,
  title: z.string().min(1).optional().describe('New PR title'),
  description: z.string().optional().describe('New PR description'),
  version: z.coerce.number().int().nonnegative().describe('PR version for optimistic locking'),
} as const;
```

**New code:**

```typescript
export const updatePullRequestShape = {
  ...prRefShape,
  title: z.string().min(1).optional().describe('New PR title'),
  description: z.string().optional().describe('New PR description (reviewers are preserved)'),
  version: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('PR version for optimistic locking (auto-fetched if omitted)'),
} as const;
```

**Key changes:**

1. **version field:** Add `.optional()` before `.describe()` — makes version optional.
2. **description field update:** Add "(reviewers are preserved)" to description field's `.describe()` — inline documentation for tool callers.
3. **version field description:** Update to "(auto-fetched if omitted)" — clarifies the new behavior.

**Type impact:**

- Zod schema now allows `{project, repo, prId, title?: string, description?: string, version?: number}`.
- Handler `.parse(args)` will accept input without `version` field.

**Validation preserved:**

- The `.refine()` check (at least one of title/description) lives in the handler (see handler section below), not in the shape. No change needed in shape.

### File: `src/tools/pr-tools.ts`

**Location:** Lines 375-412 (current `bitbucket_update_pull_request` handler).

**Current code (relevant excerpt):**

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
      version: input.version,  // ← was required, now optional
    });
    // ... rest of handler
  }
}
```

**New code (no logic change, just type alignment):**

No code change needed in handler body. The handler already passes `input.version` to `updatePullRequest`. Since Phase 1 changed the client signature to accept `version?: number`, and Phase 2 changed the schema to make `version` optional, TypeScript will now correctly type `input.version` as `number | undefined`, matching the client's expectation.

**Verification:**

- Typecheck will confirm the types align: `input.version` (type `number | undefined` after `.parse()`) matches `updates.version?: number` in client signature.
- The `.refine()` check still enforces "at least one of title or description".

**No other changes needed:**

- Permission check: still `requirePermission(config, 'write_pr')` — correct.
- Scope check: still `requireScope(config, input.project, input.repo)` — correct.
- Cache invalidation: still `invalidatePrCache(cache, config, input.project, input.repo, input.prId)` — correct.
- Logging: no changes needed.

### File: `src/tools/registry.ts`

**Location:** Line ~165-170 (approximate; exact line depends on current registry state).

**Current entry:**

```typescript
{
  name: 'bitbucket_update_pull_request',
  description: 'Update PR title and/or description (Server/DC, requires version for optimistic locking)',
  shape: updatePullRequestShape,
  handler: h.pr.bitbucket_update_pull_request,
},
```

**New entry:**

```typescript
{
  name: 'bitbucket_update_pull_request',
  description: 'Update PR title and/or description (Server/DC, auto-preserves reviewers, version optional)',
  shape: updatePullRequestShape,
  handler: h.pr.bitbucket_update_pull_request,
},
```

**Key changes:**

1. **Remove:** "requires version for optimistic locking" — version is now optional.
2. **Add:** "auto-preserves reviewers" — documents the fix.
3. **Add:** "version optional" — clarifies the new behavior.

**Import check:**

- `updatePullRequestShape` is already imported from `./schemas.ts` at the top of `registry.ts`. No import changes needed.

## Type Flow

### Before (Phase 1 complete, Phase 2 not started)

- Schema: `version: z.coerce.number()...` (required) → `input.version: number` after `.parse()`.
- Client: `version?: number` (optional).
- **Type error:** TypeScript complains because handler passes required `number` to client expecting optional `number | undefined`. This is actually fine (required is a subtype of optional), but semantically incorrect (schema says required, client says optional).

### After (Phase 2 complete)

- Schema: `version: z.coerce.number()...optional()` → `input.version: number | undefined` after `.parse()`.
- Client: `version?: number` (optional).
- **Type alignment:** `number | undefined` matches `number | undefined` — correct.

## Verification (Phase 3 Schema Tests)

- `test/schemas.test.mjs` will assert:
  - Valid input: `{project: 'p', repo: 'r', prId: 1, title: 'new'}` (no version) → parses successfully.
  - Valid input: `{project: 'p', repo: 'r', prId: 1, description: 'new', version: 5}` → parses successfully.
  - Invalid input: `{project: 'p', repo: 'r', prId: 1}` (no title, no description) → refine fails with "At least one of title or description must be provided".
  - Invalid input: `{project: 'p', repo: 'r', prId: 1, title: 'new', version: -1}` → fails nonnegative check.

## Phase Gate

- [ ] `updatePullRequestShape` in `schemas.ts` updated: version optional, descriptions updated.
- [ ] `registry.ts` description updated: mentions reviewers preserved, version optional.
- [ ] Typecheck passes (`pnpm run typecheck`).
- [ ] No lint errors (`pnpm run lint:all`).
- [ ] Handler code unchanged (type alignment only).
