# packages & lockfiles

- pnpm is the only supported package manager.
- Lockfile: `pnpm-lock.yaml` (committed to repo).
- Never hand-edit lockfiles.
- Exact versions in `package.json`. No ranges.
- Add: `pnpm add <pkg>` (runtime) / `pnpm add -D <pkg>` (dev).
- Remove: `pnpm remove <pkg>`.
- Audit: `pnpm audit` before committing security-sensitive changes.
- Pre-commit hook runs automatically before each commit (prettier, markdownlint, lint, typecheck, build).
