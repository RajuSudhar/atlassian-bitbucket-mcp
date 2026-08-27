# Phase 1 — OpenAPI + Types

## Objective

Add the `/blocker-comments` GET endpoint to `openapi/bitbucket-server.yaml` with optional `state` query parameter, regenerate TypeScript types via `pnpm run types:gen`, and confirm `types/bitbucket.ts` exports the response type under existing `BitbucketComment` / `BitbucketPagedResponse<BitbucketComment>`.

## Scope

### In Scope

- Add `/projects/{project}/repos/{repo}/pull-requests/{prId}/blocker-comments` GET path to `openapi/bitbucket-server.yaml`.
- Define `state` query parameter as optional enum: `['OPEN', 'RESOLVED']`.
- Reference existing `Comment` schema in response (already defined in openapi/bitbucket-server.yaml).
- Confirm `PagedResponseMeta` schema exists (already defined; used for all paginated responses).
- Run `pnpm run types:gen` (scripts/gen-types.sh) to regenerate `types/generated/bitbucket-server.d.ts`.
- Verify `types/bitbucket.ts` already exports `BitbucketComment` and `BitbucketPagedResponse<T>` (no changes expected).

### Out of Scope

- Cloud API changes (`openapi/bitbucket-cloud.yaml` untouched).
- Changes to `types/bitbucket.ts` beyond verification (already exports correct types).
- Adding PUT `/blocker-comments/{id}` (state transitions use existing `/comments/{id}` endpoint).

## Implementation

### Step 1.1: Add GET /blocker-comments path to openapi/bitbucket-server.yaml

**File**: `openapi/bitbucket-server.yaml`

Insert after existing `/pull-requests` paths (approximately after line 17, before `components:`):

```yaml
paths:
  /projects/{project}/repos/{repo}/pull-requests/{prId}/blocker-comments:
    get:
      summary: List blocker comments (root + reply) for a pull request
      description: |
        Returns ALL BLOCKER-severity comments (root-level and nested replies)
        for a pull request. Supports optional state filtering and pagination.
        Requires Bitbucket Server/DC 7.2+.
      operationId: getBlockerComments
      parameters:
        - name: project
          in: path
          required: true
          schema:
            type: string
          description: Project key
        - name: repo
          in: path
          required: true
          schema:
            type: string
          description: Repository slug
        - name: prId
          in: path
          required: true
          schema:
            type: integer
          description: Pull request ID
        - name: state
          in: query
          required: false
          schema:
            type: string
            enum: [OPEN, RESOLVED]
          description: Filter tasks by state (OPEN or RESOLVED); omit for all states
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 1000
            default: 25
          description: Maximum results per page
        - name: start
          in: query
          required: false
          schema:
            type: integer
            minimum: 0
            default: 0
          description: Pagination offset
      responses:
        '200':
          description: Paginated list of BLOCKER comments
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/PagedResponseMeta'
                  - type: object
                    properties:
                      values:
                        type: array
                        items:
                          $ref: '#/components/schemas/Comment'
        '404':
          description: Pull request not found or endpoint not supported (Server/DC < 7.2)
```

**Rationale**: The existing `Comment` schema already includes `id`, `version`, `text`, `severity`, `state`, `author`, `comments` (nested replies), `permittedOperations`, etc. The paginated response is composed via `allOf` combining `PagedResponseMeta` (provides `size`, `limit`, `isLastPage`, `start`, `nextPageStart`) with the typed `values` array.

### Step 1.2: Verify existing schemas

**File**: `openapi/bitbucket-server.yaml` (read-only verification)

Confirm the following schemas already exist under `components.schemas`:

- `Comment` (line ~150-200): includes `id`, `version`, `text`, `severity` enum `['NORMAL','BLOCKER']`, `state` ref `CommentState`, `author` ref `User`, `comments` (array of nested `Comment`), `permittedOperations`.
- `CommentState` (line ~130): enum `['OPEN','RESOLVED']`.
- `PagedResponseMeta` (line ~250-270): includes `size`, `limit`, `isLastPage`, `start`, `nextPageStart`.

