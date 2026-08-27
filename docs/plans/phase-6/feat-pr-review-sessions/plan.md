# feat-pr-review-sessions

Phase: 6 | Status: [x] done
Depends on: feat-pr-tools (phase 4), feat-pr-tasks (phase 6), feat-project-repo-scoping (phase 6)
Ref: `claude-ref/tools.md`, `claude-ref/client.md`, `claude-ref/openapi.md`

## Goal

Support Bitbucket's batched review workflow — **Start review → add comments →
Publish / Discard** — so a reviewer can queue feedback privately and release it
in one notification instead of drip-feeding the author one comment at a time.

## Feasibility check (done before implementation)

Existing tools could **not** do this. Every comment tool posts a published
comment immediately; nothing in `PullRequestApi` touched `state: PENDING` or the
`/review` resource, and `grep -i "pending|draft"` over `src/`, `types/`,
`openapi/` returned nothing.

Bitbucket Server/DC **does** support it natively in REST 1.0 (feature landed in
7.7 — BSERV-7743). Verified against the published REST reference
(`https://docs.atlassian.com/bitbucket-server/rest/7.7.0/bitbucket-rest.html`):

| Operation             | Method | Path                                                  | Body / notes                                                                               |
| --------------------- | ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Queue a comment       | POST   | `/projects/{p}/repos/{r}/pull-requests/{id}/comments` | `{"text": "...", "state": "PENDING"}`                                                      |
| List pending comments | GET    | `/projects/{p}/repos/{r}/pull-requests/{id}/review`   | paged threads whose comments are `PENDING`, caller-scoped                                  |
| Publish the review    | PUT    | `/projects/{p}/repos/{r}/pull-requests/{id}/review`   | `{"commentText": "...", "participantStatus": "approved"}` → `{"publishedCommentCount": N}` |
| Discard the review    | DELETE | `/projects/{p}/repos/{r}/pull-requests/{id}/review`   | 204, deletes all pending comments, author not notified                                     |

Key facts that shaped the design:

- **There is no "start review" endpoint.** The session opens implicitly on the
  first `PENDING` comment and closes on publish/discard.
- The session is **server-side state keyed by (PR, authenticated user)** — the
  REST API returns pending comments only to their author. Nothing needs to be
  held in the MCP process, so the workflow survives restarts and is shared with
  whatever the same user has open in the Bitbucket web UI.
- `PENDING` composes with the existing comment features: anchors (inline
  comments) and `severity: BLOCKER` (tasks) work unchanged.
- PUT 400s when no request body is sent, and when the participant status is
  invalid; PUT 404s when the caller has no review in progress.

## In scope

- Server/DC only — consistent with every other PR operation in this codebase.
- `pending` flag (default `false`) on `bitbucket_add_pr_comment`,
  `bitbucket_add_pr_inline_comment`, `bitbucket_reply_to_comment`,
  `bitbucket_create_pr_task`.
- Four new tools: `bitbucket_start_pr_review`, `bitbucket_get_pr_review`,
  `bitbucket_publish_pr_review`, `bitbucket_discard_pr_review`.
- `openapi/bitbucket-server.yaml`: `PENDING` added to `CommentState`, new
  `PublishReviewRequest` / `PublishReviewResult` schemas, `/review` path with
  GET/PUT/DELETE.

## Out of scope

- Bitbucket Cloud. Cloud has its own batched-comments feature with a different
  shape, and this codebase has no Cloud PR API layer at all.
- A client-side "session" abstraction (buffering comments in the MCP process).
  Rejected: Bitbucket already owns the session, and buffering locally would lose
  queued feedback on restart and diverge from what the web UI shows.
- Editing/deleting individual pending comments through dedicated tools — a
  pending comment is an ordinary comment, so `bitbucket_update_comment` already
  works on it.

## Design

