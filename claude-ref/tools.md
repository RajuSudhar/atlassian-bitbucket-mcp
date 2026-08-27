# tools (src/tools/\*)

## Layout

- One file per category: `pr-tools.ts`, `repo-tools.ts`, `search-tools.ts`.
- Tool name prefix: `bitbucket_*`.

## Execution contract (mandatory order)

1. Parse + validate input (zod or hand-rolled narrowing on `unknown`).
2. Permission check against `BITBUCKET_ALLOWED_ACTIONS` — throw if denied.
3. `log('info', 'tool start', { operation: 'tool_execute', toolName })`.
4. Call `BitbucketClient` method.
5. On write: invalidate affected cache keys.
6. `log('info', 'tool end', { toolName, durationMs })`.
7. Return MCP-shaped result.

## Errors

- Catch at tool boundary.
- `log('error', ..., { toolName, error, statusCode? })`.
- Transform to `{ error: { code, message, details? } }`. Never leak tokens/stacks.

## Permission actions

`read_pr`, `write_pr`, `manage_pr`, `search_code`, `read_repo`, `read_project`.

Enforce BEFORE the API call, never after.

## Cache invalidation map (writes)

- `add_pr_comment` / `reply` / `update_comment` / `resolve_comment` → invalidate `pr:{id}:activities`
- `approve_pr` → invalidate `pr:{id}`
- `publish_pr_review` / `discard_pr_review` → invalidate `pr:{id}`
- (extend per tool)

## Review sessions (Server/DC 7.7+)

- A pending comment is an ordinary comment POST with `state: PENDING`; the
  session is server-side, keyed by (PR, authenticated user). No local state.
- `pending` defaults to `false` everywhere — never flip the default.
- `publish_pr_review` → `write_pr`, plus `manage_pr` when `participantStatus`
  is supplied (it changes approval state, same gate as `approve_pr`).
- `discard_pr_review` deletes every pending comment; treat as destructive.
