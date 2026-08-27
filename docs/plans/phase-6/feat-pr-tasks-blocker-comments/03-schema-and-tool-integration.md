# Phase 3 — Schema + Tool Integration

## Objective

Add a dedicated `listTasksShape` to `src/tools/schemas.ts` with a `state` enum field (default `'ALL'`), update the `bitbucket_list_pr_tasks` handler in `src/tools/pr-tools.ts` to parse the new shape and pass the state parameter to `prApi.listTasks`, and update the tool registry entry in `src/tools/registry.ts` with the new schema and description.

## Scope

### In Scope

- Add `listTasksShape` to `src/tools/schemas.ts` (extends `prRefShape` + pagination + `state` enum).
- Update `bitbucket_list_pr_tasks` handler in `src/tools/pr-tools.ts` (lines ~446-476) to:
  - Parse `listTasksShape` instead of `prPaginatedShape`.
  - Map `state: 'ALL'` to `undefined` (omit query param); pass `'OPEN'`/`'RESOLVED'` directly to `prApi.listTasks`.
  - Update logging to include `state`.
- Update `src/tools/registry.ts` tool definition for `bitbucket_list_pr_tasks`:
  - Replace `prPaginatedShape` with `listTasksShape`.
  - Update description to mention state filter.

### Out of Scope

- Changes to other tool handlers in `src/tools/pr-tools.ts`.
- Changes to `prPaginatedShape` (retained for other paginated tools: `bitbucket_list_pr_comments`, `bitbucket_list_pr_activities`).

## Implementation

### Step 3.1: Add listTasksShape to schemas.ts

**File**: `src/tools/schemas.ts`

Insert after `deletePrTaskShape` definition (after line 102), before the `// --- Repo Tools` comment:

```typescript
export const listTasksShape = {
  ...prRefShape,
  state: z
    .enum(['OPEN', 'RESOLVED', 'ALL'])
    .default('ALL')
    .describe('Filter tasks by state: OPEN, RESOLVED, or ALL (default)'),
  limit,
  start,
} as const;
```

**Rationale**:

- `...prRefShape` includes `project`, `repo`, `prId` (required fields).
- `state` enum with three values: `'OPEN'`, `'RESOLVED'`, `'ALL'`. Defaults to `'ALL'` (fetch all states).
- `limit` and `start` (optional pagination fields, reused from existing definitions).
- Type: `ZodRawShape` (`as const`) for compatibility with both `z.object(...)` and MCP SDK tool descriptor.

### Step 3.2: Update bitbucket_list_pr_tasks handler in pr-tools.ts

**File**: `src/tools/pr-tools.ts`

**Current code** (lines ~446-476):

```typescript
bitbucket_list_pr_tasks: async (args: unknown): Promise<McpToolResult> => {
  const start = Date.now();
  try {
    const input = z.object(prPaginatedShape).parse(args);
    requirePermission(config, 'read_pr');
    requireScope(config, input.project, input.repo);
    log('info', 'tool start', {
      operation: 'tool_execute',
      toolName: 'bitbucket_list_pr_tasks',
    });
    const result = await prApi.listTasks(
      input.project,
      input.repo,
      input.prId,
      input.limit,
      input.start
    );
    log('info', 'tool end', {
      toolName: 'bitbucket_list_pr_tasks',
      durationMs: Date.now() - start,
    });
    return textResult(result);
  } catch (err) {
    log('error', 'tool error', {
      toolName: 'bitbucket_list_pr_tasks',
      error: String(err),
      durationMs: Date.now() - start,
    });
    return errorResult('LIST_TASKS_FAILED', err instanceof Error ? err.message : String(err));
  }
},
```

**New code** (replace lines ~446-476):