- `PullRequestApi` (`src/bitbucket/api/pull-requests.ts`):
  - `addComment`, `addInlineComment`, `replyToComment`, `createTask` take a
    trailing `pending = false` and spread `{ state: 'PENDING' }` into the POST
    body when set. Default-false keeps every existing call site byte-identical.
  - `getReview(project, repo, prId, limit, start)` → `BitbucketPagedResponse<BitbucketComment>`.
  - `publishReview(project, repo, prId, { commentText?, participantStatus? })` →
    `BitbucketPublishReviewResult`. Always sends an object body (the endpoint
    400s on a missing body).
  - `discardReview(project, repo, prId)` → `void` via `client.request` (204).
- `types/bitbucket.ts`: `BitbucketParticipantStatus`,
  `BitbucketPublishReviewResult`, and `BitbucketTaskState`
  (`Exclude<BitbucketCommentState, 'PENDING'>`) so `setTaskState` cannot be
  handed a state that is meaningless for tasks now that `CommentState` includes
  `PENDING`.
- `schemas.ts`: one shared `pending` field (plain `z.boolean()`, **not**
  `z.coerce.boolean()` — coercion would turn the string `"false"` into `true`
  and silently publish a comment meant to be queued), plus
  `startPrReviewShape`, `getPrReviewShape`, `publishPrReviewShape`,
  `discardPrReviewShape`.
- `pr-tools.ts`: four handlers following the existing parse → `requirePermission`
  → `requireScope` → log → call → invalidate → log order.
- `registry.ts`: four new entries under a `PR review sessions` comment block;
  four existing descriptions mention the `pending` flag so a model can discover
  the workflow from the tool list alone.

### Participant-status casing

Atlassian's reference example spells the status lower-cased (`"approved"`)
while every other Bitbucket API — including `PUT .../participants/{userSlug}`
in the same document — spells the enum upper-cased (`APPROVED`). The tool
accepts the upper-case enum (consistent with `lineType`, `severity`, `state`
elsewhere in this repo) and `publishReview` retries once with the lower-case
form on a 400, which is the status this endpoint returns for an invalid
participant status. Live verification was not possible: the PAT in `.env` had
expired (`ExpiredPasswordAuthenticationException`).

## Permissions

- `bitbucket_start_pr_review`, `bitbucket_get_pr_review` → `read_pr`
- pending comments/tasks → unchanged from their published counterparts (`write_pr`)
- `bitbucket_publish_pr_review` → `write_pr`, **plus `manage_pr` when
  `participantStatus` is supplied** (it changes approval state, so it carries
  the same gate as `bitbucket_approve_pr`)
- `bitbucket_discard_pr_review` → `write_pr`

## Scoping

Every handler calls `requireScope(config, project, repo)` immediately after
`requirePermission`, per `feat-project-repo-scoping`.

## Tasks

- [x] `openapi/bitbucket-server.yaml` — `PENDING` state, `/review` path,
      `PublishReviewRequest` / `PublishReviewResult`
- [x] `pnpm run types:gen`
- [x] `types/bitbucket.ts` — participant status, publish result, task state
- [x] `PullRequestApi` — `pending` on 4 creators + `getReview` / `publishReview` /
      `discardReview`
- [x] `schemas.ts` — shared `pending` field + 4 review shapes
- [x] `pr-tools.ts` — 4 handlers, `pending` threaded through 4 existing handlers
- [x] `registry.ts` — 4 entries + description updates
- [x] `test/pull-requests.test.mjs` — pending body shapes, review endpoints,
      empty publish body, lower-case retry, no-retry when no status
- [x] `test/schemas.test.mjs` — `pending` default/coercion-rejection,
      `publishPrReviewShape`
- [x] typecheck + lint + tests pass
- [x] README (tool list + workflow section), CHANGELOG, `claude-ref/tools.md`
- [x] TRACK.md updated

## Definition of done

- [x] every handler calls `requirePermission` + `requireScope` before the client
- [x] `pending` defaults to false; no existing behaviour changes
- [x] typecheck + lint + 85 tests pass
- [ ] live-test against a real Server/DC PR (blocked: expired PAT). To verify:
      queue an inline comment with `pending: true` → confirm it is absent from
      `bitbucket_get_pr_activities` but present in `bitbucket_get_pr_review` →
      publish with `participantStatus: NEEDS_WORK` → confirm
      `publishedCommentCount` and that no lower-case retry warning was logged →
      repeat and discard, confirming the pending comments disappear.
