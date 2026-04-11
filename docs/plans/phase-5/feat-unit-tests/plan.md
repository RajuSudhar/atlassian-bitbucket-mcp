# feat-unit-tests

Phase: 5  |  Status: [ ] todo
Depends on: feat-server-core, feat-pr-tools, feat-repo-tools, feat-search-tools, feat-permissions
Ref: `claude-ref/testing.md`

## Goal
Consolidate coverage across all modules and hit the ≥80% bar repo-wide.

## In scope
- Coverage report wired to CI.
- Missing-edge-case sweep per module.
- Contract tests: generated OpenAPI types vs mocked responses.

## Out of scope
- E2E against real Bitbucket (manual verification only).

## Design
- Jest with `--coverage` gate in CI.
- Contract test: parse real Bitbucket sample JSONs (anonymized fixtures under `test/fixtures/`) and assert they satisfy curated types.

## Tasks
- [ ] coverage threshold config in `jest.config.ts`
- [ ] fixtures directory with Cloud + Server samples per resource
- [ ] contract tests per resource
- [ ] CI job wiring
- [ ] fill gaps from coverage report

## Definition of done
- [ ] `pnpm test --coverage` ≥ 80% lines/branches
- [ ] CI fails on regression
- [ ] TRACK.md updated
