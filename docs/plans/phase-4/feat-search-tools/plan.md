# feat-search-tools

Phase: 4  |  Status: [ ] todo
Depends on: feat-server-core, feat-permissions
Ref: `claude-ref/tools.md`, `claude-ref/client.md`

## Goal
Implement code + commit search tools.

## In scope
- `bitbucket_search_code` (search_code)
- `bitbucket_search_commits` (search_code)

## Out of scope
- Lucene advanced query parsing (future enhancement per ARCHITECTURE.md).
- Cross-project federation.

## Design
- `src/tools/search-tools.ts`.
- Pagination handled inside tool; return cursor + first N results.
- No cache (search queries too varied).
- Cloud vs Server: two endpoints; flavor handled in client, not here.

## Tasks
- [ ] schemas with query validation (length limits, allowed operators)
- [ ] pagination handling
- [ ] impl per `tools.md` contract
- [ ] tests: empty result, paginated, malformed query

## Definition of done
- [ ] both tools registered and flavor-agnostic
- [ ] ≥ 80% coverage
- [ ] TRACK.md updated