```typescript
bitbucket_list_pr_tasks: async (args: unknown): Promise<McpToolResult> => {
  const start = Date.now();
  try {
    const input = z.object(listTasksShape).parse(args);
    requirePermission(config, 'read_pr');
    requireScope(config, input.project, input.repo);
    log('info', 'tool start', {
      operation: 'tool_execute',
      toolName: 'bitbucket_list_pr_tasks',
      state: input.state,
    });

    const stateParam: 'OPEN' | 'RESOLVED' | undefined =
      input.state === 'ALL' ? undefined : input.state;

    const result = await prApi.listTasks(
      input.project,
      input.repo,
      input.prId,
      stateParam,
      input.limit,
      input.start
    );

    log('info', 'tool end', {
      toolName: 'bitbucket_list_pr_tasks',
      state: input.state,
      resultCount: result.length,
      durationMs: Date.now() - start,
    });
    return textResult(result);
  } catch (err) {
    log('error', 'tool error', {
      toolName: 'bitbucket_list_pr_tasks',
      error: String(err),
      durationMs: Date.now() - start,
    });
    return errorResult('LIST_TASKS_FAILED', err instanceof Error ? err.message : String(err));
  }
},
```

**Changes**:

- Parse `listTasksShape` instead of `prPaginatedShape` (line 3).
- Map `input.state === 'ALL'` to `undefined` (omit query param); pass `'OPEN'`/`'RESOLVED'` directly (lines 12-13).
- Pass `stateParam` as 4th argument to `prApi.listTasks` (line 16).
- Log `state` in both start and end messages (lines 9, 24).
- Log `resultCount` in end message for observability (line 25).

**Type safety**: `input.state` is typed as `'OPEN' | 'RESOLVED' | 'ALL'` by zod. The ternary maps `'ALL'` → `undefined`, `'OPEN'`/`'RESOLVED'` → string literal. The explicit type annotation `stateParam: 'OPEN' | 'RESOLVED' | undefined` ensures TypeScript verifies the mapping.

### Step 3.3: Update import for listTasksShape in pr-tools.ts

**File**: `src/tools/pr-tools.ts`

Locate the import from `./schemas.js` (approximately line 5-15):

```typescript
import {
  addPrCommentShape,
  addPrInlineCommentShape,
  createPrTaskShape,
  deletePrTaskShape,
  listPullRequestsShape,
  prPaginatedShape,
  prRefShape,
  replyToCommentShape,
  resolveCommentShape,
  resolvePrTaskShape,
  updateCommentShape,
  updatePullRequestShape,
} from './schemas.js';
```

Add `listTasksShape` to the import list:

```typescript
import {
  addPrCommentShape,
  addPrInlineCommentShape,
  createPrTaskShape,
  deletePrTaskShape,
  listPullRequestsShape,
  listTasksShape,
  prPaginatedShape,
  prRefShape,
  replyToCommentShape,
  resolveCommentShape,
  resolvePrTaskShape,
  updateCommentShape,
  updatePullRequestShape,
} from './schemas.js';
```

### Step 3.4: Update registry.ts tool definition

**File**: `src/tools/registry.ts`

Locate the `bitbucket_list_pr_tasks` tool definition (approximately line 180-200):

**Current entry**:

```typescript
{
  name: 'bitbucket_list_pr_tasks',
  description: 'List all BLOCKER-severity tasks (comments) for a pull request',
  inputSchema: prPaginatedShape,
  handler: prToolHandlers.bitbucket_list_pr_tasks,
},
```

**New entry** (replace):

```typescript
{
  name: 'bitbucket_list_pr_tasks',
  description:
    'List all BLOCKER-severity tasks (comments) for a pull request, with optional state filter (OPEN, RESOLVED, or ALL)',
  inputSchema: listTasksShape,
  handler: prToolHandlers.bitbucket_list_pr_tasks,
},
```

**Changes**:

- `inputSchema`: `prPaginatedShape` → `listTasksShape`.
- `description`: Mention state filter with concrete enum values.

### Step 3.5: Update import for listTasksShape in registry.ts

**File**: `src/tools/registry.ts`

Locate the import from `./schemas.js` (approximately line 3-10):

```typescript
import {
  addPrCommentShape,
  addPrInlineCommentShape,
  createPrTaskShape,
  deletePrTaskShape,
  getFileContentShape,
  listProjectsShape,
  listPullRequestsShape,
  prPaginatedShape,
  prRefShape,
  projectListShape,
  replyToCommentShape,
  repoPaginatedShape,
  repoRefShape,
  resolveCommentShape,
  resolvePrTaskShape,
  searchCodeShape,
  searchCommitsShape,
  updateCommentShape,
  updatePullRequestShape,
} from './schemas.js';
```