No schema changes required; these are already defined.

### Step 1.3: Regenerate types

**Command**:

```bash
pnpm run types:gen
```

This runs `scripts/gen-types.sh`, which:

1. Calls `openapi-typescript` on `openapi/bitbucket-server.yaml` → outputs `types/generated/bitbucket-server.d.ts`.
2. Calls `openapi-typescript` on `openapi/bitbucket-cloud.yaml` → outputs `types/generated/bitbucket-cloud.d.ts`.

**Expected output** in `types/generated/bitbucket-server.d.ts`:

The generated `components.schemas.Comment` type will remain unchanged (already defined). The `paths` object will now include:

```typescript
export interface paths {
  '/projects/{project}/repos/{repo}/pull-requests/{prId}/blocker-comments': {
    get: {
      parameters: {
        path: {
          project: string;
          repo: string;
          prId: number;
        };
        query?: {
          state?: 'OPEN' | 'RESOLVED';
          limit?: number;
          start?: number;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': components['schemas']['PagedResponseMeta'] & {
              values: components['schemas']['Comment'][];
            };
          };
        };
        404: {
          description: string;
        };
      };
    };
  };
}
```

### Step 1.4: Verify types/bitbucket.ts exports

**File**: `types/bitbucket.ts` (read-only verification)

Confirm the following exports already exist (lines 29-32, 47-49):

```typescript
export type BitbucketComment = ServerSchemas['Comment'];
export type BitbucketCommentState = ServerSchemas['CommentState'];

export type BitbucketPagedResponse<T> = ServerSchemas['PagedResponseMeta'] & {
  readonly values: ReadonlyArray<T>;
};
```

No changes to `types/bitbucket.ts` required; the existing exports cover the new endpoint's response type (`BitbucketPagedResponse<BitbucketComment>`).

## Verification Gates

- [ ] `pnpm run types:gen` completes without errors.
- [ ] `types/generated/bitbucket-server.d.ts` contains `/blocker-comments` path with `state` query param.
- [ ] `pnpm run typecheck` passes.
- [ ] `types/bitbucket.ts` exports `BitbucketComment` and `BitbucketPagedResponse<T>` (no changes required, verification only).

## Files Modified

| File                                    | Lines Changed                  | Description                                             |
| --------------------------------------- | ------------------------------ | ------------------------------------------------------- |
| `openapi/bitbucket-server.yaml`         | Insert ~70 lines after line 17 | Add GET `/blocker-comments` path with state query param |
| `types/generated/bitbucket-server.d.ts` | Auto-regenerated               | openapi-typescript output (derived, committed)          |

## Files NOT Modified

| File                           | Reason                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `types/bitbucket.ts`           | Existing exports (`BitbucketComment`, `BitbucketPagedResponse<T>`) already cover new endpoint response |
| `openapi/bitbucket-cloud.yaml` | Cloud API not affected; Server/DC endpoint only                                                        |

## Critical Notes

- **CRITICAL**: This phase MUST be committed atomically with Phase 2 (client changes) to satisfy the project hard rule: "Touching types/bitbucket.ts → update openapi/\*.yaml in same commit." Although `types/bitbucket.ts` is not modified here, the types it re-exports are now backed by a new OpenAPI path, so the OpenAPI + client changes must land together.
- **IMPORTANT**: The `state` query param is optional. Omitting it returns all BLOCKER comments (OPEN + RESOLVED). The client will map the tool's `state: 'ALL'` input to "no state query param."
- The generated types use exact TypeScript unions for enum values (`"OPEN" | "RESOLVED"`), avoiding string widening.

## Cross-references

- Phase 2 will consume the regenerated `BitbucketPagedResponse<BitbucketComment>` type in `src/bitbucket/api/pull-requests.ts`.
- Phase 3 will consume the `state` query param type for schema validation in `src/tools/schemas.ts`.
