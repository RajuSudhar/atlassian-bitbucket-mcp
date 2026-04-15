# feat-repo-tools

Phase: 4 | Status: [x] done
Depends on: feat-server-core, feat-permissions
Ref: `claude-ref/tools.md`, `claude-ref/client.md`, `claude-ref/cache.md`

## Goal

Implement 6 repository/project tools per README.md §"Repository Tools".

## In scope

- `bitbucket_list_projects` (read_project)
- `bitbucket_list_repositories` (read_repo)
- `bitbucket_get_repository` (read_repo)
- `bitbucket_get_branches` (read_repo)
- `bitbucket_get_commits` (read_repo)
- `bitbucket_get_file_content` (read_repo)

## Out of scope

- Repo create/delete.
- Branch create/delete.

## Design

- `src/tools/repo-tools.ts`.
- Heavy cache usage: repos list, repo meta, projects list.
- File content NOT cached (too volatile, too large).

## Tasks

- [x] schemas
- [x] tool descriptors
- [x] impl with cache
- [ ] tests

## Definition of done

- [x] all 6 tools registered
- [ ] cache hit verified by test on repeated repo list calls
- [ ] ≥ 80% coverage
- [x] TRACK.md updated
