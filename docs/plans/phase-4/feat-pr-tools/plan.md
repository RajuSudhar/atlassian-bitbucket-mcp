# feat-pr-tools

Phase: 4  |  Status: [x] done
Depends on: feat-server-core, feat-permissions
Ref: `claude-ref/tools.md`, `claude-ref/client.md`, `claude-ref/cache.md`

## Goal
Implement 11 PR tools per README.md §"Pull Request Tools".

## In scope
Tools:
- `bitbucket_list_pull_requests` (read_pr)
- `bitbucket_get_pull_request` (read_pr)
- `bitbucket_get_pr_diff` (read_pr)
- `bitbucket_get_pr_commits` (read_pr)
- `bitbucket_get_pr_activities` (read_pr)
- `bitbucket_add_pr_comment` (write_pr)
- `bitbucket_add_pr_inline_comment` (write_pr)
- `bitbucket_reply_to_comment` (write_pr)
- `bitbucket_resolve_comment` (manage_pr)
- `bitbucket_update_comment` (write_pr)
- `bitbucket_approve_pr` (manage_pr)

## Out of scope
- Merge / decline (future manage_pr extensions).
- Bulk operations.

## Design
- One file: `src/tools/pr-tools.ts`.
- Per-tool: zod input schema → `requirePermission` → `log start` → `client.pr.*` → invalidate → `log end` → MCP result.
- Write tools invalidate `pr:{id}`, `pr:{id}:activities`, `pr:{id}:diff` as applicable.

## Tasks
- [x] schemas per tool
- [x] tool descriptors (MCP tool metadata)
- [x] implementation per `tools.md` contract
- [x] cache invalidation matrix
- [ ] unit tests per tool (happy + error + permission denied)

## Definition of done
- [x] all 11 tools registered
- [ ] permission enforcement tested for each
- [ ] ≥ 80% coverage
- [x] TRACK.md updated
