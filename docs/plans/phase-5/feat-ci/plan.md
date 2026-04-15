# feat-ci

Phase: 5 | Status: [ ] todo
Depends on: feat-unit-tests
Ref: `claude-ref/packages.md`, `claude-ref/security.md`, `claude-ref/openapi.md`

## Goal

CI pipeline enforcing every guarantee the pre-commit hook enforces, plus cross-PM install verification.

## In scope

- Matrix: Node 20, 22. pnpm + npm install checks.
- Jobs: install → lint:all → typecheck → openapi:lint → types:gen drift → build → test:coverage → audit.
- Lockfile-sync check (fail if lockfiles drifted).
- OpenAPI → types drift check.

## Out of scope

- Release automation (feat-npx-release).

## Design

- GitHub Actions (or equivalent) under `.github/workflows/ci.yml`.
- Cache pnpm store keyed on lockfile hash.
- Fail on `pnpm audit` high/critical.

## Tasks

- [ ] workflow file
- [ ] matrix setup
- [ ] drift-check steps
- [ ] status badge in README

## Definition of done

- [ ] green CI on trunk
- [ ] CI time ≤ 5 min
- [ ] TRACK.md updated