Add `listTasksShape` to the import list (alphabetically between `listPullRequestsShape` and `prPaginatedShape`):

```typescript
import {
  addPrCommentShape,
  addPrInlineCommentShape,
  createPrTaskShape,
  deletePrTaskShape,
  getFileContentShape,
  listProjectsShape,
  listPullRequestsShape,
  listTasksShape,
  prPaginatedShape,
  prRefShape,
  projectListShape,
  replyToCommentShape,
  repoPaginatedShape,
  repoRefShape,
  resolveCommentShape,
  resolvePrTaskShape,
  searchCodeShape,
  searchCommitsShape,
  updateCommentShape,
  updatePullRequestShape,
} from './schemas.js';
```

## Type Safety Notes

- `listTasksShape` is typed as `ZodRawShape` (plain object of zod types), compatible with both `z.object(listTasksShape).parse(args)` and the MCP SDK's tool descriptor.
- `input.state` defaults to `'ALL'` if omitted by the MCP client.
- The handler's `stateParam` mapping ensures `undefined` is passed to `prApi.listTasks` when `state === 'ALL'`, omitting the query param.
- `prApi.listTasks` signature (from Phase 2) accepts `state?: 'OPEN' | 'RESOLVED'`, matching the mapped type.

## Verification Gates

- [ ] `pnpm run typecheck` passes.
- [ ] `pnpm run lint:all` passes.
- [ ] `listTasksShape` exported from `src/tools/schemas.ts`.
- [ ] `bitbucket_list_pr_tasks` handler parses `listTasksShape`, logs `state`, maps `'ALL'` to `undefined`.
- [ ] `src/tools/registry.ts` uses `listTasksShape` for `bitbucket_list_pr_tasks` input schema.
- [ ] Tool description mentions state filter.

## Files Modified

| File                    | Lines Changed                      | Description                                                                    |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| `src/tools/schemas.ts`  | Insert 7 lines after line 102      | Add `listTasksShape` with state enum                                           |
| `src/tools/pr-tools.ts` | Replace lines ~446-476 (~30 lines) | Update handler to parse `listTasksShape`, map state, pass to `prApi.listTasks` |
| `src/tools/pr-tools.ts` | Update import (~line 10)           | Add `listTasksShape` to import from `./schemas.js`                             |
| `src/tools/registry.ts` | Update tool definition (~line 185) | Replace `prPaginatedShape` with `listTasksShape`, update description           |
| `src/tools/registry.ts` | Update import (~line 8)            | Add `listTasksShape` to import from `./schemas.js`                             |

## Files NOT Modified

| File                                             | Reason                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `src/tools/schemas.ts` → `prPaginatedShape`      | Retained for other paginated tools (`list_pr_comments`, `list_pr_activities`) |
| `src/tools/pr-tools.ts` → other handlers         | Only `bitbucket_list_pr_tasks` affected                                       |
| `src/tools/registry.ts` → other tool definitions | Only `bitbucket_list_pr_tasks` entry updated                                  |

## Critical Notes

- **CRITICAL**: The `state` field defaults to `'ALL'`. MCP clients that omit the `state` argument will receive all tasks (OPEN + RESOLVED), preserving backward compatibility.
- **IMPORTANT**: The handler maps `'ALL'` to `undefined` (omit query param) rather than passing the literal string `'ALL'` to the Bitbucket API, which does not recognize it as a valid `state` value.
- **IMPORTANT**: Logging includes `state` in both start and end messages for request tracing and debugging.

## Cross-references

- Phase 2 defined `prApi.listTasks` with `state?: 'OPEN' | 'RESOLVED'` parameter.
- Phase 4 will test `listTasksShape` validation (accepted values: `'OPEN'`, `'RESOLVED'`, `'ALL'`; rejected values: `'INVALID'`, `null`).
- Phase 5 will verify live behavior with `state: 'ALL'`, `state: 'OPEN'`, `state: 'RESOLVED'`.
