# packages & lockfiles

- pnpm is primary. npm supported for compatibility.
- Both lockfiles MUST exist and stay in sync: `pnpm-lock.yaml`, `package-lock.json`.
- After any dep change: `pnpm run sync:locks` → commit BOTH lockfiles in the same commit.
- Pre-commit hook auto-syncs on `package.json` change. Never bypass.
- Never hand-edit lockfiles.
- Exact versions in `package.json`. No ranges.
- Add: `pnpm add <pkg>` (runtime) / `pnpm add -D <pkg>` (dev).
- Remove: `pnpm remove <pkg>` then `pnpm run sync:locks`.
