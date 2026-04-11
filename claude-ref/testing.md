# testing

- Jest + TS. Target ≥ 80% coverage.
- Colocate: `foo.ts` ↔ `foo.test.ts`.
- `describe('Unit', ...)` / `it('should <behavior>', ...)`.
- Mock Bitbucket HTTP (msw or jest mock). Never hit real instances in unit tests.
- Required coverage: cache, logger, config validation, `BitbucketClient`, every tool, every error path, permission enforcement.
- Snapshot tests only for stable shapes (e.g. MCP tool descriptors).
- No shared mutable state between tests. Reset mocks in `beforeEach`.
- `it.each` for parametric cases.
