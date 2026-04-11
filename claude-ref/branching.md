# branching & commits

## Branch

Format: `<type>/<description>` or `<type>/<TICKET-ID>-<description>`.

Allowed types: `feature`, `release`, `fix`, `doc`, `test`, `chore`, `refactor`, `hotfix`.

Rejected aliases: `feat`, `bugfix`, `perf`, `docs` (commit type is `docs`, branch type is `doc`).

Description: kebab-case, ≥ 3 words when no ticket ID. No vague terms (`update`, `change`, `fix` alone).

Protected (validation skipped): `main`, `master`, `develop`, `development`.

Create via: `pnpm run branch:create`.

## Commit

Conventional Commits: `<type>(<scope>)?: <subject>`.

Types: `feat|fix|docs|style|refactor|test|chore|ci|build|perf|revert`.

Subject: imperative, lowercase, no trailing period, no emojis, ≤ 72 chars.

Body: wrap at 72; explain _why_, not _what_.

Footer: `BREAKING CHANGE:` or `Refs: TICKET-123`.
